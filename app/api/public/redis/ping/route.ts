import { timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

import { apiFail, apiOk } from "@/backend/apiResponse";
import { getRedis, isRedisConfigured } from "@/backend/redis";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.REDIS_PING_SECRET;
  if (!secret) return false;

  // Segredos em query string vazam em históricos e logs; aceite apenas header.
  const candidate = req.headers.get("x-redis-ping-secret") ?? "";
  const expected = Buffer.from(secret, "utf8");
  const actual = Buffer.from(candidate, "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return apiFail(req, "Não autorizado", {
      status: 401,
      code: "UNAUTHORIZED",
    });
  }

  if (!isRedisConfigured()) {
    return apiFail(req, "Serviço de sessão indisponível", {
      status: 503,
      code: "REDIS_NOT_CONFIGURED",
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
      ok ? "OK" : "Falha no serviço de sessão",
      { extra: { ok } },
    );
  } catch (error) {
    console.error("[REDIS PING]", error);
    return apiFail(req, "Erro no serviço de sessão", {
      status: 502,
      code: "REDIS_ERROR",
    });
  }
}
