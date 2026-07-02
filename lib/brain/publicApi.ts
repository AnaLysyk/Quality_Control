import "server-only";
import type { Prisma } from "@prisma/client";

import { getSubgraph, traceImpact, searchNodes } from "@/lib/brain";
import { prisma } from "@/lib/prismaClient";

export async function brainGetContext(entity: string) {
  const node = (await searchNodes({ query: entity, limit: 1 }))[0];
  if (!node) return null;
  return getSubgraph(node.id, 2);
}

export async function brainGetImpact(entity: string) {
  const node = (await searchNodes({ query: entity, limit: 1 }))[0];
  if (!node) return null;
  return traceImpact(node.id, 3);
}

export async function brainGetRelated(entity: string) {
  const node = (await searchNodes({ query: entity, limit: 1 }))[0];
  if (!node) return [];
  const graph = await getSubgraph(node.id, 1);
  return graph.nodes.filter((item) => item.id !== node.id);
}

export async function brainCreateEvent(input: {
  eventType: string;
  entityId: string;
  userId?: string | null;
  reason?: string | null;
  payload?: Record<string, unknown>;
}) {
  return prisma.brainAuditLog.create({
    data: {
      action: input.eventType,
      entityType: "BrainGraphEvent",
      entityId: input.entityId,
      userId: input.userId ?? null,
      reason: input.reason ?? "brain.createEvent",
      after: (input.payload ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function brainExplainRelation(edgeId: string) {
  const edge = await prisma.brainEdge.findUnique({
    where: { id: edgeId },
    include: { from: true, to: true },
  });
  if (!edge) return null;

  const metadata = edge.metadata && typeof edge.metadata === "object" ? (edge.metadata as Record<string, unknown>) : {};
  return {
    edgeId,
    relationType: edge.type,
    from: { id: edge.from.id, label: edge.from.label, type: edge.from.type },
    to: { id: edge.to.id, label: edge.to.label, type: edge.to.type },
    reason: typeof metadata.reason === "string" ? metadata.reason : `${edge.from.label} ${edge.type} ${edge.to.label}`,
    confidence: typeof metadata.confidence === "number" ? metadata.confidence : edge.weight ?? 0.8,
  };
}

