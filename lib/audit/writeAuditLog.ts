import type { Prisma } from "@prisma/client";

export type AuditLogInput = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function writeAuditLog(input: AuditLogInput): void {
  (async () => {
    try {
      const { prisma } = await import("@/database/prismaClient");
      await prisma.auditLog.create({
        data: {
          actor_user_id: input.actorUserId ?? null,
          actor_email: input.actorEmail ?? null,
          action: input.action,
          entity_type: input.entityType,
          entity_id: input.entityId ?? null,
          entity_label: input.entityLabel ?? null,
          metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch {
      // audit must not block the main flow
    }

    try {
      const { ingestAuditLogInputIntoBrain } = await import("@/lib/brain/systemIngest");
      ingestAuditLogInputIntoBrain(input);
    } catch {
      // brain ingest must not block the main flow
    }
  })();
}

