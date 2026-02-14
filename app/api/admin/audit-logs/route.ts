import { NextRequest } from "next/server";

import { AUDIT_LOG_RETENTION_DAYS, isAuditLogStorageConfigured, listAuditLogs } from "@/data/auditLogRepository";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { apiFail, apiOk } from "@/lib/apiResponse";

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.min(max, Math.max(min, Math.trunc(parsed)));
  return clamped;
}

function normalizeString(value: string | null) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isoOrUndefined(value: string | null) {
  const raw = normalizeString(value);
  if (!raw) return undefined;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

function noStore(res: Response) {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    const msg = status === 401 ? "Nao autenticado" : "Sem permissao";
    return noStore(
      apiFail(req, msg, {
        status,
        code: status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN",
        extra: { error: msg },
      }),
    );
  }

  const { searchParams } = new URL(req.url);
  const limit = clampInt(searchParams.get("limit"), 200, 1, 1000);
  const offset = clampInt(searchParams.get("offset"), 0, 0, 1_000_000);
  const action = normalizeString(searchParams.get("action"));
  const entityType = normalizeString(searchParams.get("entityType"));
  const actor = normalizeString(searchParams.get("actor"));
  const query = normalizeString(searchParams.get("query"));
  const startDate = isoOrUndefined(searchParams.get("startDate"));
  const endDate = isoOrUndefined(searchParams.get("endDate"));

  const storageReady = isAuditLogStorageConfigured();
  if (!storageReady) {
    const warning = "Audit logs desativado neste ambiente: configure armazenamento proprio.";
    const payload = {
      items: [],
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      warning,
    };
    return noStore(apiOk(req, payload, "OK", { extra: payload }));
  }

  try {
    const items = await listAuditLogs({ limit, offset, action, entityType, actor, query, startDate, endDate });
    const payload = {
      items,
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      warning: null,
    };
    return noStore(apiOk(req, payload, "OK", { extra: payload }));
  } catch (err) {
    const payload = {
      items: [],
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      warning:
        "Nao foi possivel carregar audit logs (banco indisponivel ou tabela ausente). Configure DATABASE_URL, POSTGRES_URL ou POSTGRES_PRISMA_URL e rode a migracao da tabela audit_logs.",
    };
    const message = err instanceof Error ? err.message : "Falha ao consultar audit logs";
    return noStore(
      apiFail(req, message, {
        status: 503,
        code: "AUDIT_LOGS_UNAVAILABLE",
        extra: payload,
      }),
    );
  }
}
