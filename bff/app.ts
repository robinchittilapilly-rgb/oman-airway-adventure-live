import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { FARE_BRANDS } from "../src/data/omanAirRoutes";
import {
  DIRECT_ANCILLARIES,
  SSR_OPTIONS,
  VIRTUAL_BUNDLES,
  type SavedBookingPNR,
} from "../src/data/ancillariesAndSeats";
import {
  calculateSindbadMiles,
  computeExchangeQuote,
  computeHoldExpiryISO,
  computeRefundQuote,
  generateRLOC,
  getMilesUpgradeOption,
  isHoldExpired,
  validateIcaoPassenger,
  validatePassengerAgeForType,
  validatePassengerMix,
} from "../src/lib/ibe-rules";
import { MockSindbadLmsAdapter } from "./adapters/lmsAdapter";
import { PaymentGatewaySandbox } from "./adapters/paymentGateway";
import { MockSabrePssAdapter } from "./adapters/pssAdapter";
import { ThirdPartyIntegrationHub } from "./adapters/thirdPartyHub";
import {
  assertBookingAccess,
  attachSessionHeadersAndCookie,
  authorizeSessionBookingAccess,
  canSessionAccessBooking,
  isDemoAuthEnabled,
  resolveOrCreateSession,
  sanitizeBookingForSession,
} from "./middleware/authSession";
import { BffAppError, translateBffError } from "./middleware/errorTranslator";
import { idempotencyMiddleware } from "./middleware/idempotency";
import { SlidingWindowRateLimiter, rateLimitMiddleware } from "./middleware/rateLimiter";
import {
  getRecentTraces,
  renderPrometheusMetrics,
  telemetryMiddleware,
} from "./middleware/telemetry";
import { buildBrandedFareQuotes, computeServerCartPricing } from "./rules/retailingEngine";
import {
  addBookingAncillarySchema,
  aiChatSchema,
  biometricSchema,
  cartUpsertSchema,
  checkInCompleteSchema,
  checkInUpgradeSchema,
  checkoutSchema,
  cmsAdminUpdateSchema,
  exchangeBookingSchema,
  handoffTokenSchema,
  householdAddSchema,
  irropsActionSchema,
  loginSchema,
  mfaVerifySchema,
  oidcAuthorizeSchema,
  oidcCallbackSchema,
  partnerSsoSchema,
  redeemCatalogSchema,
  refundBookingSchema,
  retrieveBookingSchema,
  retroClaimSchema,
  searchSchema,
  servicePnrSchema,
  settleHoldSchema,
  threeDsChallengeSchema,
  threeDsVerifySchema,
  tierSwitchSchema,
  tokenizeCardSchema,
} from "./schemas";
import { SuhailAiService } from "./services/aiAssistantService";
import { recordAudit } from "./services/auditService";
import { BffCmsService } from "./services/cmsService";
import { generateTotpCode, getAdminTotpSecret, verifyAdminTotp } from "./services/mfaService";
import { OidcPkceService } from "./services/oidcService";
import {
  generateApplePkpassBuffer,
  generateGoogleWalletSaveJwt,
} from "./services/walletPassService";
import { createCacheStoreFromEnv, type CacheStore } from "./stores/cacheStore";
import { createSessionStoreFromEnv } from "./stores/index";
import type { SessionAndCartStore } from "./stores/sessionStore";
import type {
  AppLang,
  BffCartState,
  BffSearchRequest,
  BffSearchResponse,
  PointOfSale,
} from "./types";

export interface BffDependencies {
  cache?: CacheStore;
  store?: SessionAndCartStore;
  searchRateLimiter?: SlidingWindowRateLimiter;
}

function getLang(header?: string | null): AppLang {
  return header?.toLowerCase().startsWith("ar") ? "ar" : "en";
}

function getPos(header?: string | null): PointOfSale {
  const v = header?.toUpperCase();
  if (v === "OM" || v === "AE" || v === "SA" || v === "GB" || v === "EU") return v;
  return "OM";
}

function normalizeHoldExpiries(booking: SavedBookingPNR): SavedBookingPNR {
  if (booking.status === "HELD" && isHoldExpired(booking.holdExpiresAt)) {
    return { ...booking, status: "EXPIRED" };
  }
  return booking;
}

export function createBffApp(deps: BffDependencies = {}) {
  const cache = deps.cache ?? createCacheStoreFromEnv();
  const store = deps.store ?? createSessionStoreFromEnv();
  const pss = new MockSabrePssAdapter(store);
  const lms = new MockSindbadLmsAdapter(store);
  const thirdParty = new ThirdPartyIntegrationHub();
  const gateway = new PaymentGatewaySandbox(cache);
  const cms = new BffCmsService(store);
  const oidc = new OidcPkceService(cache, store);
  const suhailAi = new SuhailAiService(pss, cms, store);
  const searchLimiter = deps.searchRateLimiter ?? new SlidingWindowRateLimiter(30, 60_000);
  const idempotency = idempotencyMiddleware(cache);

  const app = new Hono();
  app.use("*", telemetryMiddleware);

  const allowedOrigins = (
    process.env["CORS_ORIGIN"] ??
    "https://robinchittilapilly-rgb.github.io,http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return "*";
        if (allowedOrigins.includes("*")) return origin;
        return allowedOrigins.includes(origin) ? origin : null;
      },
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "Accept-Language",
        "X-Session-Id",
        "X-OmanAir-POS",
        "CF-IPCountry",
        "X-Country-Code",
        "Idempotency-Key",
      ],
      exposeHeaders: [
        "X-Session-Token",
        "X-OmanAir-Experiment",
        "X-RateLimit-Remaining",
        "X-Idempotent-Replay",
        "X-Trace-Id",
        "Retry-After",
      ],
    }),
  );

  app.onError((err, c) => {
    const lang = getLang(c.req.header("accept-language"));
    if (err instanceof BffAppError) {
      return c.json(translateBffError(err.code, lang, err.overrideMessage), err.statusCode as 400);
    }
    if (err instanceof z.ZodError) {
      return c.json(translateBffError("ERR_VALIDATION", lang, err.issues[0]?.message), 400);
    }
    const knownCode =
      err instanceof Error && err.message.startsWith("ERR_") ? err.message : "ERR_INTERNAL";
    const status =
      knownCode === "ERR_404_PNR" || knownCode === "ERR_404_INV_CLASS"
        ? 404
        : knownCode === "ERR_AUTH_REQUIRED"
          ? 401
          : knownCode === "ERR_FORBIDDEN"
            ? 403
            : knownCode === "ERR_CONFLICT"
              ? 409
              : 400;
    return c.json(translateBffError(knownCode, lang), status);
  });

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "oman-air-ibe-bff",
      version: "1.2.0",
      storeBackend: store.backendName,
      cacheBackend: cache.backendName,
      demoMode: isDemoAuthEnabled(),
      geminiConfigured: Boolean(process.env["GEMINI_API_KEY"]?.trim()),
      timestamp: new Date().toISOString(),
    }),
  );

  app.get("/metrics", (c) => {
    c.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    return c.body(renderPrometheusMetrics());
  });

  // --- Edge GeoIP & Accept-Language Router (FR-30) ---
  app.get("/api/bff/v1/edge/context", (c) => {
    const rawCountry = (
      c.req.header("cf-ipcountry") ??
      c.req.header("x-country-code") ??
      c.req.header("x-vercel-ip-country") ??
      c.req.header("x-omanair-pos") ??
      ""
    )
      .trim()
      .toUpperCase();
    const acceptLang = (c.req.header("accept-language") ?? "").toLowerCase();
    const isAr = acceptLang.startsWith("ar");
    const countryMap: Record<
      string,
      { currency: "OMR" | "USD" | "EUR" | "GBP" | "AED" | "SAR"; locale: string }
    > = {
      OM: { currency: "OMR", locale: isAr ? "ar-OM" : "en-OM" },
      AE: { currency: "AED", locale: isAr ? "ar-AE" : "en-AE" },
      SA: { currency: "SAR", locale: isAr ? "ar-SA" : "en-SA" },
      GB: { currency: "GBP", locale: "en-GB" },
      FR: { currency: "EUR", locale: "fr-FR" },
      DE: { currency: "EUR", locale: "de-DE" },
      NL: { currency: "EUR", locale: "nl-NL" },
      US: { currency: "USD", locale: "en-US" },
    };
    const hit = rawCountry ? countryMap[rawCountry] : undefined;
    if (hit) {
      return c.json({
        posCountry: rawCountry,
        currency: hit.currency,
        lang: isAr ? "ar" : "en",
        suggestedLocale: hit.locale,
        source: "geoip-header" as const,
      });
    }
    if (acceptLang.includes("en-gb")) {
      return c.json({
        posCountry: "GB",
        currency: "GBP" as const,
        lang: "en" as const,
        suggestedLocale: "en-GB",
        source: "accept-language" as const,
      });
    }
    if (isAr) {
      return c.json({
        posCountry: "OM",
        currency: "OMR" as const,
        lang: "ar" as const,
        suggestedLocale: "ar-OM",
        source: "accept-language" as const,
      });
    }
    return c.json({
      posCountry: "OM",
      currency: "OMR" as const,
      lang: "en" as const,
      suggestedLocale: "en-OM",
      source: "default" as const,
    });
  });

  // --- Auth & OIDC + PKCE Session Management (FR-23, FR-45, FR-47) ---
  app.get("/api/bff/v1/auth/session", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    attachSessionHeadersAndCookie(c, session);
    return c.json({
      sessionToken: c.res.headers.get("X-Session-Token") ?? "",
      user: session.user,
    });
  });

  app.post("/api/bff/v1/auth/oidc/authorize", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const body = oidcAuthorizeSchema.parse(await c.req.json().catch(() => ({})));
    const authRes = await oidc.startAuthorization({
      sessionId: session.sessionId,
      redirectUri: body.redirectUri,
      requestedRole: body.requestedRole,
    });
    attachSessionHeadersAndCookie(c, session);
    return c.json(authRes);
  });

  app.post("/api/bff/v1/auth/oidc/callback", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const body = oidcCallbackSchema.parse(await c.req.json());
    await oidc.completeCallback({
      session,
      state: body.state,
      code: body.code,
      codeVerifier: body.codeVerifier,
      memberName: body.memberName,
      tier: body.tier,
      role: body.role,
    });
    await recordAudit(store, {
      eventType: "AUTH_OIDC_PKCE_LOGIN",
      actorSessionId: session.sessionId,
      actorMemberId: session.user.memberId,
      payload: { role: session.user.role, tier: session.user.tier },
    });
    attachSessionHeadersAndCookie(c, session);
    return c.json({
      sessionToken: c.res.headers.get("X-Session-Token") ?? "",
      user: session.user,
    });
  });

  app.post("/api/bff/v1/auth/login", async (c) => {
    const body = loginSchema.parse(await c.req.json().catch(() => ({})));
    const session = await resolveOrCreateSession(store, c);

    if (body.mode === "demo") {
      if (!isDemoAuthEnabled()) {
        throw new BffAppError(
          "ERR_FORBIDDEN",
          403,
          "Demo login is disabled in production. Authenticate via OAuth2/OIDC PKCE.",
        );
      }
      const cleanName = body.memberName?.trim() || "Tariq Al-Balushi";
      const isDefaultTariq = cleanName.toLowerCase().includes("tariq");
      session.user.signedIn = true;
      session.user.role = body.role ?? "member";
      session.user.authProvider = "demo";
      session.user.memberName = cleanName;
      session.user.memberId = isDefaultTariq
        ? "mem-tariq-01"
        : `mem-${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      session.user.sindbadNo = isDefaultTariq ? "SB-8841209" : "SB-9910455";
      session.user.tier = body.tier ?? (isDefaultTariq ? "Gold" : "Blue");
      session.user.miles = isDefaultTariq
        ? Math.max(session.user.miles, 68450)
        : session.user.miles || 12500;
      session.user.tierPoints = isDefaultTariq
        ? Math.max(session.user.tierPoints, 420)
        : session.user.tierPoints || 80;
      session.user.travelBankOMR = isDefaultTariq
        ? Math.max(session.user.travelBankOMR, 65)
        : session.user.travelBankOMR;
    } else {
      throw new BffAppError(
        "ERR_AUTH_REQUIRED",
        401,
        "Use POST /api/bff/v1/auth/oidc/authorize + /oidc/callback for OIDC PKCE authentication.",
      );
    }

    await store.saveSession(session);
    await recordAudit(store, {
      eventType: "AUTH_DEMO_LOGIN",
      actorSessionId: session.sessionId,
      actorMemberId: session.user.memberId,
      payload: { role: session.user.role, tier: session.user.tier },
    });
    attachSessionHeadersAndCookie(c, session);
    return c.json({
      sessionToken: c.res.headers.get("X-Session-Token") ?? "",
      user: session.user,
    });
  });

  app.post("/api/bff/v1/auth/logout", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    session.user.signedIn = false;
    session.user.role = "guest";
    session.user.authProvider = "anonymous";
    delete session.user.memberId;
    delete session.user.memberName;
    delete session.user.sindbadNo;
    session.user.tier = "Blue";
    session.user.miles = 0;
    session.user.tierPoints = 0;
    session.user.travelBankOMR = 0;
    session.authorizedRlocs = [];
    await store.saveSession(session);
    attachSessionHeadersAndCookie(c, session);
    return c.json({ user: session.user });
  });

  app.post("/api/bff/v1/auth/tier", async (c) => {
    if (!isDemoAuthEnabled()) {
      throw new BffAppError(
        "ERR_FORBIDDEN",
        403,
        "Demo tier switching is disabled when BFF_ALLOW_DEMO_AUTH is off.",
      );
    }
    const body = tierSwitchSchema.parse(await c.req.json());
    const session = await resolveOrCreateSession(store, c);
    await lms.switchTierDemo(session, body.tier);
    attachSessionHeadersAndCookie(c, session);
    return c.json({ user: session.user });
  });

  // --- BFF-Native CMS, Site Search, Feature Flags & RBAC Admin (FR-25, FR-29, FR-31..38, FR-44, FR-47) ---
  app.get("/api/bff/v1/cms/content", async (c) => {
    const state = await cms.getState();
    return c.json({ cms: state });
  });

  app.get("/api/bff/v1/cms/search", async (c) => {
    const q = c.req.query("q") ?? "";
    const articles = await cms.searchArticles(q);
    return c.json({ query: q, articles });
  });

  app.get("/api/bff/v1/admin/overview", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    if (session.user.role !== "admin") {
      throw new BffAppError(
        "ERR_FORBIDDEN",
        403,
        "Admin role required to access Rules & CMS Back Office.",
      );
    }
    const [cmsState, auditLogs] = await Promise.all([cms.getState(), store.getAuditLogs(30)]);
    return c.json({
      cms: cmsState,
      auditLogs,
      traces: getRecentTraces(25),
      mfaVerified: Boolean(session.user.mfaVerified),
      infra: {
        storeBackend: store.backendName,
        cacheBackend: cache.backendName,
        demoMode: isDemoAuthEnabled(),
        geminiConfigured: Boolean(process.env["GEMINI_API_KEY"]?.trim()),
      },
    });
  });

  app.post("/api/bff/v1/admin/mfa/setup", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    if (session.user.role !== "admin") {
      throw new BffAppError("ERR_FORBIDDEN", 403, "Admin role required to enroll MFA.");
    }
    const secretBase32 = getAdminTotpSecret();
    const label = encodeURIComponent(`OmanAir:${session.user.memberName ?? "Admin"}`);
    const otpauthUri = `otpauth://totp/${label}?secret=${secretBase32}&issuer=OmanAirIBE`;
    return c.json({
      secretBase32,
      otpauthUri,
      mfaVerified: Boolean(session.user.mfaVerified),
      ...(isDemoAuthEnabled() ? { sandboxCurrentCode: generateTotpCode(secretBase32) } : {}),
    });
  });

  app.post("/api/bff/v1/admin/mfa/verify", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    if (session.user.role !== "admin") {
      throw new BffAppError("ERR_FORBIDDEN", 403, "Admin role required for MFA verification.");
    }
    const body = mfaVerifySchema.parse(await c.req.json());
    if (!verifyAdminTotp(body.code)) {
      throw new BffAppError("ERR_FORBIDDEN", 403, "Invalid 6-digit TOTP authenticator code.");
    }
    session.user.mfaVerified = true;
    await store.saveSession(session);
    await recordAudit(store, {
      eventType: "ADMIN_MFA_VERIFIED",
      actorSessionId: session.sessionId,
      actorMemberId: session.user.memberId,
      resourceId: "admin-mfa",
      payload: { method: "totp-rfc6238" },
    });
    attachSessionHeadersAndCookie(c, session);
    return c.json({ mfaVerified: true, user: session.user });
  });

  app.put("/api/bff/v1/admin/cms", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    if (session.user.role !== "admin") {
      throw new BffAppError(
        "ERR_FORBIDDEN",
        403,
        "Admin role required to publish CMS or rules updates.",
      );
    }
    if (session.user.mfaVerified !== true) {
      throw new BffAppError(
        "ERR_FORBIDDEN",
        403,
        "Admin TOTP MFA verification is required before publishing CMS or dark-site updates.",
      );
    }
    const patch = cmsAdminUpdateSchema.parse(await c.req.json());
    const updated = await cms.updateState(patch, session.user.memberName ?? session.sessionId);
    await recordAudit(store, {
      eventType: "CMS_ADMIN_PUBLISH",
      actorSessionId: session.sessionId,
      actorMemberId: session.user.memberId,
      resourceId: `cms-v${updated.version}`,
      payload: {
        darkSiteActive: updated.darkSiteActive,
        featureFlags: updated.featureFlags,
      },
    });
    return c.json({ cms: updated });
  });

  // --- Conversational GenAI Suhail Endpoint (FR-7) ---
  app.post("/api/bff/v1/ai/chat", rateLimitMiddleware(searchLimiter, cache), async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const lang = getLang(c.req.header("accept-language"));
    const body = aiChatSchema.parse(await c.req.json());
    const cmsState = await cms.getState();
    if (!cmsState.featureFlags.genaiSuhailEnabled) {
      throw new BffAppError(
        "ERR_FORBIDDEN",
        403,
        "Suhail GenAI concierge is temporarily paused by administrator.",
      );
    }
    const result = await suhailAi.chat({ message: body.message, lang, session });
    attachSessionHeadersAndCookie(c, session);
    return c.json(result);
  });

  // --- Shopping & Fare Cache incl. Award Search (FR-41, FR-43, FR-48, FR-53..59, FR-68, FR-103) ---
  app.post("/api/bff/v1/shopping/search", rateLimitMiddleware(searchLimiter, cache), async (c) => {
    const parsed = searchSchema.parse(await c.req.json());
    const mix = validatePassengerMix(parsed.passengers);
    if (!mix.valid) throw new BffAppError("ERR_VALIDATION", 400, mix.error);
    if (parsed.origin === parsed.destination) {
      throw new BffAppError(
        "ERR_VALIDATION",
        400,
        "Origin and destination cannot be the same airport.",
      );
    }

    const session = await resolveOrCreateSession(store, c);
    const cmsState = await cms.getState();
    attachSessionHeadersAndCookie(c, session);

    const cacheKey = `search:v${cmsState.version}:${parsed.origin}:${parsed.destination}:${parsed.departDate}:${parsed.returnDate ?? ""}:${parsed.tripType}:${parsed.cabin}:${Boolean(parsed.awardMode)}:${parsed.promoCode ?? ""}:${session.user.tier}:${parsed.nonStopOnly ? "ns" : "all"}:${parsed.sortBy ?? "price"}`;
    const cached = await cache.get<BffSearchResponse>(cacheKey);
    if (cached) {
      return c.json({ ...cached, cached: true });
    }

    const outRes = await pss.searchFlights(
      parsed.origin,
      parsed.destination,
      parsed.departDate,
      session.internalPssToken,
    );
    let secondOffers: BffSearchResponse["secondSegmentOptions"] = [];
    if (parsed.tripType === "roundtrip" && parsed.returnDate) {
      const retRes = await pss.searchFlights(
        parsed.destination,
        parsed.origin,
        parsed.returnDate,
        session.internalPssToken,
      );
      secondOffers = retRes.offers;
    } else if (
      parsed.tripType === "multicity" &&
      parsed.multiLeg2Origin &&
      parsed.multiLeg2Destination &&
      parsed.multiLeg2Date
    ) {
      const leg2Res = await pss.searchFlights(
        parsed.multiLeg2Origin,
        parsed.multiLeg2Destination,
        parsed.multiLeg2Date,
        session.internalPssToken,
      );
      secondOffers = leg2Res.offers;
    }

    const filterAndSort = (list: typeof outRes.offers) =>
      [...list.filter((o) => (!parsed.nonStopOnly ? true : o.stops === 0))].sort((a, b) =>
        parsed.sortBy === "duration"
          ? a.durationMinutes - b.durationMinutes
          : a.priceMultiplier - b.priceMultiplier,
      );

    const outboundOptions = filterAndSort(outRes.offers);
    const secondSegmentOptions = filterAndSort(secondOffers);
    const firstOut = outboundOptions[0] ?? outRes.offers[0]!;
    const firstSec = secondSegmentOptions[0] ?? secondOffers[0];

    const { quotes, promoApplied } = buildBrandedFareQuotes({
      search: parsed as BffSearchRequest,
      outboundOffer: firstOut,
      secondSegOffer: firstSec,
      tier: session.user.tier,
      cmsPromos: cmsState.dynamicPromos,
    });

    const payload: BffSearchResponse = {
      searchId: `srch-${randomUUID().slice(0, 8)}`,
      cached: false,
      awardMode: Boolean(parsed.awardMode),
      routeId: outRes.routeId,
      isLongHaul: outRes.isLongHaul,
      baggageGenerousRoute: outRes.baggageGenerousRoute,
      outboundOptions,
      secondSegmentOptions,
      calendar: outRes.calendar.map((d) => ({
        dateISO: d.dateISO,
        pricesOMR: d.pricesOMR,
        seatsRemaining: d.seatsRemaining,
        soldOut: d.soldOut,
      })),
      brandedFares: quotes,
      promoApplied,
      experimentVariant: session.user.experimentVariant,
      nearbyAlternatives: outRes.nearbyAlternatives,
    };

    await cache.set(cacheKey, payload, 120);
    return c.json(payload);
  });

  app.get("/api/bff/v1/shopping/seats", async (c) => {
    const aircraft =
      c.req.query("aircraft") === "Boeing 737 MAX 8"
        ? "Boeing 737 MAX 8"
        : "Boeing 787-9 Dreamliner";
    const seats = await pss.getSeatMap(aircraft);
    return c.json({ aircraft, seats });
  });

  // --- Omnichannel Cart & Retailing Orchestration (FR-2, FR-40, FR-44, FR-79, FR-85, FR-88, FR-113, FR-115) ---
  app.post("/api/bff/v1/cart", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const pos = getPos(c.req.header("x-omanair-pos"));
    const body = cartUpsertSchema.parse(await c.req.json());
    const cmsState = await cms.getState();

    if (body.cartId) {
      const existing = await store.getCart(body.cartId);
      if (existing && existing.ownerSessionId && existing.ownerSessionId !== session.sessionId) {
        throw new BffAppError(
          "ERR_FORBIDDEN",
          403,
          "Cannot overwrite another session's shopping cart.",
        );
      }
    }

    const outRes = await pss.searchFlights(
      body.search.origin,
      body.search.destination,
      body.search.departDate,
      session.internalPssToken,
    );
    const outboundOffer =
      outRes.offers.find((o) => o.id === body.selectedOutboundId) ?? outRes.offers[0]!;
    let secondSegOffer = undefined;
    if (body.search.tripType === "roundtrip" && body.search.returnDate) {
      const retRes = await pss.searchFlights(
        body.search.destination,
        body.search.origin,
        body.search.returnDate,
        session.internalPssToken,
      );
      secondSegOffer =
        retRes.offers.find((o) => o.id === body.selectedSecondSegId) ?? retRes.offers[0];
    } else if (
      body.search.tripType === "multicity" &&
      body.search.multiLeg2Origin &&
      body.search.multiLeg2Destination &&
      body.search.multiLeg2Date
    ) {
      const leg2Res = await pss.searchFlights(
        body.search.multiLeg2Origin,
        body.search.multiLeg2Destination,
        body.search.multiLeg2Date,
        session.internalPssToken,
      );
      secondSegOffer =
        leg2Res.offers.find((o) => o.id === body.selectedSecondSegId) ?? leg2Res.offers[0];
    }

    const [seatMap, returnSeatMap] = await Promise.all([
      pss.getSeatMap(outboundOffer.aircraft),
      secondSegOffer ? pss.getSeatMap(secondSegOffer.aircraft) : Promise.resolve(undefined),
    ]);
    const insQuote = thirdParty.quoteInsurance({
      pos,
      tier: session.user.tier,
      isLongHaul: outRes.isLongHaul,
    });

    const computed = computeServerCartPricing({
      search: body.search as BffSearchRequest,
      outboundOffer,
      secondSegOffer,
      selectedBrand: body.selectedBrand,
      selectedSeatIds: body.selectedSeatIds ?? [],
      selectedReturnSeatIds: body.selectedReturnSeatIds,
      seatMap,
      returnSeatMap,
      selectedBundleIds: body.selectedBundleIds ?? [],
      selectedAncillaryIds: body.selectedAncillaryIds ?? [],
      selectedMealId: body.selectedMealId ?? "MEAL_STD",
      selectedMealByPax: body.selectedMealByPax,
      insuranceChoice: body.insuranceChoice ?? "unset",
      insuranceUnitOMR: insQuote.effectivePriceOMR,
      tier: session.user.tier,
      pos,
      experimentVariant: session.user.experimentVariant,
      cmsPromos: cmsState.dynamicPromos,
    });

    const cartId = body.cartId || `cart-${randomUUID().slice(0, 12)}`;
    const cart: BffCartState = {
      cartId,
      ownerSessionId: session.sessionId,
      updatedAt: new Date().toISOString(),
      step: body.step ?? 1,
      search: body.search as BffSearchRequest,
      selectedOutboundId: outboundOffer.id,
      selectedSecondSegId: secondSegOffer?.id,
      selectedBrand: body.selectedBrand,
      selectedSeatIds: body.selectedSeatIds ?? [],
      selectedReturnSeatIds: body.selectedReturnSeatIds,
      selectedBundleIds: body.selectedBundleIds ?? [],
      selectedAncillaryIds: body.selectedAncillaryIds ?? [],
      selectedMealId: body.selectedMealId ?? "MEAL_STD",
      selectedMealByPax: body.selectedMealByPax,
      selectedSsrIds: body.selectedSsrIds ?? [],
      insuranceChoice: body.insuranceChoice ?? "unset",
      passengers: body.passengers ?? [],
      pricing: computed.pricing,
      contextualOffers: computed.contextualOffers,
      baggageSummary: computed.baggageSummary,
    };

    await store.saveCart(cart);
    attachSessionHeadersAndCookie(c, session);
    return c.json({ cart, insuranceQuote: insQuote });
  });

  app.get("/api/bff/v1/cart/:cartId", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const cart = await store.getCart(c.req.param("cartId") ?? "");
    if (!cart) throw new BffAppError("ERR_404_PNR", 404, "Shopping cart not found or expired.");
    if (cart.ownerSessionId && cart.ownerSessionId !== session.sessionId) {
      throw new BffAppError("ERR_FORBIDDEN", 403, "Shopping cart belongs to another session.");
    }
    attachSessionHeadersAndCookie(c, session);
    return c.json({ cart });
  });

  app.post("/api/bff/v1/payments/tokenize", async (c) => {
    await resolveOrCreateSession(store, c);
    const body = tokenizeCardSchema.parse(await c.req.json());
    const token = await gateway.tokenizeCard(body);
    return c.json({ token });
  });

  app.post("/api/bff/v1/payments/3ds2/challenge", async (c) => {
    await resolveOrCreateSession(store, c);
    const body = threeDsChallengeSchema.parse(await c.req.json());
    const challenge = await gateway.initiateThreeDs2(body.paymentToken);
    return c.json({ challenge });
  });

  app.post("/api/bff/v1/payments/3ds2/verify", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const body = threeDsVerifySchema.parse(await c.req.json());
    const challenge = await gateway.verifyThreeDs2Challenge(body.threeDsTransId, body.otpCode);
    await recordAudit(store, {
      eventType: "PAYMENT_3DS2_VERIFIED",
      actorSessionId: session.sessionId,
      actorMemberId: session.user.memberId,
      resourceId: challenge.threeDsTransId,
      payload: { paymentToken: challenge.paymentToken, eci: challenge.eci },
    });
    return c.json({ challenge });
  });

  app.post("/api/bff/v1/cart/:cartId/checkout", idempotency, async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const cart = await store.getCart(c.req.param("cartId") ?? "");
    if (!cart) throw new BffAppError("ERR_VALIDATION", 404, "Cart not found.");
    if (cart.ownerSessionId && cart.ownerSessionId !== session.sessionId) {
      throw new BffAppError(
        "ERR_FORBIDDEN",
        403,
        "Cannot checkout another session's shopping cart.",
      );
    }

    const body = checkoutSchema.parse(await c.req.json());
    if (cart.insuranceChoice === "unset") {
      throw new BffAppError("ERR_VALIDATION", 400, "Travel protection choice is required.");
    }
    if (cart.passengers.length === 0) {
      throw new BffAppError("ERR_VALIDATION", 400, "Passenger details are required.");
    }

    for (let i = 0; i < cart.passengers.length; i++) {
      const p = cart.passengers[i]!;
      const icao = validateIcaoPassenger({
        firstName: p.firstName,
        lastName: p.lastName,
        passport: p.passport,
      });
      if (!icao.valid)
        throw new BffAppError("ERR_VALIDATION", 400, `Passenger ${i + 1}: ${icao.errors[0]}`);
      const age = validatePassengerAgeForType(p.dob, p.role, cart.search.departDate);
      if (!age.valid)
        throw new BffAppError("ERR_VALIDATION", 400, `Passenger ${i + 1}: ${age.error}`);
    }

    const outRes = await pss.searchFlights(
      cart.search.origin,
      cart.search.destination,
      cart.search.departDate,
      session.internalPssToken,
    );
    const outboundOffer =
      outRes.offers.find((o) => o.id === cart.selectedOutboundId) ?? outRes.offers[0]!;
    let secondSegOffer = undefined;
    if (cart.search.tripType === "roundtrip" && cart.search.returnDate) {
      const retRes = await pss.searchFlights(
        cart.search.destination,
        cart.search.origin,
        cart.search.returnDate,
        session.internalPssToken,
      );
      secondSegOffer =
        retRes.offers.find((o) => o.id === cart.selectedSecondSegId) ?? retRes.offers[0];
    } else if (
      cart.search.tripType === "multicity" &&
      cart.search.multiLeg2Origin &&
      cart.search.multiLeg2Destination &&
      cart.search.multiLeg2Date
    ) {
      const leg2Res = await pss.searchFlights(
        cart.search.multiLeg2Origin,
        cart.search.multiLeg2Destination,
        cart.search.multiLeg2Date,
        session.internalPssToken,
      );
      secondSegOffer =
        leg2Res.offers.find((o) => o.id === cart.selectedSecondSegId) ?? leg2Res.offers[0];
    }

    const totalOMR = cart.pricing.totalOMR;
    const awardMilesRequired = cart.pricing.awardMilesRequired ?? 0;
    let milesUsed = 0;
    let travelBankUsedOMR = 0;
    let finalCashOMR = 0;

    if (cart.search.awardMode) {
      if (body.mode === "hold") {
        throw new BffAppError("ERR_VALIDATION", 400, "Award bookings require immediate ticketing.");
      }
      if (!session.user.signedIn) throw new BffAppError("ERR_AUTH_REQUIRED", 401);
      if (session.user.miles < awardMilesRequired)
        throw new BffAppError("ERR_INSUFFICIENT_MILES", 400);
      milesUsed = awardMilesRequired;
      travelBankUsedOMR = body.useTravelBank ? Math.min(totalOMR, session.user.travelBankOMR) : 0;
      finalCashOMR = Math.max(0, +(totalOMR - travelBankUsedOMR).toFixed(3));
    } else if (body.mode === "hold") {
      const hrs = body.holdHours === 48 ? 48 : 24;
      finalCashOMR = hrs === 48 ? 15 : 9;
    } else {
      const maxMilesOMR = session.user.signedIn
        ? Math.min(totalOMR * 0.5, Math.floor(session.user.miles / 400))
        : 0;
      const milesOffsetOMR =
        body.useMilesSplit || body.paymentMethod === "miles_cash" ? maxMilesOMR : 0;
      milesUsed = Math.round(milesOffsetOMR * 400);
      const afterMiles = Math.max(0, totalOMR - milesOffsetOMR);
      travelBankUsedOMR = body.useTravelBank ? Math.min(afterMiles, session.user.travelBankOMR) : 0;
      finalCashOMR = Math.max(0, +(afterMiles - travelBankUsedOMR).toFixed(3));
    }

    if (body.paymentToken) {
      await gateway.assertTokenAuthorized(body.paymentToken);
    }

    const authRes = thirdParty.authorizePaymentIntent({
      amountOMR: finalCashOMR,
      method: body.paymentMethod,
      sessionId: session.sessionId,
    });
    if (!authRes.approved) {
      throw new BffAppError("ERR_VALIDATION", 402, "Payment authorization declined.");
    }

    if (milesUsed > 0) session.user.miles = Math.max(0, session.user.miles - milesUsed);
    if (travelBankUsedOMR > 0) {
      session.user.travelBankOMR = Math.max(
        0,
        +(session.user.travelBankOMR - travelBankUsedOMR).toFixed(2),
      );
    }
    const milesEarned = body.mode === "pay" && session.user.signedIn ? cart.pricing.earnedMiles : 0;
    if (milesEarned > 0) {
      session.user.miles += milesEarned;
      session.user.tierPoints += Math.round(milesEarned / 80);
    }

    const rloc = generateRLOC();
    await authorizeSessionBookingAccess(store, session, rloc);

    const ancNames = [
      ...cart.selectedBundleIds.map((id) => VIRTUAL_BUNDLES.find((b) => b.id === id)?.name ?? id),
      ...cart.selectedAncillaryIds.map(
        (id) => DIRECT_ANCILLARIES.find((a) => a.id === id)?.name ?? id,
      ),
      ...(cart.insuranceChoice === "yes" ? ["Travel Protection Insurance"] : []),
    ];
    const emdNumbers =
      ancNames.length > 0 || cart.pricing.ancillariesOMR > 0
        ? [`091-44${Math.floor(1000000 + Math.random() * 8999999)}`]
        : undefined;

    const ssrs = cart.selectedSsrIds
      .map((id) => SSR_OPTIONS.find((x) => x.id === id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({ code: s.code, name: s.name, status: s.status }));

    const booking: SavedBookingPNR = {
      rloc,
      status: body.mode === "hold" ? "HELD" : "CONFIRMED",
      ownerSessionId: session.sessionId,
      ...(session.user.memberId ? { ownerMemberId: session.user.memberId } : {}),
      ...(body.mode === "hold" ? { heldBalanceDueOMR: totalOMR } : {}),
      ...(cart.search.awardMode ? { awardMilesUsed: milesUsed } : {}),
      ...(cart.passengers[0]?.email ? { contactEmail: cart.passengers[0].email } : {}),
      ...(cart.passengers[0]?.phone ? { contactPhone: cart.passengers[0].phone } : {}),
      ...(emdNumbers ? { emdNumbers } : {}),
      origin: cart.search.origin,
      destination: cart.search.destination,
      flightNumber: outboundOffer.flightNumber,
      dateISO: cart.search.departDate,
      departureTime: outboundOffer.departureTime,
      arrivalTime: outboundOffer.arrivalTime,
      ...(secondSegOffer
        ? {
            returnSegment: {
              flightNumber: secondSegOffer.flightNumber,
              dateISO:
                cart.search.tripType === "roundtrip"
                  ? (cart.search.returnDate ?? cart.search.departDate)
                  : (cart.search.multiLeg2Date ?? cart.search.departDate),
              departureTime: secondSegOffer.departureTime,
              arrivalTime: secondSegOffer.arrivalTime,
              origin: secondSegOffer.origin,
              destination: secondSegOffer.destination,
            },
          }
        : {}),
      aircraft: outboundOffer.aircraft,
      fareBrand: cart.selectedBrand,
      passengers: cart.passengers.map((p, idx) => ({
        firstName: p.firstName,
        lastName: p.lastName,
        type: p.role,
        passport: p.passport,
        seat: cart.selectedSeatIds[idx] ?? `${15 + idx}A`,
        ...(cart.selectedReturnSeatIds?.[idx]
          ? { returnSeat: cart.selectedReturnSeatIds[idx] }
          : {}),
        ...(cart.selectedMealByPax?.[idx] ? { mealId: cart.selectedMealByPax[idx] } : {}),
        ...(p.sindbadNo ? { sindbadNo: p.sindbadNo } : {}),
        checkedIn: false,
      })),
      ancillaries: ancNames,
      ssrs,
      totalPaidOMR: finalCashOMR,
      paymentMethod: `${body.paymentDetailLabel} (${authRes.gatewayRef})`,
      gate: "A09",
      terminal: "T1",
      ...(body.mode === "hold"
        ? { holdExpiresAt: computeHoldExpiryISO(body.holdHours === 48 ? 48 : 24) }
        : {}),
    };

    await pss.commitBooking(booking, session.internalPssToken);
    await store.deleteCart(cart.cartId);
    await recordAudit(store, {
      eventType: body.mode === "hold" ? "BOOKING_HELD" : "BOOKING_COMMITTED",
      actorSessionId: session.sessionId,
      actorMemberId: session.user.memberId,
      resourceId: rloc,
      payload: { awardMode: Boolean(cart.search.awardMode), finalCashOMR, milesUsed, emdNumbers },
    });
    attachSessionHeadersAndCookie(c, session);

    return c.json({
      booking: sanitizeBookingForSession(booking),
      milesUsed,
      milesEarned,
      travelBankUsedOMR,
      finalCashOMR,
      session: session.user,
    });
  });

  // --- Post-Booking Servicing (MMB & IRROPS) — Scoped & Authorized ---
  app.get("/api/bff/v1/bookings", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const all = await store.getBookings();
    const visibleBookings = all
      .map(normalizeHoldExpiries)
      .filter((b) => canSessionAccessBooking(session, b))
      .map(sanitizeBookingForSession);
    attachSessionHeadersAndCookie(c, session);
    return c.json({ bookings: visibleBookings });
  });

  app.post("/api/bff/v1/bookings/retrieve", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const body = retrieveBookingSchema.parse(await c.req.json());
    const found = await pss.retrieveBooking(body.rloc, body.lastName, session.internalPssToken);
    if (!found) throw new BffAppError("ERR_404_PNR", 404);
    const normalized = normalizeHoldExpiries(found);
    await store.upsertBooking(normalized);
    await authorizeSessionBookingAccess(store, session, normalized.rloc);
    attachSessionHeadersAndCookie(c, session);
    return c.json({ booking: sanitizeBookingForSession(normalized) });
  });

  app.put("/api/bff/v1/bookings/:rloc/servicing", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const booking = await store.getBooking(c.req.param("rloc") ?? "");
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    assertBookingAccess(session, booking);

    const body = servicePnrSchema.parse(await c.req.json());
    const updated: SavedBookingPNR = {
      ...booking,
      ...(body.contactEmail ? { contactEmail: body.contactEmail } : {}),
      ...(body.contactPhone ? { contactPhone: body.contactPhone } : {}),
      passengers: booking.passengers.map((p, i) =>
        i === 0 && body.sindbadNo ? { ...p, sindbadNo: body.sindbadNo.toUpperCase() } : p,
      ),
    };
    await pss.saveBooking(updated);
    await recordAudit(store, {
      eventType: "PNR_SERVICING_UPDATED",
      actorSessionId: session.sessionId,
      actorMemberId: session.user.memberId,
      resourceId: booking.rloc,
      payload: {
        updatedEmail: Boolean(body.contactEmail),
        updatedPhone: Boolean(body.contactPhone),
        updatedFfp: Boolean(body.sindbadNo),
      },
    });
    attachSessionHeadersAndCookie(c, session);
    return c.json({ booking: sanitizeBookingForSession(updated) });
  });

  app.post("/api/bff/v1/bookings/:rloc/settle-hold", idempotency, async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const booking = await store.getBooking(c.req.param("rloc") ?? "");
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    assertBookingAccess(session, booking);

    const normalized = normalizeHoldExpiries(booking);
    if (normalized.status === "EXPIRED") throw new BffAppError("ERR_HOLD_EXPIRED", 400);
    if (normalized.status !== "HELD") {
      throw new BffAppError(
        "ERR_VALIDATION",
        400,
        "Only HELD bookings can be ticketed via settle-hold.",
      );
    }

    const body = settleHoldSchema.parse(await c.req.json().catch(() => ({})));
    const pssRes = await pss.searchFlights(
      normalized.origin,
      normalized.destination,
      normalized.dateISO,
      session.internalPssToken,
    );
    const fallbackDay =
      pssRes.calendar.find((d) => d.dateISO === normalized.dateISO) ?? pssRes.calendar[0]!;
    const balanceDueOMR =
      normalized.heldBalanceDueOMR ??
      fallbackDay.pricesOMR[normalized.fareBrand] * normalized.passengers.length;

    const maxMilesOMR = session.user.signedIn
      ? Math.min(balanceDueOMR * 0.5, Math.floor(session.user.miles / 400))
      : 0;
    const milesOffsetOMR =
      body.useMilesSplit || body.paymentMethod === "miles_cash" ? maxMilesOMR : 0;
    const milesUsed = Math.round(milesOffsetOMR * 400);
    const afterMiles = Math.max(0, balanceDueOMR - milesOffsetOMR);
    const travelBankUsedOMR = body.useTravelBank
      ? Math.min(afterMiles, session.user.travelBankOMR)
      : 0;
    const finalCashOMR = Math.max(0, +(afterMiles - travelBankUsedOMR).toFixed(3));

    if (body.paymentToken) {
      await gateway.assertTokenAuthorized(body.paymentToken);
    }

    const authRes = thirdParty.authorizePaymentIntent({
      amountOMR: finalCashOMR,
      method: body.paymentMethod,
      sessionId: session.sessionId,
    });
    if (!authRes.approved) {
      throw new BffAppError("ERR_VALIDATION", 402, "Payment authorization declined.");
    }

    if (milesUsed > 0) session.user.miles = Math.max(0, session.user.miles - milesUsed);
    if (travelBankUsedOMR > 0) {
      session.user.travelBankOMR = Math.max(
        0,
        +(session.user.travelBankOMR - travelBankUsedOMR).toFixed(2),
      );
    }
    const milesEarned = session.user.signedIn
      ? calculateSindbadMiles(balanceDueOMR, session.user.tier)
      : 0;
    if (milesEarned > 0) {
      session.user.miles += milesEarned;
      session.user.tierPoints += Math.round(milesEarned / 80);
    }
    await store.saveSession(session);

    const { heldBalanceDueOMR: _cleared, holdExpiresAt: _clearedExp, ...rest } = normalized;
    const updated: SavedBookingPNR = {
      ...rest,
      status: "CONFIRMED",
      totalPaidOMR: +(normalized.totalPaidOMR + finalCashOMR).toFixed(3),
      paymentMethod: `${body.paymentDetailLabel} (${authRes.gatewayRef})`,
    };
    await pss.saveBooking(updated);
    await recordAudit(store, {
      eventType: "BOOKING_HOLD_SETTLED",
      actorSessionId: session.sessionId,
      actorMemberId: session.user.memberId,
      resourceId: booking.rloc,
      payload: { collectedOMR: finalCashOMR, milesUsed },
    });
    attachSessionHeadersAndCookie(c, session);
    return c.json({
      booking: sanitizeBookingForSession(updated),
      collectedOMR: finalCashOMR,
      milesUsed,
      milesEarned,
      travelBankUsedOMR,
      user: session.user,
    });
  });

  app.post("/api/bff/v1/bookings/:rloc/exchange", idempotency, async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const booking = await store.getBooking(c.req.param("rloc") ?? "");
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    assertBookingAccess(session, booking);
    if (booking.status !== "CONFIRMED") {
      throw new BffAppError("ERR_VALIDATION", 400, "Only confirmed bookings can be exchanged.");
    }

    const body = exchangeBookingSchema.parse(await c.req.json());
    const res = await pss.searchFlights(
      booking.origin,
      booking.destination,
      body.newDate,
      session.internalPssToken,
    );
    const oldDay = res.calendar.find((d) => d.dateISO === booking.dateISO) ?? res.calendar[0]!;
    const newDay = res.calendar.find((d) => d.dateISO === body.newDate);
    if (!newDay || newDay.soldOut) {
      throw new BffAppError("ERR_404_INV_CLASS", 404);
    }
    const perPaxQuote = computeExchangeQuote({
      fareBrand: booking.fareBrand,
      oldFareOMR: oldDay.pricesOMR[booking.fareBrand],
      newFareOMR: newDay.pricesOMR[booking.fareBrand],
    });
    const paxCount = Math.max(1, booking.passengers.length);
    const quote = {
      changeFeeOMR: perPaxQuote.changeFeeOMR * paxCount,
      fareDifferenceOMR: perPaxQuote.fareDifferenceOMR * paxCount,
      totalDueOMR: perPaxQuote.totalDueOMR * paxCount,
    };

    let gatewayRef = "NO-CHARGE";
    if (quote.totalDueOMR > 0) {
      const authRes = thirdParty.authorizePaymentIntent({
        amountOMR: quote.totalDueOMR,
        method: "card",
        sessionId: session.sessionId,
      });
      if (!authRes.approved) {
        throw new BffAppError("ERR_VALIDATION", 402, "Exchange payment authorization declined.");
      }
      gatewayRef = authRes.gatewayRef;
    }

    const updated: SavedBookingPNR = {
      ...booking,
      dateISO: body.newDate,
      totalPaidOMR: +(booking.totalPaidOMR + quote.totalDueOMR).toFixed(3),
      paymentMethod:
        quote.totalDueOMR > 0
          ? `${booking.paymentMethod} + Exch (${gatewayRef})`
          : booking.paymentMethod,
    };
    await pss.saveBooking(updated);
    await recordAudit(store, {
      eventType: "BOOKING_EXCHANGED",
      actorSessionId: session.sessionId,
      actorMemberId: session.user.memberId,
      resourceId: booking.rloc,
      payload: { newDate: body.newDate, totalDueOMR: quote.totalDueOMR },
    });
    attachSessionHeadersAndCookie(c, session);
    return c.json({ booking: sanitizeBookingForSession(updated), quote });
  });

  app.post("/api/bff/v1/bookings/:rloc/refund", idempotency, async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const booking = await store.getBooking(c.req.param("rloc") ?? "");
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    assertBookingAccess(session, booking);
    if (booking.status === "REFUNDED" || booking.status === "VOUCHERED") {
      throw new BffAppError(
        "ERR_VALIDATION",
        400,
        "Booking has already been refunded or vouchered.",
      );
    }

    const body = refundBookingSchema.parse(await c.req.json());
    const quote = computeRefundQuote({
      fareBrand: booking.fareBrand,
      totalPaidOMR: booking.totalPaidOMR,
    });
    if (!body.toVoucher && !quote.cashRefundEligible) {
      throw new BffAppError("ERR_NON_REFUNDABLE", 400);
    }
    if (body.toVoucher) {
      session.user.travelBankOMR = +(session.user.travelBankOMR + quote.voucherRefundOMR).toFixed(
        2,
      );
      await store.saveSession(session);
    }
    const updated: SavedBookingPNR = {
      ...booking,
      status: body.toVoucher ? "VOUCHERED" : "REFUNDED",
    };
    await pss.saveBooking(updated);
    await recordAudit(store, {
      eventType: body.toVoucher ? "BOOKING_VOUCHERED" : "BOOKING_REFUNDED",
      actorSessionId: session.sessionId,
      actorMemberId: session.user.memberId,
      resourceId: booking.rloc,
      payload: quote,
    });
    attachSessionHeadersAndCookie(c, session);
    return c.json({ booking: sanitizeBookingForSession(updated), quote, user: session.user });
  });

  app.post("/api/bff/v1/bookings/:rloc/split", idempotency, async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const booking = await store.getBooking(c.req.param("rloc") ?? "");
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    assertBookingAccess(session, booking);
    if (booking.passengers.length < 2) {
      throw new BffAppError("ERR_VALIDATION", 400, "Need at least 2 passengers to split PNR.");
    }
    const split = await pss.splitBooking(booking);
    await authorizeSessionBookingAccess(store, session, split.child.rloc);
    await recordAudit(store, {
      eventType: "BOOKING_SPLIT",
      actorSessionId: session.sessionId,
      actorMemberId: session.user.memberId,
      resourceId: booking.rloc,
      payload: { childRloc: split.child.rloc },
    });
    attachSessionHeadersAndCookie(c, session);
    return c.json({
      parent: sanitizeBookingForSession(split.parent),
      child: sanitizeBookingForSession(split.child),
    });
  });

  app.post("/api/bff/v1/bookings/:rloc/ancillaries", idempotency, async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const booking = await store.getBooking(c.req.param("rloc") ?? "");
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    assertBookingAccess(session, booking);

    const body = addBookingAncillarySchema.parse(await c.req.json());
    const milesCost = Math.round(body.priceOMR * 400);
    if (body.payWithMiles && body.priceOMR > 0) {
      if (!session.user.signedIn) throw new BffAppError("ERR_AUTH_REQUIRED", 401);
      if (session.user.miles < milesCost) throw new BffAppError("ERR_INSUFFICIENT_MILES", 400);
      session.user.miles -= milesCost;
      await store.saveSession(session);
    } else if (body.priceOMR > 0) {
      const authRes = thirdParty.authorizePaymentIntent({
        amountOMR: body.priceOMR,
        method: "card",
        sessionId: session.sessionId,
      });
      if (!authRes.approved)
        throw new BffAppError("ERR_VALIDATION", 402, "Payment authorization declined.");
    }

    const emd =
      body.priceOMR > 0 ? `091-44${Math.floor(1000000 + Math.random() * 8999999)}` : undefined;
    const tag = body.payWithMiles && body.priceOMR > 0 ? `${body.label} (Miles)` : body.label;
    const updated: SavedBookingPNR = {
      ...booking,
      ancillaries: booking.ancillaries.includes(tag)
        ? booking.ancillaries
        : [...booking.ancillaries, tag],
      ...(emd ? { emdNumbers: [...(booking.emdNumbers ?? []), emd] } : {}),
      ...(body.payWithMiles
        ? {}
        : { totalPaidOMR: +(booking.totalPaidOMR + body.priceOMR).toFixed(3) }),
    };
    await pss.saveBooking(updated);
    attachSessionHeadersAndCookie(c, session);
    return c.json({ booking: sanitizeBookingForSession(updated), user: session.user });
  });

  app.post("/api/bff/v1/bookings/:rloc/upgrade-miles", idempotency, async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const booking = await store.getBooking(c.req.param("rloc") ?? "");
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    assertBookingAccess(session, booking);
    if (!session.user.signedIn) throw new BffAppError("ERR_AUTH_REQUIRED", 401);

    const opt = getMilesUpgradeOption(booking.fareBrand);
    if (!opt.eligible || !opt.targetBrand) {
      throw new BffAppError("ERR_VALIDATION", 400, opt.reason);
    }
    if (session.user.miles < opt.milesRequired) {
      throw new BffAppError("ERR_INSUFFICIENT_MILES", 400);
    }
    session.user.miles -= opt.milesRequired;
    await store.saveSession(session);

    const updated: SavedBookingPNR = {
      ...booking,
      fareBrand: opt.targetBrand,
      ancillaries: [...booking.ancillaries, `Miles Upgrade → ${FARE_BRANDS[opt.targetBrand].name}`],
    };
    await pss.saveBooking(updated);
    attachSessionHeadersAndCookie(c, session);
    return c.json({ booking: sanitizeBookingForSession(updated), user: session.user });
  });

  app.post("/api/bff/v1/bookings/:rloc/irrops", idempotency, async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const booking = await store.getBooking(c.req.param("rloc") ?? "");
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    assertBookingAccess(session, booking);

    const body = irropsActionSchema.parse(await c.req.json());
    if (body.action === "voucher") {
      session.user.travelBankOMR = +(
        session.user.travelBankOMR +
        booking.totalPaidOMR +
        25
      ).toFixed(2);
      await store.saveSession(session);
      const updated: SavedBookingPNR = { ...booking, status: "VOUCHERED" };
      await pss.saveBooking(updated);
      attachSessionHeadersAndCookie(c, session);
      return c.json({ booking: sanitizeBookingForSession(updated), user: session.user });
    }
    const { disruptionNote: _removed, ...rest } = booking;
    const rebooked: SavedBookingPNR = {
      ...rest,
      status: "CONFIRMED",
      flightNumber: body.flightNumber ?? "WY 607",
      departureTime: body.departureTime ?? "14:15",
      arrivalTime: body.arrivalTime ?? "15:25",
    };
    if (body.action === "rebook_and_checkin") {
      const ci = await pss.checkIn(rebooked, false, true);
      attachSessionHeadersAndCookie(c, session);
      return c.json({
        booking: sanitizeBookingForSession(ci.booking),
        bcbpPayloads: ci.bcbpPayloads,
        user: session.user,
      });
    }
    await pss.saveBooking(rebooked);
    attachSessionHeadersAndCookie(c, session);
    return c.json({ booking: sanitizeBookingForSession(rebooked), user: session.user });
  });

  // --- Check-in, Biometrics, Auto-Check-In & Cross-Channel Handoff (FR-49, FR-50, FR-138) ---
  app.post("/api/bff/v1/checkin/:rloc/complete", idempotency, async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const booking = await store.getBooking(c.req.param("rloc") ?? "");
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    assertBookingAccess(session, booking);

    const normalized = normalizeHoldExpiries(booking);
    if (normalized.status !== "CONFIRMED" || normalized.ssrs.some((s) => s.code === "UMNR")) {
      throw new BffAppError("ERR_CHECKIN_INHIBITED", 400);
    }
    const body = checkInCompleteSchema.parse(await c.req.json().catch(() => ({})));
    const result = await pss.checkIn(
      normalized,
      Boolean(body.biometricOptIn),
      body.requestBagTags !== false,
    );
    await recordAudit(store, {
      eventType: "DCS_CHECKIN_COMPLETED",
      actorSessionId: session.sessionId,
      actorMemberId: session.user.memberId,
      resourceId: booking.rloc,
      payload: { biometricOptIn: Boolean(body.biometricOptIn) },
    });
    attachSessionHeadersAndCookie(c, session);
    return c.json({
      booking: sanitizeBookingForSession(result.booking),
      bcbpPayloads: result.bcbpPayloads,
    });
  });

  app.post("/api/bff/v1/checkin/:rloc/offload", idempotency, async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const booking = await store.getBooking(c.req.param("rloc") ?? "");
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    assertBookingAccess(session, booking);

    const updated = await pss.offloadCheckIn(booking);
    attachSessionHeadersAndCookie(c, session);
    return c.json({ booking: sanitizeBookingForSession(updated) });
  });

  app.post("/api/bff/v1/checkin/:rloc/upgrade", idempotency, async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const booking = await store.getBooking(c.req.param("rloc") ?? "");
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    assertBookingAccess(session, booking);

    const body = checkInUpgradeSchema.parse(await c.req.json());
    const priceOMR = body.kind === "biz" ? 115 : 14;
    const milesCost = priceOMR * 400;
    const label = body.kind === "biz" ? "Check-in Business Upgrade" : "Check-in Extra 10 kg Bag";

    if (body.payWithMiles) {
      if (!session.user.signedIn) throw new BffAppError("ERR_AUTH_REQUIRED", 401);
      if (session.user.miles < milesCost) throw new BffAppError("ERR_INSUFFICIENT_MILES", 400);
      session.user.miles -= milesCost;
      await store.saveSession(session);
    } else {
      const authRes = thirdParty.authorizePaymentIntent({
        amountOMR: priceOMR,
        method: "card",
        sessionId: session.sessionId,
      });
      if (!authRes.approved)
        throw new BffAppError("ERR_VALIDATION", 402, "Payment authorization declined.");
    }

    const updated: SavedBookingPNR = {
      ...booking,
      ...(body.kind === "biz" ? { fareBrand: "BIZ_COMFORT" } : {}),
      ancillaries: booking.ancillaries.includes(label)
        ? booking.ancillaries
        : [...booking.ancillaries, label],
      ...(body.payWithMiles ? {} : { totalPaidOMR: +(booking.totalPaidOMR + priceOMR).toFixed(3) }),
    };
    await pss.saveBooking(updated);
    attachSessionHeadersAndCookie(c, session);
    return c.json({ booking: sanitizeBookingForSession(updated), user: session.user });
  });

  app.post("/api/bff/v1/checkin/:rloc/biometric", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const booking = await store.getBooking(c.req.param("rloc") ?? "");
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    assertBookingAccess(session, booking);

    const body = biometricSchema.parse(await c.req.json());
    const updated: SavedBookingPNR = { ...booking, biometricOptIn: Boolean(body.consent) };
    await pss.saveBooking(updated);
    attachSessionHeadersAndCookie(c, session);
    return c.json({
      booking: sanitizeBookingForSession(updated),
      bimsEnrollmentId: body.consent ? `BIMS-${booking.rloc}-ENROLLED` : null,
    });
  });

  app.get("/api/bff/v1/checkin/:rloc/auto-eligible", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const booking = await store.getBooking(c.req.param("rloc") ?? "");
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    assertBookingAccess(session, booking);

    const eligible =
      booking.status === "CONFIRMED" &&
      !booking.ssrs.some((s) => s.code === "UMNR") &&
      (session.user.tier === "Gold" || FARE_BRANDS[booking.fareBrand].cabin !== "economy");
    return c.json({ rloc: booking.rloc, autoCheckInEligible: eligible });
  });

  app.get("/api/bff/v1/checkin/:rloc/wallet/apple/:paxIdx", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const booking = await store.getBooking(c.req.param("rloc") ?? "");
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    assertBookingAccess(session, booking);

    const paxIdx = Math.max(0, Number.parseInt(c.req.param("paxIdx") ?? "0", 10) || 0);
    const pkpassBuf = generateApplePkpassBuffer(booking, paxIdx);
    await recordAudit(store, {
      eventType: "WALLET_PASS_ISSUED",
      actorSessionId: session.sessionId,
      actorMemberId: session.user.memberId,
      resourceId: booking.rloc,
      payload: { provider: "apple-pkpass", paxIdx },
    });
    c.header("Content-Type", "application/vnd.apple.pkpass");
    c.header(
      "Content-Disposition",
      `attachment; filename="OmanAir-${booking.rloc}-Pax${paxIdx + 1}.pkpass"`,
    );
    return c.body(new Uint8Array(pkpassBuf));
  });

  app.get("/api/bff/v1/checkin/:rloc/wallet/google/:paxIdx", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const booking = await store.getBooking(c.req.param("rloc") ?? "");
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    assertBookingAccess(session, booking);

    const paxIdx = Math.max(0, Number.parseInt(c.req.param("paxIdx") ?? "0", 10) || 0);
    const walletRes = generateGoogleWalletSaveJwt(booking, paxIdx);
    await recordAudit(store, {
      eventType: "WALLET_PASS_ISSUED",
      actorSessionId: session.sessionId,
      actorMemberId: session.user.memberId,
      resourceId: booking.rloc,
      payload: { provider: "google-wallet", paxIdx },
    });
    return c.json(walletRes);
  });

  app.post("/api/bff/v1/handoff/token", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const body = handoffTokenSchema.parse(await c.req.json());
    const booking = await store.getBooking(body.rloc);
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    assertBookingAccess(session, booking);

    const payload = {
      token: `hoff_${randomUUID()}`,
      rloc: booking.rloc,
      flow: body.flow ?? "checkin",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    await store.saveHandoff(payload);
    attachSessionHeadersAndCookie(c, session);
    return c.json(payload);
  });

  app.get("/api/bff/v1/handoff/:token", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const found = await store.consumeHandoff(c.req.param("token") ?? "");
    if (!found) throw new BffAppError("ERR_HOLD_EXPIRED", 404, "Handoff token invalid or expired.");
    const booking = await store.getBooking(found.rloc);
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    await authorizeSessionBookingAccess(store, session, booking.rloc);
    attachSessionHeadersAndCookie(c, session);
    return c.json({ handoff: found, booking: sanitizeBookingForSession(booking) });
  });

  // --- Loyalty / Sindbad LMS Routes (FR-24, FR-109) ---
  app.get("/api/bff/v1/loyalty/profile", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const [household, claimedPnrs] = await Promise.all([
      lms.getHousehold(session.user.signedIn ? session.user.memberId : undefined),
      lms.getClaimedPnrs(session.user.signedIn ? session.user.memberId : undefined),
    ]);
    attachSessionHeadersAndCookie(c, session);
    return c.json({
      user: session.user,
      household,
      claimedPnrs,
    });
  });

  app.post("/api/bff/v1/loyalty/retro-claim", idempotency, async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const body = retroClaimSchema.parse(await c.req.json());
    const result = await lms.retroClaim(session, body.pnr);
    attachSessionHeadersAndCookie(c, session);
    return c.json({ milesCredited: result.milesCredited, user: result.session.user });
  });

  app.post("/api/bff/v1/loyalty/redeem", idempotency, async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const body = redeemCatalogSchema.parse(await c.req.json());
    const result = await lms.redeemCatalogItem(session, body.itemId);
    attachSessionHeadersAndCookie(c, session);
    return c.json({ voucherCode: result.voucherCode, user: result.session.user });
  });

  app.post("/api/bff/v1/loyalty/household", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    if (!session.user.signedIn || !session.user.memberId) {
      throw new BffAppError("ERR_AUTH_REQUIRED", 401);
    }
    const body = householdAddSchema.parse(await c.req.json());
    const household = await lms.addHouseholdMember(session.user.memberId, body.name, body.relation);
    attachSessionHeadersAndCookie(c, session);
    return c.json({ household });
  });

  app.delete("/api/bff/v1/loyalty/household/:id", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    if (!session.user.signedIn || !session.user.memberId) {
      throw new BffAppError("ERR_AUTH_REQUIRED", 401);
    }
    const household = await lms.removeHouseholdMember(
      session.user.memberId,
      c.req.param("id") ?? "",
    );
    attachSessionHeadersAndCookie(c, session);
    return c.json({ household });
  });

  // --- 3rd-Party Partner SSO Handoff (FR-119) ---
  app.post("/api/bff/v1/partners/sso", async (c) => {
    const session = await resolveOrCreateSession(store, c);
    const body = partnerSsoSchema.parse(await c.req.json().catch(() => ({})));
    return c.json(thirdParty.issuePartnerSsoHandoff(body.partner, session.user.memberId));
  });

  // --- Flight Status Cache (FR-28, FR-42) ---
  app.get("/api/bff/v1/status/flights", rateLimitMiddleware(searchLimiter, cache), async (c) => {
    const q = (c.req.query("q") ?? "").trim().toUpperCase();
    const cacheKey = "status:all_routes";
    let routes = await cache.get<Awaited<ReturnType<typeof pss.getFlightTimetable>>>(cacheKey);
    const cached = Boolean(routes);
    if (!routes) {
      routes = await pss.getFlightTimetable();
      await cache.set(cacheKey, routes, 60);
    }
    const items = routes
      .map((r, idx) => ({
        ...r,
        gate: `T1 · A${10 + (idx % 12)}`,
        status:
          r.flightNumber === "WY 603"
            ? "DISRUPTED (IRROPS)"
            : idx % 5 === 1
              ? "BOARDING"
              : "ON TIME",
      }))
      .filter((r) => !q || r.flightNumber.toUpperCase().includes(q) || r.destination.includes(q));
    return c.json({ cached, items });
  });

  return app;
}
