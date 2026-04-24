import { NextResponse } from "next/server";

import { getSubgraph, searchNodes } from "@/lib/brain";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

async function getMostConnectedNodeId() {
  const [nodeSummaries, incomingByNode, outgoingByNode] = await Promise.all([
    prisma.brainNode.findMany({
      select: {
        id: true,
      },
    }),
    prisma.brainEdge.groupBy({
      by: ["toId"],
      _count: { id: true },
    }),
    prisma.brainEdge.groupBy({
      by: ["fromId"],
      _count: { id: true },
    }),
  ]);

  const degreeMap = new Map<string, { inDegree: number; outDegree: number }>();

  for (const group of incomingByNode) {
    degreeMap.set(group.toId, {
      inDegree: group._count.id,
      outDegree: degreeMap.get(group.toId)?.outDegree ?? 0,
    });
  }

  for (const group of outgoingByNode) {
    degreeMap.set(group.fromId, {
      inDegree: degreeMap.get(group.fromId)?.inDegree ?? 0,
      outDegree: group._count.id,
    });
  }

  const topConnectedNode = nodeSummaries
    .map((node) => {
      const degrees = degreeMap.get(node.id) ?? { inDegree: 0, outDegree: 0 };
      const totalDegree = degrees.inDegree + degrees.outDegree;

      return {
        id: node.id,
        inDegree: degrees.inDegree,
        totalDegree,
      };
    })
    .filter((node) => node.totalDegree > 0)
    .sort(
      (left, right) =>
        right.totalDegree - left.totalDegree ||
        right.inDegree - left.inDegree ||
        left.id.localeCompare(right.id),
    )[0];

  return topConnectedNode?.id ?? null;
}

export async function GET(req: Request) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "N\u00e3o autorizado" : "Sem permiss\u00e3o" }, { status });
  }

  const url = new URL(req.url);
  const nodeId = url.searchParams.get("nodeId");
  const depth = Math.min(4, Math.max(1, Number(url.searchParams.get("depth") ?? 2)));
  const nodeType = url.searchParams.get("type") ?? undefined;
  const showAll = url.searchParams.get("all") === "true";

  try {
    let rootId = nodeId;

    if (!rootId) {
      if (nodeType) {
        const nodes = await searchNodes({ type: nodeType, limit: 1 });
        rootId = nodes[0]?.id ?? null;
      }
      if (!rootId) {
        rootId = await getMostConnectedNodeId();
      }
      if (!rootId) {
        const firstNode = await prisma.brainNode.findFirst({ orderBy: { createdAt: "asc" } });
        rootId = firstNode?.id ?? null;
      }
    }

    if (!rootId) {
      return NextResponse.json({ nodes: [], edges: [], root: null });
    }

    if (showAll) {
      const [allNodes, allEdges, root] = await Promise.all([
        prisma.brainNode.findMany({
          orderBy: [{ type: "asc" }, { label: "asc" }],
        }),
        prisma.brainEdge.findMany({
          orderBy: { createdAt: "asc" },
        }),
        prisma.brainNode.findUnique({ where: { id: rootId } }),
      ]);

      return NextResponse.json({
        nodes: allNodes.map((node) => ({
          id: node.id,
          label: node.label,
          type: node.type,
          refType: node.refType,
          refId: node.refId,
          description: node.description,
          metadata: node.metadata,
          isRoot: node.id === rootId,
        })),
        edges: allEdges.map((edge) => ({
          id: edge.id,
          source: edge.fromId,
          target: edge.toId,
          type: edge.type,
          weight: edge.weight,
        })),
        root,
      });
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
