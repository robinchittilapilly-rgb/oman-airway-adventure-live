import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plane,
  Sparkles,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import heroImg from "../assets/oman-air-hero.jpg";
import studioImg from "../assets/business-studio.jpg";
import { useIBE } from "../context/IBEContext";
import {
  AIRPORTS,
  FARE_BRANDS,
  OMAN_AIR_20_ROUTES,
  findRouteForPair,
  formatDuration,
  formatMoney,
  generateFlightOptions,
  get30DayFareRepository,
  getDateISO,
  type FareBrandId,
  type FlightOption,
} from "../data/omanAirRoutes";
import {
  DIRECT_ANCILLARIES,
  MEAL_OPTIONS,
  SINDBAD_SAVED_TRAVELERS,
  SSR_OPTIONS,
  VIRTUAL_BUNDLES,
  type SeatCell,
} from "../data/ancillariesAndSeats";
import {
  PROMO_CODES,
  calculateSindbadMiles,
  computeAncillaryPriceOMR,
  computeHoldExpiryISO,
  computeSeatFeeOMR,
  expandPassengerTypes,
  generateRLOC,
  getTotalPassengers,
  validateIcaoPassenger,
  validatePassengerAgeForType,
} from "../lib/ibe-rules";
import { t } from "../lib/i18n";
import { FlightSearchWidget, type SearchCriteria } from "../components/ibe/FlightSearchWidget";
import { SeatMapSelector } from "../components/ibe/SeatMapSelector";
import { AncillariesPanel } from "../components/ibe/AncillariesPanel";
import { PassengerFormStep, type PassengerFormData } from "../components/ibe/PassengerFormStep";
import { PaymentCheckoutStep } from "../components/ibe/PaymentCheckoutStep";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oman Air | Book Flights Across 20 Global Routes" },
      { name: "description", content: "Search 30-day low fares across 20 Oman Air routes, compare branded fares, choose seats and virtual bundles, and check in seamlessly." },
      { property: "og:title", content: "Oman Air | Book Flights" },
      { property: "og:description", content: "Oman Air Internet Booking Engine prototype with 30-day fare calendar, Business Studio, and Sindbad rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type FunnelStep = 0 | 1 | 2 | 3 | 4 | 5;
const CART_DRAFT_KEY = "oman_air_ibe_cart_draft_v1";

function Index() {
  const { lang, currency, sindbadSignedIn, sindbadTier, addBooking, spendMiles, spendTravelBank, addMiles } = useIBE();
  const copy = t(lang);

  const [step, setStep] = useState<FunnelStep>(0);
  const [search, setSearch] = useState<SearchCriteria | null>(null);
  const [selectedOutboundId, setSelectedOutboundId] = useState<string>("");
  const [selectedReturnId, setSelectedReturnId] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<FareBrandId>("ECO_COMFORT");
  const [sortBy, setSortBy] = useState<"price" | "duration">("price");
  const [nonStopOnly, setNonStopOnly] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string>("All");

  // Step 2: Seats & Ancillaries
  const [selectedSeats, setSelectedSeats] = useState<SeatCell[]>([]);
  const [selectedBundleIds, setSelectedBundleIds] = useState<string[]>([]);
  const [selectedAncillaryIds, setSelectedAncillaryIds] = useState<string[]>([]);
  const [selectedMealId, setSelectedMealId] = useState<string>("MEAL_STD");
  const [selectedSsrIds, setSelectedSsrIds] = useState<string[]>([]);
  const [insuranceChoice, setInsuranceChoice] = useState<"unset" | "yes" | "no">("unset");

  // Step 3: Passengers
  const [paxForms, setPaxForms] = useState<PassengerFormData[]>([]);

  // Step 5: Confirmed RLOC
  const [confirmedRloc, setConfirmedRloc] = useState<string | null>(null);
  const [confirmedMode, setConfirmedMode] = useState<"pay" | "hold">("pay");

  // Restore active cart draft from sessionStorage (FR-2)
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(CART_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        step?: FunnelStep;
        search?: SearchCriteria | null;
        selectedOutboundId?: string;
        selectedReturnId?: string;
        selectedBrand?: FareBrandId;
        selectedSeats?: SeatCell[];
        selectedBundleIds?: string[];
        selectedAncillaryIds?: string[];
        selectedMealId?: string;
        selectedSsrIds?: string[];
        insuranceChoice?: "unset" | "yes" | "no";
        paxForms?: PassengerFormData[];
      };
      if (draft.search && draft.step && draft.step > 0 && draft.step < 5) {
        setSearch(draft.search);
        setStep(draft.step);
        if (draft.selectedOutboundId) setSelectedOutboundId(draft.selectedOutboundId);
        if (draft.selectedReturnId) setSelectedReturnId(draft.selectedReturnId);
        if (draft.selectedBrand) setSelectedBrand(draft.selectedBrand);
        if (draft.selectedSeats) setSelectedSeats(draft.selectedSeats);
        if (draft.selectedBundleIds) setSelectedBundleIds(draft.selectedBundleIds);
        if (draft.selectedAncillaryIds) setSelectedAncillaryIds(draft.selectedAncillaryIds);
        if (draft.selectedMealId) setSelectedMealId(draft.selectedMealId);
        if (draft.selectedSsrIds) setSelectedSsrIds(draft.selectedSsrIds);
        if (draft.insuranceChoice) setInsuranceChoice(draft.insuranceChoice);
        if (draft.paxForms) setPaxForms(draft.paxForms);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      if (step === 0 || step === 5 || !search) {
        window.sessionStorage.removeItem(CART_DRAFT_KEY);
        return;
      }
      window.sessionStorage.setItem(
        CART_DRAFT_KEY,
        JSON.stringify({
          step,
          search,
          selectedOutboundId,
          selectedReturnId,
          selectedBrand,
          selectedSeats,
          selectedBundleIds,
          selectedAncillaryIds,
          selectedMealId,
          selectedSsrIds,
          insuranceChoice,
          paxForms,
        })
      );
    } catch {
      // ignore storage errors
    }
  }, [
    step,
    search,
    selectedOutboundId,
    selectedReturnId,
    selectedBrand,
    selectedSeats,
    selectedBundleIds,
    selectedAncillaryIds,
    selectedMealId,
    selectedSsrIds,
    insuranceChoice,
    paxForms,
  ]);

  const routeMatch = useMemo(() => {
    if (!search) return null;
    return findRouteForPair(search.origin, search.destination);
  }, [search]);

  const leg2RouteMatch = useMemo(() => {
    if (!search || search.tripType !== "multicity") return null;
    return findRouteForPair(search.multiLeg2Origin, search.multiLeg2Destination);
  }, [search]);

  const thirtyDayFares = useMemo(() => {
    if (!routeMatch) return [];
    return get30DayFareRepository(routeMatch.route.id);
  }, [routeMatch]);

  const activeDayFare = useMemo(() => {
    if (!search || thirtyDayFares.length === 0) return null;
    return thirtyDayFares.find((d) => d.dateISO === search.departDate) ?? thirtyDayFares[0]!;
  }, [search, thirtyDayFares]);

  const leg2DayFare = useMemo(() => {
    if (!search || !leg2RouteMatch) return null;
    const repo = get30DayFareRepository(leg2RouteMatch.route.id);
    return repo.find((d) => d.dateISO === search.multiLeg2Date) ?? repo[0]!;
  }, [search, leg2RouteMatch]);

  const returnDayFare = useMemo(() => {
    if (!search || search.tripType !== "roundtrip" || thirtyDayFares.length === 0) return null;
    return thirtyDayFares.find((d) => d.dateISO === search.returnDate) ?? thirtyDayFares[0]!;
  }, [search, thirtyDayFares]);

  const outboundOptions = useMemo<FlightOption[]>(() => {
    if (!search) return [];
    const list = generateFlightOptions(search.origin, search.destination, search.departDate)
      .filter((f) => (!nonStopOnly ? true : f.stops === 0));
    return [...list].sort((a, b) =>
      sortBy === "duration" ? a.durationMinutes - b.durationMinutes : a.priceMultiplier - b.priceMultiplier
    );
  }, [search, nonStopOnly, sortBy]);

  const secondSegmentOptions = useMemo<FlightOption[]>(() => {
    if (!search || search.tripType === "oneway") return [];
    const list =
      search.tripType === "roundtrip"
        ? generateFlightOptions(search.destination, search.origin, search.returnDate)
        : generateFlightOptions(search.multiLeg2Origin, search.multiLeg2Destination, search.multiLeg2Date);
    const filtered = list.filter((f) => (!nonStopOnly ? true : f.stops === 0));
    return [...filtered].sort((a, b) =>
      sortBy === "duration" ? a.durationMinutes - b.durationMinutes : a.priceMultiplier - b.priceMultiplier
    );
  }, [search, nonStopOnly, sortBy]);

  const selectedOutbound =
    outboundOptions.find((o) => o.id === selectedOutboundId) ?? outboundOptions[0] ?? null;
  const selectedSecondSeg =
    secondSegmentOptions.find((o) => o.id === selectedReturnId) ?? secondSegmentOptions[0] ?? null;

  const totalPax = search ? getTotalPassengers(search.passengers) : 1;

  const handleRunSearch = (criteria: SearchCriteria) => {
    setSearch(criteria);
    const outOpts = generateFlightOptions(criteria.origin, criteria.destination, criteria.departDate);
    setSelectedOutboundId(outOpts[0]?.id ?? "");
    const secOpts =
      criteria.tripType === "roundtrip"
        ? generateFlightOptions(criteria.destination, criteria.origin, criteria.returnDate)
        : criteria.tripType === "multicity"
          ? generateFlightOptions(criteria.multiLeg2Origin, criteria.multiLeg2Destination, criteria.multiLeg2Date)
          : [];
    setSelectedReturnId(secOpts[0]?.id ?? "");

    const defaultBrand: FareBrandId =
      criteria.cabin === "studio"
        ? "BIZ_STUDIO"
        : criteria.cabin === "business"
          ? "BIZ_COMFORT"
          : "ECO_COMFORT";
    setSelectedBrand(defaultBrand);
    setSelectedSeats([]);
    setSelectedBundleIds([]);
    setSelectedAncillaryIds([]);
    setInsuranceChoice("unset");

    const roles = expandPassengerTypes(criteria.passengers);
    const forms: PassengerFormData[] = roles.map((role, i) => {
      // Only pre-fill Passenger 1 from Sindbad profile when user is actually signed in (FR-77)
      const saved = sindbadSignedIn && i === 0 ? SINDBAD_SAVED_TRAVELERS[0] : undefined;
      const defaultDob =
        role === "Infant"
          ? getDateISO(-365)
          : role === "Child"
            ? "2018-06-15"
            : role === "Senior"
              ? "1960-03-10"
              : "1996-05-14";
      return {
        role,
        firstName: saved?.firstName ?? "",
        lastName: saved?.lastName ?? "",
        dob: saved && role !== "Infant" && role !== "Child" && role !== "Senior" ? saved.dob : defaultDob,
        gender: saved?.gender ?? "M",
        passport: saved?.passport ?? "",
        nationality: saved?.nationality ?? "Oman",
        email: sindbadSignedIn && i === 0 ? "tariq.albalushi@oman.om" : "",
        phone: sindbadSignedIn && i === 0 ? "+968 9123 4567" : "",
        emergencyName: sindbadSignedIn && i === 0 ? "Salim Al-Balushi" : "",
        emergencyPhone: sindbadSignedIn && i === 0 ? "+968 9988 1122" : "",
        sindbadNo: saved?.sindbadNo ?? "",
      };
    });
    setPaxForms(forms);
    setStep(1);
  };

  const visibleBrands: FareBrandId[] = useMemo(() => {
    if (!routeMatch) return ["ECO_SAVER", "ECO_COMFORT", "ECO_FLEX"];
    if (search?.cabin === "studio" && routeMatch.route.hasStudio) return ["BIZ_COMFORT", "BIZ_FLEX", "BIZ_STUDIO"];
    if (search?.cabin === "business") {
      return routeMatch.route.hasStudio ? ["BIZ_COMFORT", "BIZ_FLEX", "BIZ_STUDIO"] : ["BIZ_COMFORT", "BIZ_FLEX"];
    }
    return ["ECO_SAVER", "ECO_COMFORT", "ECO_FLEX"];
  }, [routeMatch, search?.cabin]);

  const computeBrandPricePerPaxOMR = (brandId: FareBrandId): number => {
    const outPrice = Math.round(
      (activeDayFare?.pricesOMR[brandId] ?? 0) * (selectedOutbound?.priceMultiplier ?? 1)
    );
    if (!search || search.tripType === "oneway") return outPrice;
    if (search.tripType === "roundtrip") {
      const retBase = returnDayFare?.pricesOMR[brandId] ?? activeDayFare?.pricesOMR[brandId] ?? 0;
      const retPrice = Math.round(retBase * (selectedSecondSeg?.priceMultiplier ?? 1));
      return outPrice + retPrice;
    }
    const leg2Base = leg2DayFare?.pricesOMR[brandId] ?? activeDayFare?.pricesOMR[brandId] ?? 0;
    const leg2Price = Math.round(leg2Base * (selectedSecondSeg?.priceMultiplier ?? 1));
    return outPrice + leg2Price;
  };

  const promoEntry = search?.promoCode ? PROMO_CODES[search.promoCode] : undefined;
  const baseFarePerPaxOMR = computeBrandPricePerPaxOMR(selectedBrand);
  const baseFareOMR = baseFarePerPaxOMR * totalPax;
  const leg2TaxOMR =
    search?.tripType === "roundtrip"
      ? (routeMatch?.route.taxesOMR ?? 0)
      : search?.tripType === "multicity"
        ? (leg2RouteMatch?.route.taxesOMR ?? 0)
        : 0;
  const taxesOMR = ((routeMatch?.route.taxesOMR ?? 0) + leg2TaxOMR) * totalPax;

  const seatsFeeOMR = selectedSeats.reduce((sum, s) => {
    return (
      sum +
      computeSeatFeeOMR({
        baseSeatPriceOMR: s.priceOMR,
        fareBrand: selectedBrand,
        tier: sindbadTier,
        selectedBundleIds,
      }).priceOMR
    );
  }, 0);

  const bundlesOMR = selectedBundleIds.reduce((sum, id) => {
    return sum + (VIRTUAL_BUNDLES.find((b) => b.id === id)?.priceOMR ?? 0) * totalPax;
  }, 0);

  const directAncOMR = selectedAncillaryIds.reduce((sum, id) => {
    return (
      sum +
      computeAncillaryPriceOMR({
        ancillaryId: id,
        tier: sindbadTier,
        selectedBundleIds,
      }).priceOMR *
        totalPax
    );
  }, 0);

  const mealOMR = (MEAL_OPTIONS.find((m) => m.id === selectedMealId)?.priceOMR ?? 0) * totalPax;
  const insuranceOMR = insuranceChoice === "yes" ? 12 * totalPax : 0;
  const ancillariesOMR = seatsFeeOMR + bundlesOMR + directAncOMR + mealOMR + insuranceOMR;

  const promoDiscountOMR = promoEntry ? Math.round(baseFareOMR * (promoEntry.discountPct / 100)) : 0;
  const totalOMR = Math.max(0, baseFareOMR + taxesOMR + ancillariesOMR - promoDiscountOMR);
  const earnedMiles = calculateSindbadMiles(Math.max(0, baseFareOMR - promoDiscountOMR) + ancillariesOMR, sindbadTier);

  const handleToggleSeat = (seat: SeatCell) => {
    setSelectedSeats((prev) => {
      if (prev.some((s) => s.id === seat.id)) return prev.filter((s) => s.id !== seat.id);
      if (prev.length >= totalPax) {
        return [...prev.slice(1), seat];
      }
      return [...prev, seat];
    });
  };

  const handleProceedFromAncillaries = () => {
    if (insuranceChoice === "unset") {
      toast.error("Please select Yes or No for Oman Air Travel Protection before continuing.");
      return;
    }
    setStep(3);
  };

  const handleProceedFromPassengers = () => {
    if (!search) return;
    for (let i = 0; i < paxForms.length; i++) {
      const p = paxForms[i]!;
      const check = validateIcaoPassenger({ firstName: p.firstName, lastName: p.lastName, passport: p.passport });
      if (!check.valid) {
        toast.error(`Passenger ${i + 1}: ${check.errors[0]}`);
        return;
      }
      const ageCheck = validatePassengerAgeForType(p.dob, p.role, search.departDate);
      if (!ageCheck.valid) {
        toast.error(`Passenger ${i + 1}: ${ageCheck.error}`);
        return;
      }
    }
    setStep(4);
  };

  const handleConfirmBooking = (details: {
    mode: "pay" | "hold";
    holdHours?: 24 | 48;
    paymentLabel: string;
    milesUsed: number;
    travelBankUsedOMR: number;
    finalCashOMR: number;
  }) => {
    if (!search || !routeMatch || !selectedOutbound) return;
    if (details.milesUsed > 0) spendMiles(details.milesUsed);
    if (details.travelBankUsedOMR > 0) spendTravelBank(details.travelBankUsedOMR);
    if (details.mode === "pay" && sindbadSignedIn) addMiles(earnedMiles);

    const rloc = generateRLOC();
    const ancNames = [
      ...selectedBundleIds.map((id) => VIRTUAL_BUNDLES.find((b) => b.id === id)?.name ?? id),
      ...selectedAncillaryIds.map((id) => DIRECT_ANCILLARIES.find((a) => a.id === id)?.name ?? id),
      ...(insuranceChoice === "yes" ? ["Travel Protection Insurance"] : []),
    ];
    const ssrs = selectedSsrIds.map((id) => {
      const s = SSR_OPTIONS.find((x) => x.id === id)!;
      return { code: s.code, name: s.name, status: s.status };
    });

    addBooking({
      rloc,
      status: details.mode === "hold" ? "HELD" : "CONFIRMED",
      origin: search.origin,
      destination: search.destination,
      flightNumber: selectedOutbound.flightNumber,
      dateISO: search.departDate,
      departureTime: selectedOutbound.departureTime,
      arrivalTime: selectedOutbound.arrivalTime,
      ...(selectedSecondSeg
        ? {
            returnSegment: {
              flightNumber: selectedSecondSeg.flightNumber,
              dateISO: search.tripType === "roundtrip" ? search.returnDate : search.multiLeg2Date,
              departureTime: selectedSecondSeg.departureTime,
              arrivalTime: selectedSecondSeg.arrivalTime,
              origin: selectedSecondSeg.origin,
              destination: selectedSecondSeg.destination,
            },
          }
        : {}),
      aircraft: selectedOutbound.aircraft,
      fareBrand: selectedBrand,
      passengers: paxForms.map((p, idx) => ({
        firstName: p.firstName,
        lastName: p.lastName,
        type: p.role,
        passport: p.passport,
        seat: selectedSeats[idx]?.id ?? `${15 + idx}A`,
        checkedIn: false,
      })),
      ancillaries: ancNames,
      ssrs,
      totalPaidOMR: details.finalCashOMR,
      paymentMethod: details.paymentLabel,
      gate: "A09",
      terminal: "T1",
      ...(details.mode === "hold" ? { holdExpiresAt: computeHoldExpiryISO(details.holdHours ?? 24) } : {}),
    });

    setConfirmedRloc(rloc);
    setConfirmedMode(details.mode);
    setStep(5);
    toast.success(`Demo PNR ${rloc} saved to Manage My Booking & Check-in!`);
  };

  const filtered20Routes = useMemo(() => {
    return OMAN_AIR_20_ROUTES.filter((r) => {
      if (regionFilter === "All") return true;
      const dest = AIRPORTS.find((a) => a.code === r.destination);
      return dest?.region === regionFilter;
    });
  }, [regionFilter]);

  const nearbyAltCodes = search
    ? AIRPORTS.find((a) => a.code === search.destination)?.nearbyCodes ?? []
    : [];

  return (
    <div>
      {/* Expressive Full-Bleed Hero */}
      <section className="relative overflow-hidden">
        <img
          src={heroImg}
          alt="Oman Air Boeing 787 Dreamliner soaring over the Muscat coastline at golden hour"
          width={1600}
          height={960}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="oman-hero-gradient absolute inset-0" />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
          <p className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-teal-deep/75 px-3.5 py-1 text-xs font-semibold tracking-wide text-gold backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            {copy.hero.badge}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold tracking-tight text-primary-foreground sm:text-6xl">
            {copy.hero.title}
          </h1>
          <p className="mt-3 max-w-xl text-sm text-primary-foreground/85 sm:text-base">
            {copy.hero.subtitle}
          </p>

          <div className="mt-8">
            <FlightSearchWidget initial={search ?? undefined} onSearch={handleRunSearch} />
          </div>
        </div>
      </section>

      {/* Active IBE Booking Funnel */}
      {step > 0 && search && routeMatch && (
        <section id="booking-workspace" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {[
                { n: 1, label: "1. Flights & Brands" },
                { n: 2, label: "2. Seats & Bundles" },
                { n: 3, label: "3. Passengers & APIS" },
                { n: 4, label: "4. Review & Pay" },
                { n: 5, label: "5. Confirmed" },
              ].map((s) => (
                <button
                  key={s.n}
                  type="button"
                  disabled={s.n > step || step === 5}
                  onClick={() => setStep(s.n as FunnelStep)}
                  className={`rounded-lg px-3 py-1.5 transition-colors ${
                    step === s.n
                      ? "bg-primary text-primary-foreground"
                      : s.n < step
                        ? "bg-success/15 text-success hover:bg-success/25"
                        : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="text-xs font-bold text-primary">
              {search.origin} → {search.destination} · {search.departDate} · {totalPax} guest(s)
            </div>
          </div>

          {/* STEP 1: 30-Day Low Fare Calendar + Selectable Flight Results + Branded Fares */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                    <Calendar className="h-5 w-5 text-primary" />
                    30-Day Low Fare Calendar ({routeMatch.route.id})
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    Showing {FARE_BRANDS[selectedBrand].name} outbound prices (synthetic 30-day repository)
                  </span>
                </div>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                  {thirtyDayFares.map((day) => {
                    const active = day.dateISO === search.departDate;
                    return (
                      <button
                        key={day.dateISO}
                        type="button"
                        onClick={() => setSearch({ ...search, departDate: day.dateISO })}
                        className={`flex min-w-[96px] shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-center transition-all ${
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : day.soldOut
                              ? "border-destructive/30 bg-destructive/5 text-destructive"
                              : "border-border bg-background hover:border-primary"
                        }`}
                      >
                        <span className="text-xs font-semibold opacity-85">{day.dateISO.slice(5)}</span>
                        <span className="mt-0.5 font-display text-xs font-bold">
                          {day.soldOut ? "Sold Out" : formatMoney(day.pricesOMR[selectedBrand], currency)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeDayFare?.soldOut ? (
                <div className="rounded-2xl border border-warning bg-warning/15 p-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-warning-foreground" />
                    <div>
                      <h3 className="font-display text-lg font-bold">Flights on {search.departDate} are Sold Out</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Choose an alternative date or switch to a nearby airport with seats available:
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {thirtyDayFares
                          .filter((d) => !d.soldOut)
                          .slice(0, 4)
                          .map((alt) => (
                            <Button
                              key={alt.dateISO}
                              variant="secondary"
                              size="sm"
                              onClick={() => setSearch({ ...search, departDate: alt.dateISO })}
                            >
                              {alt.dateISO} · {formatMoney(alt.pricesOMR[selectedBrand], currency)}
                            </Button>
                          ))}
                        {nearbyAltCodes.map((code) => (
                          <Button
                            key={code}
                            variant="outline"
                            size="sm"
                            onClick={() => setSearch({ ...search, destination: code })}
                          >
                            Try nearby {code}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Working Filter & Sort Bar (FR-56) */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-2.5 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 font-semibold"><Filter className="h-3.5 w-3.5" /> Filters:</span>
                      <label htmlFor="filter-nonstop" className="inline-flex cursor-pointer items-center gap-1.5">
                        <input
                          id="filter-nonstop"
                          type="checkbox"
                          checked={nonStopOnly}
                          onChange={(e) => setNonStopOnly(e.target.checked)}
                        />
                        Non-stop only ({outboundOptions.length} shown)
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="sort-results" className="text-muted-foreground">Sort:</label>
                      <select
                        id="sort-results"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as "price" | "duration")}
                        className="rounded-md border border-border bg-card px-2 py-1 font-semibold"
                      >
                        <option value="price">Lowest Price</option>
                        <option value="duration">Shortest Duration</option>
                      </select>
                    </div>
                  </div>

                  {/* Selectable Outbound Flight Results */}
                  <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
                    <div>
                      <h3 className="font-display text-base font-bold">
                        Select Outbound Flight ({search.origin} → {search.destination} · {search.departDate})
                      </h3>
                      {outboundOptions.length === 0 ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No non-stop flights match this filter. Uncheck "Non-stop only" to view connecting itineraries.
                        </p>
                      ) : (
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          {outboundOptions.map((opt) => {
                            const active = selectedOutbound?.id === opt.id;
                            const estPrice = Math.round((activeDayFare?.pricesOMR[selectedBrand] ?? 0) * opt.priceMultiplier);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setSelectedOutboundId(opt.id)}
                                className={`flex flex-col justify-between rounded-xl border p-4 text-start transition-all ${
                                  active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-primary">
                                    <Plane className="h-4 w-4" /> {opt.flightNumber}
                                  </span>
                                  <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold">
                                    {opt.stopLabel}
                                  </span>
                                </div>
                                <div className="mt-2">
                                  <p className="font-display text-lg font-extrabold">
                                    {opt.departureTime} → {opt.arrivalTime}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDuration(opt.durationMinutes)} · {opt.aircraft}
                                    {opt.codesharePartner ? ` · ${opt.codesharePartner}` : ""}
                                  </p>
                                </div>
                                <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
                                  <span className="font-semibold text-warning-foreground">{opt.seatsRemaining} seats left</span>
                                  <span className="font-display font-bold text-primary">{formatMoney(estPrice, currency)}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Return or Multi-City Leg 2 Selector (FR-53, FR-54) */}
                    {search.tripType !== "oneway" && secondSegmentOptions.length > 0 && (
                      <div className="border-t border-border pt-5">
                        <h3 className="font-display text-base font-bold">
                          {search.tripType === "roundtrip"
                            ? `Select Return Flight (${search.destination} → ${search.origin} · ${search.returnDate})`
                            : `Select Leg 2 Flight (${search.multiLeg2Origin} → ${search.multiLeg2Destination} · ${search.multiLeg2Date})`}
                        </h3>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          {secondSegmentOptions.map((opt) => {
                            const active = selectedSecondSeg?.id === opt.id;
                            const legBase =
                              (search.tripType === "roundtrip"
                                ? returnDayFare?.pricesOMR[selectedBrand]
                                : leg2DayFare?.pricesOMR[selectedBrand]) ??
                              activeDayFare?.pricesOMR[selectedBrand] ??
                              0;
                            const estPrice = Math.round(legBase * opt.priceMultiplier);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setSelectedReturnId(opt.id)}
                                className={`flex flex-col justify-between rounded-xl border p-4 text-start transition-all ${
                                  active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-display text-sm font-bold text-primary">{opt.flightNumber}</span>
                                  <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold">{opt.stopLabel}</span>
                                </div>
                                <div className="mt-2">
                                  <p className="font-display text-lg font-extrabold">
                                    {opt.departureTime} → {opt.arrivalTime}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDuration(opt.durationMinutes)} · {opt.aircraft}
                                  </p>
                                </div>
                                <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
                                  <span>{opt.origin} → {opt.destination}</span>
                                  <span className="font-display font-bold text-primary">+{formatMoney(estPrice, currency)}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Branded Fares Comparison Matrix (FR-62, FR-83, FR-59 promo preview) */}
                    {selectedOutbound && (
                      <div className="border-t border-border pt-5">
                        <h3 className="font-display text-base font-bold">Compare Branded Fares</h3>
                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                          {visibleBrands.map((brandId) => {
                            const spec = FARE_BRANDS[brandId];
                            const rawPriceOMR = computeBrandPricePerPaxOMR(brandId);
                            const discountedOMR = promoEntry
                              ? Math.round(rawPriceOMR * (1 - promoEntry.discountPct / 100))
                              : rawPriceOMR;
                            const active = selectedBrand === brandId;
                            const miles = calculateSindbadMiles(discountedOMR, sindbadTier);
                            return (
                              <button
                                key={brandId}
                                type="button"
                                onClick={() => setSelectedBrand(brandId)}
                                className={`flex flex-col justify-between rounded-2xl border-2 p-5 text-start transition-all ${
                                  active
                                    ? "border-primary bg-primary/5 shadow-md"
                                    : "border-border bg-background hover:border-primary/50"
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="font-display text-base font-bold">
                                      {lang === "ar" ? spec.nameAr : spec.name}
                                    </span>
                                    {active && <CheckCircle2 className="h-5 w-5 text-primary" />}
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {lang === "ar" ? spec.taglineAr : spec.tagline}
                                  </p>

                                  <ul className="mt-4 space-y-1.5 text-xs">
                                    <li>• Checked Bag: <strong>{spec.checkedBagKg} kg</strong> (+{sindbadTier === "Gold" ? 15 : sindbadTier === "Silver" ? 10 : 0} kg {sindbadTier})</li>
                                    <li>• Cabin Bag: <strong>{spec.cabinBagText}</strong></li>
                                    <li>• Seat Selection: <strong>{spec.seatSelection === "free" || sindbadTier === "Gold" ? "Complimentary" : "Paid option"}</strong></li>
                                    <li>• Changes: <strong>{spec.changePolicy === "free" ? "Free" : spec.changePolicy === "reduced" ? "Low Fee" : "Standard Fee"}</strong></li>
                                    <li>• Refund: <strong>{spec.refundPolicy === "free" ? "Full Refund" : spec.refundPolicy === "fee" ? "With Fee" : "Non-refundable"}</strong></li>
                                    {spec.loungeIncluded && <li>• <strong>Majan Lounge & Fast Track included</strong></li>}
                                  </ul>
                                </div>

                                <div className="mt-5 border-t border-border pt-3">
                                  <div className="flex items-baseline gap-2">
                                    <p className="font-display text-2xl font-extrabold text-primary">
                                      {formatMoney(discountedOMR, currency)}
                                    </p>
                                    {promoEntry && (
                                      <span className="text-xs line-through text-muted-foreground">
                                        {formatMoney(rawPriceOMR, currency)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs font-medium text-muted-foreground">
                                    per guest · +{miles.toLocaleString()} Sindbad miles
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-6 flex justify-end">
                          <Button size="lg" className="gap-2 rounded-xl px-7 font-display font-bold" onClick={() => setStep(2)}>
                            Continue to Seats & Bundles
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 2: Interactive 2D Seat Map + Virtual Bundles + Ancillaries */}
          {step === 2 && selectedOutbound && (
            <div className="space-y-6">
              <SeatMapSelector
                aircraft={selectedOutbound.aircraft}
                fareBrand={selectedBrand}
                selectedBundleIds={selectedBundleIds}
                selectedSeats={selectedSeats.map((s) => s.id)}
                maxSeats={totalPax}
                onToggleSeat={handleToggleSeat}
              />
              <AncillariesPanel
                fareBrand={selectedBrand}
                isLongHaul={routeMatch.route.isLongHaul}
                baggageGenerousRoute={routeMatch.route.baggageGenerousRoute}
                selectedBundleIds={selectedBundleIds}
                selectedAncillaryIds={selectedAncillaryIds}
                selectedMealId={selectedMealId}
                selectedSsrIds={selectedSsrIds}
                insuranceChoice={insuranceChoice}
                onToggleBundle={(id) =>
                  setSelectedBundleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                }
                onToggleAncillary={(id) =>
                  setSelectedAncillaryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                }
                onSelectMeal={setSelectedMealId}
                onToggleSsr={(id) =>
                  setSelectedSsrIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                }
                onInsuranceChoice={setInsuranceChoice}
              />
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5">
                  <ChevronLeft className="h-4 w-4" /> Back to Fares
                </Button>
                <Button size="lg" onClick={handleProceedFromAncillaries} className="gap-2 rounded-xl font-display font-bold">
                  Continue to Passengers ({formatMoney(totalOMR, currency)})
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Passengers & APIS */}
          {step === 3 && (
            <div className="space-y-6">
              <PassengerFormStep
                passengers={paxForms}
                travelDateISO={search.departDate}
                onChange={(idx, patch) =>
                  setPaxForms((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
                }
              />
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5">
                  <ChevronLeft className="h-4 w-4" /> Back to Seats & Bundles
                </Button>
                <Button size="lg" onClick={handleProceedFromPassengers} className="gap-2 rounded-xl font-display font-bold">
                  Review & Pay ({formatMoney(totalOMR, currency)})
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Review & Payment */}
          {step === 4 && selectedOutbound && (
            <div className="space-y-4">
              <PaymentCheckoutStep
                baseFareOMR={baseFareOMR}
                taxesOMR={taxesOMR}
                ancillariesOMR={ancillariesOMR}
                promoDiscountOMR={promoDiscountOMR}
                totalOMR={totalOMR}
                earnedMiles={earnedMiles}
                reviewSummary={{
                  segments: [
                    {
                      label: `${selectedOutbound.origin} → ${selectedOutbound.destination}`,
                      flightNumber: selectedOutbound.flightNumber,
                      dateISO: search.departDate,
                      times: `${selectedOutbound.departureTime} – ${selectedOutbound.arrivalTime}`,
                    },
                    ...(selectedSecondSeg
                      ? [
                          {
                            label: `${selectedSecondSeg.origin} → ${selectedSecondSeg.destination}`,
                            flightNumber: selectedSecondSeg.flightNumber,
                            dateISO: search.tripType === "roundtrip" ? search.returnDate : search.multiLeg2Date,
                            times: `${selectedSecondSeg.departureTime} – ${selectedSecondSeg.arrivalTime}`,
                          },
                        ]
                      : []),
                  ],
                  passengers: paxForms.map((p, idx) => ({
                    name: `${p.firstName} ${p.lastName}`,
                    role: p.role,
                    seat: selectedSeats[idx]?.id ?? `${15 + idx}A`,
                  })),
                  fareBrandName: FARE_BRANDS[selectedBrand].name,
                  ancillaryNames: [
                    ...selectedBundleIds.map((id) => VIRTUAL_BUNDLES.find((b) => b.id === id)?.name ?? id),
                    ...selectedAncillaryIds.map((id) => DIRECT_ANCILLARIES.find((a) => a.id === id)?.name ?? id),
                    ...(insuranceChoice === "yes" ? ["Travel Protection Insurance"] : []),
                  ],
                }}
                onConfirmPay={handleConfirmBooking}
              />
              <Button variant="outline" onClick={() => setStep(3)} className="gap-1.5">
                <ChevronLeft className="h-4 w-4" /> Back to Passengers
              </Button>
            </div>
          )}

          {/* STEP 5: Instant PNR Confirmation + Post-Booking Cross-Sell */}
          {step === 5 && confirmedRloc && (
            <div className="mx-auto max-w-2xl rounded-2xl border-2 border-success/40 bg-card p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
                <Ticket className="h-7 w-7" />
              </div>
              <h2 className="mt-4 font-display text-3xl font-extrabold">
                {confirmedMode === "hold" ? "Fare Held (Demo Booking)" : "Demo Booking Confirmed!"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your simulated Oman Air Record Locator (RLOC) is saved locally and synced to Manage My Booking & Check-in.
              </p>
              <div className="mx-auto mt-5 inline-block rounded-2xl border border-gold bg-gold/15 px-8 py-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Booking Reference</p>
                <p className="font-display text-4xl font-extrabold tracking-[0.2em] text-primary">{confirmedRloc}</p>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg" className="rounded-xl font-display font-bold">
                  <Link to="/manage">Add Extras or Manage Booking</Link>
                </Button>
                <Button asChild variant="secondary" size="lg" className="rounded-xl font-display font-bold">
                  <Link to="/checkin">Go to Online Check-in</Link>
                </Button>
                <Button variant="outline" size="lg" className="rounded-xl" onClick={() => setStep(0)}>
                  Book Another Flight
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 20-Route Fare Explorer */}
      {step === 0 && (
        <>
          <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
                  {lang === "ar" ? "استكشف 20 وجهة للطيران العماني" : "Explore All 20 Oman Air Routes"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Synthetic 30-day Economy Super Saver fares from Muscat (MCT) — click any route to launch instant booking.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["All", "Oman", "GCC & MENA", "Europe", "Asia", "Africa"].map((reg) => (
                  <button
                    key={reg}
                    type="button"
                    onClick={() => setRegionFilter(reg)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      regionFilter === reg
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {reg}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {filtered20Routes.map((route) => {
                const dest = AIRPORTS.find((a) => a.code === route.destination);
                const lowest30 = Math.min(...get30DayFareRepository(route.id).map((d) => d.pricesOMR.ECO_SAVER));
                return (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() =>
                      handleRunSearch({
                        tripType: "roundtrip",
                        origin: route.origin,
                        destination: route.destination,
                        departDate: getDateISO(2),
                        returnDate: getDateISO(8),
                        multiLeg2Origin: route.destination,
                        multiLeg2Destination: "DXB",
                        multiLeg2Date: getDateISO(6),
                        cabin: "economy",
                        passengers: { adults: 1, children: 0, infants: 0, students: 0, seniors: 0, labor: 0 },
                        promoCode: "",
                      })
                    }
                    className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 text-start transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
                          {route.highlightTag}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">{route.flightNumber}</span>
                      </div>
                      <h3 className="mt-3 font-display text-lg font-bold group-hover:text-primary">
                        {lang === "ar" ? dest?.cityAr : dest?.city}{" "}
                        <span className="text-xs font-semibold text-muted-foreground">({route.destination})</span>
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">{route.highlightNote}</p>
                    </div>
                    <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">30-Day Low</p>
                        <p className="font-display text-base font-extrabold text-primary">
                          {formatMoney(lowest30, currency)}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                        Book <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="border-t border-border bg-teal-deep text-teal-deep-foreground">
            <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Oman Air Business Studio</p>
                <h2 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">
                  Your Private Suite Above the Arabian Sea
                </h2>
                <p className="mt-3 text-sm opacity-85">
                  Available on Boeing 787-9 Dreamliner flagship routes to London, Paris, Frankfurt, Amsterdam, Bangkok, and Kuala Lumpur. Enjoy 60 kg baggage, enclosed privacy walls, Majan Lounge access, and Omani hospitality.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="rounded-xl font-display font-bold"
                    onClick={() =>
                      handleRunSearch({
                        tripType: "roundtrip",
                        origin: "MCT",
                        destination: "LHR",
                        departDate: getDateISO(3),
                        returnDate: getDateISO(10),
                        multiLeg2Origin: "LHR",
                        multiLeg2Destination: "MCT",
                        multiLeg2Date: getDateISO(8),
                        cabin: "studio",
                        passengers: { adults: 1, children: 0, infants: 0, students: 0, seniors: 0, labor: 0 },
                        promoCode: "",
                      })
                    }
                  >
                    Search Business Studio to London
                  </Button>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-gold/30">
                <img
                  src={studioImg}
                  alt="Oman Air Business Studio private suite interior"
                  loading="lazy"
                  width={1280}
                  height={768}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
