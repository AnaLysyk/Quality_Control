import { NextResponse } from "next/server";

import { getNodeMemories, getNodeWithContext, getSubgraph, traceImpact } from "@/lib/brain";
import { assertBrainNodeAccess, filterBrainGraphByAccess, isBrainNodeVisible, resolveBrainAccess } from "@/lib/brain/access";

function memoryRelatedNodeIds(memory: { nodeId?: string | null; relatedNodeIds?: unknown }) {
  const related = Array.isArray(memory.relatedNodeIds)
    ? memory.relatedNodeIds.filter((item): item is string => typeof item === "string")
    : [];
  return [memory.nodeId, ...related].filter((item): item is string => typeof item === "string" && item.length > 0);
}

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
  const include = url.searchParams.get("include") ?? "context";
  const depth = Math.min(5, Math.max(1, Number(url.searchParams.get("depth") ?? 2)));

  try {
    const result: Record<string, unknown> = {};

    if (include.includes("context") || include === "all") {
      const context = await getNodeWithContext(id, depth);
      if (context?.node) {
        const edges = [...context.outgoing, ...context.incoming];
        const visibility = filterBrainGraphByAccess([context.node, ...context.neighbors], edges, accessResult.context);
        result.context = {
          node: context.node,
          outgoing: context.outgoing.filter((edge) => visibility.visibleEdgeIds.has(edge.id)),
          incoming: context.incoming.filter((edge) => visibility.visibleEdgeIds.has(edge.id)),
          neighbors: context.neighbors.filter((node) => visibility.visibleNodeIds.has(node.id)),
        };
      } else {
        result.context = context;
      }
    }

    if (include.includes("memories") || include === "all") {
      const memories = await getNodeMemories(id);
      result.memories = memories.filter((memory) =>
        memoryRelatedNodeIds(memory).some((nodeId) => nodeId === id || nodeId === nodeAccess.node.id),
      );
    }

    if (include.includes("impact") || include === "all") {
      const impact = await traceImpact(id, depth);
      result.impact = {
        impactedNodes: impact.impactedNodes.filter((node) => isBrainNodeVisible(node, accessResult.context)),
        paths: impact.paths.filter((path) =>
          impact.impactedNodes.some((node) => node.id === path.nodeId && isBrainNodeVisible(node, accessResult.context)),
        ),
      };
    }

    if (include.includes("subgraph") || include === "all") {
      const subgraph = await getSubgraph(id, depth);
      const visibility = filterBrainGraphByAccess(subgraph.nodes, subgraph.edges, accessResult.context);
      result.subgraph = {
        root: subgraph.root,
        nodes: subgraph.nodes.filter((node) => visibility.visibleNodeIds.has(node.id)),
        edges: subgraph.edges.filter((edge) => visibility.visibleEdgeIds.has(edge.id)),
      };
    }

    if (!result.context && !result.memories && !result.impact && !result.subgraph) {
      const context = await getNodeWithContext(id, depth);
      if (context?.node) {
        const edges = [...context.outgoing, ...context.incoming];
        const visibility = filterBrainGraphByAccess([context.node, ...context.neighbors], edges, accessResult.context);
        result.context = {
          node: context.node,
          outgoing: context.outgoing.filter((edge) => visibility.visibleEdgeIds.has(edge.id)),
          incoming: context.incoming.filter((edge) => visibility.visibleEdgeIds.has(edge.id)),
          neighbors: context.neighbors.filter((node) => visibility.visibleNodeIds.has(node.id)),
        };
      } else {
        result.context = context;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[brain/nodes/id] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar no" }, { status: 500 });
  }
}

