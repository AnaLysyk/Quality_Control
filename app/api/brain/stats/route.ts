import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { validateBrainIntegrity } from "@/lib/brain";
import { prisma } from "@/lib/prismaClient";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const integrity = await validateBrainIntegrity();

    // Breakdown por tipo de nó
    const nodesByType = await prisma.brainNode.groupBy({
      by: ["type"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    // Breakdown por tipo de aresta
    const edgesByType = await prisma.brainEdge.groupBy({
      by: ["type"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    // Breakdown de memórias por tipo
    const memoriesByType = await prisma.brainMemory.groupBy({
      by: ["memoryType"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    // Últimas atividades
    const recentActivity = await prisma.brainAuditLog.findMany({
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
    });

    return NextResponse.json({
      integrity,
      breakdown: {
        nodesByType: nodesByType.map((g) => ({ type: g.type, count: g._count.id })),
        edgesByType: edgesByType.map((g) => ({ type: g.type, count: g._count.id })),
        memoriesByType: memoriesByType.map((g) => ({ type: g.memoryType, count: g._count.id })),
      },
      recentActivity,
    });
  } catch (error) {
    console.error("[brain/stats] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar estatisticas" }, { status: 500 });
  }
}
