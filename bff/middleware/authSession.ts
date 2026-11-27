import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import type { SavedBookingPNR } from "../../src/data/ancillariesAndSeats";
import type { BffSessionRecord, SessionAndCartStore } from "../stores/sessionStore";
import { assignExperimentVariant } from "./abTesting";
import { BffAppError } from "./errorTranslator";

export const SESSION_COOKIE_NAME = "oman_air_session";

const EPHEMERAL_DEV_SECRET = randomBytes(32).toString("hex");

function getTokenSecret(): string {
  const configured = process.env["BFF_SESSION_SECRET"]?.trim();
  if (configured) return configured;
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("BFF_SESSION_SECRET environment variable must be configured in production.");
  }
  return EPHEMERAL_DEV_SECRET;
}

/**
 * Explicit dev/demo switcher gate (FR-23).
 * Off by default when NODE_ENV=production unless BFF_ALLOW_DEMO_AUTH=true.
 */
export function isDemoAuthEnabled(): boolean {
  const flag = process.env["BFF_ALLOW_DEMO_AUTH"]?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env["NODE_ENV"] !== "production";
}

export function signSessionToken(sessionId: string): string {
  const sig = createHmac("sha256", getTokenSecret()).update(sessionId).digest("base64url");
  return `${sessionId}.${sig}`;
}

export function verifySessionToken(token?: string | null): string | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const sessionId = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = createHmac("sha256", getTokenSecret()).update(sessionId).digest("base64url");
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return sessionId;
}

function parseCookies(cookieHeader?: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export function extractSessionToken(c: Context): string | null {
  const auth = c.req
    .header("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (auth) return auth;
  const cookies = parseCookies(c.req.header("cookie"));
  return cookies[SESSION_COOKIE_NAME] ?? null;
}

export function attachSessionHeadersAndCookie(c: Context, session: BffSessionRecord) {
  const token = signSessionToken(session.sessionId);
  c.header("X-Session-Token", token);
  c.header("X-OmanAir-Experiment", session.user.experimentVariant);
  const isProd = process.env["NODE_ENV"] === "production";
  const cookieAttrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=86400",
    ...(isProd ? ["Secure"] : []),
  ];
  c.header("Set-Cookie", cookieAttrs.join("; "));
}

/**
 * Resolves an existing verified session or initializes an anonymous Guest session (FR-23, FR-45).
 * Never auto-elevates anonymous visitors to signed-in Gold status.
 */
export async function resolveOrCreateSession(
  store: SessionAndCartStore,
  rawTokenOrContext?: string | Context | null,
): Promise<BffSessionRecord> {
  const rawToken =
    rawTokenOrContext && typeof rawTokenOrContext === "object"
      ? extractSessionToken(rawTokenOrContext)
      : rawTokenOrContext;

  const bare = rawToken?.replace(/^Bearer\s+/i, "").trim();
  const verifiedId = verifySessionToken(bare);
  if (verifiedId) {
    const existing = await store.getSession(verifiedId);
    if (existing) {
      existing.user.demoModeEnabled = isDemoAuthEnabled();
      return existing;
    }
  }

  const sessionId = `sess-${randomUUID()}`;
  const created: BffSessionRecord = {
    sessionId,
    internalPssToken: `SABRE_INTERNAL_${randomUUID()}`,
    authorizedRlocs: [],
    createdAt: new Date().toISOString(),
    user: {
      signedIn: false,
      role: "guest",
      authProvider: "anonymous",
      demoModeEnabled: isDemoAuthEnabled(),
      tier: "Blue",
      miles: 0,
      tierPoints: 0,
      travelBankOMR: 0,
      pos: "OM",
      experimentVariant: assignExperimentVariant(sessionId),
    },
  };
  await store.saveSession(created);
  return created;
}

export async function authorizeSessionBookingAccess(
  store: SessionAndCartStore,
  session: BffSessionRecord,
  rloc: string,
): Promise<void> {
  const upper = rloc.trim().toUpperCase();
  if (!session.authorizedRlocs.includes(upper)) {
    session.authorizedRlocs.push(upper);
    await store.saveSession(session);
  }
}

export function canSessionAccessBooking(
  session: BffSessionRecord,
  booking: SavedBookingPNR,
): boolean {
  if (session.user.role === "admin") return true;
  if (booking.ownerSessionId && booking.ownerSessionId === session.sessionId) return true;
  if (
    session.user.signedIn &&
    session.user.memberId &&
    booking.ownerMemberId === session.user.memberId
  ) {
    return true;
  }
  return session.authorizedRlocs.includes(booking.rloc.toUpperCase());
}

export function assertBookingAccess(session: BffSessionRecord, booking: SavedBookingPNR): void {
  if (!canSessionAccessBooking(session, booking)) {
    throw new BffAppError(
      "ERR_FORBIDDEN",
      403,
      "Booking access requires verification via RLOC + Passenger Last Name or signed-in ownership.",
    );
  }
}

export function maskPassportNumber(passport: string): string {
  const clean = passport.trim();
  if (clean.length <= 4) return "****";
  return `${"*".repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}

export function sanitizeBookingForSession(booking: SavedBookingPNR): SavedBookingPNR {
  return {
    ...booking,
    passengers: booking.passengers.map((p) => ({
      ...p,
      passport: maskPassportNumber(p.passport),
    })),
  };
}
