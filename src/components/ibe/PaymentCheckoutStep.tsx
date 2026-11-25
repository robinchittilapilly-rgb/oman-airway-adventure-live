import { useState } from "react";
import { Clock, CreditCard, Lock, ShieldCheck, Smartphone, Sparkles, Wallet } from "lucide-react";
import { formatMoney } from "../../data/omanAirRoutes";
import { useIBE } from "../../context/IBEContext";
import { Button } from "../ui/button";

export type PaymentMethodId = "card" | "lpm" | "wallet" | "bnpl" | "miles_cash";

interface PaymentCheckoutStepProps {
  baseFareOMR: number;
  taxesOMR: number;
  ancillariesOMR: number;
  promoDiscountOMR: number;
  totalOMR: number;
  earnedMiles: number;
  onConfirmPay: (details: {
    mode: "pay" | "hold";
    paymentLabel: string;
    milesUsed: number;
    travelBankUsedOMR: number;
    finalCashOMR: number;
  }) => void;
}

/**
 * FR-74 (Hold My Fare), FR-80 (Review & Breakdown), FR-92..100 (Global Cards,
 * OmanNet/Mada/KNET LPM, Apple/Google Pay, Tabby/Tamara BNPL, Miles+Cash & Travel Bank mFOP).
 */
export function PaymentCheckoutStep({
  baseFareOMR,
  taxesOMR,
  ancillariesOMR,
  promoDiscountOMR,
  totalOMR,
  earnedMiles,
  onConfirmPay,
}: PaymentCheckoutStepProps) {
  const { currency, sindbadMiles, travelBankOMR } = useIBE();
  const [method, setMethod] = useState<PaymentMethodId>("card");
  const [lpmChoice, setLpmChoice] = useState<"OmanNet" | "Mada" | "KNET">("OmanNet");
  const [bnplChoice, setBnplChoice] = useState<"Tabby" | "Tamara" | "Tasheel">("Tabby");
  const [useMilesSplit, setUseMilesSplit] = useState(false);
  const [useTravelBank, setUseTravelBank] = useState(false);
  const [holdMode, setHoldMode] = useState(false);
  const [holdHours, setHoldHours] = useState<24 | 48>(24);
  const [cardLast4, setCardLast4] = useState("4821");

  const maxMilesOMR = Math.min(totalOMR * 0.5, Math.floor(sindbadMiles / 400));
  const milesOffsetOMR = useMilesSplit || method === "miles_cash" ? maxMilesOMR : 0;
  const milesToBurn = Math.round(milesOffsetOMR * 400);

  const afterMiles = Math.max(0, totalOMR - milesOffsetOMR);
  const bankOffsetOMR = useTravelBank ? Math.min(afterMiles, travelBankOMR) : 0;
  const finalCashOMR = holdMode ? (holdHours === 24 ? 9 : 15) : Math.max(0, +(afterMiles - bankOffsetOMR).toFixed(3));

  const handleComplete = () => {
    if (holdMode) {
      onConfirmPay({
        mode: "hold",
        paymentLabel: `Hold My Fare (${holdHours}h Guarantee)`,
        milesUsed: 0,
        travelBankUsedOMR: 0,
        finalCashOMR,
      });
      return;
    }
    const label =
      method === "card"
        ? `Visa / Mastercard •••• ${cardLast4} (3DS2 Verified)`
        : method === "lpm"
          ? `${lpmChoice} Regional Debit`
          : method === "wallet"
            ? "Apple Pay / Google Pay"
            : method === "bnpl"
              ? `${bnplChoice} 4× Interest-Free Installments`
              : `Sindbad Miles (${milesToBurn.toLocaleString()} mi) + Card`;

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
        {/* Hold My Fare toggle (FR-74) */}
        <div className="rounded-2xl border border-gold/50 bg-gold/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <p className="font-display text-sm font-bold">Need Time to Think? Hold My Fare</p>
                <p className="text-xs text-muted-foreground">Lock this exact PNR and guaranteed fare for 24 or 48 hours.</p>
              </div>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold">
              <input type="checkbox" checked={holdMode} onChange={(e) => setHoldMode(e.target.checked)} />
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
            <h3 className="font-display text-lg font-bold">Select Payment Method (PCI-DSS & 3DS2)</h3>
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
                    <label className="mb-1 block text-xs font-semibold">Saved Card (Tokenized) or New Card</label>
                    <select
                      value={cardLast4}
                      onChange={(e) => setCardLast4(e.target.value)}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="4821">Visa Infinite •••• 4821 (Bank Muscat)</option>
                      <option value="9102">Mastercard World •••• 9102 (Saved)</option>
                      <option value="3004">AMEX Platinum •••• 3004 (Saved)</option>
                    </select>
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Simulated checkout · EMV 3-D Secure 2.0 & Accertify pre-auth risk scoring enabled.
                  </p>
                </div>
              )}

              {method === "lpm" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Regional GCC Payment Network</p>
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
                  One-touch biometric settlement via Apple Pay or Google Pay in {currency} with real-time MCP conversion.
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
                    4 interest-free monthly installments of <strong>{formatMoney(finalCashOMR / 4, currency)}</strong> via {bnplChoice}.
                  </p>
                </div>
              )}

              {method === "miles_cash" && (
                <p className="text-xs text-muted-foreground">
                  Multi-Form of Payment (mFOP): Burning <strong>{milesToBurn.toLocaleString()} Sindbad Miles</strong> (−{formatMoney(milesOffsetOMR, currency)}) + Card balance.
                </p>
              )}
            </div>

            {/* mFOP Split toggles (FR-98, FR-118) */}
            <div className="mt-4 flex flex-col gap-2 text-xs">
              {method !== "miles_cash" && (
                <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span>Apply Sindbad Miles split ({sindbadMiles.toLocaleString()} mi available)</span>
                  <input type="checkbox" checked={useMilesSplit} onChange={(e) => setUseMilesSplit(e.target.checked)} />
                </label>
              )}
              {travelBankOMR > 0 && (
                <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span>Apply Oman Air Travel Bank Voucher ({formatMoney(travelBankOMR, currency)} credit)</span>
                  <input type="checkbox" checked={useTravelBank} onChange={(e) => setUseTravelBank(e.target.checked)} />
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
            You will earn <strong>+{earnedMiles.toLocaleString()} Sindbad Miles</strong> on this itinerary.
          </div>

          <Button type="button" size="lg" className="mt-5 h-12 w-full gap-2 rounded-xl font-display text-sm font-bold" onClick={handleComplete}>
            <Lock className="h-4 w-4" />
            {holdMode ? `Hold Fare for ${holdHours}h (${formatMoney(finalCashOMR, currency)})` : `Pay & Issue Ticket (${formatMoney(finalCashOMR, currency)})`}
          </Button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Instant 6-character PNR & EMD fulfillment (Simulated PSS)
          </p>
        </div>
      </div>
    </div>
  );
}