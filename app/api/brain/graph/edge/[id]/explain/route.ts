import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { assertBrainNodeAccess, resolveBrainAccess } from "@/lib/brain/access";
import { resolveEdgeConfidence, toRecord } from "@/lib/brain/ontology";
import { prisma } from "@/lib/prismaClient";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const { id } = await params;

  try {
    const edge = await prisma.brainEdge.findUnique({
      where: { id },
      include: {
        from: true,
        to: true,
      },
    });

    if (!edge) {
      return NextResponse.json({ error: "Relacao nao encontrada" }, { status: 404 });
    }

    const [fromAccess, toAccess] = await Promise.all([
      assertBrainNodeAccess(edge.fromId, accessResult.context),
      assertBrainNodeAccess(edge.toId, accessResult.context),
    ]);

    if (!fromAccess.ok || !toAccess.ok) {
      return NextResponse.json({ error: "Sem permissao para explicar esta relacao" }, { status: 403 });
    }

    const metadata = toRecord(edge.metadata as Prisma.JsonValue);
    const reason = typeof metadata.reason === "string" && metadata.reason.trim().length > 0
      ? metadata.reason.trim()
      : `${edge.from.label} ${edge.type} ${edge.to.label}`;
    const sourceEvent = typeof metadata.source === "string" && metadata.source.trim().length > 0
      ? metadata.source.trim()
      : "manual_link";
    const actor = typeof metadata.createdBy === "string" && metadata.createdBy.trim().length > 0
      ? metadata.createdBy.trim()
      : "system";
    const confidence = resolveEdgeConfidence(sourceEvent, metadata.confidence);

    return NextResponse.json({
      edgeId: edge.id,
      relationType: edge.type,
      explanation: `Relacao ${edge.type} entre ${edge.from.label} e ${edge.to.label}. Motivo: ${reason}.`,
      sourceEvent,
      actor,
      createdAt: edge.createdAt,
      confidence,
      evidence: toRecord(metadata.evidence as Prisma.JsonValue),
      reason,
      from: {
        id: edge.from.id,
        type: edge.from.type,
        label: edge.from.label,
      },
      to: {
        id: edge.to.id,
        type: edge.to.type,
        label: edge.to.label,
      },
    });
  } catch (error) {
    console.error("[brain/graph/edge/[id]/explain] GET error:", error);
    return NextResponse.json({ error: "Erro ao explicar relacao" }, { status: 500 });
  }
}
