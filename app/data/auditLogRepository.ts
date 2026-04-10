import "server-only";

import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";

const USE_POSTGRES = shouldUsePostgresPersistence();
async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

export function isAuditLogStorageConfigured() {
  return true;
}

export type AuditAction =
  // Users
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "user.permissions.updated"
  | "user.permissions.reset"
  | "user.activated"
  | "user.deactivated"
  | "user.role.changed"
  | "user.email.changed"
  | "user.avatar.changed"
  | "user.profile.updated"
  // Companies / Clients
  | "client.created"
  | "client.updated"
  | "client.deleted"
  | "client.logo.changed"
  | "client.user.linked"
  | "client.user.unlinked"
  // Runs
  | "run.created"
  | "run.deleted"
  // Auth
  | "auth.login.success"
  | "auth.login.failure"
  | "auth.logout"
  | "auth.password.changed"
  | "auth.password.reset"
  | "auth.password.reset_requested"
  | "auth.access.denied"
  // Tickets / Chamados
  | "ticket.created"
  | "ticket.updated"
  | "ticket.deleted"
  | "ticket.assigned"
  | "ticket.status.changed"
  | "ticket.closed"
  | "ticket.commented"
  // Access requests / Solicitações
  | "access_request.created"
  | "access_request.accepted"
  | "access_request.rejected"
  | "access_request.updated"
  | "access_request.commented"
  // Self-service requests
  | "request.email_change"
  | "request.profile_deletion"
  | "request.company_change"
  // Defects
  | "defect.created"
  // Integrations
  | "integration.updated"
  | "integration.activated"
  | "integration.deactivated"
  | "integration.failed"
  // Data exports
  | "export.executed"
  // System / Admin
  | "system.error"
  | "audit.purged";

export type AuditEntityType = "user" | "client" | "run" | "ticket" | "access_request" | "defect" | "integration" | "export" | "request" | "system";

export type AuditLogRow = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string | null;
  entity_label: string | null;
  metadata: unknown;
};

export type AuditLogSearchParams = {
  action?: string | null;
  entityType?: string | null;
  actor?: string | null;
  query?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

export type AuditLogListParams = AuditLogSearchParams & {
  limit?: number;
  offset?: number;
};

export const AUDIT_LOG_RETENTION_DAYS = 60;

type AuditLogStore = { items: AuditLogRow[] };

const STORE_PATH = path.join(process.cwd(), "data", "audit-logs.json");
const USE_MEMORY = process.env.AUDIT_LOGS_IN_MEMORY === "true";
let memoryStore: AuditLogStore = { items: [] };
let warnedFsFailure = false;

async function ensureStore(): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.access(STORE_PATH);
    return true;
  } catch {
    try {
      await fs.writeFile(STORE_PATH, JSON.stringify({ items: [] }, null, 2), "utf8");
      return true;
    } catch (err) {
      if (!warnedFsFailure) {
        warnedFsFailure = true;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[AUDIT_LOGS] Falha ao acessar filesystem; usando memoria.", msg);
      }
      return false;
    }
  }
}

async function readStore(): Promise<AuditLogStore> {
  if (USE_MEMORY) return memoryStore;
  const ok = await ensureStore();
  if (!ok) return memoryStore;
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as AuditLogStore;
    return Array.isArray(parsed?.items) ? parsed : { items: [] };
  } catch {
    return memoryStore;
  }
}

async function writeStore(next: AuditLogStore) {
  if (USE_MEMORY) {
    memoryStore = next;
    return;
  }
  const ok = await ensureStore();
  if (!ok) {
    memoryStore = next;
    return;
  }
  try {
    await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
  } catch {
    memoryStore = next;
  }
}

type NormalizedAuditLogSearchParams = {
  action: string;
  entityType: string;
  actor: string;
  query: string;
  startDate: number | null;
  endDate: number | null;
};

function normalizeAuditLogSearchParams(params?: AuditLogSearchParams): NormalizedAuditLogSearchParams {
  const startDate = params?.startDate ? new Date(params.startDate) : null;
  const endDate = params?.endDate ? new Date(params.endDate) : null;

  if (startDate && Number.isFinite(startDate.getTime())) {
    startDate.setHours(0, 0, 0, 0);
  }

  if (endDate && Number.isFinite(endDate.getTime())) {
    endDate.setHours(23, 59, 59, 999);
  }

  return {
    action: (params?.action ?? "").trim(),
    entityType: (params?.entityType ?? "").trim(),
    actor: (params?.actor ?? "").trim().toLowerCase(),
    query: (params?.query ?? "").trim().toLowerCase(),
    startDate: startDate && Number.isFinite(startDate.getTime()) ? startDate.getTime() : null,
    endDate: endDate && Number.isFinite(endDate.getTime()) ? endDate.getTime() : null,
  };
}

function serializeSearchableMetadata(metadata: unknown): string {
  if (metadata === null || metadata === undefined) return "";
  if (typeof metadata === "string") return metadata.toLowerCase();
  try {
    return JSON.stringify(metadata).toLowerCase();
  } catch {
    return "";
  }
}

function matchesAuditLogQuery(log: AuditLogRow, params: NormalizedAuditLogSearchParams): boolean {
  if (params.action && log.action !== params.action) return false;
  if (params.entityType && log.entity_type !== params.entityType) return false;

  if (params.actor) {
    const actorEmail = (log.actor_email ?? "").toLowerCase();
    const actorId = (log.actor_user_id ?? "").toLowerCase();
    if (!actorEmail.includes(params.actor) && !actorId.includes(params.actor)) return false;
  }

  if (params.query) {
    const haystacks = [
      (log.entity_label ?? "").toLowerCase(),
      (log.entity_id ?? "").toLowerCase(),
      (log.entity_type ?? "").toLowerCase(),
      (log.actor_email ?? "").toLowerCase(),
      log.action.toLowerCase(),
      serializeSearchableMetadata(log.metadata),
    ];
    if (!haystacks.some((value) => value.includes(params.query))) return false;
  }

  const createdAt = Date.parse(log.created_at);
  if (params.startDate && Number.isFinite(createdAt) && createdAt < params.startDate) return false;
  if (params.endDate && Number.isFinite(createdAt) && createdAt > params.endDate) return false;

  return true;
}

function mapAuditLogRow(row: {
  id: string;
  created_at: Date;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  metadata: unknown;
}): AuditLogRow {
  return {
    id: row.id,
    created_at: row.created_at.toISOString(),
    actor_user_id: row.actor_user_id ?? null,
    actor_email: row.actor_email ?? null,
    action: row.action as AuditAction,
    entity_type: row.entity_type as AuditEntityType,
    entity_id: row.entity_id ?? null,
    entity_label: row.entity_label ?? null,
    metadata: row.metadata,
  };
}

export async function addAuditLog(input: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  metadata?: unknown;
}): Promise<void> {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    await prisma.auditLog.create({
      data: { actor_user_id: input.actorUserId ?? null, actor_email: input.actorEmail ?? null, action: input.action, entity_type: input.entityType, entity_id: input.entityId ?? null, entity_label: input.entityLabel ?? null, metadata: input.metadata !== undefined ? JSON.parse(JSON.stringify(input.metadata)) : null },
    });
    return;
  }
  const store = await readStore();
  const entry: AuditLogRow = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    entity_label: input.entityLabel ?? null,
    metadata: input.metadata ?? null,
  };
  const items = Array.isArray(store.items) ? store.items : [];
  items.unshift(entry);
  // Persist ALL entries — never auto-prune. Use manual purge (purgeAuditLogs) for cleanup.
  await writeStore({ items });
}

export async function searchAuditLogs(params?: AuditLogSearchParams) {
  const normalized = normalizeAuditLogSearchParams(params);

  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.auditLog.findMany({
      where: {
        ...(normalized.action ? { action: normalized.action } : {}),
        ...(normalized.entityType ? { entity_type: normalized.entityType } : {}),
        ...(normalized.actor
          ? {
              OR: [
                { actor_email: { contains: normalized.actor, mode: "insensitive" } },
                { actor_user_id: { contains: normalized.actor, mode: "insensitive" } },
              ],
            }
          : {}),
        created_at: {
          ...(normalized.startDate ? { gte: new Date(normalized.startDate) } : {}),
          ...(normalized.endDate ? { lte: new Date(normalized.endDate) } : {}),
        },
      },
      orderBy: { created_at: "desc" },
    });
    return rows.map(mapAuditLogRow).filter((row) => matchesAuditLogQuery(row, normalized));
  }

  const store = await readStore();
  return (store.items ?? [])
    .filter((log) => matchesAuditLogQuery(log, normalized))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function listAuditLogs(params?: AuditLogListParams) {
  const limit = Math.max(1, Math.min(500, Number(params?.limit ?? 200)));
  const offset = Math.max(0, Number(params?.offset ?? 0));
  const store = await readStore();
  const action = (params?.action ?? "").trim();
  const entityType = (params?.entityType ?? "").trim();
  const actor = (params?.actor ?? "").trim().toLowerCase();
  const query = (params?.query ?? "").trim().toLowerCase();
  const startDate = params?.startDate ? Date.parse(params.startDate) : null;
  const endDate = params?.endDate ? Date.parse(params.endDate) : null;

  const items = (store.items ?? []).filter((log) => {
    // Show all entries — no retention filter. Manual purge only.
    if (action && log.action !== action) return false;
    if (entityType && log.entity_type !== entityType) return false;
    if (actor) {
      const actorEmail = (log.actor_email ?? "").toLowerCase();
      const actorId = (log.actor_user_id ?? "").toLowerCase();
      if (!actorEmail.includes(actor) && !actorId.includes(actor)) return false;
    }
    if (query) {
      const label = (log.entity_label ?? "").toLowerCase();
      const id = (log.entity_id ?? "").toLowerCase();
      const type = (log.entity_type ?? "").toLowerCase();
      if (!label.includes(query) && !id.includes(query) && !type.includes(query)) return false;
    }
    if (startDate && Date.parse(log.created_at) < startDate) return false;
    if (endDate && Date.parse(log.created_at) > endDate) return false;
    return true;
  });

  return items
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(offset, offset + limit);
}

export async function purgeAuditLogs(startDate: Date, endDate: Date): Promise<number> {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const result = await prisma.auditLog.deleteMany({
      where: {
        created_at: { gte: startDate, lte: endDate },
        action: { not: "audit.purged" },
      },
    });
    return result.count;
  }
  const store = await readStore();
  const items = Array.isArray(store.items) ? store.items : [];
  const start = startDate.getTime();
  const end = endDate.getTime();
  const remaining = items.filter((item) => {
    if (item.action === "audit.purged") return true; // never delete purge records
    const ts = Date.parse(item.created_at);
    return !Number.isFinite(ts) || ts < start || ts > end;
  });
  const deleted = items.length - remaining.length;
  await writeStore({ items: remaining });
  return deleted;
}

export async function addAuditLogSafe(input: Parameters<typeof addAuditLog>[0]) {
  try {
    await addAuditLog(input);
  } catch {
    // do not break main flows if audit logging fails
  }
}
