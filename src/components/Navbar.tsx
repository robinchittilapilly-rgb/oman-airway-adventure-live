import { Link, useRouterState } from "@tanstack/react-router";
import { Globe, Menu, ShieldAlert, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useIBE } from "../context/IBEContext";
import { CURRENCIES, type CurrencyCode } from "../data/omanAirRoutes";
import type { SindbadTier } from "../data/ancillariesAndSeats";
import { OmanAirLogo } from "./OmanAirLogo";
import { Button } from "./ui/button";

const NAV_ITEMS = [
  { to: "/" as const, en: "Book", ar: "احجز" },
  { to: "/manage" as const, en: "Manage", ar: "إدارة الحجز" },
  { to: "/checkin" as const, en: "Check-in", ar: "إتمام السفر" },
  { to: "/status" as const, en: "Flight Status", ar: "حالة الرحلة" },
  { to: "/sindbad" as const, en: "Sindbad", ar: "سندباد" },
];

export function Navbar() {
  const {
    lang,
    setLang,
    currency,
    setCurrency,
    sindbadSignedIn,
    sindbadTier,
    setSindbadTier,
    sindbadMiles,
    setDarkSiteMode,
  } = useIBE();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const cycleTier = () => {
    const order: SindbadTier[] = ["Blue", "Silver", "Gold"];
    const next = order[(order.indexOf(sindbadTier) + 1) % order.length] ?? "Gold";
    setSindbadTier(next);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="focus:outline-none">
          <OmanAirLogo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground/80 hover:bg-muted hover:text-foreground"
                }`}
              >
                {lang === "ar" ? item.ar : item.en}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <select
            aria-label="Select currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="h-9 gap-1.5 text-xs font-semibold"
            aria-label="Toggle language"
          >
            <Globe className="h-3.5 w-3.5 text-primary" />
            {lang === "en" ? "العربية" : "English"}
          </Button>

          <button
            type="button"
            onClick={cycleTier}
            title="Click to switch Sindbad Tier and test live BFF tier-based pricing"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gold/50 bg-gold/15 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-gold/25"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>{sindbadSignedIn ? `Sindbad ${sindbadTier}` : "Guest"}</span>
            <span className="text-muted-foreground">· {sindbadMiles.toLocaleString()} mi</span>
          </button>

          <button
            type="button"
            onClick={() => setDarkSiteMode(true)}
            title="Activate Dark Site Emergency Mode (FR-31)"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
            aria-label="Toggle Dark Site emergency mode"
          >
            <ShieldAlert className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border md:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-card px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                  pathname === item.to ? "bg-primary/10 text-primary font-semibold" : "text-foreground"
                }`}
              >
                {lang === "ar" ? item.ar : item.en}
              </Link>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <select
              aria-label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold"
            >
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={() => setLang(lang === "en" ? "ar" : "en")}>
              {lang === "en" ? "العربية (RTL)" : "English (LTR)"}
            </Button>
            <Button variant="secondary" size="sm" onClick={cycleTier}>
              Sindbad {sindbadTier}
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}