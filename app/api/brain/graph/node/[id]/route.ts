import { NextResponse } from "next/server";

import { getNodeWithContext } from "@/lib/brain";
import { assertBrainNodeAccess, resolveBrainAccess } from "@/lib/brain/access";

export async function GET(
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

  const url = new URL(req.url);
  const depth = Math.min(3, Math.max(1, Number(url.searchParams.get("depth") ?? 1)));

  try {
    const context = await getNodeWithContext(id, depth);
    if (!context?.node) {
      return NextResponse.json({ error: "No nao encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      node: context.node,
      outgoing: context.outgoing,
      incoming: context.incoming,
      neighbors: context.neighbors,
    });
  } catch (error) {
    console.error("[brain/graph/node/[id]] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar no do grafo" }, { status: 500 });
  }
}
