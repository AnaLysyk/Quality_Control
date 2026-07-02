import type { BrainEdge, BrainNode } from "@prisma/client";

import { prisma } from "@/lib/prismaClient";

type GraphNode = Pick<BrainNode, "id" | "type" | "label" | "metadata">;
type GraphEdge = Pick<BrainEdge, "id" | "fromId" | "toId" | "type" | "weight" | "metadata">;

export type NodeCentrality = {
  nodeId: string;
  label: string;
  type: string;
  inDegree: number;
  outDegree: number;
  degree: number;
  pageRank: number;
  importanceScore: number;
  riskScore: number;
  qualityScore: number;
  reasons: string[];
};

export type GraphPathStep = {
  nodeId: string;
  label: string;
  type: string;
  edgeType?: string;
};

export type GraphPathResult = {
  found: boolean;
  path: GraphPathStep[];
  distance: number;
  explanation: string;
};

export type CommunityCluster = {
  communityId: string;
  size: number;
  nodeIds: string[];
  labels: string[];
  dominantTypes: Array<{ type: string; count: number }>;
};

export type BrainSuggestion = {
  id: string;
  companySlug: string;
  projectId?: string;
  targetNodeId: string;
  type:
    | "link_missing"
    | "automation_outdated"
    | "orphan_node"
    | "weak_relation"
    | "permission_issue"
    | "documentation_gap"
    | "test_gap";
  title: string;
  description: string;
  confidence: number;
  status: "suggested" | "accepted" | "rejected" | "resolved";
  createdBy: "system" | "assistant";
};

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: number, denominator: number) {
  if (denominator <= 0) return 0;
  return value / denominator;
}

export class BrainGraphAnalyticsService {
  private async loadGraph(options?: { companySlug?: string; allowedNodeIds?: Set<string> }) {
    const nodes = await prisma.brainNode.findMany({
      select: { id: true, type: true, label: true, metadata: true },
    });

    const companySlug = options?.companySlug?.trim().toLowerCase() ?? null;
    const allowedNodeIds = options?.allowedNodeIds;

    const filteredNodes = nodes.filter((node) => {
      if (allowedNodeIds && !allowedNodeIds.has(node.id)) return false;
      if (!companySlug) return true;
      const metadata = toRecord(node.metadata);
      const nodeCompanySlug = typeof metadata.companySlug === "string" ? metadata.companySlug.trim().toLowerCase() : null;
      return nodeCompanySlug === companySlug;
    });

    const nodeIds = new Set(filteredNodes.map((node) => node.id));
    const edges = await prisma.brainEdge.findMany({
      where: {
        fromId: { in: Array.from(nodeIds) },
        toId: { in: Array.from(nodeIds) },
      },
      select: {
        id: true,
        fromId: true,
        toId: true,
        type: true,
        weight: true,
        metadata: true,
      },
    });

    return { nodes: filteredNodes, edges };
  }

  async calculateCentrality(options?: { companySlug?: string; allowedNodeIds?: Set<string>; limit?: number }) {
    const { nodes, edges } = await this.loadGraph(options);
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      outDegree.set(node.id, 0);
    }

    for (const edge of edges) {
      outDegree.set(edge.fromId, (outDegree.get(edge.fromId) ?? 0) + 1);
      inDegree.set(edge.toId, (inDegree.get(edge.toId) ?? 0) + 1);
    }

    // PageRank simplificado em memória (damping padrão 0.85).
    const damping = 0.85;
    const count = Math.max(1, nodes.length);
    const ranks = new Map<string, number>(nodes.map((node) => [node.id, 1 / count]));
    const adjacency = new Map<string, string[]>();

    for (const node of nodes) adjacency.set(node.id, []);
    for (const edge of edges) adjacency.get(edge.fromId)?.push(edge.toId);

    for (let i = 0; i < 20; i += 1) {
      const next = new Map<string, number>();
      for (const node of nodes) next.set(node.id, (1 - damping) / count);

      for (const node of nodes) {
        const outbound = adjacency.get(node.id) ?? [];
        const rank = ranks.get(node.id) ?? 0;
        if (!outbound.length) {
          const spread = (damping * rank) / count;
          for (const target of nodes) {
            next.set(target.id, (next.get(target.id) ?? 0) + spread);
          }
          continue;
        }

        const spread = (damping * rank) / outbound.length;
        for (const toId of outbound) {
          next.set(toId, (next.get(toId) ?? 0) + spread);
        }
      }

      for (const [id, value] of next) ranks.set(id, value);
    }

    const maxDegree = Math.max(1, ...nodes.map((node) => (inDegree.get(node.id) ?? 0) + (outDegree.get(node.id) ?? 0)));
    const maxRank = Math.max(1e-9, ...nodes.map((node) => ranks.get(node.id) ?? 0));

    const centrality: NodeCentrality[] = nodes.map((node) => {
      const incoming = inDegree.get(node.id) ?? 0;
      const outgoing = outDegree.get(node.id) ?? 0;
      const degree = incoming + outgoing;
      const metadata = toRecord(node.metadata);

      const defectCount = readNumber(metadata.defectCount);
      const runCount = readNumber(metadata.runCount);
      const automationCount = readNumber(metadata.automationCount);
      const caseCount = readNumber(metadata.caseCount);

      const degreeScore = normalize(degree, maxDegree) * 55;
      const rankScore = normalize(ranks.get(node.id) ?? 0, maxRank) * 45;
      const importanceScore = clamp(degreeScore + rankScore);
      const riskScore = clamp((normalize(defectCount, Math.max(1, defectCount)) * 35) + (normalize(incoming, maxDegree) * 35) + (normalize(runCount, Math.max(1, runCount + 1)) * 30));
      const qualityScore = clamp(100 - riskScore + Math.min(20, automationCount * 2) + Math.min(10, caseCount * 0.5));

      const reasons: string[] = [];
      if (degree >= 5) reasons.push(`alto grau (${degree})`);
      if ((ranks.get(node.id) ?? 0) >= maxRank * 0.6) reasons.push("alta centralidade PageRank");
      if (defectCount > 0) reasons.push(`conectado a ${defectCount} defeitos`);
      if (automationCount > 0) reasons.push(`relacionado a ${automationCount} automacoes`);
      if (runCount > 0) reasons.push(`aparece em ${runCount} runs`);

      return {
        nodeId: node.id,
        label: node.label,
        type: node.type,
        inDegree: incoming,
        outDegree: outgoing,
        degree,
        pageRank: Number((ranks.get(node.id) ?? 0).toFixed(6)),
        importanceScore: Number(importanceScore.toFixed(2)),
        riskScore: Number(riskScore.toFixed(2)),
        qualityScore: Number(qualityScore.toFixed(2)),
        reasons,
      };
    });

    return centrality
      .sort((a, b) => b.importanceScore - a.importanceScore)
      .slice(0, options?.limit ?? 50);
  }

  async calculatePath(fromNodeId: string, toNodeId: string, options?: { companySlug?: string; allowedNodeIds?: Set<string> }): Promise<GraphPathResult> {
    const { nodes, edges } = await this.loadGraph(options);
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    if (!nodeMap.has(fromNodeId) || !nodeMap.has(toNodeId)) {
      return { found: false, path: [], distance: -1, explanation: "Um ou mais nos estao fora do escopo de visibilidade." };
    }

    const adjacency = new Map<string, Array<{ toId: string; edgeType: string }>>();
    for (const node of nodes) adjacency.set(node.id, []);
    for (const edge of edges) adjacency.get(edge.fromId)?.push({ toId: edge.toId, edgeType: edge.type });

    const queue: string[] = [fromNodeId];
    const visited = new Set<string>([fromNodeId]);
    const previous = new Map<string, { nodeId: string; edgeType: string }>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      if (current === toNodeId) break;

      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next.toId)) continue;
        visited.add(next.toId);
        previous.set(next.toId, { nodeId: current, edgeType: next.edgeType });
        queue.push(next.toId);
      }
    }

    if (!visited.has(toNodeId)) {
      return {
        found: false,
        path: [],
        distance: -1,
        explanation: "Nao encontrei caminho entre os nos dentro do grafo atual.",
      };
    }

    const chain: GraphPathStep[] = [];
    let cursor: string | undefined = toNodeId;
    while (cursor) {
      const node = nodeMap.get(cursor);
      if (!node) break;
      const prev = previous.get(cursor);
      chain.push({
        nodeId: node.id,
        label: node.label,
        type: node.type,
        edgeType: prev?.edgeType,
      });
      cursor = prev?.nodeId;
    }
    chain.reverse();

    const explanation = chain
      .map((step, index) => {
        if (index === 0) return step.label;
        const relation = step.edgeType ?? "RELATES_TO";
        return `${relation} -> ${step.label}`;
      })
      .join(" ");

    return {
      found: true,
      path: chain,
      distance: Math.max(0, chain.length - 1),
      explanation: `Caminho encontrado: ${explanation}`,
    };
  }

  async identifyCommunities(options?: { companySlug?: string; allowedNodeIds?: Set<string>; minSize?: number }) {
    const { nodes, edges } = await this.loadGraph(options);
    const adjacency = new Map<string, Set<string>>();
    for (const node of nodes) adjacency.set(node.id, new Set());
    for (const edge of edges) {
      adjacency.get(edge.fromId)?.add(edge.toId);
      adjacency.get(edge.toId)?.add(edge.fromId);
    }

    const visited = new Set<string>();
    const minSize = options?.minSize ?? 3;
    const communities: CommunityCluster[] = [];

    for (const node of nodes) {
      if (visited.has(node.id)) continue;
      const stack = [node.id];
      const component: string[] = [];

      while (stack.length > 0) {
        const current = stack.pop();
        if (!current || visited.has(current)) continue;
        visited.add(current);
        component.push(current);

        for (const neighbor of adjacency.get(current) ?? []) {
          if (!visited.has(neighbor)) stack.push(neighbor);
        }
      }

      if (component.length < minSize) continue;

      const typeCounts = new Map<string, number>();
      const labels: string[] = [];
      for (const id of component) {
        const member = nodes.find((n) => n.id === id);
        if (!member) continue;
        labels.push(member.label);
        typeCounts.set(member.type, (typeCounts.get(member.type) ?? 0) + 1);
      }

      communities.push({
        communityId: `community_${communities.length + 1}`,
        size: component.length,
        nodeIds: component,
        labels: labels.slice(0, 12),
        dominantTypes: Array.from(typeCounts.entries())
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 4),
      });
    }

    return communities.sort((a, b) => b.size - a.size);
  }

  async identifyOrphanNodes(options?: { companySlug?: string; allowedNodeIds?: Set<string>; limit?: number }) {
    const { nodes, edges } = await this.loadGraph(options);
    const degree = new Map<string, number>(nodes.map((node) => [node.id, 0]));
    for (const edge of edges) {
      degree.set(edge.fromId, (degree.get(edge.fromId) ?? 0) + 1);
      degree.set(edge.toId, (degree.get(edge.toId) ?? 0) + 1);
    }

    return nodes
      .filter((node) => (degree.get(node.id) ?? 0) === 0)
      .slice(0, options?.limit ?? 100);
  }

  async identifyWeakRelations(options?: { companySlug?: string; allowedNodeIds?: Set<string>; threshold?: number; limit?: number }) {
    const { nodes, edges } = await this.loadGraph(options);
    const threshold = options?.threshold ?? 0.3;
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    return edges
      .map((edge) => {
        const metadata = toRecord(edge.metadata);
        const confidence = readNumber(metadata.confidence, edge.weight ?? 0);
        return {
          edge,
          confidence,
          fromLabel: nodeMap.get(edge.fromId)?.label ?? edge.fromId,
          toLabel: nodeMap.get(edge.toId)?.label ?? edge.toId,
        };
      })
      .filter((entry) => entry.confidence < threshold)
      .sort((a, b) => a.confidence - b.confidence)
      .slice(0, options?.limit ?? 100);
  }

  async identifyHighImpactEntities(options?: { companySlug?: string; allowedNodeIds?: Set<string>; limit?: number }) {
    const centrality = await this.calculateCentrality({
      companySlug: options?.companySlug,
      allowedNodeIds: options?.allowedNodeIds,
      limit: 200,
    });

    return centrality
      .map((entry) => ({
        ...entry,
        impactScore: Number((entry.importanceScore * 0.65 + entry.riskScore * 0.35).toFixed(2)),
      }))
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, options?.limit ?? 20);
  }

  async identifyQualityBottlenecks(options?: { companySlug?: string; allowedNodeIds?: Set<string>; limit?: number }) {
    const { nodes, edges } = await this.loadGraph(options);
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const incomingByNode = new Map<string, GraphEdge[]>();
    for (const node of nodes) incomingByNode.set(node.id, []);
    for (const edge of edges) incomingByNode.get(edge.toId)?.push(edge);

    const problematicEdgeTypes = new Set([
      "FAILED_WITH",
      "BLOCKS",
      "FOUND_IN",
      "IMPACTED_BY",
      "HAS_DEFECT",
      "RELATES_TO_DEFECT",
    ]);

    const bottlenecks = nodes
      .map((node) => {
        const incoming = incomingByNode.get(node.id) ?? [];
        const problematic = incoming.filter((edge) => problematicEdgeTypes.has(edge.type));
        const signal = problematic.length + incoming.filter((edge) => edge.type.includes("FAIL")).length;
        return {
          nodeId: node.id,
          label: node.label,
          type: node.type,
          problematicRelations: problematic.length,
          incomingRelations: incoming.length,
          bottleneckScore: Number((signal * 10 + (incoming.length - problematic.length) * 2).toFixed(2)),
          sampleEdges: problematic.slice(0, 5).map((edge) => ({
            edgeId: edge.id,
            type: edge.type,
            fromId: edge.fromId,
            fromLabel: nodeMap.get(edge.fromId)?.label ?? edge.fromId,
          })),
        };
      })
      .filter((entry) => entry.bottleneckScore > 0)
      .sort((a, b) => b.bottleneckScore - a.bottleneckScore)
      .slice(0, options?.limit ?? 20);

    return bottlenecks;
  }

  async recalculateNodeScores(options?: { companySlug?: string; allowedNodeIds?: Set<string>; limit?: number }) {
    const centrality = await this.calculateCentrality(options);

    await prisma.$transaction(
      centrality.map((entry) =>
        prisma.brainNode.update({
          where: { id: entry.nodeId },
          data: {
            importanceScore: entry.importanceScore,
            riskScore: entry.riskScore,
            qualityScore: entry.qualityScore,
            metadata: {
              importanceScore: entry.importanceScore,
              riskScore: entry.riskScore,
              qualityScore: entry.qualityScore,
              scoreReasons: entry.reasons,
              scoreUpdatedAt: new Date().toISOString(),
            },
          },
        }),
      ),
    );

    return {
      updated: centrality.length,
      scores: centrality,
    };
  }

  async buildSuggestions(options?: { companySlug?: string; allowedNodeIds?: Set<string>; limit?: number }): Promise<BrainSuggestion[]> {
    const [orphans, weakRelations, bottlenecks] = await Promise.all([
      this.identifyOrphanNodes(options),
      this.identifyWeakRelations(options),
      this.identifyQualityBottlenecks(options),
    ]);

    const suggestions: BrainSuggestion[] = [];

    for (const orphan of orphans.slice(0, 15)) {
      const metadata = toRecord(orphan.metadata);
      suggestions.push({
        id: `suggestion_orphan_${orphan.id}`,
        companySlug: typeof metadata.companySlug === "string" ? metadata.companySlug : "global",
        targetNodeId: orphan.id,
        type: "orphan_node",
        title: `No orfao: ${orphan.label}`,
        description: "Este no nao possui relacoes de entrada ou saida no Brain.",
        confidence: 0.88,
        status: "suggested",
        createdBy: "system",
      });
    }

    for (const weak of weakRelations.slice(0, 15)) {
      suggestions.push({
        id: `suggestion_weak_${weak.edge.id}`,
        companySlug: "global",
        targetNodeId: weak.edge.fromId,
        type: "weak_relation",
        title: `Relacao fraca ${weak.edge.type}`,
        description: `${weak.fromLabel} -> ${weak.toLabel} possui confianca ${weak.confidence.toFixed(2)}.`,
        confidence: 0.72,
        status: "suggested",
        createdBy: "system",
      });
    }

    for (const bottleneck of bottlenecks.slice(0, 15)) {
      suggestions.push({
        id: `suggestion_gap_${bottleneck.nodeId}`,
        companySlug: "global",
        targetNodeId: bottleneck.nodeId,
        type: "test_gap",
        title: `Gargalo de qualidade: ${bottleneck.label}`,
        description: `${bottleneck.problematicRelations} relacoes problematicas detectadas para esta entidade.`,
        confidence: 0.8,
        status: "suggested",
        createdBy: "system",
      });
    }

    return suggestions.slice(0, options?.limit ?? 40);
  }
}

