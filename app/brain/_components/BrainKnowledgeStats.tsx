"use client";

import { FiAlertTriangle, FiBox, FiGitMerge, FiLayers, FiRadio } from "react-icons/fi";
import type { BrainGraphSummary } from "../_types/brain.types";
import { formatCounter } from "../_utils/brainGraphFormatters";

type BrainKnowledgeStatsProps = {
  summary: BrainGraphSummary;
};

export function BrainKnowledgeStats({ summary }: BrainKnowledgeStatsProps) {
  const stats = [
    { label: "Conhecimentos", description: "nós visíveis no contexto", value: summary.totalNodes, icon: FiRadio, tone: "text-cyan-100" },
    { label: "Conexões", description: "relações que formam informação", value: summary.totalEdges, icon: FiGitMerge, tone: "text-emerald-100" },
    { label: "Módulos", description: "núcleos do sistema", value: summary.modules ?? summary.totalModules, icon: FiLayers, tone: "text-sky-100" },
    { label: "Pendências", description: "pontos que faltam mapear", value: summary.pendingNodes ?? summary.pendingMappings.length, icon: FiAlertTriangle, tone: "text-yellow-100" },
    { label: "Ã“rfãos", description: "conhecimentos isolados", value: summary.orphanNodes, icon: FiBox, tone: "text-rose-100" },
    { label: "Criado hoje", description: "eventos novos no contexto", value: summary.eventsToday ?? 0, icon: FiRadio, tone: "text-cyan-100" },
  ];

  return (
    <section className="flex flex-wrap gap-2">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="inline-flex min-w-[132px] items-center gap-3 rounded-full border border-white/10 bg-[#06111f]/52 px-3 py-2 text-white shadow-[0_0_24px_rgba(34,211,238,0.08)] backdrop-blur-2xl">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.055]">
              <Icon className={`h-3.5 w-3.5 shrink-0 ${stat.tone}`} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-white/52">{stat.label}</p>
              <p className="text-lg font-black leading-5 tracking-tight">{formatCounter(stat.value)}</p>
              <p className="sr-only">{stat.description}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}

