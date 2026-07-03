"use client";

import { useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiFilter, FiRefreshCw, FiRotateCcw, FiSearch, FiSliders, FiX } from "react-icons/fi";
import type {
  BrainContextCompany,
  BrainContextProject,
  BrainNode,
  BrainNodeStatus,
  BrainNodeType,
} from "../_types/brain.types";
import { nodeStatusLabel, nodeTypeLabel } from "../_utils/brainGraphFormatters";

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

const MODULE_LABELS: Record<string, string> = {
  Automacao: "Automação",
  Chat: "Chat",
  "Chat/Brain": "Chat / Brain",
  Contexto: "Contexto",
  Defeitos: "Defeitos",
  Documentos: "Documentos",
  Execucoes: "Execuções",
  Logs: "Logs",
  Permissoes: "Permissões",
  "Plano de Teste": "Plano de teste",
  "Repositorio de Testes": "Repositório de testes",
  Runs: "Runs",
  Solicitacoes: "Solicitações",
  Suporte: "Suporte",
  Usuarios: "Usuários",
};

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) =>
    displayModule(a).localeCompare(displayModule(b), "pt-BR"),
  );
}

function displayModule(value: string) {
  return MODULE_LABELS[value] ?? value;
}

function contextLabel(company: string, project: string, area: string | null) {
  return `${company} / ${project} / ${area ? displayModule(area) : "Todas as áreas"}`;
}

function belongsToSelectedCompany(node: BrainNode, selectedCompanyId: string | null) {
  if (!selectedCompanyId) return true;
  if (node.companyId) return node.companyId === selectedCompanyId;
  return node.type === "company" || node.metadata?.isBrainCore === true || node.metadata?.isContextCore === true;
}

function belongsToSelectedProject(node: BrainNode, selectedProjectId: string | null) {
  if (!selectedProjectId) return true;
  if (node.projectId) return node.projectId === selectedProjectId;
  return node.type === "company" || node.type === "project" || node.metadata?.isBrainCore === true || node.metadata?.isContextCore === true;
}

function periodLabel(period: "all" | "today" | "7d" | "30d") {
  if (period === "today") return "Hoje";
  if (period === "7d") return "7 dias";
  if (period === "30d") return "30 dias";
  return "Todo período";
}

function resetDependentFilters(callback: () => void) {
  callback();
}

export function BrainContextSelector({
  nodes,
  companies,
  projects,
  selectedCompanyId,
  selectedProjectId,
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
  onCompanyChange,
  onProjectChange,
  onModuleChange,
  onSearchTextChange,
  onNodeTypeChange,
  onNodeStatusChange,
  onPeriodChange,
  onClear,
  onTogglePending,
  onToggleOrphans,
  onRefresh,
  source = "fallback",
}: BrainContextSelectorProps) {
  const [open, setOpen] = useState(false);
  const [apiBrainOptions, setApiBrainOptions] = useState<{
    companies: Array<{ id: string; label: string }>;
    projects: Array<{ id: string; label: string }>;
    modules: Array<{ id: string; label: string }>;
    nodes: Array<{ id: string; label: string; type?: string; module?: string; source?: string }>;
    events: Array<{ id: string; label: string; module?: string }>;
    source?: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();

    if (searchText.trim()) params.set("q", searchText.trim());
    if (activeModule) params.set("module", activeModule);
    params.set("limit", "50");

    fetch(`/api/brain/rag/context?${params.toString()}`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data) return;
        setApiBrainOptions({
          companies: Array.isArray(data.companies) ? data.companies : Array.isArray(data.filters?.companies) ? data.filters.companies : [],
          projects: Array.isArray(data.projects) ? data.projects : Array.isArray(data.filters?.projects) ? data.filters.projects : [],
          modules: Array.isArray(data.modules) ? data.modules : Array.isArray(data.filters?.modules) ? data.filters.modules : [],
          nodes: Array.isArray(data.nodes) ? data.nodes : [],
          events: Array.isArray(data.events) ? data.events : [],
          source: typeof data.source === "string" ? data.source : undefined,
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setApiBrainOptions(null);
      });

    return () => controller.abort();
  }, [activeModule, searchText]);

  const {
    projectOptions,
    modules,
    types,
    statuses,
    currentCompany,
    currentProject,
    hasAnyFilter,
    activeFilterCount,
    summaryChips,
  } = useMemo(() => {
    const companyNodes = nodes.filter((node) => belongsToSelectedCompany(node, selectedCompanyId));
    const projectOptions = selectedCompanyId
      ? projects.filter((project) => !project.companyId || project.companyId === selectedCompanyId)
      : projects;
    const projectNodes = companyNodes.filter((node) => belongsToSelectedProject(node, selectedProjectId));
    const areaNodes = activeModule ? projectNodes.filter((node) => node.module === activeModule) : projectNodes;
    const typeNodes = nodeType === "all" ? areaNodes : areaNodes.filter((node) => node.type === nodeType);

    const modules = unique([
      ...projectNodes.map((node) => node.module),
      ...(apiBrainOptions?.modules ?? []).map((module) => module.id || module.label),
    ]);
    const types = unique(areaNodes.map((node) => node.type)) as BrainNodeType[];
    const statuses = unique(typeNodes.map((node) => node.status)) as BrainNodeStatus[];

    const currentCompany = companies.find((company) => company.id === selectedCompanyId)?.name ?? "Todas as empresas";
    const currentProject = projectOptions.find((project) => project.id === selectedProjectId)?.name ?? "Todos os projetos";

    const summaryChips = [
      selectedCompanyId ? currentCompany : null,
      selectedProjectId ? currentProject : null,
      activeModule ? displayModule(activeModule) : null,
      nodeType !== "all" ? nodeTypeLabel(nodeType) : null,
      nodeStatus !== "all" ? nodeStatusLabel(nodeStatus) : null,
      period !== "all" ? periodLabel(period) : null,
      showPendingOnly ? "Só pendências" : null,
      showOrphansOnly ? "Só órfãos" : null,
      searchText ? `Busca: ${searchText}` : null,
    ].filter((item): item is string => Boolean(item));

    return {
      projectOptions,
      modules,
      types,
      statuses,
      currentCompany,
      currentProject,
      hasAnyFilter: summaryChips.length > 0,
      activeFilterCount: summaryChips.length,
      summaryChips,
    };
  }, [
    activeModule,
    apiBrainOptions,
    companies,
    nodes,
    nodeStatus,
    nodeType,
    period,
    projects,
    searchText,
    selectedCompanyId,
    selectedProjectId,
    showOrphansOnly,
    showPendingOnly,
  ]);

  return (
    <section className="qc-brain-filter-panel qc-brain-filter-panel-compact" data-open={open ? "true" : "false"}>
      <div className="qc-brain-filter-compact-bar">
        <div className="qc-brain-filter-brand" aria-label="Brain">
          <span className="qc-brain-filter-brand-logo" />
          <strong>Brain</strong>
        </div>
        <button
          type="button"
          className="qc-brain-filter-main-button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          <FiSliders aria-hidden />
          <span>Filtros</span>
          {activeFilterCount ? <strong>{activeFilterCount}</strong> : null}
        </button>

        <label className="qc-brain-filter-compact-search">
          <FiSearch aria-hidden />
          <input
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="Buscar nó, usuário, empresa, defeito, suporte, caso, plano..."
          />
        </label>

        <div className="qc-brain-filter-compact-stats">
          <span>{visibleNodeCount} nós</span>
          <span>{visibleEdgeCount} conexões</span>
          {pendingCount ? <span>{pendingCount} pendências</span> : null}
          {(apiBrainOptions?.source ?? source) !== "database" ? <span>{apiBrainOptions?.source === "brain-index" ? "API Brain" : "dados parciais"}</span> : null}
        </div>

        <button type="button" onClick={onRefresh} className="qc-brain-filter-icon-button" aria-label="Atualizar Brain" title="Atualizar Brain">
          <FiRefreshCw aria-hidden />
        </button>
      </div>

      {hasAnyFilter ? (
        <div className="qc-brain-filter-summary-chips">
          {summaryChips.slice(0, 5).map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
          {summaryChips.length > 5 ? <span>+{summaryChips.length - 5}</span> : null}
        </div>
      ) : null}

      {open ? (
        <div className="qc-brain-filter-popover">
          <div className="qc-brain-filter-popover-header">
            <div>
              <span className="qc-brain-filter-eyebrow">Recorte do Brain</span>
              <h2>Filtrar sem quebrar o fluxo dos nós</h2>
              <p>
                As opções abaixo são montadas a partir do que a API trouxe para o grafo. Se preferir, peça ao chat do Brain para ajustar o recorte por você.
              </p>
            </div>

            <button type="button" onClick={() => setOpen(false)} className="qc-brain-filter-icon-button" aria-label="Fechar filtros" title="Fechar filtros">
              <FiX aria-hidden />
            </button>
          </div>

          <div className="qc-brain-filter-grid">
            <label className="qc-brain-filter-field">
              <span>Empresa</span>
              <select
                aria-label="Empresa"
                value={selectedCompanyId ?? "all"}
                onChange={(event) => onCompanyChange(event.target.value === "all" ? null : event.target.value)}
              >
                <option value="all">Todas as empresas</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <FiChevronDown aria-hidden />
            </label>

            <label className="qc-brain-filter-field">
              <span>Projeto</span>
              <select
                aria-label="Projeto"
                value={selectedProjectId ?? "all"}
                onChange={(event) => onProjectChange(event.target.value === "all" ? null : event.target.value)}
              >
                <option value="all">Todos os projetos</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <FiChevronDown aria-hidden />
            </label>

            <label className="qc-brain-filter-field">
              <span>Área</span>
              <select
                aria-label="Área"
                value={activeModule ?? "all"}
                onChange={(event) => onModuleChange(event.target.value === "all" ? null : event.target.value)}
              >
                <option value="all">Todas as áreas</option>
                {modules.map((moduleName) => (
                  <option key={moduleName} value={moduleName}>
                    {displayModule(moduleName)}
                  </option>
                ))}
              </select>
              <FiChevronDown aria-hidden />
            </label>

            <label className="qc-brain-filter-field">
              <span>Tipo de nó</span>
              <select
                aria-label="Tipo de nó"
                value={nodeType}
                onChange={(event) => resetDependentFilters(() => onNodeTypeChange(event.target.value as BrainNodeType | "all"))}
              >
                <option value="all">Todos os tipos</option>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {nodeTypeLabel(type)}
                  </option>
                ))}
              </select>
              <FiChevronDown aria-hidden />
            </label>

            <label className="qc-brain-filter-field">
              <span>Status do nó</span>
              <select
                aria-label="Status do nó"
                value={nodeStatus}
                onChange={(event) => onNodeStatusChange(event.target.value as BrainNodeStatus | "all")}
              >
                <option value="all">Todos os status</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {nodeStatusLabel(status)}
                  </option>
                ))}
              </select>
              <FiChevronDown aria-hidden />
            </label>

            <label className="qc-brain-filter-field">
              <span>Período</span>
              <select
                aria-label="Período"
                value={period}
                onChange={(event) => onPeriodChange(event.target.value as "all" | "today" | "7d" | "30d")}
              >
                <option value="all">Todo período</option>
                <option value="today">Hoje</option>
                <option value="7d">7 dias</option>
                <option value="30d">30 dias</option>
              </select>
              <FiChevronDown aria-hidden />
            </label>
          </div>

          <div className="qc-brain-filter-actions">
            <button type="button" onClick={onTogglePending} data-active={showPendingOnly ? "true" : "false"} className="qc-brain-filter-chip qc-brain-filter-chip-pending">
              Só pendências
            </button>

            <button type="button" onClick={onToggleOrphans} data-active={showOrphansOnly ? "true" : "false"} className="qc-brain-filter-chip qc-brain-filter-chip-orphan">
              Só órfãos
            </button>

            <button type="button" onClick={onClear} className="qc-brain-filter-chip">
              <FiRotateCcw aria-hidden />
              Limpar recorte
            </button>

            <span className="qc-brain-filter-context">
              <FiFilter aria-hidden />
              Brain / {contextLabel(currentCompany, currentProject, activeModule)}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
