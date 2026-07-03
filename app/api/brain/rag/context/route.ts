import { type NextRequest, NextResponse } from "next/server";

import { normalizeBrainText } from "@/brain/_utils/brainGraphFormatters";
import { isBrainNodeVisible, resolveBrainAccess } from "@/lib/brain/access";
import { buildBrainSearchIndex, searchBrainIndex } from "@/lib/brain/searchIndex";
import { prisma } from "@/lib/prismaClient";

type FindManyDelegate = {
  findMany: (args?: Record<string, unknown>) => Promise<unknown[]>;
};

type LooseRecord = Record<string, unknown>;

const OPTIONAL_COLLECTIONS = [
  { key: "auditLog", kind: "audit" },
  { key: "ticket", kind: "ticket" },
  { key: "supportTicket", kind: "support" },
  { key: "document", kind: "document" },
  { key: "note", kind: "note" },
  { key: "testRun", kind: "run" },
  { key: "defect", kind: "defect" },
  { key: "accessRequest", kind: "access_request" },
];


function readBrainMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readBrainNodeMetadataString(node: { metadata: unknown; type?: string | null }, key: string): string | null {
  const metadata = readBrainMetadata(node.metadata);
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readBrainNodeModule(node: { metadata: unknown; type?: string | null }): string {
  return (
    readBrainNodeMetadataString(node, "module") ??
    readBrainNodeMetadataString(node, "moduleKey") ??
    readBrainNodeMetadataString(node, "moduleLabel") ??
    node.type ??
    "Geral"
  );
}

function readBrainNodeStatus(node: { metadata: unknown }): string {
  return readBrainNodeMetadataString(node, "status") ?? "ok";
}

function readBrainNodeCompanyId(node: { metadata: unknown }): string | null {
  return readBrainNodeMetadataString(node, "companyId") ?? readBrainNodeMetadataString(node, "companySlug");
}

function readBrainNodeCompanyName(node: { metadata: unknown }): string | null {
  return readBrainNodeMetadataString(node, "companyName") ?? readBrainNodeCompanyId(node);
}

function readBrainNodeProjectId(node: { metadata: unknown }): string | null {
  return readBrainNodeMetadataString(node, "projectId") ?? readBrainNodeMetadataString(node, "projectSlug") ?? readBrainNodeMetadataString(node, "projectCode");
}

function readBrainNodeProjectName(node: { metadata: unknown }): string | null {
  return readBrainNodeMetadataString(node, "projectName") ?? readBrainNodeProjectId(node);
}

function readBrainEdgeStatus(edge: { metadata?: unknown }): string {
  const metadata = readBrainMetadata(edge.metadata);
  const value = metadata.status;
  return typeof value === "string" && value.trim() ? value.trim() : "ok";
}

function readBrainAccessRole(context: { user: { permissionRole?: string | null; role?: string | null; companyRole?: string | null } }): string | null {
  return context.user.permissionRole ?? context.user.role ?? context.user.companyRole ?? null;
}

function readBrainAccessUserId(context: { user: { id?: string | null; email?: string | null } }): string | null {
  return context.user.id ?? context.user.email ?? null;
}

function asRecord(value: unknown): LooseRecord {
  return value && typeof value === "object" ? value as LooseRecord : {};
}

function pickText(row: LooseRecord) {
  return [
    row.title,
    row.name,
    row.label,
    row.subject,
    row.message,
    row.description,
    row.action,
    row.status,
    row.route,
    row.path,
    row.email,
  ]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .join(" Â· ");
}

function pickDate(row: LooseRecord) {
  const value = row.updatedAt ?? row.createdAt ?? row.date;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

async function tryFindMany(modelName: string, take: number) {
  const db = prisma as unknown as Record<string, FindManyDelegate | undefined>;
  const delegate = db[modelName];

  if (!delegate?.findMany) return [];

  return delegate.findMany({
    take,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  }).catch(() => []);
}

export async function GET(req: NextRequest) {
  const accessResult = await resolveBrainAccess(req);

  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const query = normalizeBrainText(url.searchParams.get("q") ?? "");
  const moduleFilter = url.searchParams.get("module");
  const limit = Math.min(80, Math.max(8, Number(url.searchParams.get("limit") ?? 40)));

  const [brainNodes, brainEdges] = await Promise.all([
    prisma.brainNode.findMany({ orderBy: { updatedAt: "desc" }, take: 900 }).catch(() => []),
    prisma.brainEdge.findMany({ take: 1800 }).catch(() => []),
  ]);

  const visibleNodes = brainNodes.filter((node) => {
    if (!isBrainNodeVisible(node, accessResult.context)) return false;
    if (moduleFilter && readBrainNodeModule(node) !== moduleFilter) return false;
    return true;
  });

  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = brainEdges.filter((edge) => visibleNodeIds.has(edge.fromId) && visibleNodeIds.has(edge.toId));

  const index = buildBrainSearchIndex(visibleNodes, visibleEdges);
  const ranked = query
    ? searchBrainIndex(index, query, { limit })
    : index.slice(0, limit).map((entry) => ({ ...entry, score: 1, matchedBy: ["recent"] }));

  const optionalRows = await Promise.all(
    OPTIONAL_COLLECTIONS.map(async (collection) => ({
      kind: collection.kind,
      rows: await tryFindMany(collection.key, 20),
    })),
  );

  const memory = optionalRows.flatMap((collection) =>
    collection.rows
      .map(asRecord)
      .map((row) => ({
        id: String(row.id ?? row.slug ?? row.key ?? crypto.randomUUID()),
        kind: collection.kind,
        title: pickText(row) || collection.kind,
        status: typeof row.status === "string" ? row.status : null,
        route: typeof row.route === "string" ? row.route : typeof row.path === "string" ? row.path : null,
        updatedAt: pickDate(row),
      }))
      .filter((item) => {
        if (!query) return true;
        return normalizeBrainText([item.title, item.status, item.route, item.kind].filter(Boolean).join(" ")).includes(query);
      })
      .slice(0, 12),
  );

  const modules = Array.from(new Set(visibleNodes.map((node) => readBrainNodeModule(node)).filter(Boolean))).sort();
  const companies = Array.from(new Map(
    visibleNodes
      .filter((node) => readBrainNodeCompanyId(node))
      .map((node) => [readBrainNodeCompanyId(node), { id: readBrainNodeCompanyId(node), label: readBrainNodeCompanyName(node) ?? readBrainNodeCompanyId(node) }]),
  ).values());

  const projects = Array.from(new Map(
    visibleNodes
      .filter((node) => readBrainNodeProjectId(node))
      .map((node) => [readBrainNodeProjectId(node), { id: readBrainNodeProjectId(node), label: readBrainNodeProjectName(node) ?? readBrainNodeProjectId(node), companyId: readBrainNodeCompanyId(node) ?? null }]),
  ).values());

  return NextResponse.json({
    source: "brain-rag-context",
    query,
    userContext: {
      role: readBrainAccessRole(accessResult.context),
      userId: readBrainAccessUserId(accessResult.context),
      companyIds: Array.from(accessResult.context.allowedCompanyIds ?? []),
      projectIds: [],
    },
    filters: {
      modules: modules.map((moduleName) => ({ id: moduleName, label: moduleName })),
      companies,
      projects,
      types: Array.from(new Set(visibleNodes.map((node) => node.type))).sort(),
      statuses: Array.from(new Set(visibleNodes.map((node) => readBrainNodeStatus(node)))).sort(),
    },
    nodes: ranked.map((node) => ({
      id: node.nodeId,
      label: node.label,
      type: node.type,
      module: readBrainNodeModule(node),
      route: node.route,
      score: node.score,
      matchedBy: node.matchedBy,
    })),
    edges: visibleEdges.slice(0, limit).map((edge) => ({
      id: edge.id,
      fromId: edge.fromId,
      toId: edge.toId,
      type: edge.type,
      status: readBrainEdgeStatus(edge),
    })),
    memory,
    notes: memory.filter((item) => item.kind === "note"),
    events: memory.filter((item) => ["audit", "ticket", "support", "access_request"].includes(item.kind)),
    documents: memory.filter((item) => item.kind === "document"),
    availableActions: [
      "filter_nodes",
      "explain_node",
      "show_pending",
      "show_orphans",
      "search_context",
      "open_related_route",
      "summarize_context",
    ],
    summary: {
      nodeCount: visibleNodes.length,
      edgeCount: visibleEdges.length,
      memoryCount: memory.length,
      moduleCount: modules.length,
    },
  });
}

