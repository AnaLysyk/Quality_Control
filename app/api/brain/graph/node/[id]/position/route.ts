import { NextResponse } from "next/server";

import { updateNodeMetadata } from "@/lib/brain";
import { assertBrainNodeAccess, resolveBrainAccess } from "@/lib/brain/access";

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const { id } = await params;
  const nodeAccess = await assertBrainNodeAccess(id, accessResult.context);
  if (!nodeAccess.ok) {
    return NextResponse.json({ error: nodeAccess.error }, { status: nodeAccess.status });
  }

  try {
    const body = await req.json();
    const x = Number(body?.x);
    const y = Number(body?.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return NextResponse.json({ error: "x e y devem ser numeros validos" }, { status: 400 });
    }

    const currentMetadata = toRecord(nodeAccess.node.metadata);
    const metadata = {
      ...currentMetadata,
      position: { x, y },
    };

    const updatedNode = await updateNodeMetadata(id, metadata, accessResult.context.user.id);

    return NextResponse.json({
      node: {
        id: updatedNode.id,
        metadata: updatedNode.metadata,
      },
    });
  } catch (error) {
    console.error("[brain/graph/node/[id]/position] PATCH error:", error);
    return NextResponse.json({ error: "Erro ao atualizar posicao do no" }, { status: 500 });
  }
}

