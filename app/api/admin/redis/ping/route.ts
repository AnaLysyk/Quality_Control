import { NextRequest } from "next/server";

import { apiFail, apiOk } from "@/lib/apiResponse";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { getRedis, isRedisConfigured } from "@/lib/redis";

export async function GET(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    const msg = status === 401 ? "Nao autenticado" : "Sem permissao";
    return apiFail(req, msg, {
      status,
      code: status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN",
      extra: { error: msg },
    });
  }

  if (!isRedisConfigured()) {
    return apiOk(
      req,
      { ok: false, configured: false },
      "Redis não configurado (defina UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN; ou KV_REST_API_URL/KV_REST_API_TOKEN)",
      { extra: { ok: false, configured: false } },
    );
  }

  try {
    const redis = getRedis();
    const key = `health:ping:${Date.now()}`;
    await redis.set(key, "pong", { ex: 30 });
    const value = await redis.get<string>(key);

    const payload = { ok: value === "pong", configured: true };
    return apiOk(req, payload, payload.ok ? "OK" : "Redis ping failed", { extra: payload });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Redis error";
    const payload = { ok: false, configured: true, error: msg };
    return apiOk(req, payload, "Redis error", { extra: payload });
  }
}
