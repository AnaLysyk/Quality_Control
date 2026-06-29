"use client";

import Image from "next/image";
import { FiDatabase, FiRefreshCw, FiShield } from "react-icons/fi";
import type { BrainGraphSummary } from "../_types/brain.types";

type BrainHeaderProps = {
  companyName: string;
  projectName: string;
  moduleName: string | null;
  source: "database" | "fallback" | "partial";
  loading: boolean;
  summary: BrainGraphSummary;
};

export function BrainHeader({ companyName, projectName, moduleName, source, loading, summary }: BrainHeaderProps) {
  const statusLabel = loading
    ? "Atualizando grafo"
    : source === "database"
      ? "Dados reais"
      : source === "partial"
        ? "Dados reais + dados iniciais"
        : "Dados iniciais do Brain";

  return (
    <header className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#071120_0%,#0b2a52_52%,#610005_120%)] px-4 py-4 text-white shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/12 bg-white/8">
            <Image src="/images/tc.png" alt="Testing Company" fill sizes="48px" className="object-contain p-1" priority />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">Brain</h1>
              <span className="rounded-full border border-cyan-100/18 bg-cyan-100/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-50">
                Mapa neural
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-white/72">
              Conhecimentos conectados formando informacoes operacionais.
            </p>
            <p className="mt-2 truncate text-xs font-bold text-white/58">
              Brain / {companyName} / {projectName} / {moduleName ?? "Todos os modulos"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 text-xs">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2 font-black text-white/78">
            <FiShield className="h-3.5 w-3.5 text-emerald-100" />
            Conforme seu perfil
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100/20 bg-cyan-100/10 px-3 py-2 font-black text-cyan-50">
            {loading ? <FiRefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FiDatabase className="h-3.5 w-3.5" />}
            {statusLabel}
          </span>
          <span className="rounded-full border border-white/12 bg-black/18 px-3 py-2 font-black text-white/68">
            {summary.totalNodes} nos / {summary.totalEdges} conexoes
          </span>
        </div>
      </div>
    </header>
  );
}
