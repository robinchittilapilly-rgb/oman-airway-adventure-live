import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  FARE_BRANDS,
  findRouteForPair,
  type FareBrandId,
} from "../src/data/omanAirRoutes";
import {
  DIRECT_ANCILLARIES,
  SSR_OPTIONS,
  VIRTUAL_BUNDLES,
  type SavedBookingPNR,
  type SindbadTier,
} from "../src/data/ancillariesAndSeats";
import {
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
import { MockSabrePssAdapter } from "./adapters/pssAdapter";
import { ThirdPartyIntegrationHub } from "./adapters/thirdPartyHub";
import { resolveOrCreateSession, signSessionToken } from "./middleware/authSession";
import { BffAppError, translateBffError } from "./middleware/errorTranslator";
import { SlidingWindowRateLimiter, rateLimitMiddleware } from "./middleware/rateLimiter";
import { buildBrandedFareQuotes, computeServerCartPricing } from "./rules/retailingEngine";
import { createCacheStoreFromEnv, type CacheStore } from "./stores/cacheStore";
import { FileBackedSessionStore, type SessionAndCartStore } from "./stores/sessionStore";
import type {
  AppLang,
  BffCartState,
  BffCheckoutRequest,
  BffSearchRequest,
  BffSearchResponse,
  PointOfSale,
} from "./types";

export interface BffDependencies {
  cache?: CacheStore;
  store?: SessionAndCartStore;
  searchRateLimiter?: SlidingWindowRateLimiter;
}

const searchSchema = z.object({
  tripType: z.enum(["roundtrip", "oneway", "multicity"]),
  origin: z.string().min(3).max(4),
  destination: z.string().min(3).max(4),
  departDate: z.string().min(8),
  returnDate: z.string().optional(),
  multiLeg2Origin: z.string().optional(),
  multiLeg2Destination: z.string().optional(),
  multiLeg2Date: z.string().optional(),
  cabin: z.enum(["economy", "business", "studio"]),
  passengers: z.object({
    adults: z.number().int().min(0),
    children: z.number().int().min(0),
    infants: z.number().int().min(0),
    students: z.number().int().min(0),
    seniors: z.number().int().min(0),
    labor: z.number().int().min(0),
  }),
  promoCode: z.string().optional(),
  currency: z.enum(["OMR", "USD", "AED", "SAR", "EUR", "GBP"]).optional(),
  pos: z.enum(["OM", "AE", "SA", "GB", "EU", "GLOBAL"]).optional(),
  nonStopOnly: z.boolean().optional(),
  sortBy: z.enum(["price", "duration"]).optional(),
});

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
  const store = deps.store ?? new FileBackedSessionStore(process.env["BFF_STATE_FILE"]);
  const pss = new MockSabrePssAdapter(store);
  const lms = new MockSindbadLmsAdapter(store);
  const thirdParty = new ThirdPartyIntegrationHub();
  const searchLimiter = deps.searchRateLimiter ?? new SlidingWindowRateLimiter(30, 60_000);

  const app = new Hono();

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
        return allowedOrigins.includes(origin) ? origin : allowedOrigins[0]!;
      },
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "Accept-Language", "X-Session-Id", "X-OmanAir-POS"],
      exposeHeaders: ["X-Session-Token", "X-OmanAir-Experiment", "X-RateLimit-Remaining", "Retry-After"],
    })
  );

  app.onError((err, c) => {
    const lang = getLang(c.req.header("accept-language"));
    if (err instanceof BffAppError) {
      return c.json(translateBffError(err.code, lang, err.overrideMessage), err.statusCode as 400);
    }
    if (err instanceof z.ZodError) {
      return c.json(translateBffError("ERR_VALIDATION", lang, err.issues[0]?.message), 400);
    }
    const knownCode = err instanceof Error && err.message.startsWith("ERR_") ? err.message : "ERR_INTERNAL";
    const status = knownCode === "ERR_404_PNR" || knownCode === "ERR_404_INV_CLASS" ? 404 : knownCode === "ERR_AUTH_REQUIRED" ? 401 : 400;
    return c.json(translateBffError(knownCode, lang), status);
  });

  app.get("/health", (c) =>
    c.json({ ok: true, service: "oman-air-ibe-bff", version: "1.0.0", timestamp: new Date().toISOString() })
  );

  // --- Auth & Session (FR-23, FR-45, FR-47) ---
  app.get("/api/bff/v1/auth/session", (c) => {
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    c.header("X-Session-Token", signSessionToken(session.sessionId));
    c.header("X-OmanAir-Experiment", session.user.experimentVariant);
    return c.json({
      sessionToken: signSessionToken(session.sessionId),
      user: session.user,
    });
  });

  app.post("/api/bff/v1/auth/login", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { memberName?: string; tier?: SindbadTier };
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    session.user.signedIn = true;
    if (body.memberName?.trim()) session.user.memberName = body.memberName.trim();
    if (body.tier) session.user.tier = body.tier;
    store.saveSession(session);
    const token = signSessionToken(session.sessionId);
    c.header("X-Session-Token", token);
    return c.json({ sessionToken: token, user: session.user });
  });

  app.post("/api/bff/v1/auth/logout", (c) => {
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    session.user.signedIn = false;
    store.saveSession(session);
    return c.json({ user: session.user });
  });

  app.post("/api/bff/v1/auth/tier", async (c) => {
    const body = (await c.req.json()) as { tier: SindbadTier };
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    lms.switchTierDemo(session, body.tier);
    return c.json({ user: session.user });
  });

  // --- Shopping & Fare Cache (FR-41, FR-43, FR-48, FR-53..59, FR-68) ---
  app.post("/api/bff/v1/shopping/search", rateLimitMiddleware(searchLimiter), async (c) => {
    const parsed = searchSchema.parse(await c.req.json());
    const mix = validatePassengerMix(parsed.passengers);
    if (!mix.valid) throw new BffAppError("ERR_VALIDATION", 400, mix.error);
    if (parsed.origin === parsed.destination) {
      throw new BffAppError("ERR_VALIDATION", 400, "Origin and destination cannot be the same airport.");
    }

    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    c.header("X-Session-Token", signSessionToken(session.sessionId));
    c.header("X-OmanAir-Experiment", session.user.experimentVariant);

    const cacheKey = `search:${parsed.origin}:${parsed.destination}:${parsed.departDate}:${parsed.returnDate ?? ""}:${parsed.tripType}:${parsed.cabin}:${parsed.promoCode ?? ""}:${session.user.tier}:${parsed.nonStopOnly ? "ns" : "all"}:${parsed.sortBy ?? "price"}`;
    const cached = await cache.get<BffSearchResponse>(cacheKey);
    if (cached) {
      return c.json({ ...cached, cached: true });
    }

    const outRes = await pss.searchFlights(parsed.origin, parsed.destination, parsed.departDate, session.internalPssToken);
    let secondOffers: BffSearchResponse["secondSegmentOptions"] = [];
    if (parsed.tripType === "roundtrip" && parsed.returnDate) {
      const retRes = await pss.searchFlights(parsed.destination, parsed.origin, parsed.returnDate, session.internalPssToken);
      secondOffers = retRes.offers;
    } else if (parsed.tripType === "multicity" && parsed.multiLeg2Origin && parsed.multiLeg2Destination && parsed.multiLeg2Date) {
      const leg2Res = await pss.searchFlights(parsed.multiLeg2Origin, parsed.multiLeg2Destination, parsed.multiLeg2Date, session.internalPssToken);
      secondOffers = leg2Res.offers;
    }

    const filterAndSort = (list: typeof outRes.offers) =>
      [...list.filter((o) => (!parsed.nonStopOnly ? true : o.stops === 0))].sort((a, b) =>
        parsed.sortBy === "duration" ? a.durationMinutes - b.durationMinutes : a.priceMultiplier - b.priceMultiplier
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
    });

    const payload: BffSearchResponse = {
      searchId: `srch-${Date.now().toString(36)}`,
      cached: false,
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
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    const pos = getPos(c.req.header("x-omanair-pos"));
    const body = (await c.req.json()) as {
      cartId?: string;
      step?: 1 | 2 | 3 | 4;
      search: BffSearchRequest;
      selectedOutboundId: string;
      selectedSecondSegId?: string;
      selectedBrand: FareBrandId;
      selectedSeatIds?: string[];
      selectedBundleIds?: string[];
      selectedAncillaryIds?: string[];
      selectedMealId?: string;
      selectedSsrIds?: string[];
      insuranceChoice?: "unset" | "yes" | "no";
      passengers?: BffCartState["passengers"];
    };

    const outRes = await pss.searchFlights(body.search.origin, body.search.destination, body.search.departDate, session.internalPssToken);
    const outboundOffer = outRes.offers.find((o) => o.id === body.selectedOutboundId) ?? outRes.offers[0]!;
    let secondSegOffer = undefined;
    if (body.search.tripType === "roundtrip" && body.search.returnDate) {
      const retRes = await pss.searchFlights(body.search.destination, body.search.origin, body.search.returnDate, session.internalPssToken);
      secondSegOffer = retRes.offers.find((o) => o.id === body.selectedSecondSegId) ?? retRes.offers[0];
    } else if (body.search.tripType === "multicity" && body.search.multiLeg2Origin && body.search.multiLeg2Destination && body.search.multiLeg2Date) {
      const leg2Res = await pss.searchFlights(body.search.multiLeg2Origin, body.search.multiLeg2Destination, body.search.multiLeg2Date, session.internalPssToken);
      secondSegOffer = leg2Res.offers.find((o) => o.id === body.selectedSecondSegId) ?? leg2Res.offers[0];
    }

    const seatMap = await pss.getSeatMap(outboundOffer.aircraft);
    const insQuote = thirdParty.quoteInsurance({
      pos,
      tier: session.user.tier,
      isLongHaul: outRes.isLongHaul,
    });

    const computed = computeServerCartPricing({
      search: body.search,
      outboundOffer,
      secondSegOffer,
      selectedBrand: body.selectedBrand,
      selectedSeatIds: body.selectedSeatIds ?? [],
      seatMap,
      selectedBundleIds: body.selectedBundleIds ?? [],
      selectedAncillaryIds: body.selectedAncillaryIds ?? [],
      selectedMealId: body.selectedMealId ?? "MEAL_STD",
      insuranceChoice: body.insuranceChoice ?? "unset",
      insuranceUnitOMR: insQuote.effectivePriceOMR,
      tier: session.user.tier,
      pos,
      experimentVariant: session.user.experimentVariant,
    });

    const cartId = body.cartId || `cart-${Math.random().toString(36).slice(2, 10)}`;
    const cart: BffCartState = {
      cartId,
      updatedAt: new Date().toISOString(),
      step: body.step ?? 1,
      search: body.search,
      selectedOutboundId: outboundOffer.id,
      selectedSecondSegId: secondSegOffer?.id,
      selectedBrand: body.selectedBrand,
      selectedSeatIds: body.selectedSeatIds ?? [],
      selectedBundleIds: body.selectedBundleIds ?? [],
      selectedAncillaryIds: body.selectedAncillaryIds ?? [],
      selectedMealId: body.selectedMealId ?? "MEAL_STD",
      selectedSsrIds: body.selectedSsrIds ?? [],
      insuranceChoice: body.insuranceChoice ?? "unset",
      passengers: body.passengers ?? [],
      pricing: computed.pricing,
      contextualOffers: computed.contextualOffers,
      baggageSummary: computed.baggageSummary,
    };

    store.saveCart(cart);
    c.header("X-Session-Token", signSessionToken(session.sessionId));
    return c.json({ cart, insuranceQuote: insQuote });
  });

  app.get("/api/bff/v1/cart/:cartId", (c) => {
    const cart = store.getCart(c.req.param("cartId"));
    if (!cart) throw new BffAppError("ERR_404_PNR", 404, "Shopping cart not found or expired.");
    return c.json({ cart });
  });

  app.post("/api/bff/v1/cart/:cartId/checkout", async (c) => {
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    const cart = store.getCart(c.req.param("cartId"));
    if (!cart) throw new BffAppError("ERR_VALIDATION", 404, "Cart not found.");

    const body = (await c.req.json()) as BffCheckoutRequest;
    if (cart.insuranceChoice === "unset") {
      throw new BffAppError("ERR_VALIDATION", 400, "Travel protection choice is required.");
    }
    if (cart.passengers.length === 0) {
      throw new BffAppError("ERR_VALIDATION", 400, "Passenger details are required.");
    }

    for (let i = 0; i < cart.passengers.length; i++) {
      const p = cart.passengers[i]!;
      const icao = validateIcaoPassenger({ firstName: p.firstName, lastName: p.lastName, passport: p.passport });
      if (!icao.valid) throw new BffAppError("ERR_VALIDATION", 400, `Passenger ${i + 1}: ${icao.errors[0]}`);
      const age = validatePassengerAgeForType(p.dob, p.role, cart.search.departDate);
      if (!age.valid) throw new BffAppError("ERR_VALIDATION", 400, `Passenger ${i + 1}: ${age.error}`);
    }

    const outRes = await pss.searchFlights(cart.search.origin, cart.search.destination, cart.search.departDate, session.internalPssToken);
    const outboundOffer = outRes.offers.find((o) => o.id === cart.selectedOutboundId) ?? outRes.offers[0]!;
    let secondSegOffer = undefined;
    if (cart.search.tripType === "roundtrip" && cart.search.returnDate) {
      const retRes = await pss.searchFlights(cart.search.destination, cart.search.origin, cart.search.returnDate, session.internalPssToken);
      secondSegOffer = retRes.offers.find((o) => o.id === cart.selectedSecondSegId) ?? retRes.offers[0];
    } else if (cart.search.tripType === "multicity" && cart.search.multiLeg2Origin && cart.search.multiLeg2Destination && cart.search.multiLeg2Date) {
      const leg2Res = await pss.searchFlights(cart.search.multiLeg2Origin, cart.search.multiLeg2Destination, cart.search.multiLeg2Date, session.internalPssToken);
      secondSegOffer = leg2Res.offers.find((o) => o.id === cart.selectedSecondSegId) ?? leg2Res.offers[0];
    }

    const totalOMR = cart.pricing.totalOMR;
    let milesUsed = 0;
    let travelBankUsedOMR = 0;
    let finalCashOMR = 0;

    if (body.mode === "hold") {
      const hrs = body.holdHours === 48 ? 48 : 24;
      finalCashOMR = hrs === 48 ? 15 : 9;
    } else {
      const maxMilesOMR = session.user.signedIn ? Math.min(totalOMR * 0.5, Math.floor(session.user.miles / 400)) : 0;
      const milesOffsetOMR = body.useMilesSplit || body.paymentMethod === "miles_cash" ? maxMilesOMR : 0;
      milesUsed = Math.round(milesOffsetOMR * 400);
      const afterMiles = Math.max(0, totalOMR - milesOffsetOMR);
      travelBankUsedOMR = body.useTravelBank ? Math.min(afterMiles, session.user.travelBankOMR) : 0;
      finalCashOMR = Math.max(0, +(afterMiles - travelBankUsedOMR).toFixed(3));
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
    if (travelBankUsedOMR > 0) session.user.travelBankOMR = Math.max(0, +(session.user.travelBankOMR - travelBankUsedOMR).toFixed(2));
    const milesEarned = body.mode === "pay" && session.user.signedIn ? cart.pricing.earnedMiles : 0;
    if (milesEarned > 0) {
      session.user.miles += milesEarned;
      session.user.tierPoints += Math.round(milesEarned / 80);
    }
    store.saveSession(session);

    const rloc = generateRLOC();
    const ancNames = [
      ...cart.selectedBundleIds.map((id) => VIRTUAL_BUNDLES.find((b) => b.id === id)?.name ?? id),
      ...cart.selectedAncillaryIds.map((id) => DIRECT_ANCILLARIES.find((a) => a.id === id)?.name ?? id),
      ...(cart.insuranceChoice === "yes" ? ["Travel Protection Insurance"] : []),
    ];
    const ssrs = cart.selectedSsrIds
      .map((id) => SSR_OPTIONS.find((x) => x.id === id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({ code: s.code, name: s.name, status: s.status }));

    const booking: SavedBookingPNR = {
      rloc,
      status: body.mode === "hold" ? "HELD" : "CONFIRMED",
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
                  ? cart.search.returnDate ?? cart.search.departDate
                  : cart.search.multiLeg2Date ?? cart.search.departDate,
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
        checkedIn: false,
      })),
      ancillaries: ancNames,
      ssrs,
      totalPaidOMR: finalCashOMR,
      paymentMethod: `${body.paymentDetailLabel} (${authRes.gatewayRef})`,
      gate: "A09",
      terminal: "T1",
      ...(body.mode === "hold" ? { holdExpiresAt: computeHoldExpiryISO(body.holdHours === 48 ? 48 : 24) } : {}),
    };

    await pss.commitBooking(booking, session.internalPssToken);
    store.deleteCart(cart.cartId);

    return c.json({
      booking,
      milesUsed,
      milesEarned,
      travelBankUsedOMR,
      finalCashOMR,
      session: session.user,
    });
  });

  // --- Post-Booking Servicing (MMB & IRROPS) ---
  app.get("/api/bff/v1/bookings", (c) => {
    const bookings = store.getBookings().map(normalizeHoldExpiries);
    return c.json({ bookings });
  });

  app.post("/api/bff/v1/bookings/retrieve", async (c) => {
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    const body = (await c.req.json()) as { rloc?: string; lastName?: string };
    if (!body.rloc?.trim() || !body.lastName?.trim()) {
      throw new BffAppError("ERR_VALIDATION", 400, "Both RLOC and passenger last name are required.");
    }
    const found = await pss.retrieveBooking(body.rloc, body.lastName, session.internalPssToken);
    if (!found) throw new BffAppError("ERR_404_PNR", 404);
    const normalized = normalizeHoldExpiries(found);
    store.upsertBooking(normalized);
    return c.json({ booking: normalized });
  });

  app.post("/api/bff/v1/bookings/:rloc/settle-hold", async (c) => {
    const booking = store.getBooking(c.req.param("rloc"));
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    const normalized = normalizeHoldExpiries(booking);
    if (normalized.status === "EXPIRED") throw new BffAppError("ERR_HOLD_EXPIRED", 400);
    const updated: SavedBookingPNR = {
      ...normalized,
      status: "CONFIRMED",
      paymentMethod: "Settled Held Booking via BFF",
    };
    await pss.saveBooking(updated);
    return c.json({ booking: updated });
  });

  app.post("/api/bff/v1/bookings/:rloc/exchange", async (c) => {
    const booking = store.getBooking(c.req.param("rloc"));
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    const body = (await c.req.json()) as { newDate: string };
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    const res = await pss.searchFlights(booking.origin, booking.destination, body.newDate, session.internalPssToken);
    const oldDay = res.calendar.find((d) => d.dateISO === booking.dateISO) ?? res.calendar[0]!;
    const newDay = res.calendar.find((d) => d.dateISO === body.newDate) ?? res.calendar[0]!;
    const quote = computeExchangeQuote({
      fareBrand: booking.fareBrand,
      oldFareOMR: oldDay.pricesOMR[booking.fareBrand],
      newFareOMR: newDay.pricesOMR[booking.fareBrand],
    });
    const updated: SavedBookingPNR = {
      ...booking,
      dateISO: body.newDate,
      totalPaidOMR: booking.totalPaidOMR + quote.totalDueOMR,
    };
    await pss.saveBooking(updated);
    return c.json({ booking: updated, quote });
  });

  app.post("/api/bff/v1/bookings/:rloc/refund", async (c) => {
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    const booking = store.getBooking(c.req.param("rloc"));
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    const body = (await c.req.json()) as { toVoucher: boolean };
    const quote = computeRefundQuote({ fareBrand: booking.fareBrand, totalPaidOMR: booking.totalPaidOMR });
    if (!body.toVoucher && !quote.cashRefundEligible) {
      throw new BffAppError("ERR_NON_REFUNDABLE", 400);
    }
    if (body.toVoucher) {
      session.user.travelBankOMR = +(session.user.travelBankOMR + quote.voucherRefundOMR).toFixed(2);
      store.saveSession(session);
    }
    const updated: SavedBookingPNR = {
      ...booking,
      status: body.toVoucher ? "VOUCHERED" : "REFUNDED",
    };
    await pss.saveBooking(updated);
    return c.json({ booking: updated, quote, user: session.user });
  });

  app.post("/api/bff/v1/bookings/:rloc/split", async (c) => {
    const booking = store.getBooking(c.req.param("rloc"));
    if (!booking || booking.passengers.length < 2) {
      throw new BffAppError("ERR_VALIDATION", 400, "Need at least 2 passengers to split PNR.");
    }
    const split = await pss.splitBooking(booking);
    return c.json(split);
  });

  app.post("/api/bff/v1/bookings/:rloc/ancillaries", async (c) => {
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    const booking = store.getBooking(c.req.param("rloc"));
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    const body = (await c.req.json()) as { label: string; priceOMR: number; payWithMiles?: boolean };
    const milesCost = body.priceOMR * 400;
    if (body.payWithMiles && body.priceOMR > 0) {
      if (!session.user.signedIn) throw new BffAppError("ERR_AUTH_REQUIRED", 401);
      if (session.user.miles < milesCost) throw new BffAppError("ERR_INSUFFICIENT_MILES", 400);
      session.user.miles -= milesCost;
      store.saveSession(session);
    }
    const tag = body.payWithMiles && body.priceOMR > 0 ? `${body.label} (Miles)` : body.label;
    const updated: SavedBookingPNR = {
      ...booking,
      ancillaries: booking.ancillaries.includes(tag) ? booking.ancillaries : [...booking.ancillaries, tag],
      ...(body.payWithMiles ? {} : { totalPaidOMR: booking.totalPaidOMR + body.priceOMR }),
    };
    await pss.saveBooking(updated);
    return c.json({ booking: updated, user: session.user });
  });

  app.post("/api/bff/v1/bookings/:rloc/upgrade-miles", async (c) => {
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    const booking = store.getBooking(c.req.param("rloc"));
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    if (!session.user.signedIn) throw new BffAppError("ERR_AUTH_REQUIRED", 401);

    const opt = getMilesUpgradeOption(booking.fareBrand);
    if (!opt.eligible || !opt.targetBrand) {
      throw new BffAppError("ERR_VALIDATION", 400, opt.reason);
    }
    if (session.user.miles < opt.milesRequired) {
      throw new BffAppError("ERR_INSUFFICIENT_MILES", 400);
    }
    session.user.miles -= opt.milesRequired;
    store.saveSession(session);

    const updated: SavedBookingPNR = {
      ...booking,
      fareBrand: opt.targetBrand,
      ancillaries: [...booking.ancillaries, `Miles Upgrade → ${FARE_BRANDS[opt.targetBrand].name}`],
    };
    await pss.saveBooking(updated);
    return c.json({ booking: updated, user: session.user });
  });

  app.post("/api/bff/v1/bookings/:rloc/irrops", async (c) => {
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    const booking = store.getBooking(c.req.param("rloc"));
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    const body = (await c.req.json()) as {
      action: "rebook" | "voucher" | "rebook_and_checkin";
      flightNumber?: string;
      departureTime?: string;
      arrivalTime?: string;
    };
    if (body.action === "voucher") {
      session.user.travelBankOMR = +(session.user.travelBankOMR + booking.totalPaidOMR + 25).toFixed(2);
      store.saveSession(session);
      const updated: SavedBookingPNR = { ...booking, status: "VOUCHERED" };
      await pss.saveBooking(updated);
      return c.json({ booking: updated, user: session.user });
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
      return c.json({ booking: ci.booking, bcbpPayloads: ci.bcbpPayloads, user: session.user });
    }
    await pss.saveBooking(rebooked);
    return c.json({ booking: rebooked, user: session.user });
  });

  // --- Check-in, Biometrics, Auto-Check-In & Cross-Channel Handoff (FR-49, FR-50, FR-138) ---
  app.post("/api/bff/v1/checkin/:rloc/complete", async (c) => {
    const booking = store.getBooking(c.req.param("rloc"));
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    const normalized = normalizeHoldExpiries(booking);
    if (normalized.status !== "CONFIRMED" || normalized.ssrs.some((s) => s.code === "UMNR")) {
      throw new BffAppError("ERR_CHECKIN_INHIBITED", 400);
    }
    const body = (await c.req.json().catch(() => ({}))) as { biometricOptIn?: boolean; requestBagTags?: boolean };
    const result = await pss.checkIn(normalized, Boolean(body.biometricOptIn), body.requestBagTags !== false);
    return c.json(result);
  });

  app.post("/api/bff/v1/checkin/:rloc/offload", async (c) => {
    const booking = store.getBooking(c.req.param("rloc"));
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    const updated = await pss.offloadCheckIn(booking);
    return c.json({ booking: updated });
  });

  app.post("/api/bff/v1/checkin/:rloc/upgrade", async (c) => {
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    const booking = store.getBooking(c.req.param("rloc"));
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    const body = (await c.req.json()) as { kind: "biz" | "bag"; payWithMiles?: boolean };
    const priceOMR = body.kind === "biz" ? 115 : 14;
    const milesCost = priceOMR * 400;
    const label = body.kind === "biz" ? "Check-in Business Upgrade" : "Check-in Extra 10 kg Bag";

    if (body.payWithMiles) {
      if (!session.user.signedIn) throw new BffAppError("ERR_AUTH_REQUIRED", 401);
      if (session.user.miles < milesCost) throw new BffAppError("ERR_INSUFFICIENT_MILES", 400);
      session.user.miles -= milesCost;
      store.saveSession(session);
    }

    const updated: SavedBookingPNR = {
      ...booking,
      ...(body.kind === "biz" ? { fareBrand: "BIZ_COMFORT" } : {}),
      ancillaries: booking.ancillaries.includes(label) ? booking.ancillaries : [...booking.ancillaries, label],
      ...(body.payWithMiles ? {} : { totalPaidOMR: booking.totalPaidOMR + priceOMR }),
    };
    await pss.saveBooking(updated);
    return c.json({ booking: updated, user: session.user });
  });

  app.post("/api/bff/v1/checkin/:rloc/biometric", async (c) => {
    const booking = store.getBooking(c.req.param("rloc"));
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    const body = (await c.req.json()) as { consent: boolean };
    const updated: SavedBookingPNR = { ...booking, biometricOptIn: Boolean(body.consent) };
    await pss.saveBooking(updated);
    return c.json({
      booking: updated,
      bimsEnrollmentId: body.consent ? `BIMS-${booking.rloc}-ENROLLED` : null,
    });
  });

  app.get("/api/bff/v1/checkin/:rloc/auto-eligible", (c) => {
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    const booking = store.getBooking(c.req.param("rloc"));
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    const eligible =
      booking.status === "CONFIRMED" &&
      !booking.ssrs.some((s) => s.code === "UMNR") &&
      (session.user.tier === "Gold" || FARE_BRANDS[booking.fareBrand].cabin !== "economy");
    return c.json({ rloc: booking.rloc, autoCheckInEligible: eligible });
  });

  app.post("/api/bff/v1/handoff/token", async (c) => {
    const body = (await c.req.json()) as { rloc: string; flow?: "checkin" | "manage" };
    const booking = store.getBooking(body.rloc);
    if (!booking) throw new BffAppError("ERR_404_PNR", 404);
    const payload = {
      token: `hoff_${Math.random().toString(36).slice(2, 12)}`,
      rloc: booking.rloc,
      flow: body.flow ?? "checkin",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    store.saveHandoff(payload);
    return c.json(payload);
  });

  app.get("/api/bff/v1/handoff/:token", (c) => {
    const found = store.consumeHandoff(c.req.param("token"));
    if (!found) throw new BffAppError("ERR_HOLD_EXPIRED", 404, "Handoff token invalid or expired.");
    const booking = store.getBooking(found.rloc);
    return c.json({ handoff: found, booking });
  });

  // --- Loyalty / Sindbad LMS Routes (FR-24, FR-109) ---
  app.get("/api/bff/v1/loyalty/profile", (c) => {
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    return c.json({
      user: session.user,
      household: lms.getHousehold(),
      claimedPnrs: store.getClaimedPnrs(),
    });
  });

  app.post("/api/bff/v1/loyalty/retro-claim", async (c) => {
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    const body = (await c.req.json()) as { pnr: string };
    const result = await lms.retroClaim(session, body.pnr ?? "");
    return c.json({ milesCredited: result.milesCredited, user: result.session.user });
  });

  app.post("/api/bff/v1/loyalty/redeem", async (c) => {
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    const body = (await c.req.json()) as { itemId: string };
    const result = await lms.redeemCatalogItem(session, body.itemId);
    return c.json({ voucherCode: result.voucherCode, user: result.session.user });
  });

  app.post("/api/bff/v1/loyalty/household", async (c) => {
    const body = (await c.req.json()) as { name: string; relation: string };
    const household = lms.addHouseholdMember(body.name ?? "", body.relation ?? "Sibling");
    return c.json({ household });
  });

  app.delete("/api/bff/v1/loyalty/household/:id", (c) => {
    const household = lms.removeHouseholdMember(c.req.param("id"));
    return c.json({ household });
  });

  // --- 3rd-Party Partner SSO Handoff (FR-119) ---
  app.post("/api/bff/v1/partners/sso", async (c) => {
    const session = resolveOrCreateSession(store, c.req.header("authorization"));
    const body = (await c.req.json()) as { partner: string };
    return c.json(thirdParty.issuePartnerSsoHandoff(body.partner || "allianz", session.user.memberId));
  });

  // --- Flight Status Cache (FR-28, FR-42) ---
  app.get("/api/bff/v1/status/flights", rateLimitMiddleware(searchLimiter), async (c) => {
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
