import "server-only";

import { prisma } from "@/lib/prismaClient";
import { BrainGraphAnalyticsService } from "@/lib/brain/graphAnalyticsService";

type DailyMaintenanceInput = {
  companySlug?: string | null;
  actorUserId?: string | null;
};

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function resolveRetentionPolicy(scope: string) {
  const policy = await prisma.brainRetentionPolicy.findFirst({ where: { scope } });
  if (policy) return policy;

  return prisma.brainRetentionPolicy.upsert({
    where: { scope: "default" },
    update: {},
    create: {
      scope: "default",
      eventDays: 90,
      agentRunDays: 90,
      rejectedMemoryDays: 30,
      heavyArtifactDays: 30,
      staleMemoryDays: 30,
      weeklyReviewEnabled: true,
    },
  });
}

export async function runBrainDailyMaintenance(input: DailyMaintenanceInput = {}) {
  const companySlug = input.companySlug?.trim().toLowerCase() || null;
  const policyScope = companySlug ? `company:${companySlug}` : "default";
  const policy = await resolveRetentionPolicy(policyScope);

  const analytics = new BrainGraphAnalyticsService();

  const scores = await analytics.recalculateNodeScores({ companySlug: companySlug ?? undefined });
  const weakRelations = await analytics.identifyWeakRelations({
    companySlug: companySlug ?? undefined,
    threshold: 0.6,
    limit: 200,
  });
  const orphans = await analytics.identifyOrphanNodes({ companySlug: companySlug ?? undefined, limit: 200 });

  const staleMemoryResult = await prisma.brainMemory.updateMany({
    where: {
      status: "ACTIVE",
      updatedAt: { lt: daysAgo(policy.staleMemoryDays) },
    },
    data: {
      status: "ARCHIVED",
      metadata: {
        reason: "daily_maintenance_stale_memory",
        archivedAt: new Date().toISOString(),
      },
    },
  });

  const eventCleanup = await prisma.brainAuditLog.deleteMany({
    where: { createdAt: { lt: daysAgo(policy.eventDays) } },
  });

  const rejectedMemoryCleanup = await prisma.brainMemory.deleteMany({
    where: {
      status: "INVALID",
      updatedAt: { lt: daysAgo(policy.rejectedMemoryDays) },
    },
  });

  const expiredCacheCleanup = await prisma.persistentKeyValue.deleteMany({
    where: {
      OR: [
        { key: { startsWith: "brain:" } },
        { expiresAt: { lt: new Date() } },
      ],
    },
  });

  const suggestionRows = await prisma.$transaction(
    [
      ...weakRelations.slice(0, 50).map((weak) =>
        prisma.brainSuggestion.upsert({
          where: { id: `weak-${weak.edge.id}` },
          update: {
            status: "suggested",
            confidence: Math.max(0.3, Math.min(0.9, weak.confidence)),
            updatedAt: new Date(),
            metadata: {
              relation: weak.edge.type,
              fromLabel: weak.fromLabel,
              toLabel: weak.toLabel,
            },
          },
          create: {
            id: `weak-${weak.edge.id}`,
            companySlug,
            targetNodeId: weak.edge.fromId,
            type: "weak_relation",
            title: `Relação fraca ${weak.edge.type}`,
            description: `${weak.fromLabel} -> ${weak.toLabel} (confidence ${weak.confidence.toFixed(2)})`,
            confidence: Math.max(0.3, Math.min(0.9, weak.confidence)),
            status: "suggested",
            createdBy: "system",
            riskLevel: "medium",
            requiresReview: true,
            metadata: {
              relation: weak.edge.type,
              fromLabel: weak.fromLabel,
              toLabel: weak.toLabel,
            },
          },
        }),
      ),
      ...orphans.slice(0, 50).map((node) =>
        prisma.brainSuggestion.upsert({
          where: { id: `orphan-${node.id}` },
          update: {
            status: "suggested",
            confidence: 0.88,
            updatedAt: new Date(),
          },
          create: {
            id: `orphan-${node.id}`,
            companySlug,
            targetNodeId: node.id,
            type: "orphan_node",
            title: `Nó órfão: ${node.label}`,
            description: "Nó sem relações de entrada/saída.",
            confidence: 0.88,
            status: "suggested",
            createdBy: "system",
            riskLevel: "medium",
            requiresReview: true,
          },
        }),
      ),
    ].slice(0, 80),
  );

  const suggestionIds = suggestionRows.map((item) => item.id);
  if (suggestionIds.length > 0) {
    await prisma.$transaction(
      suggestionIds.map((suggestionId) =>
        prisma.brainInboxItem.upsert({
          where: { id: `inbox-${suggestionId}` },
          update: {
            status: "pending",
            updatedAt: new Date(),
          },
          create: {
            id: `inbox-${suggestionId}`,
            kind: "suggestion",
            companySlug,
            status: "pending",
            title: "Sugestão pendente de revisão",
            summary: `Revisar sugestão ${suggestionId}`,
            suggestionId,
          },
        }),
      ),
    );
  }

  await prisma.brainAuditLog.create({
    data: {
      action: "DAILY_MAINTENANCE",
      entityType: "BrainGraph",
      entityId: companySlug ?? "global",
      userId: input.actorUserId ?? null,
      reason: "Execução diária de manutenção Brain",
      after: {
        companySlug,
        scoreUpdates: scores.updated,
        staleMemoriesArchived: staleMemoryResult.count,
        weakRelations: weakRelations.length,
        orphans: orphans.length,
        eventCleanup: eventCleanup.count,
        rejectedMemoryCleanup: rejectedMemoryCleanup.count,
        expiredCacheCleanup: expiredCacheCleanup.count,
      },
    },
  });

  return {
    companySlug,
    scoreUpdates: scores.updated,
    staleMemoriesArchived: staleMemoryResult.count,
    weakRelationsDetected: weakRelations.length,
    orphanNodesDetected: orphans.length,
    oldEventsDeleted: eventCleanup.count,
    oldRejectedMemoriesDeleted: rejectedMemoryCleanup.count,
    cacheKeysDeleted: expiredCacheCleanup.count,
    suggestionsUpserted: suggestionRows.length,
    retentionPolicy: {
      scope: policy.scope,
      eventDays: policy.eventDays,
      staleMemoryDays: policy.staleMemoryDays,
      rejectedMemoryDays: policy.rejectedMemoryDays,
    },
  };
}
