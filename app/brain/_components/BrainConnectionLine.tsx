"use client";

import type { BrainEdge } from "../_types/brain.types";
import type { BrainLayoutNode } from "../_utils/brainGraphLayout";

type BrainConnectionLineProps = {
  edge: BrainEdge;
  source?: BrainLayoutNode;
  target?: BrainLayoutNode;
  highlighted: boolean;
};

function strokeFor(edge: BrainEdge, highlighted: boolean) {
  if (highlighted) return "#67e8f9";
  if (edge.status === "missing" || edge.status === "error") return "#fb7185";
  if (edge.status === "pending" || edge.status === "warning") return "#facc15";
  return "#38bdf8";
}

export function BrainConnectionLine({ edge, source, target, highlighted }: BrainConnectionLineProps) {
  if (!source || !target) return null;

  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;
  const curve = source.x < target.x ? 6 : -6;
  const path = `M ${source.x} ${source.y} Q ${midX} ${midY + curve} ${target.x} ${target.y}`;

  return (
    <path
      d={path}
      fill="none"
      stroke={strokeFor(edge, highlighted)}
      strokeWidth={highlighted ? 0.55 : 0.28}
      strokeLinecap="round"
      opacity={highlighted ? 0.95 : 0.38}
      className="transition-all duration-300"
    />
  );
}
