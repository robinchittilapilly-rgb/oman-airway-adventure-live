import { createHmac, timingSafeEqual } from "node:crypto";
import type { SessionAndCartStore, BffSessionRecord } from "../stores/sessionStore";
import { assignExperimentVariant } from "./abTesting";

const TOKEN_SECRET = process.env["BFF_SESSION_SECRET"] ?? "oman-air-bff-dev-signing-key";

export function signSessionToken(sessionId: string): string {
  const sig = createHmac("sha256", TOKEN_SECRET).update(sessionId).digest("base64url");
  return `${sessionId}.${sig}`;
}

export function verifySessionToken(token?: string | null): string | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const sessionId = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = createHmac("sha256", TOKEN_SECRET).update(sessionId).digest("base64url");
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return sessionId;
}

/**
 * Resolves or initializes a server-side session without ever exposing internal PSS tokens to clients (FR-23, FR-45).
 */
export function resolveOrCreateSession(store: SessionAndCartStore, rawAuthOrHeader?: string | null): BffSessionRecord {
  const bare = rawAuthOrHeader?.replace(/^Bearer\s+/i, "").trim();
  const verifiedId = verifySessionToken(bare);
  if (verifiedId) {
    const existing = store.getSession(verifiedId);
    if (existing) return existing;
  }

  const sessionId = verifiedId ?? `sess-${Math.random().toString(36).slice(2, 12)}`;
  const existing = store.getSession(sessionId);
  if (existing) return existing;

  const created: BffSessionRecord = {
    sessionId,
    internalPssToken: `SABRE_INTERNAL_${Math.random().toString(36).slice(2, 14).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    user: {
      signedIn: true,
      memberId: "mem-tariq-01",
      memberName: "Tariq Al-Balushi",
      sindbadNo: "SB-8841209",
      tier: "Gold",
      miles: 68450,
      tierPoints: 420,
      travelBankOMR: 65,
      pos: "OM",
      experimentVariant: assignExperimentVariant(sessionId),
    },
  };
  store.saveSession(created);
  return created;
}
