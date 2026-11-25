import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Luggage,
  ScanFace,
  ShieldAlert,
  Smartphone,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { useIBE } from "../context/IBEContext";
import { formatMoney } from "../data/omanAirRoutes";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/checkin")({
  head: () => ({
    meta: [
      { title: "Online Check-In & Digital Boarding Pass | Oman Air" },
      { name: "description", content: "Check in online for your Oman Air flight, generate IATA BCBP digital boarding passes, digital bag tags, and opt into biometric boarding." },
      { property: "og:title", content: "Online Check-In | Oman Air" },
      { property: "og:description", content: "Fast Oman Air online check-in with Apple/Google Wallet boarding passes and disruption-aware rebooking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckInPage,
});

/**
 * FR-131..148: Online Check-in, Disruption-Aware Entry, SSR Restriction (UMNR),
 * Last-Minute DCS Upsell, Digital Bag Tag, Biometric Opt-in, IATA BCBP Boarding Pass & Off-load.
 */
function CheckInPage() {
  const { bookings, updateBooking, currency } = useIBE();
  const [selectedRloc, setSelectedRloc] = useState(bookings[0]?.rloc ?? "WY7K9M");
  const [biometricConsent, setBiometricConsent] = useState(false);
  const [bagTagRequested, setBagTagRequested] = useState(true);

  const booking = bookings.find((b) => b.rloc === selectedRloc);
  const hasUmnrRestriction = booking?.ssrs.some((s) => s.code === "UMNR") ?? false;
  const allCheckedIn = booking ? booking.passengers.every((p) => p.checkedIn) : false;

  const handleCompleteCheckIn = () => {
    if (!booking) return;
    updateBooking(booking.rloc, (prev) => ({
      ...prev,
      biometricOptIn: biometricConsent,
      passengers: prev.passengers.map((p, idx) => ({
        ...p,
        checkedIn: true,
        ...(bagTagRequested ? { bagTagNumber: `WY-${Math.floor(400000 + idx * 137)}` } : {}),
      })),
    }));
    toast.success("DCS Check-in complete! IATA BCBP Digital Boarding Passes generated.");
  };

  const handleUndoCheckIn = () => {
    if (!booking) return;
    updateBooking(booking.rloc, (prev) => ({
      ...prev,
      passengers: prev.passengers.map((p) => ({ ...p, checkedIn: false })),
    }));
    toast.info("Passenger off-loaded (Check-in undone in DCS).");
  };

  const handleOneClickIrropsCheckIn = () => {
    if (!booking) return;
    updateBooking(booking.rloc, (prev) => {
      const { disruptionNote: _removed, ...rest } = prev;
      return {
        ...rest,
        status: "CONFIRMED",
        flightNumber: "WY 607",
        departureTime: "14:15",
        arrivalTime: "15:25",
        passengers: prev.passengers.map((p) => ({ ...p, checkedIn: true })),
      };
    });
    toast.success("Re-accommodated onto WY 607 and instantly checked in!");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-extrabold">Online Check-In & Digital Boarding Pass</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Select a booking to verify APIS, generate home-printed/electronic bag tags, and issue IATA BCBP boarding passes.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {bookings.map((b) => (
          <button
            key={b.rloc}
            type="button"
            onClick={() => setSelectedRloc(b.rloc)}
            className={`rounded-xl border px-4 py-2 text-xs font-bold transition-colors ${
              selectedRloc === b.rloc
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary"
            }`}
          >
            {b.rloc} · {b.origin}→{b.destination}
            {b.status === "DISRUPTED_CXL" ? " (Disrupted)" : ""}
            {b.ssrs.some((s) => s.code === "UMNR") ? " (UMNR)" : ""}
          </button>
        ))}
      </div>

      {booking && (
        <div className="mt-6 space-y-6">
          {/* FR-145 & FR-146: Disruption-Aware Entry */}
          {booking.status === "DISRUPTED_CXL" ? (
            <div className="rounded-2xl border-2 border-destructive bg-destructive/5 p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-6 w-6 text-destructive" />
                <div>
                  <h2 className="font-display text-xl font-bold text-destructive">
                    Disruption Detected on {booking.flightNumber} — Instant Re-Protection Ready
                  </h2>
                  <p className="mt-1 text-sm">{booking.disruptionNote}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button onClick={handleOneClickIrropsCheckIn} className="rounded-xl font-display font-bold">
                      Accept WY 607 (14:15) & Check In Instantly
                    </Button>
                    <Button asChild variant="outline" className="rounded-xl">
                      <Link to="/manage">View Hotel & Meal Vouchers in MMB</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : hasUmnrRestriction ? (
            /* FR-136 & FR-143: Check-in Inhibition for UMNR */
            <div className="rounded-2xl border-2 border-warning bg-warning/15 p-6">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-6 w-6 text-warning-foreground" />
                <div>
                  <h2 className="font-display text-xl font-bold">Airport Counter Check-In Required (SSR: UMNR)</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Self-service online check-in is inhibited for Unaccompanied Minors (SSR UMNR) so our Muscat International Airport Special Assistance desk can verify guardian documentation and assign a dedicated escort.
                  </p>
                </div>
              </div>
            </div>
          ) : !allCheckedIn ? (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-7">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="font-display text-lg font-bold">
                    Group / Family Check-in · {booking.flightNumber} ({booking.origin} → {booking.destination})
                  </h2>
                  <div className="mt-3 space-y-2">
                    {booking.passengers.map((p, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-background p-3 text-sm">
                        <div>
                          <p className="font-bold">{p.firstName} {p.lastName}</p>
                          <p className="text-xs text-muted-foreground">APIS Verified · Passport {p.passport} · Seat {p.seat}</p>
                        </div>
                        <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-bold text-success">Ready</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2.5 border-t border-border pt-4 text-xs">
                    <label className="flex items-center justify-between rounded-xl border border-border p-3">
                      <span className="flex items-center gap-2 font-semibold">
                        <Luggage className="h-4 w-4 text-primary" /> Generate Digital Bag Tag Signal (Home-Print / Kiosk)
                      </span>
                      <input type="checkbox" checked={bagTagRequested} onChange={(e) => setBagTagRequested(e.target.checked)} />
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-border p-3">
                      <span className="flex items-center gap-2 font-semibold">
                        <ScanFace className="h-4 w-4 text-primary" /> Biometric Smart Travel Opt-in (Muscat Airport BIMS)
                      </span>
                      <input type="checkbox" checked={biometricConsent} onChange={(e) => setBiometricConsent(e.target.checked)} />
                    </label>
                  </div>

                  <Button size="lg" className="mt-5 w-full rounded-xl font-display font-bold" onClick={handleCompleteCheckIn}>
                    Complete Check-In & Issue Boarding Passes
                  </Button>
                </div>
              </div>

              {/* FR-135 & FR-141: Last-Minute DCS Check-in Merchandising */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-gold/50 bg-gold/10 p-5">
                  <h3 className="font-display text-lg font-bold">Last-Minute Check-In Upgrades</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Exclusive DCS airport-day offers before gate close.</p>
                  <div className="mt-4 space-y-2.5">
                    <Button
                      variant="secondary"
                      className="w-full justify-between"
                      onClick={() => toast.success("Instant Business Cabin Upgrade added at DCS rate!")}
                    >
                      <span>Instant Business Class Upgrade</span>
                      <strong>{formatMoney(115, currency)}</strong>
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full justify-between"
                      onClick={() => toast.success("DCS Extra 10 kg Bag added to your Digital Bag Tag.")}
                    >
                      <span>DCS Extra 10 kg Bag</span>
                      <strong>{formatMoney(14, currency)}</strong>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* IATA BCBP Digital Boarding Pass View */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-success">
                  <CheckCircle2 className="h-5 w-5" /> Checked In · Gate {booking.gate} · Terminal {booking.terminal}
                </span>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={handleUndoCheckIn}>
                  <Undo2 className="h-3.5 w-3.5" /> Undo Check-In (Off-load)
                </Button>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {booking.passengers.map((p, idx) => (
                  <div key={idx} className="overflow-hidden rounded-2xl border border-border bg-card shadow-md">
                    <div className="flex items-center justify-between bg-teal-deep px-5 py-3.5 text-teal-deep-foreground">
                      <div>
                        <p className="font-display text-xs font-bold tracking-[0.2em] text-gold">OMAN AIR · BOARDING PASS</p>
                        <p className="font-display text-lg font-extrabold">{p.firstName} {p.lastName}</p>
                      </div>
                      <span className="rounded-lg bg-gold px-2.5 py-1 text-xs font-extrabold text-gold-foreground">
                        {booking.flightNumber}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 p-5 text-sm">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Route</p>
                        <p className="font-display text-xl font-extrabold text-primary">{booking.origin} → {booking.destination}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Seat / Gate</p>
                        <p className="font-display text-xl font-extrabold">{p.seat} · {booking.gate}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Boarding</p>
                        <p className="font-display text-xl font-extrabold">{booking.departureTime}</p>
                      </div>
                    </div>

                    {/* Deterministic 2D IATA BCBP SVG Barcode */}
                    <div className="flex items-center justify-between border-t border-dashed border-border bg-muted/30 px-5 py-4">
                      <div className="text-xs space-y-1">
                        <p className="font-semibold">RLOC: {booking.rloc} · Seq 00{idx + 1}</p>
                        {p.bagTagNumber && <p className="text-muted-foreground">Digital Bag Tag: {p.bagTagNumber}</p>}
                        {booking.biometricOptIn && <p className="font-semibold text-primary">Biometric Smart Gate Active</p>}
                      </div>
                      <svg viewBox="0 0 80 80" className="h-16 w-16 rounded border border-border bg-card p-1" aria-label="IATA BCBP 2D Barcode">
                        {Array.from({ length: 64 }, (_, cell) => {
                          const x = (cell % 8) * 9 + 4;
                          const y = Math.floor(cell / 8) * 9 + 4;
                          const on = ((cell * 17 + idx * 7 + booking.rloc.charCodeAt(cell % 6)) % 3) !== 0;
                          return on ? <rect key={cell} x={x} y={y} width={7} height={7} fill="currentColor" /> : null;
                        })}
                      </svg>
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-border p-3.5">
                      <Button size="sm" variant="secondary" className="flex-1 gap-1.5 text-xs" onClick={() => toast.success("Added to Apple Wallet / Google Wallet!")}>
                        <Smartphone className="h-3.5 w-3.5" /> Add to Wallet
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => window.print()}>
                        <Download className="h-3.5 w-3.5" /> Print / PDF
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}