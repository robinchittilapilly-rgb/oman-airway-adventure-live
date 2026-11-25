import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Award, Calculator, Gift, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useIBE } from "../context/IBEContext";
import { REDEMPTION_CATALOG, type SindbadTier } from "../data/ancillariesAndSeats";
import { calculateSindbadMiles } from "../lib/ibe-rules";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/sindbad")({
  head: () => ({
    meta: [
      { title: "Sindbad Frequent Flyer Portal | Oman Air" },
      { name: "description", content: "Track Sindbad tier status, calculate spend-based miles, pool family miles, retro-claim missing flights, and redeem rewards." },
      { property: "og:title", content: "Sindbad Loyalty Portal | Oman Air" },
      { property: "og:description", content: "Oman Air Sindbad frequent flyer dashboard, household pooling, and redemption catalog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SindbadPortalPage,
});

function SindbadPortalPage() {
  const {
    sindbadTier,
    setSindbadTier,
    sindbadMiles,
    tierPoints,
    spendMiles,
    addMiles,
    household,
    addHouseholdMember,
    removeHouseholdMember,
    claimedPnrs,
  } = useIBE();

  const [calcOMR, setCalcOMR] = useState("250");
  const [retroPnr, setRetroPnr] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberRel, setMemberRel] = useState("Sibling");

  const pooledTotal = sindbadMiles + household.reduce((s, h) => s + h.contributedMiles, 0);
  const tierTarget = sindbadTier === "Gold" ? 600 : sindbadTier === "Silver" ? 300 : 150;
  const tierProgressPct = Math.min(100, Math.round((tierPoints / tierTarget) * 100));

  const handleRetroClaim = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = retroPnr.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(clean)) {
      toast.error("Enter a valid 6-character Oman Air PNR (e.g. WY5M2K).");
      return;
    }
    if (claimedPnrs.includes(clean)) {
      toast.error(`PNR ${clean} has already been credited to your Sindbad account.`);
      return;
    }
    addMiles(2400, clean);
    setRetroPnr("");
    toast.success(`PNR ${clean} validated via LMS! +2,400 Sindbad Miles credited.`);
  };

  const handleRedeem = (title: string, miles: number) => {
    if (!spendMiles(miles)) {
      toast.error("Insufficient Sindbad miles balance for this reward.");
      return;
    }
    toast.success(`Redeemed "${title}" for ${miles.toLocaleString()} miles! Voucher sent.`);
  };

  const handleAddFamily = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) return;
    addHouseholdMember({
      name: memberName.trim(),
      relation: memberRel,
      sindbadNo: `SB-${Math.floor(8000000 + Math.random() * 999999)}`,
      contributedMiles: 1500,
    });
    setMemberName("");
    toast.success("Family member linked to your Sindbad Household pool.");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-8">
      {/* Loyalty Dashboard Hero Card (FR-18) */}
      <section className="rounded-3xl bg-teal-deep p-6 text-teal-deep-foreground sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-gold">
              <Award className="h-4 w-4" /> Sindbad Member · oneworld {sindbadTier === "Gold" ? "Sapphire" : sindbadTier === "Silver" ? "Ruby" : "Member"}
            </p>
            <h1 className="mt-2 font-display text-3xl font-extrabold">Tariq Al-Balushi</h1>
            <p className="text-xs opacity-80">Account SB-8841209 · SSO Synced across Web IBE & Mobile</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {(["Blue", "Silver", "Gold"] as SindbadTier[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSindbadTier(t)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    sindbadTier === t ? "bg-gold text-gold-foreground" : "bg-teal-deep-foreground/10 hover:bg-teal-deep-foreground/20"
                  }`}
                >
                  Preview {t} Tier
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div className="rounded-2xl bg-teal-deep-foreground/10 p-4">
              <p className="text-[11px] opacity-80">Personal Balance</p>
              <p className="font-display text-2xl font-extrabold text-gold">{sindbadMiles.toLocaleString()}</p>
              <p className="text-[11px] opacity-75">Sindbad Miles</p>
            </div>
            <div className="rounded-2xl bg-teal-deep-foreground/10 p-4">
              <p className="text-[11px] opacity-80">Household Pool</p>
              <p className="font-display text-2xl font-extrabold">{pooledTotal.toLocaleString()}</p>
              <p className="text-[11px] opacity-75">Combined Miles</p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex justify-between text-xs font-semibold">
            <span>Tier Retention Progress ({tierPoints} / {tierTarget} Tier Points)</span>
            <span>{tierProgressPct}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-teal-deep-foreground/20">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${tierProgressPct}%` }} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Spend-Based Miles Calculator (FR-102) */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Calculator className="h-5 w-5 text-primary" /> Spend-Based Miles Calculator
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Official Oman Air rule: Blue earns 4×, Silver 5×, Gold 6× miles per USD spent on base fare & add-ons.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <label className="text-xs font-semibold">Eligible Spend (OMR):</label>
            <input
              type="number"
              min={0}
              value={calcOMR}
              onChange={(e) => setCalcOMR(e.target.value)}
              className="h-10 w-32 rounded-lg border border-input bg-background px-3 text-sm font-bold"
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
            {(["Blue", "Silver", "Gold"] as SindbadTier[]).map((t) => (
              <div key={t} className={`rounded-xl border p-3 ${sindbadTier === t ? "border-primary bg-primary/10" : "border-border"}`}>
                <p className="text-xs font-semibold text-muted-foreground">{t}</p>
                <p className="mt-1 font-display text-lg font-extrabold text-primary">
                  +{calculateSindbadMiles(Math.max(0, Number(calcOMR) || 0), t).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Retro-Claim Missing Miles (FR-20) */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Sparkles className="h-5 w-5 text-primary" /> Claim Missing Miles (Retro-Claim)
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter any 6-character Oman Air PNR from the past 6 months for instant LMS validation.
          </p>
          <form onSubmit={handleRetroClaim} className="mt-4 flex gap-2">
            <input
              value={retroPnr}
              onChange={(e) => setRetroPnr(e.target.value.toUpperCase())}
              placeholder="e.g. WY5M2K"
              maxLength={6}
              className="h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm font-bold uppercase"
            />
            <Button type="submit" className="h-11 rounded-xl font-display font-bold">Validate & Claim</Button>
          </form>
        </section>
      </div>

      {/* Family / Household Pooling (FR-21) */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Users className="h-5 w-5 text-primary" /> Family & Household Miles Pooling
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {household.map((h) => (
            <div key={h.id} className="flex items-center justify-between rounded-xl border border-border bg-background p-3.5 text-xs">
              <div>
                <p className="font-bold">{h.name} ({h.relation})</p>
                <p className="text-muted-foreground">{h.sindbadNo} · +{h.contributedMiles.toLocaleString()} mi</p>
              </div>
              <button type="button" onClick={() => removeHouseholdMember(h.id)} aria-label={`Remove ${h.name}`} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddFamily} className="mt-4 flex flex-wrap gap-2">
          <input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Add family member name" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
          <select value={memberRel} onChange={(e) => setMemberRel(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
            <option>Spouse</option><option>Child</option><option>Parent</option><option>Sibling</option>
          </select>
          <Button type="submit" variant="secondary" className="gap-1.5"><Plus className="h-4 w-4" /> Link Member</Button>
        </form>
      </section>

      {/* Non-Flight Redemption Catalog (FR-22) */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Gift className="h-5 w-5 text-primary" /> Non-Flight Partner Redemption Catalog
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {REDEMPTION_CATALOG.map((item) => (
            <div key={item.id} className="flex flex-col justify-between rounded-xl border border-border bg-background p-4">
              <div>
                <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-bold">{item.category}</span>
                <h3 className="mt-2 font-display text-sm font-bold">{item.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{item.partner}</p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-display text-sm font-extrabold text-primary">{item.miles.toLocaleString()} mi</span>
                <Button size="sm" onClick={() => handleRedeem(item.title, item.miles)}>Redeem</Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}