import { NextRequest } from "next/server";
import {
  AUDIT_LOG_RETENTION_DAYS,
  addAuditLogSafe,
  isAuditLogStorageConfigured,
  purgeAuditLogs,
  searchAuditLogs,
} from "@/data/auditLogRepository";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export const revalidate = 0;

type ActionCategory =
  | "create"
  | "update"
  | "delete"
  | "permission"
  | "link"
  | "auth"
  | "error"
  | "integration"
  | "export"
  | "default";

type AuditLogItem = Awaited<ReturnType<typeof searchAuditLogs>>[number];

type TrendPoint = {
  bucket: string;
  label: string;
  total: number;
  error: number;
};

type FacetCount = {
  value: string;
  count: number;
};

type ResultFilter = "" | "success" | "error" | "warning";

const CATEGORY_ORDER: ActionCategory[] = [
  "auth",
  "create",
  "update",
  "delete",
  "permission",
  "link",
  "integration",
  "export",
  "error",
  "default",
];

const RESULT_CATEGORIES: Record<ResultFilter, ActionCategory[]> = {
  "": [],
  success: ["create", "update", "permission", "link", "auth", "export", "default"],
  error: ["error"],
  warning: ["delete"],
};

function getCategory(action: string): ActionCategory {
  const value = action.toLowerCase();
  if (value.includes("failure") || value.includes("fail") || value.includes("system.error") || value.includes("denied")) {
    return "error";
  }
  if (value.includes("error")) return "error";
  if (value.includes("login") || value.includes("logout") || value.includes("auth") || value.includes("password")) return "auth";
  if (value.includes("export")) return "export";
  if (value.includes("request.") || value.includes("access_request")) return "link";
  if (value.includes("link") || value.includes("unlink") || value.includes("membership")) return "link";
  if (value.includes("integration") || value.includes("sync")) return "integration";
  if (value.includes("permission") || value.includes("role") || value.includes("activated") || value.includes("deactivated")) return "permission";
  if (value.includes("ticket") || value.includes("defect")) {
    if (value.includes("create")) return "create";
    if (value.includes("delete") || value.includes("closed")) return "delete";
    return "update";
  }
  if (value.includes("create")) return "create";
  if (value.includes("update") || value.includes("changed") || value.includes("logo") || value.includes("avatar") || value.includes("profile")) return "update";
  if (value.includes("delete") || value.includes("removed")) return "delete";
  return "default";
}

function parseBoundaryDate(value: string | null, boundary: "start" | "end"): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  if (boundary === "start") {
    date.setHours(0, 0, 0, 0);
  } else {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function toBucketKey(date: Date, mode: "hour" | "day") {
  if (mode === "hour") {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).toISOString();
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
}

function formatBucketLabel(bucket: string, mode: "hour" | "day") {
  const date = new Date(bucket);
  if (!Number.isFinite(date.getTime())) return bucket;
  if (mode === "hour") {
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
    });
  }
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function buildTrend(items: AuditLogItem[], startDate: string | null, endDate: string | null): TrendPoint[] {
  if (!items.length) return [];

  const timestamps = items
    .map((item) => Date.parse(item.created_at))
    .filter((value) => Number.isFinite(value));

  if (!timestamps.length) return [];

  const rangeStart = parseBoundaryDate(startDate, "start") ?? new Date(Math.min(...timestamps));
  const rangeEnd = parseBoundaryDate(endDate, "end") ?? new Date(Math.max(...timestamps));
  const diffMs = Math.max(0, rangeEnd.getTime() - rangeStart.getTime());
  const mode = diffMs <= 48 * 60 * 60 * 1000 ? "hour" : "day";
  const maxPoints = mode === "hour" ? 48 : 30;
  const buckets = new Map<string, TrendPoint>();

  for (const item of items) {
    const date = new Date(item.created_at);
    if (!Number.isFinite(date.getTime())) continue;
    const bucket = toBucketKey(date, mode);
    const current = buckets.get(bucket) ?? {
      bucket,
      label: formatBucketLabel(bucket, mode),
      total: 0,
      error: 0,
    };
    current.total += 1;
    if (getCategory(item.action) === "error") {
      current.error += 1;
    }
    buckets.set(bucket, current);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.bucket.localeCompare(b.bucket))
    .slice(-maxPoints);
}

function buildFacetCounts(items: AuditLogItem[], pick: (item: AuditLogItem) => string | null | undefined): FacetCount[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = pick(item)?.trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, 20);
}

function buildCategoryCounts(items: AuditLogItem[]) {
  const counts: Partial<Record<ActionCategory, number>> = {};
  for (const item of items) {
    const category = getCategory(item.action);
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return CATEGORY_ORDER.reduce((acc, category) => {
    if (counts[category]) {
      acc[category] = counts[category] ?? 0;
    }
    return acc;
  }, {} as Partial<Record<ActionCategory, number>>);
}

function buildSummary(items: AuditLogItem[]) {
  const errorCount = items.filter((item) => getCategory(item.action) === "error").length;
  const authCount = items.filter((item) => getCategory(item.action) === "auth").length;
  const uniqueActors = new Set(
    items
      .map((item) => item.actor_user_id ?? item.actor_email ?? "")
      .filter(Boolean),
  ).size;

  return {
    total: items.length,
    errorCount,
    authCount,
    uniqueActors,
    lastEventAt: items[0]?.created_at ?? null,
  };
}

export async function DELETE(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    const msg = status === 401 ? "Não autenticado" : "Sem permissão";
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
    const msg = status === 401 ? "Não autenticado" : "Sem permissão";
    return apiFail(req, msg, {
      status,
      code: status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN",
      extra: { error: msg },
    });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") ?? "50")));
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0"));
  const action = (searchParams.get("action") ?? "").trim();
  const entityType = (searchParams.get("entityType") ?? "").trim();
  const actor = searchParams.get("actor");
  const query = searchParams.get("query");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const category = (searchParams.get("category") ?? "").trim().toLowerCase() as ActionCategory | "";
  const result = (searchParams.get("result") ?? "").trim().toLowerCase() as ResultFilter;

  const storageReady = isAuditLogStorageConfigured();
  if (!storageReady) {
    const warning = "Audit logs desativado neste ambiente: configure armazenamento próprio.";
    const payload = {
      items: [],
      avatars: {},
      actorNames: {},
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      warning,
      total: 0,
      summary: {
        total: 0,
        errorCount: 0,
        authCount: 0,
        uniqueActors: 0,
        lastEventAt: null,
      },
      trend: [],
      topActions: [],
      categoryCounts: {},
      facets: {
        actions: [],
        entityTypes: [],
      },
    };
    return apiOk(req, payload, "OK", { extra: payload });
  }

  try {
    const relevantItems = await searchAuditLogs({ actor, query, startDate, endDate });
    const resultItems = RESULT_CATEGORIES[result]?.length
      ? relevantItems.filter((item) => RESULT_CATEGORIES[result].includes(getCategory(item.action)))
      : relevantItems;
    const categoryItems = category ? resultItems.filter((item) => getCategory(item.action) === category) : resultItems;
    const actionItems = action ? categoryItems.filter((item) => item.action === action) : categoryItems;
    const filteredItems = entityType ? actionItems.filter((item) => item.entity_type === entityType) : actionItems;
    const pageItems = filteredItems.slice(offset, offset + limit);

    const actorIds = [...new Set(pageItems.map((item) => item.actor_user_id).filter(Boolean))] as string[];
    const entityUserIds = [
      ...new Set(
        pageItems
          .filter((item) => item.entity_type === "user" && item.entity_id)
          .map((item) => item.entity_id),
      ),
    ] as string[];
    const allUserIds = [...new Set([...actorIds, ...entityUserIds])];

    const avatars: Record<string, string> = {};
    const actorNames: Record<string, string> = {};

    if (allUserIds.length > 0) {
      try {
        const users = await prisma.user.findMany({
          where: { id: { in: allUserIds } },
          select: { id: true, avatar_url: true, name: true, full_name: true, user: true },
        });

        for (const user of users) {
          if (user.avatar_url) avatars[user.id] = user.avatar_url;
          const displayName = user.full_name || user.name || user.user;
          if (displayName) actorNames[user.id] = displayName;
        }
      } catch {
        // Avatar/name lookup is best-effort.
      }
    }

    const payload = {
      items: pageItems,
      avatars,
      actorNames,
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      warning: null,
      total: filteredItems.length,
      summary: buildSummary(filteredItems),
      trend: buildTrend(filteredItems, startDate, endDate),
      topActions: buildFacetCounts(filteredItems, (item) => item.action).slice(0, 5),
      categoryCounts: buildCategoryCounts(resultItems),
      facets: {
        actions: buildFacetCounts(categoryItems, (item) => item.action),
        entityTypes: buildFacetCounts(actionItems, (item) => item.entity_type),
      },
    };

    return apiOk(req, payload, "OK", { extra: payload });
  } catch (err) {
    const payload = {
      items: [],
      avatars: {},
      actorNames: {},
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      warning:
        "Não foi possível carregar audit logs (banco indisponivel ou tabela ausente). Configure DATABASE_URL, POSTGRES_URL ou POSTGRES_PRISMA_URL e rode a migração da tabela audit_logs.",
      total: 0,
      summary: {
        total: 0,
        errorCount: 0,
        authCount: 0,
        uniqueActors: 0,
        lastEventAt: null,
      },
      trend: [],
      topActions: [],
      categoryCounts: {},
      facets: {
        actions: [],
        entityTypes: [],
      },
    };
    const message = err instanceof Error ? err.message : "Falha ao consultar audit logs";
    return apiFail(req, message, {
      status: 500,
      code: "AUDIT_LOGS_UNAVAILABLE",
      extra: payload,
    });
  }
}
