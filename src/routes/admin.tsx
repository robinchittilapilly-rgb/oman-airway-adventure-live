import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, AlertTriangle, Lock, Plus, Search, Shield, Sliders } from "lucide-react";
import { toast } from "sonner";
import type { BffAuditEntry, BffCmsArticle, BffCmsState } from "../../bff/types";
import { useIBE } from "../context/IBEContext";
import { bffClient } from "../lib/bff-client";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "CMS, Rules & Dark Site Back Office | Oman Air BFF" },
      {
        name: "description",
        content:
          "Manage Oman Air Headless CMS copy, Dark Site switch, retailing promo rules, feature flags, and immutable audit logs.",
      },
    ],
  }),
  component: AdminBackOfficePage,
});

function AdminBackOfficePage() {
  const { bffConnected, demoModeEnabled, role, signInOidcPkce, setDarkSiteMode, lang } = useIBE();
  const [cms, setCms] = useState<BffCmsState | null>(null);
  const [auditLogs, setAuditLogs] = useState<BffAuditEntry[]>([]);
  const [infra, setInfra] = useState<{
    storeBackend: string;
    cacheBackend: string;
    geminiConfigured: boolean;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BffCmsArticle[]>([]);

  const [promoCode, setPromoCode] = useState("MUSCAT25");
  const [promoPct, setPromoPct] = useState("25");
  const [promoLabel, setPromoLabel] = useState("25% Muscat Autumn Retail Offer");
  const [mfaVerified, setMfaVerified] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<{
    secretBase32: string;
    otpauthUri: string;
    sandboxCurrentCode?: string | undefined;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [traces, setTraces] = useState<
    {
      traceId: string;
      spanId: string;
      method: string;
      path: string;
      statusCode: number;
      durationMs: number;
      startedAt: string;
    }[]
  >([]);
  const [articleSlug, setArticleSlug] = useState("muscat-winter-ops");
  const [articleTitleEn, setArticleTitleEn] = useState("Muscat Hub Winter Schedule Update");
  const [articleBodyEn, setArticleBodyEn] = useState(
    "Additional Boeing 787-9 Dreamliner frequencies added across London, Bangkok, and Munich.",
  );

  const loadAdminData = async () => {
    if (!bffConnected) return;
    try {
      const [overview, siteRes] = await Promise.all([
        bffClient.getAdminOverview(lang),
        bffClient.searchCmsSite(searchQuery, lang),
      ]);
      setCms(overview.cms);
      setAuditLogs(overview.auditLogs);
      setTraces(overview.traces ?? []);
      setMfaVerified(Boolean(overview.mfaVerified));
      setInfra(overview.infra);
      setSearchResults(siteRes.articles);
      setDarkSiteMode(overview.cms.darkSiteActive);
    } catch {
      const siteRes = await bffClient.searchCmsSite(searchQuery, lang).catch(() => null);
      if (siteRes) setSearchResults(siteRes.articles);
    }
  };

  useEffect(() => {
    void loadAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bffConnected, role]);

  const handleSearchSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bffConnected) return;
    const res = await bffClient.searchCmsSite(searchQuery, lang);
    setSearchResults(res.articles);
  };

  const handleToggleDarkSite = async () => {
    if (!cms) return;
    try {
      const next = !cms.darkSiteActive;
      const res = await bffClient.updateAdminCms({ darkSiteActive: next }, lang);
      setCms(res.cms);
      setDarkSiteMode(res.cms.darkSiteActive);
      toast.success(
        `Global Dark Site mode ${next ? "ACTIVATED" : "DEACTIVATED"} (CMS v${res.cms.version})`,
      );
      void loadAdminData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verify Admin MFA first.");
    }
  };

  const handleToggleFlag = async (key: keyof BffCmsState["featureFlags"]) => {
    if (!cms) return;
    try {
      const res = await bffClient.updateAdminCms(
        { featureFlags: { [key]: !cms.featureFlags[key] } },
        lang,
      );
      setCms(res.cms);
      toast.success(`Updated flag ${key} (CMS v${res.cms.version})`);
      void loadAdminData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verify Admin MFA first.");
    }
  };

  const handlePublishPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;
    try {
      const res = await bffClient.updateAdminCms(
        {
          upsertPromo: {
            code: promoCode.trim().toUpperCase(),
            discountPct: Math.min(90, Math.max(1, Number(promoPct) || 10)),
            label: promoLabel.trim() || "Promotional Retail Offer",
            active: true,
          },
        },
        lang,
      );
      setCms(res.cms);
      toast.success(
        `Published dynamic promo rule ${promoCode.toUpperCase()} (CMS v${res.cms.version})`,
      );
      void loadAdminData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verify Admin MFA first.");
    }
  };

  const handleSetupMfa = async () => {
    try {
      const res = await bffClient.setupAdminMfa(lang);
      setMfaSetup(res);
      if (res.sandboxCurrentCode) setMfaCode(res.sandboxCurrentCode);
      toast.success("TOTP MFA secret initialized. Enter 6-digit code to verify.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "MFA setup failed.");
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await bffClient.verifyAdminMfa(mfaCode.trim(), lang);
      setMfaVerified(true);
      toast.success("Admin TOTP MFA verified for CMS & Dark Site publishing.");
      void loadAdminData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid TOTP code.");
    }
  };

  const handlePublishArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!articleSlug.trim() || !articleTitleEn.trim()) return;
    try {
      const res = await bffClient.updateAdminCms(
        {
          upsertArticle: {
            slug: articleSlug.trim().toLowerCase(),
            category: "advisory",
            titleEn: articleTitleEn.trim(),
            titleAr: articleTitleEn.trim(),
            bodyEn: articleBodyEn.trim(),
            bodyAr: articleBodyEn.trim(),
            routeLink: "/",
            published: true,
          },
        },
        lang,
      );
      setCms(res.cms);
      toast.success(`Published CMS article ${articleSlug} (v${res.cms.version})`);
      void loadAdminData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verify Admin MFA first.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold">
            Headless CMS, Rules &amp; Dark Site Back Office
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Level 2 Admin Control Plane (FR-29, FR-35..36, FR-44, FR-47) with RBAC + Audit Logs.
          </p>
        </div>

        {role !== "admin" && demoModeEnabled && bffConnected && (
          <Button
            onClick={() => void signInOidcPkce("Oman Air Ops Admin", "Gold", "admin")}
            className="gap-2 rounded-xl font-display font-bold"
          >
            <Lock className="h-4 w-4" /> Authenticate via OIDC PKCE (Admin Role)
          </Button>
        )}
      </div>

      {/* Enterprise Site Search (FR-29) */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Search className="h-5 w-5 text-primary" /> Enterprise CMS Site Search (FR-29)
        </h2>
        <form onSubmit={handleSearchSite} className="mt-3 flex gap-2">
          <label htmlFor="cms-site-search" className="sr-only">
            Search policies, baggage, Sindbad, or advisories
          </label>
          <input
            id="cms-site-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search policies, baggage allowance, hold fare, Business Studio..."
            className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
          />
          <Button type="submit" variant="secondary">
            Search CMS
          </Button>
        </form>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {searchResults.map((art) => (
            <article
              key={art.id}
              className="rounded-xl border border-border bg-background p-4 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="rounded bg-primary/10 px-2 py-0.5 font-bold uppercase text-primary">
                  {art.category}
                </span>
                <span className="text-muted-foreground">{art.slug}</span>
              </div>
              <h3 className="mt-2 font-display text-sm font-bold">
                {lang === "ar" ? art.titleAr : art.titleEn}
              </h3>
              <p className="mt-1 text-muted-foreground">
                {lang === "ar" ? art.bodyAr : art.bodyEn}
              </p>
            </article>
          ))}
        </div>
      </section>

      {!bffConnected ? (
        <div className="rounded-2xl border border-warning bg-warning/15 p-6 text-sm">
          Connect the live BFF server (`npm run bff:dev` or set `VITE_BFF_URL`) to access
          RBAC-protected Admin controls.
        </div>
      ) : role !== "admin" ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          RBAC Enforced: Current role is <strong>{role}</strong>. Click &quot;Authenticate via OIDC
          PKCE (Admin Role)&quot; above to unlock CMS publishing, Dark Site switching, feature
          flags, and immutable audit logs.
        </div>
      ) : (
        cms && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Shield className="h-5 w-5 text-primary" /> Global Controls &amp; Dark Site (CMS v
                {cms.version})
              </h2>
              {infra && (
                <p className="text-xs text-muted-foreground">
                  Store: <strong>{infra.storeBackend}</strong> · Cache:{" "}
                  <strong>{infra.cacheBackend}</strong> · Gemini API:{" "}
                  <strong>{infra.geminiConfigured ? "Active" : "Tool-Fallback"}</strong>
                </p>
              )}

              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">
                    RFC 6238 TOTP MFA Gate:{" "}
                    <strong className={mfaVerified ? "text-success" : "text-warning"}>
                      {mfaVerified ? "VERIFIED" : "REQUIRED FOR PUBLISH"}
                    </strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={`${import.meta.env.BASE_URL}dark-site.html`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-border bg-background px-2.5 py-1 font-semibold hover:bg-muted"
                    >
                      Static Dark Site HTML
                    </a>
                    {!mfaVerified && (
                      <Button size="sm" variant="outline" onClick={() => void handleSetupMfa()}>
                        Enroll / Get Code
                      </Button>
                    )}
                  </div>
                </div>
                {!mfaVerified && (
                  <form onSubmit={handleVerifyMfa} className="flex flex-wrap items-center gap-2">
                    <input
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      placeholder="6-digit TOTP code"
                      aria-label="Admin TOTP code"
                      className="h-8 w-40 rounded-lg border border-input bg-background px-2.5 text-xs font-mono"
                    />
                    <Button type="submit" size="sm">
                      Verify MFA
                    </Button>
                    {mfaSetup?.sandboxCurrentCode && (
                      <span className="text-muted-foreground">
                        Sandbox TOTP: <code>{mfaSetup.sandboxCurrentCode}</code>
                      </span>
                    )}
                  </form>
                )}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-bold text-destructive">
                    <AlertTriangle className="h-4 w-4" /> One-Click Global Dark Site Switch (FR-36)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Switches portal into crisis advisory mode globally across sessions.
                  </p>
                </div>
                <Button
                  variant={cms.darkSiteActive ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => void handleToggleDarkSite()}
                >
                  {cms.darkSiteActive ? "Deactivate" : "Activate"}
                </Button>
              </div>

              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Sliders className="h-3.5 w-3.5" /> Feature Flags (FR-17, FR-47)
                </h3>
                {(Object.keys(cms.featureFlags) as (keyof BffCmsState["featureFlags"])[]).map(
                  (flagKey) => (
                    <div
                      key={flagKey}
                      className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-xs"
                    >
                      <span className="font-semibold">{flagKey}</span>
                      <Button
                        size="sm"
                        variant={cms.featureFlags[flagKey] ? "default" : "outline"}
                        onClick={() => void handleToggleFlag(flagKey)}
                      >
                        {cms.featureFlags[flagKey] ? "Enabled" : "Disabled"}
                      </Button>
                    </div>
                  ),
                )}
              </div>

              <form onSubmit={handlePublishPromo} className="space-y-2 border-t border-border pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Publish Dynamic Promo Rule (FR-44, FR-59)
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="CODE"
                    aria-label="Promo code"
                    className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs font-bold uppercase"
                  />
                  <input
                    type="number"
                    value={promoPct}
                    onChange={(e) => setPromoPct(e.target.value)}
                    placeholder="%"
                    aria-label="Discount percent"
                    className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs font-bold"
                  />
                  <Button type="submit" size="sm" className="gap-1 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Publish
                  </Button>
                </div>
                <input
                  value={promoLabel}
                  onChange={(e) => setPromoLabel(e.target.value)}
                  placeholder="Offer description"
                  aria-label="Promo label"
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs"
                />
              </form>

              <form
                onSubmit={handlePublishArticle}
                className="space-y-2 border-t border-border pt-4"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Publish Headless CMS Article (FR-33..35)
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={articleSlug}
                    onChange={(e) => setArticleSlug(e.target.value)}
                    placeholder="article-slug"
                    aria-label="Article slug"
                    className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs font-mono"
                  />
                  <input
                    value={articleTitleEn}
                    onChange={(e) => setArticleTitleEn(e.target.value)}
                    placeholder="Headline"
                    aria-label="Article headline"
                    className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    value={articleBodyEn}
                    onChange={(e) => setArticleBodyEn(e.target.value)}
                    placeholder="Summary body"
                    aria-label="Article body"
                    className="h-9 flex-1 rounded-lg border border-input bg-background px-2.5 text-xs"
                  />
                  <Button type="submit" size="sm" variant="secondary">
                    Publish Article
                  </Button>
                </div>
              </form>

              {cms.ancillaryMediaMap && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Ancillary Media Catalog Map (FR-38)
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    {Object.entries(cms.ancillaryMediaMap).map(([key, meta]) => (
                      <span
                        key={key}
                        className="rounded-md border border-border bg-background px-2 py-1"
                      >
                        <strong>{key}</strong> · {meta.badge} ({meta.iconKey})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 space-y-5">
              <div>
                <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                  <Activity className="h-5 w-5 text-primary" /> OpenTelemetry HTTP Traces
                </h2>
                <div className="mt-2 max-h-[200px] space-y-1.5 overflow-y-auto text-[11px]">
                  {traces.length === 0 ? (
                    <p className="text-muted-foreground">No HTTP spans captured yet.</p>
                  ) : (
                    traces.slice(0, 12).map((tr) => (
                      <div
                        key={tr.spanId}
                        className="flex items-center justify-between rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono"
                      >
                        <span>
                          {tr.method} {tr.path} ({tr.statusCode})
                        </span>
                        <span className="text-muted-foreground">{tr.durationMs} ms</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                  <Activity className="h-5 w-5 text-primary" /> Immutable Audit Stream (L2 Store)
                </h2>
                <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto text-xs">
                  {auditLogs.length === 0 ? (
                    <p className="text-muted-foreground">
                      No audit events recorded yet in this session.
                    </p>
                  ) : (
                    auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-xl border border-border bg-background p-3"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-primary">{log.eventType}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {log.traceId}
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {log.createdAt} {log.resourceId ? `· Resource: ${log.resourceId}` : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        )
      )}
    </div>
  );
}
