import { describe, expect, it } from "vitest";
import { createBffApp } from "../../bff/app";
import { translateSoapAvailabilityXmlToOffers } from "../../bff/adapters/pssAdapter";
import { SlidingWindowRateLimiter } from "../../bff/middleware/rateLimiter";
import { MemoryCacheStore } from "../../bff/stores/cacheStore";
import { FileBackedSessionStore } from "../../bff/stores/sessionStore";
import { getDateISO } from "../data/omanAirRoutes";

function makeTestApp(maxSearchPerMin = 30) {
  return createBffApp({
    cache: new MemoryCacheStore(),
    store: new FileBackedSessionStore(),
    searchRateLimiter: new SlidingWindowRateLimiter(maxSearchPerMin, 60_000),
  });
}

describe("Oman Air Decoupled BFF Experience API (Phase 0 & Phase 1)", () => {
  it("defaults new sessions to unauthenticated Guest, sets HttpOnly cookie, and gates demo tier switching (FR-23, FR-45)", async () => {
    const app = makeTestApp();
    const res = await app.request("/api/bff/v1/auth/session");
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toContain("oman_air_session=");
    expect(res.headers.get("Set-Cookie")).toContain("HttpOnly");

    const body = (await res.json()) as {
      sessionToken: string;
      user: { signedIn: boolean; role: string; tier: string; miles: number };
      internalPssToken?: string;
    };
    expect(body.sessionToken).toContain(".");
    expect(body.user.signedIn).toBe(false);
    expect(body.user.role).toBe("guest");
    expect(body.user.tier).toBe("Blue");
    expect(body.user.miles).toBe(0);
    expect(body.internalPssToken).toBeUndefined();

    const prevFlag = process.env["BFF_ALLOW_DEMO_AUTH"];
    process.env["BFF_ALLOW_DEMO_AUTH"] = "false";
    try {
      const blockedTier = await app.request("/api/bff/v1/auth/tier", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${body.sessionToken}`,
        },
        body: JSON.stringify({ tier: "Gold" }),
      });
      expect(blockedTier.status).toBe(403);
    } finally {
      if (prevFlag === undefined) delete process.env["BFF_ALLOW_DEMO_AUTH"];
      else process.env["BFF_ALLOW_DEMO_AUTH"] = prevFlag;
    }

    const loginRes = await app.request("/api/bff/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${body.sessionToken}` },
      body: JSON.stringify({ mode: "demo", memberName: "Tariq Al-Balushi", tier: "Gold" }),
    });
    expect(loginRes.status).toBe(200);
    const loginJson = (await loginRes.json()) as {
      user: { signedIn: boolean; tier: string; miles: number };
    };
    expect(loginJson.user.signedIn).toBe(true);
    expect(loginJson.user.tier).toBe("Gold");
    expect(loginJson.user.miles).toBeGreaterThan(0);
  });

  it("supports OAuth2/OIDC PKCE S256 exchange and enforces RBAC on CMS Admin routes (FR-23, FR-35, FR-36)", async () => {
    const app = makeTestApp();
    const sessRes = await app.request("/api/bff/v1/auth/session");
    const { sessionToken } = (await sessRes.json()) as { sessionToken: string };

    // Anonymous guest cannot access /admin/overview
    const forbiddenOverview = await app.request("/api/bff/v1/admin/overview", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    expect(forbiddenOverview.status).toBe(403);

    // Start OIDC PKCE flow requesting admin role
    const authInitRes = await app.request("/api/bff/v1/auth/oidc/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ redirectUri: "http://localhost:8080/admin", requestedRole: "admin" }),
    });
    expect(authInitRes.status).toBe(200);
    const authInit = (await authInitRes.json()) as {
      state: string;
      codeChallengeMethod: string;
      sandboxAuthCode: string;
      sandboxCodeVerifier: string;
    };
    expect(authInit.codeChallengeMethod).toBe("S256");

    // Wrong verifier fails 401
    const badCb = await app.request("/api/bff/v1/auth/oidc/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        state: authInit.state,
        code: authInit.sandboxAuthCode,
        codeVerifier: "invalid-verifier-should-fail-s256-check",
      }),
    });
    expect(badCb.status).toBe(401);

    // Issue fresh challenge and exchange cleanly
    const authInit2Res = await app.request("/api/bff/v1/auth/oidc/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ redirectUri: "http://localhost:8080/admin", requestedRole: "admin" }),
    });
    const authInit2 = (await authInit2Res.json()) as typeof authInit;
    const okCb = await app.request("/api/bff/v1/auth/oidc/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        state: authInit2.state,
        code: authInit2.sandboxAuthCode,
        codeVerifier: authInit2.sandboxCodeVerifier,
        memberName: "Oman Air Admin",
        role: "admin",
      }),
    });
    expect(okCb.status).toBe(200);

    // Admin publishes CMS Dark Site toggle & dynamic promo
    const cmsUpdateRes = await app.request("/api/bff/v1/admin/cms", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        darkSiteActive: true,
        upsertPromo: { code: "EID30", discountPct: 30, label: "30% Eid Special", active: true },
      }),
    });
    expect(cmsUpdateRes.status).toBe(200);
    const cmsUpdate = (await cmsUpdateRes.json()) as {
      cms: { darkSiteActive: boolean; dynamicPromos: Record<string, { discountPct: number }> };
    };
    expect(cmsUpdate.cms.darkSiteActive).toBe(true);
    expect(cmsUpdate.cms.dynamicPromos["EID30"]?.discountPct).toBe(30);

    // Site search & admin audit log populated
    const searchCmsRes = await app.request("/api/bff/v1/cms/search?q=baggage");
    expect(searchCmsRes.status).toBe(200);
    const searchCms = (await searchCmsRes.json()) as { articles: { slug: string }[] };
    expect(searchCms.articles.length).toBeGreaterThan(0);

    const overviewRes = await app.request("/api/bff/v1/admin/overview", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    expect(overviewRes.status).toBe(200);
    const overview = (await overviewRes.json()) as { auditLogs: { eventType: string }[] };
    expect(overview.auditLogs.some((a) => a.eventType === "CMS_ADMIN_PUBLISH")).toBe(true);
  });

  it("blocks cross-session IDOR, masks passport PII, and supports PNR servicing updates (FR-45, FR-122, FR-126)", async () => {
    const app = makeTestApp();
    const sessRes = await app.request("/api/bff/v1/auth/session");
    const { sessionToken } = (await sessRes.json()) as { sessionToken: string };

    const listRes = await app.request("/api/bff/v1/bookings", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const listJson = (await listRes.json()) as { bookings: unknown[] };
    expect(listJson.bookings).toHaveLength(0);

    const idorAttempt = await app.request("/api/bff/v1/bookings/WY4D2X/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ toVoucher: true }),
    });
    expect(idorAttempt.status).toBe(403);

    const goodLookup = await app.request("/api/bff/v1/bookings/retrieve", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ rloc: "WY4D2X", lastName: "ALHARTHI" }),
    });
    expect(goodLookup.status).toBe(200);
    const lookupJson = (await goodLookup.json()) as {
      booking: { passengers: { passport: string }[] };
    };
    expect(lookupJson.booking.passengers[0]?.passport).toMatch(/^\*{4,}1022$/);

    const srvRes = await app.request("/api/bff/v1/bookings/WY4D2X/servicing", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ contactEmail: "layla.alharthi@oman.om", sindbadNo: "SB-7711220" }),
    });
    expect(srvRes.status).toBe(200);
    const srvJson = (await srvRes.json()) as { booking: { contactEmail?: string } };
    expect(srvJson.booking.contactEmail).toBe("layla.alharthi@oman.om");
  });

  it("executes Suhail GenAI tool-backed chat & Award booking checkout (FR-7, FR-103, FR-116)", async () => {
    const app = makeTestApp();
    const sessRes = await app.request("/api/bff/v1/auth/session");
    const { sessionToken } = (await sessRes.json()) as { sessionToken: string };
    await app.request("/api/bff/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ mode: "demo", memberName: "Tariq Al-Balushi", tier: "Gold" }),
    });

    // GenAI Suhail concierge runs domain tools
    const aiRes = await app.request("/api/bff/v1/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ message: "What are London fares and promo codes?" }),
    });
    expect(aiRes.status).toBe(200);
    const aiJson = (await aiRes.json()) as { reply: string; toolCallsExecuted: { name: string }[] };
    expect(aiJson.toolCallsExecuted.some((t) => t.name === "pss_search_flights")).toBe(true);
    expect(aiJson.reply).toContain("LHR");

    // Award search & checkout
    const awardCartRes = await app.request("/api/bff/v1/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        step: 3,
        search: {
          tripType: "oneway",
          origin: "MCT",
          destination: "DXB",
          departDate: getDateISO(2),
          cabin: "economy",
          awardMode: true,
          passengers: { adults: 1, children: 0, infants: 0, students: 0, seniors: 0, labor: 0 },
        },
        selectedOutboundId: "WY 603-NS1",
        selectedBrand: "ECO_COMFORT",
        selectedSeatIds: ["12A"],
        selectedBundleIds: [],
        selectedAncillaryIds: ["BAG_10"],
        selectedMealId: "MEAL_STD",
        selectedSsrIds: [],
        insuranceChoice: "no",
        passengers: [
          {
            role: "Adult",
            firstName: "TARIQ",
            lastName: "ALBALUSHI",
            dob: "1996-05-14",
            gender: "M",
            passport: "OM4928174",
            nationality: "Oman",
          },
        ],
      }),
    });
    expect(awardCartRes.status).toBe(200);
    const { cart } = (await awardCartRes.json()) as {
      cart: { cartId: string; pricing: { baseFareOMR: number; awardMilesRequired?: number } };
    };
    expect(cart.pricing.baseFareOMR).toBe(0);
    expect(cart.pricing.awardMilesRequired).toBeGreaterThan(0);

    const checkoutRes = await app.request(`/api/bff/v1/cart/${cart.cartId}/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
        "Idempotency-Key": "award-checkout-001",
      },
      body: JSON.stringify({
        cartId: cart.cartId,
        mode: "pay",
        paymentMethod: "card",
        paymentDetailLabel: "Visa Infinite •••• 4821",
      }),
    });
    expect(checkoutRes.status).toBe(200);
    const co = (await checkoutRes.json()) as {
      milesUsed: number;
      booking: { emdNumbers?: string[]; awardMilesUsed?: number };
    };
    expect(co.milesUsed).toBe(cart.pricing.awardMilesRequired);
    expect(co.booking.emdNumbers?.length).toBeGreaterThan(0);
  });

  it("translates SOAP/XML availability fragments, caches searches, limits scrapers, and settles held fares (FR-41, FR-43, FR-46, FR-48, FR-74)", async () => {
    const offers = translateSoapAvailabilityXmlToOffers(
      `<OTA_AirAvailRS><FlightSegment Id="WY101-NS1" FlightNumber="WY 101" Origin="MCT" Destination="LHR" DepartureTime="14:20" ArrivalTime="18:25" DurationMinutes="485" Stops="0" StopLabel="Non-stop" Aircraft="Boeing 787-9 Dreamliner" HasStudio="true" SeatsRemaining="7" PriceMultiplier="1" /></OTA_AirAvailRS>`,
    );
    expect(offers).toHaveLength(1);

    const app = makeTestApp(1);
    const reqInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": "ar",
        "X-Session-Id": "bot-1",
      },
      body: JSON.stringify({
        tripType: "oneway",
        origin: "MCT",
        destination: "DXB",
        departDate: getDateISO(1),
        cabin: "economy",
        passengers: { adults: 1, children: 0, infants: 0, students: 0, seniors: 0, labor: 0 },
      }),
    };
    const okRes = await app.request("/api/bff/v1/shopping/search", reqInit);
    expect(okRes.status).toBe(200);
    const limitedRes = await app.request("/api/bff/v1/shopping/search", reqInit);
    expect(limitedRes.status).toBe(429);

    // Hold checkout + Idempotency-Key + settle-hold + handoff + retro-claim
    const app2 = makeTestApp();
    const s2 = await app2.request("/api/bff/v1/auth/session");
    const { sessionToken: tok } = (await s2.json()) as { sessionToken: string };
    await app2.request("/api/bff/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ mode: "demo", memberName: "Tariq Al-Balushi", tier: "Gold" }),
    });
    const cartRes = await app2.request("/api/bff/v1/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({
        step: 3,
        search: {
          tripType: "oneway",
          origin: "MCT",
          destination: "LHR",
          departDate: getDateISO(2),
          cabin: "economy",
          passengers: { adults: 1, children: 0, infants: 0, students: 0, seniors: 0, labor: 0 },
        },
        selectedOutboundId: "WY 101-NS1",
        selectedBrand: "ECO_COMFORT",
        selectedSeatIds: ["14A"],
        selectedBundleIds: [],
        selectedAncillaryIds: [],
        selectedMealId: "MEAL_STD",
        selectedSsrIds: [],
        insuranceChoice: "no",
        passengers: [
          {
            role: "Adult",
            firstName: "TARIQ",
            lastName: "ALBALUSHI",
            dob: "1996-05-14",
            gender: "M",
            passport: "OM4928174",
            nationality: "Oman",
          },
        ],
      }),
    });
    const { cart } = (await cartRes.json()) as {
      cart: { cartId: string; pricing: { totalOMR: number } };
    };
    const holdRes = await app2.request(`/api/bff/v1/cart/${cart.cartId}/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tok}`,
        "Idempotency-Key": "hold-idem-test-1",
      },
      body: JSON.stringify({
        cartId: cart.cartId,
        mode: "hold",
        holdHours: 24,
        paymentMethod: "card",
        paymentDetailLabel: "Visa",
      }),
    });
    const holdJson = (await holdRes.json()) as { booking: { rloc: string; totalPaidOMR: number } };
    expect(holdJson.booking.totalPaidOMR).toBe(9);

    const replay = await app2.request(`/api/bff/v1/cart/${cart.cartId}/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tok}`,
        "Idempotency-Key": "hold-idem-test-1",
      },
      body: JSON.stringify({
        cartId: cart.cartId,
        mode: "hold",
        holdHours: 24,
        paymentMethod: "card",
        paymentDetailLabel: "Visa",
      }),
    });
    expect(replay.headers.get("X-Idempotent-Replay")).toBe("true");

    const settleRes = await app2.request(
      `/api/bff/v1/bookings/${holdJson.booking.rloc}/settle-hold`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ paymentMethod: "card", paymentDetailLabel: "Visa" }),
      },
    );
    const settleJson = (await settleRes.json()) as {
      collectedOMR: number;
      booking: { status: string; totalPaidOMR: number };
    };
    expect(settleJson.booking.status).toBe("CONFIRMED");
    expect(settleJson.collectedOMR).toBe(cart.pricing.totalOMR);

    const hoffRes = await app2.request("/api/bff/v1/handoff/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ rloc: "WY7K9M", flow: "checkin" }),
    });
    const { token } = (await hoffRes.json()) as { token: string };
    const consumeRes = await app2.request(`/api/bff/v1/handoff/${token}`);
    expect(consumeRes.status).toBe(200);

    const retroRes = await app2.request("/api/bff/v1/loyalty/retro-claim", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ pnr: "WY5M2K" }),
    });
    expect(retroRes.status).toBe(200);
  });
});
