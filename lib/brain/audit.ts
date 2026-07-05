import "server-only";

import type { Prisma } from "@prisma/client";

import { brainPrisma } from "@/lib/brain/brainPrisma";

export type BrainAuditEventInput = {
  userId?: string | null;
  profile?: string | null;
  companyId?: string | null;
  projectId?: string | null;
  provider?: "qase" | "jira" | null;
  externalId?: string | null;
  action: string;
  nodeId?: string | null;
  actionId?: string | null;
  allowed: boolean;
  reason?: string | null;
  missingPermissions?: string[];
  metadata?: Record<string, unknown>;
};

export async function recordBrainAuditEvent(input: BrainAuditEventInput) {
  try {
    return await brainPrisma.brainAuditLog.create({
      data: {
        action: input.action,
        entityType: input.provider ? `BrainIntegration:${input.provider}` : "BrainAction",
        entityId: input.nodeId ?? input.externalId ?? input.actionId ?? "unknown",
        userId: input.userId ?? null,
        reason: input.reason ?? (input.allowed ? "allowed" : "blocked"),
        after: {
          profile: input.profile ?? null,
          companyId: input.companyId ?? null,
          projectId: input.projectId ?? null,
          provider: input.provider ?? null,
          externalId: input.externalId ?? null,
          nodeId: input.nodeId ?? null,
          actionId: input.actionId ?? null,
          allowed: input.allowed,
          missingPermissions: input.missingPermissions ?? [],
          metadata: input.metadata ?? {},
          createdAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("[brain.audit] failed", error);
    return null;
  }
}
