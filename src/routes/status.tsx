import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plane, Search } from "lucide-react";
import { AIRPORTS, OMAN_AIR_20_ROUTES, formatDuration } from "../data/omanAirRoutes";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Live Flight Status & Timetable | Oman Air" },
      { name: "description", content: "Check real-time Oman Air flight status, terminal, gate, and timetable across all 20 routes from Muscat International Airport." },
      { property: "og:title", content: "Flight Status | Oman Air" },
      { property: "og:description", content: "Real-time Oman Air departures, arrivals, and 20-route timetable." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FlightStatusPage,
});

function FlightStatusPage() {
  const [query, setQuery] = useState("");

  const filtered = OMAN_AIR_20_ROUTES.filter((r) => {
    const q = query.trim().toUpperCase();
    if (!q) return true;
    const dest = AIRPORTS.find((a) => a.code === r.destination);
    return (
      r.flightNumber.toUpperCase().includes(q) ||
      r.destination.includes(q) ||
      (dest?.city.toUpperCase().includes(q) ?? false)
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Live Flight Status & 20-Route Timetable</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only schedule & gate telemetry served via BFF cache without exposing core PSS endpoints (FR-28).
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by flight (WY 101) or city..."
            className="h-10 w-full rounded-xl border border-input bg-card pe-3 ps-9 text-sm"
          />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">Flight</th>
              <th className="px-4 py-3 text-start">Route</th>
              <th className="px-4 py-3 text-start">Schedule</th>
              <th className="px-4 py-3 text-start">Aircraft</th>
              <th className="px-4 py-3 text-start">Gate</th>
              <th className="px-4 py-3 text-start">Status</th>
              <th className="px-4 py-3 text-end">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r, idx) => {
              const dest = AIRPORTS.find((a) => a.code === r.destination);
              const status =
                r.flightNumber === "WY 603"
                  ? { label: "DISRUPTED (IRROPS)", cls: "bg-destructive/15 text-destructive" }
                  : idx % 5 === 1
                    ? { label: "BOARDING", cls: "bg-gold/25 text-foreground" }
                    : { label: "ON TIME", cls: "bg-success/15 text-success" };
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-display font-bold text-primary">
                    <Plane className="me-1.5 inline h-3.5 w-3.5" />
                    {r.flightNumber}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    MCT → {r.destination} <span className="text-xs text-muted-foreground">({dest?.city})</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.departureTime} – {r.arrivalTime} ({formatDuration(r.durationMinutes)})
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.aircraft}</td>
                  <td className="px-4 py-3 font-semibold text-xs">T1 · A{10 + (idx % 12)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.cls}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button asChild variant="ghost" size="sm" className="text-xs font-bold text-primary">
                      <Link to={r.flightNumber === "WY 603" ? "/manage" : "/"}>
                        {r.flightNumber === "WY 603" ? "Rebook Free" : "Book"}
                      </Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}