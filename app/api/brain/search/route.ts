import { NextResponse } from "next/server";
import { buildMockBrainGraph } from "@/brain/_data/brainMockGraph";
import { normalizeBrainText } from "@/brain/_utils/brainGraphFormatters";
import { resolveBrainAccess } from "@/lib/brain/access";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }
  const url = new URL(req.url);
  const q = normalizeBrainText(url.searchParams.get("q") ?? "");
  const moduleFilter = url.searchParams.get("module");
  const graph = buildMockBrainGraph();

  const visibleNodes = graph.nodes.filter((node) => {
    if (accessResult.ok && !accessResult.context.hasGlobalVisibility && node.module === "Logs") return false;
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
    nodes: visibleNodes.slice(0, 20).map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      module: node.module,
    })),
    events: graph.auditLogs.slice(0, 10).map((event) => ({
      id: event.id,
      label: event.action,
      module: "Logs",
    })),
    source: accessResult.ok ? "fallback" : "fallback-restricted",
  });
}

