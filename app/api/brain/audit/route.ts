import { NextResponse } from "next/server";

import { isBrainNodeVisible, resolveBrainAccess } from "@/lib/brain/access";
import { prisma } from "@/lib/prismaClient";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const { context: access } = accessResult;
  const url = new URL(req.url);
  const limit = Math.min(300, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
  const action = url.searchParams.get("action") ?? undefined;
  const entityType = url.searchParams.get("entityType") ?? undefined;

  try {
    const logs = await prisma.brainAuditLog.findMany({
      where: {
        ...(action ? { action } : {}),
        ...(entityType ? { entityType } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    if (access.hasGlobalVisibility) {
      return NextResponse.json({ logs });
    }

    const allNodes = await prisma.brainNode.findMany({
      select: { id: true, type: true, refType: true, refId: true, metadata: true },
    });

    const visibleNodeIds = new Set(
      allNodes
        .filter((node) => isBrainNodeVisible(node, access))
        .map((node) => node.id),
    );

    const edgeIds = logs
      .filter((log) => log.entityType === "BrainEdge")
      .map((log) => log.entityId);
    const memoryIds = logs
      .filter((log) => log.entityType === "BrainMemory")
      .map((log) => log.entityId);

    const [edges, memories] = await Promise.all([
      edgeIds.length
        ? prisma.brainEdge.findMany({
            where: { id: { in: edgeIds } },
            select: { id: true, fromId: true, toId: true },
          })
        : Promise.resolve([]),
      memoryIds.length
        ? prisma.brainMemory.findMany({
            where: { id: { in: memoryIds } },
            select: { id: true, nodeId: true, relatedNodeIds: true },
          })
        : Promise.resolve([]),
    ]);

    const edgeMap = new Map(edges.map((edge) => [edge.id, edge]));
    const memoryMap = new Map(memories.map((memory) => [memory.id, memory]));

    const scopedLogs = logs.filter((log) => {
      if (log.entityType === "BrainNode") {
        return visibleNodeIds.has(log.entityId);
      }

      if (log.entityType === "BrainEdge") {
        const edge = edgeMap.get(log.entityId);
        return Boolean(edge && visibleNodeIds.has(edge.fromId) && visibleNodeIds.has(edge.toId));
      }

      if (log.entityType === "BrainMemory") {
        const memory = memoryMap.get(log.entityId);
        if (!memory) return false;
        const relatedNodeIds = asStringArray(memory.relatedNodeIds);
        return (
          (memory.nodeId ? visibleNodeIds.has(memory.nodeId) : false) ||
          relatedNodeIds.some((id) => visibleNodeIds.has(id))
        );
      }

      return false;
    });

    return NextResponse.json({ logs: scopedLogs });
  } catch (error) {
    console.error("[brain/audit] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar auditoria do Brain" }, { status: 500 });
  }
}

