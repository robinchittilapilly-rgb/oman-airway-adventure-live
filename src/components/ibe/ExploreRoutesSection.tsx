import { ArrowRight } from "lucide-react";
import studioImg from "../../assets/business-studio.jpg";
import {
  AIRPORTS,
  OMAN_AIR_20_ROUTES,
  formatMoney,
  get30DayFareRepository,
  getDateISO,
  type CurrencyCode,
} from "../../data/omanAirRoutes";
import { Button } from "../ui/button";
import type { SearchCriteria } from "./FlightSearchWidget";

interface ExploreRoutesSectionProps {
  lang: "en" | "ar";
  currency: CurrencyCode;
  regionFilter: string;
  onChangeRegion: (region: string) => void;
  onLaunchSearch: (criteria: SearchCriteria) => void;
}

const REGIONS = ["All", "Oman", "GCC & MENA", "Europe", "Asia", "Africa"] as const;

export function ExploreRoutesSection({
  lang,
  currency,
  regionFilter,
  onChangeRegion,
  onLaunchSearch,
}: ExploreRoutesSectionProps) {
  const filtered20Routes = OMAN_AIR_20_ROUTES.filter((r) => {
    if (regionFilter === "All") return true;
    const dest = AIRPORTS.find((a) => a.code === r.destination);
    return dest?.region === regionFilter;
  });

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
              {lang === "ar" ? "استكشف 20 وجهة للطيران العماني" : "Explore All 20 Oman Air Routes"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Synthetic 30-day Economy Super Saver fares from Muscat (MCT) — click any route to
              launch instant booking.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REGIONS.map((reg) => (
              <button
                key={reg}
                type="button"
                onClick={() => onChangeRegion(reg)}
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
            const lowest30 = Math.min(
              ...get30DayFareRepository(route.id).map((d) => d.pricesOMR.ECO_SAVER),
            );
            return (
              <button
                key={route.id}
                type="button"
                onClick={() =>
                  onLaunchSearch({
                    tripType: "roundtrip",
                    origin: route.origin,
                    destination: route.destination,
                    departDate: getDateISO(2),
                    returnDate: getDateISO(8),
                    multiLeg2Origin: route.destination,
                    multiLeg2Destination: "DXB",
                    multiLeg2Date: getDateISO(6),
                    cabin: "economy",
                    passengers: {
                      adults: 1,
                      children: 0,
                      infants: 0,
                      students: 0,
                      seniors: 0,
                      labor: 0,
                    },
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
                    <span className="text-xs font-semibold text-muted-foreground">
                      {route.flightNumber}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-lg font-bold group-hover:text-primary">
                    {lang === "ar" ? dest?.cityAr : dest?.city}{" "}
                    <span className="text-xs font-semibold text-muted-foreground">
                      ({route.destination})
                    </span>
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">{route.highlightNote}</p>
                </div>
                <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      30-Day Low
                    </p>
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
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
              Oman Air Business Studio
            </p>
            <h2 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">
              Your Private Suite Above the Arabian Sea
            </h2>
            <p className="mt-3 text-sm opacity-85">
              Available on Boeing 787-9 Dreamliner flagship routes to London, Paris, Frankfurt,
              Amsterdam, Bangkok, and Kuala Lumpur. Enjoy 60 kg baggage, enclosed privacy walls,
              Majan Lounge access, and Omani hospitality.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                variant="secondary"
                size="lg"
                className="rounded-xl font-display font-bold"
                onClick={() =>
                  onLaunchSearch({
                    tripType: "roundtrip",
                    origin: "MCT",
                    destination: "LHR",
                    departDate: getDateISO(3),
                    returnDate: getDateISO(10),
                    multiLeg2Origin: "LHR",
                    multiLeg2Destination: "MCT",
                    multiLeg2Date: getDateISO(8),
                    cabin: "studio",
                    passengers: {
                      adults: 1,
                      children: 0,
                      infants: 0,
                      students: 0,
                      seniors: 0,
                      labor: 0,
                    },
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
  );
}
