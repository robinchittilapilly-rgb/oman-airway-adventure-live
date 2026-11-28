import type {
  BffAiChatResponse,
  BffAuditEntry,
  BffCartState,
  BffCheckoutRequest,
  BffCheckoutResponse,
  BffCmsArticle,
  BffCmsState,
  BffEdgeContextResponse,
  BffErrorPayload,
  BffFeatureFlags,
  BffHandoffPayload,
  BffSearchRequest,
  BffSearchResponse,
  BffSessionUser,
  PointOfSale,
} from "../../bff/types";
import type { FareBrandId, OMAN_AIR_20_ROUTES } from "../data/omanAirRoutes";
import type {
  HouseholdMember,
  SavedBookingPNR,
  SeatCell,
  SindbadTier,
} from "../data/ancillariesAndSeats";

const SESSION_TOKEN_KEY = "oman_air_bff_session_token";
const CART_ID_KEY = "oman_air_bff_cart_id";

export function getConfiguredBffUrl(): string | null {
  const configured = (import.meta.env["VITE_BFF_URL"] as string | undefined)?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    return "http://localhost:8787";
  }
  return null;
}

export class BffClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function readStoredToken(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string) {
  try {
    window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    // ignore storage errors
  }
}

export function getStoredCartId(): string | null {
  try {
    return window.sessionStorage.getItem(CART_ID_KEY);
  } catch {
    return null;
  }
}

export function setStoredCartId(cartId: string | null) {
  try {
    if (!cartId) window.sessionStorage.removeItem(CART_ID_KEY);
    else window.sessionStorage.setItem(CART_ID_KEY, cartId);
  } catch {
    // ignore storage errors
  }
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function bffFetch<T>(
  path: string,
  options: RequestInit & { lang?: "en" | "ar"; pos?: PointOfSale; idempotencyKey?: string } = {},
): Promise<T> {
  const baseUrl = getConfiguredBffUrl();
  if (!baseUrl) {
    throw new BffClientError("ERR_NO_BFF_URL", "BFF URL is not configured.", 0);
  }
  const token = readStoredToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Accept-Language", options.lang ?? "en");
  headers.set("X-OmanAir-POS", options.pos ?? "OM");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.method && options.method.toUpperCase() !== "GET" && !headers.has("Idempotency-Key")) {
    headers.set("Idempotency-Key", options.idempotencyKey ?? generateIdempotencyKey());
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  const nextToken = res.headers.get("X-Session-Token");
  if (nextToken) writeStoredToken(nextToken);

  const data = (await res.json().catch(() => ({}))) as T & Partial<BffErrorPayload>;
  if (!res.ok) {
    throw new BffClientError(
      data.code ?? "ERR_INTERNAL",
      data.message ?? `Request failed (${res.status})`,
      res.status,
    );
  }
  return data;
}

export const bffClient = {
  getSession(lang: "en" | "ar" = "en") {
    return bffFetch<{ sessionToken: string; user: BffSessionUser }>("/api/bff/v1/auth/session", {
      lang,
    });
  },
  login(
    memberName?: string,
    tier?: SindbadTier,
    lang: "en" | "ar" = "en",
    role?: "member" | "admin",
  ) {
    return bffFetch<{ sessionToken: string; user: BffSessionUser }>("/api/bff/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ mode: "demo", memberName, tier, role }),
      lang,
    });
  },
  startOidcPkce(redirectUri: string, requestedRole?: "member" | "admin", lang: "en" | "ar" = "en") {
    return bffFetch<{
      state: string;
      codeChallenge: string;
      codeChallengeMethod: "S256";
      authorizationUrl: string;
      mode: "external-oidc" | "local-pkce-sandbox";
      sandboxCodeVerifier?: string;
      sandboxAuthCode?: string;
    }>("/api/bff/v1/auth/oidc/authorize", {
      method: "POST",
      body: JSON.stringify({ redirectUri, requestedRole }),
      lang,
    });
  },
  completeOidcCallback(
    payload: {
      state: string;
      code: string;
      codeVerifier: string;
      memberName?: string;
      tier?: SindbadTier;
      role?: "member" | "admin";
    },
    lang: "en" | "ar" = "en",
  ) {
    return bffFetch<{ sessionToken: string; user: BffSessionUser }>(
      "/api/bff/v1/auth/oidc/callback",
      {
        method: "POST",
        body: JSON.stringify(payload),
        lang,
      },
    );
  },
  logout(lang: "en" | "ar" = "en") {
    return bffFetch<{ user: BffSessionUser }>("/api/bff/v1/auth/logout", { method: "POST", lang });
  },
  switchTier(tier: SindbadTier, lang: "en" | "ar" = "en") {
    return bffFetch<{ user: BffSessionUser }>("/api/bff/v1/auth/tier", {
      method: "POST",
      body: JSON.stringify({ tier }),
      lang,
    });
  },
  getCmsContent(lang: "en" | "ar" = "en") {
    return bffFetch<{ cms: BffCmsState }>("/api/bff/v1/cms/content", { lang });
  },
  searchCmsSite(query: string, lang: "en" | "ar" = "en") {
    return bffFetch<{ query: string; articles: BffCmsArticle[] }>(
      `/api/bff/v1/cms/search?q=${encodeURIComponent(query)}`,
      { lang },
    );
  },
  getAdminOverview(lang: "en" | "ar" = "en") {
    return bffFetch<{
      cms: BffCmsState;
      auditLogs: BffAuditEntry[];
      mfaVerified?: boolean;
      traces?: {
        traceId: string;
        spanId: string;
        method: string;
        path: string;
        statusCode: number;
        durationMs: number;
        startedAt: string;
      }[];
      infra: {
        storeBackend: string;
        cacheBackend: string;
        demoMode: boolean;
        geminiConfigured: boolean;
      };
    }>("/api/bff/v1/admin/overview", { lang });
  },
  updateAdminCms(
    patch: {
      darkSiteActive?: boolean;
      darkSiteHeadlineEn?: string;
      darkSiteHeadlineAr?: string;
      darkSiteAdvisoryEn?: string;
      darkSiteAdvisoryAr?: string;
      heroTitleEn?: string;
      heroSubtitleEn?: string;
      featureFlags?: Partial<BffFeatureFlags>;
      upsertPromo?: { code: string; discountPct: number; label: string; active: boolean };
      upsertArticle?: {
        slug: string;
        category: "policy" | "baggage" | "advisory" | "destination" | "sindbad";
        titleEn: string;
        titleAr: string;
        bodyEn: string;
        bodyAr: string;
        routeLink: string;
        published: boolean;
      };
    },
    lang: "en" | "ar" = "en",
  ) {
    return bffFetch<{ cms: BffCmsState }>("/api/bff/v1/admin/cms", {
      method: "PUT",
      body: JSON.stringify(patch),
      lang,
    });
  },
  chatSuhail(message: string, lang: "en" | "ar" = "en") {
    return bffFetch<BffAiChatResponse>("/api/bff/v1/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
      lang,
    });
  },
  searchFlights(body: BffSearchRequest, lang: "en" | "ar" = "en") {
    return bffFetch<BffSearchResponse>("/api/bff/v1/shopping/search", {
      method: "POST",
      body: JSON.stringify(body),
      lang,
    });
  },
  getSeatMap(aircraft: "Boeing 787-9 Dreamliner" | "Boeing 737 MAX 8", lang: "en" | "ar" = "en") {
    return bffFetch<{ aircraft: string; seats: SeatCell[] }>(
      `/api/bff/v1/shopping/seats?aircraft=${encodeURIComponent(aircraft)}`,
      { lang },
    );
  },
  syncCart(
    body: {
      cartId?: string | undefined;
      step: 1 | 2 | 3 | 4;
      search: BffSearchRequest;
      selectedOutboundId: string;
      selectedSecondSegId?: string | undefined;
      selectedBrand: FareBrandId;
      selectedSeatIds: string[];
      selectedReturnSeatIds?: string[] | undefined;
      selectedBundleIds: string[];
      selectedAncillaryIds: string[];
      selectedMealId: string;
      selectedMealByPax?: string[] | undefined;
      selectedSsrIds: string[];
      insuranceChoice: "unset" | "yes" | "no";
      passengers: BffCartState["passengers"];
    },
    lang: "en" | "ar" = "en",
  ) {
    return bffFetch<{ cart: BffCartState }>("/api/bff/v1/cart", {
      method: "POST",
      body: JSON.stringify(body),
      lang,
    });
  },
  getCart(cartId: string, lang: "en" | "ar" = "en") {
    return bffFetch<{ cart: BffCartState }>(`/api/bff/v1/cart/${encodeURIComponent(cartId)}`, {
      lang,
    });
  },
  checkoutCart(cartId: string, body: BffCheckoutRequest, lang: "en" | "ar" = "en") {
    return bffFetch<BffCheckoutResponse>(
      `/api/bff/v1/cart/${encodeURIComponent(cartId)}/checkout`,
      {
        method: "POST",
        body: JSON.stringify(body),
        lang,
      },
    );
  },
  listBookings(lang: "en" | "ar" = "en") {
    return bffFetch<{ bookings: SavedBookingPNR[] }>("/api/bff/v1/bookings", { lang });
  },
  retrieveBooking(rloc: string, lastName: string, lang: "en" | "ar" = "en") {
    return bffFetch<{ booking: SavedBookingPNR }>("/api/bff/v1/bookings/retrieve", {
      method: "POST",
      body: JSON.stringify({ rloc, lastName }),
      lang,
    });
  },
  updatePnrServicing(
    rloc: string,
    payload: { contactEmail?: string; contactPhone?: string; sindbadNo?: string },
    lang: "en" | "ar" = "en",
  ) {
    return bffFetch<{ booking: SavedBookingPNR }>(
      `/api/bff/v1/bookings/${encodeURIComponent(rloc)}/servicing`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
        lang,
      },
    );
  },
  settleHold(
    rloc: string,
    payload: {
      paymentMethod?: "card" | "lpm" | "wallet" | "bnpl" | "miles_cash";
      paymentDetailLabel?: string;
      useMilesSplit?: boolean;
      useTravelBank?: boolean;
    } = {},
    lang: "en" | "ar" = "en",
  ) {
    return bffFetch<{
      booking: SavedBookingPNR;
      collectedOMR: number;
      milesUsed: number;
      milesEarned: number;
      travelBankUsedOMR: number;
      user: BffSessionUser;
    }>(`/api/bff/v1/bookings/${encodeURIComponent(rloc)}/settle-hold`, {
      method: "POST",
      body: JSON.stringify(payload),
      lang,
    });
  },
  exchangeBooking(rloc: string, newDate: string, lang: "en" | "ar" = "en") {
    return bffFetch<{
      booking: SavedBookingPNR;
      quote: { changeFeeOMR: number; fareDifferenceOMR: number; totalDueOMR: number };
    }>(`/api/bff/v1/bookings/${encodeURIComponent(rloc)}/exchange`, {
      method: "POST",
      body: JSON.stringify({ newDate }),
      lang,
    });
  },
  refundBooking(rloc: string, toVoucher: boolean, lang: "en" | "ar" = "en") {
    return bffFetch<{
      booking: SavedBookingPNR;
      quote: { cashRefundOMR: number; cancellationFeeOMR: number; voucherRefundOMR: number };
      user: BffSessionUser;
    }>(`/api/bff/v1/bookings/${encodeURIComponent(rloc)}/refund`, {
      method: "POST",
      body: JSON.stringify({ toVoucher }),
      lang,
    });
  },
  splitBooking(rloc: string, lang: "en" | "ar" = "en") {
    return bffFetch<{ parent: SavedBookingPNR; child: SavedBookingPNR }>(
      `/api/bff/v1/bookings/${encodeURIComponent(rloc)}/split`,
      { method: "POST", lang },
    );
  },
  addBookingAncillary(
    rloc: string,
    label: string,
    priceOMR: number,
    payWithMiles: boolean,
    lang: "en" | "ar" = "en",
  ) {
    return bffFetch<{ booking: SavedBookingPNR; user: BffSessionUser }>(
      `/api/bff/v1/bookings/${encodeURIComponent(rloc)}/ancillaries`,
      { method: "POST", body: JSON.stringify({ label, priceOMR, payWithMiles }), lang },
    );
  },
  upgradeBookingWithMiles(rloc: string, lang: "en" | "ar" = "en") {
    return bffFetch<{ booking: SavedBookingPNR; user: BffSessionUser }>(
      `/api/bff/v1/bookings/${encodeURIComponent(rloc)}/upgrade-miles`,
      { method: "POST", lang },
    );
  },
  applyIrrops(
    rloc: string,
    body: {
      action: "rebook" | "voucher" | "rebook_and_checkin";
      flightNumber?: string;
      departureTime?: string;
      arrivalTime?: string;
    },
    lang: "en" | "ar" = "en",
  ) {
    return bffFetch<{ booking: SavedBookingPNR; user: BffSessionUser }>(
      `/api/bff/v1/bookings/${encodeURIComponent(rloc)}/irrops`,
      { method: "POST", body: JSON.stringify(body), lang },
    );
  },
  completeCheckIn(
    rloc: string,
    biometricOptIn: boolean,
    requestBagTags: boolean,
    lang: "en" | "ar" = "en",
  ) {
    return bffFetch<{ booking: SavedBookingPNR; bcbpPayloads: string[] }>(
      `/api/bff/v1/checkin/${encodeURIComponent(rloc)}/complete`,
      { method: "POST", body: JSON.stringify({ biometricOptIn, requestBagTags }), lang },
    );
  },
  offloadCheckIn(rloc: string, lang: "en" | "ar" = "en") {
    return bffFetch<{ booking: SavedBookingPNR }>(
      `/api/bff/v1/checkin/${encodeURIComponent(rloc)}/offload`,
      { method: "POST", lang },
    );
  },
  upgradeCheckIn(
    rloc: string,
    kind: "biz" | "bag",
    payWithMiles: boolean,
    lang: "en" | "ar" = "en",
  ) {
    return bffFetch<{ booking: SavedBookingPNR; user: BffSessionUser }>(
      `/api/bff/v1/checkin/${encodeURIComponent(rloc)}/upgrade`,
      { method: "POST", body: JSON.stringify({ kind, payWithMiles }), lang },
    );
  },
  getAutoCheckInEligibility(rloc: string, lang: "en" | "ar" = "en") {
    return bffFetch<{ rloc: string; autoCheckInEligible: boolean }>(
      `/api/bff/v1/checkin/${encodeURIComponent(rloc)}/auto-eligible`,
      { lang },
    );
  },
  createHandoffToken(
    rloc: string,
    flow: "checkin" | "manage" = "checkin",
    lang: "en" | "ar" = "en",
  ) {
    return bffFetch<BffHandoffPayload>("/api/bff/v1/handoff/token", {
      method: "POST",
      body: JSON.stringify({ rloc, flow }),
      lang,
    });
  },
  consumeHandoff(token: string, lang: "en" | "ar" = "en") {
    return bffFetch<{ handoff: BffHandoffPayload; booking: SavedBookingPNR }>(
      `/api/bff/v1/handoff/${encodeURIComponent(token)}`,
      { lang },
    );
  },
  getLoyaltyProfile(lang: "en" | "ar" = "en") {
    return bffFetch<{ user: BffSessionUser; household: HouseholdMember[]; claimedPnrs: string[] }>(
      "/api/bff/v1/loyalty/profile",
      { lang },
    );
  },
  retroClaim(pnr: string, lang: "en" | "ar" = "en") {
    return bffFetch<{ milesCredited: number; user: BffSessionUser }>(
      "/api/bff/v1/loyalty/retro-claim",
      {
        method: "POST",
        body: JSON.stringify({ pnr }),
        lang,
      },
    );
  },
  redeemCatalog(itemId: string, lang: "en" | "ar" = "en") {
    return bffFetch<{ voucherCode: string; user: BffSessionUser }>("/api/bff/v1/loyalty/redeem", {
      method: "POST",
      body: JSON.stringify({ itemId }),
      lang,
    });
  },
  addHousehold(name: string, relation: string, lang: "en" | "ar" = "en") {
    return bffFetch<{ household: HouseholdMember[] }>("/api/bff/v1/loyalty/household", {
      method: "POST",
      body: JSON.stringify({ name, relation }),
      lang,
    });
  },
  removeHousehold(id: string, lang: "en" | "ar" = "en") {
    return bffFetch<{ household: HouseholdMember[] }>(
      `/api/bff/v1/loyalty/household/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        lang,
      },
    );
  },
  getFlightStatus(q = "", lang: "en" | "ar" = "en") {
    return bffFetch<{
      cached: boolean;
      items: ((typeof OMAN_AIR_20_ROUTES)[number] & { gate: string; status: string })[];
    }>(`/api/bff/v1/status/flights?q=${encodeURIComponent(q)}`, { lang });
  },
  getEdgeContext(lang: "en" | "ar" = "en") {
    return bffFetch<BffEdgeContextResponse>("/api/bff/v1/edge/context", { lang });
  },
  setupAdminMfa(lang: "en" | "ar" = "en") {
    return bffFetch<{
      secretBase32: string;
      otpauthUri: string;
      mfaVerified: boolean;
      sandboxCurrentCode?: string;
    }>("/api/bff/v1/admin/mfa/setup", { method: "POST", lang });
  },
  verifyAdminMfa(code: string, lang: "en" | "ar" = "en") {
    return bffFetch<{ mfaVerified: boolean; user: BffSessionUser }>(
      "/api/bff/v1/admin/mfa/verify",
      {
        method: "POST",
        body: JSON.stringify({ code }),
        lang,
      },
    );
  },
  tokenizeCard(
    payload: {
      cardLast4: string;
      expiry: string;
      cardholderName: string;
      scheme: "Visa" | "Mastercard" | "AMEX" | "Diners" | "JCB";
      amountOMR: number;
    },
    lang: "en" | "ar" = "en",
  ) {
    return bffFetch<{
      token: {
        paymentToken: string;
        maskedPan: string;
        accertifyRiskScore: number;
        threeDsRequired: boolean;
        threeDsVerified: boolean;
      };
    }>("/api/bff/v1/payments/tokenize", {
      method: "POST",
      body: JSON.stringify(payload),
      lang,
    });
  },
  initiateThreeDs2(paymentToken: string, lang: "en" | "ar" = "en") {
    return bffFetch<{
      challenge: {
        threeDsTransId: string;
        paymentToken: string;
        acsUrl: string;
        otpHint: string;
        verified: boolean;
      };
    }>("/api/bff/v1/payments/3ds2/challenge", {
      method: "POST",
      body: JSON.stringify({ paymentToken }),
      lang,
    });
  },
  verifyThreeDs2(threeDsTransId: string, otpCode: string, lang: "en" | "ar" = "en") {
    return bffFetch<{
      challenge: {
        threeDsTransId: string;
        paymentToken: string;
        verified: boolean;
        cavv?: string;
        eci?: string;
      };
    }>("/api/bff/v1/payments/3ds2/verify", {
      method: "POST",
      body: JSON.stringify({ threeDsTransId, otpCode }),
      lang,
    });
  },
  async downloadApplePkpass(rloc: string, paxIdx: number): Promise<Blob> {
    const base = getConfiguredBffUrl();
    if (!base) throw new BffClientError("ERR_OFFLINE", "BFF not connected.", 503);
    const tok = readStoredToken();
    const res = await fetch(
      `${base}/api/bff/v1/checkin/${encodeURIComponent(rloc)}/wallet/apple/${paxIdx}`,
      {
        credentials: "include",
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      },
    );
    if (!res.ok)
      throw new BffClientError(
        "ERR_INTERNAL",
        `Wallet download failed (${res.status})`,
        res.status,
      );
    return res.blob();
  },
  getGoogleWalletPass(rloc: string, paxIdx: number, lang: "en" | "ar" = "en") {
    return bffFetch<{ jwt: string; saveUrl: string; bcbp: string }>(
      `/api/bff/v1/checkin/${encodeURIComponent(rloc)}/wallet/google/${paxIdx}`,
      { lang },
    );
  },
};
