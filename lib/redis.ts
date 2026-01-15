import "server-only";

import { Redis } from "@upstash/redis";

let redisInstance: Redis | null = null;

export function isRedisConfigured(): boolean {
  // Upstash SDK supports multiple env var names.
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token);
}

export function getRedis(): Redis {
  if (!redisInstance) {
    if (!isRedisConfigured()) {
      throw new Error(
        "Redis not configured. Set KV_REST_API_URL + KV_REST_API_TOKEN (Upstash/Vercel KV compatible) in the server environment.",
      );
    }
    redisInstance = Redis.fromEnv();
  }
  return redisInstance;
}
