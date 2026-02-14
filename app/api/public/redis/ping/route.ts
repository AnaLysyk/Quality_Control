import { NextRequest } from "next/server";

import { apiFail, apiOk } from "@/lib/apiResponse";
import { getRedis, isRedisConfigured } from "@/lib/redis";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.REDIS_PING_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-redis-ping-secret") ?? "";
  return header === secret;
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
    });
  }

  try {
    const redis = getRedis();
    const key = "health:ping";
    await redis.set(key, "pong", { ex: 5 });
    const value = await redis.get<string>(key);
    const ok = value === "pong";
    return apiOk(
      req,
      { ok },
      ok ? "OK" : "Falha no Redis",
      { extra: { ok } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro inesperado";
    return apiFail(req, "Erro no Redis", {
      status: 502,
      code: "REDIS_ERROR",
      details: msg,
    });
  }
}
