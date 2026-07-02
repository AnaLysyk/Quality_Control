import { NextResponse } from "next/server";

import { findPathBetweenNodes } from "@/lib/brain";
import { assertBrainNodeAccess, isBrainNodeVisible, resolveBrainAccess, type BrainAccessContext } from "@/lib/brain/access";
import { BrainGraphAnalyticsService } from "@/lib/brain/graphAnalyticsService";
import { prisma } from "@/lib/prismaClient";

async function allPathNodesVisible(nodeIds: string[], access: BrainAccessContext) {
  const uniqueNodeIds = Array.from(new Set(nodeIds));
  const nodes = await prisma.brainNode.findMany({ where: { id: { in: uniqueNodeIds } } });
  const visibleNodeIds = new Set(nodes.filter((node) => isBrainNodeVisible(node, access)).map((node) => node.id));
  return uniqueNodeIds.every((nodeId) => visibleNodeIds.has(nodeId));
}

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const fromId =
    url.searchParams.get("fromNodeId") ??
    url.searchParams.get("from") ??
    null;
  const toId =
    url.searchParams.get("toNodeId") ??
    url.searchParams.get("to") ??
    null;

  if (!fromId || !toId) {
    return NextResponse.json({ error: "from e to sao obrigatorios" }, { status: 400 });
  }

  const [fromAccess, toAccess] = await Promise.all([
    assertBrainNodeAccess(fromId, accessResult.context),
    assertBrainNodeAccess(toId, accessResult.context),
  ]);

  if (!fromAccess.ok || !toAccess.ok) {
    return NextResponse.json({ error: "Sem permissao para consultar caminho" }, { status: 403 });
  }

  try {
    const analyticsService = new BrainGraphAnalyticsService();
    const explainablePath = await analyticsService.calculatePath(fromId, toId);

    if (explainablePath.found) {
      if (!(await allPathNodesVisible(explainablePath.path.map((step) => step.nodeId), accessResult.context))) {
        return NextResponse.json({ error: "Sem permissao para consultar caminho" }, { status: 403 });
      }

      return NextResponse.json({
        from: fromId,
        to: toId,
        found: true,
        distance: explainablePath.distance,
        path: explainablePath.path.map((step, index) => ({
          node: step.label,
          nodeId: step.nodeId,
          type: step.type,
          ...(index < explainablePath.path.length - 1 && step.edgeType ? { edge: step.edgeType } : {}),
        })),
        explanation: explainablePath.explanation,
      });
    }

    const pathResult = await findPathBetweenNodes(fromId, toId);

    if (!pathResult) {
      return NextResponse.json({
        from: fromId,
        to: toId,
        found: false,
        path: [],
        edges: [],
        explanation: "Nao encontrei caminho entre os nos solicitados.",
      });
    }

    if (!(await allPathNodesVisible(pathResult.path, accessResult.context))) {
      return NextResponse.json({ error: "Sem permissao para consultar caminho" }, { status: 403 });
    }

    const nodes = await prisma.brainNode.findMany({
      where: { id: { in: pathResult.path } },
      select: { id: true, label: true, type: true },
    });

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    return NextResponse.json({
      from: fromId,
      to: toId,
      found: true,
      distance: pathResult.distance,
      path: pathResult.path.map((nodeId) => ({
        id: nodeId,
        node: nodeMap.get(nodeId)?.label ?? nodeId,
        label: nodeMap.get(nodeId)?.label ?? nodeId,
        type: nodeMap.get(nodeId)?.type ?? "Unknown",
      })),
      edges: pathResult.edges,
      explanation: "Caminho encontrado no grafo com base nas relacoes existentes.",
    });
  } catch (error) {
    console.error("[brain/graph/path] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar caminho no grafo" }, { status: 500 });
  }
}

