import { useState } from "react";
import { AlertTriangle, Phone, Plane, RotateCcw } from "lucide-react";
import { useIBE } from "../context/IBEContext";
import { OMAN_AIR_20_ROUTES } from "../data/omanAirRoutes";

/**
 * FR-31 & FR-32: Ultra-lightweight, zero-media high-availability Dark Site mode
 * for emergency operational disruptions.
 */
export function DarkSiteView() {
  const { setDarkSiteMode } = useIBE();
  const [flightQuery, setFlightQuery] = useState("WY 603");

  const match = OMAN_AIR_20_ROUTES.find(
    (r) =>
      r.flightNumber.replace(/\s+/g, "").toUpperCase() ===
      flightQuery.replace(/\s+/g, "").toUpperCase()
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b-2 border-destructive bg-teal-deep text-teal-deep-foreground">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-gold" />
            <div>
              <p className="font-display text-lg font-bold tracking-wider">OMAN AIR · TRAVEL ADVISORY PORTAL</p>
              <p className="text-xs opacity-80">Lightweight High-Availability Dark Site Mode (Zero Heavy Media)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDarkSiteMode(false)}
            className="inline-flex items-center gap-1.5 rounded-md border border-teal-deep-foreground/30 px-3 py-1.5 text-xs font-semibold hover:bg-teal-deep-foreground/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Exit Dark Site
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
          <h1 className="font-display text-xl font-bold">Operational Update — Gulf Airspace Weather Advisory</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Updated 16:00 UTC · Due to severe weather cells near Dubai (DXB), select regional departures including WY 603 are subject to schedule adjustments. All rebooking fees are waived for affected passengers.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Plane className="h-4 w-4 text-primary" />
            Read-Only Flight Status Check (BFF Cached)
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={flightQuery}
              onChange={(e) => setFlightQuery(e.target.value)}
              placeholder="Enter flight no. e.g. WY 101"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          {match ? (
            <div className="mt-4 rounded-md bg-muted p-4 text-sm">
              <p className="font-semibold">
                {match.flightNumber}: {match.origin} → {match.destination} ({match.aircraft})
              </p>
              <p className="mt-1 text-muted-foreground">
                Scheduled {match.departureTime} – {match.arrivalTime} · Status:{" "}
                <strong className={match.flightNumber === "WY 603" ? "text-destructive" : "text-success"}>
                  {match.flightNumber === "WY 603" ? "DISRUPTED — Free Rebooking Active" : "ON TIME"}
                </strong>
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Enter an Oman Air flight number (e.g. WY 101, WY 603, WY 817).</p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Phone className="h-4 w-4 text-primary" />
            24/7 Emergency Assistance Directory
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-md bg-muted p-3">
              <p className="font-semibold">Oman (Muscat Hub)</p>
              <p className="text-muted-foreground">+968 2453 1111</p>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="font-semibold">UAE & GCC Toll-Free</p>
              <p className="text-muted-foreground">800 6626 247</p>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="font-semibold">UK & Europe Desk</p>
              <p className="text-muted-foreground">+44 20 7101 0700</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}