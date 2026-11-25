import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";
import { toast } from "sonner";
import { useIBE } from "../context/IBEContext";
import { FARE_BRANDS, formatMoney, getDateISO } from "../data/omanAirRoutes";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/manage")({
  head: () => ({
    meta: [
      { title: "Manage My Booking & IRROPS | Oman Air" },
      { name: "description", content: "Retrieve your Oman Air booking, rebook disrupted flights for free, add bags or upgrades, split PNR, or request refunds." },
      { property: "og:title", content: "Manage My Booking | Oman Air" },
      { property: "og:description", content: "Self-service Oman Air booking management, IRROPS re-accommodation, upgrades, and refunds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManageBookingPage,
});

function ManageBookingPage() {
  const { bookings, updateBooking, addBooking, addTravelBank, currency } = useIBE();
  const [rlocInput, setRlocInput] = useState(bookings[0]?.rloc ?? "WY7K9M");
  const [lastNameInput, setLastNameInput] = useState("");
  const [activeRloc, setActiveRloc] = useState<string>(bookings[0]?.rloc ?? "WY7K9M");
  const [newDate, setNewDate] = useState(getDateISO(5));
  const [bidAmount, setBidAmount] = useState("95");

  const booking = bookings.find((b) => b.rloc.toUpperCase() === activeRloc.toUpperCase());

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const found = bookings.find(
      (b) =>
        b.rloc.toUpperCase() === rlocInput.trim().toUpperCase() &&
        (!lastNameInput.trim() ||
          b.passengers.some((p) => p.lastName.toUpperCase() === lastNameInput.trim().toUpperCase()))
    );
    if (!found) {
      toast.error("Booking not found. Try WY7K9M, WY4D2X (Disrupted), or your newly created RLOC.");
      return;
    }
    setActiveRloc(found.rloc);
    toast.success(`Retrieved PNR ${found.rloc}`);
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
    toast.success("Instant Hotel + Refreshment Voucher & Travel Bank credit issued!");
  };

  const handleDateExchange = () => {
    if (!booking) return;
    const fee = FARE_BRANDS[booking.fareBrand].changePolicy === "free" ? 0 : 18;
    updateBooking(booking.rloc, (prev) => ({
      ...prev,
      dateISO: newDate,
      totalPaidOMR: prev.totalPaidOMR + fee,
    }));
    toast.success(`Flight exchanged to ${newDate} (Change fee: ${formatMoney(fee, currency)}).`);
  };

  const handlePostTicketingAdd = (label: string, priceOMR: number) => {
    if (!booking) return;
    updateBooking(booking.rloc, (prev) => ({
      ...prev,
      ancillaries: prev.ancillaries.includes(label) ? prev.ancillaries : [...prev.ancillaries, label],
      totalPaidOMR: prev.totalPaidOMR + priceOMR,
    }));
    toast.success(`EMD issued for ${label} (${formatMoney(priceOMR, currency)}).`);
  };

  const handleSplitPnr = () => {
    if (!booking || booking.passengers.length < 2) return;
    const splitPax = booking.passengers[booking.passengers.length - 1]!;
    const childRloc = `WY${Math.floor(1000 + Math.random() * 8999)}`;
    updateBooking(booking.rloc, (prev) => ({
      ...prev,
      passengers: prev.passengers.slice(0, -1),
    }));
    addBooking({
      ...booking,
      rloc: childRloc,
      passengers: [splitPax],
    });
    toast.success(`Split PNR complete! ${splitPax.firstName} moved to new RLOC ${childRloc}.`);
  };

  const handleRefund = (toVoucher: boolean) => {
    if (!booking) return;
    if (toVoucher) {
      addTravelBank(booking.totalPaidOMR);
      updateBooking(booking.rloc, (prev) => ({ ...prev, status: "VOUCHERED" }));
      toast.success(`${formatMoney(booking.totalPaidOMR, currency)} credited to your Oman Air Travel Bank.`);
    } else {
      updateBooking(booking.rloc, (prev) => ({ ...prev, status: "REFUNDED" }));
      toast.success("Voluntary refund triggered back to original form of payment.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-extrabold">Manage My Booking (MMB) & Self-Service IRROPS</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Retrieve any PNR to modify dates, handle disruptions for free, purchase post-ticketing ancillaries, split passengers, or refund.
      </p>

      {/* Retrieval Bar */}
      <form onSubmit={handleLookup} className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-4">
        <input
          value={rlocInput}
          onChange={(e) => setRlocInput(e.target.value.toUpperCase())}
          placeholder="Booking Ref (RLOC) e.g. WY7K9M"
          className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-bold uppercase"
        />
        <input
          value={lastNameInput}
          onChange={(e) => setLastNameInput(e.target.value.toUpperCase())}
          placeholder="Last Name (Optional for demo)"
          className="h-11 rounded-xl border border-input bg-background px-3 text-sm uppercase"
        />
        <Button type="submit" className="h-11 gap-2 rounded-xl font-display font-bold">
          <Search className="h-4 w-4" /> Retrieve Booking
        </Button>
        <div className="flex flex-wrap items-center gap-1.5">
          {bookings.slice(0, 3).map((b) => (
            <button
              key={b.rloc}
              type="button"
              onClick={() => { setRlocInput(b.rloc); setActiveRloc(b.rloc); }}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
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
          {/* IRROPS Self-Service Disruption Banner (FR-5, FR-130) */}
          {booking.status === "DISRUPTED_CXL" && (
            <div className="rounded-2xl border-2 border-destructive bg-destructive/5 p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-6 w-6 text-destructive" />
                <div className="flex-1">
                  <h2 className="font-display text-xl font-bold text-destructive">
                    Involuntary Flight Disruption — Fee Waiver Active
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
                      <p className="text-xs font-bold">Option 3 · Instant Care Voucher</p>
                      <p className="mt-1 font-display text-base font-bold">Hotel + Meal + Full Credit</p>
                      <p className="text-xs text-muted-foreground">Instant digital voucher</p>
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
                    booking.status === "DISRUPTED_CXL" ? "bg-destructive/15 text-destructive" :
                    "bg-warning/20 text-warning-foreground"
                  }`}>
                    {booking.status}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold">
                  {booking.flightNumber} · {booking.origin} → {booking.destination} · {booking.dateISO} ({booking.departureTime} – {booking.arrivalTime})
                </p>
                <p className="text-xs text-muted-foreground">
                  {booking.aircraft} · {FARE_BRANDS[booking.fareBrand].name} · Paid: {formatMoney(booking.totalPaidOMR, currency)} ({booking.paymentMethod})
                </p>
              </div>
              {booking.passengers.length > 1 && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSplitPnr}>
                  <Scissors className="h-3.5 w-3.5" /> Split PNR ({booking.passengers.length} Guests)
                </Button>
              )}
            </div>

            {/* Passengers & SSRs */}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Passengers & Seats</h3>
                <div className="mt-2 space-y-2">
                  {booking.passengers.map((p, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-background p-3 text-xs">
                      <div>
                        <p className="font-bold">{p.firstName} {p.lastName}</p>
                        <p className="text-muted-foreground">Passport: {p.passport} · Seat {p.seat}</p>
                      </div>
                      <span className="font-semibold text-primary">{p.checkedIn ? "Checked In" : "Ticketed"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">EMDs, Ancillaries & SSR Status</h3>
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
                <CalendarClock className="h-4 w-4 text-primary" /> Exchange Flight Date
              </h3>
              <input
                type="date"
                value={newDate}
                min={getDateISO(0)}
                max={getDateISO(29)}
                onChange={(e) => setNewDate(e.target.value)}
                className="mt-3 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
              <Button className="mt-3 w-full" onClick={handleDateExchange}>Confirm Date Change</Button>
            </div>

            {/* Post-Ticketing Shop & Upgrade */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="flex items-center gap-2 font-display text-base font-bold">
                <ShoppingBag className="h-4 w-4 text-primary" /> Post-Ticketing Shop & Upgrade
              </h3>
              <div className="mt-3 space-y-2">
                <Button variant="secondary" size="sm" className="w-full justify-between" onClick={() => handlePostTicketingAdd("+15 kg Post-Ticketing Bag", 20)}>
                  <span>+15 kg Extra Bag (EMD)</span>
                  <strong>{formatMoney(20, currency)}</strong>
                </Button>
                <Button variant="secondary" size="sm" className="w-full justify-between" onClick={() => handlePostTicketingAdd("Majan Lounge Pass", 24)}>
                  <span>Majan Lounge Access</span>
                  <strong>{formatMoney(24, currency)}</strong>
                </Button>
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="h-9 w-24 rounded-lg border border-input bg-background px-2 text-xs font-bold"
                    aria-label="Upgrade bid amount OMR"
                  />
                  <Button size="sm" className="flex-1 gap-1 text-xs" onClick={() => handlePostTicketingAdd(`Business Upgrade Bid (OMR ${bidAmount})`, 0)}>
                    <ArrowUpCircle className="h-3.5 w-3.5" /> Bid Upgrade
                  </Button>
                </div>
              </div>
            </div>

            {/* Voluntary Refund / Voucher */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="flex items-center gap-2 font-display text-base font-bold">
                <RefreshCw className="h-4 w-4 text-primary" /> Voluntary Refund & Travel Bank
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Cancel and receive a refund to your original card or instant Oman Air Travel Bank credit.
              </p>
              <div className="mt-4 space-y-2">
                <Button variant="secondary" className="w-full gap-1.5" onClick={() => handleRefund(true)}>
                  <Gift className="h-4 w-4 text-primary" /> Refund to Travel Bank Voucher
                </Button>
                <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={() => handleRefund(false)}>
                  Refund to Original Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}