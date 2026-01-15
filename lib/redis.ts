import "server-only";

import { Redis } from "@upstash/redis";

let redisInstance: Redis | null = null;

type RedisEnv = {
  url: string;
  token: string;
  source: "UPSTASH_REDIS_REST_*" | "*_UPSTASH_REDIS_REST_*" | "KV_REST_API_*";
};

function getRedisEnv(): RedisEnv | null {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) return { url: upstashUrl, token: upstashToken, source: "UPSTASH_REDIS_REST_*" };

  // Some providers (including Vercel integrations) may prefix env vars with the database name,
  // e.g. `METRICA_DE_TESTE_UPSTASH_REDIS_REST_URL`.
  // If you have multiple databases, set UPSTASH_REDIS_REST_PREFIX to choose which one to use.
  const prefix = (process.env.UPSTASH_REDIS_REST_PREFIX || "").trim();
  if (prefix) {
    const prefixedUrl = process.env[`${prefix}_UPSTASH_REDIS_REST_URL`];
    const prefixedToken = process.env[`${prefix}_UPSTASH_REDIS_REST_TOKEN`];
    if (prefixedUrl && prefixedToken) {
      return { url: prefixedUrl, token: prefixedToken, source: "*_UPSTASH_REDIS_REST_*" };
    }
  }

  // Auto-detect a single prefixed pair when unambiguous.
  const entries = Object.entries(process.env);
  const urlCandidates = entries
    .filter(([k, v]) => k.endsWith("_UPSTASH_REDIS_REST_URL") && typeof v === "string" && v.trim())
    .map(([k, v]) => ({ key: k, value: (v as string).trim() }));
  const tokenCandidates = entries
    .filter(([k, v]) => k.endsWith("_UPSTASH_REDIS_REST_TOKEN") && typeof v === "string" && v.trim())
    .map(([k, v]) => ({ key: k, value: (v as string).trim() }));

  const pickPrefixedPair = (): { url: string; token: string } | null => {
    if (urlCandidates.length !== 1 || tokenCandidates.length !== 1) return null;
    const urlKey = urlCandidates[0].key;
    const tokenKey = tokenCandidates[0].key;
    const urlPrefix = urlKey.slice(0, -"_UPSTASH_REDIS_REST_URL".length);
    const tokenPrefix = tokenKey.slice(0, -"_UPSTASH_REDIS_REST_TOKEN".length);
    if (!urlPrefix || urlPrefix !== tokenPrefix) return null;
    return { url: urlCandidates[0].value, token: tokenCandidates[0].value };
  };

  const detected = pickPrefixedPair();
  if (detected) return { ...detected, source: "*_UPSTASH_REDIS_REST_*" };

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
        "Redis not configured. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (preferred), or set UPSTASH_REDIS_REST_PREFIX to use <PREFIX>_UPSTASH_REDIS_REST_URL/<PREFIX>_UPSTASH_REDIS_REST_TOKEN, or KV_REST_API_URL + KV_REST_API_TOKEN in the server environment.",
      );
    }

    // Use the SDK helper only when the canonical Upstash env vars are present.
    // For KV_* (Vercel KV compatible names), instantiate explicitly.
    redisInstance = env.source === "UPSTASH_REDIS_REST_*" ? Redis.fromEnv() : new Redis({ url: env.url, token: env.token });
  }
  return redisInstance;
}
