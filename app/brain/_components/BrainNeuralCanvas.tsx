"use client";

import { useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FiBox, FiShare2 } from "react-icons/fi";
import type { BrainEdge, BrainNode } from "../_types/brain.types";
import { getModuleNames, layoutBrainGraph } from "../_utils/brainGraphLayout";
import { BrainNeuralEdge } from "./BrainNeuralEdge";
import { BrainNeuronNode } from "./BrainNeuronNode";

type BrainNeuralCanvasProps = {
  nodes: BrainNode[];
  edges: BrainEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: BrainNode) => void;
  onOpenRelatedModule: (module: string) => void;
  localGraphOnly: boolean;
  onToggleLocalGraph: () => void;
  loading?: boolean;
};

function BrainClusterNode({ data }: NodeProps) {
  const cluster = data as { module: string; count: number; pending: number };
  return (
    <div className="pointer-events-none h-full w-full rounded-[32px] border border-cyan-100/10 bg-cyan-100/[0.035] px-5 py-4 shadow-[inset_0_0_40px_rgba(103,232,249,0.045),0_0_48px_rgba(2,6,23,0.28)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100/52">{cluster.module}</p>
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black text-white/50">
          {cluster.count} nos
        </span>
      </div>
      {cluster.pending ? (
        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-yellow-100/58">{cluster.pending} pendencias</p>
      ) : null}
    </div>
  );
}

const nodeTypes = { brainNeuron: BrainNeuronNode, brainCluster: BrainClusterNode };
const edgeTypes = { brainNeural: BrainNeuralEdge };

function nodeColor(node: Node) {
  const status = (node.data?.status as string | undefined) ?? "ok";
  if (status === "ok") return "#34d399";
  if (status === "pending" || status === "warning") return "#facc15";
  if (status === "missing" || status === "error" || status === "orphan") return "#fb7185";
  return "#38bdf8";
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
}: BrainNeuralCanvasProps) {
  const connected = useMemo(() => new Set(edges.flatMap((edge) => [edge.source, edge.target])), [edges]);
  const relatedNodeIds = useMemo(
    () =>
      new Set(
        edges
          .filter((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId)
          .flatMap((edge) => [edge.source, edge.target]),
      ),
    [edges, selectedNodeId],
  );

  const flowNodes = useMemo<Node[]>(() => {
    const layoutNodes = layoutBrainGraph(nodes, edges);
    const modules = getModuleNames(nodes);
    const clusterNodes = modules.map<Node>((moduleName) => {
      const moduleNodes = layoutNodes.filter((node) => node.module === moduleName);
      const anchor = moduleNodes.find((node) => node.type === "module") ?? moduleNodes[0];
      const pending = moduleNodes.filter((node) => ["pending", "missing", "warning", "error", "orphan"].includes(node.status)).length;
      const centerX = (anchor?.x ?? 50) * 8.2;
      const centerY = (anchor?.y ?? 50) * 5.2;
      return {
        id: `cluster:${moduleName}`,
        type: "brainCluster",
        position: { x: centerX - 170, y: centerY - 120 },
        data: { module: moduleName, count: moduleNodes.length, pending },
        selectable: false,
        draggable: false,
        zIndex: 0,
        style: { width: 340, height: 240 },
      };
    });

    const knowledgeNodes = layoutNodes.map<Node>((node) => ({
      id: node.id,
      type: "brainNeuron",
      position: { x: node.x * 8.2, y: node.y * 5.2 },
      data: {
        brainNode: node,
        status: node.status,
        selectedNodeId,
        related: selectedNodeId === node.id || relatedNodeIds.has(node.id),
        orphan: !connected.has(node.id),
        connectedCount: node.connectedCount,
      },
      draggable: true,
      zIndex: selectedNodeId === node.id ? 5 : 2,
    }));
    return [...clusterNodes, ...knowledgeNodes];
  }, [connected, edges, nodes, relatedNodeIds, selectedNodeId]);

  const flowEdges = useMemo<Edge[]>(() =>
    edges.map((edge) => ({
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
  [edges, selectedNodeId]);

  const [reactFlowNodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [reactFlowEdges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  return (
    <section className="relative h-[780px] overflow-hidden rounded-2xl border border-white/10 bg-[#071120] shadow-[0_28px_90px_rgba(0,0,0,0.34)] xl:h-[calc(100vh-280px)] xl:min-h-[760px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(103,232,249,0.12),transparent_34%),radial-gradient(circle_at_18%_20%,rgba(16,185,129,0.08),transparent_26%),linear-gradient(180deg,rgba(15,23,42,0.18),rgba(2,6,23,0.96))]" />
      <div className="absolute left-4 right-4 top-4 z-20 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100/70">Mapa neural</p>
          <h2 className="mt-1 text-xl font-black text-white">Conhecimentos conectados</h2>
        </div>
        <button
          type="button"
          onClick={onToggleLocalGraph}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition ${localGraphOnly ? "border-cyan-200/70 bg-cyan-200/18 text-cyan-50" : "border-white/10 bg-black/24 text-white/76 hover:border-cyan-200/60 hover:text-cyan-100"}`}
        >
          <FiShare2 className="h-3.5 w-3.5" />
          Grafo local
        </button>
      </div>

      {nodes.length ? (
        <ReactFlow
          nodes={reactFlowNodes}
          edges={reactFlowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.24, duration: 420 }}
          minZoom={0.25}
          maxZoom={1.55}
          proOptions={{ hideAttribution: true }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => onSelectNode((node.data as { brainNode: BrainNode }).brainNode)}
          onNodeDoubleClick={(_, node) => onOpenRelatedModule(((node.data as { brainNode: BrainNode }).brainNode).module)}
          className="relative z-10 h-full"
        >
          <Background color="rgba(255,255,255,0.11)" gap={30} />
          <Controls className="!bottom-5 !left-5 !rounded-xl !border !border-white/10 !bg-[#071120]/90 !text-white" />
          <MiniMap
            nodeColor={nodeColor}
            pannable
            zoomable
            className="!bottom-5 !right-5 !rounded-xl !border !border-white/10 !bg-[#071120]/90"
          />
        </ReactFlow>
      ) : (
        <div className="relative z-10 flex h-full items-center justify-center px-6 text-center text-white">
          <div className="max-w-md rounded-2xl border border-white/10 bg-black/20 p-6">
            <FiBox className="mx-auto h-8 w-8 text-cyan-100" />
            <h3 className="mt-3 text-lg font-black">Nenhum no neste contexto</h3>
            <p className="mt-2 text-sm leading-6 text-white/60">Ajuste os filtros ou veja tudo que seu perfil pode acessar.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="pointer-events-none absolute inset-x-5 top-20 z-30 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-16 animate-pulse rounded-2xl border border-white/10 bg-white/[0.055] backdrop-blur-xl" />
          ))}
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-4 left-4 z-20 max-w-xl rounded-2xl border border-white/10 bg-black/32 px-4 py-3 text-xs font-semibold leading-5 text-white/68 backdrop-blur-xl">
        Um no isolado e conhecimento. Conexoes formam informacao.
      </div>
    </section>
  );
}
