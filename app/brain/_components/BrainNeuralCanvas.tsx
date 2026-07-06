"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Background, Controls, ReactFlow, useEdgesState, useNodesState, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAppSettings } from "@/context/AppSettingsContext";
import type { BrainEdge, BrainNode } from "../_types/brain.types";
import { BrainNeuralEdge } from "./BrainNeuralEdge";
import { BrainNeuronNode } from "./BrainNeuronNode";
import { BrainNodeOverlay } from "./BrainNodeOverlay";

type BrainNeuralCanvasProps = {
  nodes: BrainNode[];
  edges: BrainEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: BrainNode) => void;
  onOpenRelatedModule: (module: string) => void;
  localGraphOnly: boolean;
  onToggleLocalGraph: () => void;
  loading?: boolean;
  debugMode?: boolean;
};

const nodeTypes = { brainNeuron: BrainNeuronNode };
const edgeTypes = { brainNeural: BrainNeuralEdge };

function isCoreNode(node: BrainNode) {
  return Boolean(node.metadata?.isBrainCore || node.metadata?.isContextCore || node.type === "company" || node.type === "project" || node.type === "module" || node.size === "lg");
}

function getConnectedNodeIds(edges: BrainEdge[]) {
  return new Set(edges.flatMap((edge) => [edge.source, edge.target]));
}

function getFocusGraph(nodes: BrainNode[], edges: BrainEdge[], selectedNodeId: string | null) {
  if (!selectedNodeId) {
    const coreNodes = nodes.filter((node) => node.metadata?.isBrainCore || node.metadata?.isContextCore);
    const coreIds = new Set(coreNodes.map((node) => node.id));
    const firstLayerIds = new Set<string>(coreIds);
    for (const edge of edges) {
      if (coreIds.has(edge.source)) firstLayerIds.add(edge.target);
      if (coreIds.has(edge.target)) firstLayerIds.add(edge.source);
    }
    const firstLayer = nodes.filter((node) => firstLayerIds.has(node.id));
    const fallbackLayer = firstLayer.length > 1 ? firstLayer : nodes.filter(isCoreNode).slice(0, 18);
    const selectedLayer = fallbackLayer.length ? fallbackLayer : nodes.slice(0, 18);
    const ids = new Set(selectedLayer.map((node) => node.id));
    return { nodes: selectedLayer, edges: edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) };
  }

  const ids = new Set<string>([selectedNodeId]);
  for (const edge of edges) {
    if (edge.source === selectedNodeId) ids.add(edge.target);
    if (edge.target === selectedNodeId) ids.add(edge.source);
  }
  if (ids.size < 8) {
    const firstPass = Array.from(ids);
    for (const edge of edges) {
      if (firstPass.includes(edge.source) || firstPass.includes(edge.target)) {
        ids.add(edge.source);
        ids.add(edge.target);
      }
      if (ids.size >= 18) break;
    }
  }
  const focusedNodes = nodes.filter((node) => ids.has(node.id)).slice(0, 20);
  const focusedIds = new Set(focusedNodes.map((node) => node.id));
  return { nodes: focusedNodes, edges: edges.filter((edge) => focusedIds.has(edge.source) && focusedIds.has(edge.target)) };
}

function layoutNodes(nodes: BrainNode[], edges: BrainEdge[], selectedNodeId: string | null, saved: Record<string, { x: number; y: number }>, canvasSize: { width: number; height: number }, themeMode: "light" | "dark") {
  const center = { x: Math.max(420, canvasSize.width / 2 - 60), y: Math.max(300, canvasSize.height / 2 - 20) };
  const selected = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) : nodes.find((node) => node.metadata?.isBrainCore || node.metadata?.isContextCore) ?? nodes[0];
  const selectedIndex = selected ? nodes.findIndex((node) => node.id === selected.id) : -1;
  const connected = getConnectedNodeIds(edges);

  return nodes.map<Node>((node, index) => {
    const nodeData = { brainNode: node, selectedNodeId, related: !selectedNodeId || node.id === selectedNodeId || connected.has(node.id), orphan: !connected.has(node.id), connectedCount: edges.filter((edge) => edge.source === node.id || edge.target === node.id).length, themeMode };
    if (saved[node.id]) return { id: node.id, type: "brainNeuron", position: saved[node.id], data: nodeData, draggable: true };

    let x = center.x;
    let y = center.y;
    if (!selectedNodeId) {
      if (node.id !== selected?.id) {
        const orbitItems = nodes.filter((item) => item.id !== selected?.id);
        const orbitIndex = Math.max(0, orbitItems.findIndex((item) => item.id === node.id));
        const angle = (orbitIndex / Math.max(1, orbitItems.length)) * Math.PI * 2 - Math.PI / 2;
        const radiusX = Math.min(Math.max(310, canvasSize.width * 0.28), 560) + (orbitIndex % 2) * 70;
        const radiusY = Math.min(Math.max(190, canvasSize.height * 0.24), 360) + (orbitIndex % 3) * 34;
        x = center.x + Math.cos(angle) * radiusX;
        y = center.y + Math.sin(angle) * radiusY;
      }
    } else if (node.id !== selectedNodeId) {
      const relativeItems = nodes.filter((item) => item.id !== selectedNodeId);
      const relativeIndex = Math.max(0, relativeItems.findIndex((item) => item.id === node.id));
      const angle = (relativeIndex / Math.max(1, relativeItems.length)) * Math.PI * 2 - Math.PI / 2;
      const radius = Math.min(Math.max(260, canvasSize.width * 0.24), 520) + (relativeIndex % 3) * 72;
      x = center.x + Math.cos(angle) * radius;
      y = center.y + Math.sin(angle) * (radius * 0.72);
    }

    if (index === selectedIndex) {
      x = center.x;
      y = center.y;
    }
    return { id: node.id, type: "brainNeuron", position: { x, y }, data: nodeData, draggable: true };
  });
}

function readDocumentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";

  const root = document.documentElement;
  const body = document.body;
  const themeValues = [
    root.dataset.theme,
    root.dataset.mode,
    root.dataset.appearance,
    body.dataset.theme,
    body.dataset.mode,
    body.dataset.appearance,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  if (themeValues.some((value) => value.includes("dark") || value.includes("escuro"))) return "dark";
  if (themeValues.some((value) => value.includes("light") || value.includes("claro"))) return "light";
  if (root.classList.contains("dark") || body.classList.contains("dark")) return "dark";

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function BrainNeuralCanvas({ nodes, edges, selectedNodeId, onSelectNode, onOpenRelatedModule, localGraphOnly, onToggleLocalGraph, loading = false, debugMode = false }: BrainNeuralCanvasProps) {
  const { resolvedTheme } = useAppSettings();
  const [documentTheme, setDocumentTheme] = useState<"light" | "dark">("light");
  const isDarkMode = resolvedTheme === "dark" || documentTheme === "dark";
  const themeMode = isDarkMode ? "dark" : "light";
  const containerRef = useRef<HTMLElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 720 });
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [overlayNode, setOverlayNode] = useState<BrainNode | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncTheme = () => setDocumentTheme(readDocumentTheme());
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "data-mode", "data-appearance"] });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class", "data-theme", "data-mode", "data-appearance"] });

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", syncTheme);

    return () => {
      observer.disconnect();
      media?.removeEventListener?.("change", syncTheme);
    };
  }, []);

  useLayoutEffect(() => {
    let frame = 0;
    let timeout80 = 0;
    let timeout240 = 0;
    function measure() {
      const element = containerRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width > 0 && height > 0) setCanvasSize((current) => current.width === width && current.height === height ? current : { width, height });
    }
    function scheduleMeasure() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    }
    scheduleMeasure();
    timeout80 = window.setTimeout(scheduleMeasure, 80);
    timeout240 = window.setTimeout(scheduleMeasure, 240);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => scheduleMeasure()) : null;
    if (containerRef.current && observer) observer.observe(containerRef.current);
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout80);
      window.clearTimeout(timeout240);
      window.removeEventListener("resize", scheduleMeasure);
      observer?.disconnect();
    };
  }, []);

  const focusedGraph = useMemo(() => getFocusGraph(nodes, edges, selectedNodeId), [nodes, edges, selectedNodeId]);
  const flowNodes = useMemo<Node[]>(() => layoutNodes(focusedGraph.nodes, focusedGraph.edges, selectedNodeId, manualPositions, canvasSize, themeMode), [focusedGraph.nodes, focusedGraph.edges, selectedNodeId, manualPositions, canvasSize, themeMode]);
  const flowEdges = useMemo<Edge[]>(() => focusedGraph.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, type: "brainNeural", animated: edge.status === "pending" || edge.status === "warning", data: { brainEdge: edge, highlighted: Boolean(selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)), themeMode } })), [focusedGraph.edges, selectedNodeId, themeMode]);
  const flowSignature = useMemo(() => [selectedNodeId ?? "root", themeMode, focusedGraph.nodes.map((node) => node.id).join("|"), focusedGraph.edges.map((edge) => edge.id).join("|")].join("::"), [focusedGraph.edges, focusedGraph.nodes, selectedNodeId, themeMode]);
  const [reactFlowNodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [reactFlowEdges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => setNodes(flowNodes), [flowNodes, setNodes]);
  useEffect(() => setEdges(flowEdges), [flowEdges, setEdges]);
  useEffect(() => {
    if (!selectedNodeId) {
      setOverlayNode(null);
      return;
    }
    setOverlayNode(nodes.find((node) => node.id === selectedNodeId) ?? null);
  }, [nodes, selectedNodeId]);

  const handleNodeDragStop = (_: MouseEvent, node: Node) => setManualPositions((current) => ({ ...current, [node.id]: node.position }));
  const canvasStyle = isDarkMode
    ? { width: "100%", height: "100%", minHeight: "100%", display: "block", position: "relative" as const, color: "#f8fafc", backgroundColor: "#020713", background: "radial-gradient(circle at 18% 28%, rgba(34,211,238,0.18), transparent 28%), radial-gradient(circle at 82% 24%, rgba(239,0,1,0.18), transparent 30%), linear-gradient(135deg, #020713 0%, #061326 44%, #120718 72%, #220006 100%)" }
    : { width: "100%", height: "100%", minHeight: "100%", display: "block", position: "relative" as const, color: "#0b1a3c", backgroundColor: "#ffffff", background: "radial-gradient(circle at 18% 28%, rgba(34,211,238,0.14), transparent 28%), radial-gradient(circle at 82% 32%, rgba(239,0,1,0.06), transparent 30%), linear-gradient(135deg, #ffffff 0%, #f6fbff 46%, #fff8f9 100%)" };

  return (
    <section ref={containerRef} data-brain-universe data-theme-mode={themeMode} className="brain-universe-canvas brain-universe-canvas-strong relative w-full overflow-hidden" style={canvasStyle}>
      <style>{`.brain-universe-canvas .react-flow,.brain-universe-canvas .react-flow__renderer,.brain-universe-canvas .react-flow__pane,.brain-universe-canvas .react-flow__viewport{background:transparent!important}.brain-universe-canvas[data-theme-mode="light"] .react-flow__pane{background:transparent!important}.brain-universe-canvas[data-theme-mode="dark"] .react-flow__pane{background:#020713!important}.brain-universe-canvas[data-theme-mode="light"] .react-flow__background{opacity:.28}.brain-universe-canvas[data-theme-mode="dark"] .react-flow__background{opacity:.18}`}</style>
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-[-14%] top-[8%] h-[44vw] min-h-[380px] w-[44vw] min-w-[380px] rounded-full blur-3xl" style={{ background: isDarkMode ? "radial-gradient(circle, rgba(34,211,238,0.18), transparent 68%)" : "radial-gradient(circle, rgba(34,211,238,0.10), transparent 68%)" }} />
        <div className="absolute right-[-14%] top-[14%] h-[44vw] min-h-[380px] w-[44vw] min-w-[380px] rounded-full blur-3xl" style={{ background: isDarkMode ? "radial-gradient(circle, rgba(239,0,1,0.18), transparent 68%)" : "radial-gradient(circle, rgba(239,0,1,0.07), transparent 68%)" }} />
        <div className="absolute left-[16%] right-[16%] top-1/2 h-px" style={{ background: isDarkMode ? "linear-gradient(90deg, transparent, rgba(34,211,238,0.36), rgba(239,0,1,0.3), transparent)" : "linear-gradient(90deg, transparent, rgba(34,211,238,0.18), rgba(239,0,1,0.10), transparent)", boxShadow: isDarkMode ? "0 0 32px rgba(34,211,238,0.16)" : "0 0 24px rgba(34,211,238,0.10)" }} />
      </div>

      <ReactFlow key={`brain-flow-${canvasSize.width}x${canvasSize.height}-${flowSignature}`} nodes={reactFlowNodes} edges={reactFlowEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{ padding: 0.28, duration: 420 }} minZoom={0.12} maxZoom={2.3} nodesDraggable nodesConnectable={false} elementsSelectable panOnDrag panOnScroll zoomOnScroll zoomOnPinch selectionOnDrag={false} preventScrolling={false} proOptions={{ hideAttribution: true }} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeDragStop={handleNodeDragStop} onNodeClick={(_, node) => { const brainNode = (node.data as { brainNode: BrainNode }).brainNode; onSelectNode(brainNode); setOverlayNode(brainNode); }} onPaneClick={() => setOverlayNode(null)} onNodeDoubleClick={(_, node) => onOpenRelatedModule(((node.data as { brainNode: BrainNode }).brainNode).module)} className="h-full w-full" style={{ width: "100%", height: "100%", background: "transparent" }}>
        <Background color={isDarkMode ? "rgba(125,211,252,0.12)" : "rgba(1,24,72,0.10)"} gap={34} />
        <Controls className={isDarkMode ? "!bottom-5 !left-5 !rounded-2xl !border !border-white/10 !bg-slate-950/70 !text-slate-50 backdrop-blur-xl" : "!bottom-5 !left-5 !rounded-2xl !border !border-slate-200/70 !bg-white/80 !text-slate-700 backdrop-blur-xl"} />
      </ReactFlow>

      {!overlayNode ? <div className={`pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] backdrop-blur-xl ${isDarkMode ? "border-cyan-100/10 bg-slate-950/70 text-cyan-50/80" : "border-slate-200/80 bg-white/80 text-slate-700"}`}>Nó = conhecimento · Conexão = relação · Informação = conhecimento conectado</div> : null}
      {loading ? <div className={`pointer-events-none absolute left-1/2 top-[74px] z-30 -translate-x-1/2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] backdrop-blur-xl ${isDarkMode ? "border-cyan-100/10 bg-slate-950/70 text-cyan-50/85" : "border-slate-200/80 bg-white/86 text-slate-700"}`}><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: "#22d3ee", boxShadow: "0 0 18px rgba(34,211,238,0.82)" }} /><span>Sinapses atualizando</span></div> : null}
      {overlayNode ? <BrainNodeOverlay node={overlayNode} nodes={focusedGraph.nodes} edges={focusedGraph.edges} debugMode={debugMode} onClose={() => setOverlayNode(null)} onResetFocus={() => { setOverlayNode(null); const core = nodes.find((node) => node.metadata?.isBrainCore || node.metadata?.isContextCore) ?? nodes[0]; if (core) onSelectNode(core); }} onOpenRelatedModule={onOpenRelatedModule} /> : null}
      <button type="button" onClick={onToggleLocalGraph} className={`absolute right-[132px] top-[92px] z-30 rounded-full border px-3 py-2 text-xs font-black backdrop-blur-xl transition ${localGraphOnly ? (isDarkMode ? "border-cyan-200/60 bg-cyan-300/20 text-cyan-50" : "border-cyan-300 bg-cyan-100/90 text-cyan-900") : (isDarkMode ? "border-white/10 bg-slate-950/70 text-white/76 hover:border-cyan-200/40 hover:text-cyan-100" : "border-slate-200/80 bg-white/86 text-slate-700 hover:border-cyan-200 hover:text-cyan-700")}`}>Grafo local</button>
    </section>
  );
}
