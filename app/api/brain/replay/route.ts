import { NextResponse } from "next/server";

import { getSubgraph } from "@/lib/brain";
import { assertBrainNodeAccess, filterBrainGraphByAccess, resolveBrainAccess } from "@/lib/brain/access";
import { prisma } from "@/lib/prismaClient";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const rootNodeId = url.searchParams.get("rootNodeId");
  const depth = Math.min(4, Math.max(1, Number(url.searchParams.get("depth") ?? 2)));

  if (!rootNodeId) {
    return NextResponse.json({ error: "rootNodeId e obrigatorio" }, { status: 400 });
  }

  const nodeAccess = await assertBrainNodeAccess(rootNodeId, accessResult.context);
  if (!nodeAccess.ok) {
    return NextResponse.json({ error: nodeAccess.error }, { status: nodeAccess.status });
  }

  try {
    const graph = await getSubgraph(rootNodeId, depth);
    const visibility = filterBrainGraphByAccess(graph.nodes, graph.edges, accessResult.context);
    const visibleNodeIds = Array.from(visibility.visibleNodeIds);

    const logs = await prisma.brainAuditLog.findMany({
      where: {
        OR: [
          { entityType: "BrainNode", entityId: { in: visibleNodeIds } },
          { entityType: "BrainEdge", entityId: { in: Array.from(visibility.visibleEdgeIds) } },
          { entityType: "BrainMemory" },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 400,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        reason: true,
        createdAt: true,
      },
    });
    const memoryIds = logs
      .filter((entry) => entry.entityType === "BrainMemory")
      .map((entry) => entry.entityId);
    const visibleMemoryIds = new Set(
      memoryIds.length
        ? (await prisma.brainMemory.findMany({
            where: { id: { in: memoryIds } },
            select: { id: true, nodeId: true, relatedNodeIds: true },
          }))
            .filter((memory) => {
              const relatedNodeIds = Array.isArray(memory.relatedNodeIds)
                ? memory.relatedNodeIds.filter((item): item is string => typeof item === "string")
                : [];
              return [memory.nodeId, ...relatedNodeIds].some((nodeId) => nodeId && visibility.visibleNodeIds.has(nodeId));
            })
            .map((memory) => memory.id)
        : [],
    );

    const nodeMap = new Map(
      graph.nodes
        .filter((node) => visibility.visibleNodeIds.has(node.id))
        .map((node) => [node.id, node]),
    );

    const replay = logs
      .filter((entry) => entry.entityType !== "BrainMemory" || visibleMemoryIds.has(entry.entityId))
      .map((entry, index) => {
      const node = entry.entityType === "BrainNode" ? nodeMap.get(entry.entityId) : undefined;
      return {
        step: index + 1,
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        entityLabel: node?.label ?? null,
        reason: entry.reason ?? null,
        timestamp: entry.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      rootNodeId,
      depth,
      replay,
      currentState: {
        nodeCount: visibility.visibleNodeIds.size,
        edgeCount: visibility.visibleEdgeIds.size,
      },
      history: {
        firstEventAt: replay[0]?.timestamp ?? null,
        lastEventAt: replay[replay.length - 1]?.timestamp ?? null,
      },
    });
  } catch (error) {
    console.error("[brain/replay] GET error:", error);
    return NextResponse.json({ error: "Erro ao montar replay do Brain" }, { status: 500 });
  }
}
