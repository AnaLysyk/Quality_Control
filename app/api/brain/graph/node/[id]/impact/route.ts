import { NextResponse } from "next/server";

import { traceImpact } from "@/backend/brain";
import { assertBrainNodeAccess, isBrainNodeVisible, resolveBrainAccess } from "@/backend/brain/access";

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
  const depth = Math.min(5, Math.max(1, Number(url.searchParams.get("depth") ?? 2)));

  try {
    const impact = await traceImpact(id, depth);
    const visibleNodes = impact.impactedNodes.filter((node) => isBrainNodeVisible(node, accessResult.context));
    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
    const visiblePaths = impact.paths.filter((entry) => visibleNodeIds.has(entry.nodeId));

    const counters = visibleNodes.reduce<Record<string, number>>((acc, node) => {
      acc[node.type] = (acc[node.type] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      nodeId: id,
      depth,
      impact: counters,
      totalImpactedNodes: visibleNodes.length,
      paths: visiblePaths,
      nodes: visibleNodes,
    });
  } catch (error) {
    console.error("[brain/graph/node/[id]/impact] GET error:", error);
    return NextResponse.json({ error: "Erro ao calcular impacto" }, { status: 500 });
  }
}

