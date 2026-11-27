/**
 * CacheStore abstraction (FR-42, FR-68).
 * Uses an in-memory TTL store by default and supports Upstash/HTTP Redis via REDIS_REST_URL + REDIS_REST_TOKEN.
 */
export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

interface MemoryEntry {
  value: unknown;
  expiresAt: number;
}

export class MemoryCacheStore implements CacheStore {
  private readonly store = new Map<string, MemoryEntry>();

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
}

export class RedisRestCacheStore implements CacheStore {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fallback: CacheStore = new MemoryCacheStore()
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
        }
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
}

export function createCacheStoreFromEnv(): CacheStore {
  const url = process.env["REDIS_REST_URL"]?.trim();
  const token = process.env["REDIS_REST_TOKEN"]?.trim();
  if (url && token) {
    return new RedisRestCacheStore(url.replace(/\/+$/, ""), token);
  }
  return new MemoryCacheStore();
}
