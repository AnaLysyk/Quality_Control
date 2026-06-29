"use client";

import { useEffect, useRef } from "react";

import { FiRefreshCw, FiRotateCcw, FiSearch } from "react-icons/fi";
import type {
  BrainContextCompany,
  BrainContextProject,
  BrainNode,
  BrainNodeStatus,
  BrainNodeType,
} from "../_types/brain.types";
import { nodeStatusLabel } from "../_utils/brainGraphFormatters";

type BrainContextSelectorProps = {
  nodes: BrainNode[];
  companies: BrainContextCompany[];
  projects: BrainContextProject[];
  selectedCompanyId: string | null;
  selectedProjectId: string | null;
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
  onCompanyChange: (value: string | null) => void;
  onProjectChange: (value: string | null) => void;
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

function moduleLabel(value: string | null) {
  return value ?? "Todos os modulos";
}

export function BrainContextSelector({
  nodes,
  companies,
  projects,
  selectedCompanyId,
  selectedProjectId,
  activeModule,
  searchText,
  nodeStatus,
  period,
  showOrphansOnly,
  showPendingOnly,
  visibleNodeCount,
  visibleEdgeCount,
  pendingCount,
  onCompanyChange,
  onProjectChange,
  onModuleChange,
  onSearchTextChange,
  onNodeStatusChange,
  onPeriodChange,
  onClear,
  onTogglePending,
  onToggleOrphans,
  onRefresh,
  source = "fallback",
}: BrainContextSelectorProps) {
  const companyNodes = selectedCompanyId
    ? nodes.filter((node) => !node.companyId || node.companyId === selectedCompanyId)
    : nodes;

  const projectNodes = selectedProjectId
    ? companyNodes.filter((node) => !node.projectId || node.projectId === selectedProjectId)
    : companyNodes;

  const moduleNodes = activeModule
    ? projectNodes.filter((node) => node.module === activeModule)
    : projectNodes;

  const projectOptions = selectedCompanyId
    ? projects.filter((project) => !project.companyId || project.companyId === selectedCompanyId)
    : projects;

  const modules = unique(projectNodes.map((node) => node.module));
  const statuses = unique(moduleNodes.map((node) => node.status)) as BrainNodeStatus[];

  const currentCompany =
    companies.find((company) => company.id === selectedCompanyId)?.name ?? "Todas as empresas";

  const currentProject =
    projectOptions.find((project) => project.id === selectedProjectId)?.name ?? "Todos os projetos";


  const panelStyle = {
    background: "linear-gradient(145deg, rgba(4, 13, 29, 0.98), rgba(8, 19, 34, 0.96))",
    border: "1px solid rgba(125, 211, 252, 0.22)",
    color: "#e5eefc",
    boxShadow: "0 22px 70px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
    backdropFilter: "blur(18px) saturate(1.18)",
    WebkitBackdropFilter: "blur(18px) saturate(1.18)",
  } as const;

  const controlStyle = {
    background: "rgba(7, 17, 32, 0.96)",
    borderColor: "rgba(148, 163, 184, 0.28)",
    color: "#e5eefc",
  } as const;
  // QC_BRAIN_FORCE_DARK_DOM_START
  const filterRootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = filterRootRef.current;

    if (!root) return;

    root.style.setProperty("background", "linear-gradient(145deg, rgba(4, 13, 29, 0.98), rgba(8, 19, 34, 0.96))", "important");
    root.style.setProperty("border", "1px solid rgba(125, 211, 252, 0.22)", "important");
    root.style.setProperty("color", "#e5eefc", "important");
    root.style.setProperty("box-shadow", "0 22px 70px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.05)", "important");
    root.style.setProperty("backdrop-filter", "blur(18px) saturate(1.18)", "important");
    root.style.setProperty("-webkit-backdrop-filter", "blur(18px) saturate(1.18)", "important");

    root.querySelectorAll<HTMLElement>("select, input, button, label").forEach((element) => {
      element.style.setProperty("background", "rgba(7, 17, 32, 0.96)", "important");
      element.style.setProperty("border-color", "rgba(148, 163, 184, 0.28)", "important");
      element.style.setProperty("color", "#e5eefc", "important");
      element.style.setProperty("box-shadow", "none", "important");
    });

    root.querySelectorAll<HTMLElement>("p, span").forEach((element) => {
      element.style.setProperty("color", "rgba(226, 232, 240, 0.68)", "important");
    });

    root.querySelectorAll<HTMLElement>("svg").forEach((element) => {
      element.style.setProperty("color", "#a5f3fc", "important");
      element.style.setProperty("stroke", "#a5f3fc", "important");
    });
  });
  // QC_BRAIN_FORCE_DARK_DOM_END
  return (
    <section ref={filterRootRef} style={panelStyle} className="qc-brain-filter-panel rounded-[22px] p-3 text-white">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.1fr_1fr_1fr_1fr_auto_auto]">
        <select
          aria-label="Empresa"
          value={selectedCompanyId ?? "all"}
          onChange={(event) => onCompanyChange(event.target.value === "all" ? null : event.target.value)}
          style={controlStyle} className="h-10 rounded-xl border px-3 text-xs font-black outline-none"
        >
          <option value="all">Todas as empresas</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Projeto"
          value={selectedProjectId ?? "all"}
          onChange={(event) => onProjectChange(event.target.value === "all" ? null : event.target.value)}
          style={controlStyle} className="h-10 rounded-xl border px-3 text-xs font-black outline-none"
        >
          <option value="all">Todos os projetos</option>
          {projectOptions.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Modulo"
          value={activeModule ?? "all"}
          onChange={(event) => onModuleChange(event.target.value === "all" ? null : event.target.value)}
          style={controlStyle} className="h-10 rounded-xl border px-3 text-xs font-black outline-none"
        >
          <option value="all">Todos os modulos</option>
          {modules.map((moduleName) => (
            <option key={moduleName} value={moduleName}>
              {moduleName}
            </option>
          ))}
        </select>

        <select
          aria-label="Status"
          value={nodeStatus}
          onChange={(event) => onNodeStatusChange(event.target.value as BrainNodeStatus | "all")}
          style={controlStyle} className="h-10 rounded-xl border px-3 text-xs font-black outline-none"
        >
          <option value="all">Todos os status</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {nodeStatusLabel(status)}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onTogglePending}
          className={`h-10 rounded-xl border px-3 text-xs font-black ${
            showPendingOnly
              ? "border-yellow-200/60 bg-yellow-200/18 text-yellow-50"
              : "border-white/10 bg-black/20 text-white/75 hover:border-yellow-200/50"
          }`}
        >
          Pendencias
        </button>

        <button
          type="button"
          onClick={onToggleOrphans}
          className={`h-10 rounded-xl border px-3 text-xs font-black ${
            showOrphansOnly
              ? "border-rose-200/60 bg-rose-200/18 text-rose-50"
              : "border-white/10 bg-black/20 text-white/75 hover:border-rose-200/50"
          }`}
        >
          Orfaos
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label style={controlStyle} className="flex h-10 min-w-[260px] flex-1 items-center gap-2 rounded-xl border px-3 text-xs font-bold">
          <FiSearch className="h-4 w-4 shrink-0 text-cyan-100" />
          <input
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="Buscar no contexto selecionado..."
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-white/35"
          />
        </label>

        <select
          aria-label="Periodo"
          value={period}
          onChange={(event) => onPeriodChange(event.target.value as "all" | "today" | "7d" | "30d")}
          style={controlStyle} className="h-10 rounded-xl border px-3 text-xs font-black outline-none"
        >
          <option value="all">Todo periodo</option>
          <option value="today">Hoje</option>
          <option value="7d">7 dias</option>
          <option value="30d">30 dias</option>
        </select>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/75 hover:border-cyan-200/50"
          aria-label="Atualizar Brain"
        >
          <FiRefreshCw className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/75 hover:border-white/35"
          aria-label="Limpar filtros"
        >
          <FiRotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-white/58">
        <span>
          Brain / {currentCompany} / {currentProject} / {moduleLabel(activeModule)}
        </span>

        <span>
          {visibleNodeCount} nos · {visibleEdgeCount} conexoes · {pendingCount} pendencias
          {source !== "database" ? " · dados parciais" : ""}
        </span>
      </div>
    </section>
  );
}

