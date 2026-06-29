"use client";

import { FiAlertTriangle, FiBox, FiGitMerge, FiLayers, FiRadio, FiZap } from "react-icons/fi";
import type { BrainGraphSummary } from "../_types/brain.types";
import { formatCounter } from "../_utils/brainGraphFormatters";

type BrainKnowledgeStatsProps = {
  summary: BrainGraphSummary;
};

export function BrainKnowledgeStats({ summary }: BrainKnowledgeStatsProps) {
  const stats = [
    { label: "Conhecimentos", description: "nos visiveis no contexto", value: summary.totalNodes, icon: FiRadio, tone: "text-cyan-100" },
    { label: "Conexoes", description: "relacoes que formam informacao", value: summary.totalEdges, icon: FiGitMerge, tone: "text-emerald-100" },
    { label: "Modulos", description: "clusters do sistema", value: summary.modules ?? summary.totalModules, icon: FiLayers, tone: "text-sky-100" },
    { label: "Pendencias", description: "pontos que faltam mapear", value: summary.pendingNodes ?? summary.pendingMappings.length, icon: FiAlertTriangle, tone: "text-yellow-100" },
    { label: "Orfaos", description: "conhecimentos isolados", value: summary.orphanNodes, icon: FiBox, tone: "text-rose-100" },
    { label: "Criado hoje", description: "eventos novos no contexto", value: summary.eventsToday ?? 0, icon: FiRadio, tone: "text-cyan-100" },
    { label: "Gerado pelo Brain", description: "conhecimentos produzidos por IA", value: summary.generatedByBrain ?? 0, icon: FiZap, tone: "text-purple-100" },
    { label: "Gerado por automacao", description: "execucoes e rotinas", value: summary.generatedByAutomation ?? 0, icon: FiZap, tone: "text-indigo-100" },
  ];

  return (
    <section className="grid gap-2 sm:grid-cols-4 xl:grid-cols-8">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-white shadow-[0_10px_26px_rgba(0,0,0,0.14)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-white/52">{stat.label}</p>
              <Icon className={`h-3.5 w-3.5 shrink-0 ${stat.tone}`} />
            </div>
            <p className="mt-1 text-2xl font-black tracking-tight">{formatCounter(stat.value)}</p>
            <p className="truncate text-[10px] font-semibold text-white/42">{stat.description}</p>
          </div>
        );
      })}
    </section>
  );
}
