import { NextResponse } from "next/server";

import { getSubgraph, searchNodes } from "@/lib/brain";
import { filterBrainGraphByAccess, isBrainNodeVisible, resolveBrainAccess, type BrainAccessContext } from "@/lib/brain/access";
import { getExecutiveBrainContextGraph } from "@/lib/brain/executiveContext";
import { sanitizeBrainMetadata, sanitizeBrainText } from "@/lib/brain/security";
import { canAccess } from "@/lib/permissions/can-access";
import { prisma } from "@/lib/prismaClient";

function isE2eJsonMode() {
  return process.env.E2E_USE_JSON === "1" || process.env.E2E_USE_JSON === "true";
}

type GraphNodeLike = {
  id: string;
  label: string;
  type: string;
  refType?: string | null;
  refId?: string | null;
  description?: string | null;
  metadata?: unknown;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  isRoot?: boolean;
};

type GraphEdgeLike = {
  id: string;
  source: string;
  target: string;
  type: string;
  weight?: number | null;
  metadata?: unknown;
  createdAt?: Date | string | null;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readTextList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(readText).filter((item): item is string => Boolean(item));
}

function isoDate(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

function readFirst(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = readText(metadata[key]);
    if (value) return value;
  }
  return null;
}

function readModule(node: GraphNodeLike, metadata: Record<string, unknown>) {
  return readFirst(metadata, ["module", "moduleKey", "moduleLabel", "layer", "area"]) ?? node.type ?? "Brain";
}

function readStatus(metadata: Record<string, unknown>) {
  return readFirst(metadata, ["status", "lifecycleStatus", "state"]) ?? "ok";
}

function readAllowedActions(metadata: Record<string, unknown>, canManage: boolean) {
  const actions = new Set<string>([
    ...readTextList(metadata.allowedActions),
    "inspect",
    "ask_brain",
    "search_context",
  ]);
  if (canManage) {
    actions.add("link_memory");
    actions.add("edit_metadata");
  }
  return Array.from(actions);
}

function canViewUsers(access: BrainAccessContext) {
  return (
    access.hasGlobalVisibility ||
    canAccess(access.userAccess, { moduleId: "users", action: "view" }) ||
    canAccess(access.userAccess, { moduleId: "users", action: "view_company" }) ||
    canAccess(access.userAccess, { moduleId: "users", action: "view_all" })
  );
}

function canViewLogs(access: BrainAccessContext) {
  return access.hasGlobalVisibility || canAccess(access.userAccess, { moduleId: "audit", action: "view" });
}

function edgeRelatedCounts(nodes: GraphNodeLike[], edges: GraphEdgeLike[]) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const relatedNodeCount = new Map<string, number>();
  const relatedDocumentCount = new Map<string, number>();
  const relatedLogCount = new Map<string, number>();

  for (const edge of edges) {
    const pairs = [
      [edge.source, edge.target],
      [edge.target, edge.source],
    ] as const;

    for (const [nodeId, relatedId] of pairs) {
      const related = nodesById.get(relatedId);
      if (!related) continue;
      relatedNodeCount.set(nodeId, (relatedNodeCount.get(nodeId) ?? 0) + 1);
      const relatedType = related.type.toLowerCase();
      const edgeType = edge.type.toLowerCase();
      if (/doc|wiki|pdf|evid/i.test(relatedType) || /doc|pdf|evid/i.test(edgeType)) {
        relatedDocumentCount.set(nodeId, (relatedDocumentCount.get(nodeId) ?? 0) + 1);
      }
      if (/log|audit|event/i.test(relatedType) || /log|audit|event/i.test(edgeType)) {
        relatedLogCount.set(nodeId, (relatedLogCount.get(nodeId) ?? 0) + 1);
      }
    }
  }

  return { relatedNodeCount, relatedDocumentCount, relatedLogCount };
}

async function memoryCountsByNodeId(nodeIds: string[]) {
  if (!nodeIds.length) return new Map<string, number>();
  const counts = new Map<string, number>();
  const memories = await (async () => {
    try {
      return await prisma.brainMemory.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { nodeId: { in: nodeIds } },
            { relatedNodeIds: { not: undefined } },
          ],
        },
        select: { nodeId: true, relatedNodeIds: true },
        take: 1000,
      });
    } catch {
      return [];
    }
  })();

  const visibleNodeIds = new Set(nodeIds);
  for (const memory of memories) {
    const relatedIds = [
      memory.nodeId,
      ...(Array.isArray(memory.relatedNodeIds) ? memory.relatedNodeIds.filter((item): item is string => typeof item === "string") : []),
    ].filter((item): item is string => Boolean(item && visibleNodeIds.has(item)));
    for (const nodeId of new Set(relatedIds)) {
      counts.set(nodeId, (counts.get(nodeId) ?? 0) + 1);
    }
  }
  return counts;
}

function currentUserNodeId(nodes: GraphNodeLike[], access: BrainAccessContext) {
  const userId = access.user.id;
  const email = access.user.email;
  return nodes.find((node) => {
    const metadata = toRecord(node.metadata);
    return (
      (node.refType === "User" && (node.refId === userId || node.refId === email)) ||
      readText(metadata.userId) === userId ||
      readText(metadata.email) === email ||
      readText(metadata.userEmail) === email
    );
  })?.id ?? null;
}

function serializeNode(
  node: GraphNodeLike,
  options: {
    rootId: string | null;
    canManage: boolean;
    memoryCounts: Map<string, number>;
    relatedNodeCount: Map<string, number>;
    relatedDocumentCount: Map<string, number>;
    relatedLogCount: Map<string, number>;
  },
) {
  const metadata = sanitizeBrainMetadata(node.metadata);
  const sourceType = readFirst(metadata, ["sourceType", "refType", "provider"]);
  const source = readFirst(metadata, ["source", "table", "route", "provider"]) ?? node.refType ?? sourceType;
  const accessLevel = metadata.accessLevel === "summary" ? "summary" : "full";
  const tags = readTextList(metadata.tags);

  return {
    id: node.id,
    type: node.type,
    label: node.label,
    module: readModule(node, metadata),
    status: readStatus(metadata),
    accessLevel,
    companyId: readFirst(metadata, ["companyId", "clientId"]),
    companySlug: readFirst(metadata, ["companySlug", "clientSlug", "slug"]),
    companyName: readFirst(metadata, ["companyName", "clientName"]),
    projectId: readFirst(metadata, ["projectId"]),
    projectSlug: readFirst(metadata, ["projectSlug", "projectCode"]),
    projectName: readFirst(metadata, ["projectName"]),
    createdBy: readFirst(metadata, ["createdBy", "createdById", "actorUserId", "userId"]),
    createdByName: readFirst(metadata, ["createdByName", "actorName", "userName", "email", "userEmail"]),
    createdAt: isoDate(node.createdAt) ?? readFirst(metadata, ["createdAt"]),
    updatedBy: readFirst(metadata, ["updatedBy", "updatedById"]),
    updatedAt: isoDate(node.updatedAt) ?? readFirst(metadata, ["updatedAt"]),
    source,
    sourceType,
    allowedActions: readAllowedActions(metadata, options.canManage),
    metadata,
    tags,
    relatedMemoryCount: options.memoryCounts.get(node.id) ?? 0,
    relatedDocumentCount: options.relatedDocumentCount.get(node.id) ?? 0,
    relatedLogCount: options.relatedLogCount.get(node.id) ?? 0,
    relatedNodeCount: options.relatedNodeCount.get(node.id) ?? 0,
    refType: node.refType ?? null,
    refId: node.refId ?? null,
    description: sanitizeBrainText(node.description),
    isRoot: node.id === options.rootId || node.isRoot === true,
  };
}

function serializeEdge(edge: GraphEdgeLike) {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    weight: edge.weight,
    metadata: sanitizeBrainMetadata(edge.metadata),
    createdAt: isoDate(edge.createdAt),
  };
}

type SerializedNode = ReturnType<typeof serializeNode>;

function buildFilters(nodes: SerializedNode[], access: BrainAccessContext) {
  function sortedValues(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function optionMap(values: Array<{ id?: string | null; label?: string | null; companyId?: string | null }>) {
    return Array.from(new Map(
      values
        .filter((item) => item.id || item.label)
        .map((item) => [item.id ?? item.label ?? "", { id: item.id ?? item.label ?? "", label: item.label ?? item.id ?? "", companyId: item.companyId ?? null }]),
    ).values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }

  const usersAllowed = canViewUsers(access);
  const logsAllowed = canViewLogs(access);
  const visibleSections = [
    nodes.some((node) => node.companyId || node.companySlug) ? "companies" : null,
    nodes.some((node) => node.projectId || node.projectSlug) ? "projects" : null,
    nodes.some((node) => node.module) ? "modules" : null,
    usersAllowed && nodes.some((node) => node.createdBy || /user|person|requester/i.test(node.type)) ? "users" : null,
    logsAllowed && nodes.some((node) => /log|audit|event/i.test(node.type)) ? "logs" : null,
    nodes.some((node) => node.relatedMemoryCount > 0) ? "memories" : null,
    nodes.some((node) => node.relatedDocumentCount > 0) ? "documents" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    companies: optionMap(nodes.map((node) => ({
      id: node.companyId ?? node.companySlug,
      label: node.companyName ?? node.companySlug ?? node.companyId,
    }))),
    projects: optionMap(nodes.map((node) => ({
      id: node.projectId ?? node.projectSlug,
      label: node.projectName ?? node.projectSlug ?? node.projectId,
      companyId: node.companyId ?? node.companySlug,
    }))),
    users: usersAllowed ? optionMap(nodes.map((node) => ({
      id: node.createdBy,
      label: node.createdByName ?? node.createdBy,
      companyId: node.companyId ?? node.companySlug,
    }))) : [],
    modules: sortedValues(nodes.map((node) => node.module)).map((value) => ({ id: value, label: value })),
    nodeTypes: sortedValues(nodes.map((node) => node.type)).filter((type) => logsAllowed || !/log|audit/i.test(type)).map((value) => ({ id: value, label: value })),
    statuses: sortedValues(nodes.map((node) => node.status)).map((value) => ({ id: value, label: value })),
    sources: sortedValues(nodes.map((node) => node.source ?? node.sourceType)).map((value) => ({ id: value, label: value })),
    tags: sortedValues(nodes.flatMap((node) => node.tags ?? [])).map((value) => ({ id: value, label: value })),
    createdBy: usersAllowed ? sortedValues(nodes.map((node) => node.createdBy)).map((value) => ({ id: value, label: value })) : [],
    dateFields: sortedValues(nodes.flatMap((node) => [
      node.createdAt ? "createdAt" : null,
      node.updatedAt ? "updatedAt" : null,
    ])).map((value) => ({ id: value, label: value })),
    visibleSections,
  };
}

async function buildGraphResponse(input: {
  nodes: GraphNodeLike[];
  edges: GraphEdgeLike[];
  rootId: string | null;
  root: GraphNodeLike | null;
  access: BrainAccessContext;
}) {
  const uniqueNodes = Array.from(new Map(input.nodes.map((node) => [node.id, node])).values());
  const visibleNodeIds = new Set(uniqueNodes.map((node) => node.id));
  const uniqueEdges = Array.from(new Map(
    input.edges
      .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
      .map((edge) => [edge.id, edge]),
  ).values());
  const related = edgeRelatedCounts(uniqueNodes, uniqueEdges);
  const memoryCounts = await memoryCountsByNodeId(uniqueNodes.map((node) => node.id));
  const nodeOptions = {
    rootId: input.rootId,
    canManage: input.access.canManage,
    memoryCounts,
    relatedNodeCount: related.relatedNodeCount,
    relatedDocumentCount: related.relatedDocumentCount,
    relatedLogCount: related.relatedLogCount,
  };
  const nodes = uniqueNodes.map((node) => serializeNode(node, nodeOptions));
  const edges = uniqueEdges.map(serializeEdge);
  const filters = buildFilters(nodes, input.access);

  return {
    rootNodeId: input.rootId,
    currentUserNodeId: currentUserNodeId(uniqueNodes, input.access),
    nodes,
    edges,
    root: input.root ? serializeNode(input.root, nodeOptions) : null,
    filters,
    access: {
      hasGlobalVisibility: input.access.hasGlobalVisibility,
      canManage: input.access.canManage,
      canViewUsers: canViewUsers(input.access),
      canViewLogs: canViewLogs(input.access),
      allowedCompanyIds: Array.from(input.access.allowedCompanyIds),
      allowedCompanySlugs: Array.from(input.access.allowedCompanySlugs),
      allowedProjectIds: Array.from(input.access.allowedProjectIds),
    },
    availableActions: [
      "filter_nodes",
      "open_node",
      "back_node",
      "reset_core",
      "search_context",
      ...(input.access.canManage ? ["create_memory", "configure_sources"] : []),
    ],
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      companyCount: filters.companies.length,
      projectCount: filters.projects.length,
      moduleCount: filters.modules.length,
      memoryCount: nodes.reduce((sum, node) => sum + node.relatedMemoryCount, 0),
      documentCount: nodes.reduce((sum, node) => sum + node.relatedDocumentCount, 0),
      logCount: nodes.reduce((sum, node) => sum + node.relatedLogCount, 0),
    },
  };
}

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }
  const { context: access } = accessResult;
  const executiveGraph = getExecutiveBrainContextGraph(access);

  if (isE2eJsonMode()) {
    const e2eRoot = {
      id: "brain-e2e-root",
      label: "Brain E2E",
      type: "System",
      refType: "Brian",
      refId: "e2e",
      description: "Grafo mockado para E2E em modo JSON.",
      metadata: { companySlug: Array.from(access.allowedCompanySlugs)[0] ?? "demo", e2e: true },
      isRoot: true,
    };
    return NextResponse.json(await buildGraphResponse({
      access,
      rootId: e2eRoot.id,
      root: e2eRoot,
      nodes: [
        e2eRoot,
        ...executiveGraph.nodes,
      ],
      edges: executiveGraph.edges,
    }));
  }

  const url = new URL(req.url);
  const nodeId = url.searchParams.get("nodeId");
  const depth = Math.min(4, Math.max(1, Number(url.searchParams.get("depth") ?? 2)));
  const nodeType = url.searchParams.get("type") ?? undefined;

  try {
    let rootId = nodeId;

    const virtualRoot = rootId ? executiveGraph.nodes.find((node) => node.id === rootId) ?? null : null;
    if (virtualRoot) {
      return NextResponse.json(await buildGraphResponse({
        access,
        rootId: virtualRoot.id,
        root: virtualRoot,
        nodes: executiveGraph.nodes,
        edges: executiveGraph.edges,
      }));
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
      const root = executiveGraph.nodes[0] ?? null;
      return NextResponse.json(await buildGraphResponse({
        access,
        rootId: root?.id ?? null,
        root,
        nodes: executiveGraph.nodes,
        edges: executiveGraph.edges,
      }));
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

    return NextResponse.json(await buildGraphResponse({
      access,
      rootId,
      root: subgraph.root ?? executiveGraph.nodes[0] ?? null,
      nodes: uniqueNodes,
      edges: uniqueEdges,
    }));
  } catch (error) {
    console.error("[brain/graph] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar grafo" }, { status: 500 });
  }
}
