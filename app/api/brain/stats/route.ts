import { NextResponse } from "next/server";

import { getGraphMetrics, validateBrainIntegrity } from "@/lib/brain";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export async function GET(req: Request) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autorizado" : "Sem permissao" }, { status });
  }

  try {
    const [
      integrity,
      graphMetrics,
      nodesByType,
      edgesByType,
      memoriesByType,
      recentActivity,
      nodeSummaries,
      incomingByNode,
      outgoingByNode,
    ] = await Promise.all([
      validateBrainIntegrity(),
      getGraphMetrics(),
      prisma.brainNode.groupBy({
        by: ["type"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.brainEdge.groupBy({
        by: ["type"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.brainMemory.groupBy({
        by: ["memoryType"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.brainAuditLog.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          entityType: true,
          reason: true,
          createdAt: true,
          userId: true,
        },
      }),
      prisma.brainNode.findMany({
        select: {
          id: true,
          label: true,
          type: true,
        },
      }),
      prisma.brainEdge.groupBy({
        by: ["toId"],
        _count: { id: true },
      }),
      prisma.brainEdge.groupBy({
        by: ["fromId"],
        _count: { id: true },
      }),
    ]);

    const degreeMap = new Map<string, { inDegree: number; outDegree: number }>();

    for (const group of incomingByNode) {
      degreeMap.set(group.toId, {
        inDegree: group._count.id,
        outDegree: degreeMap.get(group.toId)?.outDegree ?? 0,
      });
    }

    for (const group of outgoingByNode) {
      degreeMap.set(group.fromId, {
        inDegree: degreeMap.get(group.fromId)?.inDegree ?? 0,
        outDegree: group._count.id,
      });
    }

    const topConnectedNodes = nodeSummaries
      .map((node) => {
        const degrees = degreeMap.get(node.id) ?? { inDegree: 0, outDegree: 0 };
        const totalDegree = degrees.inDegree + degrees.outDegree;

        return {
          id: node.id,
          label: node.label,
          type: node.type,
          inDegree: degrees.inDegree,
          outDegree: degrees.outDegree,
          totalDegree,
        };
      })
      .filter((node) => node.totalDegree > 0)
      .sort((left, right) => right.totalDegree - left.totalDegree || right.inDegree - left.inDegree)
      .slice(0, 8);

    const connectivityRatio = graphMetrics.nodeCount > 0
      ? graphMetrics.largestComponent / graphMetrics.nodeCount
      : 0;
    const memoryCoverage = graphMetrics.nodeCount > 0
      ? graphMetrics.memoryCount / graphMetrics.nodeCount
      : 0;
    const intelligenceScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          56
            + Math.min(18, graphMetrics.averageDegree * 5)
            + Math.min(10, memoryCoverage * 14)
            + Math.round(connectivityRatio * 12)
            - Math.min(18, graphMetrics.orphanedNodes * 2)
            - Math.min(14, graphMetrics.cyclesDetected * 4)
            - Math.min(18, integrity.errors.length * 6),
        ),
      ),
    );

    const alerts: string[] = [];
    if (integrity.errors.length > 0) {
      alerts.push(...integrity.errors);
    }
    if (graphMetrics.orphanedNodes > 0) {
      alerts.push(`${graphMetrics.orphanedNodes} nos sem conexao direta no grafo.`);
    }
    if (graphMetrics.cyclesDetected > 0) {
      alerts.push(`${graphMetrics.cyclesDetected} ciclos detectados. Revisar relacoes redundantes.`);
    }
    if (graphMetrics.density < 0.015 && graphMetrics.nodeCount > 8) {
      alerts.push("Grafo disperso: a densidade esta baixa para o volume atual de nos.");
    }

    return NextResponse.json({
      integrity,
      graphMetrics,
      intelligenceScore,
      alerts,
      topConnectedNodes,
      breakdown: {
        nodesByType: nodesByType.map((group) => ({ type: group.type, count: group._count.id })),
        edgesByType: edgesByType.map((group) => ({ type: group.type, count: group._count.id })),
        memoriesByType: memoriesByType.map((group) => ({ type: group.memoryType, count: group._count.id })),
      },
      recentActivity,
    });
  } catch (error) {
    console.error("[brain/stats] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar estatisticas" }, { status: 500 });
  }
}
