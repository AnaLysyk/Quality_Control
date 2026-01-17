import { NextRequest } from "next/server";

import { apiFail, apiOk } from "@/lib/apiResponse";
import { getRedis, isRedisConfigured } from "@/lib/redis";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.REDIS_PING_SECRET;
  if (!secret) return false;

  const url = new URL(req.url);
  const q = url.searchParams.get("secret") ?? "";
  const header = req.headers.get("x-redis-ping-secret") ?? "";

  return q === secret || header === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return apiFail(req, "Não autorizado", {
      status: 401,
      code: "UNAUTHORIZED",
    });
  }

  if (!isRedisConfigured()) {
    return apiFail(req, "Redis não configurado", {
      status: 503,
      code: "REDIS_NOT_CONFIGURED",
      details: "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
    });
  }

  try {
    const redis = getRedis();
    const key = `health:ping:${Date.now()}`;
    await redis.set(key, "pong", { ex: 30 });
    const value = await redis.get<string>(key);

    const ok = value === "pong";
    return apiOk(
      req,
      { ok },
      ok ? "OK" : "Falha no ping do Redis",
      { extra: { ok } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro no Redis";
    return apiFail(req, "Erro no Redis", {
      status: 502,
      code: "REDIS_ERROR",
      details: msg,
    });
  }
}
