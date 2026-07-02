import { NextResponse } from "next/server";

import { getNodeWithContext } from "@/lib/brain";
import { assertBrainNodeAccess, filterBrainGraphByAccess, resolveBrainAccess } from "@/lib/brain/access";
import { getExecutiveBrainContextGraph } from "@/lib/brain/executiveContext";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const { id } = await params;
  const executiveGraph = getExecutiveBrainContextGraph(accessResult.context);
  const virtualNode = executiveGraph.nodes.find((node) => node.id === id);

  if (virtualNode) {
    const outgoing = executiveGraph.edges
      .filter((edge) => edge.source === id)
      .map((edge) => ({ id: edge.id, fromId: edge.source, toId: edge.target, type: edge.type }));
    const incoming = executiveGraph.edges
      .filter((edge) => edge.target === id)
      .map((edge) => ({ id: edge.id, fromId: edge.source, toId: edge.target, type: edge.type }));
    const neighborIds = new Set([
      ...outgoing.map((edge) => edge.toId),
      ...incoming.map((edge) => edge.fromId),
    ]);
    const neighbors = executiveGraph.nodes.filter((node) => neighborIds.has(node.id));

    return NextResponse.json({
      node: virtualNode,
      outgoing,
      incoming,
      neighbors,
    });
  }

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

    const edges = [...context.outgoing, ...context.incoming];
    const visibility = filterBrainGraphByAccess([context.node, ...context.neighbors], edges, accessResult.context);

    return NextResponse.json({
      node: context.node,
      outgoing: context.outgoing.filter((edge) => visibility.visibleEdgeIds.has(edge.id)),
      incoming: context.incoming.filter((edge) => visibility.visibleEdgeIds.has(edge.id)),
      neighbors: context.neighbors.filter((node) => visibility.visibleNodeIds.has(node.id)),
    });
  } catch (error) {
    console.error("[brain/graph/node/[id]] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar no do grafo" }, { status: 500 });
  }
}
