"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { BrainEdge } from "../_types/brain.types";

type BrainNeuralEdgeData = {
  brainEdge: BrainEdge;
  highlighted: boolean;
};

function strokeFor(edge: BrainEdge, highlighted: boolean) {
  if (highlighted) return "#67e8f9";
  if (edge.status === "missing" || edge.status === "error" || edge.status === "orphan") return "#fb7185";
  if (edge.status === "pending" || edge.status === "warning") return "#facc15";
  if (edge.type === "generated_by") return "#c084fc";
  if (edge.type === "forms_information") return "#34d399";
  return "#38bdf8";
}

export function BrainNeuralEdge(props: EdgeProps) {
  const data = props.data as BrainNeuralEdgeData | undefined;
  const brainEdge = data?.brainEdge;
  const highlighted = Boolean(data?.highlighted);
  const [edgePath, labelX, labelY] = getBezierPath(props);

  if (!brainEdge) return <BaseEdge path={edgePath} style={{ stroke: "#38bdf8", opacity: 0.35 }} />;

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: strokeFor(brainEdge, highlighted),
          strokeWidth: highlighted ? 2.8 : 1.4,
          opacity: highlighted ? 0.95 : 0.48,
          filter: highlighted ? "drop-shadow(0 0 8px rgba(103,232,249,0.55))" : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <span
          className="pointer-events-none absolute rounded-full border border-white/10 bg-[#071120]/90 px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-cyan-50 shadow-[0_8px_18px_rgba(0,0,0,0.24)]"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {brainEdge.label}
        </span>
      </EdgeLabelRenderer>
    </>
  );
}
