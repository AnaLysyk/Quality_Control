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

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

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

export function getRedis() {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (SUPABASE_MOCK) {
      mockRedis = mockRedis ?? new InMemoryRedis();
      redis = mockRedis;
      return redis;
    }
    throw new Error("Upstash Redis não configurado");
  }

  redis = new Redis({ url, token });
  return redis;
}

// For compatibility with old imports
export { redis };

export function isRedisConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token) || SUPABASE_MOCK;
}
