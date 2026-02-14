import { NextRequest } from "next/server";

import { apiFail, apiOk } from "@/lib/apiResponse";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { getRedis, isRedisConfigured } from "@/lib/redis";

export async function GET(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    const msg = status === 401 ? "Não autenticado" : "Sem permissão";
    return apiFail(req, msg, {
      status,
      code: status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN",
      extra: { error: msg },
    });
  }

  if (!isRedisConfigured()) {
    const payload = { ok: false, configured: false };
    const res = apiOk(
      req,
      payload,
      "Redis não configurado (defina UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN; ou KV_REST_API_URL/KV_REST_API_TOKEN)",
      { extra: payload },
    );
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  try {
    const redis = getRedis();
    const key = `health:ping:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    await redis.set(key, "pong", { ex: 30 });
    const value = await redis.get<string>(key);
    await redis.del(key);

    const payload = { ok: value === "pong", configured: true };
    const res = apiOk(req, payload, payload.ok ? "OK" : "Falha no ping do Redis", { extra: payload });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro no Redis";
    return apiFail(req, "Redis indisponível", {
      status: 503,
      code: "REDIS_UNAVAILABLE",
      extra: { ok: false, configured: true, error: msg },
    });
  }
}
