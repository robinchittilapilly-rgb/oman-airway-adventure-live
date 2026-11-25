import { useState } from "react";
import { Clock, CreditCard, Lock, ShieldCheck, Smartphone, Sparkles, Wallet } from "lucide-react";
import { formatMoney } from "../../data/omanAirRoutes";
import { useIBE } from "../../context/IBEContext";
import { Button } from "../ui/button";

export type PaymentMethodId = "card" | "lpm" | "wallet" | "bnpl" | "miles_cash";

interface ItineraryReviewSummary {
  segments: { label: string; flightNumber: string; dateISO: string; times: string }[];
  passengers: { name: string; role: string; seat: string }[];
  fareBrandName: string;
  ancillaryNames: string[];
}

interface PaymentCheckoutStepProps {
  baseFareOMR: number;
  taxesOMR: number;
  ancillariesOMR: number;
  promoDiscountOMR: number;
  totalOMR: number;
  earnedMiles: number;
  reviewSummary?: ItineraryReviewSummary;
  onConfirmPay: (details: {
    mode: "pay" | "hold";
    holdHours?: 24 | 48;
    paymentLabel: string;
    milesUsed: number;
    travelBankUsedOMR: number;
    finalCashOMR: number;
  }) => void;
}

export function PaymentCheckoutStep({
  baseFareOMR,
  taxesOMR,
  ancillariesOMR,
  promoDiscountOMR,
  totalOMR,
  earnedMiles,
  reviewSummary,
  onConfirmPay,
}: PaymentCheckoutStepProps) {
  const { currency, sindbadMiles, sindbadSignedIn, travelBankOMR, lang } = useIBE();
  const [method, setMethod] = useState<PaymentMethodId>("card");
  const [lpmChoice, setLpmChoice] = useState<"OmanNet" | "Mada" | "KNET">("OmanNet");
  const [bnplChoice, setBnplChoice] = useState<"Tabby" | "Tamara" | "Tasheel">("Tabby");
  const [useMilesSplit, setUseMilesSplit] = useState(false);
  const [useTravelBank, setUseTravelBank] = useState(false);
  const [holdMode, setHoldMode] = useState(false);
  const [holdHours, setHoldHours] = useState<24 | 48>(24);
  const [cardChoice, setCardChoice] = useState("Visa Infinite •••• 4821");

  const maxMilesOMR = sindbadSignedIn ? Math.min(totalOMR * 0.5, Math.floor(sindbadMiles / 400)) : 0;
  const milesOffsetOMR = useMilesSplit || method === "miles_cash" ? maxMilesOMR : 0;
  const milesToBurn = Math.round(milesOffsetOMR * 400);

  const afterMiles = Math.max(0, totalOMR - milesOffsetOMR);
  const bankOffsetOMR = useTravelBank ? Math.min(afterMiles, travelBankOMR) : 0;
  const finalCashOMR = holdMode ? (holdHours === 24 ? 9 : 15) : Math.max(0, +(afterMiles - bankOffsetOMR).toFixed(3));

  const handleComplete = () => {
    if (holdMode) {
      onConfirmPay({
        mode: "hold",
        holdHours,
        paymentLabel: `Hold My Fare (${holdHours}h Guarantee · Demo)`,
        milesUsed: 0,
        travelBankUsedOMR: 0,
        finalCashOMR,
      });
      return;
    }
    const label =
      method === "card"
        ? `${cardChoice} (Simulated Checkout)`
        : method === "lpm"
          ? `${lpmChoice} Regional Debit (Demo)`
          : method === "wallet"
            ? "Apple Pay / Google Pay (Demo)"
            : method === "bnpl"
              ? `${bnplChoice} 4× Installments (Demo)`
              : `Sindbad Miles (${milesToBurn.toLocaleString()} mi) + Card (Demo)`;

    onConfirmPay({
      mode: "pay",
      paymentLabel: label,
      milesUsed: milesToBurn,
      travelBankUsedOMR: bankOffsetOMR,
      finalCashOMR,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-5 lg:col-span-7">
        {/* Consolidated Review Summary (FR-80) */}
        {reviewSummary && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-display text-lg font-bold">
              {lang === "ar" ? "مراجعة خط السير والمسافرين" : "Review Itinerary, Passengers & Add-Ons"}
            </h3>
            <div className="mt-3 space-y-2 text-xs">
              {reviewSummary.segments.map((seg, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between rounded-xl bg-muted/45 px-3 py-2">
                  <span className="font-bold">{seg.flightNumber} · {seg.label}</span>
                  <span className="text-muted-foreground">{seg.dateISO} · {seg.times}</span>
                </div>
              ))}
              <div className="pt-1">
                <p className="font-semibold text-muted-foreground">Fare Brand: <span className="text-foreground">{reviewSummary.fareBrandName}</span></p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {reviewSummary.passengers.map((p, idx) => (
                    <span key={idx} className="rounded-lg border border-border bg-background px-2.5 py-1 font-semibold">
                      {p.name} ({p.role}) · Seat {p.seat}
                    </span>
                  ))}
                </div>
                {reviewSummary.ancillaryNames.length > 0 && (
                  <p className="mt-2 text-muted-foreground">
                    Add-ons: <span className="font-semibold text-foreground">{reviewSummary.ancillaryNames.join(", ")}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hold My Fare toggle (FR-74) */}
        <div className="rounded-2xl border border-gold/50 bg-gold/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <p className="font-display text-sm font-bold">Need Time to Think? Hold My Fare</p>
                <p className="text-xs text-muted-foreground">Lock this PNR and fare for 24 or 48 hours before ticketing.</p>
              </div>
            </div>
            <label htmlFor="hold-mode-toggle" className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold">
              <input id="hold-mode-toggle" type="checkbox" checked={holdMode} onChange={(e) => setHoldMode(e.target.checked)} />
              Hold instead of paying now
            </label>
          </div>
          {holdMode && (
            <div className="mt-3 flex gap-2">
              {([24, 48] as const).map((hrs) => (
                <button
                  key={hrs}
                  type="button"
                  onClick={() => setHoldHours(hrs)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                    holdHours === hrs ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                  }`}
                >
                  {hrs} Hours · {formatMoney(hrs === 24 ? 9 : 15, currency)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Payment Methods */}
        {!holdMode && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-display text-lg font-bold">
              {lang === "ar" ? "اختر طريقة الدفع (محاكاة تجريبية)" : "Select Payment Method (Simulated Checkout)"}
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(
                [
                  { id: "card", label: "Cards", icon: CreditCard },
                  { id: "lpm", label: "OmanNet / Mada", icon: Wallet },
                  { id: "wallet", label: "Apple / GPay", icon: Smartphone },
                  { id: "bnpl", label: "Tabby / Tamara", icon: Clock },
                  { id: "miles_cash", label: "Miles + Cash", icon: Sparkles },
                ] as const
              ).map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-semibold transition-colors ${
                      method === m.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-border bg-muted/25 p-4 text-sm">
              {method === "card" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="payment-card-select" className="mb-1 block text-xs font-semibold">
                      Demo Card Scheme (Visa, Mastercard, AMEX, Diners, JCB)
                    </label>
                    <select
                      id="payment-card-select"
                      value={cardChoice}
                      onChange={(e) => setCardChoice(e.target.value)}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="Visa Infinite •••• 4821">Visa Infinite •••• 4821 (Bank Muscat Demo)</option>
                      <option value="Mastercard World •••• 9102">Mastercard World •••• 9102 (Demo)</option>
                      <option value="AMEX Platinum •••• 3004">AMEX Platinum •••• 3004 (Demo)</option>
                      <option value="Diners Club •••• 7710">Diners Club International •••• 7710 (Demo)</option>
                      <option value="JCB Ultimate •••• 5529">JCB Ultimate •••• 5529 (Demo)</option>
                    </select>
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Simulated prototype checkout — no real card charge, 3DS2 challenge, or live gateway call is performed.
                  </p>
                </div>
              )}

              {method === "lpm" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Regional GCC Payment Network (Demo)</p>
                  <div className="flex flex-wrap gap-2">
                    {(["OmanNet", "Mada", "KNET"] as const).map((net) => (
                      <button
                        key={net}
                        type="button"
                        onClick={() => setLpmChoice(net)}
                        className={`rounded-lg border px-4 py-2 text-xs font-bold ${
                          lpmChoice === net ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                        }`}
                      >
                        {net}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {method === "wallet" && (
                <p className="text-xs text-muted-foreground">
                  Demo Apple Pay / Google Pay preview in {currency} (no live OS wallet integration in this prototype).
                </p>
              )}

              {method === "bnpl" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {(["Tabby", "Tamara", "Tasheel"] as const).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBnplChoice(b)}
                        className={`rounded-lg border px-4 py-2 text-xs font-bold ${
                          bnplChoice === b ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Illustrative 4 installments of <strong>{formatMoney(finalCashOMR / 4, currency)}</strong> via {bnplChoice} (demo calculation).
                  </p>
                </div>
              )}

              {method === "miles_cash" && (
                <p className="text-xs text-muted-foreground">
                  {sindbadSignedIn
                    ? `Multi-Form of Payment (mFOP): Burning ${milesToBurn.toLocaleString()} Sindbad Miles (−${formatMoney(milesOffsetOMR, currency)}) + Card balance.`
                    : "Sign in to Sindbad to apply Miles + Cash split."}
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 text-xs">
              {method !== "miles_cash" && sindbadSignedIn && (
                <label htmlFor="miles-split-toggle" className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span>Apply Sindbad Miles split ({sindbadMiles.toLocaleString()} mi available)</span>
                  <input id="miles-split-toggle" type="checkbox" checked={useMilesSplit} onChange={(e) => setUseMilesSplit(e.target.checked)} />
                </label>
              )}
              {travelBankOMR > 0 && (
                <label htmlFor="travel-bank-toggle" className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span>Apply Oman Air Travel Bank Voucher ({formatMoney(travelBankOMR, currency)} credit)</span>
                  <input id="travel-bank-toggle" type="checkbox" checked={useTravelBank} onChange={(e) => setUseTravelBank(e.target.checked)} />
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Final Price Breakdown Summary (FR-80) */}
      <div className="lg:col-span-5">
        <div className="sticky top-24 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display text-lg font-bold">Fare & Price Breakdown</h3>
          <div className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base Airfare</span>
              <span className="font-semibold">{formatMoney(baseFareOMR, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Airport Taxes & Carrier Fees</span>
              <span className="font-semibold">{formatMoney(taxesOMR, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seats, Bundles & Ancillaries</span>
              <span className="font-semibold">{formatMoney(ancillariesOMR, currency)}</span>
            </div>
            {promoDiscountOMR > 0 && (
              <div className="flex justify-between text-success">
                <span>Promo Discount</span>
                <span className="font-bold">−{formatMoney(promoDiscountOMR, currency)}</span>
              </div>
            )}
            {milesOffsetOMR > 0 && !holdMode && (
              <div className="flex justify-between text-primary">
                <span>Sindbad Miles Applied ({milesToBurn.toLocaleString()} mi)</span>
                <span className="font-bold">−{formatMoney(milesOffsetOMR, currency)}</span>
              </div>
            )}
            {bankOffsetOMR > 0 && !holdMode && (
              <div className="flex justify-between text-primary">
                <span>Travel Bank Credit</span>
                <span className="font-bold">−{formatMoney(bankOffsetOMR, currency)}</span>
              </div>
            )}
            <div className="border-t border-border pt-3 flex items-baseline justify-between">
              <span className="font-display text-base font-bold">{holdMode ? "Hold Fee Due Now" : "Total Due Now"}</span>
              <span className="font-display text-2xl font-extrabold text-primary">
                {formatMoney(finalCashOMR, currency)}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-secondary/60 p-3 text-xs font-medium text-secondary-foreground">
            <Sparkles className="me-1.5 inline h-3.5 w-3.5 text-primary" />
            You will earn <strong>+{earnedMiles.toLocaleString()} Sindbad Miles</strong> (demo calculation).
          </div>

          <Button type="button" size="lg" className="mt-5 h-12 w-full gap-2 rounded-xl font-display text-sm font-bold" onClick={handleComplete}>
            <Lock className="h-4 w-4" />
            {holdMode ? `Hold Fare for ${holdHours}h (${formatMoney(finalCashOMR, currency)})` : `Complete Demo Booking (${formatMoney(finalCashOMR, currency)})`}
          </Button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Simulated PNR generation in browser storage (Prototype)
          </p>
        </div>
      </div>
    </div>
  );
}
