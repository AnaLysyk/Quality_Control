import { NextResponse } from "next/server";

import { buildMockBrainGraph } from "@/brain/_data/brainMockGraph";
import { canAccessBrainModule, filterBrainDomainGraphByAccess, isBrainNodeVisible, resolveBrainAccess } from "@/backend/brain/access";
import { sanitizeBrainMetadata } from "@/backend/brain/security";
import { buildBrainSearchIndex, normalizeBrainSearchText, searchBrainIndex } from "@/backend/brain/searchIndex";
import { prisma } from "@/database/prismaClient";

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeFilter(value: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "all" ? trimmed : null;
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => readString(item)).filter((item): item is string => Boolean(item));
}

function matchesText(haystack: unknown[], query: string | null) {
  if (!query) return true;
  const normalized = normalizeBrainSearchText(haystack.filter(Boolean).join(" "));
  return normalized.includes(normalizeBrainSearchText(query));
}

function metadataCompanyKeys(metadata: Record<string, unknown>) {
  return [
    readString(metadata.companySlug),
    readString(metadata.slug),
    readString(metadata.companyId),
    readString(metadata.companyName),
  ].filter((item): item is string => Boolean(item));
}

function metadataProjectKeys(metadata: Record<string, unknown>) {
  return [
    readString(metadata.projectId),
    readString(metadata.projectSlug),
    readString(metadata.projectName),
  ].filter((item): item is string => Boolean(item));
}

function normalizedMatches(value: string | null, candidates: string[]) {
  if (!value) return true;
  const normalized = normalizeBrainSearchText(value);
  return candidates.some((candidate) => normalizeBrainSearchText(candidate) === normalized);
}

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const q = normalizeFilter(url.searchParams.get("q"));
  const typeFilter = normalizeFilter(url.searchParams.get("type"));
  const moduleFilter = normalizeFilter(url.searchParams.get("module"));
  const companyFilter = normalizeFilter(url.searchParams.get("companySlug") ?? url.searchParams.get("company"));
  const projectFilter = normalizeFilter(url.searchParams.get("projectId") ?? url.searchParams.get("project"));
  const statusFilter = normalizeFilter(url.searchParams.get("status"));
  const tagFilter = normalizeFilter(url.searchParams.get("tag"));
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

  const companyForFilter = companyFilter
    ? await prisma.company.findFirst({
        where: {
          OR: [
            { id: companyFilter },
            { slug: companyFilter },
          ],
        },
        select: { id: true, slug: true, name: true },
      }).catch(() => null)
    : null;

  const graph = buildMockBrainGraph();
  const visibleGraph = filterBrainDomainGraphByAccess(graph.nodes, graph.edges, accessResult.context);
  const [realNodes, realEdges] = await Promise.all([
    prisma.brainNode.findMany({ orderBy: { updatedAt: "desc" }, take: 1200 }).catch(() => []),
    prisma.brainEdge.findMany({ take: 2400 }).catch(() => []),
  ]);

  const visibleRealNodes = realNodes
    .filter((node) => isBrainNodeVisible(node, accessResult.context))
    .map((node) => ({
      ...node,
      metadata: sanitizeBrainMetadata(node.metadata),
    }));
  const visibleRealNodeIds = new Set(visibleRealNodes.map((node) => node.id));
  const visibleRealEdges = realEdges.filter((edge) => visibleRealNodeIds.has(edge.fromId) && visibleRealNodeIds.has(edge.toId));
  const realNodeById = new Map(visibleRealNodes.map((node) => [node.id, node]));
  const realIndex = buildBrainSearchIndex(visibleRealNodes, visibleRealEdges);

  const filteredRealIndex = realIndex.filter((entry) => {
    const node = realNodeById.get(entry.nodeId);
    const metadata = readMetadata(entry.metadata);
    if (typeFilter && entry.type !== typeFilter) return false;
    if (moduleFilter && entry.moduleId !== moduleFilter) return false;
    if (statusFilter && normalizeBrainSearchText(entry.status) !== normalizeBrainSearchText(statusFilter)) return false;
    if (projectFilter && !normalizedMatches(projectFilter, metadataProjectKeys(metadata))) return false;
    if (companyFilter) {
      const companyCandidates = [
        ...metadataCompanyKeys(metadata),
        companyForFilter?.id ?? null,
        companyForFilter?.slug ?? null,
        companyForFilter?.name ?? null,
      ].filter((item): item is string => Boolean(item));
      if (!normalizedMatches(companyFilter, companyCandidates)) return false;
    }
    if (tagFilter) {
      const tags = [
        ...entry.tags,
        ...readStringList(metadata.tags),
      ];
      if (!normalizedMatches(tagFilter, tags)) return false;
    }
    if (!q) return true;
    return Boolean(node) && matchesText([
      entry.label,
      entry.description,
      entry.type,
      entry.moduleId,
      entry.company,
      entry.project,
      entry.status,
      entry.tags.join(" "),
      entry.relatedLabels.join(" "),
      JSON.stringify(entry.metadata ?? {}),
    ], q);
  });

  const realResults = q
    ? searchBrainIndex(filteredRealIndex, q, { limit })
    : filteredRealIndex
        .slice(0, limit)
        .map((entry) => ({ ...entry, score: 1, matchedBy: ["recent"] }));

  const fallbackNodes = visibleGraph.nodes.filter((node) => {
    if (typeFilter && node.type !== typeFilter) return false;
    if (moduleFilter && node.module !== moduleFilter) return false;
    if (companyFilter && !normalizedMatches(companyFilter, [node.companyId, node.companyName].filter(Boolean) as string[])) return false;
    if (projectFilter && !normalizedMatches(projectFilter, [node.projectId, node.projectName].filter(Boolean) as string[])) return false;
    if (statusFilter && !normalizedMatches(statusFilter, [node.status].filter(Boolean) as string[])) return false;
    if (tagFilter && !matchesText([node.label, node.module, node.type, node.description, node.information], tagFilter)) return false;
    return matchesText([node.label, node.module, node.type, node.description, node.information], q);
  });

  const companies = Array.from(new Map([
    ...realIndex.flatMap((entry) => {
      const metadata = readMetadata(entry.metadata);
      const id = readString(metadata.companySlug) ?? readString(metadata.slug) ?? readString(metadata.companyId) ?? entry.company;
      if (!id) return [];
      return [[id, { id, label: readString(metadata.companyName) ?? id }]] as Array<[string, { id: string; label: string }]>;
    }),
    ...visibleGraph.nodes
      .filter((node) => node.companyId)
      .map((node) => [node.companyId!, { id: node.companyId!, label: node.companyName ?? node.companyId! }] as [string, { id: string; label: string }]),
  ]).values()).sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));

  const projects = Array.from(new Map([
    ...realIndex.flatMap((entry) => {
      const metadata = readMetadata(entry.metadata);
      const id = readString(metadata.projectId) ?? readString(metadata.projectSlug);
      if (!id) return [];
      return [[id, { id, label: readString(metadata.projectName) ?? entry.project ?? id }]] as Array<[string, { id: string; label: string }]>;
    }),
    ...visibleGraph.nodes
      .filter((node) => node.projectId)
      .map((node) => [node.projectId!, { id: node.projectId!, label: node.projectName ?? node.projectId! }] as [string, { id: string; label: string }]),
  ]).values()).sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));

  const modules = Array.from(new Set([
    ...realIndex.map((entry) => entry.moduleId).filter((item): item is string => Boolean(item)),
    ...visibleGraph.nodes.map((node) => node.module),
  ])).map((moduleName) => ({ id: moduleName, label: moduleName }));

  const types = Array.from(new Set([
    ...realIndex.map((entry) => entry.type),
    ...visibleGraph.nodes.map((node) => node.type),
  ])).sort((left, right) => left.localeCompare(right, "pt-BR"));

  const statuses = Array.from(new Set(realIndex.map((entry) => entry.status).filter((item): item is string => Boolean(item))))
    .sort((left, right) => left.localeCompare(right, "pt-BR"));

  const realResponseNodes = realResults.map((entry) => {
    const node = realNodeById.get(entry.nodeId);
    return {
      id: entry.nodeId,
      label: entry.label,
      type: entry.type,
      refType: node?.refType ?? null,
      refId: node?.refId ?? null,
      description: entry.description ?? null,
      metadata: entry.metadata,
      module: entry.moduleId,
      route: entry.route,
      status: entry.status,
      company: entry.company,
      project: entry.project,
      score: entry.score,
      matchedBy: entry.matchedBy,
      updatedAt: node?.updatedAt ?? entry.updatedAt ?? null,
      source: "brain-index",
    };
  });

  const fallbackResponseNodes = fallbackNodes.slice(0, Math.max(0, limit - realResponseNodes.length)).map((node) => ({
    id: node.id,
    label: node.label,
    type: node.type,
    description: node.description ?? null,
    metadata: sanitizeBrainMetadata({
      companyId: node.companyId ?? null,
      companyName: node.companyName ?? null,
      projectId: node.projectId ?? null,
      projectName: node.projectName ?? null,
      status: node.status ?? null,
      module: node.module,
    }),
    module: node.module,
    status: node.status ?? null,
    source: "fallback",
  }));

  return NextResponse.json({
    companies,
    projects,
    modules,
    types,
    statuses,
    nodes: [...realResponseNodes, ...fallbackResponseNodes].slice(0, limit),
    events: canAccessBrainModule(accessResult.context, "Logs")
      ? graph.auditLogs.slice(0, 10).map((event) => ({
          id: event.id,
          label: event.action,
          module: "Logs",
        }))
      : [],
    source: realResponseNodes.length ? "brain-index" : "fallback",
    filters: {
      q,
      type: typeFilter,
      companySlug: companyFilter,
      projectId: projectFilter,
      status: statusFilter,
      tag: tagFilter,
    },
  });
}
