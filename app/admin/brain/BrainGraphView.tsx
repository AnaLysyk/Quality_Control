"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  useBrainGraph,
  useBrainNodeContext,
  useBrainSearch,
  useBrainStats,
  useBrainTimeline,
} from "@/hooks/useBrain";
import type {
  BrainEdge,
  BrainMemory,
  BrainNode,
  BrainNodeSuggestion,
  BrainTimelineEntry,
} from "@/hooks/useBrain";
import { useTranslation } from "@/context/LanguageContext";
import styles from "./Brain.module.css";

type SimNode = BrainNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
  degree: number;
  layer: number;
  orbitRadius: number;
  anchorX: number;
  anchorY: number;
  mass: number;
};

const MAX_GRAPH_DEPTH = 4;

const TYPE_RING_WEIGHTS: Record<string, number> = {
  Company: 0.08,
  Application: 0.24,
  Module: 0.48,
  User: 0.36,
  Screen: 0.66,
  Release: 0.6,
  Integration: 0.78,
  TestRun: 0.82,
  Ticket: 1,
  Defect: 1.06,
  Note: 0.72,
};

const TYPE_ORBIT_PHASE: Record<string, number> = {
  Company: 0.08,
  Application: 0.14,
  Module: 0.22,
  User: 0.32,
  Screen: 0.44,
  Release: 0.52,
  Integration: 0.62,
  TestRun: 0.72,
  Ticket: 0.82,
  Defect: 0.9,
  Note: 0.98,
};

const EMPTY_NODES: BrainNode[] = [];
const EMPTY_EDGES: BrainEdge[] = [];
const EMPTY_MEMORIES: BrainMemory[] = [];
const EMPTY_SUGGESTIONS: BrainNodeSuggestion[] = [];
const EMPTY_CONTEXT_EDGES: Array<{
  id: string;
  fromId: string;
  toId: string;
  type: string;
}> = [];
const EMPTY_IMPACT_PATHS: Array<{ nodeId: string; edgeType: string; distance: number }> = [];

const GRAPH_PALETTES = {
  dark: {
    bgOuter: "#010715",
    bgInner: "#071328",
    bgGlow: "#143067",
    nodeBase: "#c7d2e8",
    nodeMuted: "#6c7fa4",
    nodeHub: "#5b92ff",
    nodeFocus: "#ef0001",
    nodeSignal: "#ff7c7d",
    edgeMuted: "rgba(91, 146, 255, 0.18)",
    edgeHub: "rgba(91, 146, 255, 0.34)",
    edgeActive: "rgba(239, 0, 1, 0.36)",
    edgeFocus: "rgba(248, 250, 252, 0.56)",
    edgeGlowHub: "rgba(91, 146, 255, 0.18)",
    edgeGlowActive: "rgba(239, 0, 1, 0.18)",
    edgeGlowFocus: "rgba(248, 250, 252, 0.18)",
    label: "rgba(248, 250, 252, 0.95)",
    labelMuted: "rgba(216, 225, 238, 0.7)",
    labelShadow: "rgba(2, 8, 18, 0.96)",
    haloHub: "rgba(91, 146, 255, 0.24)",
    haloFocus: "rgba(239, 0, 1, 0.2)",
    arrow: "rgba(91, 146, 255, 0.4)",
    arrowHub: "rgba(91, 146, 255, 0.56)",
    arrowFocus: "rgba(248, 250, 252, 0.72)",
    arrowActive: "rgba(255, 124, 125, 0.76)",
    edgeLabel: "rgba(220, 230, 242, 0.82)",
  },
  light: {
    bgOuter: "#e9eef8",
    bgInner: "#ffffff",
    bgGlow: "#d7e4ff",
    nodeBase: "#31425f",
    nodeMuted: "#7a8ca8",
    nodeHub: "#011848",
    nodeFocus: "#ef0001",
    nodeSignal: "#ff6d6f",
    edgeMuted: "rgba(1, 24, 72, 0.12)",
    edgeHub: "rgba(1, 24, 72, 0.26)",
    edgeActive: "rgba(239, 0, 1, 0.24)",
    edgeFocus: "rgba(15, 23, 42, 0.42)",
    edgeGlowHub: "rgba(1, 24, 72, 0.1)",
    edgeGlowActive: "rgba(239, 0, 1, 0.12)",
    edgeGlowFocus: "rgba(15, 23, 42, 0.12)",
    label: "rgba(15, 23, 42, 0.95)",
    labelMuted: "rgba(51, 65, 85, 0.70)",
    labelShadow: "rgba(255, 255, 255, 0.96)",
    haloHub: "rgba(1, 24, 72, 0.14)",
    haloFocus: "rgba(239, 0, 1, 0.14)",
    arrow: "rgba(1, 24, 72, 0.28)",
    arrowHub: "rgba(1, 24, 72, 0.42)",
    arrowFocus: "rgba(15, 23, 42, 0.72)",
    arrowActive: "rgba(239, 0, 1, 0.66)",
    edgeLabel: "rgba(60, 80, 100, 0.80)",
  },
} as const;

const TYPE_ACCENTS_DARK: Record<string, string> = {
  Company: "#dbe7ff",
  Application: "#8bb8ff",
  Module: "#ff8a8a",
  Ticket: "#fbbf24",
  Defect: "#f87171",
  User: "#c7d2fe",
  Screen: "#22d3ee",
  TestRun: "#7cd343",
  Release: "#c084fc",
  Integration: "#f472b6",
  Note: "#94a3b8",
};

const TYPE_ACCENTS_LIGHT: Record<string, string> = {
  Company: "#011848",
  Application: "#2355c4",
  Module: "#ef0001",
  Ticket: "#b45309",
  Defect: "#dc2626",
  User: "#5b6b87",
  Screen: "#0891b2",
  TestRun: "#5fae24",
  Release: "#9333ea",
  Integration: "#db2777",
  Note: "#475569",
};

const NODE_TYPES = [
  "Company",
  "Application",
  "Module",
  "Ticket",
  "Defect",
  "User",
  "Screen",
  "TestRun",
  "Release",
  "Integration",
  "Note",
];

const CREATE_EDGE_TYPES = [
  { value: "RELATES_TO", labelPt: "Relaciona com", labelEn: "Relates to" },
  { value: "DEPENDS_ON", labelPt: "Depende de", labelEn: "Depends on" },
  { value: "USES", labelPt: "Usa", labelEn: "Uses" },
  { value: "CONTAINS", labelPt: "Cont\u00e9m", labelEn: "Contains" },
  { value: "IMPACTS", labelPt: "Impacta", labelEn: "Impacts" },
];

const WORKSPACE_MODES: Record<string, { label: string; labelEn: string; types: string[] | null }> = {
  all: { label: "Completo", labelEn: "All", types: null },
  qa: { label: "QA", labelEn: "QA", types: ["Ticket", "Defect", "TestRun", "Screen", "Module"] },
  automation: { label: "Automa\u00e7\u00e3o", labelEn: "Automation", types: ["Integration", "TestRun", "Screen", "Module", "Application"] },
  docs: { label: "Docs", labelEn: "Docs", types: ["Note", "Module", "Application", "Company", "Release"] },
  integrations: { label: "Integra\u00e7\u00f5es", labelEn: "Integrations", types: ["Integration", "Application", "Company", "Module"] },
};

const CONFIDENCE_LEVELS: Record<string, { label: string; color: string; colorDark: string }> = {
  confiavel: { label: "Confi\u00e1vel", color: "#0f9f63", colorDark: "#2ddb87" },
  inferido: { label: "Inferido", color: "#b45309", colorDark: "#fbbf24" },
  velho: { label: "Desatualizado", color: "#6b7280", colorDark: "#9ca3af" },
  contraditorio: { label: "Contradit\u00f3rio", color: "#dc2626", colorDark: "#f87171" },
  pendente: { label: "Pendente", color: "#7c3aed", colorDark: "#c4b5fd" },
};

function getTypeAccent(type: string, isDark: boolean): string {
  const map = isDark ? TYPE_ACCENTS_DARK : TYPE_ACCENTS_LIGHT;
  return map[type] ?? (isDark ? "#c4cad3" : "#5f6875");
}

function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === "undefined") return true;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    const checkDark = () => document.documentElement.classList.contains("dark");
    const observer = new MutationObserver(() => {
      setIsDark(checkDark());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return { isDark };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getGraphPalette(isDark: boolean) {
  return isDark ? GRAPH_PALETTES.dark : GRAPH_PALETTES.light;
}

function formatDate(value: string | undefined, locale: string) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-US", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function dedupeMemories(memories: BrainMemory[]) {
  const seen = new Set<string>();
  return memories.filter((memory) => {
    if (seen.has(memory.id)) return false;
    seen.add(memory.id);
    return true;
  });
}

function getNodeRadius(node: SimNode, isFocused: boolean, isHovered: boolean) {
  let radius = 3.2 + Math.min(node.degree, 9) * 0.5;

  if (node.isRoot) radius += 2.4;
  if (node.type === "Company" || node.type === "Application") radius += 0.9;
  if (node.type === "Module") radius += 0.8;
  if (isHovered) radius += 0.8;
  if (isFocused) radius += 2.1;

  return clamp(radius, 4, 13.5);
}

function buildSimulationGraph(
  nodes: BrainNode[],
  edges: BrainEdge[],
  rootNodeId: string | null,
) {
  const degreeMap = new Map<string, number>();
  const adjacencyMap = new Map<string, Set<string>>();

  for (const node of nodes) {
    degreeMap.set(node.id, 0);
    adjacencyMap.set(node.id, new Set());
  }

  for (const edge of edges) {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
    degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
    adjacencyMap.get(edge.source)?.add(edge.target);
    adjacencyMap.get(edge.target)?.add(edge.source);
  }

  const rootId =
    rootNodeId ??
    [...degreeMap.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
    nodes[0]?.id ??
    null;
  const layerMap = new Map<string, number>();

  if (rootId) {
    const queue = [rootId];
    layerMap.set(rootId, 0);

    for (let index = 0; index < queue.length; index += 1) {
      const currentId = queue[index];
      const currentLayer = layerMap.get(currentId) ?? 0;

      for (const neighborId of adjacencyMap.get(currentId) ?? []) {
        if (layerMap.has(neighborId)) continue;
        layerMap.set(neighborId, currentLayer + 1);
        queue.push(neighborId);
      }
    }
  }

  let fallbackLayer = Math.max(0, ...Array.from(layerMap.values())) + 1;
  for (const node of nodes) {
    if (layerMap.has(node.id)) continue;
    layerMap.set(node.id, fallbackLayer);
    fallbackLayer += 1;
  }

  return { degreeMap, layerMap, rootId };
}

function getEdgeControlPoint(source: SimNode, target: SimNode) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpendicularX = -dy / distance;
  const perpendicularY = dx / distance;
  const curveStrength =
    Math.min(22, Math.max(6, distance * 0.05)) *
    (source.layer === target.layer ? 1.14 : 0.82);
  const direction = source.id.localeCompare(target.id) <= 0 ? 1 : -1;

  return {
    controlX: (source.x + target.x) / 2 + perpendicularX * curveStrength * direction,
    controlY: (source.y + target.y) / 2 + perpendicularY * curveStrength * direction,
  };
}

function initSimulation(
  nodes: BrainNode[],
  edges: BrainEdge[],
  width: number,
  height: number,
  rootNodeId: string | null,
) {
  const { degreeMap, layerMap, rootId } = buildSimulationGraph(nodes, edges, rootNodeId);
  const cx = width / 2;
  const cy = height / 2;
  const maxLayer = Math.max(0, ...Array.from(layerMap.values()));
  const layerSpacing = clamp(
    Math.min(width, height) / Math.max(2.4, maxLayer + 1.8),
    84,
    156,
  );
  const ellipseScaleX = width >= height ? 1.16 : 1.02;
  const ellipseScaleY = width >= height ? 0.84 : 0.94;
  const layers = new Map<number, BrainNode[]>();

  for (const node of nodes) {
    const layer = layerMap.get(node.id) ?? maxLayer + 1;
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer)?.push(node);
  }

  const simNodes: SimNode[] = [];

  for (const [layer, group] of [...layers.entries()].sort((left, right) => left[0] - right[0])) {
    const layerNodes = [...group].sort((left, right) => {
      const leftType = NODE_TYPES.indexOf(left.type);
      const rightType = NODE_TYPES.indexOf(right.type);
      const leftOrder = leftType === -1 ? Number.MAX_SAFE_INTEGER : leftType;
      const rightOrder = rightType === -1 ? Number.MAX_SAFE_INTEGER : rightType;
      return (
        leftOrder - rightOrder ||
        (degreeMap.get(right.id) ?? 0) - (degreeMap.get(left.id) ?? 0) ||
        left.label.localeCompare(right.label)
      );
    });
    const angleStep = (Math.PI * 2) / Math.max(layerNodes.length, 1);

    layerNodes.forEach((node, index) => {
      const degree = degreeMap.get(node.id) ?? 0;
      const phase = (TYPE_ORBIT_PHASE[node.type] ?? 0.5) * angleStep * 0.34;
      const angle = -Math.PI / 2 + index * angleStep + phase + layer * 0.18;
      const ringRadius = layer === 0 ? 0 : layerSpacing * (0.72 + layer * 0.88);
      const radialBias = ((TYPE_RING_WEIGHTS[node.type] ?? 0.5) - 0.5) * layerSpacing * 0.36;
      const ripple = Math.sin(angle * 3 + layer) * Math.min(layerSpacing * 0.12, 16);
      const orbitRadius = Math.max(0, ringRadius + radialBias + ripple);
      const anchorX =
        node.id === rootId ? cx : cx + Math.cos(angle) * orbitRadius * ellipseScaleX;
      const anchorY =
        node.id === rootId ? cy : cy + Math.sin(angle) * orbitRadius * ellipseScaleY;
      const initialJitter = node.id === rootId ? 0 : Math.min(10 + layer * 2, 18);

      simNodes.push({
        ...node,
        degree,
        layer,
        orbitRadius,
        anchorX,
        anchorY,
        x: anchorX + (Math.random() - 0.5) * initialJitter,
        y: anchorY + (Math.random() - 0.5) * initialJitter,
        vx: 0,
        vy: 0,
        fx: node.id === rootId ? cx : null,
        fy: node.id === rootId ? cy : null,
        mass: 1 + Math.min(degree, 10) * 0.06,
      });
    });
  }

  return simNodes;
}

function tickSimulation(simNodes: SimNode[], edges: BrainEdge[], width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const nodeMap = new Map(simNodes.map((node) => [node.id, node]));

  for (const node of simNodes) {
    if (node.fx != null) {
      node.x = node.fx;
      node.y = node.fy ?? node.y;
      continue;
    }

    const anchorStrength = 0.005 + node.layer * 0.00045;
    node.vx += (node.anchorX - node.x) * anchorStrength;
    node.vy += (node.anchorY - node.y) * anchorStrength;
    node.vx += (cx - node.x) * 0.00004;
    node.vy += (cy - node.y) * 0.00004;
  }

  for (let index = 0; index < simNodes.length; index += 1) {
    for (let second = index + 1; second < simNodes.length; second += 1) {
      const firstNode = simNodes[index];
      const secondNode = simNodes[second];

      let dx = secondNode.x - firstNode.x;
      let dy = secondNode.y - firstNode.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const safeDistance = Math.max(distance, 18);
      const sameLayerBand = Math.abs(firstNode.layer - secondNode.layer) <= 1;
      const moduleBoost =
        firstNode.type === "Module" || secondNode.type === "Module" ? 1.24 : 1;
      const hubBoost =
        firstNode.degree >= 5 || secondNode.degree >= 5 || firstNode.isRoot || secondNode.isRoot
          ? 1.12
          : 1;
      const repelStrength = Math.min(
        28,
        (7000 * (sameLayerBand ? 1.18 : 0.92) * moduleBoost * hubBoost) /
          (safeDistance * safeDistance),
      );

      dx = (dx / safeDistance) * repelStrength;
      dy = (dy / safeDistance) * repelStrength;

      if (firstNode.fx == null) {
        firstNode.vx -= dx / firstNode.mass;
        firstNode.vy -= dy / firstNode.mass;
      }

      if (secondNode.fx == null) {
        secondNode.vx += dx / secondNode.mass;
        secondNode.vy += dy / secondNode.mass;
      }
    }
  }

  for (const edge of edges) {
    const fromNode = nodeMap.get(edge.source);
    const toNode = nodeMap.get(edge.target);
    if (!fromNode || !toNode) continue;

    let dx = toNode.x - fromNode.x;
    let dy = toNode.y - fromNode.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const layerDelta = Math.abs(fromNode.layer - toNode.layer);
    const moduleLink =
      fromNode.type === "Module" || toNode.type === "Module" ? 18 : 0;
    const restLength =
      108 +
      layerDelta * 24 +
      Math.min((fromNode.degree + toNode.degree) * 4, 58) +
      moduleLink;
    const attraction = (distance - restLength) * (moduleLink > 0 ? 0.0032 : 0.0027);

    dx = (dx / distance) * attraction;
    dy = (dy / distance) * attraction;

    if (fromNode.fx == null) {
      fromNode.vx += dx / fromNode.mass;
      fromNode.vy += dy / fromNode.mass;
    }

    if (toNode.fx == null) {
      toNode.vx -= dx / toNode.mass;
      toNode.vy -= dy / toNode.mass;
    }
  }

  for (const node of simNodes) {
    if (node.fx != null) continue;

    node.vx *= 0.82;
    node.vy *= 0.82;
    node.x += node.vx;
    node.y += node.vy;
    node.x = clamp(node.x, 40, width - 40);
    node.y = clamp(node.y, 40, height - 40);
  }
}

export default function BrainGraphView() {
  const { t, locale } = useTranslation();
  const { isDark } = useTheme();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [rootNodeId, setRootNodeId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [depth, setDepth] = useState(MAX_GRAPH_DEPTH);
  const [panelOpen, setPanelOpen] = useState(true);
  const [viewScale, setViewScale] = useState(1);
  const [showLabels, setShowLabels] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "ask" | "create" | "timeline">("info");
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [workspaceMode, setWorkspaceMode] = useState<keyof typeof WORKSPACE_MODES>("all");
  const [showExplorer, setShowExplorer] = useState(false);
  const [explorerCollapsed, setExplorerCollapsed] = useState<Set<string>>(new Set());
  const [showPalette, setShowPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const paletteInputRef = useRef<HTMLInputElement>(null);

  // Create node form state
  const [createNodeLabel, setCreateNodeLabel] = useState("");
  const [createNodeType, setCreateNodeType] = useState("Note");
  const [createNodeDesc, setCreateNodeDesc] = useState("");
  const [createNodeLinkType, setCreateNodeLinkType] = useState("RELATES_TO");
  const [createNodeAttachToSelection, setCreateNodeAttachToSelection] = useState(true);
  const [createNodeLoading, setCreateNodeLoading] = useState(false);
  const [createNodeError, setCreateNodeError] = useState<string | null>(null);
  const [deleteNodeLoading, setDeleteNodeLoading] = useState(false);
  const [deleteNodeError, setDeleteNodeError] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ nodes: number; edges: number } | null>(null);

  const deferredSearchText = useDeferredValue(searchText.trim());

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const panRef = useRef({ x: 0, y: 0, scale: 1, dragging: false, lastX: 0, lastY: 0 });
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Custom streaming chat state
  type ChatMessage = { id: string; role: "user" | "assistant"; content: string };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const { data: graphData, isLoading: graphLoading, mutate: mutateGraph } = useBrainGraph(rootNodeId, depth);
  const { data: stats, mutate: mutateStats } = useBrainStats();
  const { data: nodeContext, mutate: mutateNodeContext } = useBrainNodeContext(selectedNodeId, depth);
  const { data: searchData, isLoading: searchLoading } = useBrainSearch(
    deferredSearchText.length >= 2 ? deferredSearchText : undefined,
    filterType ?? undefined,
    8,
  );
  const { data: timelineData, mutate: mutateTimeline } = useBrainTimeline(selectedNodeId);
  const deferredPaletteQuery = useDeferredValue(paletteQuery.trim());
  const { data: paletteSearchData } = useBrainSearch(
    deferredPaletteQuery.length >= 1 ? deferredPaletteQuery : undefined,
    undefined,
    12,
  );

  const nodes = graphData?.nodes ?? EMPTY_NODES;
  const edges = graphData?.edges ?? EMPTY_EDGES;
  const effectiveRootNodeId = rootNodeId ?? graphData?.root?.id ?? null;
  const visibleRootNode =
    nodes.find((node) => node.id === effectiveRootNodeId) ?? graphData?.root ?? null;

  useEffect(() => {
    if (selectedNodeId) {
      const frame = window.requestAnimationFrame(() => setPanelOpen(true));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [selectedNodeId]);

  // Focus palette input when opened
  useEffect(() => {
    if (showPalette) {
      const t = setTimeout(() => paletteInputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [showPalette]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current && chatMessages.length > 0) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const filteredNodes = useMemo(
    () =>
      nodes.filter((node) => {
        if (filterType && node.type !== filterType) return false;
        const workspaceTypes = WORKSPACE_MODES[workspaceMode]?.types;
        if (workspaceTypes && !workspaceTypes.includes(node.type)) return false;
        return true;
      }),
    [filterType, nodes, workspaceMode],
  );

  const filteredEdges = useMemo(() => {
    const visibleNodeIds = new Set(filteredNodes.map((node) => node.id));
    return edges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
    );
  }, [edges, filteredNodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || filteredNodes.length === 0) return;

    const { width, height } = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    simNodesRef.current = initSimulation(
      filteredNodes,
      filteredEdges,
      width,
      height,
      effectiveRootNodeId,
    );
  }, [filteredEdges, filteredNodes, effectiveRootNodeId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || filteredNodes.length === 0) return;

    const frame = window.requestAnimationFrame(() => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;

      for (let step = 0; step < 140; step += 1) {
        tickSimulation(simNodesRef.current, filteredEdges, width, height);
      }

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (const node of simNodesRef.current) {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
      }

      const padding = 92;
      const graphW = maxX - minX + padding * 2;
      const graphH = maxY - minY + padding * 2;
      const scale = clamp(Math.min(width / graphW, height / graphH), 0.32, 2.3);

      panRef.current.scale = scale;
      panRef.current.x = width / 2 - ((minX + maxX) / 2) * scale;
      panRef.current.y = height / 2 - ((minY + maxY) / 2) * scale;
      setViewScale(Number(scale.toFixed(2)));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [effectiveRootNodeId, filteredEdges, filteredNodes.length]);

  const selectedNode = nodeContext?.context?.node ?? nodes.find((node) => node.id === selectedNodeId) ?? null;
  const nodeNeighbors = nodeContext?.context?.neighbors ?? EMPTY_NODES;
  const nodeOutgoing = nodeContext?.context?.outgoing ?? EMPTY_CONTEXT_EDGES;
  const nodeIncoming = nodeContext?.context?.incoming ?? EMPTY_CONTEXT_EDGES;
  const impactData = nodeContext?.impact;
  const impactedNodes = impactData?.impactedNodes ?? EMPTY_NODES;
  const impactPaths = impactData?.paths ?? EMPTY_IMPACT_PATHS;
  const directMemories = dedupeMemories(nodeContext?.memories ?? EMPTY_MEMORIES);
  const relatedMemories = dedupeMemories([
    ...(nodeContext?.relatedMemories ?? EMPTY_MEMORIES),
    ...directMemories,
  ]);
  const ancestors = nodeContext?.ancestors ?? EMPTY_NODES;
  const descendants = nodeContext?.descendants ?? EMPTY_NODES;
  const suggestions = nodeContext?.suggestions ?? EMPTY_SUGGESTIONS;
  const similarNodes = nodeContext?.similarNodes ?? EMPTY_NODES;
  const topNodeTypes = stats?.breakdown.nodesByType.slice(0, 6) ?? [];
  const topConnectedNodes = stats?.topConnectedNodes ?? [];
  const recentActivity = stats?.recentActivity?.slice(0, 6) ?? [];
  const alerts = stats?.alerts ?? [];
  const graphMetrics = stats?.graphMetrics;
  const nodeTimeline = (timelineData?.timeline ?? []) as BrainTimelineEntry[];
  const paletteNodes = paletteSearchData?.nodes ?? [];

  // Group all visible nodes by type for explorer
  const nodesByType = useMemo(() => {
    const map = new Map<string, BrainNode[]>();
    for (const node of nodes) {
      if (!map.has(node.type)) map.set(node.type, []);
      map.get(node.type)!.push(node);
    }
    return map;
  }, [nodes]);
  const intelligenceScore = stats?.intelligenceScore ?? 0;
  const searchResults = searchData?.nodes ?? [];
  const showSearchResults =
    deferredSearchText.length >= 2 && (searchLoading || searchResults.length > 0);
  const nodeTypes = useMemo(
    () => Array.from(new Set(nodes.map((node) => node.type))).sort(),
    [nodes],
  );
  const isPanelVisible = panelOpen && (!!selectedNode || !!stats);
  const activeRootLabel = visibleRootNode?.label ?? (effectiveRootNodeId ? effectiveRootNodeId.slice(0, 8) : null);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl/Cmd+K = command palette
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowPalette((v) => !v);
        setPaletteQuery("");
        return;
      }
      if (e.key === "Escape") {
        if (showPalette) { setShowPalette(false); return; }
        setSelectedNodeId(null);
        setHoveredNodeId(null);
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "f" || e.key === "F") zoomToFit();
      if (e.key === "l" || e.key === "L") setShowLabels((v) => !v);
      if (e.key === "p" || e.key === "P") setPanelOpen((v) => !v);
      if (e.key === "e" || e.key === "E") setShowExplorer((v) => !v);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPalette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const palette = getGraphPalette(isDark);

    const render = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Background radial gradient
      const gradient = context.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.76,
      );
      gradient.addColorStop(0, palette.bgGlow);
      gradient.addColorStop(0.45, palette.bgInner);
      gradient.addColorStop(1, palette.bgOuter);
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      context.save();
      context.translate(panRef.current.x, panRef.current.y);
      context.scale(panRef.current.scale, panRef.current.scale);

      const simNodes = simNodesRef.current;
      tickSimulation(simNodes, filteredEdges, width, height);

      const accentNodeIds = new Set<string>();
      if (effectiveRootNodeId) accentNodeIds.add(effectiveRootNodeId);
      if (selectedNodeId) accentNodeIds.add(selectedNodeId);
      if (hoveredNodeId) accentNodeIds.add(hoveredNodeId);
      for (const node of nodeNeighbors.slice(0, 12)) accentNodeIds.add(node.id);
      for (const node of impactedNodes.slice(0, 12)) accentNodeIds.add(node.id);

      const nodeMap = new Map(simNodes.map((node) => [node.id, node]));

      const rootNode = effectiveRootNodeId ? nodeMap.get(effectiveRootNodeId) : null;
      const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) : null;

      if (rootNode) {
        const rootGlow = context.createRadialGradient(
          rootNode.x,
          rootNode.y,
          0,
          rootNode.x,
          rootNode.y,
          160,
        );
        rootGlow.addColorStop(0, palette.haloHub);
        rootGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = rootGlow;
        context.beginPath();
        context.arc(rootNode.x, rootNode.y, 160, 0, Math.PI * 2);
        context.fill();
      }

      if (selectedNode && selectedNode.id !== rootNode?.id) {
        const selectedGlow = context.createRadialGradient(
          selectedNode.x,
          selectedNode.y,
          0,
          selectedNode.x,
          selectedNode.y,
          120,
        );
        selectedGlow.addColorStop(0, palette.haloFocus);
        selectedGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = selectedGlow;
        context.beginPath();
        context.arc(selectedNode.x, selectedNode.y, 120, 0, Math.PI * 2);
        context.fill();
      }

      // Draw edges with arrowheads
      for (const edge of filteredEdges) {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) continue;

        const connectedToSelection =
          selectedNodeId != null &&
          (edge.source === selectedNodeId || edge.target === selectedNodeId);
        const connectedToRoot =
          effectiveRootNodeId != null &&
          (edge.source === effectiveRootNodeId || edge.target === effectiveRootNodeId);
        const activeEdge =
          accentNodeIds.has(edge.source) || accentNodeIds.has(edge.target);

        const edgeColor = connectedToSelection
          ? palette.edgeFocus
          : connectedToRoot
            ? palette.edgeHub
            : activeEdge
            ? palette.edgeActive
            : palette.edgeMuted;
        const lineWidth = connectedToSelection ? 2.25 : connectedToRoot ? 1.7 : activeEdge ? 1.45 : 1.05;
        const { controlX, controlY } = getEdgeControlPoint(source, target);

        // Draw line
        context.beginPath();
        context.moveTo(source.x, source.y);
        context.quadraticCurveTo(controlX, controlY, target.x, target.y);
        context.strokeStyle = edgeColor;
        context.lineWidth = lineWidth;
        context.shadowColor = connectedToSelection
          ? palette.edgeGlowFocus
          : connectedToRoot
            ? palette.edgeGlowHub
            : activeEdge
              ? palette.edgeGlowActive
              : "transparent";
        context.shadowBlur = connectedToSelection ? 16 : connectedToRoot ? 12 : activeEdge ? 8 : 0;
        context.stroke();
        context.shadowBlur = 0;

        // Draw arrowhead at target
        const targetNode = target;
        const tRadius = getNodeRadius(
          targetNode,
          targetNode.id === selectedNodeId || targetNode.id === effectiveRootNodeId,
          targetNode.id === hoveredNodeId,
        );
        const angle = Math.atan2(target.y - controlY, target.x - controlX);
        const arrowSize = connectedToSelection ? 7 : connectedToRoot ? 6 : activeEdge ? 5.5 : 4;
        const arrowX = target.x - Math.cos(angle) * (tRadius + 1.5);
        const arrowY = target.y - Math.sin(angle) * (tRadius + 1.5);

        context.beginPath();
        context.moveTo(arrowX, arrowY);
        context.lineTo(
          arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
          arrowY - arrowSize * Math.sin(angle - Math.PI / 6),
        );
        context.lineTo(
          arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
          arrowY - arrowSize * Math.sin(angle + Math.PI / 6),
        );
        context.closePath();
        context.fillStyle = connectedToSelection
          ? palette.arrowFocus
          : connectedToRoot
            ? palette.arrowHub
            : activeEdge
            ? palette.arrowActive
            : palette.arrow;
        context.fill();

        // Edge type label at midpoint (only for selected edges + when showEdgeLabels)
        if (showEdgeLabels && connectedToSelection) {
          const midX = (source.x + 2 * controlX + target.x) / 4;
          const midY = (source.y + 2 * controlY + target.y) / 4;
          const edgeLabel = edge.type.replace(/_/g, " ").toLowerCase();

          context.save();
          context.font = '500 9px "Poppins", "Segoe UI", system-ui, sans-serif';
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.shadowColor = palette.labelShadow;
          context.shadowBlur = 8;
          context.fillStyle = palette.edgeLabel;
          context.fillText(edgeLabel, midX, midY - 6);
          context.shadowBlur = 0;
          context.restore();
        }
      }

      // Sort nodes for z-ordering
      const sortedNodes = [...simNodes].sort((left, right) => {
        const leftWeight =
          (left.id === selectedNodeId ? 100 : 0) +
          (left.id === hoveredNodeId ? 50 : 0) +
          (left.id === effectiveRootNodeId ? 25 : 0) +
          left.degree;
        const rightWeight =
          (right.id === selectedNodeId ? 100 : 0) +
          (right.id === hoveredNodeId ? 50 : 0) +
          (right.id === effectiveRootNodeId ? 25 : 0) +
          right.degree;
        return leftWeight - rightWeight;
      });

      for (const node of sortedNodes) {
        const isSelected = node.id === selectedNodeId;
        const isRoot = node.id === effectiveRootNodeId;
        const isFocused = isSelected || isRoot;
        const isHovered = node.id === hoveredNodeId;
        const isSignal = accentNodeIds.has(node.id);
        const isHub = node.degree >= 4 || node.isRoot;
        const radius = getNodeRadius(node, isFocused, isHovered);

        // Type-based color (Obsidian-inspired: each type has its own color)
        const typeColor = getTypeAccent(node.type, isDark);
        const fill = isSelected
          ? palette.nodeFocus
          : isRoot
            ? palette.nodeHub
          : isHovered
            ? typeColor
            : isSignal
              ? typeColor
              : isHub
                ? typeColor
                : node.degree <= 1
                  ? (isDark ? `${typeColor}99` : `${typeColor}bb`)
                  : typeColor;

        // Halo for focused/hovered
        if (isFocused || isHovered) {
          context.beginPath();
          context.arc(node.x, node.y, radius + (isSelected ? 13 : isRoot ? 11 : 10), 0, Math.PI * 2);
          context.fillStyle = isSelected
            ? palette.haloFocus
            : isRoot
              ? palette.haloHub
              : `${typeColor}22`;
          context.fill();
        }

        // Node circle
        context.beginPath();
        context.arc(node.x, node.y, radius, 0, Math.PI * 2);
        context.fillStyle = fill;
        context.shadowColor = isSelected
          ? palette.haloFocus
          : isRoot
            ? palette.haloHub
            : isSignal
              ? `${typeColor}44`
              : "transparent";
        context.shadowBlur = isSelected ? 18 : isRoot ? 14 : isSignal ? 8 : 0;
        context.fill();
        context.shadowBlur = 0;

        // Confidence ring (check node.metadata.confidence)
        const confidence = (node.metadata as Record<string, unknown> | null)?.confidence as string | undefined;
        if (confidence && CONFIDENCE_LEVELS[confidence]) {
          const confColor = isDark
            ? CONFIDENCE_LEVELS[confidence].colorDark
            : CONFIDENCE_LEVELS[confidence].color;
          context.beginPath();
          context.arc(node.x, node.y, radius + 3.5, 0, Math.PI * 2);
          context.strokeStyle = confColor;
          context.lineWidth = 2;
          context.setLineDash([3, 3]);
          context.stroke();
          context.setLineDash([]);
        }

        // Focus ring
        if (isFocused) {
          context.beginPath();
          context.arc(node.x, node.y, radius + 2.4, 0, Math.PI * 2);
          context.strokeStyle = isSelected ? palette.nodeFocus : palette.nodeHub;
          context.lineWidth = 1.1;
          context.stroke();
        }

        // Labels
        const shouldShowLabel =
          showLabels ||
          isFocused ||
          isHovered ||
          (node.type === "Module" && simNodes.length <= 48);
        if (!shouldShowLabel) {
          continue;
        }

        const labelX = node.x + radius + 8;
        const labelY = node.y + 1;
        const label = node.label.length > 28 ? `${node.label.slice(0, 26)}...` : node.label;

        context.font = `${isFocused ? 600 : 500} 12px "Poppins", "Segoe UI", system-ui, sans-serif`;
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.shadowColor = palette.labelShadow;
        context.shadowBlur = 12;
        context.fillStyle = palette.label;
        context.fillText(label, labelX, labelY);
        context.shadowBlur = 0;

        if (isFocused) {
          context.font = `500 10px "Poppins", "Segoe UI", system-ui, sans-serif`;
          context.fillStyle = palette.labelMuted;
          context.fillText(node.type, labelX, labelY + 14);
        }
      }

      context.restore();
      animationFrameRef.current = window.requestAnimationFrame(render);
    };

    animationFrameRef.current = window.requestAnimationFrame(render);
    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    effectiveRootNodeId,
    filteredEdges,
    hoveredNodeId,
    impactedNodes,
    isDark,
    nodeNeighbors,
    selectedNodeId,
    showEdgeLabels,
    showLabels,
  ]);

  function resetViewport() {
    panRef.current = { x: 0, y: 0, scale: 1, dragging: false, lastX: 0, lastY: 0 };
    setViewScale(1);
  }

  function zoomToFit() {
    const canvas = canvasRef.current;
    if (!canvas || simNodesRef.current.length === 0) return;

    const { width, height } = canvas.getBoundingClientRect();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (const node of simNodesRef.current) {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    }

    const padding = 72;
    const graphW = maxX - minX + padding * 2;
    const graphH = maxY - minY + padding * 2;
    const scale = clamp(Math.min(width / graphW, height / graphH), 0.3, 2.5);

    panRef.current.scale = scale;
    panRef.current.x = width / 2 - ((minX + maxX) / 2) * scale;
    panRef.current.y = height / 2 - ((minY + maxY) / 2) * scale;
    setViewScale(Number(scale.toFixed(2)));
  }

  function focusNode(nodeId: string) {
    setRootNodeId(nodeId);
    setSelectedNodeId(nodeId);
    setPanelOpen(true);
    setActiveTab("info");
    setDeleteNodeError(null);
    resetViewport();
  }

  function handleSearchSelect(node: BrainNode) {
    setSearchText("");
    focusNode(node.id);
  }

  function clearBrainFilters() {
    setSearchText("");
    setFilterType(null);
    setRootNodeId(null);
    setSelectedNodeId(null);
    setHoveredNodeId(null);
    resetViewport();
  }

  async function sendChatMessage(question: string) {
    if (!question.trim() || chatLoading) return;

    const newMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: question };
    const assistantId = `a-${Date.now() + 1}`;
    const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "" };

    setChatMessages((prev) => [...prev, newMsg, assistantMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/brain/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: [...chatMessages, newMsg].map((m) => ({ role: m.role, content: m.content })),
          nodeId: selectedNodeId ?? undefined,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          // Vercel AI SDK data stream: '0:"text"' = text chunk
          if (line.startsWith("0:")) {
            try {
              accumulated += JSON.parse(line.slice(2));
              setChatMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
              );
            } catch {
              // skip malformed chunk
            }
          }
        }
      }
    } catch {
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: locale === "pt" ? "Erro ao obter resposta." : "Error getting response." }
            : m,
        ),
      );
    } finally {
      setChatLoading(false);
    }
  }

  async function handleCreateNode() {
    if (!createNodeLabel.trim()) return;
    setCreateNodeLoading(true);
    setCreateNodeError(null);

    try {
      const shouldAttachToSelection = Boolean(selectedNodeId && createNodeAttachToSelection);
      const res = await fetch("/api/brain/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: createNodeType,
          label: createNodeLabel.trim(),
          description: createNodeDesc.trim() || undefined,
        }),
      });

      if (res.ok) {
        const { node } = await res.json();

        if (shouldAttachToSelection && selectedNodeId) {
          const edgeRes = await fetch("/api/brain/edges", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              fromId: selectedNodeId,
              toId: node.id,
              type: createNodeLinkType,
            }),
          });

          if (!edgeRes.ok) {
            console.error("[brain] failed to connect new node to selection", await edgeRes.text());
          }
        }

        setCreateNodeLabel("");
        setCreateNodeDesc("");
        setCreateNodeType("Note");
        setCreateNodeLinkType("RELATES_TO");
        await Promise.all([
          mutateStats(),
          mutateGraph(),
          selectedNodeId ? mutateNodeContext() : Promise.resolve(undefined),
          selectedNodeId ? mutateTimeline() : Promise.resolve(undefined),
        ]);
        focusNode(node.id);
      } else {
        const data = await res.json();
        setCreateNodeError(data.error ?? "Erro ao criar n\u00f3");
      }
    } catch {
      setCreateNodeError("Erro de conex\u00e3o");
    } finally {
      setCreateNodeLoading(false);
    }
  }

  async function handleDeleteNode() {
    if (!selectedNode || deleteNodeLoading) return;
    const deletingPinnedRoot = rootNodeId === selectedNode.id;

    const confirmed = window.confirm(
      locale === "pt"
        ? `Excluir o n\u00f3 "${selectedNode.label}" e remover as conex\u00f5es dele?`
        : `Delete "${selectedNode.label}" and remove all of its connections?`,
    );
    if (!confirmed) return;

    setDeleteNodeLoading(true);
    setDeleteNodeError(null);

    try {
      const res = await fetch(`/api/brain/nodes/${selectedNode.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error ??
            (locale === "pt" ? "Erro ao excluir n\u00f3" : "Failed to delete node"),
        );
      }

      if (deletingPinnedRoot) {
        setRootNodeId(null);
      }

      setSelectedNodeId(null);
      setHoveredNodeId((current) => (current === selectedNode.id ? null : current));
      setActiveTab("info");
      setPanelOpen(true);
      resetViewport();

      await Promise.all([
        mutateStats(),
        deletingPinnedRoot ? Promise.resolve(undefined) : mutateGraph(),
      ]);
    } catch (error) {
      setDeleteNodeError(
        error instanceof Error
          ? error.message
          : locale === "pt"
            ? "Erro ao excluir n\u00f3"
            : "Failed to delete node",
      );
    } finally {
      setDeleteNodeLoading(false);
    }
  }

  async function handleSync() {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/brain/sync", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setSyncResult({ nodes: data.nodeCount ?? 0, edges: data.edgeCount ?? 0 });
        mutateStats();
        // Refetch graph after sync
        setTimeout(() => setSyncResult(null), 4000);
      }
    } catch {
      // silent
    } finally {
      setSyncLoading(false);
    }
  }

  function findNodeAtPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const pan = panRef.current;
    const mx = (clientX - rect.left - pan.x) / pan.scale;
    const my = (clientY - rect.top - pan.y) / pan.scale;

    for (let index = simNodesRef.current.length - 1; index >= 0; index -= 1) {
      const node = simNodesRef.current[index];
      const radius = getNodeRadius(
        node,
        node.id === selectedNodeId || node.id === effectiveRootNodeId,
        node.id === hoveredNodeId,
      ) + 8;
      const dx = mx - node.x;
      const dy = my - node.y;

      if (dx * dx + dy * dy <= radius * radius) {
        return node;
      }
    }

    return null;
  }

  function handleMouseDown(event: ReactMouseEvent<HTMLCanvasElement>) {
    const node = findNodeAtPoint(event.clientX, event.clientY);
    if (node) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const pan = panRef.current;
      const mx = (event.clientX - rect.left - pan.x) / pan.scale;
      const my = (event.clientY - rect.top - pan.y) / pan.scale;

      dragRef.current = {
        nodeId: node.id,
        offsetX: mx - node.x,
        offsetY: my - node.y,
      };
      node.fx = node.x;
      node.fy = node.y;
      return;
    }

    panRef.current.dragging = true;
    panRef.current.lastX = event.clientX;
    panRef.current.lastY = event.clientY;
  }

  function handleMouseMove(event: ReactMouseEvent<HTMLCanvasElement>) {
    if (dragRef.current) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const pan = panRef.current;
      const mx = (event.clientX - rect.left - pan.x) / pan.scale;
      const my = (event.clientY - rect.top - pan.y) / pan.scale;
      const node = simNodesRef.current.find((entry) => entry.id === dragRef.current?.nodeId);

      if (node) {
        node.fx = mx - dragRef.current.offsetX;
        node.fy = my - dragRef.current.offsetY;
        node.x = node.fx;
        node.y = node.fy;
      }

      return;
    }

    if (panRef.current.dragging) {
      panRef.current.x += event.clientX - panRef.current.lastX;
      panRef.current.y += event.clientY - panRef.current.lastY;
      panRef.current.lastX = event.clientX;
      panRef.current.lastY = event.clientY;
      return;
    }

    const hoveredNode = findNodeAtPoint(event.clientX, event.clientY);
    setHoveredNodeId(hoveredNode?.id ?? null);
  }

  function handleMouseUp() {
    if (dragRef.current) {
      const node = simNodesRef.current.find((entry) => entry.id === dragRef.current?.nodeId);
      if (node) {
        node.fx = null;
        node.fy = null;
      }

      setSelectedNodeId(dragRef.current.nodeId);
      setPanelOpen(true);
      dragRef.current = null;
      return;
    }

    panRef.current.dragging = false;
  }

  function handleWheel(event: ReactWheelEvent<HTMLCanvasElement>) {
    event.preventDefault();

    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;
    const pan = panRef.current;
    const nextScale = clamp(pan.scale * zoomFactor, 0.3, 4.5);

    pan.x = mx - ((mx - pan.x) / pan.scale) * nextScale;
    pan.y = my - ((my - pan.y) / pan.scale) * nextScale;
    pan.scale = nextScale;
    setViewScale(Number(nextScale.toFixed(2)));
  }

  function handleDoubleClick(event: ReactMouseEvent<HTMLCanvasElement>) {
    const node = findNodeAtPoint(event.clientX, event.clientY);
    if (node) {
      focusNode(node.id);
    }
  }

  function renderNodeButton(node: BrainNode, meta?: string) {
    return (
      <button
        key={node.id}
        type="button"
        className={styles.listButton}
        onClick={() => focusNode(node.id)}
      >
        <span
          className={styles.listButtonDot}
          data-type={node.type}
        />
        <span className={styles.listButtonBody}>
          <span className={styles.listButtonTitle}>{node.label}</span>
          <span className={styles.listButtonMeta}>{meta ?? node.type}</span>
        </span>
      </button>
    );
  }

  function renderSuggestionButton(suggestion: BrainNodeSuggestion) {
    return (
      <button
        key={suggestion.suggestedNodeId}
        type="button"
        className={styles.listButton}
        onClick={() => focusNode(suggestion.suggestedNode.id)}
      >
        <span
          className={styles.listButtonDot}
          data-type={suggestion.suggestedNode.type}
        />
        <span className={styles.listButtonBody}>
          <span className={styles.listButtonTitle}>{suggestion.suggestedNode.label}</span>
          <span className={styles.listButtonMeta}>
            {suggestion.reason} / score {suggestion.score}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className={styles.brainPage}>
      <div className={styles.topBar}>
        <div className={styles.topBarMain}>
          <div className={styles.titleBlock}>
            <span className={styles.kicker}>
              {locale === "pt" ? "Mapa neural de conhecimento" : "Knowledge neural map"}
            </span>
            <div className={styles.title}>{t.brain.title}</div>
            <div className={styles.subtitleMeta}>
              {locale === "pt"
                ? "Grafo interativo com IA integrada, conex\u00f5es direcionais e explora\u00e7\u00e3o sem\u00e2ntica."
                : "Interactive graph with integrated AI, directional connections and semantic exploration."}
            </div>
          </div>

          <div className={styles.controlCluster}>
            <div className={styles.searchShell}>
              <input
                className={styles.searchInput}
                placeholder={t.brain.searchPlaceholder}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />

              {showSearchResults ? (
                <div className={styles.searchResults}>
                  {searchLoading ? (
                    <div className={styles.searchState}>
                      {locale === "pt" ? "Buscando no Brain..." : "Searching the Brain..."}
                    </div>
                  ) : (
                    searchResults.map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        className={styles.searchItem}
                        onClick={() => handleSearchSelect(node)}
                      >
                        <span
                          className={styles.searchDot}
                          data-type={node.type}
                        />
                        <span className={styles.searchMeta}>
                          <span className={styles.searchLabel}>{node.label}</span>
                          <span className={styles.searchType}>{node.type}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className={styles.depthControl}>
                <button
                  type="button"
                  className={styles.filterBtn}
                  onClick={() => setDepth((current) => Math.max(1, current - 1))}
                  disabled={depth <= 1}
              >
                -1
              </button>
              <span className={styles.depthBadge}>
                {locale === "pt" ? `Profundidade ${depth}` : `Depth ${depth}`}
              </span>
                <button
                  type="button"
                  className={styles.filterBtn}
                  onClick={() => setDepth((current) => Math.min(MAX_GRAPH_DEPTH, current + 1))}
                  disabled={depth >= MAX_GRAPH_DEPTH}
                >
                  +1
                </button>
              </div>

            <button
              type="button"
              className={showLabels ? styles.filterBtnActive : styles.filterBtn}
              onClick={() => setShowLabels((current) => !current)}
              title={locale === "pt" ? "Alternar r\u00f3tulos (L)" : "Toggle labels (L)"}
            >
              {locale === "pt" ? "R\u00f3tulos" : "Labels"}
            </button>

            <button
              type="button"
              className={showEdgeLabels ? styles.filterBtnActive : styles.filterBtn}
              onClick={() => setShowEdgeLabels((current) => !current)}
            >
              {locale === "pt" ? "Arestas" : "Edges"}
            </button>

            <button
              type="button"
              className={panelOpen ? styles.filterBtnActive : styles.filterBtn}
              onClick={() => setPanelOpen((current) => !current)}
              title={locale === "pt" ? "Alternar painel (P)" : "Toggle panel (P)"}
            >
              {locale === "pt" ? "Painel" : "Panel"}
            </button>

            <button type="button" className={styles.filterBtn} onClick={clearBrainFilters}>
              {locale === "pt" ? "Limpar" : "Clear"}
            </button>
          </div>
        </div>

        <div className={styles.statsBar}>
          <div className={styles.scoreCard}>
            <span className={styles.scoreLabel}>Brain score</span>
            <span className={styles.scoreValue}>{intelligenceScore}</span>
            <span className={styles.scoreNote}>
              {locale === "pt" ? "sa\u00fade estrutural e mem\u00f3ria" : "structural health and memory"}
            </span>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statLabel}>{t.brain.stats.nodes}</span>
            <span className={styles.statValue}>{graphMetrics?.nodeCount ?? "-"}</span>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statLabel}>{t.brain.stats.edges}</span>
            <span className={styles.statValue}>{graphMetrics?.edgeCount ?? "-"}</span>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statLabel}>{t.brain.stats.memories}</span>
            <span className={styles.statValue}>{graphMetrics?.memoryCount ?? "-"}</span>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statLabel}>{locale === "pt" ? "densidade" : "density"}</span>
            <span className={styles.statValue}>
              {graphMetrics ? graphMetrics.density.toFixed(3) : "-"}
            </span>
          </div>
        </div>

        {/* Workspace mode selector */}
        <div className={styles.workspaceBar}>
          {Object.entries(WORKSPACE_MODES).map(([key, mode]) => (
            <button
              key={key}
              type="button"
              className={workspaceMode === key ? styles.workspaceBtnActive : styles.workspaceBtn}
              onClick={() => setWorkspaceMode(key)}
            >
              {locale === "pt" ? mode.label : mode.labelEn}
            </button>
          ))}
          <span className={styles.workspaceSep} />
          <button
            type="button"
            className={showExplorer ? styles.workspaceBtnActive : styles.workspaceBtn}
            onClick={() => setShowExplorer((v) => !v)}
            title="E"
          >
            {locale === "pt" ? "Mapa neural" : "Neural map"}
          </button>
          <button
            type="button"
            className={styles.workspaceBtn}
            onClick={() => { setShowPalette(true); setPaletteQuery(""); }}
            title="Ctrl+K"
          >
            {locale === "pt" ? "Comandos Ctrl+K" : "Commands Ctrl+K"}
          </button>
          <span className={styles.workspaceSep} />
          <button
            type="button"
            className={syncLoading ? styles.workspaceBtnActive : styles.workspaceBtn}
            onClick={handleSync}
            disabled={syncLoading}
            title={locale === "pt" ? "Sincronizar todos os n\u00f3s do sistema com o Brain" : "Sync all system entities to Brain"}
          >
            {syncLoading
              ? (locale === "pt" ? "Sincronizando..." : "Syncing...")
              : syncResult
                ? (locale === "pt" ? `OK ${syncResult.nodes} n\u00f3s` : `OK ${syncResult.nodes} nodes`)
                : (locale === "pt" ? "Sincronizar" : "Sync")}
          </button>
        </div>

        <div className={styles.filterRow}>
          {nodeTypes.map((type) => (
            <button
              key={type}
              type="button"
              className={filterType === type ? styles.filterBtnActive : styles.filterBtn}
              onClick={() => setFilterType((current) => (current === type ? null : type))}
              data-type={filterType === type ? type : undefined}
            >
              <span
                className={styles.filterDot}
                data-type={type}
              />
              {type}
            </button>
          ))}

          {effectiveRootNodeId ? (
            <button
              type="button"
              className={styles.filterBtn}
              onClick={() => {
                setRootNodeId(null);
                resetViewport();
              }}
            >
              {locale === "pt" ? "Soltar raiz" : "Release root"}
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.mainArea}>
        <div className={styles.explorerShell}>
          {showExplorer ? (
            <div className={styles.explorerPanel}>
              <div className={styles.explorerHeader}>
                <div className={styles.explorerHeading}>
                  <span className={styles.explorerTitle}>
                    {locale === "pt" ? "Mapa neural" : "Neural map"}
                  </span>
                  <span className={styles.explorerCount}>
                    {nodes.length} {locale === "pt" ? "n\u00f3s" : "nodes"}
                  </span>
                </div>
              </div>
              <div className={styles.explorerBody}>
                {Array.from(nodesByType.entries())
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([type, typeNodes]) => {
                    const isCollapsed = explorerCollapsed.has(type);
                    return (
                      <div key={type} className={styles.explorerGroup}>
                        <button
                          type="button"
                          className={styles.explorerGroupHeader}
                          onClick={() =>
                            setExplorerCollapsed((prev) => {
                              const next = new Set(prev);
                              if (next.has(type)) next.delete(type);
                              else next.add(type);
                              return next;
                            })
                          }
                        >
                          <span
                            className={styles.explorerGroupDot}
                            data-type={type}
                          />
                          <span className={styles.explorerGroupLabel}>{type}</span>
                          <span className={styles.explorerGroupCount}>{typeNodes.length}</span>
                          <span className={styles.explorerGroupChevron}>
                            {isCollapsed ? ">" : "v"}
                          </span>
                        </button>
                        {!isCollapsed && (
                          <div className={styles.explorerItems}>
                            {typeNodes
                              .sort((a, b) => a.label.localeCompare(b.label))
                              .map((node) => (
                                <button
                                  key={node.id}
                                  type="button"
                                  className={
                                    selectedNodeId === node.id
                                      ? styles.explorerItemActive
                                      : styles.explorerItem
                                  }
                                  onClick={() => focusNode(node.id)}
                                  title={node.description ?? node.label}
                                >
                                  {node.label}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}

          <div className={`${styles.sideRail} ${styles.sideRailLeft}`}>
            <button
              type="button"
              className={styles.sideRailButton}
              onClick={() => setShowExplorer((value) => !value)}
              title={
                showExplorer
                  ? locale === "pt"
                    ? "Recolher mapa neural"
                    : "Collapse neural map"
                  : locale === "pt"
                    ? "Expandir mapa neural"
                    : "Expand neural map"
              }
            >
              <span className={styles.sideRailArrow}>{showExplorer ? "<" : ">"}</span>
              <span className={styles.sideRailLabel}>{locale === "pt" ? "Mapa" : "Map"}</span>
            </button>
          </div>
        </div>

        <div className={styles.graphContainer}>
          <div className={styles.graphHud}>
            <div className={styles.graphHudGroup}>
              <span className={styles.hudPill}>
                {activeRootLabel
                  ? `${locale === "pt" ? "Raiz" : "Root"}: ${activeRootLabel}`
                  : locale === "pt"
                    ? "C\u00e9rebro completo"
                    : "Global graph"}
              </span>
              <span className={styles.hudPill}>
                {filteredNodes.length} {locale === "pt" ? "n\u00f3s" : "nodes"}
              </span>
              <span className={styles.hudPill}>
                {filteredEdges.length} {locale === "pt" ? "arestas" : "edges"}
              </span>
            </div>

            <div className={styles.graphHudGroup}>
              <button type="button" className={styles.hudButton} onClick={zoomToFit} title="F">
                {locale === "pt" ? "Ajustar" : "Fit"}
              </button>
              <button type="button" className={styles.hudButton} onClick={resetViewport}>
                {locale === "pt" ? "Centralizar" : "Center"}
              </button>
              <button type="button" className={styles.hudButton}>
                {`${Math.round(viewScale * 100)}%`}
              </button>
            </div>
          </div>

          {graphLoading ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon} />
              <span>{t.common.loading}</span>
            </div>
          ) : filteredNodes.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon} />
              <span>{t.brain.empty.title}</span>
              <span className={styles.emptyDescription}>{t.brain.empty.description}</span>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className={`${styles.graphCanvas} ${hoveredNodeId ? styles.graphCanvasHover : ""}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                handleMouseUp();
                setHoveredNodeId(null);
              }}
              onWheel={handleWheel}
              onDoubleClick={handleDoubleClick}
            />
          )}

          {/* Color legend by type */}
          <div className={styles.graphLegend}>
            <div className={styles.legendTitle}>
              {locale === "pt" ? "Tipos de n\u00f3" : "Node types"}
            </div>
            {NODE_TYPES.filter((type) => nodeTypes.includes(type)).map((type) => (
              <div key={type} className={styles.legendRow}>
                <span
                  className={styles.legendSwatchType}
                  data-type={type}
                />
                <span className={styles.legendLabel}>{type}</span>
              </div>
            ))}
            <div className={styles.legendRow}>
              <span className={styles.legendSwatchFocus} />
              <span className={styles.legendLabel}>
                {locale === "pt" ? "foco atual" : "active focus"}
              </span>
            </div>
            <div className={styles.legendSeparator} />
            <div className={styles.legendShortcuts}>
              <span>F: fit</span>
              <span>L: labels</span>
              <span>{locale === "pt" ? "E: mapa" : "E: explorer"}</span>
              <span>{locale === "pt" ? "Ctrl+K: comandos" : "Ctrl+K: palette"}</span>
              <span>{locale === "pt" ? "Esc: limpar" : "Esc: clear"}</span>
            </div>
          </div>
        </div>

        <div className={styles.panelShell}>
          <div className={`${styles.sideRail} ${styles.sideRailRight}`}>
            <button
              type="button"
              className={styles.sideRailButton}
              onClick={() => setPanelOpen((value) => !value)}
              title={
                isPanelVisible
                  ? locale === "pt"
                    ? "Recolher detalhes"
                    : "Collapse details"
                  : locale === "pt"
                    ? "Expandir detalhes"
                    : "Expand details"
              }
            >
              <span className={styles.sideRailArrow}>{isPanelVisible ? ">" : "<"}</span>
              <span className={styles.sideRailLabel}>{locale === "pt" ? "Detalhes" : "Details"}</span>
            </button>
          </div>

          <div className={isPanelVisible ? styles.sidePanel : styles.sidePanelHidden}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleWrap}>
              <h2 className={styles.panelTitle}>
                {selectedNode
                  ? selectedNode.label
                  : locale === "pt"
                    ? "Panorama neural"
                    : "Neural overview"}
              </h2>
              <p className={styles.panelSubtitle}>
                {selectedNode
                  ? `${selectedNode.type}${selectedNode.refId ? ` / ${selectedNode.refId.slice(0, 8)}` : ""}`
                  : locale === "pt"
                    ? "M\u00e9tricas, sa\u00fade e m\u00f3dulos mais conectados do c\u00e9rebro."
                    : "Metrics, health and the most connected system modules."}
              </p>
            </div>

            <button
              type="button"
              className={styles.panelCloseBtn}
              onClick={() => setPanelOpen(false)}
              title={locale === "pt" ? "Recolher detalhes" : "Collapse details"}
            >
              {locale === "pt" ? "Recolher" : "Collapse"}
            </button>
          </div>

          {/* Tab navigation */}
          <div className={styles.panelTabs}>
            <button
              type="button"
              className={activeTab === "info" ? styles.panelTabActive : styles.panelTab}
              onClick={() => setActiveTab("info")}
            >
              {locale === "pt" ? "Contexto" : "Context"}
            </button>
            <button
              type="button"
              className={activeTab === "ask" ? styles.panelTabActive : styles.panelTab}
              onClick={() => setActiveTab("ask")}
            >
              {locale === "pt" ? "Perguntar \u00e0 IA" : "Ask AI"}
            </button>
            {selectedNodeId ? (
              <button
                type="button"
                className={activeTab === "timeline" ? styles.panelTabActive : styles.panelTab}
                onClick={() => setActiveTab("timeline")}
              >
                {locale === "pt" ? "Hist\u00f3rico" : "Timeline"}
                {nodeTimeline.length > 0 ? (
                  <span className={styles.tabBadge}>{nodeTimeline.length}</span>
                ) : null}
              </button>
            ) : null}
            <button
              type="button"
              className={activeTab === "create" ? styles.panelTabActive : styles.panelTab}
              onClick={() => setActiveTab("create")}
            >
              + {locale === "pt" ? "N\u00f3" : "Node"}
            </button>
          </div>

          {/* Ask AI tab */}
          {activeTab === "ask" ? (
            <div className={styles.chatPanel}>
              <div className={styles.chatContext}>
                {selectedNode ? (
                  <span className={styles.chatContextBadge}>
                    {locale === "pt" ? "Contexto" : "Context"}: {selectedNode.label} ({selectedNode.type})
                  </span>
                ) : (
                  <span className={styles.chatContextBadge}>
                    {locale === "pt" ? "Contexto: c\u00e9rebro completo" : "Context: global graph"} | {graphMetrics?.nodeCount ?? 0} {locale === "pt" ? "n\u00f3s" : "nodes"}
                  </span>
                )}
                {chatMessages.length > 0 ? (
                  <button
                    type="button"
                    className={styles.chatClearBtn}
                    onClick={() => setChatMessages([])}
                  >
                    {locale === "pt" ? "Limpar" : "Clear"}
                  </button>
                ) : null}
              </div>

              <div className={styles.chatMessages} ref={chatContainerRef}>
                {chatMessages.length === 0 ? (
                  <div className={styles.chatEmpty}>
                    <p className={styles.chatEmptyTitle}>
                      {locale === "pt" ? "Pergunte ao Brain" : "Ask the Brain"}
                    </p>
                    <p className={styles.chatEmptyMeta}>
                      {locale === "pt"
                        ? "A IA usa o grafo de conhecimento como contexto para responder."
                        : "AI uses the knowledge graph as context to answer."}
                    </p>
                    <div className={styles.chatSuggestions}>
                      {(locale === "pt"
                        ? [
                            "Quais n\u00f3s t\u00eam mais conex\u00f5es?",
                            "Quais defeitos afetam este m\u00f3dulo?",
                            "Sugira conex\u00f5es que est\u00e3o faltando",
                            "Qual \u00e9 a sa\u00fade geral do grafo?",
                          ]
                        : [
                            "Which nodes have the most connections?",
                            "What defects affect this module?",
                            "Suggest missing connections",
                            "What is the overall graph health?",
                          ]
                      ).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          className={styles.chatSuggestionBtn}
                          onClick={() => sendChatMessage(suggestion)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={msg.role === "user" ? styles.chatMsgUser : styles.chatMsgAssistant}
                    >
                      <span className={styles.chatMsgRole}>
                        {msg.role === "user"
                          ? locale === "pt" ? "Voc\u00ea" : "You"
                          : "Brain AI"}
                      </span>
                      <p className={styles.chatMsgContent}>
                        {typeof msg.content === "string" ? msg.content : ""}
                      </p>
                    </div>
                  ))
                )}
                {chatLoading ? (
                  <div className={styles.chatLoading}>
                    <span className={styles.chatLoadingDot} />
                    <span className={styles.chatLoadingDot} />
                    <span className={styles.chatLoadingDot} />
                  </div>
                ) : null}
              </div>

              <form
                className={styles.chatForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChatMessage(chatInput);
                }}
              >
                <input
                  className={styles.chatInput}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={
                    locale === "pt"
                      ? "Pergunte sobre o grafo..."
                      : "Ask about the graph..."
                  }
                  disabled={chatLoading}
                />
                <button
                  type="submit"
                  className={styles.chatSendBtn}
                  disabled={chatLoading || !chatInput.trim()}
                >
                  {locale === "pt" ? "Enviar" : "Send"}
                </button>
              </form>
            </div>
          ) : activeTab === "timeline" ? (
            /* Timeline tab */
            <div className={styles.timelinePanel}>
              <div className={styles.panelSection}>
                <p className={styles.panelSectionTitle}>
                  {locale === "pt" ? "Linha do tempo" : "Timeline"}
                  {selectedNode ? ` - ${selectedNode.label}` : ""}
                </p>
                {nodeTimeline.length === 0 ? (
                  <p className={styles.panelHeroMeta}>
                    {locale === "pt"
                      ? "Nenhum registro de auditoria para este n\u00f3."
                      : "No audit records for this node."}
                  </p>
                ) : (
                  <div className={styles.timelineList}>
                    {nodeTimeline.map((entry) => (
                      <div key={entry.id} className={styles.timelineItem}>
                        <div className={styles.timelineDotWrap}>
                          <span className={styles.timelineDot} />
                          <span className={styles.timelineLine} />
                        </div>
                        <div className={styles.timelineContent}>
                          <p className={styles.timelineAction}>{entry.action}</p>
                          {entry.reason ? (
                            <p className={styles.timelineReason}>{entry.reason}</p>
                          ) : null}
                          <span className={styles.timelineDate}>
                            {formatDate(entry.timestamp, locale)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "create" ? (
            /* Create node tab */
            <div className={styles.createPanel}>
              <div className={styles.panelSection}>
                <p className={styles.panelSectionTitle}>
                  {locale === "pt" ? "Criar novo n\u00f3" : "Create new node"}
                </p>
                {selectedNode ? (
                  <p className={styles.createHint}>
                    {locale === "pt"
                      ? `Novo n\u00f3 a partir de ${selectedNode.label}.`
                      : `New node starting from ${selectedNode.label}.`}
                  </p>
                ) : (
                  <p className={styles.createHint}>
                    {locale === "pt"
                      ? "Crie um m\u00f3dulo novo e depois fixe-o no mapa."
                      : "Create a new module and then pin it in the map."}
                  </p>
                )}

                <div className={styles.createForm}>
                  <label className={styles.createLabel}>
                    {locale === "pt" ? "Tipo" : "Type"}
                    <select
                      className={styles.createSelect}
                      value={createNodeType}
                      onChange={(e) => setCreateNodeType(e.target.value)}
                    >
                      {NODE_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.createLabel}>
                    {locale === "pt" ? "Nome / Label" : "Name / Label"}
                    <input
                      className={styles.createInput}
                      value={createNodeLabel}
                      onChange={(e) => setCreateNodeLabel(e.target.value)}
                      placeholder={locale === "pt" ? "Nome do n\u00f3..." : "Node name..."}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateNode();
                      }}
                    />
                  </label>

                  <label className={styles.createLabel}>
                    {locale === "pt" ? "Descri\u00e7\u00e3o (opcional)" : "Description (optional)"}
                    <textarea
                      className={styles.createTextarea}
                      value={createNodeDesc}
                      onChange={(e) => setCreateNodeDesc(e.target.value)}
                      placeholder={locale === "pt" ? "Descreva o n\u00f3..." : "Describe the node..."}
                      rows={3}
                    />
                  </label>

                  {selectedNode ? (
                    <>
                      <label className={styles.createToggle}>
                        <input
                          type="checkbox"
                          checked={createNodeAttachToSelection}
                          onChange={(e) => setCreateNodeAttachToSelection(e.target.checked)}
                        />
                        <span className={styles.createToggleText}>
                          {locale === "pt"
                            ? `Conectar ao n\u00f3 selecionado: ${selectedNode.label}`
                            : `Connect to selected node: ${selectedNode.label}`}
                        </span>
                      </label>

                      {createNodeAttachToSelection ? (
                        <label className={styles.createLabel}>
                          {locale === "pt" ? "Tipo de conex\u00e3o" : "Connection type"}
                          <select
                            className={styles.createSelect}
                            value={createNodeLinkType}
                            onChange={(e) => setCreateNodeLinkType(e.target.value)}
                          >
                            {CREATE_EDGE_TYPES.map((edgeType) => (
                              <option key={edgeType.value} value={edgeType.value}>
                                {locale === "pt" ? edgeType.labelPt : edgeType.labelEn}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </>
                  ) : null}

                  {createNodeError ? (
                    <p className={styles.createError}>{createNodeError}</p>
                  ) : null}

                  <div className={styles.createPreview}>
                    <span
                      className={styles.createPreviewDot}
                      data-type={createNodeType}
                    />
                    <span>{createNodeLabel || (locale === "pt" ? "Pr\u00e9via do n\u00f3" : "Node preview")}</span>
                    <span className={styles.createPreviewType}>{createNodeType}</span>
                  </div>

                  <button
                    type="button"
                    className={styles.createSubmitBtn}
                    onClick={handleCreateNode}
                    disabled={createNodeLoading || !createNodeLabel.trim()}
                  >
                    {createNodeLoading
                      ? (locale === "pt" ? "Criando..." : "Creating...")
                      : (locale === "pt" ? "Criar n\u00f3" : "Create node")}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Info tab */
            <>
              {!selectedNode ? (
                <>
                  <div className={`${styles.panelSection} ${styles.panelSectionHero}`}>
                    <p className={styles.panelSectionTitle}>
                      {locale === "pt" ? "Sinal principal" : "Primary signal"}
                    </p>
                    <div className={styles.panelHeroValue}>{intelligenceScore}</div>
                    <div className={styles.panelHeroMeta}>
                      {locale === "pt"
                        ? "score sint\u00e9tico do Brain, combinando densidade, ciclos, mem\u00f3ria e conectividade"
                        : "synthetic Brain score combining density, cycles, memory and connectivity"}
                    </div>
                    <div className={styles.metricGrid}>
                      <div className={styles.metricCell}>
                        <span className={styles.metricName}>
                          {locale === "pt" ? "grau m\u00e9dio" : "avg degree"}
                        </span>
                        <span className={styles.metricValue}>
                          {graphMetrics?.averageDegree ?? "-"}
                        </span>
                      </div>
                      <div className={styles.metricCell}>
                        <span className={styles.metricName}>
                          {locale === "pt" ? "maior componente" : "largest component"}
                        </span>
                        <span className={styles.metricValue}>
                          {graphMetrics?.largestComponent ?? "-"}
                        </span>
                      </div>
                      <div className={styles.metricCell}>
                        <span className={styles.metricName}>
                          {locale === "pt" ? "ciclos" : "cycles"}
                        </span>
                        <span className={styles.metricValue}>
                          {graphMetrics?.cyclesDetected ?? "-"}
                        </span>
                      </div>
                      <div className={styles.metricCell}>
                        <span className={styles.metricName}>
                          {locale === "pt" ? "n\u00f3s \u00f3rf\u00e3os" : "orphan nodes"}
                        </span>
                        <span className={styles.metricValue}>
                          {graphMetrics?.orphanedNodes ?? "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.panelSection}>
                    <p className={styles.panelSectionTitle}>
                      {locale === "pt" ? "Alertas e leitura" : "Alerts and reading"}
                    </p>
                    {alerts.length > 0 ? (
                      <div className={styles.alertList}>
                        {alerts.map((alert) => (
                          <div key={alert} className={styles.alertItem}>
                            <span className={styles.alertDot} />
                            <span>{alert}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.panelHeroMeta}>
                        {locale === "pt"
                          ? "Sem alertas estruturais no momento. O grafo est\u00e1 est\u00e1vel."
                          : "No structural alerts right now. The graph is stable."}
                      </div>
                    )}
                  </div>

                  <div className={styles.panelSection}>
                    <p className={styles.panelSectionTitle}>
                      {locale === "pt" ? "Hubs principais" : "Top hubs"}
                    </p>
                    <div className={styles.nodeList}>
                      {topConnectedNodes.map((node) => (
                        <button
                          key={node.id}
                          type="button"
                          className={styles.listButton}
                          onClick={() => focusNode(node.id)}
                        >
                          <span
                            className={styles.listButtonDot}
                            data-type={node.type}
                          />
                          <span className={styles.listButtonBody}>
                            <span className={styles.listButtonTitle}>{node.label}</span>
                            <span className={styles.listButtonMeta}>
                              {node.type} / {node.totalDegree} {locale === "pt" ? "conex\u00f5es" : "connections"}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.panelSection}>
                    <p className={styles.panelSectionTitle}>
                      {locale === "pt" ? "Tipos dominantes" : "Top node types"}
                    </p>
                    <div className={styles.metadataList}>
                      {topNodeTypes.map((item) => (
                        <div key={item.type} className={styles.metadataItem}>
                          <span className={styles.metadataKey}>
                            <span
                              className={styles.filterDot}
                              data-type={item.type}
                            />
                            {item.type}
                          </span>
                          <span className={styles.metadataValue}>{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.panelSection}>
                    <p className={styles.panelSectionTitle}>
                      {locale === "pt" ? "Atividade recente" : "Recent activity"}
                    </p>
                    <div className={styles.nodeList}>
                      {recentActivity.map((activity) => (
                        <div key={activity.id} className={styles.memoryCard}>
                          <p className={styles.memoryTitle}>{activity.action}</p>
                          <p className={styles.memorySummary}>
                            {activity.reason ?? activity.entityType}
                          </p>
                          <span className={styles.memoryBadgeDynamic}>
                            {formatDate(activity.createdAt, locale)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className={`${styles.panelSection} ${styles.panelSectionHero}`}>
                    <p className={styles.panelSectionTitle}>
                      {locale === "pt" ? "Pulso do n\u00f3" : "Node pulse"}
                    </p>
                    <div className={styles.pillRow}>
                      <span
                        className={styles.pill}
                        data-node-type={selectedNode.type}
                      >
                        {selectedNode.type}
                      </span>
                      {selectedNode.refType ? (
                        <span className={styles.pillMuted}>{selectedNode.refType}</span>
                      ) : null}
                    </div>
                    <div className={styles.metricGrid}>
                      <div className={styles.metricCell}>
                        <span className={styles.metricName}>{locale === "pt" ? "entrada" : "incoming"}</span>
                        <span className={styles.metricValue}>{nodeContext?.stats?.inDegree ?? 0}</span>
                      </div>
                      <div className={styles.metricCell}>
                        <span className={styles.metricName}>{locale === "pt" ? "sa\u00edda" : "outgoing"}</span>
                        <span className={styles.metricValue}>{nodeContext?.stats?.outDegree ?? 0}</span>
                      </div>
                      <div className={styles.metricCell}>
                        <span className={styles.metricName}>{locale === "pt" ? "mem\u00f3rias" : "memories"}</span>
                        <span className={styles.metricValue}>{relatedMemories.length}</span>
                      </div>
                      <div className={styles.metricCell}>
                        <span className={styles.metricName}>{locale === "pt" ? "influ\u00eancia" : "influence"}</span>
                        <span className={styles.metricValue}>
                          {nodeContext?.influence?.influenceScore != null
                            ? `${nodeContext.influence.influenceScore.toFixed(1)}%`
                            : "-"}
                        </span>
                      </div>
                    </div>
                    <div className={styles.panelHeroMeta}>
                      {locale === "pt"
                        ? `Import\u00e2ncia estrutural ${Math.round((nodeContext?.stats?.importance ?? 0) * 100)} / ranking ${nodeContext?.influence?.rankedPosition ?? "-"}`
                        : `Structural importance ${Math.round((nodeContext?.stats?.importance ?? 0) * 100)} / rank ${nodeContext?.influence?.rankedPosition ?? "-"}`}
                    </div>
                    <div className={styles.panelActionRow}>
                      <button
                        type="button"
                        className={styles.panelActionBtn}
                        onClick={() => {
                          setCreateNodeAttachToSelection(true);
                          setActiveTab("create");
                        }}
                      >
                        {locale === "pt" ? "Adicionar n\u00f3 ligado" : "Add linked node"}
                      </button>
                      <button
                        type="button"
                        className={styles.panelActionBtn}
                        onClick={() => {
                          setRootNodeId(selectedNode.id);
                          resetViewport();
                        }}
                      >
                        {locale === "pt" ? "Fixar como raiz" : "Pin as root"}
                      </button>
                      <button
                        type="button"
                        className={styles.panelActionBtnDanger}
                        onClick={handleDeleteNode}
                        disabled={deleteNodeLoading}
                      >
                        {deleteNodeLoading
                          ? locale === "pt"
                            ? "Excluindo..."
                            : "Deleting..."
                          : locale === "pt"
                            ? "Excluir n\u00f3"
                            : "Delete node"}
                      </button>
                    </div>
                    {deleteNodeError ? (
                      <p className={styles.inlineError}>{deleteNodeError}</p>
                    ) : null}
                  </div>

                  {selectedNode.description ? (
                    <div className={styles.panelSection}>
                      <p className={styles.panelSectionTitle}>
                        {locale === "pt" ? "Descri\u00e7\u00e3o" : "Description"}
                      </p>
                      <p className={styles.memorySummary}>{selectedNode.description}</p>
                    </div>
                  ) : null}

                  <div className={styles.panelSection}>
                    <p className={styles.panelSectionTitle}>
                      {locale === "pt" ? "Linha do contexto" : "Context line"}
                    </p>
                    <div className={styles.metricGrid}>
                      <div className={styles.metricCell}>
                        <span className={styles.metricName}>{locale === "pt" ? "ancestrais" : "ancestors"}</span>
                        <span className={styles.metricValue}>{ancestors.length}</span>
                      </div>
                      <div className={styles.metricCell}>
                        <span className={styles.metricName}>{locale === "pt" ? "descendentes" : "descendants"}</span>
                        <span className={styles.metricValue}>{descendants.length}</span>
                      </div>
                      <div className={styles.metricCell}>
                        <span className={styles.metricName}>{locale === "pt" ? "impacto" : "impact"}</span>
                        <span className={styles.metricValue}>{impactedNodes.length}</span>
                      </div>
                      <div className={styles.metricCell}>
                        <span className={styles.metricName}>{locale === "pt" ? "criado" : "created"}</span>
                        <span className={styles.metricValue}>
                          {formatDate(nodeContext?.stats?.createdAt, locale)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {suggestions.length > 0 ? (
                    <div className={styles.panelSection}>
                      <p className={styles.panelSectionTitle}>
                        {locale === "pt" ? "Conex\u00f5es sugeridas" : "Suggested links"}
                      </p>
                      <div className={styles.nodeList}>
                        {suggestions.slice(0, 6).map(renderSuggestionButton)}
                      </div>
                    </div>
                  ) : null}

                  {nodeNeighbors.length > 0 ? (
                    <div className={styles.panelSection}>
                      <p className={styles.panelSectionTitle}>
                        {t.brain.panel.connections} ({nodeOutgoing.length} {locale === "pt" ? "sa\u00edda" : "out"}, {nodeIncoming.length} {locale === "pt" ? "entrada" : "in"})
                      </p>
                      <div className={styles.nodeList}>
                        {nodeNeighbors.slice(0, 16).map((neighbor) => {
                          const outEdge = nodeOutgoing.find((edge) => edge.toId === neighbor.id);
                          const inEdge = nodeIncoming.find((edge) => edge.fromId === neighbor.id);
                          const edgeType = outEdge?.type ?? inEdge?.type ?? neighbor.type;
                          return renderNodeButton(neighbor, edgeType);
                        })}
                      </div>
                    </div>
                  ) : null}

                  {relatedMemories.length > 0 ? (
                    <div className={styles.panelSection}>
                      <p className={styles.panelSectionTitle}>
                        {locale === "pt" ? "Mem\u00f3ria conectada" : "Connected memory"} ({relatedMemories.length})
                      </p>
                      <div className={styles.nodeList}>
                        {relatedMemories.slice(0, 8).map((memory) => {
                          return (
                            <div key={memory.id} className={styles.memoryCard}>
                              <p className={styles.memoryTitle}>{memory.title}</p>
                              <p className={styles.memorySummary}>{memory.summary}</p>
                              <span
                                className={styles.memoryBadgeDynamic}
                                data-memory-type={memory.memoryType}
                              >
                                {memory.memoryType} / I{memory.importance}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {similarNodes.length > 0 ? (
                    <div className={styles.panelSection}>
                      <p className={styles.panelSectionTitle}>
                        {locale === "pt" ? "N\u00f3s similares" : "Similar nodes"}
                      </p>
                      <div className={styles.nodeList}>
                        {similarNodes.slice(0, 6).map((node) => renderNodeButton(node))}
                      </div>
                    </div>
                  ) : null}

                  {impactedNodes.length > 0 ? (
                    <div className={styles.panelSection}>
                      <p className={styles.panelSectionTitle}>
                        {locale === "pt" ? "Impacto observado" : "Observed impact"} ({impactedNodes.length})
                      </p>
                      <div className={styles.nodeList}>
                        {impactPaths.slice(0, 8).map((path) => {
                          const impactedNode = impactedNodes.find((node) => node.id === path.nodeId);
                          if (!impactedNode) return null;
                          return renderNodeButton(
                            impactedNode,
                            `${path.edgeType} / d${path.distance}`,
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {ancestors.length > 0 ? (
                    <div className={styles.panelSection}>
                      <p className={styles.panelSectionTitle}>
                        {locale === "pt" ? "Origem e contexto" : "Origin and context"}
                      </p>
                      <div className={styles.nodeList}>
                        {ancestors.slice(0, 6).map((node) =>
                          renderNodeButton(node, locale === "pt" ? "ancestral" : "ancestor"),
                        )}
                      </div>
                    </div>
                  ) : null}

                  {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 ? (
                    <div className={styles.panelSection}>
                      <p className={styles.panelSectionTitle}>
                        {locale === "pt" ? "Metadados" : "Metadata"}
                      </p>
                      <div className={styles.metadataList}>
                        {Object.entries(selectedNode.metadata).map(([key, value]) => (
                          <div key={key} className={styles.metadataItem}>
                            <span className={styles.metadataKey}>{key}</span>
                            <span className={styles.metadataValue}>{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
        </div>
      </div>

      {/* Command Palette Overlay */}
      {showPalette ? (
        <div
          className={styles.paletteOverlay}
          onClick={() => setShowPalette(false)}
          role="dialog"
          aria-modal
        >
          <div
            className={styles.paletteModal}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={paletteInputRef}
              className={styles.paletteInput}
              placeholder={
                locale === "pt"
                  ? "Buscar n\u00f3s, digitar comandos..."
                  : "Search nodes or type commands..."
              }
              value={paletteQuery}
              onChange={(e) => setPaletteQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowPalette(false);
              }}
            />

            <div className={styles.paletteResults}>
              {/* Commands */}
              {(paletteQuery === "" || "criar n\u00f3 create node".includes(paletteQuery.toLowerCase())) ? (
                <div className={styles.paletteSection}>
                  <span className={styles.paletteSectionTitle}>
                    {locale === "pt" ? "Comandos" : "Commands"}
                  </span>
                  {[
                    {
                      id: "create",
                      label: locale === "pt" ? "Criar novo n\u00f3" : "Create new node",
                      shortcut: "C",
                      action: () => { setActiveTab("create"); setPanelOpen(true); },
                    },
                    {
                      id: "fit",
                      label: locale === "pt" ? "Zoom to fit" : "Zoom to fit",
                      shortcut: "F",
                      action: () => zoomToFit(),
                    },
                    {
                      id: "labels",
                      label: locale === "pt" ? "Alternar r\u00f3tulos" : "Toggle labels",
                      shortcut: "L",
                      action: () => setShowLabels((v) => !v),
                    },
                    {
                      id: "explorer",
                      label: locale === "pt" ? "Alternar mapa neural" : "Toggle neural map",
                      shortcut: "E",
                      action: () => setShowExplorer((v) => !v),
                    },
                    {
                      id: "clear",
                      label: locale === "pt" ? "Limpar sele\u00e7\u00e3o" : "Clear selection",
                      shortcut: "Esc",
                      action: () => clearBrainFilters(),
                    },
                  ]
                    .filter((cmd) =>
                      paletteQuery === "" ||
                      cmd.label.toLowerCase().includes(paletteQuery.toLowerCase()),
                    )
                    .map((cmd) => (
                      <button
                        key={cmd.id}
                        type="button"
                        className={styles.paletteItem}
                        onClick={() => { cmd.action(); setShowPalette(false); }}
                      >
                        <span className={styles.paletteItemIcon}>K</span>
                        <span className={styles.paletteItemLabel}>{cmd.label}</span>
                        <span className={styles.paletteItemShortcut}>{cmd.shortcut}</span>
                      </button>
                    ))}
                </div>
              ) : null}

              {/* Workspace shortcuts */}
              {paletteQuery === "" ? (
                <div className={styles.paletteSection}>
                  <span className={styles.paletteSectionTitle}>
                    {locale === "pt" ? "Workspaces" : "Workspaces"}
                  </span>
                  {Object.entries(WORKSPACE_MODES).map(([key, mode]) => (
                    <button
                      key={key}
                      type="button"
                      className={`${styles.paletteItem} ${workspaceMode === key ? styles.paletteItemActive : ""}`}
                      onClick={() => { setWorkspaceMode(key); setShowPalette(false); }}
                    >
                      <span className={styles.paletteItemIcon}>*</span>
                      <span className={styles.paletteItemLabel}>
                        {locale === "pt" ? mode.label : mode.labelEn}
                      </span>
                      {workspaceMode === key ? (
                        <span className={styles.paletteItemShortcut}>OK ativo</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Node search results */}
              {paletteNodes.length > 0 ? (
                <div className={styles.paletteSection}>
                  <span className={styles.paletteSectionTitle}>
                    {locale === "pt" ? "N\u00f3s" : "Nodes"}
                  </span>
                  {paletteNodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      className={styles.paletteItem}
                      onClick={() => { focusNode(node.id); setShowPalette(false); setPaletteQuery(""); }}
                    >
                      <span
                        className={styles.paletteItemDot}
                        data-type={node.type}
                      />
                      <span className={styles.paletteItemLabel}>{node.label}</span>
                      <span className={styles.paletteItemMeta}>{node.type}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {paletteQuery !== "" && paletteNodes.length === 0 ? (
                <div className={styles.paletteEmpty}>
                  {locale === "pt" ? "Nenhum resultado encontrado." : "No results found."}
                </div>
              ) : null}
            </div>

            <div className={styles.paletteFooter}>
              <span>setas: navegar</span>
              <span>Enter selecionar</span>
              <span>Esc fechar</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
