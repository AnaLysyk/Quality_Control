import "server-only";

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function hasPostgresConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

export function isAuditLogStorageConfigured() {
  return hasPostgresConfig();
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
let lastRetentionCleanupAtMs = 0;
let supabaseServiceInstance: ReturnType<typeof createClient<any>> | null = null;

function getSupabaseService() {
  if (!hasPostgresConfig()) return null;
  if (!supabaseServiceInstance) {
    supabaseServiceInstance = createClient<any>(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseServiceInstance;
}

async function cleanupOldAuditLogs() {
  if (!hasPostgresConfig()) return;

  const now = Date.now();
  if (now - lastRetentionCleanupAtMs < 6 * 60 * 60 * 1000) return;
  lastRetentionCleanupAtMs = now;

  const supabase = getSupabaseService();
  if (!supabase) return;

  const cutoff = new Date(now - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("audit_logs").delete().lt("created_at", cutoff);
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
  if (!hasPostgresConfig()) return;

  await cleanupOldAuditLogs();

  const id = randomUUID();
  const supabase = getSupabaseService();
  if (!supabase) return;

  await supabase.from("audit_logs").insert({
    id,
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    entity_label: input.entityLabel ?? null,
    metadata: input.metadata ?? null,
  });
}

export async function listAuditLogs(params?: { limit?: number; offset?: number; action?: string | null }) {
  if (!hasPostgresConfig()) return [] as AuditLogRow[];

  await cleanupOldAuditLogs();

  const limit = Math.min(Math.max(params?.limit ?? 200, 1), 500);
  const offset = Math.max(params?.offset ?? 0, 0);
  const action = params?.action ?? null;

  try {
    const supabase = getSupabaseService();
    if (!supabase) return [] as AuditLogRow[];

    const rangeStart = offset;
    const rangeEnd = offset + limit - 1;

    const query = supabase
      .from("audit_logs")
      .select("*", { count: "exact", head: false })
      .order("created_at", { ascending: false })
      .range(rangeStart, rangeEnd);

    const { data, error } = action ? await query.eq("action", action) : await query;

    if (error || !data) return [] as AuditLogRow[];
    return data as AuditLogRow[];
  } catch {
    return [] as AuditLogRow[];
  }
}

export async function addAuditLogSafe(input: Parameters<typeof addAuditLog>[0]) {
  try {
    await addAuditLog(input);
  } catch {
    // do not break main flows if audit logging fails
  }
}
