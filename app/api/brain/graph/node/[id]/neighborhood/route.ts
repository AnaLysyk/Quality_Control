import { NextResponse } from "next/server";

import { getSubgraph } from "@/lib/brain";
import { assertBrainNodeAccess, filterBrainGraphByAccess, resolveBrainAccess } from "@/lib/brain/access";

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
  const depth = Math.min(4, Math.max(1, Number(url.searchParams.get("depth") ?? 2)));

  try {
    const subgraph = await getSubgraph(id, depth);
    const visibility = filterBrainGraphByAccess(subgraph.nodes, subgraph.edges, accessResult.context);

    const nodes = subgraph.nodes
      .filter((node) => visibility.visibleNodeIds.has(node.id))
      .map((node) => ({
        id: node.id,
        label: node.label,
        type: node.type,
        description: node.description,
        metadata: node.metadata,
      }));

    const edges = subgraph.edges
      .filter((edge) => visibility.visibleEdgeIds.has(edge.id))
      .map((edge) => ({
        id: edge.id,
        source: edge.fromId,
        target: edge.toId,
        type: edge.type,
        weight: edge.weight,
      }));

    return NextResponse.json({ nodeId: id, depth, nodes, edges });
  } catch (error) {
    console.error("[brain/graph/node/[id]/neighborhood] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar vizinhanca do no" }, { status: 500 });
  }
}
