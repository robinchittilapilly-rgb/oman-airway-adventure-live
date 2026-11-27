import type { Context, Next } from "hono";
import type { CacheStore } from "../stores/cacheStore";
import { extractSessionToken } from "./authSession";
import { BffAppError } from "./errorTranslator";

interface StoredIdempotencyRecord {
  status: number;
  body: unknown;
  inFlight?: boolean | undefined;
}

/**
 * Redis-backed / CacheStore-backed Idempotency-Key guard (Phase 0).
 * Ensures retried payment, settle-hold, refund, exchange, and check-in commits
 * never double-charge cards or double-burn Sindbad miles.
 */
export function idempotencyMiddleware(cache: CacheStore) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const rawKey = c.req.header("idempotency-key")?.trim();
    if (!rawKey) {
      await next();
      return;
    }
    if (rawKey.length < 8 || rawKey.length > 128) {
      throw new BffAppError(
        "ERR_VALIDATION",
        400,
        "Idempotency-Key must be between 8 and 128 characters.",
      );
    }

    const sessionPart = extractSessionToken(c) ?? c.req.header("x-session-id") ?? "anon";
    const cacheKey = `idem:${sessionPart}:${c.req.method}:${c.req.path}:${rawKey}`;
    const existing = await cache.get<StoredIdempotencyRecord>(cacheKey);

    if (existing) {
      if (existing.inFlight) {
        throw new BffAppError("ERR_CONFLICT", 409);
      }
      c.header("X-Idempotent-Replay", "true");
      return c.json(existing.body, existing.status as 200);
    }

    await cache.set<StoredIdempotencyRecord>(
      cacheKey,
      { status: 202, body: null, inFlight: true },
      60,
    );

    try {
      await next();
      const cloned = c.res.clone();
      const body = await cloned.json().catch(() => null);
      if (c.res.status < 500 && body !== null) {
        await cache.set<StoredIdempotencyRecord>(cacheKey, { status: c.res.status, body }, 600);
      } else {
        await cache.del(cacheKey);
      }
    } catch (err) {
      await cache.del(cacheKey);
      throw err;
    }
  };
}
