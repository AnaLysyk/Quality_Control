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

  try {
    const items = await listAuditLogs({ limit, offset, action });
    const payload = {
      items,
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      warning: storageReady
        ? null
        : "Audit logs desativado neste ambiente: configure POSTGRES_URL/DATABASE_URL para persistir os registros.",
    };
    return apiOk(req, payload, "OK", { extra: payload });
  } catch {
    const payload = {
      items: [],
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      warning:
        "Não foi possível carregar audit logs (banco indisponível ou tabela ausente). Configure POSTGRES_URL/DATABASE_URL e rode a migração da tabela audit_logs.",
    };
    return apiOk(req, payload, "OK", { extra: payload });
  }
}
