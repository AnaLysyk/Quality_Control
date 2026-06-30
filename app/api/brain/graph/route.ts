import { NextResponse } from "next/server";

import { getSubgraph, searchNodes } from "@/lib/brain";
import { filterBrainGraphByAccess, isBrainNodeVisible, resolveBrainAccess } from "@/lib/brain/access";
import { getExecutiveBrainContextGraph } from "@/lib/brain/executiveContext";
import { prisma } from "@/lib/prismaClient";

function isE2eJsonMode() {
  return process.env.E2E_USE_JSON === "1" || process.env.E2E_USE_JSON === "true";
}

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }
  const { context: access } = accessResult;
  const executiveGraph = getExecutiveBrainContextGraph(access);

  if (isE2eJsonMode()) {
    return NextResponse.json({
      nodes: [
        {
          id: "brain-e2e-root",
          label: "Brain E2E",
          type: "System",
          refType: "Brian",
          refId: "e2e",
          description: "Grafo mockado para E2E em modo JSON.",
          metadata: { companySlug: Array.from(access.allowedCompanySlugs)[0] ?? "demo" },
          isRoot: true,
        },
        ...executiveGraph.nodes,
      ],
      edges: executiveGraph.edges,
      root: {
        id: "brain-e2e-root",
        label: "Brain E2E",
        type: "System",
        refType: "Brian",
        refId: "e2e",
        description: "Grafo mockado para E2E em modo JSON.",
        metadata: { e2e: true },
      },
    });
  }

  const url = new URL(req.url);
  const nodeId = url.searchParams.get("nodeId");
  const depth = Math.min(4, Math.max(1, Number(url.searchParams.get("depth") ?? 2)));
  const nodeType = url.searchParams.get("type") ?? undefined;

  try {
    let rootId = nodeId;

    const virtualRoot = rootId ? executiveGraph.nodes.find((node) => node.id === rootId) ?? null : null;
    if (virtualRoot) {
      return NextResponse.json({
        nodes: executiveGraph.nodes,
        edges: executiveGraph.edges,
        root: virtualRoot,
      });
    }

    if (!rootId) {
      if (nodeType) {
        const nodes = await searchNodes({ type: nodeType, limit: 1 });
        const visible = nodes.find((node) => isBrainNodeVisible(node, access));
        rootId = visible?.id ?? null;
      }
      if (!rootId) {
        const initialNodes = await prisma.brainNode.findMany({
          take: 250,
          orderBy: { createdAt: "asc" },
        });
        const firstVisibleNode = initialNodes.find((node) => isBrainNodeVisible(node, access));
        rootId = firstVisibleNode?.id ?? null;
      }
    }

    if (!rootId) {
      return NextResponse.json({ nodes: executiveGraph.nodes, edges: executiveGraph.edges, root: executiveGraph.nodes[0] ?? null });
    }

    const subgraph = await getSubgraph(rootId, depth);
    const visibility = filterBrainGraphByAccess(subgraph.nodes, subgraph.edges, access);

    if (!visibility.visibleNodeIds.has(rootId)) {
      return NextResponse.json({ error: "Sem permissao para o no solicitado" }, { status: 403 });
    }

    const graphNodes = subgraph.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      refType: node.refType,
      refId: node.refId,
      description: node.description,
      metadata: node.metadata,
      isRoot: node.id === rootId,
    })).filter((node) => visibility.visibleNodeIds.has(node.id));

    const graphEdges = subgraph.edges.map((edge) => ({
      id: edge.id,
      source: edge.fromId,
      target: edge.toId,
      type: edge.type,
      weight: edge.weight,
      metadata: edge.metadata,
      createdAt: edge.createdAt,
    })).filter((edge) => visibility.visibleEdgeIds.has(edge.id));

    const uniqueNodes = Array.from(new Map([...executiveGraph.nodes, ...graphNodes].map((node) => [node.id, node])).values());
    const uniqueEdges = Array.from(new Map([...executiveGraph.edges, ...graphEdges].map((edge) => [edge.id, edge])).values());

    return NextResponse.json({
      nodes: uniqueNodes,
      edges: uniqueEdges,
      root: subgraph.root ?? executiveGraph.nodes[0] ?? null,
    });
  } catch (error) {
    console.error("[brain/graph] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar grafo" }, { status: 500 });
  }
}
