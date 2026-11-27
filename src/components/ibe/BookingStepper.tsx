interface BookingStepperProps {
  step: 1 | 2 | 3 | 4 | 5;
  origin: string;
  destination: string;
  departDate: string;
  totalPax: number;
  bffConnected: boolean;
  cartId: string | null;
  onSelectStep: (step: 1 | 2 | 3 | 4 | 5) => void;
}

const STEPS = [
  { n: 1, label: "1. Flights & Brands" },
  { n: 2, label: "2. Seats & Bundles" },
  { n: 3, label: "3. Passengers & APIS" },
  { n: 4, label: "4. Review & Pay" },
  { n: 5, label: "5. Confirmed" },
] as const;

export function BookingStepper({
  step,
  origin,
  destination,
  departDate,
  totalPax,
  bffConnected,
  cartId,
  onSelectStep,
}: BookingStepperProps) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        {STEPS.map((s) => (
          <button
            key={s.n}
            type="button"
            disabled={s.n > step || step === 5}
            onClick={() => onSelectStep(s.n)}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              step === s.n
                ? "bg-primary text-primary-foreground"
                : s.n < step
                  ? "bg-success/15 text-success hover:bg-success/25"
                  : "text-muted-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="text-xs font-bold text-primary">
        {origin} → {destination} · {departDate} · {totalPax} guest(s)
        {bffConnected && cartId ? ` · Cart ${cartId.slice(0, 10)}` : ""}
      </div>
    </div>
  );
}
