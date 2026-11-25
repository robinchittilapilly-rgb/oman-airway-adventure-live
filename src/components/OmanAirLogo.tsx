import omanAirLogo from "../assets/oman-air-logo.png";

interface OmanAirLogoProps {
  inverted?: boolean;
  compact?: boolean;
}

export function OmanAirLogo({ inverted = false, compact = false }: OmanAirLogoProps) {
  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <div
        className={
          inverted
            ? "inline-flex items-center rounded-lg bg-white/95 px-2.5 py-1 shadow-xs"
            : "inline-flex items-center"
        }
      >
        <img
          src={omanAirLogo}
          alt="Oman Air · الطيران العُماني"
          width={1024}
          height={251}
          className={compact ? "h-7 w-auto object-contain" : "h-9 w-auto object-contain"}
        />
      </div>
      {!compact && (
        <span
          className={`hidden border-s border-border ps-2.5 text-xs font-semibold tracking-wide sm:inline-block ${
            inverted ? "border-teal-deep-foreground/30 text-gold" : "text-muted-foreground"
          }`}
        >
          oneworld
        </span>
      )}
    </div>
  );
}
