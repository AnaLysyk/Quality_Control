import { NextRequest } from "next/server";
import { AUDIT_LOG_RETENTION_DAYS, isAuditLogStorageConfigured, listAuditLogs, purgeAuditLogs, addAuditLogSafe } from "@/data/auditLogRepository";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { prisma } from "@/lib/prismaClient";

export const revalidate = 0;

export async function DELETE(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    const msg = status === 401 ? "Nao autenticado" : "Sem permissao";
    return apiFail(req, msg, {
      status,
      code: status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN",
      extra: { error: msg },
    });
  }

  let body: { startDate?: string; endDate?: string };
  try {
    body = await req.json();
  } catch {
    return apiFail(req, "Body JSON invalido", { status: 400, code: "INVALID_BODY" });
  }

  const { startDate, endDate } = body;
  if (!startDate || !endDate) {
    return apiFail(req, "startDate e endDate sao obrigatorios", { status: 400, code: "MISSING_DATES" });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return apiFail(req, "Datas invalidas", { status: 400, code: "INVALID_DATES" });
  }

  // Adjust end date to end of day
  end.setHours(23, 59, 59, 999);

  try {
    const deleted = await purgeAuditLogs(start, end);

    addAuditLogSafe({
      action: "audit.purged",
      entityType: "system",
      entityLabel: `Purge: ${deleted} logs removidos`,
      actorUserId: admin.id ?? null,
      actorEmail: admin.email ?? null,
      metadata: { operation: "purge", startDate, endDate, deletedCount: deleted },
    });

    return apiOk(req, { deleted }, `${deleted} logs removidos com sucesso`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao limpar logs";
    return apiFail(req, message, { status: 500, code: "PURGE_FAILED" });
  }
}

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
  const entityType = searchParams.get("entityType");
  const actor = searchParams.get("actor");
  const query = searchParams.get("query");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const storageReady = isAuditLogStorageConfigured();
  if (!storageReady) {
    const warning = "Audit logs desativado neste ambiente: configure armazenamento proprio.";
    const payload = {
      items: [],
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      warning,
    };
    return apiOk(req, payload, "OK", { extra: payload });
  }

  try {
    const items = await listAuditLogs({ limit, offset, action, entityType, actor, query, startDate, endDate });

    // Resolve actor avatars and names + entity usernames
    const actorIds = [...new Set(items.map((i: { actor_user_id?: string | null }) => i.actor_user_id).filter(Boolean))] as string[];
    const entityUserIds = [...new Set(items.filter((i: { entity_type?: string; entity_id?: string | null }) => i.entity_type === "user" && i.entity_id).map((i: { entity_id?: string | null }) => i.entity_id))] as string[];
    const allUserIds = [...new Set([...actorIds, ...entityUserIds])];
    let avatars: Record<string, string> = {};
    let actorNames: Record<string, string> = {};
    if (allUserIds.length > 0) {
      try {
        const users = await prisma.user.findMany({ where: { id: { in: allUserIds } }, select: { id: true, avatar_url: true, name: true, full_name: true, user: true } });
        for (const u of users) {
          if (u.avatar_url) avatars[u.id] = u.avatar_url;
          const displayName = u.full_name || u.name || u.user;
          if (displayName) actorNames[u.id] = displayName;
        }
      } catch { /* avatar/name lookup is best-effort */ }
    }

    const payload = {
      items,
      avatars,
      actorNames,
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      warning: null,
    };
    return apiOk(req, payload, "OK", { extra: payload });
  } catch (err) {
    const payload = {
      items: [],
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      warning:
        "Nao foi possivel carregar audit logs (banco indisponivel ou tabela ausente). Configure DATABASE_URL, POSTGRES_URL ou POSTGRES_PRISMA_URL e rode a migracao da tabela audit_logs.",
    };
    const message = err instanceof Error ? err.message : "Falha ao consultar audit logs";
    return apiFail(req, message, {
      status: 500,
      code: "AUDIT_LOGS_UNAVAILABLE",
      extra: payload,
    });
  }
}
