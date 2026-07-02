import { NextResponse } from "next/server";

import { buildMockBrainGraph } from "@/brain/_data/brainMockGraph";
import { normalizeBrainText } from "@/brain/_utils/brainGraphFormatters";
import { canAccessBrainModule, filterBrainDomainGraphByAccess, isBrainNodeVisible, resolveBrainAccess } from "@/lib/brain/access";
import { buildBrainSearchIndex, searchBrainIndex } from "@/lib/brain/searchIndex";
import { prisma } from "@/lib/prismaClient";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const q = normalizeBrainText(url.searchParams.get("q") ?? "");
  const moduleFilter = url.searchParams.get("module");
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
  const graph = buildMockBrainGraph();
  const visibleGraph = filterBrainDomainGraphByAccess(graph.nodes, graph.edges, accessResult.context);
  const [realNodes, realEdges] = await Promise.all([
    prisma.brainNode.findMany({ orderBy: { updatedAt: "desc" }, take: 600 }).catch(() => []),
    prisma.brainEdge.findMany({ take: 1200 }).catch(() => []),
  ]);
  const visibleRealNodes = realNodes.filter((node) => isBrainNodeVisible(node, accessResult.context));
  const visibleRealNodeIds = new Set(visibleRealNodes.map((node) => node.id));
  const visibleRealEdges = realEdges.filter((edge) => visibleRealNodeIds.has(edge.fromId) && visibleRealNodeIds.has(edge.toId));
  const realIndex = buildBrainSearchIndex(visibleRealNodes, visibleRealEdges);
  const realResults = q ? searchBrainIndex(realIndex, q, { limit }) : realIndex.slice(0, limit).map((entry) => ({ ...entry, score: 1, matchedBy: ["recent"] }));

  const visibleNodes = visibleGraph.nodes.filter((node) => {
    if (moduleFilter && node.module !== moduleFilter) return false;
    if (!q) return true;
    return normalizeBrainText([node.label, node.module, node.type, node.description, node.information].filter(Boolean).join(" ")).includes(q);
  });

  const companies = Array.from(new Map(visibleNodes.filter((node) => node.companyId).map((node) => [node.companyId, {
    id: node.companyId,
    label: node.companyName ?? node.companyId,
  }])).values());
  const projects = Array.from(new Map(visibleNodes.filter((node) => node.projectId).map((node) => [node.projectId, {
    id: node.projectId,
    label: node.projectName ?? node.projectId,
  }])).values());
  const modules = Array.from(new Set(visibleNodes.map((node) => node.module))).map((moduleName) => ({
    id: moduleName,
    label: moduleName,
  }));

  return NextResponse.json({
    companies,
    projects,
    modules,
    nodes: [
      ...realResults.map((node) => ({
        id: node.nodeId,
        label: node.label,
        type: node.type,
        module: node.moduleId,
        route: node.route,
        score: node.score,
        matchedBy: node.matchedBy,
        source: "brain-index",
      })),
      ...visibleNodes.slice(0, Math.max(0, limit - realResults.length)).map((node) => ({
        id: node.id,
        label: node.label,
        type: node.type,
        module: node.module,
        source: "fallback",
      })),
    ].slice(0, limit),
    events: canAccessBrainModule(accessResult.context, "Logs")
      ? graph.auditLogs.slice(0, 10).map((event) => ({
          id: event.id,
          label: event.action,
          module: "Logs",
        }))
      : [],
    source: realResults.length ? "brain-index" : "fallback",
  });
}
