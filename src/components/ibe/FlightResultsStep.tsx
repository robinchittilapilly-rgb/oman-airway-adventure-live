import { AlertCircle, Calendar, CheckCircle2, ChevronRight, Filter, Plane } from "lucide-react";
import type { BffBrandedFareQuote, BffSearchResponse } from "../../../bff/types";
import { useIBE } from "../../context/IBEContext";
import {
  FARE_BRANDS,
  formatDuration,
  formatMoney,
  type CurrencyCode,
  type FareBrandId,
  type FlightOption,
} from "../../data/omanAirRoutes";
import { PROMO_CODES, calculateSindbadMiles } from "../../lib/ibe-rules";
import { Button } from "../ui/button";
import type { SearchCriteria } from "./FlightSearchWidget";

interface DayFareRow {
  dateISO: string;
  pricesOMR: Record<FareBrandId, number>;
  seatsRemaining: number;
  soldOut: boolean;
}

interface FlightResultsStepProps {
  search: SearchCriteria;
  routeId: string;
  currency: CurrencyCode;
  lang: "en" | "ar";
  thirtyDayFares: DayFareRow[];
  activeDayFare: DayFareRow | null;
  bffSearchData: BffSearchResponse | null;
  outboundOptions: FlightOption[];
  secondSegmentOptions: FlightOption[];
  selectedOutbound: FlightOption | null;
  selectedSecondSeg: FlightOption | null;
  selectedBrand: FareBrandId;
  visibleBrands: FareBrandId[];
  nonStopOnly: boolean;
  sortBy: "price" | "duration";
  nearbyAltCodes: string[];
  computeBrandPricePerPaxOMR: (brandId: FareBrandId) => number;
  onUpdateSearch: (patch: Partial<SearchCriteria>) => void;
  onSelectOutbound: (id: string) => void;
  onSelectSecondSeg: (id: string) => void;
  onSelectBrand: (id: FareBrandId) => void;
  onToggleNonStopOnly: (val: boolean) => void;
  onChangeSortBy: (val: "price" | "duration") => void;
  onContinue: () => void;
}

export function FlightResultsStep({
  search,
  routeId,
  currency,
  lang,
  thirtyDayFares,
  activeDayFare,
  bffSearchData,
  outboundOptions,
  secondSegmentOptions,
  selectedOutbound,
  selectedSecondSeg,
  selectedBrand,
  visibleBrands,
  nonStopOnly,
  sortBy,
  nearbyAltCodes,
  computeBrandPricePerPaxOMR,
  onUpdateSearch,
  onSelectOutbound,
  onSelectSecondSeg,
  onSelectBrand,
  onToggleNonStopOnly,
  onChangeSortBy,
  onContinue,
}: FlightResultsStepProps) {
  const { sindbadTier } = useIBE();
  const promoEntry = search.promoCode ? PROMO_CODES[search.promoCode] : undefined;

  const bffQuotesMap = new Map<FareBrandId, BffBrandedFareQuote>(
    (bffSearchData?.brandedFares ?? []).map((q) => [q.brandId, q]),
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Calendar className="h-5 w-5 text-primary" />
            30-Day Low Fare Calendar ({routeId})
          </h2>
          <span className="text-xs text-muted-foreground">
            {bffSearchData
              ? `Served via BFF ${bffSearchData.cached ? "(Fare Cache Hit)" : "(PSS Adapter)"}`
              : `Showing ${FARE_BRANDS[selectedBrand].name} outbound prices`}
          </span>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {thirtyDayFares.map((day) => {
            const active = day.dateISO === search.departDate;
            return (
              <button
                key={day.dateISO}
                type="button"
                onClick={() => onUpdateSearch({ departDate: day.dateISO })}
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
              <h3 className="font-display text-lg font-bold">
                Flights on {search.departDate} are Sold Out
              </h3>
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
                      onClick={() => onUpdateSearch({ departDate: alt.dateISO })}
                    >
                      {alt.dateISO} · {formatMoney(alt.pricesOMR[selectedBrand], currency)}
                    </Button>
                  ))}
                {nearbyAltCodes.map((code) => (
                  <Button
                    key={code}
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdateSearch({ destination: code })}
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 font-semibold">
                <Filter className="h-3.5 w-3.5" /> Filters:
              </span>
              <label
                htmlFor="filter-nonstop"
                className="inline-flex cursor-pointer items-center gap-1.5"
              >
                <input
                  id="filter-nonstop"
                  type="checkbox"
                  checked={nonStopOnly}
                  onChange={(e) => onToggleNonStopOnly(e.target.checked)}
                />
                Non-stop only ({outboundOptions.length} shown)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="sort-results" className="text-muted-foreground">
                Sort:
              </label>
              <select
                id="sort-results"
                value={sortBy}
                onChange={(e) => onChangeSortBy(e.target.value as "price" | "duration")}
                className="rounded-md border border-border bg-card px-2 py-1 font-semibold"
              >
                <option value="price">Lowest Price</option>
                <option value="duration">Shortest Duration</option>
              </select>
            </div>
          </div>

          <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
            {nearbyAltCodes.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-2.5 text-xs">
                <span className="font-semibold text-foreground">
                  {lang === "ar"
                    ? "مطارات قريبة متاحة:"
                    : `Compare nearby airports (${search.destination} area):`}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {nearbyAltCodes.map((code) => (
                    <Button
                      key={code}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs font-bold"
                      onClick={() => onUpdateSearch({ destination: code })}
                    >
                      Switch to {code}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h3 className="font-display text-base font-bold">
                Select Outbound Flight ({search.origin} → {search.destination} · {search.departDate}
                )
              </h3>
              {outboundOptions.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No non-stop flights match this filter. Uncheck &quot;Non-stop only&quot; to view
                  connecting itineraries.
                </p>
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {outboundOptions.map((opt) => {
                    const active = selectedOutbound?.id === opt.id;
                    const estPrice = Math.round(
                      (activeDayFare?.pricesOMR[selectedBrand] ?? 0) * opt.priceMultiplier,
                    );
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onSelectOutbound(opt.id)}
                        className={`flex flex-col justify-between rounded-xl border p-4 text-start transition-all ${
                          active
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/50"
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
                          <span className="font-semibold text-warning-foreground">
                            {opt.seatsRemaining} seats left
                          </span>
                          <span className="font-display font-bold text-primary">
                            {formatMoney(estPrice, currency)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

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
                    const legBase = activeDayFare?.pricesOMR[selectedBrand] ?? 0;
                    const estPrice = Math.round(legBase * opt.priceMultiplier);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onSelectSecondSeg(opt.id)}
                        className={`flex flex-col justify-between rounded-xl border p-4 text-start transition-all ${
                          active
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-sm font-bold text-primary">
                            {opt.flightNumber}
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
                          </p>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
                          <span>
                            {opt.origin} → {opt.destination}
                          </span>
                          <span className="font-display font-bold text-primary">
                            +{formatMoney(estPrice, currency)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedOutbound && (
              <div className="border-t border-border pt-5">
                <h3 className="font-display text-base font-bold">Compare Branded Fares</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {visibleBrands.map((brandId) => {
                    const spec = FARE_BRANDS[brandId];
                    const bffQuote = bffQuotesMap.get(brandId);
                    const rawPriceOMR = bffQuote
                      ? bffQuote.rawPricePerPaxOMR
                      : computeBrandPricePerPaxOMR(brandId);
                    const discountedOMR = bffQuote
                      ? bffQuote.discountedPricePerPaxOMR
                      : promoEntry
                        ? Math.round(rawPriceOMR * (1 - promoEntry.discountPct / 100))
                        : rawPriceOMR;
                    const active = selectedBrand === brandId;
                    const miles = bffQuote
                      ? bffQuote.earnedMilesPerPax
                      : calculateSindbadMiles(discountedOMR, sindbadTier);

                    return (
                      <button
                        key={brandId}
                        type="button"
                        onClick={() => onSelectBrand(brandId)}
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
                            <li>
                              • Checked Bag: <strong>{spec.checkedBagKg} kg</strong> (+
                              {sindbadTier === "Gold"
                                ? 15
                                : sindbadTier === "Silver"
                                  ? 10
                                  : 0} kg {sindbadTier})
                            </li>
                            <li>
                              • Cabin Bag: <strong>{spec.cabinBagText}</strong>
                            </li>
                            <li>
                              • Seat Selection:{" "}
                              <strong>
                                {spec.seatSelection === "free" || sindbadTier === "Gold"
                                  ? "Complimentary"
                                  : "Paid option"}
                              </strong>
                            </li>
                            <li>
                              • Changes:{" "}
                              <strong>
                                {spec.changePolicy === "free"
                                  ? "Free"
                                  : spec.changePolicy === "reduced"
                                    ? "Low Fee"
                                    : "Standard Fee"}
                              </strong>
                            </li>
                            <li>
                              • Refund:{" "}
                              <strong>
                                {spec.refundPolicy === "free"
                                  ? "Full Refund"
                                  : spec.refundPolicy === "fee"
                                    ? "With Fee"
                                    : "Non-refundable"}
                              </strong>
                            </li>
                            {spec.loungeIncluded && (
                              <li>
                                • <strong>Majan Lounge & Fast Track included</strong>
                              </li>
                            )}
                          </ul>
                        </div>

                        <div className="mt-5 border-t border-border pt-3">
                          {search.awardMode ? (
                            <>
                              <p className="font-display text-2xl font-extrabold text-primary">
                                {(
                                  bffQuote?.awardMilesPerPax ??
                                  Math.max(4500, Math.round(rawPriceOMR * 120))
                                ).toLocaleString()}{" "}
                                mi
                              </p>
                              <p className="text-xs font-medium text-muted-foreground">
                                per guest + {formatMoney(bffQuote?.taxesPerPaxOMR ?? 28, currency)}{" "}
                                taxes
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="flex items-baseline gap-2">
                                <p className="font-display text-2xl font-extrabold text-primary">
                                  {formatMoney(discountedOMR, currency)}
                                </p>
                                {discountedOMR < rawPriceOMR && (
                                  <span className="text-xs text-muted-foreground line-through">
                                    {formatMoney(rawPriceOMR, currency)}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-medium text-muted-foreground">
                                per guest · +{miles.toLocaleString()} Sindbad miles
                              </p>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex justify-end">
                  <Button
                    size="lg"
                    className="gap-2 rounded-xl px-7 font-display font-bold"
                    onClick={onContinue}
                  >
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
  );
}
