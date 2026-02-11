import { Redis } from "@upstash/redis";

type RedisValue = {
  value: string;
  expiresAt?: number;
};

class InMemoryRedis {
  private store = new Map<string, RedisValue>();

  private isExpired(entry: RedisValue): boolean {
    return !!(entry.expiresAt && Date.now() > entry.expiresAt);
  }

  private expireEntryIfNeeded(key: string, entry: RedisValue): boolean {
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return true;
    }
    return false;
  }

  async set(key: string, value: string, opts?: { ex?: number }) {
    const entry: RedisValue = { value };
    if (opts?.ex) {
      entry.expiresAt = Date.now() + opts.ex * 1000;
    }
    this.store.set(key, entry);
    return "OK";
  }

  async get<T = string>(key: string) {
    const entry = this.store.get(key);
    if (!entry || this.expireEntryIfNeeded(key, entry)) {
      return null;
    }
    return entry.value as unknown as T;
  }

  async del(key: string) {
    return this.store.delete(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number) {
    const entry = this.store.get(key);
    if (!entry) {
      return 0;
    }
    entry.expiresAt = Date.now() + seconds * 1000;
    this.store.set(key, entry);
    return 1;
  }

  async incr(key: string) {
    const currentRaw = await this.get<string>(key);
    const current = Number.parseInt(String(currentRaw ?? "0"), 10);
    const next = Number.isFinite(current) ? current + 1 : 1;
    await this.set(key, String(next));
    return next;
  }

  async keys(pattern: string) {
    const regex = patternToRegex(pattern);
    return Array.from(this.store.keys()).filter((key) => {
      const entry = this.store.get(key);
      if (!entry || this.expireEntryIfNeeded(key, entry)) {
        return false;
      }
      return regex.test(key);
    });
  }
}

function patternToRegex(pattern: string): RegExp {
  const parts = pattern.split("*").map((segment) => escapeRegex(segment));
  return new RegExp(`^${parts.join(".*")}$`);
}

function escapeRegex(value: string): string {
  return value.replace(/[-[\]{}()+?.,\\^$|#]/g, "\\$0");
}

type RedisClient = Redis | InMemoryRedis;

let redis: RedisClient | null = null;
let mockRedis: InMemoryRedis | null = null;
let warnedRedisMissing = false;

function resolveRedisEnv(): { url: string; token: string } | null {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    return { url: kvUrl, token: kvToken };
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) {
    return { url: upstashUrl, token: upstashToken };
  }

  return null;
}

export function getRedis() {
  if (redis) return redis;

  const resolved = resolveRedisEnv();
  const url = resolved?.url;
  const token = resolved?.token;

  if (!url || !token) {
    // Graceful degrade: never block auth/public APIs; use in-memory (non-persistent).
    mockRedis = mockRedis ?? new InMemoryRedis();
    redis = mockRedis;
    if (!warnedRedisMissing) {
      warnedRedisMissing = true;
      console.warn(
        "[REDIS] UPSTASH_REDIS_REST_URL/TOKEN ou KV_REST_API_URL/TOKEN ausentes; usando fallback em memoria (nao persistente).",
      );
    }
    return redis;
  }

  redis = new Redis({ url, token });
  return redis;
}

// For compatibility with old imports
export { redis };

export function isRedisConfigured(): boolean {
  return resolveRedisEnv() !== null;
}
