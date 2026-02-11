import "server-only";

import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";

export function isAuditLogStorageConfigured() {
  return true;
}

export type AuditAction =
  | "user.created"
  | "user.updated"
  | "client.created"
  | "client.updated"
  | "client.deleted"
  | "run.created"
  | "run.deleted";

export type AuditEntityType = "user" | "client" | "run";

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

export const AUDIT_LOG_RETENTION_DAYS = 60;

type AuditLogStore = { items: AuditLogRow[] };

const STORE_PATH = path.join(process.cwd(), "data", "audit-logs.json");
const USE_MEMORY = process.env.AUDIT_LOGS_IN_MEMORY === "true" || process.env.VERCEL === "1";
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

function isWithinRetention(createdAt: string) {
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) return true;
  const cutoff = Date.now() - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return timestamp >= cutoff;
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
  const filtered = items.filter((item) => isWithinRetention(item.created_at));
  await writeStore({ items: filtered });
}

export async function listAuditLogs(params?: {
  limit?: number;
  offset?: number;
  action?: string | null;
  entityType?: string | null;
  actor?: string | null;
  query?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const store = await readStore();
  const limit = Math.max(1, Math.min(500, Number(params?.limit ?? 200)));
  const offset = Math.max(0, Number(params?.offset ?? 0));
  const action = (params?.action ?? "").trim();
  const entityType = (params?.entityType ?? "").trim();
  const actor = (params?.actor ?? "").trim().toLowerCase();
  const query = (params?.query ?? "").trim().toLowerCase();
  const startDate = params?.startDate ? Date.parse(params.startDate) : null;
  const endDate = params?.endDate ? Date.parse(params.endDate) : null;

  const items = (store.items ?? []).filter((log) => {
    if (!isWithinRetention(log.created_at)) return false;
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

export async function addAuditLogSafe(input: Parameters<typeof addAuditLog>[0]) {
  try {
    await addAuditLog(input);
  } catch {
    // do not break main flows if audit logging fails
  }
}
