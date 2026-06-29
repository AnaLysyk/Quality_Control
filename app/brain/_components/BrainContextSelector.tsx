"use client";

import { FiCrosshair, FiRefreshCw, FiRotateCcw, FiSearch } from "react-icons/fi";
import type { BrainNode, BrainNodeStatus, BrainNodeType } from "../_types/brain.types";
import { nodeStatusLabel, nodeTypeLabel } from "../_utils/brainGraphFormatters";

type BrainContextSelectorProps = {
  nodes: BrainNode[];
  activeModule: string | null;
  searchText: string;
  nodeType: BrainNodeType | "all";
  nodeStatus: BrainNodeStatus | "all";
  period: "all" | "today" | "7d" | "30d";
  showOrphansOnly: boolean;
  showPendingOnly: boolean;
  visibleNodeCount: number;
  visibleEdgeCount: number;
  pendingCount: number;
  onModuleChange: (value: string | null) => void;
  onSearchTextChange: (value: string) => void;
  onNodeTypeChange: (value: BrainNodeType | "all") => void;
  onNodeStatusChange: (value: BrainNodeStatus | "all") => void;
  onPeriodChange: (value: "all" | "today" | "7d" | "30d") => void;
  onClear: () => void;
  onTogglePending: () => void;
  onToggleOrphans: () => void;
  onCenter: () => void;
  onRefresh: () => void;
  source?: "database" | "fallback" | "partial";
};

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

export function BrainContextSelector({
  nodes,
  activeModule,
  searchText,
  nodeType,
  nodeStatus,
  period,
  showOrphansOnly,
  showPendingOnly,
  visibleNodeCount,
  visibleEdgeCount,
  pendingCount,
  onModuleChange,
  onSearchTextChange,
  onNodeTypeChange,
  onNodeStatusChange,
  onPeriodChange,
  onClear,
  onTogglePending,
  onToggleOrphans,
  onCenter,
  onRefresh,
  source = "fallback",
}: BrainContextSelectorProps) {
  const companies = unique(nodes.map((node) => node.companyName));
  const projects = unique(nodes.map((node) => node.projectName));
  const modules = unique(nodes.map((node) => node.module));
  const nodeTypes = unique(nodes.map((node) => node.type)) as BrainNodeType[];
  const statuses = unique(nodes.map((node) => node.status)) as BrainNodeStatus[];
  const currentCompany = companies[0] ?? "Testing Company";
  const currentProject = projects[0] ?? "Quality Control";

  return (
    <section className="rounded-2xl border border-white/10 bg-[#081322]/86 p-3 text-white shadow-[0_18px_55px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Empresa" className="h-10 rounded-xl border border-white/10 bg-[#071120] px-3 text-xs font-bold outline-none" defaultValue={currentCompany}>
          {companies.length ? companies.map((company) => <option key={company}>{company}</option>) : <option>Testing Company</option>}
        </select>
        <select aria-label="Projeto" className="h-10 rounded-xl border border-white/10 bg-[#071120] px-3 text-xs font-bold outline-none" defaultValue={currentProject}>
          {projects.length ? projects.map((project) => <option key={project}>{project}</option>) : <option>Quality Control</option>}
        </select>
        <select aria-label="Modulo" value={activeModule ?? "all"} onChange={(event) => onModuleChange(event.target.value === "all" ? null : event.target.value)} className="h-10 rounded-xl border border-white/10 bg-[#071120] px-3 text-xs font-bold outline-none">
          <option value="all">Todos os modulos</option>
          {modules.map((moduleName) => <option key={moduleName} value={moduleName}>{moduleName}</option>)}
        </select>
        <label className="flex h-10 min-w-[280px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 text-xs font-bold">
          <FiSearch className="h-4 w-4 shrink-0 text-cyan-100" />
          <input
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="Buscar no, modulo, pessoa, evento..."
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-white/34"
          />
        </label>
        <button type="button" onClick={onTogglePending} className={`h-10 rounded-xl border px-3 text-xs font-black ${showPendingOnly ? "border-yellow-200/70 bg-yellow-200/18 text-yellow-50" : "border-white/10 bg-black/18 text-white/75 hover:border-yellow-200/50"}`}>
          Pendencias
        </button>
        <button type="button" onClick={onToggleOrphans} className={`h-10 rounded-xl border px-3 text-xs font-black ${showOrphansOnly ? "border-rose-200/70 bg-rose-200/18 text-rose-50" : "border-white/10 bg-black/18 text-white/75 hover:border-rose-200/50"}`}>
          Orfaos
        </button>
        <button type="button" onClick={onCenter} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/18 px-3 text-xs font-black text-white/75 hover:border-cyan-200/50">
          <FiCrosshair className="h-3.5 w-3.5" /> Centralizar
        </button>
        <button type="button" onClick={onRefresh} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/18 px-3 text-xs font-black text-white/75 hover:border-cyan-200/50">
          <FiRefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
        <button type="button" onClick={onClear} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/18 text-white/68 hover:border-white/35" aria-label="Limpar contexto">
          <FiRotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-white/62">
        <p>
          Brain / {currentCompany} / {currentProject} / {activeModule ?? "Todos os modulos"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {source !== "database" ? (
            <span className="rounded-full bg-cyan-100/10 px-2.5 py-1 text-cyan-50">Dados iniciais do Brain - aguardando ingestao completa.</span>
          ) : null}
          <span>{visibleNodeCount} nos</span>
          <span>{visibleEdgeCount} conexoes</span>
          <span>{pendingCount} pendencias</span>
          <select aria-label="Tipo de no" value={nodeType} onChange={(event) => onNodeTypeChange(event.target.value as BrainNodeType | "all")} className="rounded-full border border-white/10 bg-black/18 px-2 py-1 text-[11px] font-black outline-none">
            <option value="all">Tipos</option>
            {nodeTypes.map((type) => <option key={type} value={type}>{nodeTypeLabel(type)}</option>)}
          </select>
          <select aria-label="Status do no" value={nodeStatus} onChange={(event) => onNodeStatusChange(event.target.value as BrainNodeStatus | "all")} className="rounded-full border border-white/10 bg-black/18 px-2 py-1 text-[11px] font-black outline-none">
            <option value="all">Status</option>
            {statuses.map((status) => <option key={status} value={status}>{nodeStatusLabel(status)}</option>)}
          </select>
          <select aria-label="Periodo" value={period} onChange={(event) => onPeriodChange(event.target.value as "all" | "today" | "7d" | "30d")} className="rounded-full border border-white/10 bg-black/18 px-2 py-1 text-[11px] font-black outline-none">
            <option value="all">Periodo</option>
            <option value="today">Hoje</option>
            <option value="7d">7 dias</option>
            <option value="30d">30 dias</option>
          </select>
        </div>
      </div>
    </section>
  );
}
