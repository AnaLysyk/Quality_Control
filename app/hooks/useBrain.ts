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

export function useBrainSearch(type?: string, label?: string) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (label) params.set("label", label);
  const key = type || label ? `/api/brain/nodes?${params.toString()}` : null;

  return useSWR<{ nodes: BrainNode[] }>(key, fetcher, {
    revalidateOnFocus: false,
  });
}

export function useBrainNodeContext(nodeId: string | null) {
  const key = nodeId ? `/api/brain/nodes/${nodeId}?include=all&depth=2` : null;

  return useSWR(key, fetcher, {
    revalidateOnFocus: false,
  });
}

export function useBrainMemories(nodeId: string | null) {
  const key = nodeId ? `/api/brain/memories?nodeId=${nodeId}` : null;

  return useSWR<{ memories: BrainMemory[] }>(key, fetcher, {
    revalidateOnFocus: false,
  });
}
