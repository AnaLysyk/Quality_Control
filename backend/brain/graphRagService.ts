import type { BrainAccessContext } from "@/backend/brain/access";
import { getSubgraph, searchNodes } from "@/backend/brain";
import { isBrainNodeVisible } from "@/backend/brain/access";
import { prisma } from "@/database/prismaClient";

type QueryMode = "local" | "global" | "hybrid";

export type BrainEvidence = {
  sourceType: "node" | "edge" | "memory" | "document" | "event";
  sourceId: string;
  reason: string;
  confidence: number;
};

export type BrainRagContext = {
  mode: QueryMode;
  rootNodeId?: string;
  summary: string;
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ id: string; fromId: string; toId: string; type: string; reason?: string; source?: string; confidence?: number }>;
  memories: Array<{ id: string; title: string; summary: string; importance: number }>;
  documents: Array<{ id: string; title: string; category?: string | null }>;
  recentEvents: Array<{ id: string; action: string; entityType: string; createdAt: string }>;
  evidence: BrainEvidence[];
  permissions: {
    hasGlobalVisibility: boolean;
    allowedCompanySlugs: string[];
    allowedProjectIds: string[];
  };
  insufficientEvidence: boolean;
};

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

export class BrainGraphRagService {
  private wikiCompanyWhere(access: BrainAccessContext, requestedCompanySlug?: string | null) {
    const requested = requestedCompanySlug?.trim().toLowerCase() ?? null;
    if (access.hasGlobalVisibility) {
      return requested ? { companySlug: requested } : undefined;
    }

    const allowedCompanySlugs = Array.from(access.allowedCompanySlugs);
    if (requested && !access.allowedCompanySlugs.has(requested)) {
      return { companySlug: "__no_access__" };
    }

    return { companySlug: { in: requested ? [requested] : allowedCompanySlugs } };
  }

  async buildLocalContext(input: {
    nodeId: string;
    access: BrainAccessContext;
    depth?: number;
    maxNodes?: number;
    maxMemories?: number;
    maxDocs?: number;
    maxEvents?: number;
  }): Promise<BrainRagContext> {
    const depth = Math.min(4, Math.max(1, input.depth ?? 2));
    const maxNodes = Math.min(200, Math.max(20, input.maxNodes ?? 80));
    const maxMemories = Math.min(50, Math.max(5, input.maxMemories ?? 12));
    const maxDocs = Math.min(30, Math.max(3, input.maxDocs ?? 8));
    const maxEvents = Math.min(80, Math.max(5, input.maxEvents ?? 20));

    const subgraph = await getSubgraph(input.nodeId, depth);
    const visibleNodes = subgraph.nodes.filter((node) => isBrainNodeVisible(node, input.access)).slice(0, maxNodes);
    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));

    const visibleEdges = subgraph.edges
      .filter((edge) => visibleNodeIds.has(edge.fromId) && visibleNodeIds.has(edge.toId))
      .map((edge) => {
        const metadata = toRecord(edge.metadata);
        return {
          id: edge.id,
          fromId: edge.fromId,
          toId: edge.toId,
          type: edge.type,
          reason: typeof metadata.reason === "string" ? metadata.reason : undefined,
          source: typeof metadata.source === "string" ? metadata.source : undefined,
          confidence: typeof metadata.confidence === "number" ? metadata.confidence : edge.weight ?? undefined,
        };
      });

    const [memories, recentEvents] = await Promise.all([
      prisma.brainMemory.findMany({
        where: {
          OR: [
            { nodeId: { in: Array.from(visibleNodeIds) } },
            { relatedNodeIds: { not: undefined } },
          ],
          status: "ACTIVE",
        },
        orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
        take: maxMemories,
        select: { id: true, title: true, summary: true, importance: true, relatedNodeIds: true },
      }),
      prisma.brainAuditLog.findMany({
        where: {
          OR: [
            { entityType: "BrainNode", entityId: { in: Array.from(visibleNodeIds) } },
            { entityType: "BrainEdge" },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: maxEvents,
        select: { id: true, action: true, entityType: true, createdAt: true },
      }),
    ]);

    const rootNode = visibleNodes.find((node) => node.id === input.nodeId) ?? null;
    const keywords = rootNode ? rootNode.label.split(/\s+/).map((item) => item.trim()).filter(Boolean) : [];

    const wikiCompanyWhere = this.wikiCompanyWhere(input.access);
    const documents = await prisma.wikiDoc.findMany({
      where: {
        ...(wikiCompanyWhere ?? {}),
        ...(keywords.length
          ? {
              OR: keywords.slice(0, 5).map((keyword) => ({
                title: { contains: keyword, mode: "insensitive" },
              })),
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: maxDocs,
      select: { id: true, title: true, categoryId: true },
    });

    const evidence: BrainEvidence[] = [];
    for (const node of visibleNodes.slice(0, 12)) {
      evidence.push({
        sourceType: "node",
        sourceId: node.id,
        reason: `No visivel no contexto local: ${node.label}`,
        confidence: 0.9,
      });
    }
    for (const edge of visibleEdges.slice(0, 10)) {
      evidence.push({
        sourceType: "edge",
        sourceId: edge.id,
        reason: `Relacao ${edge.type}`,
        confidence: edge.confidence ?? 0.7,
      });
    }
    for (const memory of memories.slice(0, 8)) {
      evidence.push({
        sourceType: "memory",
        sourceId: memory.id,
        reason: `Memoria ativa: ${memory.title}`,
        confidence: Math.min(0.95, 0.4 + memory.importance * 0.1),
      });
    }
    for (const document of documents.slice(0, 6)) {
      evidence.push({
        sourceType: "document",
        sourceId: document.id,
        reason: `Documento relacionado por palavra-chave: ${document.title}`,
        confidence: 0.65,
      });
    }

    const insufficientEvidence = evidence.length < 3;

    return {
      mode: "local",
      rootNodeId: input.nodeId,
      summary: insufficientEvidence
        ? "Nao encontrei evidencia suficiente no Brain para montar contexto confiavel."
        : `Contexto local montado com ${visibleNodes.length} nos, ${visibleEdges.length} relacoes e ${memories.length} memorias.`,
      nodes: visibleNodes.map((node) => ({ id: node.id, label: node.label, type: node.type })),
      edges: visibleEdges,
      memories: memories.map((memory) => ({
        id: memory.id,
        title: memory.title,
        summary: memory.summary,
        importance: memory.importance,
      })),
      documents: documents.map((doc) => ({ id: doc.id, title: doc.title, category: doc.categoryId })),
      recentEvents: recentEvents.map((event) => ({
        id: event.id,
        action: event.action,
        entityType: event.entityType,
        createdAt: event.createdAt.toISOString(),
      })),
      evidence,
      permissions: {
        hasGlobalVisibility: input.access.hasGlobalVisibility,
        allowedCompanySlugs: Array.from(input.access.allowedCompanySlugs),
        allowedProjectIds: Array.from(input.access.allowedProjectIds),
      },
      insufficientEvidence,
    };
  }

  async buildGlobalContext(input: {
    query?: string;
    companySlug?: string;
    access: BrainAccessContext;
  }): Promise<BrainRagContext> {
    const allNodes = await prisma.brainNode.findMany({
      orderBy: { updatedAt: "desc" },
      take: 600,
      select: { id: true, label: true, type: true, refType: true, refId: true, metadata: true },
    });

    const query = normalizeText(input.query);
    const companySlug = input.companySlug?.trim().toLowerCase() ?? null;

    const filteredNodes = allNodes.filter((node) => {
      if (!isBrainNodeVisible(node, input.access)) return false;
      if (companySlug) {
        const metadata = toRecord(node.metadata);
        const nodeCompanySlug = normalizeText(metadata.companySlug);
        if (nodeCompanySlug !== companySlug) return false;
      }
      if (!query) return true;
      return normalizeText(node.label).includes(query) || normalizeText(node.type).includes(query);
    });

    const nodeIds = filteredNodes.map((node) => node.id);

    const [edges, memories, recentEvents] = await Promise.all([
      prisma.brainEdge.findMany({
        where: { fromId: { in: nodeIds }, toId: { in: nodeIds } },
        take: 600,
        orderBy: { createdAt: "desc" },
        select: { id: true, fromId: true, toId: true, type: true, metadata: true, weight: true },
      }),
      prisma.brainMemory.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
        take: 25,
        select: { id: true, title: true, summary: true, importance: true },
      }),
      prisma.brainAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 40,
        select: { id: true, action: true, entityType: true, createdAt: true },
      }),
    ]);

    const documents = await prisma.wikiDoc.findMany({
      where: this.wikiCompanyWhere(input.access, companySlug),
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, title: true, categoryId: true },
    });

    const typeCounts = new Map<string, number>();
    for (const node of filteredNodes) {
      typeCounts.set(node.type, (typeCounts.get(node.type) ?? 0) + 1);
    }

    const topTypes = Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((entry) => `${entry.type}: ${entry.count}`)
      .join(", ");

    const evidence: BrainEvidence[] = filteredNodes.slice(0, 20).map((node) => ({
      sourceType: "node",
      sourceId: node.id,
      reason: `No relevante na visao global (${node.type})`,
      confidence: 0.75,
    }));

    return {
      mode: "global",
      summary: filteredNodes.length
        ? `Visao global com ${filteredNodes.length} nos visiveis. Distribuicao principal: ${topTypes || "sem dados"}.`
        : "Nao encontrei evidencia suficiente no Brain para responder de forma global.",
      nodes: filteredNodes.slice(0, 120).map((node) => ({ id: node.id, label: node.label, type: node.type })),
      edges: edges.slice(0, 160).map((edge) => {
        const metadata = toRecord(edge.metadata);
        return {
          id: edge.id,
          fromId: edge.fromId,
          toId: edge.toId,
          type: edge.type,
          reason: typeof metadata.reason === "string" ? metadata.reason : undefined,
          source: typeof metadata.source === "string" ? metadata.source : undefined,
          confidence: typeof metadata.confidence === "number" ? metadata.confidence : edge.weight ?? undefined,
        };
      }),
      memories: memories.map((memory) => ({
        id: memory.id,
        title: memory.title,
        summary: memory.summary,
        importance: memory.importance,
      })),
      documents: documents.map((doc) => ({ id: doc.id, title: doc.title, category: doc.categoryId })),
      recentEvents: recentEvents.map((event) => ({
        id: event.id,
        action: event.action,
        entityType: event.entityType,
        createdAt: event.createdAt.toISOString(),
      })),
      evidence,
      permissions: {
        hasGlobalVisibility: input.access.hasGlobalVisibility,
        allowedCompanySlugs: Array.from(input.access.allowedCompanySlugs),
        allowedProjectIds: Array.from(input.access.allowedProjectIds),
      },
      insufficientEvidence: filteredNodes.length === 0,
    };
  }

  async buildHybridContext(input: {
    query: string;
    nodeId?: string;
    access: BrainAccessContext;
    depth?: number;
  }): Promise<BrainRagContext> {
    const query = input.query.trim();
    const local = input.nodeId
      ? await this.buildLocalContext({
          nodeId: input.nodeId,
          access: input.access,
          depth: input.depth ?? 2,
          maxNodes: 60,
          maxDocs: 8,
          maxEvents: 15,
          maxMemories: 10,
        })
      : null;

    const [global, semanticNodes] = await Promise.all([
      this.buildGlobalContext({ query, access: input.access }),
      searchNodes({ query, limit: 30 }),
    ]);

    const visibleSemanticNodes = semanticNodes.filter((node) => isBrainNodeVisible(node, input.access));
    const semanticEvidence: BrainEvidence[] = visibleSemanticNodes.slice(0, 12).map((node) => ({
      sourceType: "node",
      sourceId: node.id,
      reason: `No encontrado por busca textual: ${node.label}`,
      confidence: 0.7,
    }));

    const nodesMap = new Map<string, { id: string; label: string; type: string }>();
    for (const node of global.nodes) nodesMap.set(node.id, node);
    for (const node of local?.nodes ?? []) nodesMap.set(node.id, node);
    for (const node of visibleSemanticNodes) nodesMap.set(node.id, { id: node.id, label: node.label, type: node.type });

    const edges = [...(local?.edges ?? []), ...global.edges].slice(0, 220);
    const memories = [...(local?.memories ?? []), ...global.memories]
      .filter((item, index, all) => all.findIndex((entry) => entry.id === item.id) === index)
      .slice(0, 30);
    const documents = [...(local?.documents ?? []), ...global.documents]
      .filter((item, index, all) => all.findIndex((entry) => entry.id === item.id) === index)
      .slice(0, 20);

    const evidence = [
      ...(local?.evidence ?? []),
      ...global.evidence,
      ...semanticEvidence,
    ].slice(0, 120);

    const insufficientEvidence = evidence.length < 5;

    return {
      mode: "hybrid",
      rootNodeId: input.nodeId,
      summary: insufficientEvidence
        ? "Nao encontrei evidencia suficiente no Brain para responder com seguranca."
        : `Contexto hibrido montado com ${nodesMap.size} nos, ${edges.length} relacoes e ${documents.length} documentos.`,
      nodes: Array.from(nodesMap.values()).slice(0, 180),
      edges,
      memories,
      documents,
      recentEvents: [...(local?.recentEvents ?? []), ...global.recentEvents]
        .filter((item, index, all) => all.findIndex((entry) => entry.id === item.id) === index)
        .slice(0, 30),
      evidence,
      permissions: {
        hasGlobalVisibility: input.access.hasGlobalVisibility,
        allowedCompanySlugs: Array.from(input.access.allowedCompanySlugs),
        allowedProjectIds: Array.from(input.access.allowedProjectIds),
      },
      insufficientEvidence,
    };
  }

  extractApprovedMemoryNodeIds(memoryRecords: Array<{ relatedNodeIds?: unknown; nodeId?: string | null }>) {
    const ids = new Set<string>();
    for (const memory of memoryRecords) {
      if (memory.nodeId) ids.add(memory.nodeId);
      for (const id of toStringList(memory.relatedNodeIds)) ids.add(id);
    }
    return Array.from(ids);
  }
}
