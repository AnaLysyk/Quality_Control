import { NextResponse } from "next/server";

import { BrainGraphAnalyticsService } from "@/lib/brain/graphAnalyticsService";
import { resolveBrainAccess } from "@/lib/brain/access";
import { prisma } from "@/database/prismaClient";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const analytics = new BrainGraphAnalyticsService();

  try {
    const [runtimeSuggestions, persistedSuggestions, inboxItems, duplicateLabels, staleMemories, failedEvents] = await Promise.all([
      analytics.buildSuggestions({ limit: 200 }),
      prisma.brainSuggestion.findMany({
        where: { status: "suggested" },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
      prisma.brainInboxItem.findMany({
        where: { status: "pending" },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
      prisma.brainNode.groupBy({
        by: ["label"],
        _count: { id: true },
        orderBy: {
          _count: { id: "desc" },
        },
        having: {
          id: {
            _count: {
              gt: 1,
            },
          },
        },
        take: 40,
      }),
      prisma.brainMemory.count({
        where: {
          status: "ACTIVE",
          updatedAt: {
            lt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
          },
        },
      }),
      prisma.brainAuditLog.count({
        where: {
          action: { contains: "ERROR", mode: "insensitive" },
          createdAt: {
            gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
          },
        },
      }),
    ]);

    const suggestions = persistedSuggestions.length > 0
      ? persistedSuggestions
      : runtimeSuggestions;

    const weakRelationsCount = suggestions.filter((item) => item.type === "weak_relation").length;
    const orphanNodesCount = suggestions.filter((item) => item.type === "orphan_node").length;

    return NextResponse.json({
      pending: {
        suggestedRelations: weakRelationsCount,
        possibleDuplicates: duplicateLabels.length,
        orphanNodes: orphanNodesCount,
        staleMemories,
        failedEvents,
        inboxPending: inboxItems.length,
      },
      sampleSuggestions: suggestions.slice(0, 20),
      inboxItems: inboxItems.slice(0, 20),
    });
  } catch (error) {
    console.error("[brain/pending] GET error:", error);
    return NextResponse.json({ error: "Erro ao montar pendencias do Brain" }, { status: 500 });
  }
}

