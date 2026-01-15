import "server-only";

import { Redis } from "@upstash/redis";

let redisInstance: Redis | null = null;

type RedisEnv = {
  url: string;
  token: string;
  source: "UPSTASH_REDIS_REST_*" | "KV_REST_API_*";
};

function getRedisEnv(): RedisEnv | null {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) return { url: upstashUrl, token: upstashToken, source: "UPSTASH_REDIS_REST_*" };

  // Vercel KV compatibility (some setups provide these names).
  // Note: @upstash/redis `Redis.fromEnv()` does not guarantee support for these,
  // so we instantiate explicitly when using KV_* variables.
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) return { url: kvUrl, token: kvToken, source: "KV_REST_API_*" };

  return null;
}

export function isRedisConfigured(): boolean {
  return Boolean(getRedisEnv());
}

export function getRedis(): Redis {
  if (!redisInstance) {
    const env = getRedisEnv();
    if (!env) {
      throw new Error(
        "Redis not configured. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (preferred) or KV_REST_API_URL + KV_REST_API_TOKEN in the server environment.",
      );
    }

    // Use the SDK helper only when the canonical Upstash env vars are present.
    // For KV_* (Vercel KV compatible names), instantiate explicitly.
    redisInstance = env.source === "UPSTASH_REDIS_REST_*" ? Redis.fromEnv() : new Redis({ url: env.url, token: env.token });
  }
  return redisInstance;
}
