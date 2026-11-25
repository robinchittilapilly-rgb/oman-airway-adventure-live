import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Award, Calculator, Gift, LogIn, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useIBE } from "../context/IBEContext";
import {
  REDEMPTION_CATALOG,
  RETRO_CLAIMABLE_PNRS,
  type SindbadTier,
} from "../data/ancillariesAndSeats";
import { calculateSindbadMiles } from "../lib/ibe-rules";
import { t } from "../lib/i18n";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/sindbad")({
  head: () => ({
    meta: [
      { title: "Sindbad Frequent Flyer Portal | Oman Air" },
      { name: "description", content: "Track Sindbad tier status, calculate spend-based miles, pool family miles, retro-claim eligible flights, and redeem rewards." },
      { property: "og:title", content: "Sindbad Loyalty Portal | Oman Air" },
      { property: "og:description", content: "Oman Air Sindbad frequent flyer dashboard prototype, household pooling, and redemption catalog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SindbadPortalPage,
});

function SindbadPortalPage() {
  const {
    sindbadSignedIn,
    sindbadMemberName,
    signInSindbad,
    signOutSindbad,
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
    bookings,
    lang,
  } = useIBE();
  const copy = t(lang).sindbad;

  const [calcOMR, setCalcOMR] = useState("250");
  const [retroPnr, setRetroPnr] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberRel, setMemberRel] = useState("Sibling");
  const [enrollName, setEnrollName] = useState("Tariq Al-Balushi");

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
    const ledgerMatch = RETRO_CLAIMABLE_PNRS[clean];
    const bookingMatch = bookings.find((b) => b.rloc === clean && b.status === "CONFIRMED");
    if (!ledgerMatch && !bookingMatch) {
      toast.error("PNR not found in demo LMS ledger. Try WY5M2K, WY3P8N, WY2J4Q, or a confirmed booking RLOC.");
      return;
    }
    const milesToCredit = ledgerMatch
      ? ledgerMatch.miles
      : calculateSindbadMiles(bookingMatch!.totalPaidOMR, sindbadTier);
    addMiles(milesToCredit, clean);
    setRetroPnr("");
    toast.success(`Demo LMS match for ${clean}! +${milesToCredit.toLocaleString()} Sindbad Miles credited.`);
  };

  const handleRedeem = (title: string, miles: number) => {
    if (!spendMiles(miles)) {
      toast.error("Insufficient Sindbad miles balance for this reward.");
      return;
    }
    toast.success(`Redeemed "${title}" for ${miles.toLocaleString()} miles (Demo Voucher)!`);
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
    toast.success("Family member linked to your Sindbad Household pool (Demo).");
  };

  if (!sindbadSignedIn) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <Award className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-3 font-display text-2xl font-extrabold">Sign In or Enroll in Sindbad (Demo)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You are currently browsing as a Guest. Sign in to view your miles balance, household pool, and saved travelers.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              signInSindbad(enrollName);
              toast.success(`Signed in as ${enrollName} (Demo session)`);
            }}
            className="mt-6 space-y-3 text-start"
          >
            <div>
              <label htmlFor="sindbad-enroll-name" className="mb-1 block text-xs font-semibold">
                Member Full Name
              </label>
              <input
                id="sindbad-enroll-name"
                value={enrollName}
                onChange={(e) => setEnrollName(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
            </div>
            <Button type="submit" size="lg" className="w-full gap-2 rounded-xl font-display font-bold">
              <LogIn className="h-4 w-4" /> Continue to Sindbad Portal (Demo)
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-8">
      {/* Loyalty Dashboard Hero Card */}
      <section className="rounded-3xl bg-teal-deep p-6 text-teal-deep-foreground sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-gold">
              <Award className="h-4 w-4" /> Sindbad Member · oneworld {sindbadTier === "Gold" ? "Sapphire" : sindbadTier === "Silver" ? "Ruby" : "Member"}
            </p>
            <h1 className="mt-2 font-display text-3xl font-extrabold">{sindbadMemberName}</h1>
            <p className="text-xs opacity-85">Account SB-8841209 · Demo browser session ({copy.title})</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {(["Blue", "Silver", "Gold"] as SindbadTier[]).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setSindbadTier(tier)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    sindbadTier === tier ? "bg-gold text-gold-foreground" : "bg-teal-deep-foreground/10 hover:bg-teal-deep-foreground/20"
                  }`}
                >
                  Preview {tier} Tier
                </button>
              ))}
              <button
                type="button"
                onClick={signOutSindbad}
                className="rounded-lg border border-teal-deep-foreground/30 px-3.5 py-1.5 text-xs font-semibold hover:bg-teal-deep-foreground/10"
              >
                Sign out (Test Guest Flow)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div className="rounded-2xl bg-teal-deep-foreground/10 p-4">
              <p className="text-xs opacity-85">Personal Balance</p>
              <p className="font-display text-2xl font-extrabold text-gold">{sindbadMiles.toLocaleString()}</p>
              <p className="text-xs opacity-80">Sindbad Miles</p>
            </div>
            <div className="rounded-2xl bg-teal-deep-foreground/10 p-4">
              <p className="text-xs opacity-85">Household Pool</p>
              <p className="font-display text-2xl font-extrabold">{pooledTotal.toLocaleString()}</p>
              <p className="text-xs opacity-80">Combined Miles</p>
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
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Calculator className="h-5 w-5 text-primary" /> Spend-Based Miles Calculator
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Blue earns 4×, Silver 5×, Gold 6× miles per USD equivalent spent on base fare & add-ons.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <label htmlFor="sindbad-calc-omr" className="text-xs font-semibold">Eligible Spend (OMR):</label>
            <input
              id="sindbad-calc-omr"
              type="number"
              min={0}
              value={calcOMR}
              onChange={(e) => setCalcOMR(e.target.value)}
              className="h-10 w-32 rounded-lg border border-input bg-background px-3 text-sm font-bold"
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
            {(["Blue", "Silver", "Gold"] as SindbadTier[]).map((tier) => (
              <div key={tier} className={`rounded-xl border p-3 ${sindbadTier === tier ? "border-primary bg-primary/10" : "border-border"}`}>
                <p className="text-xs font-semibold text-muted-foreground">{tier}</p>
                <p className="mt-1 font-display text-lg font-extrabold text-primary">
                  +{calculateSindbadMiles(Math.max(0, Number(calcOMR) || 0), tier).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Sparkles className="h-5 w-5 text-primary" /> {copy.retroTitle}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter an unclaimed PNR from the demo ledger (<code>WY5M2K</code>, <code>WY3P8N</code>, <code>WY2J4Q</code>) or a confirmed booking RLOC.
          </p>
          <form onSubmit={handleRetroClaim} className="mt-4 flex gap-2">
            <label htmlFor="sindbad-retro-pnr" className="sr-only">PNR Code</label>
            <input
              id="sindbad-retro-pnr"
              value={retroPnr}
              onChange={(e) => setRetroPnr(e.target.value.toUpperCase())}
              placeholder="e.g. WY5M2K"
              maxLength={6}
              className="h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm font-bold uppercase"
            />
            <Button type="submit" className="h-11 rounded-xl font-display font-bold">Check & Claim (Demo)</Button>
          </form>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Users className="h-5 w-5 text-primary" /> {copy.familyTitle}
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
          <label htmlFor="family-member-name" className="sr-only">Family member name</label>
          <input
            id="family-member-name"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="Add family member name"
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          />
          <label htmlFor="family-member-rel" className="sr-only">Relationship</label>
          <select
            id="family-member-rel"
            value={memberRel}
            onChange={(e) => setMemberRel(e.target.value)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option>Spouse</option><option>Child</option><option>Parent</option><option>Sibling</option>
          </select>
          <Button type="submit" variant="secondary" className="gap-1.5"><Plus className="h-4 w-4" /> Link Member (Demo)</Button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Gift className="h-5 w-5 text-primary" /> {copy.catalogTitle}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {REDEMPTION_CATALOG.map((item) => (
            <div key={item.id} className="flex flex-col justify-between rounded-xl border border-border bg-background p-4">
              <div>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs font-bold">{item.category}</span>
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
