import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getSubgraph, searchNodes } from "@/lib/brain";
import { prisma } from "@/lib/prismaClient";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const nodeId = url.searchParams.get("nodeId");
  const depth = Math.min(4, Math.max(1, Number(url.searchParams.get("depth") ?? 2)));
  const nodeType = url.searchParams.get("type") ?? undefined;

  try {
    let rootId = nodeId;

    // Se não passou nodeId, buscar primeiro nó do tipo especificado ou um nó qualquer
    if (!rootId) {
      if (nodeType) {
        const nodes = await searchNodes({ type: nodeType, limit: 1 });
        rootId = nodes[0]?.id ?? null;
      }
      if (!rootId) {
        const firstNode = await prisma.brainNode.findFirst({ orderBy: { createdAt: "asc" } });
        rootId = firstNode?.id ?? null;
      }
    }

    if (!rootId) {
      return NextResponse.json({ nodes: [], edges: [], root: null });
    }

    const subgraph = await getSubgraph(rootId, depth);

    // Formatar para visualização com D3/force-graph
    const graphNodes = subgraph.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      refType: n.refType,
      refId: n.refId,
      description: n.description,
      metadata: n.metadata,
      isRoot: n.id === rootId,
    }));

    const graphEdges = subgraph.edges.map((e) => ({
      id: e.id,
      source: e.fromId,
      target: e.toId,
      type: e.type,
      weight: e.weight,
    }));

    // Deduplicate
    const uniqueNodes = Array.from(new Map(graphNodes.map((n) => [n.id, n])).values());
    const uniqueEdges = Array.from(new Map(graphEdges.map((e) => [e.id, e])).values());

    return NextResponse.json({
      nodes: uniqueNodes,
      edges: uniqueEdges,
      root: subgraph.root,
    });
  } catch (error) {
    console.error("[brain/graph] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar grafo" }, { status: 500 });
  }
}
