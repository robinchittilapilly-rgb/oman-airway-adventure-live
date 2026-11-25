import { useMemo } from "react";
import { generateSeatMap, type SeatCell } from "../../data/ancillariesAndSeats";
import { FARE_BRANDS, formatMoney, type FareBrandId } from "../../data/omanAirRoutes";
import { computeSeatFeeOMR } from "../../lib/ibe-rules";
import { useIBE } from "../../context/IBEContext";

interface SeatMapSelectorProps {
  aircraft: "Boeing 787-9 Dreamliner" | "Boeing 737 MAX 8";
  fareBrand: FareBrandId;
  selectedBundleIds: string[];
  selectedSeats: string[];
  maxSeats: number;
  onToggleSeat: (seat: SeatCell) => void;
}

export function SeatMapSelector({
  aircraft,
  fareBrand,
  selectedBundleIds,
  selectedSeats,
  maxSeats,
  onToggleSeat,
}: SeatMapSelectorProps) {
  const { currency, sindbadTier } = useIBE();
  const seats = useMemo(() => generateSeatMap(aircraft), [aircraft]);
  const activeCabin = FARE_BRANDS[fareBrand].cabin;

  const rows = useMemo(() => {
    const map = new Map<number, SeatCell[]>();
    seats
      .filter((s) => s.cabin === activeCabin)
      .forEach((s) => {
        const list = map.get(s.row) ?? [];
        list.push(s);
        map.set(s.row, list);
      });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [seats, activeCabin]);

  const getSeatStyle = (seat: SeatCell, isSelected: boolean) => {
    if (isSelected) return "bg-primary text-primary-foreground border-primary ring-2 ring-gold";
    if (seat.kind === "occupied") return "bg-muted text-muted-foreground/40 border-border cursor-not-allowed";
    if (seat.kind === "blocked_ffp") {
      return sindbadTier === "Gold"
        ? "bg-gold/25 text-foreground border-gold hover:bg-gold/40"
        : "bg-muted/70 text-muted-foreground border-dashed border-gold/60 cursor-not-allowed";
    }
    if (seat.kind === "exit") return "bg-warning/20 text-foreground border-warning/70 hover:bg-warning/35";
    if (seat.kind === "legroom") return "bg-secondary text-secondary-foreground border-primary/50 hover:bg-primary/20";
    if (seat.kind === "paid") return "bg-card text-foreground border-primary/40 hover:border-primary";
    return "bg-success/15 text-foreground border-success/50 hover:bg-success/25";
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-bold">Interactive 2D Seat Map · {aircraft}</h3>
          <p className="text-xs text-muted-foreground">
            Select up to {maxSeats} seat(s) in {FARE_BRANDS[fareBrand].name}.{" "}
            {sindbadTier === "Gold" && "Sindbad Gold unlocks FFP-blocked bulkhead seats & waives seat fees."}
          </p>
        </div>
        <div className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground">
          Selected: {selectedSeats.length > 0 ? selectedSeats.join(", ") : "None"}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 text-[11px] font-medium">
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-success/60 bg-success/15" /> Free</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-primary/50 bg-card" /> Paid Standard</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-primary/60 bg-secondary" /> Extra Legroom</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-warning/70 bg-warning/20" /> Exit Row</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-gold bg-gold/25" /> FFP Gold Priority</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-border bg-muted" /> Occupied</span>
      </div>

      {/* Fuselage Grid */}
      <div className="mt-5 overflow-x-auto">
        <div className="mx-auto inline-flex min-w-[300px] flex-col gap-2 rounded-3xl border-2 border-border bg-muted/25 px-5 py-6">
          <div className="mb-1 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Front of Cabin ↑
          </div>
          {rows.map(([rowNum, rowSeats]) => (
            <div key={rowNum} className="flex items-center justify-center gap-1.5">
              <span className="w-6 text-end text-xs font-bold text-muted-foreground">{rowNum}</span>
              {rowSeats.map((seat, idx) => {
                const isSelected = selectedSeats.includes(seat.id);
                const fee = computeSeatFeeOMR({
                  baseSeatPriceOMR: seat.priceOMR,
                  fareBrand,
                  tier: sindbadTier,
                  selectedBundleIds,
                });
                const disabled =
                  seat.kind === "occupied" ||
                  (seat.kind === "blocked_ffp" && sindbadTier !== "Gold");
                const aisleAfter =
                  (rowSeats.length === 9 && (idx === 2 || idx === 5)) ||
                  (rowSeats.length === 6 && idx === 2) ||
                  (rowSeats.length === 4 && idx === 1);

                return (
                  <div key={seat.id} className={`flex items-center ${aisleAfter ? "me-4" : ""}`}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onToggleSeat(seat)}
                      title={`${seat.id} · ${seat.kind.replace("_", " ")} · ${
                        fee.priceOMR === 0 ? (fee.waivedReason ?? "Free") : formatMoney(fee.priceOMR, currency)
                      }`}
                      className={`flex h-9 w-9 flex-col items-center justify-center rounded-lg border text-[11px] font-bold transition-all ${getSeatStyle(seat, isSelected)}`}
                    >
                      <span>{seat.col}</span>
                      {seat.kind !== "occupied" && (
                        <span className="text-[9px] font-normal opacity-80">
                          {fee.priceOMR === 0 ? "Free" : formatMoney(fee.priceOMR, currency).replace("OMR ", "")}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}