"use client";

import type { BrainGraphSummary } from "../_types/brain.types";
import { formatCounter } from "../_utils/brainGraphFormatters";

type BrainKnowledgeSummaryProps = {
  summary: BrainGraphSummary;
};

export function BrainKnowledgeSummary({ summary }: BrainKnowledgeSummaryProps) {
  const cards = [
    { label: "Total de nos", value: summary.totalNodes, tone: "text-slate-950 dark:text-white" },
    { label: "Nos de solicitacoes", value: summary.accessRequestNodes, tone: "text-sky-700 dark:text-sky-200" },
    { label: "Solicitacoes sem no", value: summary.requestsWithoutNode, tone: "text-amber-700 dark:text-amber-200" },
    { label: "Logs vinculados", value: summary.logsLinked, tone: "text-emerald-700 dark:text-emerald-200" },
    { label: "Pendencias do Brain", value: summary.pendingMappings.length, tone: "text-rose-700 dark:text-rose-200" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-[0_16px_34px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900/86 dark:shadow-[0_18px_44px_rgba(0,0,0,0.22)]"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{card.label}</p>
          <p className={`mt-2 text-3xl font-black tracking-tight ${card.tone}`}>{formatCounter(card.value)}</p>
        </div>
      ))}
    </div>
  );
}
