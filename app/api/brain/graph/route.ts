import { NextResponse } from "next/server";

import { getSubgraph, searchNodes } from "@/lib/brain";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export async function GET(req: Request) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autorizado" : "Sem permissão" }, { status });
  }

  const url = new URL(req.url);
  const nodeId = url.searchParams.get("nodeId");
  const depth = Math.min(4, Math.max(1, Number(url.searchParams.get("depth") ?? 2)));
  const nodeType = url.searchParams.get("type") ?? undefined;

  try {
    let rootId = nodeId;

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

    const graphNodes = subgraph.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      refType: node.refType,
      refId: node.refId,
      description: node.description,
      metadata: node.metadata,
      isRoot: node.id === rootId,
    }));

    const graphEdges = subgraph.edges.map((edge) => ({
      id: edge.id,
      source: edge.fromId,
      target: edge.toId,
      type: edge.type,
      weight: edge.weight,
    }));

    const uniqueNodes = Array.from(new Map(graphNodes.map((node) => [node.id, node])).values());
    const uniqueEdges = Array.from(new Map(graphEdges.map((edge) => [edge.id, edge])).values());

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
