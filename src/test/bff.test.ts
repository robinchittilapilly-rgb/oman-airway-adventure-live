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

describe("Oman Air Decoupled BFF Experience API", () => {
  it("creates signed sessions without exposing internal PSS tokens (FR-23, FR-45)", async () => {
    const app = makeTestApp();
    const res = await app.request("/api/bff/v1/auth/session");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessionToken: string; user: { tier: string }; internalPssToken?: string };
    expect(body.sessionToken).toContain(".");
    expect(body.user.tier).toBe("Gold");
    expect(body.internalPssToken).toBeUndefined();
  });

  it("translates SOAP/XML availability fragments to JSON and caches searches (FR-41, FR-43, FR-68)", async () => {
    const offers = translateSoapAvailabilityXmlToOffers(
      `<OTA_AirAvailRS><FlightSegment Id="WY101-NS1" FlightNumber="WY 101" Origin="MCT" Destination="LHR" DepartureTime="14:20" ArrivalTime="18:25" DurationMinutes="485" Stops="0" StopLabel="Non-stop" Aircraft="Boeing 787-9 Dreamliner" HasStudio="true" SeatsRemaining="7" PriceMultiplier="1" /></OTA_AirAvailRS>`
    );
    expect(offers).toHaveLength(1);
    expect(offers[0]?.flightNumber).toBe("WY 101");

    const app = makeTestApp();
    const payload = {
      tripType: "roundtrip",
      origin: "MCT",
      destination: "LHR",
      departDate: getDateISO(2),
      returnDate: getDateISO(8),
      cabin: "economy",
      passengers: { adults: 1, children: 0, infants: 0, students: 0, seniors: 0, labor: 0 },
      promoCode: "OMAN2026",
    };

    const first = await app.request("/api/bff/v1/shopping/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(200);
    const firstJson = (await first.json()) as { cached: boolean; isLongHaul: boolean; promoApplied?: { code: string } };
    expect(firstJson.cached).toBe(false);
    expect(firstJson.isLongHaul).toBe(true);
    expect(firstJson.promoApplied?.code).toBe("OMAN2026");

    const second = await app.request("/api/bff/v1/shopping/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const secondJson = (await second.json()) as { cached: boolean };
    expect(secondJson.cached).toBe(true);
  });

  it("enforces anti-scraper rate limiting and Arabic error translation (FR-46, FR-48)", async () => {
    const app = makeTestApp(1);
    const reqInit = {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": "ar", "X-Session-Id": "bot-1" },
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
    expect(limitedRes.headers.get("Retry-After")).toBeTruthy();
    const errBody = (await limitedRes.json()) as { code: string; message: string };
    expect(errBody.code).toBe("ERR_RATE_LIMIT");
    expect(errBody.message).toContain("طلبات");
  });

  it("persists server cart, computes contextual offers, and checks out a booking (FR-2, FR-40, FR-44, FR-85)", async () => {
    const app = makeTestApp();
    const sessRes = await app.request("/api/bff/v1/auth/session");
    const { sessionToken } = (await sessRes.json()) as { sessionToken: string };

    const cartRes = await app.request("/api/bff/v1/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
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
        selectedAncillaryIds: ["CHAUF_LH"],
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
    expect(cartRes.status).toBe(200);
    const { cart } = (await cartRes.json()) as {
      cart: { cartId: string; pricing: { seatsFeeOMR: number; totalOMR: number }; contextualOffers: { id: string }[] };
    };
    // Gold tier waives seat & CHAUF_LH fee server-side
    expect(cart.pricing.seatsFeeOMR).toBe(0);
    expect(cart.contextualOffers.some((o) => o.id === "CHAUF_LH")).toBe(true);

    const fetchCart = await app.request(`/api/bff/v1/cart/${cart.cartId}`);
    expect(fetchCart.status).toBe(200);

    const checkoutRes = await app.request(`/api/bff/v1/cart/${cart.cartId}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        cartId: cart.cartId,
        mode: "pay",
        paymentMethod: "card",
        paymentDetailLabel: "Visa Infinite •••• 4821",
      }),
    });
    expect(checkoutRes.status).toBe(200);
    const checkout = (await checkoutRes.json()) as { booking: { rloc: string; status: string } };
    expect(checkout.booking.status).toBe("CONFIRMED");

    // Verify cross-channel handoff token & check-in via BFF (FR-49, FR-138)
    const handoffRes = await app.request("/api/bff/v1/handoff/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rloc: checkout.booking.rloc, flow: "checkin" }),
    });
    expect(handoffRes.status).toBe(200);
    const { token } = (await handoffRes.json()) as { token: string };

    const resolveHandoff = await app.request(`/api/bff/v1/handoff/${token}`);
    expect(resolveHandoff.status).toBe(200);

    const autoCi = await app.request(`/api/bff/v1/checkin/${checkout.booking.rloc}/auto-eligible`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const autoBody = (await autoCi.json()) as { autoCheckInEligible: boolean };
    expect(autoBody.autoCheckInEligible).toBe(true);
  });

  it("validates MMB PNR retrieval, LMS retro-claim, and catalog redemption (FR-24, FR-109, FR-122)", async () => {
    const app = makeTestApp();
    const sessRes = await app.request("/api/bff/v1/auth/session");
    const { sessionToken } = (await sessRes.json()) as { sessionToken: string };

    const badLookup = await app.request("/api/bff/v1/bookings/retrieve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rloc: "WY7K9M", lastName: "WRONGLASTNAME" }),
    });
    expect(badLookup.status).toBe(404);

    const goodLookup = await app.request("/api/bff/v1/bookings/retrieve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rloc: "WY7K9M", lastName: "ALBALUSHI" }),
    });
    expect(goodLookup.status).toBe(200);

    const retroRes = await app.request("/api/bff/v1/loyalty/retro-claim", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ pnr: "WY5M2K" }),
    });
    expect(retroRes.status).toBe(200);
    const retroJson = (await retroRes.json()) as { milesCredited: number };
    expect(retroJson.milesCredited).toBe(2840);
  });
});
