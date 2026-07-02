"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { BrainEdge } from "../_types/brain.types";

type BrainNeuralEdgeData = {
  brainEdge: BrainEdge;
  highlighted: boolean;
};

function strokeFor(edge: BrainEdge, highlighted: boolean) {
  if (highlighted) return "#0f766e";
  if (edge.status === "missing" || edge.status === "error" || edge.status === "orphan") return "#be123c";
  if (edge.status === "pending" || edge.status === "warning") return "#b45309";
  if (edge.type === "generated_by") return "#475569";
  if (edge.type === "forms_information") return "#0f766e";
  return "#2563eb";
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
          strokeWidth: highlighted ? 2.4 : 1.2,
          opacity: highlighted ? 0.9 : 0.38,
          filter: highlighted ? "drop-shadow(0 4px 10px rgba(15,118,110,0.24))" : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <span
          className="pointer-events-none absolute rounded-full border border-slate-200/80 bg-slate-950/82 px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-slate-50 shadow-[0_8px_18px_rgba(15,23,42,0.16)]"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {brainEdge.label}
        </span>
      </EdgeLabelRenderer>
    </>
  );
}

