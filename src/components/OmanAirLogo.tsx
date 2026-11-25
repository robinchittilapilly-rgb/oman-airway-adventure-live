interface OmanAirLogoProps {
  inverted?: boolean;
  compact?: boolean;
}

export function OmanAirLogo({ inverted = false, compact = false }: OmanAirLogoProps) {
  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <svg viewBox="0 0 44 44" className="h-9 w-9 shrink-0" aria-hidden="true">
        <defs>
          <linearGradient id="omanGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.84 0.12 82)" />
            <stop offset="100%" stopColor="oklch(0.66 0.13 72)" />
          </linearGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="40"
          height="40"
          rx="11"
          fill={inverted ? "oklch(0.28 0.075 205)" : "oklch(0.36 0.088 205)"}
        />
        {/* Stylized Frankincense plume / Oman Air tail motif */}
        <path
          d="M12 31C17 27 21 20 22 10C25 17 24 25 18 31H12Z"
          fill="url(#omanGoldGrad)"
        />
        <path
          d="M21 31C26 26 29 19 31 12C33 19 31 27 25 31H21Z"
          fill="oklch(0.98 0.005 85)"
          opacity="0.92"
        />
      </svg>
      <div className="flex flex-col leading-none">
        <span
          className={`font-display text-base font-bold tracking-[0.14em] ${
            inverted ? "text-primary-foreground" : "text-primary"
          }`}
        >
          OMAN AIR
        </span>
        {!compact && (
          <span
            className={`mt-0.5 text-[11px] font-medium tracking-wide ${
              inverted ? "text-gold" : "text-muted-foreground"
            }`}
          >
            الطيران العماني · oneworld
          </span>
        )}
      </div>
    </div>
  );
}