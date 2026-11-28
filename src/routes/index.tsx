import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import heroImg from "../assets/oman-air-hero.jpg";
import { useIBE } from "../context/IBEContext";
import {
  AIRPORTS,
  FARE_BRANDS,
  findRouteForPair,
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
import { bffClient, getStoredCartId, setStoredCartId } from "../lib/bff-client";
import { trackIbeEvent } from "../lib/analytics";
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
import type { BffCartPricing, BffSearchResponse } from "../../bff/types";
import { FlightSearchWidget, type SearchCriteria } from "../components/ibe/FlightSearchWidget";
import { BookingStepper } from "../components/ibe/BookingStepper";
import { FlightResultsStep } from "../components/ibe/FlightResultsStep";
import { SeatMapSelector } from "../components/ibe/SeatMapSelector";
import { AncillariesPanel } from "../components/ibe/AncillariesPanel";
import { PassengerFormStep, type PassengerFormData } from "../components/ibe/PassengerFormStep";
import { PaymentCheckoutStep, type PaymentMethodId } from "../components/ibe/PaymentCheckoutStep";
import { BookingConfirmationStep } from "../components/ibe/BookingConfirmationStep";
import { ExploreRoutesSection } from "../components/ibe/ExploreRoutesSection";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oman Air | Book Flights Across 20 Global Routes" },
      {
        name: "description",
        content:
          "Search 30-day low fares across 20 Oman Air routes, compare branded fares, choose seats and virtual bundles, and check in seamlessly.",
      },
      { property: "og:title", content: "Oman Air | Book Flights" },
      {
        property: "og:description",
        content:
          "Oman Air Internet Booking Engine with 30-day fare calendar, Business Studio, and Sindbad rewards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type FunnelStep = 0 | 1 | 2 | 3 | 4 | 5;
const CART_DRAFT_KEY = "oman_air_ibe_cart_draft_v1";

function Index() {
  const {
    lang,
    currency,
    bffConnected,
    cmsState,
    sindbadSignedIn,
    sindbadTier,
    addBooking,
    syncFromBffUser,
    spendMiles,
    spendTravelBank,
    addMiles,
  } = useIBE();
  const copy = t(lang);

  const [step, setStep] = useState<FunnelStep>(0);
  const [search, setSearch] = useState<SearchCriteria | null>(null);
  const [cartId, setCartId] = useState<string | null>(null);
  const [bffSearchData, setBffSearchData] = useState<BffSearchResponse | null>(null);
  const [bffPricing, setBffPricing] = useState<BffCartPricing | null>(null);
  const [selectedOutboundId, setSelectedOutboundId] = useState<string>("");
  const [selectedReturnId, setSelectedReturnId] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<FareBrandId>("ECO_COMFORT");
  const [sortBy, setSortBy] = useState<"price" | "duration">("price");
  const [nonStopOnly, setNonStopOnly] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string>("All");

  // Step 2: Multi-segment Seats & Ancillaries
  const [selectedSeats, setSelectedSeats] = useState<SeatCell[]>([]);
  const [selectedReturnSeats, setSelectedReturnSeats] = useState<SeatCell[]>([]);
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

  // Restore active cart from BFF (when connected) or local sessionStorage
  useEffect(() => {
    const storedCartId = getStoredCartId();
    if (bffConnected && storedCartId) {
      bffClient
        .getCart(storedCartId, lang)
        .then(({ cart }) => {
          setCartId(cart.cartId);
          setSearch(cart.search as SearchCriteria);
          setStep(cart.step);
          setSelectedOutboundId(cart.selectedOutboundId);
          if (cart.selectedSecondSegId) setSelectedReturnId(cart.selectedSecondSegId);
          setSelectedBrand(cart.selectedBrand);
          setSelectedBundleIds(cart.selectedBundleIds);
          setSelectedAncillaryIds(cart.selectedAncillaryIds);
          setSelectedMealId(cart.selectedMealId);
          setSelectedSsrIds(cart.selectedSsrIds);
          setInsuranceChoice(cart.insuranceChoice);
          setBffPricing(cart.pricing);
          if (cart.passengers.length > 0) {
            setPaxForms(
              cart.passengers.map((p) => ({
                role: p.role,
                firstName: p.firstName,
                lastName: p.lastName,
                dob: p.dob,
                gender: p.gender,
                passport: p.passport,
                passportExpiry: p.passportExpiry ?? "2030-05-14",
                nationality: p.nationality,
                email: p.email ?? "",
                phone: p.phone ?? "",
                emergencyName: p.emergencyName ?? "",
                emergencyPhone: p.emergencyPhone ?? "",
                sindbadNo: p.sindbadNo ?? "",
              })),
            );
          }
        })
        .catch(() => {
          setStoredCartId(null);
        });
      return;
    }

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
        selectedReturnSeats?: SeatCell[];
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
        if (draft.selectedReturnSeats) setSelectedReturnSeats(draft.selectedReturnSeats);
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
  }, [bffConnected, lang]);

  // Sync cart state with BFF when connected, or sessionStorage offline
  useEffect(() => {
    if (step === 0 || step === 5 || !search) {
      if (step === 0 || step === 5) {
        setStoredCartId(null);
        try {
          window.sessionStorage.removeItem(CART_DRAFT_KEY);
        } catch {
          // ignore
        }
      }
      return;
    }

    if (bffConnected && selectedOutboundId) {
      const timer = window.setTimeout(() => {
        bffClient
          .syncCart(
            {
              cartId: cartId ?? undefined,
              step: step as 1 | 2 | 3 | 4,
              search,
              selectedOutboundId,
              selectedSecondSegId: selectedReturnId || undefined,
              selectedBrand,
              selectedSeatIds: selectedSeats.map((s) => s.id),
              selectedReturnSeatIds: selectedReturnSeats.map((s) => s.id),
              selectedBundleIds,
              selectedAncillaryIds,
              selectedMealId,
              selectedSsrIds,
              insuranceChoice,
              passengers: paxForms,
            },
            lang,
          )
          .then(({ cart }) => {
            setCartId(cart.cartId);
            setStoredCartId(cart.cartId);
            setBffPricing(cart.pricing);
          })
          .catch(() => {
            // Keep local optimistic state if transient error
          });
      }, 150);
      return () => window.clearTimeout(timer);
    }

    try {
      window.sessionStorage.setItem(
        CART_DRAFT_KEY,
        JSON.stringify({
          step,
          search,
          selectedOutboundId,
          selectedReturnId,
          selectedBrand,
          selectedSeats,
          selectedReturnSeats,
          selectedBundleIds,
          selectedAncillaryIds,
          selectedMealId,
          selectedSsrIds,
          insuranceChoice,
          paxForms,
        }),
      );
    } catch {
      // ignore storage errors
    }
    return undefined;
  }, [
    bffConnected,
    cartId,
    lang,
    step,
    search,
    selectedOutboundId,
    selectedReturnId,
    selectedBrand,
    selectedSeats,
    selectedReturnSeats,
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
    if (bffSearchData?.calendar) return bffSearchData.calendar;
    if (!routeMatch) return [];
    return get30DayFareRepository(routeMatch.route.id);
  }, [bffSearchData, routeMatch]);

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
    const source =
      bffSearchData?.outboundOptions ??
      (search ? generateFlightOptions(search.origin, search.destination, search.departDate) : []);
    const list = source.filter((f) => (!nonStopOnly ? true : f.stops === 0));
    return [...list].sort((a, b) =>
      sortBy === "duration"
        ? a.durationMinutes - b.durationMinutes
        : a.priceMultiplier - b.priceMultiplier,
    );
  }, [bffSearchData, search, nonStopOnly, sortBy]);

  const secondSegmentOptions = useMemo<FlightOption[]>(() => {
    if (!search || search.tripType === "oneway") return [];
    const source =
      bffSearchData?.secondSegmentOptions ??
      (search.tripType === "roundtrip"
        ? generateFlightOptions(search.destination, search.origin, search.returnDate)
        : generateFlightOptions(
            search.multiLeg2Origin,
            search.multiLeg2Destination,
            search.multiLeg2Date,
          ));
    const filtered = source.filter((f) => (!nonStopOnly ? true : f.stops === 0));
    return [...filtered].sort((a, b) =>
      sortBy === "duration"
        ? a.durationMinutes - b.durationMinutes
        : a.priceMultiplier - b.priceMultiplier,
    );
  }, [bffSearchData, search, nonStopOnly, sortBy]);

  const selectedOutbound =
    outboundOptions.find((o) => o.id === selectedOutboundId) ?? outboundOptions[0] ?? null;
  const selectedSecondSeg =
    secondSegmentOptions.find((o) => o.id === selectedReturnId) ?? secondSegmentOptions[0] ?? null;
  const totalPax = search ? getTotalPassengers(search.passengers) : 1;

  const handleRunSearch = async (criteria: SearchCriteria) => {
    setSearch(criteria);
    setBffPricing(null);
    setCartId(null);
    setStoredCartId(null);
    trackIbeEvent("view_item_list", {
      origin: criteria.origin,
      destination: criteria.destination,
      tripType: criteria.tripType,
      awardMode: Boolean(criteria.awardMode),
    });

    let outOpts = generateFlightOptions(criteria.origin, criteria.destination, criteria.departDate);
    let secOpts =
      criteria.tripType === "roundtrip"
        ? generateFlightOptions(criteria.destination, criteria.origin, criteria.returnDate)
        : criteria.tripType === "multicity"
          ? generateFlightOptions(
              criteria.multiLeg2Origin,
              criteria.multiLeg2Destination,
              criteria.multiLeg2Date,
            )
          : [];

    if (bffConnected) {
      try {
        const res = await bffClient.searchFlights(
          { ...criteria, currency, nonStopOnly, sortBy },
          lang,
        );
        setBffSearchData(res);
        outOpts = res.outboundOptions;
        secOpts = res.secondSegmentOptions;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "BFF search failed; using fallback.");
      }
    } else {
      setBffSearchData(null);
    }

    setSelectedOutboundId(outOpts[0]?.id ?? "");
    setSelectedReturnId(secOpts[0]?.id ?? "");
    setSelectedBrand(
      criteria.cabin === "studio"
        ? "BIZ_STUDIO"
        : criteria.cabin === "business"
          ? "BIZ_COMFORT"
          : "ECO_COMFORT",
    );
    setSelectedSeats([]);
    setSelectedReturnSeats([]);
    setSelectedBundleIds([]);
    setSelectedAncillaryIds([]);
    setInsuranceChoice("unset");

    const roles = expandPassengerTypes(criteria.passengers);
    setPaxForms(
      roles.map((role, i) => {
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
          dob:
            saved && role !== "Infant" && role !== "Child" && role !== "Senior"
              ? saved.dob
              : defaultDob,
          gender: saved?.gender ?? "M",
          passport: saved?.passport ?? "",
          passportExpiry: "2030-05-14",
          nationality: saved?.nationality ?? "Oman",
          email: sindbadSignedIn && i === 0 ? "tariq.albalushi@oman.om" : "",
          phone: sindbadSignedIn && i === 0 ? "+968 9123 4567" : "",
          emergencyName: sindbadSignedIn && i === 0 ? "Salim Al-Balushi" : "",
          emergencyPhone: sindbadSignedIn && i === 0 ? "+968 9988 1122" : "",
          sindbadNo: saved?.sindbadNo ?? "",
        };
      }),
    );
    setStep(1);
  };

  const visibleBrands: FareBrandId[] = useMemo(() => {
    if (!routeMatch) return ["ECO_SAVER", "ECO_COMFORT", "ECO_FLEX"];
    if (search?.cabin === "studio" && routeMatch.route.hasStudio)
      return ["BIZ_COMFORT", "BIZ_FLEX", "BIZ_STUDIO"];
    if (search?.cabin === "business") {
      return routeMatch.route.hasStudio
        ? ["BIZ_COMFORT", "BIZ_FLEX", "BIZ_STUDIO"]
        : ["BIZ_COMFORT", "BIZ_FLEX"];
    }
    return ["ECO_SAVER", "ECO_COMFORT", "ECO_FLEX"];
  }, [routeMatch, search?.cabin]);

  const computeBrandPricePerPaxOMR = (brandId: FareBrandId): number => {
    const outPrice = Math.round(
      (activeDayFare?.pricesOMR[brandId] ?? 0) * (selectedOutbound?.priceMultiplier ?? 1),
    );
    if (!search || search.tripType === "oneway") return outPrice;
    if (search.tripType === "roundtrip") {
      const retBase = returnDayFare?.pricesOMR[brandId] ?? activeDayFare?.pricesOMR[brandId] ?? 0;
      return outPrice + Math.round(retBase * (selectedSecondSeg?.priceMultiplier ?? 1));
    }
    const leg2Base = leg2DayFare?.pricesOMR[brandId] ?? activeDayFare?.pricesOMR[brandId] ?? 0;
    return outPrice + Math.round(leg2Base * (selectedSecondSeg?.priceMultiplier ?? 1));
  };

  const promoEntry = search?.promoCode ? PROMO_CODES[search.promoCode] : undefined;
  const fallbackRawFareOMR = computeBrandPricePerPaxOMR(selectedBrand) * totalPax;
  const fallbackBaseFareOMR = search?.awardMode ? 0 : fallbackRawFareOMR;
  const fallbackAwardMilesRequired = search?.awardMode
    ? Math.max(4500, Math.round(computeBrandPricePerPaxOMR(selectedBrand) * 120)) * totalPax
    : 0;
  const leg2TaxOMR =
    search?.tripType === "roundtrip"
      ? (routeMatch?.route.taxesOMR ?? 0)
      : search?.tripType === "multicity"
        ? (leg2RouteMatch?.route.taxesOMR ?? 0)
        : 0;
  const fallbackTaxesOMR = ((routeMatch?.route.taxesOMR ?? 0) + leg2TaxOMR) * totalPax;

  const seatFeeCalc = (seatsList: SeatCell[]) =>
    seatsList.reduce(
      (sum, s) =>
        sum +
        computeSeatFeeOMR({
          baseSeatPriceOMR: s.priceOMR,
          fareBrand: selectedBrand,
          tier: sindbadTier,
          selectedBundleIds,
        }).priceOMR,
      0,
    );

  const fallbackAncillariesOMR =
    seatFeeCalc(selectedSeats) +
    seatFeeCalc(selectedReturnSeats) +
    selectedBundleIds.reduce(
      (sum, id) => sum + (VIRTUAL_BUNDLES.find((b) => b.id === id)?.priceOMR ?? 0) * totalPax,
      0,
    ) +
    selectedAncillaryIds.reduce(
      (sum, id) =>
        sum +
        computeAncillaryPriceOMR({ ancillaryId: id, tier: sindbadTier, selectedBundleIds })
          .priceOMR *
          totalPax,
      0,
    ) +
    (MEAL_OPTIONS.find((m) => m.id === selectedMealId)?.priceOMR ?? 0) * totalPax +
    (insuranceChoice === "yes" ? 12 * totalPax : 0);

  const fallbackPromoDiscountOMR =
    promoEntry && !search?.awardMode
      ? Math.round(fallbackBaseFareOMR * (promoEntry.discountPct / 100))
      : 0;
  const fallbackTotalOMR = Math.max(
    0,
    fallbackBaseFareOMR + fallbackTaxesOMR + fallbackAncillariesOMR - fallbackPromoDiscountOMR,
  );
  const fallbackEarnedMiles = search?.awardMode
    ? calculateSindbadMiles(fallbackAncillariesOMR, sindbadTier)
    : calculateSindbadMiles(
        Math.max(0, fallbackBaseFareOMR - fallbackPromoDiscountOMR) + fallbackAncillariesOMR,
        sindbadTier,
      );

  const baseFareOMR = bffPricing?.baseFareOMR ?? fallbackBaseFareOMR;
  const awardMilesRequired = bffPricing?.awardMilesRequired ?? fallbackAwardMilesRequired;
  const taxesOMR = bffPricing?.taxesOMR ?? fallbackTaxesOMR;
  const taxBreakdown = bffPricing?.taxBreakdown;
  const ancillariesOMR = bffPricing?.ancillariesOMR ?? fallbackAncillariesOMR;
  const promoDiscountOMR = bffPricing?.promoDiscountOMR ?? fallbackPromoDiscountOMR;
  const totalOMR = bffPricing?.totalOMR ?? fallbackTotalOMR;
  const earnedMiles = bffPricing?.earnedMiles ?? fallbackEarnedMiles;

  const toggleSeatIn = (
    setter: React.Dispatch<React.SetStateAction<SeatCell[]>>,
    seat: SeatCell,
  ) => {
    setter((prev) => {
      if (prev.some((s) => s.id === seat.id)) return prev.filter((s) => s.id !== seat.id);
      if (prev.length >= totalPax) return [...prev.slice(1), seat];
      return [...prev, seat];
    });
  };

  const handleProceedFromAncillaries = () => {
    if (insuranceChoice === "unset") {
      toast.error("Please select Yes or No for Oman Air Travel Protection before continuing.");
      return;
    }
    trackIbeEvent("add_to_cart", {
      route: routeMatch?.route.id,
      fareBrand: selectedBrand,
      totalOMR,
    });
    setStep(3);
  };

  const handleProceedFromPassengers = () => {
    if (!search) return;
    for (let i = 0; i < paxForms.length; i++) {
      const p = paxForms[i]!;
      const check = validateIcaoPassenger({
        firstName: p.firstName,
        lastName: p.lastName,
        passport: p.passport,
      });
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
    trackIbeEvent("begin_checkout", {
      route: routeMatch?.route.id,
      totalOMR,
      awardMode: Boolean(search.awardMode),
    });
    setStep(4);
  };

  const handleConfirmBooking = async (details: {
    mode: "pay" | "hold";
    holdHours?: 24 | 48;
    paymentMethod: PaymentMethodId;
    paymentLabel: string;
    paymentToken?: string;
    milesUsed: number;
    travelBankUsedOMR: number;
    finalCashOMR: number;
  }) => {
    if (!search || !routeMatch || !selectedOutbound) return;

    if (bffConnected && cartId) {
      try {
        const synced = await bffClient.syncCart(
          {
            cartId,
            step: 4,
            search,
            selectedOutboundId: selectedOutbound.id,
            selectedSecondSegId: selectedSecondSeg?.id,
            selectedBrand,
            selectedSeatIds: selectedSeats.map((s) => s.id),
            selectedReturnSeatIds: selectedReturnSeats.map((s) => s.id),
            selectedBundleIds,
            selectedAncillaryIds,
            selectedMealId,
            selectedSsrIds,
            insuranceChoice,
            passengers: paxForms,
          },
          lang,
        );
        const res = await bffClient.checkoutCart(
          synced.cart.cartId,
          {
            cartId: synced.cart.cartId,
            mode: details.mode,
            holdHours: details.holdHours,
            paymentMethod: details.paymentMethod,
            paymentDetailLabel: details.paymentLabel,
            ...(details.paymentToken ? { paymentToken: details.paymentToken } : {}),
            useMilesSplit: details.milesUsed > 0,
            useTravelBank: details.travelBankUsedOMR > 0,
          },
          lang,
        );
        addBooking(res.booking);
        syncFromBffUser(res.session);
        setStoredCartId(null);
        setCartId(null);
        setConfirmedRloc(res.booking.rloc);
        setConfirmedMode(details.mode);
        setStep(5);
        trackIbeEvent("purchase", {
          transaction_id: res.booking.rloc,
          value: res.finalCashOMR,
          currency: "OMR",
          milesUsed: res.milesUsed,
        });
        toast.success(`PNR ${res.booking.rloc} committed via BFF!`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "BFF checkout failed.");
      }
      return;
    }

    if (details.milesUsed > 0) spendMiles(details.milesUsed);
    if (details.travelBankUsedOMR > 0) spendTravelBank(details.travelBankUsedOMR);
    if (details.mode === "pay" && sindbadSignedIn) addMiles(earnedMiles);

    const rloc = generateRLOC();
    addBooking({
      rloc,
      status: details.mode === "hold" ? "HELD" : "CONFIRMED",
      ...(details.mode === "hold" ? { heldBalanceDueOMR: totalOMR } : {}),
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
        ...(selectedReturnSeats[idx]?.id ? { returnSeat: selectedReturnSeats[idx]!.id } : {}),
        checkedIn: false,
      })),
      ancillaries: [
        ...selectedBundleIds.map((id) => VIRTUAL_BUNDLES.find((b) => b.id === id)?.name ?? id),
        ...selectedAncillaryIds.map(
          (id) => DIRECT_ANCILLARIES.find((a) => a.id === id)?.name ?? id,
        ),
        ...(insuranceChoice === "yes" ? ["Travel Protection Insurance"] : []),
      ],
      ssrs: selectedSsrIds.map((id) => {
        const s = SSR_OPTIONS.find((x) => x.id === id)!;
        return { code: s.code, name: s.name, status: s.status };
      }),
      totalPaidOMR: details.finalCashOMR,
      paymentMethod: details.paymentLabel,
      gate: "A09",
      terminal: "T1",
      ...(details.mode === "hold"
        ? { holdExpiresAt: computeHoldExpiryISO(details.holdHours ?? 24) }
        : {}),
    });

    setConfirmedRloc(rloc);
    setConfirmedMode(details.mode);
    setStep(5);
    toast.success(`Demo PNR ${rloc} saved to Manage My Booking & Check-in!`);
  };

  const nearbyAltCodes =
    bffSearchData?.nearbyAlternatives ??
    (search ? (AIRPORTS.find((a) => a.code === search.destination)?.nearbyCodes ?? []) : []);

  const heroTitle =
    lang === "ar"
      ? (cmsState?.heroTitleAr ?? copy.hero.title)
      : (cmsState?.heroTitleEn ?? copy.hero.title);
  const heroSubtitle =
    lang === "ar"
      ? (cmsState?.heroSubtitleAr ?? copy.hero.subtitle)
      : (cmsState?.heroSubtitleEn ?? copy.hero.subtitle);

  return (
    <div>
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
            {bffConnected && " · BFF Active"}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold tracking-tight text-primary-foreground sm:text-6xl">
            {heroTitle}
          </h1>
          <p className="mt-3 max-w-xl text-sm text-primary-foreground/85 sm:text-base">
            {heroSubtitle}
          </p>

          <div className="mt-8">
            <FlightSearchWidget initial={search ?? undefined} onSearch={handleRunSearch} />
          </div>
        </div>
      </section>

      {step > 0 && search && routeMatch && (
        <section id="booking-workspace" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <BookingStepper
            step={step as 1 | 2 | 3 | 4 | 5}
            origin={search.origin}
            destination={search.destination}
            departDate={search.departDate}
            totalPax={totalPax}
            bffConnected={bffConnected}
            cartId={cartId}
            onSelectStep={setStep}
          />

          {step === 1 && (
            <FlightResultsStep
              search={search}
              routeId={routeMatch.route.id}
              currency={currency}
              lang={lang}
              thirtyDayFares={thirtyDayFares}
              activeDayFare={activeDayFare}
              bffSearchData={bffSearchData}
              outboundOptions={outboundOptions}
              secondSegmentOptions={secondSegmentOptions}
              selectedOutbound={selectedOutbound}
              selectedSecondSeg={selectedSecondSeg}
              selectedBrand={selectedBrand}
              visibleBrands={visibleBrands}
              nonStopOnly={nonStopOnly}
              sortBy={sortBy}
              nearbyAltCodes={nearbyAltCodes}
              computeBrandPricePerPaxOMR={computeBrandPricePerPaxOMR}
              onUpdateSearch={(patch) => setSearch({ ...search, ...patch })}
              onSelectOutbound={setSelectedOutboundId}
              onSelectSecondSeg={setSelectedReturnId}
              onSelectBrand={setSelectedBrand}
              onToggleNonStopOnly={setNonStopOnly}
              onChangeSortBy={setSortBy}
              onContinue={() => setStep(2)}
            />
          )}

          {step === 2 && selectedOutbound && (
            <div className="space-y-6">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Segment 1 Seat Map ({selectedOutbound.origin} → {selectedOutbound.destination})
                </p>
                <SeatMapSelector
                  aircraft={selectedOutbound.aircraft}
                  fareBrand={selectedBrand}
                  selectedBundleIds={selectedBundleIds}
                  selectedSeats={selectedSeats.map((s) => s.id)}
                  maxSeats={totalPax}
                  onToggleSeat={(seat) => toggleSeatIn(setSelectedSeats, seat)}
                />
              </div>

              {selectedSecondSeg && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Segment 2 Seat Map ({selectedSecondSeg.origin} → {selectedSecondSeg.destination}
                    )
                  </p>
                  <SeatMapSelector
                    aircraft={selectedSecondSeg.aircraft}
                    fareBrand={selectedBrand}
                    selectedBundleIds={selectedBundleIds}
                    selectedSeats={selectedReturnSeats.map((s) => s.id)}
                    maxSeats={totalPax}
                    onToggleSeat={(seat) => toggleSeatIn(setSelectedReturnSeats, seat)}
                  />
                </div>
              )}

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
                  setSelectedBundleIds((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                  )
                }
                onToggleAncillary={(id) =>
                  setSelectedAncillaryIds((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                  )
                }
                onSelectMeal={setSelectedMealId}
                onToggleSsr={(id) =>
                  setSelectedSsrIds((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                  )
                }
                onInsuranceChoice={setInsuranceChoice}
              />
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5">
                  <ChevronLeft className="h-4 w-4" /> Back to Fares
                </Button>
                <Button
                  size="lg"
                  onClick={handleProceedFromAncillaries}
                  className="gap-2 rounded-xl font-display font-bold"
                >
                  Continue to Passengers ({formatMoney(totalOMR, currency)})
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

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
                <Button
                  size="lg"
                  onClick={handleProceedFromPassengers}
                  className="gap-2 rounded-xl font-display font-bold"
                >
                  Review & Pay ({formatMoney(totalOMR, currency)})
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 4 && selectedOutbound && (
            <div className="space-y-4">
              <PaymentCheckoutStep
                baseFareOMR={baseFareOMR}
                awardMilesRequired={awardMilesRequired}
                taxesOMR={taxesOMR}
                taxBreakdown={taxBreakdown}
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
                            dateISO:
                              search.tripType === "roundtrip"
                                ? search.returnDate
                                : search.multiLeg2Date,
                            times: `${selectedSecondSeg.departureTime} – ${selectedSecondSeg.arrivalTime}`,
                          },
                        ]
                      : []),
                  ],
                  passengers: paxForms.map((p, idx) => ({
                    name: `${p.firstName} ${p.lastName}`,
                    role: p.role,
                    seat: `${selectedSeats[idx]?.id ?? `${15 + idx}A`}${
                      selectedReturnSeats[idx]?.id ? ` / ${selectedReturnSeats[idx]!.id}` : ""
                    }`,
                  })),
                  fareBrandName: FARE_BRANDS[selectedBrand].name,
                  ancillaryNames: [
                    ...selectedBundleIds.map(
                      (id) => VIRTUAL_BUNDLES.find((b) => b.id === id)?.name ?? id,
                    ),
                    ...selectedAncillaryIds.map(
                      (id) => DIRECT_ANCILLARIES.find((a) => a.id === id)?.name ?? id,
                    ),
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

          {step === 5 && confirmedRloc && (
            <BookingConfirmationStep
              confirmedRloc={confirmedRloc}
              confirmedMode={confirmedMode}
              onBookAnother={() => setStep(0)}
            />
          )}
        </section>
      )}

      {step === 0 && (
        <ExploreRoutesSection
          lang={lang}
          currency={currency}
          regionFilter={regionFilter}
          onChangeRegion={setRegionFilter}
          onLaunchSearch={handleRunSearch}
        />
      )}
    </div>
  );
}
