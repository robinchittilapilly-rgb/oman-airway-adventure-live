import Redis from "ioredis";

/**
 * CacheStore abstraction (FR-42, FR-68).
 * Priority:
 *  1) REDIS_URL -> RedisTcpCacheStore (ioredis)
 *  2) REDIS_REST_URL + REDIS_REST_TOKEN -> RedisRestCacheStore (Upstash HTTP)
 *  3) Default -> MemoryCacheStore
 */
export interface CacheStore {
  readonly backendName: "memory" | "redis-tcp" | "redis-rest";
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  incrWithWindow(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; retryAfterSeconds: number }>;
}

interface MemoryEntry {
  value: unknown;
  expiresAt: number;
}

export class MemoryCacheStore implements CacheStore {
  readonly backendName = "memory" as const;
  private readonly store = new Map<string, MemoryEntry>();
  private readonly counters = new Map<string, { count: number; resetAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async incrWithWindow(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; retryAfterSeconds: number }> {
    const now = Date.now();
    const cur = this.counters.get(key);
    if (!cur || now >= cur.resetAt) {
      this.counters.set(key, { count: 1, resetAt: now + windowMs });
      return { count: 1, retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)) };
    }
    cur.count += 1;
    this.counters.set(key, cur);
    return {
      count: cur.count,
      retryAfterSeconds: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)),
    };
  }
}

export class RedisTcpCacheStore implements CacheStore {
  readonly backendName = "redis-tcp" as const;
  private readonly client: Redis;

  constructor(
    redisUrl: string,
    private readonly fallback: CacheStore = new MemoryCacheStore(),
  ) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    this.client.on("error", () => {
      // Fallback transparently handles temporary Redis connectivity blips
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return this.fallback.get<T>(key);
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.fallback.set(key, value, ttlSeconds);
    try {
      await this.client.set(key, JSON.stringify(value), "EX", Math.max(1, Math.floor(ttlSeconds)));
    } catch {
      // Fallback already populated
    }
  }

  async del(key: string): Promise<void> {
    await this.fallback.del(key);
    try {
      await this.client.del(key);
    } catch {
      // Ignore transient delete errors
    }
  }

  async incrWithWindow(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; retryAfterSeconds: number }> {
    const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));
    try {
      const count = await this.client.incr(key);
      if (count === 1) {
        await this.client.expire(key, ttlSec);
      }
      const pttl = await this.client.ttl(key);
      return {
        count,
        retryAfterSeconds: pttl > 0 ? pttl : ttlSec,
      };
    } catch {
      return this.fallback.incrWithWindow(key, windowMs);
    }
  }
}

export class RedisRestCacheStore implements CacheStore {
  readonly backendName = "redis-rest" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fallback: CacheStore = new MemoryCacheStore(),
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const res = await fetch(`${this.baseUrl}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (!res.ok) return this.fallback.get<T>(key);
      const data = (await res.json()) as { result?: string | null };
      if (!data.result) return null;
      return JSON.parse(data.result) as T;
    } catch {
      return this.fallback.get<T>(key);
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.fallback.set(key, value, ttlSeconds);
    try {
      await fetch(
        `${this.baseUrl}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}?EX=${Math.max(1, Math.floor(ttlSeconds))}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${this.token}` },
        },
      );
    } catch {
      // Fallback already populated
    }
  }

  async del(key: string): Promise<void> {
    await this.fallback.del(key);
    try {
      await fetch(`${this.baseUrl}/del/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}` },
      });
    } catch {
      // Ignore transient network errors
    }
  }

  async incrWithWindow(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; retryAfterSeconds: number }> {
    return this.fallback.incrWithWindow(key, windowMs);
  }
}

export function createCacheStoreFromEnv(): CacheStore {
  const tcpUrl = process.env["REDIS_URL"]?.trim();
  if (tcpUrl) {
    return new RedisTcpCacheStore(tcpUrl);
  }
  const url = process.env["REDIS_REST_URL"]?.trim();
  const token = process.env["REDIS_REST_TOKEN"]?.trim();
  if (url && token) {
    return new RedisRestCacheStore(url.replace(/\/+$/, ""), token);
  }
  return new MemoryCacheStore();
}
