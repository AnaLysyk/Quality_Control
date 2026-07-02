import { NextResponse } from "next/server";

import { buildMockBrainGraph } from "@/brain/_data/brainMockGraph";
import { filterBrainDomainGraphByAccess, resolveBrainAccess } from "@/lib/brain/access";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const moduleFilter = url.searchParams.get("module");
  const graph = buildMockBrainGraph();
  const visibleGraph = filterBrainDomainGraphByAccess(graph.nodes, graph.edges, accessResult.context);

  const events = visibleGraph.nodes
    .filter((node) => node.createdAt || node.generatedBy || node.type === "log")
    .filter((node) => !moduleFilter || node.module === moduleFilter)
    .slice(0, 50)
    .map((node) => ({
      id: `event:${node.id}`,
      companyId: node.companyId,
      projectId: node.projectId,
      module: node.module,
      entityType: node.type,
      entityId: node.entityId ?? node.id,
      action: node.generatedBy === "automation" ? "automation.generated" : node.generatedBy === "brain" ? "brain.generated" : `${node.type}.created`,
      actorName: node.createdBy,
      actorEmail: node.createdByEmail,
      createdAt: node.createdAt ?? new Date().toISOString(),
      generatedBy: node.generatedBy ?? "system",
      summary: node.information ?? node.description ?? `${node.label} registrado no Brain.`,
      metadata: { status: node.status },
    }));

  return NextResponse.json({ events, source: "fallback" });
}

