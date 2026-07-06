"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { BrainEdge } from "../_types/brain.types";

type BrainNeuralEdgeData = {
  brainEdge: BrainEdge;
  highlighted: boolean;
  themeMode?: "light" | "dark";
};

function strokeFor(edge: BrainEdge, highlighted: boolean, darkMode: boolean) {
  if (darkMode) {
    if (highlighted) return "#67e8f9";
    if (edge.status === "missing" || edge.status === "error" || edge.status === "orphan") return "#fb7185";
    if (edge.status === "pending" || edge.status === "warning") return "#facc15";
    if (edge.type === "generated_by") return "#94a3b8";
    if (edge.type === "forms_information") return "#2dd4bf";
    return "#60a5fa";
  }

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
  const darkMode = data?.themeMode === "dark";
  const [edgePath, labelX, labelY] = getBezierPath(props);

  if (!brainEdge) return <BaseEdge path={edgePath} style={{ stroke: darkMode ? "#67e8f9" : "#38bdf8", opacity: darkMode ? 0.45 : 0.35 }} />;

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: strokeFor(brainEdge, highlighted, darkMode),
          strokeWidth: highlighted ? 2.4 : darkMode ? 1.45 : 1.2,
          opacity: highlighted ? 0.9 : darkMode ? 0.54 : 0.38,
          filter: highlighted ? `drop-shadow(0 4px 10px ${darkMode ? "rgba(103,232,249,0.34)" : "rgba(15,118,110,0.24)"})` : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <span
          className={`pointer-events-none absolute rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${darkMode ? "border-cyan-100/10 bg-slate-950/84 text-slate-50 shadow-[0_8px_18px_rgba(0,0,0,0.34)]" : "border-slate-200/80 bg-white/88 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.12)]"}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {brainEdge.label}
        </span>
      </EdgeLabelRenderer>
    </>
  );
}
