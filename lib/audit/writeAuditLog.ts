/**
 * Audit log helper — writes entries to the existing `AuditLog` Prisma model.
 *
 * Fire-and-forget, never throws. Use in API route handlers after mutations.
 *
 * Schema (audit_logs table):
 *   id, created_at, actor_user_id, actor_email, action,
 *   entity_type, entity_id, entity_label, metadata
 *
 * Usage:
 * ```ts
 * writeAuditLog({
 *   actorUserId: user.id,
 *   actorEmail: user.email,
 *   action: "create",
 *   entityType: "TestCase",
 *   entityId: record.testCase.id,
 *   entityLabel: record.testCase.title,
 *   metadata: { companyId, projectId },
 * });
 * ```
 */

export type AuditLogInput = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  /** Verb or compound action, e.g. "create", "update", "delete", "import", "status_change". */
  action: string;
  /** Model name, e.g. "TestCase", "TestRun", "TestPlan", "Defect", "Release". */
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function writeAuditLog(input: AuditLogInput): void {
  // Non-blocking — intentionally not awaited
  (async () => {
    try {
      const { prisma } = await import("@/lib/prismaClient");
      await prisma.auditLog.create({
        data: {
          actor_user_id: input.actorUserId ?? null,
          actor_email: input.actorEmail ?? null,
          action: input.action,
          entity_type: input.entityType,
          entity_id: input.entityId ?? null,
          entity_label: input.entityLabel ?? null,
          metadata: input.metadata ?? undefined,
        },
      });
    } catch {
      // Audit failures must never break the main request
    }
  })();
}
