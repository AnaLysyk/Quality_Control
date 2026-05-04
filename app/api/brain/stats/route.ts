import { NextResponse } from "next/server";

import { validateBrainIntegrity } from "@/lib/brain";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export async function GET(req: Request) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autorizado" : "Sem permissão" }, { status });
  }

  try {
    const integrity = await validateBrainIntegrity();

    const nodesByType = await prisma.brainNode.groupBy({
      by: ["type"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const edgesByType = await prisma.brainEdge.groupBy({
      by: ["type"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const memoriesByType = await prisma.brainMemory.groupBy({
      by: ["memoryType"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

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
