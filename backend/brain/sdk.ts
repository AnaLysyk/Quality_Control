import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/database/prismaClient";
export { publishBrianImpulse } from "@/backend/brain/contextual/publisher";
export { buildBrianImpulseEnvelope } from "@/backend/brain/contextual/pipeline";
export { runBrianWorkflow } from "@/backend/brain/contextual/runtime";
export {
  decideBrianCapabilityAccess,
  decideBrianVisibility,
  sanitizeBrianData,
  validateBrianImpulseContract,
} from "@/backend/brain/contextual/governance";

export type BrainEmitEventInput = {
  eventType: string;
  entityId: string;
  companySlug?: string | null;
  actorUserId?: string | null;
  payload?: Prisma.InputJsonValue;
};

export async function emitBrainEvent(input: BrainEmitEventInput) {
  return prisma.brainAuditLog.create({
    data: {
      action: input.eventType,
      entityType: "BrainGraphEvent",
      entityId: input.entityId,
      userId: input.actorUserId ?? null,
      reason: "brain.emit",
      after: {
        companySlug: input.companySlug ?? null,
        payload: input.payload ?? null,
      },
    },
  });
}

export const brainSdk = {
  emit: emitBrainEvent,
};

