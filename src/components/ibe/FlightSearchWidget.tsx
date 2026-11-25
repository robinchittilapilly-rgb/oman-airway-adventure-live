import { useState } from "react";
import { ArrowLeftRight, Calendar, History, Search, Tag, Users } from "lucide-react";
import {
  AIRPORTS,
  getDateISO,
  resolveCityOrAirport,
  type CabinClass,
} from "../../data/omanAirRoutes";
import {
  MAX_TOTAL_PASSENGERS,
  PROMO_CODES,
  getTotalPassengers,
  validatePassengerMix,
  type PassengerCounts,
} from "../../lib/ibe-rules";
import { useIBE } from "../../context/IBEContext";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export interface SearchCriteria {
  tripType: "roundtrip" | "oneway" | "multicity";
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  multiLeg2Origin: string;
  multiLeg2Destination: string;
  multiLeg2Date: string;
  cabin: CabinClass;
  passengers: PassengerCounts;
  promoCode: string;
}

interface FlightSearchWidgetProps {
  initial?: Partial<SearchCriteria> | undefined;
  onSearch: (criteria: SearchCriteria) => void;
}

const PAX_TYPES: { key: keyof PassengerCounts; label: string; labelAr: string; sub: string }[] = [
  { key: "adults", label: "Adults", labelAr: "بالغون", sub: "12+ yrs" },
  { key: "children", label: "Children", labelAr: "أطفال", sub: "2–11 yrs" },
  { key: "infants", label: "Infants", labelAr: "رضّع", sub: "Under 2" },
  { key: "students", label: "Students", labelAr: "طلاب", sub: "Valid ID" },
  { key: "seniors", label: "Seniors", labelAr: "كبار السن", sub: "60+ yrs" },
  { key: "labor", label: "Labor Fare", labelAr: "عمالة", sub: "Special visa" },
];

export function FlightSearchWidget({ initial, onSearch }: FlightSearchWidgetProps) {
  const { lang, recentSearches, addRecentSearch } = useIBE();
  const [tripType, setTripType] = useState<"roundtrip" | "oneway" | "multicity">(initial?.tripType ?? "roundtrip");
  const [origin, setOrigin] = useState(initial?.origin ?? "MCT");
  const [destination, setDestination] = useState(initial?.destination ?? "LHR");
  const [destQuery, setDestQuery] = useState("");
  const [departDate, setDepartDate] = useState(initial?.departDate ?? getDateISO(2));
  const [returnDate, setReturnDate] = useState(initial?.returnDate ?? getDateISO(9));
  const [multiLeg2Origin, setMultiLeg2Origin] = useState(initial?.multiLeg2Origin ?? "LHR");
  const [multiLeg2Destination, setMultiLeg2Destination] = useState(initial?.multiLeg2Destination ?? "DXB");
  const [multiLeg2Date, setMultiLeg2Date] = useState(initial?.multiLeg2Date ?? getDateISO(7));
  const [cabin, setCabin] = useState<CabinClass>(initial?.cabin ?? "economy");
  const [promoCode, setPromoCode] = useState(initial?.promoCode ?? "");
  const [passengers, setPassengers] = useState<PassengerCounts>(
    initial?.passengers ?? { adults: 1, children: 0, infants: 0, students: 0, seniors: 0, labor: 0 }
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const paxValidation = validatePassengerMix(passengers);
  const totalPax = getTotalPassengers(passengers);
  const minDate = getDateISO(0);
  const maxDate = getDateISO(29);

  const adjustPax = (key: keyof PassengerCounts, delta: number) => {
    setPassengers((prev) => {
      const nextVal = Math.max(0, prev[key] + delta);
      const next = { ...prev, [key]: nextVal };
      if (getTotalPassengers(next) > MAX_TOTAL_PASSENGERS) return prev;
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (origin === destination) {
      setErrorMsg("Origin and destination cannot be the same airport.");
      return;
    }
    if (!paxValidation.valid) {
      setErrorMsg(paxValidation.error ?? "Invalid passenger selection.");
      return;
    }
    if (tripType === "roundtrip" && returnDate < departDate) {
      setErrorMsg("Return date must be on or after departure date.");
      return;
    }
    if (tripType === "multicity" && multiLeg2Origin === multiLeg2Destination) {
      setErrorMsg("Leg 2 origin and destination cannot be the same airport.");
      return;
    }
    setErrorMsg(null);
    const cleanPromo = promoCode.trim().toUpperCase();
    addRecentSearch({ origin, destination, departDate, returnDate, tripType, passengers: totalPax });
    onSearch({
      tripType,
      origin,
      destination,
      departDate,
      returnDate,
      multiLeg2Origin,
      multiLeg2Destination,
      multiLeg2Date,
      cabin,
      passengers,
      promoCode: cleanPromo,
    });
  };

  const destMatches = resolveCityOrAirport(destQuery);
  const promoValid = promoCode.trim().toUpperCase() in PROMO_CODES;

  return (
    <form
      onSubmit={handleSubmit}
      className="oman-card-elevated rounded-2xl border border-border/90 bg-card p-5 sm:p-6 text-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-muted p-1" role="group" aria-label="Trip type">
          {(
            [
              { id: "roundtrip", en: "Round-Trip", ar: "ذهاب وعودة" },
              { id: "oneway", en: "One-Way", ar: "ذهاب فقط" },
              { id: "multicity", en: "Multi-City", ar: "وجهات متعددة" },
            ] as const
          ).map((tItem) => (
            <button
              key={tItem.id}
              type="button"
              onClick={() => setTripType(tItem.id)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                tripType === tItem.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang === "ar" ? tItem.ar : tItem.en}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            id="search-cabin"
            aria-label="Cabin class"
            value={cabin}
            onChange={(e) => setCabin(e.target.value as CabinClass)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold"
          >
            <option value="economy">{lang === "ar" ? "الدرجة السياحية" : "Economy Class"}</option>
            <option value="business">{lang === "ar" ? "درجة رجال الأعمال" : "Business Class"}</option>
            <option value="studio">{lang === "ar" ? "أستوديو الأعمال (جناح خاص)" : "Business Studio (Private Suite)"}</option>
          </select>

          <div className="relative flex items-center">
            <Tag className="pointer-events-none absolute start-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              id="search-promo"
              aria-label="Promo code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Promo (e.g. OMAN2026)"
              className="h-9 w-40 rounded-lg border border-border bg-background pe-2.5 ps-8 text-xs font-medium uppercase placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {promoValid && (
              <span className="ms-1.5 rounded bg-success/15 px-1.5 py-0.5 text-xs font-bold text-success">
                Applied
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <label htmlFor="search-origin" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {lang === "ar" ? "من" : "From (City / Code)"}
          </label>
          <select
            id="search-origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {AIRPORTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} — {lang === "ar" ? a.cityAr : a.city} ({a.country})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end justify-center lg:col-span-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              setOrigin(destination);
              setDestination(origin);
            }}
            className="h-12 w-12 rounded-xl"
            aria-label="Swap origin and destination"
          >
            <ArrowLeftRight className="h-4 w-4 text-primary" />
          </Button>
        </div>

        <div className="lg:col-span-3">
          <label htmlFor="search-dest" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {lang === "ar" ? "إلى (أدخل LON أو رمز المدينة)" : "To (Supports LON, PAR, Nearby)"}
          </label>
          <div className="flex gap-1.5">
            <input
              id="search-dest-filter"
              value={destQuery}
              onChange={(e) => {
                setDestQuery(e.target.value);
                const m = resolveCityOrAirport(e.target.value);
                if (m.length > 0 && !m.some((ap) => ap.code === destination)) {
                  setDestination(m[0]!.code);
                }
              }}
              placeholder="LON..."
              aria-label="Filter destination by city code"
              className="h-12 w-16 shrink-0 rounded-xl border border-input bg-muted/40 px-2 text-center text-xs font-bold uppercase focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              id="search-dest"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {(destMatches.length > 0 ? destMatches : AIRPORTS).map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} — {lang === "ar" ? a.cityAr : a.city}
                </option>
              ))}
            </select>
          </div>
          {destQuery.trim() && destMatches.length > 1 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Matches: {destMatches.map((m) => m.code).join(", ")}
            </p>
          )}
        </div>

        <div className={tripType === "roundtrip" ? "lg:col-span-2" : "lg:col-span-3"}>
          <label htmlFor="search-depart" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {lang === "ar" ? "تاريخ المغادرة" : "Depart"}
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <input
              id="search-depart"
              type="date"
              value={departDate}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDepartDate(e.target.value)}
              className="h-12 w-full rounded-xl border border-input bg-background pe-2 ps-9 text-sm font-medium"
            />
          </div>
        </div>

        {tripType === "roundtrip" && (
          <div className="lg:col-span-2">
            <label htmlFor="search-return" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {lang === "ar" ? "تاريخ العودة" : "Return"}
            </label>
            <input
              id="search-return"
              type="date"
              value={returnDate}
              min={departDate}
              max={maxDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium"
            />
          </div>
        )}

        <div className={tripType === "roundtrip" ? "lg:col-span-1" : "lg:col-span-2"}>
          <label htmlFor="search-guests-btn" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {lang === "ar" ? "المسافرون" : "Guests"}
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                id="search-guests-btn"
                type="button"
                className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-input bg-background px-3 text-sm font-semibold hover:bg-muted/50"
              >
                <Users className="h-4 w-4 text-primary" />
                <span>{totalPax}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4" align="end">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-sm font-bold">Passengers (Max 12)</p>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                  {totalPax} / 12
                </span>
              </div>
              <div className="space-y-2.5">
                {PAX_TYPES.map((pt) => (
                  <div key={pt.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold">{lang === "ar" ? pt.labelAr : pt.label}</p>
                      <p className="text-xs text-muted-foreground">{pt.sub}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => adjustPax(pt.key, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm font-bold hover:bg-muted"
                        aria-label={`Decrease ${pt.label}`}
                      >
                        -
                      </button>
                      <span className="w-5 text-center text-xs font-bold">{passengers[pt.key]}</span>
                      <button
                        type="button"
                        onClick={() => adjustPax(pt.key, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm font-bold hover:bg-muted"
                        aria-label={`Increase ${pt.label}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {!paxValidation.valid && (
                <p className="mt-3 rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive">
                  {paxValidation.error}
                </p>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {tripType === "multicity" && (
        <div className="mt-3 grid gap-3 rounded-xl border border-dashed border-border bg-muted/35 p-3 sm:grid-cols-3">
          <div>
            <label htmlFor="leg2-origin" className="mb-1 block text-xs font-semibold text-muted-foreground">Leg 2 From</label>
            <select id="leg2-origin" value={multiLeg2Origin} onChange={(e) => setMultiLeg2Origin(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-xs font-semibold">
              {AIRPORTS.map((a) => <option key={a.code} value={a.code}>{a.code} — {lang === "ar" ? a.cityAr : a.city}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="leg2-dest" className="mb-1 block text-xs font-semibold text-muted-foreground">Leg 2 To</label>
            <select id="leg2-dest" value={multiLeg2Destination} onChange={(e) => setMultiLeg2Destination(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-xs font-semibold">
              {AIRPORTS.map((a) => <option key={a.code} value={a.code}>{a.code} — {lang === "ar" ? a.cityAr : a.city}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="leg2-date" className="mb-1 block text-xs font-semibold text-muted-foreground">Leg 2 Date</label>
            <input id="leg2-date" type="date" value={multiLeg2Date} min={departDate} max={maxDate} onChange={(e) => setMultiLeg2Date(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-2.5 text-xs font-medium" />
          </div>
        </div>
      )}

      {errorMsg && (
        <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
          {errorMsg}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {recentSearches.length > 0 && (
            <>
              <History className="h-3.5 w-3.5" />
              <span>{lang === "ar" ? "الأخيرة:" : "Recent:"}</span>
              {recentSearches.slice(0, 3).map((rs) => (
                <button
                  key={rs.id}
                  type="button"
                  onClick={() => {
                    setOrigin(rs.origin);
                    setDestination(rs.destination);
                    setDepartDate(rs.departDate);
                  }}
                  className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-semibold text-foreground hover:border-primary"
                >
                  {rs.origin} → {rs.destination}
                </button>
              ))}
            </>
          )}
        </div>

        <Button type="submit" size="lg" className="h-12 gap-2 rounded-xl px-7 font-display text-sm font-bold">
          <Search className="h-4 w-4" />
          {lang === "ar" ? "ابحث عن الرحلات" : "Search Flights"}
        </Button>
      </div>
    </form>
  );
}
