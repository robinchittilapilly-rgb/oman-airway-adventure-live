import { Briefcase, Check, ShieldCheck, Sparkles, Utensils, Accessibility } from "lucide-react";
import {
  DIRECT_ANCILLARIES,
  MEAL_OPTIONS,
  SSR_OPTIONS,
  VIRTUAL_BUNDLES,
} from "../../data/ancillariesAndSeats";
import { formatMoney, type FareBrandId } from "../../data/omanAirRoutes";
import {
  calculateTotalBaggageKg,
  computeAncillaryPriceOMR,
  isAncillaryEligibleForRoute,
} from "../../lib/ibe-rules";
import { useIBE } from "../../context/IBEContext";

interface AncillariesPanelProps {
  fareBrand: FareBrandId;
  isLongHaul: boolean;
  baggageGenerousRoute?: boolean | undefined;
  selectedBundleIds: string[];
  selectedAncillaryIds: string[];
  selectedMealId: string;
  selectedSsrIds: string[];
  insuranceChoice: "unset" | "yes" | "no";
  onToggleBundle: (id: string) => void;
  onToggleAncillary: (id: string) => void;
  onSelectMeal: (id: string) => void;
  onToggleSsr: (id: string) => void;
  onInsuranceChoice: (c: "yes" | "no") => void;
}

export function AncillariesPanel({
  fareBrand,
  isLongHaul,
  baggageGenerousRoute,
  selectedBundleIds,
  selectedAncillaryIds,
  selectedMealId,
  selectedSsrIds,
  insuranceChoice,
  onToggleBundle,
  onToggleAncillary,
  onSelectMeal,
  onToggleSsr,
  onInsuranceChoice,
}: AncillariesPanelProps) {
  const { currency, sindbadTier, lang } = useIBE();
  const bagCalc = calculateTotalBaggageKg({
    fareBrand,
    baggageGenerousRoute,
    tier: sindbadTier,
    selectedBundleIds,
    selectedAncillaryIds,
  });

  const eligibleAncillaries = DIRECT_ANCILLARIES.filter((item) =>
    isAncillaryEligibleForRoute(item.id, isLongHaul)
  );

  return (
    <div className="space-y-6">
      {/* Virtual Bundles (FR-84, FR-117) */}
      <section className="rounded-2xl border border-gold/50 bg-gold/5 p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold">
              <Sparkles className="h-5 w-5 text-primary" />
              {lang === "ar"
                ? "الباقات الافتراضية الذكية (إعفاء تلقائي للرسوم)"
                : "Dynamic Virtual Bundles (Auto-Waives Individual Fees)"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {lang === "ar"
                ? "تدمج الباقة المقعد والأمتعة وتلغي رسوم الخدمات المشمولة تلقائياً."
                : "Combines add-ons into one offer and automatically zeros out overlapping seat & bag fees."}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {VIRTUAL_BUNDLES.map((b) => {
            const active = selectedBundleIds.includes(b.id);
            return (
              <button
                key={b.id}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleBundle(b.id)}
                className={`flex flex-col justify-between rounded-xl border p-4 text-start transition-all ${
                  active
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border bg-card hover:border-primary/60"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-bold">{lang === "ar" ? b.nameAr : b.name}</span>
                    {b.badge && (
                      <span className="rounded-full bg-gold/25 px-2.5 py-0.5 text-xs font-bold text-foreground">
                        {b.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{b.description}</p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-display text-base font-bold text-primary">
                    {formatMoney(b.priceOMR, currency)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold">
                    {active ? <><Check className="h-3.5 w-3.5 text-success" /> Added</> : "Add Bundle"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Baggage Calculator + Contextual Direct Ancillaries */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-display text-lg font-bold">
                {lang === "ar" ? "حاسبة الأمتعة والخدمات الإضافية" : "Total Baggage Allowance & Ancillaries"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Fare: {bagCalc.includedKg} kg · Sindbad {sindbadTier}: +{bagCalc.tierBonusKg} kg · Added: +{bagCalc.purchasedKg} kg
                {isLongHaul ? " · Long-haul offers unlocked" : ""}
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-primary px-4 py-2 text-primary-foreground">
            <span className="font-display text-lg font-bold">{bagCalc.totalKg} kg</span>
            <span className="ms-1.5 text-xs opacity-85">checked</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {eligibleAncillaries.map((item) => {
            const active = selectedAncillaryIds.includes(item.id);
            const pricing = computeAncillaryPriceOMR({
              ancillaryId: item.id,
              tier: sindbadTier,
              selectedBundleIds,
            });
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleAncillary(item.id)}
                className={`flex flex-col justify-between rounded-xl border p-3.5 text-start transition-all ${
                  active ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold">{lang === "ar" ? item.nameAr : item.name}</p>
                    {item.badge && (
                      <span className="rounded bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {pricing.priceOMR === 0 ? (
                    <span className="rounded bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
                      Free · {pricing.waivedReason}
                    </span>
                  ) : (
                    <span className="font-display text-sm font-bold text-primary">
                      {formatMoney(pricing.priceOMR, currency)}
                    </span>
                  )}
                  <span className="text-xs font-semibold">{active ? "✓ Selected" : "+ Add"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Meals & SSRs */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-bold">
            <Utensils className="h-4 w-4 text-primary" />
            {lang === "ar" ? "اختيار الوجبات على متن الطائرة" : "In-Flight Dining Selection"}
          </h3>
          <div className="mt-3 space-y-2">
            {MEAL_OPTIONS.map((m) => (
              <label
                key={m.id}
                htmlFor={`meal-${m.id}`}
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-xs ${
                  selectedMealId === m.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    id={`meal-${m.id}`}
                    type="radio"
                    name="meal"
                    checked={selectedMealId === m.id}
                    onChange={() => onSelectMeal(m.id)}
                  />
                  <div>
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-muted-foreground">{m.note}</p>
                  </div>
                </div>
                <span className="font-bold text-primary">
                  {m.priceOMR === 0 ? "Free" : formatMoney(m.priceOMR, currency)}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 font-display text-base font-bold">
              <Accessibility className="h-4 w-4 text-primary" />
              {lang === "ar" ? "طلبات الخدمة الخاصة (SSR)" : "Special Service Requests (SSR)"}
            </h3>
            <div className="mt-3 space-y-2">
              {SSR_OPTIONS.map((ssr) => {
                const checked = selectedSsrIds.includes(ssr.id);
                return (
                  <label
                    key={ssr.id}
                    htmlFor={`ssr-${ssr.id}`}
                    className="flex cursor-pointer items-start justify-between gap-2 rounded-xl border border-border p-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        id={`ssr-${ssr.id}`}
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleSsr(ssr.id)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="font-semibold">{ssr.name} ({ssr.code})</p>
                        <p className="text-muted-foreground">{ssr.note}</p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${
                        ssr.status === "HK" ? "bg-success/15 text-success" : "bg-warning/20 text-warning-foreground"
                      }`}
                    >
                      {ssr.status === "HK" ? "HK (Demo)" : "PN (Demo)"}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-primary/40 bg-secondary/40 p-5">
            <h3 className="flex items-center gap-2 font-display text-base font-bold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {lang === "ar" ? "تأمين السفر (اختيار إلزامي)" : "Oman Air Travel Protection (Required Selection)"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Demo 3rd-party coverage up to $150,000 medical & baggage delay ({formatMoney(12, currency)}).
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                aria-pressed={insuranceChoice === "yes"}
                onClick={() => onInsuranceChoice("yes")}
                className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                  insuranceChoice === "yes"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary"
                }`}
              >
                Yes, Protect My Trip (+{formatMoney(12, currency)})
              </button>
              <button
                type="button"
                aria-pressed={insuranceChoice === "no"}
                onClick={() => onInsuranceChoice("no")}
                className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                  insuranceChoice === "no"
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card hover:border-foreground"
                }`}
              >
                No, I Decline Protection
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
