"use client";

import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

/* ─── Types ─── */

export type BrainNode = {
  id: string;
  label: string;
  type: string;
  refType?: string | null;
  refId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  isRoot?: boolean;
};

export type BrainEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  weight?: number;
};

export type BrainGraphData = {
  nodes: BrainNode[];
  edges: BrainEdge[];
  root: BrainNode | null;
};

export type BrainStats = {
  integrity: {
    valid: boolean;
    errors: string[];
    stats: { nodes: number; edges: number; memories: number };
  };
  graphMetrics: {
    nodeCount: number;
    edgeCount: number;
    memoryCount: number;
    averageDegree: number;
    density: number;
    cyclesDetected: number;
    orphanedNodes: number;
    largestComponent: number;
  };
  intelligenceScore: number;
  alerts: string[];
  topConnectedNodes: {
    id: string;
    label: string;
    type: string;
    inDegree: number;
    outDegree: number;
    totalDegree: number;
  }[];
  breakdown: {
    nodesByType: { type: string; count: number }[];
    edgesByType: { type: string; count: number }[];
    memoriesByType: { type: string; count: number }[];
  };
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    reason: string | null;
    createdAt: string;
    userId: string | null;
  }[];
};

export type BrainMemory = {
  id: string;
  title: string;
  summary: string;
  memoryType: string;
  importance: number;
  relatedNodeIds: string[];
  status: string;
  sourceType?: string | null;
  sourceId?: string | null;
  createdAt: string;
};

export type BrainNodeStats = {
  nodeId: string;
  label: string;
  type: string;
  inDegree: number;
  outDegree: number;
  memoryCount: number;
  createdAt: string;
  updatedAt: string;
  importance: number;
};

export type BrainNodeInfluence = {
  nodeId: string;
  influenceScore: number;
  rankedPosition?: number;
};

export type BrainNodeSuggestion = {
  suggestedNodeId: string;
  suggestedNode: BrainNode;
  reason: string;
  score: number;
};

export type BrainNodeContextData = {
  context?: {
    node: BrainNode | null;
    outgoing: Array<{ id: string; fromId: string; toId: string; type: string }>;
    incoming: Array<{ id: string; fromId: string; toId: string; type: string }>;
    neighbors: BrainNode[];
  } | null;
  memories?: BrainMemory[];
  impact?: {
    impactedNodes: BrainNode[];
    paths: Array<{ nodeId: string; edgeType: string; distance: number }>;
  };
  subgraph?: BrainGraphData;
  stats?: BrainNodeStats;
  influence?: BrainNodeInfluence;
  relatedMemories?: BrainMemory[];
  ancestors?: BrainNode[];
  descendants?: BrainNode[];
  suggestions?: BrainNodeSuggestion[];
  similarNodes?: BrainNode[];
};

/* ─── Hooks ─── */

export function useBrainGraph(nodeId?: string | null, depth = 2) {
  const params = new URLSearchParams();
  if (nodeId) params.set("nodeId", nodeId);
  params.set("depth", String(depth));

  return useSWR<BrainGraphData>(
    `/api/brain/graph?${params.toString()}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );
}

export function useBrainStats() {
  return useSWR<BrainStats>("/api/brain/stats", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });
}

export function useBrainSearch(query?: string, type?: string, limit = 8) {
  const params = new URLSearchParams();
  const normalizedQuery = query?.trim();
  if (normalizedQuery) params.set("query", normalizedQuery);
  if (type) params.set("type", type);
  params.set("limit", String(limit));
  const key = normalizedQuery || type ? `/api/brain/nodes?${params.toString()}` : null;

  return useSWR<{ nodes: BrainNode[] }>(key, fetcher, {
    revalidateOnFocus: false,
  });
}

export function useBrainNodeContext(nodeId: string | null, depth = 2) {
  const key = nodeId ? `/api/brain/nodes/${nodeId}?include=all&depth=${depth}` : null;

  return useSWR<BrainNodeContextData>(key, fetcher, {
    revalidateOnFocus: false,
  });
}

export function useBrainMemories(nodeId: string | null) {
  const key = nodeId ? `/api/brain/memories?nodeId=${nodeId}` : null;

  return useSWR<{ memories: BrainMemory[] }>(key, fetcher, {
    revalidateOnFocus: false,
  });
}

export type BrainTimelineEntry = {
  id: string;
  action: string;
  reason: string | null;
  timestamp: string;
};

export function useBrainTimeline(nodeId: string | null) {
  const key = nodeId ? `/api/brain/nodes/${nodeId}/timeline` : null;

  return useSWR<{ timeline: BrainTimelineEntry[] }>(key, fetcher, {
    revalidateOnFocus: false,
  });
}
