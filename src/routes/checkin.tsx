import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Luggage,
  ScanFace,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { useIBE } from "../context/IBEContext";
import { formatMoney } from "../data/omanAirRoutes";
import { bffClient } from "../lib/bff-client";
import { trackIbeEvent } from "../lib/analytics";
import { buildIataBcbpString, generateUniqueBagTagNumber, isHoldExpired } from "../lib/ibe-rules";
import { t } from "../lib/i18n";
import { ScannableQrCode } from "../components/ibe/ScannableQrCode";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/checkin")({
  head: () => ({
    meta: [
      { title: "Online Check-In & Digital Boarding Pass | Oman Air" },
      {
        name: "description",
        content:
          "Check in online for your Oman Air flight, generate IATA BCBP digital boarding passes, digital bag tags, and opt into biometric boarding.",
      },
      { property: "og:title", content: "Online Check-In | Oman Air" },
      {
        property: "og:description",
        content:
          "Oman Air online check-in with IATA BCBP boarding passes and disruption rebooking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckInPage,
});

function CheckInPage() {
  const {
    bffConnected,
    bookings,
    addBooking,
    updateBooking,
    spendMiles,
    syncFromBffUser,
    sindbadMiles,
    sindbadSignedIn,
    currency,
    lang,
  } = useIBE();
  const copy = t(lang).checkin;

  const [selectedRloc, setSelectedRloc] = useState(bookings[0]?.rloc ?? "WY7K9M");
  const [biometricConsent, setBiometricConsent] = useState(false);
  const [bagTagRequested, setBagTagRequested] = useState(true);
  const [payWithMiles, setPayWithMiles] = useState(false);
  const [autoCheckInEligible, setAutoCheckInEligible] = useState<boolean | null>(null);

  // FR-10 / FR-49: Consume cross-channel handoff token (?handoff=hoff_...) on load
  useEffect(() => {
    if (!bffConnected || typeof window === "undefined") return;
    const token = new URLSearchParams(window.location.search).get("handoff")?.trim();
    if (!token) return;
    bffClient
      .consumeHandoff(token, lang)
      .then((res) => {
        addBooking(res.booking);
        setSelectedRloc(res.booking.rloc);
        toast.success(`Resumed check-in via mobile handoff (${res.booking.rloc})`);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Handoff token expired.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bffConnected]);

  const booking = bookings.find((b) => b.rloc === selectedRloc);
  const bookingRloc = booking?.rloc;

  // FR-138: Check 24h auto check-in eligibility via BFF
  useEffect(() => {
    if (!bffConnected || !bookingRloc) {
      setAutoCheckInEligible(null);
      return;
    }
    bffClient
      .getAutoCheckInEligibility(bookingRloc, lang)
      .then((res) => setAutoCheckInEligible(res.autoCheckInEligible))
      .catch(() => setAutoCheckInEligible(null));
  }, [bffConnected, bookingRloc, lang]);
  const hasUmnrRestriction = booking?.ssrs.some((s) => s.code === "UMNR") ?? false;
  const allCheckedIn = booking ? booking.passengers.every((p) => p.checkedIn) : false;
  const holdExpired = booking?.status === "HELD" && isHoldExpired(booking.holdExpiresAt);
  const notTicketed =
    booking != null &&
    (booking.status === "HELD" ||
      booking.status === "EXPIRED" ||
      booking.status === "REFUNDED" ||
      booking.status === "VOUCHERED");

  const handleCompleteCheckIn = async () => {
    if (!booking) return;
    if (bffConnected) {
      try {
        const res = await bffClient.completeCheckIn(
          booking.rloc,
          biometricConsent,
          bagTagRequested,
          lang,
        );
        addBooking(res.booking);
        toast.success("BFF DCS check-in complete! IATA BCBP boarding passes issued.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Check-in failed.");
      }
      return;
    }
    updateBooking(booking.rloc, (prev) => ({
      ...prev,
      biometricOptIn: biometricConsent,
      passengers: prev.passengers.map((p, idx) => ({
        ...p,
        checkedIn: true,
        ...(bagTagRequested ? { bagTagNumber: generateUniqueBagTagNumber(prev.rloc, idx) } : {}),
      })),
    }));
    toast.success("Demo check-in complete! IATA BCBP boarding pass preview generated.");
  };

  const handleUndoCheckIn = async () => {
    if (!booking) return;
    if (bffConnected) {
      try {
        const res = await bffClient.offloadCheckIn(booking.rloc, lang);
        addBooking(res.booking);
        toast.info("Passenger off-loaded via BFF DCS.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Off-load failed.");
      }
      return;
    }
    updateBooking(booking.rloc, (prev) => ({
      ...prev,
      passengers: prev.passengers.map((p) => ({ ...p, checkedIn: false })),
    }));
    toast.info("Passenger off-loaded (Demo DCS check-in undone).");
  };

  const handleOneClickIrropsCheckIn = async () => {
    if (!booking) return;
    if (bffConnected) {
      try {
        const res = await bffClient.applyIrrops(
          booking.rloc,
          {
            action: "rebook_and_checkin",
            flightNumber: "WY 607",
            departureTime: "14:15",
            arrivalTime: "15:25",
          },
          lang,
        );
        addBooking(res.booking);
        syncFromBffUser(res.user);
        toast.success("Re-accommodated onto WY 607 and checked in via BFF!");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "IRROPS check-in failed.");
      }
      return;
    }
    updateBooking(booking.rloc, (prev) => {
      const { disruptionNote: _removed, ...rest } = prev;
      return {
        ...rest,
        status: "CONFIRMED",
        flightNumber: "WY 607",
        departureTime: "14:15",
        arrivalTime: "15:25",
        passengers: prev.passengers.map((p, idx) => ({
          ...p,
          checkedIn: true,
          bagTagNumber: generateUniqueBagTagNumber(prev.rloc, idx),
        })),
      };
    });
    toast.success("Re-accommodated onto WY 607 and checked in (Demo)!");
  };

  const handleCheckInUpgrade = async (kind: "biz" | "bag") => {
    if (!booking) return;
    if (bffConnected) {
      try {
        const res = await bffClient.upgradeCheckIn(booking.rloc, kind, payWithMiles, lang);
        addBooking(res.booking);
        syncFromBffUser(res.user);
        toast.success("Check-in upgrade applied via BFF!");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upgrade failed.");
      }
      return;
    }
    const priceOMR = kind === "biz" ? 115 : 14;
    const milesCost = priceOMR * 400;
    const label = kind === "biz" ? "Check-in Business Upgrade" : "Check-in Extra 10 kg Bag";

    if (payWithMiles) {
      if (!sindbadSignedIn || !spendMiles(milesCost)) {
        toast.error(
          `Need ${milesCost.toLocaleString()} Sindbad miles (signed in) for this upgrade.`,
        );
        return;
      }
    }

    updateBooking(booking.rloc, (prev) => ({
      ...prev,
      ...(kind === "biz" ? { fareBrand: "BIZ_COMFORT" } : {}),
      ancillaries: prev.ancillaries.includes(label)
        ? prev.ancillaries
        : [...prev.ancillaries, label],
      ...(payWithMiles ? {} : { totalPaidOMR: prev.totalPaidOMR + priceOMR }),
    }));
    toast.success(
      payWithMiles
        ? `${label} applied for ${milesCost.toLocaleString()} miles!`
        : `${label} added (${formatMoney(priceOMR, currency)})!`,
    );
  };

  const handleDownloadWalletPass = (
    p: NonNullable<typeof booking>["passengers"][number],
    bcbp: string,
  ) => {
    if (!booking) return;
    const content = [
      "OMAN AIR DIGITAL BOARDING PASS (DEMO PREVIEW)",
      `Passenger: ${p.firstName} ${p.lastName}`,
      `RLOC: ${booking.rloc}`,
      `Flight: ${booking.flightNumber} (${booking.origin} -> ${booking.destination})`,
      `Date: ${booking.dateISO} | Dep: ${booking.departureTime} | Terminal: ${booking.terminal} | Gate: ${booking.gate}`,
      `Seat: ${p.seat}${p.bagTagNumber ? ` | Bag Tag: ${p.bagTagNumber}` : ""}`,
      `IATA BCBP: ${bcbp}`,
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `OmanAir-${booking.rloc}-${p.firstName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded boarding pass summary for ${p.firstName} (Demo Wallet Pass).`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl font-extrabold">{copy.title}</h1>
        {bffConnected && (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
            BFF Connected
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>

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
          {notTicketed ? (
            <div className="rounded-2xl border-2 border-warning bg-warning/15 p-6">
              <h2 className="font-display text-xl font-bold">
                Check-In Unavailable ({holdExpired ? "HOLD EXPIRED" : booking.status})
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Only confirmed, ticketed bookings can check in online. Visit Manage My Booking to
                pay for a held fare or review status.
              </p>
              <Button asChild className="mt-4 rounded-xl">
                <Link to="/manage">Open Manage My Booking</Link>
              </Button>
            </div>
          ) : booking.status === "DISRUPTED_CXL" ? (
            <div className="rounded-2xl border-2 border-destructive bg-destructive/5 p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-6 w-6 text-destructive" />
                <div>
                  <h2 className="font-display text-xl font-bold text-destructive">
                    Disruption Detected on {booking.flightNumber} — Re-Protection Ready
                  </h2>
                  <p className="mt-1 text-sm">{booking.disruptionNote}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      onClick={handleOneClickIrropsCheckIn}
                      className="rounded-xl font-display font-bold"
                    >
                      Accept WY 607 (14:15) & Check In
                    </Button>
                    <Button asChild variant="outline" className="rounded-xl">
                      <Link to="/manage">View Hotel & Meal Vouchers in MMB</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : hasUmnrRestriction ? (
            <div className="rounded-2xl border-2 border-warning bg-warning/15 p-6">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-6 w-6 text-warning-foreground" />
                <div>
                  <h2 className="font-display text-xl font-bold">
                    Airport Counter Check-In Required (SSR: UMNR)
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Self-service online check-in is inhibited for Unaccompanied Minors (SSR UMNR) so
                    airport staff can verify guardian documentation.
                  </p>
                </div>
              </div>
            </div>
          ) : !allCheckedIn ? (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-7">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold">
                    <span>
                      Group / Family Check-in · {booking.flightNumber} ({booking.origin} →{" "}
                      {booking.destination})
                    </span>
                    {autoCheckInEligible && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2.5 py-0.5 text-xs font-bold text-foreground">
                        <Sparkles className="h-3 w-3 text-primary" /> 24h Auto Check-In Eligible
                      </span>
                    )}
                  </h2>
                  <div className="mt-3 space-y-2">
                    {booking.passengers.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-xl border border-border bg-background p-3 text-sm"
                      >
                        <div>
                          <p className="font-bold">
                            {p.firstName} {p.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            APIS Format Checked · Passport {p.passport} · Seat {p.seat}
                          </p>
                        </div>
                        <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-bold text-success">
                          Ready
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2.5 border-t border-border pt-4 text-xs">
                    <label
                      htmlFor="checkin-bag-tag"
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-border p-3"
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        <Luggage className="h-4 w-4 text-primary" /> Generate Unique Digital Bag Tag
                      </span>
                      <input
                        id="checkin-bag-tag"
                        type="checkbox"
                        checked={bagTagRequested}
                        onChange={(e) => setBagTagRequested(e.target.checked)}
                      />
                    </label>
                    <label
                      htmlFor="checkin-biometric"
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-border p-3"
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        <ScanFace className="h-4 w-4 text-primary" /> Biometric Smart Travel Opt-in
                        (BIMS Hook)
                      </span>
                      <input
                        id="checkin-biometric"
                        type="checkbox"
                        checked={biometricConsent}
                        onChange={(e) => setBiometricConsent(e.target.checked)}
                      />
                    </label>
                  </div>

                  <Button
                    size="lg"
                    className="mt-5 w-full rounded-xl font-display font-bold"
                    onClick={handleCompleteCheckIn}
                  >
                    {copy.completeCheckIn}
                  </Button>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-gold/50 bg-gold/10 p-5">
                  <h3 className="font-display text-lg font-bold">Last-Minute Check-In Upgrades</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Airport-day offers updated directly on your booking.
                  </p>
                  <label
                    htmlFor="checkin-pay-miles"
                    className="mt-3 flex items-center gap-2 text-xs font-medium"
                  >
                    <input
                      id="checkin-pay-miles"
                      type="checkbox"
                      checked={payWithMiles}
                      onChange={(e) => setPayWithMiles(e.target.checked)}
                    />
                    Pay with Sindbad Miles ({sindbadMiles.toLocaleString()} mi)
                  </label>
                  <div className="mt-4 space-y-2.5">
                    <Button
                      variant="secondary"
                      className="w-full justify-between"
                      onClick={() => handleCheckInUpgrade("biz")}
                    >
                      <span>Instant Business Class Upgrade</span>
                      <strong>{payWithMiles ? "46,000 mi" : formatMoney(115, currency)}</strong>
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full justify-between"
                      onClick={() => handleCheckInUpgrade("bag")}
                    >
                      <span>Extra 10 kg Bag</span>
                      <strong>{payWithMiles ? "5,600 mi" : formatMoney(14, currency)}</strong>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-success">
                  <CheckCircle2 className="h-5 w-5" /> Checked In · Gate {booking.gate} · Terminal{" "}
                  {booking.terminal}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive"
                  onClick={handleUndoCheckIn}
                >
                  <Undo2 className="h-3.5 w-3.5" /> {copy.undoCheckIn}
                </Button>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {booking.passengers.map((p, idx) => {
                  const bcbp = buildIataBcbpString({
                    firstName: p.firstName,
                    lastName: p.lastName,
                    rloc: booking.rloc,
                    origin: booking.origin,
                    destination: booking.destination,
                    flightNumber: booking.flightNumber,
                    dateISO: booking.dateISO,
                    seat: p.seat,
                    seq: idx + 1,
                  });
                  return (
                    <div
                      key={idx}
                      className="overflow-hidden rounded-2xl border border-border bg-card shadow-md"
                    >
                      <div className="flex items-center justify-between bg-teal-deep px-5 py-3.5 text-teal-deep-foreground">
                        <div>
                          <p className="font-display text-xs font-bold tracking-[0.2em] text-gold">
                            OMAN AIR · BOARDING PASS
                          </p>
                          <p className="font-display text-lg font-extrabold">
                            {p.firstName} {p.lastName}
                          </p>
                        </div>
                        <span className="rounded-lg bg-gold px-2.5 py-1 text-xs font-extrabold text-gold-foreground">
                          {booking.flightNumber}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 p-5 text-sm">
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">Route</p>
                          <p className="font-display text-xl font-extrabold text-primary">
                            {booking.origin} → {booking.destination}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">Seat / Gate</p>
                          <p className="font-display text-xl font-extrabold">
                            {p.seat} · {booking.gate}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">Departure</p>
                          <p className="font-display text-xl font-extrabold">
                            {booking.departureTime}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-dashed border-border bg-muted/30 px-5 py-4">
                        <div className="text-xs space-y-1 min-w-0">
                          <p className="font-semibold">
                            RLOC: {booking.rloc} · Seq 00{idx + 1}
                          </p>
                          {p.bagTagNumber && (
                            <p className="text-muted-foreground">
                              Digital Bag Tag: {p.bagTagNumber}
                            </p>
                          )}
                          {booking.biometricOptIn && (
                            <p className="font-semibold text-primary">Biometric Opt-in Recorded</p>
                          )}
                          <p
                            className="truncate font-mono text-xs text-muted-foreground"
                            title={bcbp}
                          >
                            BCBP: {bcbp}
                          </p>
                        </div>
                        <ScannableQrCode
                          value={bcbp}
                          label={`IATA BCBP QR Barcode for ${p.firstName} ${p.lastName}`}
                          sizeClass="h-24 w-24"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 border-t border-border p-3.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-1 gap-1.5 text-xs"
                          onClick={() => handleDownloadWalletPass(p, bcbp)}
                        >
                          <Smartphone className="h-3.5 w-3.5" /> {copy.addToWallet}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1.5 text-xs"
                          onClick={() => window.print()}
                        >
                          <Download className="h-3.5 w-3.5" /> {copy.printPdf}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
