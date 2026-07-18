import { NextResponse } from "next/server";

import { resolveBrainAccess } from "@/lib/brain/access";
import { syncBrain } from "@/lib/brain-sync";
import { prisma } from "@/database/prismaClient";

export async function POST(req: Request) {
  const accessResult = await resolveBrainAccess(req, { requireManage: true });
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const startedAt = Date.now();

  try {
    await syncBrain();

    await prisma.brainAuditLog.create({
      data: {
        action: "REINDEX_GRAPH",
        entityType: "BrainGraph",
        entityId: "root",
        userId: accessResult.context.user.id,
        reason: "Reindexacao manual do grafo",
        after: {
          durationMs: Date.now() - startedAt,
        },
      },
    });

    return NextResponse.json({
      status: "ok",
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[brain/graph/reindex] POST error:", error);
    return NextResponse.json({ error: "Erro ao reindexar grafo do Brain" }, { status: 500 });
  }
}

