import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpCircle,
  CalendarClock,
  CheckCircle2,
  Gift,
  RefreshCw,
  Scissors,
  Search,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useIBE } from "../context/IBEContext";
import {
  FARE_BRANDS,
  findRouteForPair,
  formatMoney,
  get30DayFareRepository,
  getDateISO,
} from "../data/omanAirRoutes";
import {
  computeExchangeQuote,
  computeRefundQuote,
  generateRLOC,
  getMilesUpgradeOption,
  isHoldExpired,
} from "../lib/ibe-rules";
import { t } from "../lib/i18n";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/manage")({
  head: () => ({
    meta: [
      { title: "Manage My Booking & IRROPS | Oman Air" },
      { name: "description", content: "Retrieve your Oman Air booking, rebook disrupted flights, add bags or miles upgrades, split PNR, or request refunds." },
      { property: "og:title", content: "Manage My Booking | Oman Air" },
      { property: "og:description", content: "Self-service Oman Air booking management, IRROPS re-accommodation, upgrades, and refunds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManageBookingPage,
});

function ManageBookingPage() {
  const {
    bookings,
    updateBooking,
    addBooking,
    addTravelBank,
    spendMiles,
    sindbadMiles,
    sindbadSignedIn,
    currency,
    lang,
  } = useIBE();
  const copy = t(lang).manage;

  const initialBooking = bookings[0];
  const [rlocInput, setRlocInput] = useState(initialBooking?.rloc ?? "WY7K9M");
  const [lastNameInput, setLastNameInput] = useState(initialBooking?.passengers[0]?.lastName ?? "ALBALUSHI");
  const [activeRloc, setActiveRloc] = useState<string>(initialBooking?.rloc ?? "WY7K9M");
  const [newDate, setNewDate] = useState(getDateISO(5));
  const [bidAmount, setBidAmount] = useState("95");
  const [payAddonsWithMiles, setPayAddonsWithMiles] = useState(false);

  const booking = bookings.find((b) => b.rloc.toUpperCase() === activeRloc.toUpperCase());
  const holdExpired = booking?.status === "HELD" && isHoldExpired(booking.holdExpiresAt);
  const refundQuote = booking ? computeRefundQuote({ fareBrand: booking.fareBrand, totalPaidOMR: booking.totalPaidOMR }) : null;
  const milesUpgrade = booking ? getMilesUpgradeOption(booking.fareBrand) : null;

  const exchangeQuote = (() => {
    if (!booking) return null;
    const match = findRouteForPair(booking.origin, booking.destination);
    if (!match) return computeExchangeQuote({ fareBrand: booking.fareBrand, oldFareOMR: 100, newFareOMR: 100 });
    const repo = get30DayFareRepository(match.route.id);
    const oldDay = repo.find((d) => d.dateISO === booking.dateISO) ?? repo[0]!;
    const newDay = repo.find((d) => d.dateISO === newDate) ?? repo[0]!;
    return computeExchangeQuote({
      fareBrand: booking.fareBrand,
      oldFareOMR: oldDay.pricesOMR[booking.fareBrand],
      newFareOMR: newDay.pricesOMR[booking.fareBrand],
    });
  })();

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const rlocClean = rlocInput.trim().toUpperCase();
    const lastClean = lastNameInput.trim().toUpperCase();
    if (!rlocClean || !lastClean) {
      toast.error("Please enter both your 6-character RLOC and passenger last name.");
      return;
    }
    const found = bookings.find(
      (b) =>
        b.rloc.toUpperCase() === rlocClean &&
        b.passengers.some((p) => p.lastName.toUpperCase() === lastClean)
    );
    if (!found) {
      toast.error("Booking not found for that RLOC + Last Name pair.");
      return;
    }
    setActiveRloc(found.rloc);
    toast.success(`Retrieved PNR ${found.rloc}`);
  };

  const handleSettleHold = () => {
    if (!booking || holdExpired) return;
    updateBooking(booking.rloc, (prev) => ({
      ...prev,
      status: "CONFIRMED",
      paymentMethod: "Settled Held Booking (Demo)",
    }));
    toast.success(`Held PNR ${booking.rloc} ticketed and confirmed!`);
  };

  const handleIrropsRebook = (flightNo: string, depTime: string, arrTime: string) => {
    if (!booking) return;
    updateBooking(booking.rloc, (prev) => {
      const { disruptionNote: _removed, ...rest } = prev;
      return {
        ...rest,
        status: "CONFIRMED",
        flightNumber: flightNo,
        departureTime: depTime,
        arrivalTime: arrTime,
      };
    });
    toast.success(`Complimentary IRROPS re-accommodation confirmed onto ${flightNo}!`);
  };

  const handleIrropsVoucher = () => {
    if (!booking) return;
    addTravelBank(booking.totalPaidOMR + 25);
    updateBooking(booking.rloc, (prev) => ({ ...prev, status: "VOUCHERED" }));
    toast.success("Hotel + Meal Voucher & Travel Bank credit recorded (Demo)!");
  };

  const handleDateExchange = () => {
    if (!booking || !exchangeQuote) return;
    updateBooking(booking.rloc, (prev) => ({
      ...prev,
      dateISO: newDate,
      totalPaidOMR: prev.totalPaidOMR + exchangeQuote.totalDueOMR,
    }));
    toast.success(
      `Flight exchanged to ${newDate} (Fee ${formatMoney(exchangeQuote.changeFeeOMR, currency)} + Fare diff ${formatMoney(exchangeQuote.fareDifferenceOMR, currency)}).`
    );
  };

  const handlePostTicketingAdd = (label: string, priceOMR: number) => {
    if (!booking) return;
    const milesCost = priceOMR * 400;
    if (payAddonsWithMiles && priceOMR > 0) {
      if (!sindbadSignedIn || !spendMiles(milesCost)) {
        toast.error(`Need ${milesCost.toLocaleString()} Sindbad miles (signed in) to redeem this add-on.`);
        return;
      }
      updateBooking(booking.rloc, (prev) => ({
        ...prev,
        ancillaries: prev.ancillaries.includes(label) ? prev.ancillaries : [...prev.ancillaries, `${label} (Miles)`],
      }));
      toast.success(`Demo add-on recorded: ${label} for ${milesCost.toLocaleString()} miles.`);
      return;
    }
    updateBooking(booking.rloc, (prev) => ({
      ...prev,
      ancillaries: prev.ancillaries.includes(label) ? prev.ancillaries : [...prev.ancillaries, label],
      totalPaidOMR: prev.totalPaidOMR + priceOMR,
    }));
    toast.success(`Demo add-on recorded for ${label} (${formatMoney(priceOMR, currency)}).`);
  };

  const handleMilesUpgrade = () => {
    if (!booking || !milesUpgrade?.eligible || !milesUpgrade.targetBrand) return;
    if (!sindbadSignedIn) {
      toast.error("Sign in to Sindbad to redeem a miles upgrade.");
      return;
    }
    if (!spendMiles(milesUpgrade.milesRequired)) {
      toast.error(`Insufficient miles: need ${milesUpgrade.milesRequired.toLocaleString()} mi.`);
      return;
    }
    const nextBrand = milesUpgrade.targetBrand;
    updateBooking(booking.rloc, (prev) => ({
      ...prev,
      fareBrand: nextBrand,
      ancillaries: [...prev.ancillaries, `Miles Upgrade → ${FARE_BRANDS[nextBrand].name}`],
    }));
    toast.success(`Upgraded to ${FARE_BRANDS[nextBrand].name} for ${milesUpgrade.milesRequired.toLocaleString()} Sindbad miles!`);
  };

  const handleSplitPnr = () => {
    if (!booking || booking.passengers.length < 2) return;
    const paxCount = booking.passengers.length;
    const splitShare = Math.round(booking.totalPaidOMR / paxCount);
    const remainingShare = Math.max(0, booking.totalPaidOMR - splitShare);
    const splitPax = booking.passengers[paxCount - 1]!;
    const childRloc = generateRLOC();

    updateBooking(booking.rloc, (prev) => ({
      ...prev,
      passengers: prev.passengers.slice(0, -1),
      totalPaidOMR: remainingShare,
    }));
    addBooking({
      ...booking,
      rloc: childRloc,
      passengers: [splitPax],
      totalPaidOMR: splitShare,
    });
    toast.success(`Split PNR complete! ${splitPax.firstName} moved to ${childRloc} (${formatMoney(splitShare, currency)}).`);
  };

  const handleRefund = (toVoucher: boolean) => {
    if (!booking || !refundQuote) return;
    if (toVoucher) {
      addTravelBank(refundQuote.voucherRefundOMR);
      updateBooking(booking.rloc, (prev) => ({ ...prev, status: "VOUCHERED" }));
      toast.success(`${formatMoney(refundQuote.voucherRefundOMR, currency)} credited to Travel Bank (Demo).`);
    } else {
      if (!refundQuote.cashRefundEligible) {
        toast.error("This non-refundable Saver fare is ineligible for card refund per ATPCO brand rules.");
        return;
      }
      updateBooking(booking.rloc, (prev) => ({ ...prev, status: "REFUNDED" }));
      toast.success(`Demo refund of ${formatMoney(refundQuote.cashRefundOMR, currency)} recorded (fee: ${formatMoney(refundQuote.cancellationFeeOMR, currency)}).`);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-extrabold">{copy.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>

      {/* Retrieval Bar requiring RLOC + Last Name */}
      <form onSubmit={handleLookup} className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-4">
        <div>
          <label htmlFor="mmb-rloc" className="mb-1 block text-xs font-semibold text-muted-foreground">Booking Reference (RLOC)</label>
          <input
            id="mmb-rloc"
            value={rlocInput}
            onChange={(e) => setRlocInput(e.target.value.toUpperCase())}
            placeholder={copy.rlocPlaceholder}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold uppercase"
          />
        </div>
        <div>
          <label htmlFor="mmb-lastname" className="mb-1 block text-xs font-semibold text-muted-foreground">Passenger Last Name</label>
          <input
            id="mmb-lastname"
            value={lastNameInput}
            onChange={(e) => setLastNameInput(e.target.value.toUpperCase())}
            placeholder={copy.lastNamePlaceholder}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm uppercase"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="h-11 w-full gap-2 rounded-xl font-display font-bold">
            <Search className="h-4 w-4" /> {copy.retrieve}
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-1.5">
          {bookings.slice(0, 3).map((b) => (
            <button
              key={b.rloc}
              type="button"
              onClick={() => {
                setRlocInput(b.rloc);
                setLastNameInput(b.passengers[0]?.lastName ?? "");
                setActiveRloc(b.rloc);
              }}
              className={`rounded-lg border px-2.5 py-2 text-xs font-bold ${
                activeRloc === b.rloc ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/50"
              }`}
            >
              {b.rloc} {b.status === "DISRUPTED_CXL" ? "⚠" : ""}
            </button>
          ))}
        </div>
      </form>

      {booking && (
        <div className="mt-6 space-y-6">
          {/* Hold Expiry Banner (FR-74) */}
          {booking.status === "HELD" && (
            <div className={`rounded-2xl border-2 p-5 ${holdExpired ? "border-destructive bg-destructive/5" : "border-gold bg-gold/10"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold">
                    {holdExpired ? "Fare Hold Expired" : "Fare Hold Active"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {booking.holdExpiresAt ? `Hold expiry: ${new Date(booking.holdExpiresAt).toLocaleString()}` : "Hold window active"}
                  </p>
                </div>
                {!holdExpired && (
                  <Button onClick={handleSettleHold} className="rounded-xl font-display font-bold">
                    Pay & Issue Ticket Now
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* IRROPS Banner */}
          {booking.status === "DISRUPTED_CXL" && (
            <div className="rounded-2xl border-2 border-destructive bg-destructive/5 p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-6 w-6 text-destructive" />
                <div className="flex-1">
                  <h2 className="font-display text-xl font-bold text-destructive">
                    Involuntary Flight Disruption — Fee Waiver Active (Demo)
                  </h2>
                  <p className="mt-1 text-sm text-foreground">{booking.disruptionNote}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => handleIrropsRebook("WY 607", "14:15", "15:25")}
                      className="rounded-xl border border-primary bg-card p-3.5 text-start hover:bg-primary/5"
                    >
                      <p className="text-xs font-bold text-primary">Option 1 · Free Re-protection</p>
                      <p className="mt-1 font-display text-base font-bold">WY 607 · Today 14:15 → 15:25</p>
                      <p className="text-xs text-success font-semibold">OMR 0.000 (Fee Waived)</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleIrropsRebook("WY 611", "19:40", "20:50")}
                      className="rounded-xl border border-primary bg-card p-3.5 text-start hover:bg-primary/5"
                    >
                      <p className="text-xs font-bold text-primary">Option 2 · Evening Departure</p>
                      <p className="mt-1 font-display text-base font-bold">WY 611 · Today 19:40 → 20:50</p>
                      <p className="text-xs text-success font-semibold">OMR 0.000 (Fee Waived)</p>
                    </button>
                    <button
                      type="button"
                      onClick={handleIrropsVoucher}
                      className="rounded-xl border border-gold bg-gold/15 p-3.5 text-start hover:bg-gold/25"
                    >
                      <p className="text-xs font-bold">Option 3 · Care Voucher (Demo)</p>
                      <p className="mt-1 font-display text-base font-bold">Hotel + Meal + Travel Bank Credit</p>
                      <p className="text-xs text-muted-foreground">Instant demo voucher</p>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary Header */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-display text-2xl font-extrabold text-primary">{booking.rloc}</span>
                  <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                    booking.status === "CONFIRMED" ? "bg-success/15 text-success" :
                    booking.status === "DISRUPTED_CXL" || booking.status === "EXPIRED" ? "bg-destructive/15 text-destructive" :
                    "bg-warning/20 text-warning-foreground"
                  }`}>
                    {holdExpired ? "EXPIRED" : booking.status}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold">
                  {booking.flightNumber} · {booking.origin} → {booking.destination} · {booking.dateISO} ({booking.departureTime} – {booking.arrivalTime})
                </p>
                {booking.returnSegment && (
                  <p className="text-xs font-medium text-primary">
                    Leg 2 / Return: {booking.returnSegment.flightNumber} · {booking.returnSegment.origin} → {booking.returnSegment.destination} · {booking.returnSegment.dateISO} ({booking.returnSegment.departureTime} – {booking.returnSegment.arrivalTime})
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {booking.aircraft} · {FARE_BRANDS[booking.fareBrand].name} · Paid: {formatMoney(booking.totalPaidOMR, currency)} ({booking.paymentMethod})
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {booking.status === "CONFIRMED" && (
                  <Button asChild variant="secondary" size="sm" className="gap-1.5">
                    <Link to="/sindbad">
                      <Sparkles className="h-3.5 w-3.5" /> Claim Missing Miles
                    </Link>
                  </Button>
                )}
                {booking.passengers.length > 1 && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSplitPnr}>
                    <Scissors className="h-3.5 w-3.5" /> Split PNR ({booking.passengers.length} Guests)
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Passengers & Seats</h3>
                <div className="mt-2 space-y-2">
                  {booking.passengers.map((p, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-background p-3 text-xs">
                      <div>
                        <p className="font-bold">{p.firstName} {p.lastName} <span className="text-muted-foreground">({p.type})</span></p>
                        <p className="text-muted-foreground">Passport: {p.passport} · Seat {p.seat}</p>
                      </div>
                      <span className="font-semibold text-primary">{p.checkedIn ? "Checked In" : "Ticketed (Demo)"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Add-ons & SSR Status (Demo)</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {booking.ancillaries.map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                      <CheckCircle2 className="h-3 w-3 text-success" /> {a}
                    </span>
                  ))}
                  {booking.ssrs.map((s) => (
                    <span key={s.code} className="rounded-full border border-border px-3 py-1 text-xs font-semibold">
                      {s.name} ({s.code}: {s.status})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Self-Service Action Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Flight Exchange */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="flex items-center gap-2 font-display text-base font-bold">
                <CalendarClock className="h-4 w-4 text-primary" /> {copy.exchangeTitle}
              </h3>
              <label htmlFor="mmb-new-date" className="mt-2 block text-xs text-muted-foreground">
                New departure date
              </label>
              <input
                id="mmb-new-date"
                type="date"
                value={newDate}
                min={getDateISO(0)}
                max={getDateISO(29)}
                onChange={(e) => setNewDate(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
              {exchangeQuote && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Change fee: <strong>{formatMoney(exchangeQuote.changeFeeOMR, currency)}</strong> · Fare diff:{" "}
                  <strong>{formatMoney(exchangeQuote.fareDifferenceOMR, currency)}</strong>
                </p>
              )}
              <Button className="mt-3 w-full" onClick={handleDateExchange}>{copy.confirmExchange}</Button>
            </div>

            {/* Post-Ticketing Shop & Miles Upgrade (FR-104, FR-107, FR-125) */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="flex items-center gap-2 font-display text-base font-bold">
                <ShoppingBag className="h-4 w-4 text-primary" /> {copy.shopTitle}
              </h3>
              <label htmlFor="mmb-pay-miles" className="mt-2 flex items-center gap-2 text-xs font-medium">
                <input
                  id="mmb-pay-miles"
                  type="checkbox"
                  checked={payAddonsWithMiles}
                  onChange={(e) => setPayAddonsWithMiles(e.target.checked)}
                />
                Pay add-ons with Sindbad Miles ({sindbadMiles.toLocaleString()} mi)
              </label>
              <div className="mt-3 space-y-2">
                <Button variant="secondary" size="sm" className="w-full justify-between" onClick={() => handlePostTicketingAdd("+15 kg Post-Ticketing Bag", 20)}>
                  <span>+15 kg Extra Bag</span>
                  <strong>{payAddonsWithMiles ? "8,000 mi" : formatMoney(20, currency)}</strong>
                </Button>
                <Button variant="secondary" size="sm" className="w-full justify-between" onClick={() => handlePostTicketingAdd("Majan Lounge Pass", 24)}>
                  <span>Majan Lounge Access</span>
                  <strong>{payAddonsWithMiles ? "9,600 mi" : formatMoney(24, currency)}</strong>
                </Button>
                {milesUpgrade && (
                  <Button
                    variant={milesUpgrade.eligible ? "default" : "outline"}
                    size="sm"
                    disabled={!milesUpgrade.eligible}
                    onClick={handleMilesUpgrade}
                    className="w-full justify-between text-xs"
                  >
                    <span>
                      {milesUpgrade.eligible && milesUpgrade.targetBrand
                        ? `Miles Upgrade → ${FARE_BRANDS[milesUpgrade.targetBrand].name}`
                        : milesUpgrade.reason}
                    </span>
                    {milesUpgrade.eligible && <strong>{milesUpgrade.milesRequired.toLocaleString()} mi</strong>}
                  </Button>
                )}
                <div className="flex gap-1.5 pt-1">
                  <input
                    id="mmb-bid-amount"
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="h-9 w-24 rounded-lg border border-input bg-background px-2 text-xs font-bold"
                    aria-label="Upgrade bid amount OMR"
                  />
                  <Button size="sm" className="flex-1 gap-1 text-xs" onClick={() => handlePostTicketingAdd(`Upgrade Bid Submitted (OMR ${bidAmount} · Demo)`, 0)}>
                    <ArrowUpCircle className="h-3.5 w-3.5" /> Submit Bid (Demo)
                  </Button>
                </div>
              </div>
            </div>

            {/* Voluntary Refund / Voucher enforcing fare brand rules */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="flex items-center gap-2 font-display text-base font-bold">
                <RefreshCw className="h-4 w-4 text-primary" /> {copy.refundTitle}
              </h3>
              {refundQuote && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {refundQuote.cashRefundEligible
                    ? `Card refund: ${formatMoney(refundQuote.cashRefundOMR, currency)} (Fee: ${formatMoney(refundQuote.cancellationFeeOMR, currency)}).`
                    : `Saver fare is non-refundable to card; Travel Bank tax credit only (${formatMoney(refundQuote.voucherRefundOMR, currency)}).`}
                </p>
              )}
              <div className="mt-4 space-y-2">
                <Button variant="secondary" className="w-full gap-1.5" onClick={() => handleRefund(true)}>
                  <Gift className="h-4 w-4 text-primary" /> Credit Travel Bank ({formatMoney(refundQuote?.voucherRefundOMR ?? 0, currency)})
                </Button>
                <Button
                  variant="outline"
                  disabled={!refundQuote?.cashRefundEligible}
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => handleRefund(false)}
                >
                  Refund to Card ({formatMoney(refundQuote?.cashRefundOMR ?? 0, currency)})
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
