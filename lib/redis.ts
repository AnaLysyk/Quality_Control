import "server-only";

import { Redis } from "@upstash/redis";

let redisInstance: Redis | null = null;

type RedisEnv = {
  url: string;
  token: string;
  source:
    | "KV_REST_API_*"
    | "UPSTASH_REDIS_REST_*"
    | "*_KV_REST_API_*"
    | "*_UPSTASH_REDIS_REST_*";
};

function getRedisEnv(): RedisEnv | null {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) return { url: kvUrl, token: kvToken, source: "KV_REST_API_*" };

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) return { url: upstashUrl, token: upstashToken, source: "UPSTASH_REDIS_REST_*" };

  // Some Vercel/Upstash integrations namespace variables with the database name, e.g.
  // `testing_metric_KV_REST_API_URL`.
  const entries = Object.entries(process.env);

  const kvUrlCandidates = entries
    .filter(([k, v]) => k.endsWith("_KV_REST_API_URL") && typeof v === "string" && v.trim())
    .map(([k, v]) => ({ key: k, value: (v as string).trim() }));
  const kvTokenCandidates = entries
    .filter(([k, v]) => k.endsWith("_KV_REST_API_TOKEN") && typeof v === "string" && v.trim())
    .map(([k, v]) => ({ key: k, value: (v as string).trim() }));

  const pickPrefixedPair = (
    urlCandidates: Array<{ key: string; value: string }>,
    tokenCandidates: Array<{ key: string; value: string }>,
  ): { url: string; token: string } | null => {
    if (urlCandidates.length !== 1 || tokenCandidates.length !== 1) return null;
    const urlKey = urlCandidates[0].key;
    const tokenKey = tokenCandidates[0].key;
    const urlPrefix = urlKey.slice(0, -"_KV_REST_API_URL".length);
    const tokenPrefix = tokenKey.slice(0, -"_KV_REST_API_TOKEN".length);
    if (!urlPrefix || urlPrefix !== tokenPrefix) return null;
    return { url: urlCandidates[0].value, token: tokenCandidates[0].value };
  };

  const kvPair = pickPrefixedPair(kvUrlCandidates, kvTokenCandidates);
  if (kvPair) return { ...kvPair, source: "*_KV_REST_API_*" };

  const upstashUrlCandidates = entries
    .filter(([k, v]) => k.endsWith("_UPSTASH_REDIS_REST_URL") && typeof v === "string" && v.trim())
    .map(([k, v]) => ({ key: k, value: (v as string).trim() }));
  const upstashTokenCandidates = entries
    .filter(([k, v]) => k.endsWith("_UPSTASH_REDIS_REST_TOKEN") && typeof v === "string" && v.trim())
    .map(([k, v]) => ({ key: k, value: (v as string).trim() }));

  const pickUpstashPair = (
    urlCandidates: Array<{ key: string; value: string }>,
    tokenCandidates: Array<{ key: string; value: string }>,
  ): { url: string; token: string } | null => {
    if (urlCandidates.length !== 1 || tokenCandidates.length !== 1) return null;
    const urlKey = urlCandidates[0].key;
    const tokenKey = tokenCandidates[0].key;
    const urlPrefix = urlKey.slice(0, -"_UPSTASH_REDIS_REST_URL".length);
    const tokenPrefix = tokenKey.slice(0, -"_UPSTASH_REDIS_REST_TOKEN".length);
    if (!urlPrefix || urlPrefix !== tokenPrefix) return null;
    return { url: urlCandidates[0].value, token: tokenCandidates[0].value };
  };

  const upstashPair = pickUpstashPair(upstashUrlCandidates, upstashTokenCandidates);
  if (upstashPair) return { ...upstashPair, source: "*_UPSTASH_REDIS_REST_*" };

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
        "Redis not configured. Set KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) in the server environment.",
      );
    }

    // If using the canonical env var names, delegate to the SDK helper.
    // Otherwise (prefixed vars), instantiate explicitly.
    if (env.source === "KV_REST_API_*" || env.source === "UPSTASH_REDIS_REST_*") {
      redisInstance = Redis.fromEnv();
    } else {
      redisInstance = new Redis({ url: env.url, token: env.token });
    }
  }
  return redisInstance;
}
