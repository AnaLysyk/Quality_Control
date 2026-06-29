"use client";

import { FiAlertTriangle } from "react-icons/fi";
import type { BrainGraphSummary, BrainNode } from "../_types/brain.types";

type BrainMissingKnowledgePanelProps = {
  summary: BrainGraphSummary;
  nodes: BrainNode[];
};

export function BrainMissingKnowledgePanel({ summary, nodes }: BrainMissingKnowledgePanelProps) {
  const nodeMissing = nodes.flatMap((node) => (node.missingKnowledge ?? []).map((item) => `${node.label}: ${item}`));
  const items = [...summary.pendingMappings, ...nodeMissing].filter(Boolean).slice(0, 8);

  return (
    <section className="rounded-2xl border border-yellow-200/20 bg-yellow-200/[0.07] p-4 text-yellow-50">
      <div className="flex items-center gap-2">
        <FiAlertTriangle className="h-4 w-4" />
        <h2 className="text-sm font-black">O que falta para o Brain saber mais</h2>
      </div>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-xs font-semibold leading-5 text-yellow-50/82">
          {items.map((item) => (
            <li key={item} className="rounded-xl border border-yellow-100/10 bg-black/12 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs font-semibold text-yellow-50/75">Nenhuma pendencia critica neste recorte.</p>
      )}
    </section>
  );
}
