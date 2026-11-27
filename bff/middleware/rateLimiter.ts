import type { Context, Next } from "hono";
import { translateBffError } from "./errorTranslator";

interface RateBucket {
  timestamps: number[];
}

/**
 * Sliding-window per-session/IP rate limiter & anti-scraper throttle (FR-48).
 */
export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, RateBucket>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  consume(key: string, nowMs = Date.now()): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const bucket = this.buckets.get(key) ?? { timestamps: [] };
    const cutoff = nowMs - this.windowMs;
    bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

    if (bucket.timestamps.length >= this.maxRequests) {
      const oldest = bucket.timestamps[0] ?? nowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - nowMs) / 1000));
      this.buckets.set(key, bucket);
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    bucket.timestamps.push(nowMs);
    this.buckets.set(key, bucket);
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - bucket.timestamps.length),
      retryAfterSeconds: 0,
    };
  }
}

export function rateLimitMiddleware(limiter: SlidingWindowRateLimiter) {
  return async (c: Context, next: Next) => {
    const sessionKey = c.req.header("x-session-id") ?? c.req.header("x-forwarded-for") ?? "anonymous";
    const lang = c.req.header("accept-language")?.startsWith("ar") ? "ar" : "en";
    const res = limiter.consume(`${c.req.path}:${sessionKey}`);

    c.header("X-RateLimit-Remaining", String(res.remaining));
    if (!res.allowed) {
      c.header("Retry-After", String(res.retryAfterSeconds));
      return c.json(translateBffError("ERR_RATE_LIMIT", lang), 429);
    }
    return next();
  };
}
