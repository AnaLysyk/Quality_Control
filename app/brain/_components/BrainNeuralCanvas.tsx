"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
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
  return Boolean(
    node.metadata?.isBrainCore ||
    node.metadata?.isContextCore ||
    node.type === "company" ||
    node.type === "project" ||
    node.type === "module" ||
    node.size === "lg",
  );
}

function getConnectedNodeIds(edges: BrainEdge[]) {
  return new Set(edges.flatMap((edge) => [edge.source, edge.target]));
}

function getFocusGraph(nodes: BrainNode[], edges: BrainEdge[], selectedNodeId: string | null) {
  if (!selectedNodeId) {
    const core = nodes.filter(isCoreNode);
    const firstLayer = core.length ? core : nodes.slice(0, 14);
    const ids = new Set(firstLayer.map((node) => node.id));

    return {
      nodes: firstLayer,
      edges: edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
    };
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

  return {
    nodes: focusedNodes,
    edges: edges.filter((edge) => focusedIds.has(edge.source) && focusedIds.has(edge.target)),
  };
}

function layoutNodes(
  nodes: BrainNode[],
  edges: BrainEdge[],
  selectedNodeId: string | null,
  saved: Record<string, { x: number; y: number }>,
  canvasSize: { width: number; height: number },
) {
  const center = {
    x: Math.max(420, canvasSize.width / 2 - 60),
    y: Math.max(300, canvasSize.height / 2 - 20),
  };

  const selected =
    selectedNodeId
      ? nodes.find((node) => node.id === selectedNodeId)
      : nodes.find((node) => node.metadata?.isBrainCore || node.metadata?.isContextCore) ?? nodes[0];

  const selectedIndex = selected ? nodes.findIndex((node) => node.id === selected.id) : -1;
  const connected = getConnectedNodeIds(edges);

  return nodes.map<Node>((node, index) => {
    if (saved[node.id]) {
      return {
        id: node.id,
        type: "brainNeuron",
        position: saved[node.id],
        data: {
          brainNode: node,
          selectedNodeId,
          related: !selectedNodeId || node.id === selectedNodeId || connected.has(node.id),
          orphan: !connected.has(node.id),
          connectedCount: edges.filter((edge) => edge.source === node.id || edge.target === node.id).length,
        },
        draggable: true,
      };
    }

    let x = center.x;
    let y = center.y;

    if (!selectedNodeId) {
      if (node.id === selected?.id) {
        x = center.x;
        y = center.y;
      } else {
        const orbitItems = nodes.filter((item) => item.id !== selected?.id);
        const orbitIndex = Math.max(0, orbitItems.findIndex((item) => item.id === node.id));
        const angle = (orbitIndex / Math.max(1, orbitItems.length)) * Math.PI * 2 - Math.PI / 2;
        const radiusX = Math.min(Math.max(310, canvasSize.width * 0.28), 560) + (orbitIndex % 2) * 70;
        const radiusY = Math.min(Math.max(190, canvasSize.height * 0.24), 360) + (orbitIndex % 3) * 34;

        x = center.x + Math.cos(angle) * radiusX;
        y = center.y + Math.sin(angle) * radiusY;
      }
    } else if (node.id === selectedNodeId) {
      x = center.x;
      y = center.y;
    } else {
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

    return {
      id: node.id,
      type: "brainNeuron",
      position: { x, y },
      data: {
        brainNode: node,
        selectedNodeId,
        related: !selectedNodeId || node.id === selectedNodeId || connected.has(node.id),
        orphan: !connected.has(node.id),
        connectedCount: edges.filter((edge) => edge.source === node.id || edge.target === node.id).length,
      },
      draggable: true,
    };
  });
}

export function BrainNeuralCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onOpenRelatedModule,
  localGraphOnly,
  onToggleLocalGraph,
  loading = false,
  debugMode = false,
}: BrainNeuralCanvasProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 720 });
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [overlayNode, setOverlayNode] = useState<BrainNode | null>(null);

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

      if (width > 0 && height > 0) {
        setCanvasSize((current) =>
          current.width === width && current.height === height
            ? current
            : { width, height },
        );
      }
    }

    function scheduleMeasure() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    }

    scheduleMeasure();
    timeout80 = window.setTimeout(scheduleMeasure, 80);
    timeout240 = window.setTimeout(scheduleMeasure, 240);

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => scheduleMeasure())
        : null;

    if (containerRef.current && observer) {
      observer.observe(containerRef.current);
    }

    window.addEventListener("resize", scheduleMeasure);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout80);
      window.clearTimeout(timeout240);
      window.removeEventListener("resize", scheduleMeasure);
      observer?.disconnect();
    };
  }, []);

  const canRenderFlow = true;

  const focusedGraph = useMemo(
    () => getFocusGraph(nodes, edges, selectedNodeId),
    [nodes, edges, selectedNodeId],
  );

  const flowNodes = useMemo<Node[]>(
    () => layoutNodes(focusedGraph.nodes, focusedGraph.edges, selectedNodeId, manualPositions, canvasSize),
    [focusedGraph.nodes, focusedGraph.edges, selectedNodeId, manualPositions, canvasSize],
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      focusedGraph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "brainNeural",
        animated: edge.status === "pending" || edge.status === "warning",
        data: {
          brainEdge: edge,
          highlighted: Boolean(selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)),
        },
      })),
    [focusedGraph.edges, selectedNodeId],
  );

  const flowSignature = useMemo(
    () => [
      selectedNodeId ?? "root",
      focusedGraph.nodes.map((node) => node.id).join("|"),
      focusedGraph.edges.map((edge) => edge.id).join("|"),
    ].join("::"),
    [focusedGraph.edges, focusedGraph.nodes, selectedNodeId],
  );

  const [reactFlowNodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [reactFlowEdges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  useEffect(() => {
    if (!selectedNodeId) {
      setOverlayNode(null);
      return;
    }

    const next = nodes.find((node) => node.id === selectedNodeId) ?? null;
    setOverlayNode(next);
  }, [nodes, selectedNodeId]);

  const handleNodeDragStop = (_: MouseEvent, node: Node) => {
    setManualPositions((current) => ({
      ...current,
      [node.id]: node.position,
    }));
  };

  return (
    <section
      ref={containerRef}
      data-brain-universe
      className="brain-universe-canvas relative w-full overflow-hidden text-white"
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100%",
        display: "block",
        position: "relative",
      }}
    >
      {canRenderFlow ? (
        <ReactFlow
          key={`brain-flow-${canvasSize.width}x${canvasSize.height}-${flowSignature}`}
          nodes={reactFlowNodes}
          edges={reactFlowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.28, duration: 420 }}
          minZoom={0.12}
          maxZoom={2.3}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          panOnDrag
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          selectionOnDrag={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={(_, node) => {
            const brainNode = (node.data as { brainNode: BrainNode }).brainNode;
            onSelectNode(brainNode);
            setOverlayNode(brainNode);
          }}
          onPaneClick={() => {
            setOverlayNode(null);
          }}
          onNodeDoubleClick={(_, node) => onOpenRelatedModule(((node.data as { brainNode: BrainNode }).brainNode).module)}
          className="h-full w-full"
          style={{ width: "100%", height: "100%" }}
        >
          <Background color="rgba(103,232,249,0.12)" gap={34} />
          <Controls className="!bottom-5 !left-5 !rounded-2xl backdrop-blur-xl" />
        </ReactFlow>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-black text-cyan-50/70">
          Preparando universo neural...
        </div>
      )}

      {!overlayNode ? (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-cyan-100/10 bg-black/24 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-50/72 backdrop-blur-xl">
          Nó = conhecimento · Conexão = relação · Informação = conhecimento conectado
        </div>
      ) : null}

      {loading ? (
        <div className="pointer-events-none absolute left-1/2 top-24 z-30 -translate-x-1/2 rounded-full border border-cyan-100/10 bg-black/32 px-4 py-2 text-xs font-black text-cyan-50/80 backdrop-blur-xl">
          Atualizando cérebro neural...
        </div>
      ) : null}

      {overlayNode ? (
        <BrainNodeOverlay
          node={overlayNode}
          nodes={focusedGraph.nodes}
          edges={focusedGraph.edges}
          debugMode={debugMode}
          onClose={() => setOverlayNode(null)}
          onResetFocus={() => {
            setOverlayNode(null);
            const core = nodes.find((node) => node.metadata?.isBrainCore || node.metadata?.isContextCore) ?? nodes[0];
            if (core) onSelectNode(core);
          }}
          onOpenRelatedModule={onOpenRelatedModule}
        />
      ) : null}

      <button
        type="button"
        onClick={onToggleLocalGraph}
        className={`absolute right-[132px] top-[92px] z-30 rounded-full border px-3 py-2 text-xs font-black backdrop-blur-xl transition ${
          localGraphOnly
            ? "border-cyan-200/70 bg-cyan-200/18 text-cyan-50"
            : "border-white/10 bg-black/24 text-white/76 hover:border-cyan-200/60 hover:text-cyan-100"
        }`}
      >
        Grafo local
      </button>
    </section>
  );
}

