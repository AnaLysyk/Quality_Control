import { NextRequest } from "next/server";
import { AUDIT_LOG_RETENTION_DAYS, isAuditLogStorageConfigured, listAuditLogs } from "@/data/auditLogRepository";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { apiFail, apiOk } from "@/lib/apiResponse";

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

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? "200");
  const offset = Number(searchParams.get("offset") ?? "0");
  const action = searchParams.get("action");

  const storageReady = isAuditLogStorageConfigured();
  if (!storageReady) {
    const msg = "Audit logs desativado neste ambiente: configure POSTGRES_URL/DATABASE_URL para persistir os registros.";
    return apiFail(req, msg, {
      status: 503,
      code: "AUDIT_LOGS_DISABLED",
      extra: { warning: msg },
    });
  }

  try {
    const items = await listAuditLogs({ limit, offset, action });
    const payload = {
      items,
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      warning: null,
    };
    return apiOk(req, payload, "OK", { extra: payload });
  } catch (err) {
    const payload = {
      items: [],
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      warning:
        "Nao foi possivel carregar audit logs (banco indisponivel ou tabela ausente). Configure POSTGRES_URL/DATABASE_URL e rode a migracao da tabela audit_logs.",
    };
    const message = err instanceof Error ? err.message : "Falha ao consultar audit logs";
    return apiFail(req, message, {
      status: 500,
      code: "AUDIT_LOGS_UNAVAILABLE",
      extra: payload,
    });
  }
}
