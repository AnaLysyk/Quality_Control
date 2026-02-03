import "server-only";

export function isAuditLogStorageConfigured() {
  return false;
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

export async function addAuditLog(_input: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  metadata?: unknown;
}): Promise<void> {
  void _input;
  // Audit logs desativados sem storage dedicado.
  return;
}

export async function listAuditLogs(_params?: { limit?: number; offset?: number; action?: string | null }) {
  void _params;
  throw new Error("AUDIT_LOG_STORAGE_DISABLED");
}

export async function addAuditLogSafe(input: Parameters<typeof addAuditLog>[0]) {
  try {
    await addAuditLog(input);
  } catch {
    // do not break main flows if audit logging fails
  }
}
