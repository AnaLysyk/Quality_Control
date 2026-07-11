"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiBriefcase, FiFolder, FiHelpCircle, FiRefreshCw, FiRotateCcw, FiSearch, FiSliders, FiTag, FiX } from "react-icons/fi";
import { fetchBrainDashboardData } from "../_api/brain.client";
import { buildMockBrainGraph } from "../_data/brainMockGraph";
import type { BrainContextCompany, BrainContextProject, BrainContextResponse, BrainEdge, BrainGraphSummary, BrainNode, BrainNodeStatus, BrainNodeType, BuiltBrainGraph } from "../_types/brain.types";
import { buildAccessRequestsBrainGraph, mergeBrainGraphs } from "../_utils/brainGraphBuilder";
import { nodeStatusLabel, nodeTypeLabel } from "../_utils/brainGraphFormatters";
import { getVisibleGraph } from "../_utils/brainGraphLayout";
import { getBrainProfileTypes } from "../_utils/brainProfileGraphView";
import { BrainNeuralCanvas } from "./BrainNeuralCanvas";

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function contextCompaniesFromNodes(nodes: BrainNode[]): BrainContextCompany[] {
  const companies = nodes
    .map((node) => ({ id: node.companyId, name: node.companyName }))
    .filter((company): company is { id: string; name: string } => Boolean(company.id && company.name));
  return uniqueById(companies).map((company) => ({ id: company.id, name: company.name }));
}

function contextProjectsFromNodes(nodes: BrainNode[]): BrainContextProject[] {
  const projects: BrainContextProject[] = nodes.flatMap((node) =>
    node.projectId && node.projectName
      ? [{ id: node.projectId, name: node.projectName, companyId: node.companyId ?? null }]
      : [],
  );
  return uniqueById(projects);
}

function summarize(nodes: BrainNode[], edges: BrainEdge[], base: BuiltBrainGraph): BrainGraphSummary {
  const connected = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const pendingMappings = uniqueById(
    nodes.flatMap((node) => (node.missingKnowledge ?? []).map((item, index) => ({ id: `${node.id}:${index}:${item}`, item }))),
  ).map((entry) => entry.item);

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    totalModules: new Set(nodes.map((node) => node.module)).size,
    companies: new Set(nodes.map((node) => node.companyId).filter(Boolean)).size,
    projects: new Set(nodes.map((node) => node.projectId).filter(Boolean)).size,
    modules: new Set(nodes.map((node) => node.module)).size,
    accessRequestNodes: nodes.filter((node) => node.type === "access_request").length,
    requestsWithoutNode: base.summary.requestsWithoutNode,
    orphanNodes: nodes.filter((node) => !connected.has(node.id)).length,
    pendingNodes: nodes.filter((node) => ["pending", "missing", "warning", "error", "orphan"].includes(node.status)).length,
    missingKnowledge: pendingMappings.length,
    eventsToday: nodes.filter((node) => node.createdAt && new Date(node.createdAt).toDateString() === new Date().toDateString()).length,
    generatedByBrain: nodes.filter((node) => node.generatedBy === "brain").length,
    generatedByAutomation: nodes.filter((node) => node.generatedBy === "automation").length,
    generatedByUsers: nodes.filter((node) => node.generatedBy === "user").length,
    logsLinked: nodes.filter((node) => node.type === "log" && node.status === "ok").length,
    pendingMappings: uniqueById([...base.summary.pendingMappings, ...pendingMappings].map((item) => ({ id: item, item }))).map((entry) => entry.item),
  };
}

function mergeWithNeuralMock(graph: BuiltBrainGraph): BuiltBrainGraph {
  const mock = buildMockBrainGraph();
  const nodes = uniqueById([...mock.nodes, ...graph.nodes]);
  const edges = uniqueById([...mock.edges, ...graph.edges]);
  return {
    ...graph,
    nodes,
    edges,
    summary: summarize(nodes, edges, graph.requests.length ? graph : mock),
  };
}

function emptyGraph() {
  return buildMockBrainGraph();
}

type FetchedBrainDashboardData = Awaited<ReturnType<typeof fetchBrainDashboardData>>;

/**
 * Une graph (executiveContext + subgrafo real), domainGraph e o grafo operacional de
 * solicitacoes num unico grafo, deduplicando por ID e descartando arestas orfas.
 * Nunca escolhe uma fonte e descarta as outras.
 */
function buildMergedGraph(data: FetchedBrainDashboardData): BuiltBrainGraph {
  const accessBuilt = buildAccessRequestsBrainGraph({
    requests: data.requests,
    removalHistory: data.removalHistory,
    auditLogs: data.auditLogs,
    domainNodes: data.domainGraph.nodes,
    domainEdges: data.domainGraph.edges,
    realBrainNodes: data.graph.nodes,
    realBrainEdges: data.graph.edges,
  });

  const merged = mergeBrainGraphs(accessBuilt, { nodes: data.graph.nodes, edges: data.graph.edges });

  const built: BuiltBrainGraph = {
    nodes: merged.nodes,
    edges: merged.edges,
    requests: data.requests,
    removalHistory: data.removalHistory,
    auditLogs: data.auditLogs,
    summary: summarize(merged.nodes, merged.edges, accessBuilt),
  };

  return built.nodes.length > 0 ? built : mergeWithNeuralMock(built);
}

function brainCanSeeAllCompanies(context: BrainContextResponse | null) {
  // Fonte unica de verdade: o backend (resolveBrainAccess/hasGlobalBrainVisibility) ja calcula
  // isso a partir da matriz efetiva de permissoes. Nao duplicar a regra aqui por nome de perfil.
  return Boolean(context?.permissions?.canViewGlobalBrain);
}

function defaultCompanyForBrain(context: BrainContextResponse | null) {
  return brainCanSeeAllCompanies(context) ? null : context?.defaultContext.companyId ?? null;
}

function defaultProjectForBrain(context: BrainContextResponse | null) {
  return brainCanSeeAllCompanies(context) ? null : context?.defaultContext.projectId ?? null;
}

function mergeContextCompanies(context: BrainContextResponse | null, nodes: BrainNode[]): BrainContextCompany[] {
  const fromContext = context?.companies ?? [];
  const fromNodes = contextCompaniesFromNodes(nodes);
  return uniqueById([...fromContext, ...fromNodes])
    .filter((company) => Boolean(company.id && company.name))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function mergeContextProjects(context: BrainContextResponse | null, nodes: BrainNode[]): BrainContextProject[] {
  const fromContext = context?.projects ?? [];
  const fromNodes = contextProjectsFromNodes(nodes);
  return uniqueById([...fromContext, ...fromNodes])
    .filter((project) => Boolean(project.id && project.name))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

const ASSISTANT_CONTEXT_NODE_LIMIT = 80;
const ASSISTANT_CONTEXT_EDGE_LIMIT = 120;
const ASSISTANT_CONTEXT_STATUS_LIMIT = 40;

function compactNodeForAssistant(node: BrainNode) {
  return {
    id: node.id,
    label: node.label,
    type: node.type,
    module: node.module,
    status: node.status,
  };
}

function compactEdgeForAssistant(edge: BrainEdge) {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: edge.type,
    status: edge.status,
  };
}

export function BrainNeuralDashboard() {
  const [graph, setGraph] = useState<BuiltBrainGraph>(() => emptyGraph());
  const [brainContext, setBrainContext] = useState<BrainContextResponse | null>(null);
  const [, setDataErrors] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProfileType, setSelectedProfileType] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [showOrphansOnly, setShowOrphansOnly] = useState(false);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [nodeType, setNodeType] = useState<BrainNodeType | "all">("all");
  const [nodeStatus, setNodeStatus] = useState<BrainNodeStatus | "all">("all");
  const [period, setPeriod] = useState<"all" | "today" | "7d" | "30d">("all");
  const [localGraphOnly, setLocalGraphOnly] = useState(false);
  const [selectedNode, setSelectedNode] = useState<BrainNode | null>(null);
  const [nodeHistory, setNodeHistory] = useState<BrainNode[]>([]);
  const [graphSource, setGraphSource] = useState<"database" | "fallback" | "partial">("fallback");
  const [debugMode, setDebugMode] = useState(false);
  const [filterCollapsed, setFilterCollapsed] = useState(true);
  const [filterHelpVisible, setFilterHelpVisible] = useState(true);
  const filterPanelRef = useRef<HTMLElement | null>(null);
  const appliedQueryFocusRef = useRef(false);

  useEffect(() => {
    document.body.classList.add("qc-brain-route", "qc-brain-active-route");
    return () => document.body.classList.remove("qc-brain-route", "qc-brain-active-route");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setDebugMode(params.get("debug") === "1");
  }, []);

  function loadBrainData() {
    setLoadingData(true);
    fetchBrainDashboardData()
      .then((data) => {
        const merged = buildMergedGraph(data);
        setBrainContext(data.context);
        setSelectedCompanyId(defaultCompanyForBrain(data.context));
        setSelectedProjectId(defaultProjectForBrain(data.context));
        setSelectedProfileType(null);
        setActiveModule(null);
        setGraph(merged);
        setSelectedNode(null);
        setDataErrors(data.errors);
        setGraphSource(data.errors.length ? "partial" : "database");
      })
      .catch((error) => {
        const fallback = emptyGraph();
        setDataErrors([error instanceof Error ? error.message : "Erro ao carregar Brain. Usando grafo inicial."]);
        setGraph(fallback);
        setSelectedNode(null);
        setGraphSource("fallback");
      })
      .finally(() => setLoadingData(false));
  }

  useEffect(() => {
    let cancelled = false;
    fetchBrainDashboardData()
      .then((data) => {
        if (cancelled) return;
        const merged = buildMergedGraph(data);
        setBrainContext(data.context);
        setSelectedCompanyId(defaultCompanyForBrain(data.context));
        setSelectedProjectId(defaultProjectForBrain(data.context));
        setGraph(merged);
        setSelectedNode(null);
        setDataErrors(data.errors);
        setGraphSource(data.errors.length ? "partial" : "database");
      })
      .catch((error) => {
        if (cancelled) return;
        const fallback = emptyGraph();
        setDataErrors([error instanceof Error ? error.message : "Erro ao carregar Brain. Usando grafo inicial."]);
        setGraph(fallback);
        setSelectedNode(null);
        setGraphSource("fallback");
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const contextCompanies = useMemo(() => mergeContextCompanies(brainContext, graph.nodes), [brainContext, graph.nodes]);
  const contextProjects = useMemo(() => mergeContextProjects(brainContext, graph.nodes), [brainContext, graph.nodes]);
  const profileTypes = useMemo(() => getBrainProfileTypes(graph.nodes), [graph.nodes]);
  const canSeeAllCompanies = brainCanSeeAllCompanies(brainContext);

  const filteredGraph = useMemo(
    () =>
      getVisibleGraph(graph.nodes, graph.edges, {
        companyId: selectedCompanyId,
        projectId: selectedProjectId,
        moduleFilter: activeModule,
        showOrphansOnly,
        showPendingOnly,
        searchText,
        focusNodeId: selectedNode?.id ?? null,
        localGraphOnly,
        nodeType,
        nodeStatus,
        period,
        profileType: selectedProfileType,
      }),
    [activeModule, graph.edges, graph.nodes, localGraphOnly, nodeStatus, nodeType, period, searchText, selectedCompanyId, selectedNode?.id, selectedProjectId, showOrphansOnly, showPendingOnly],
  );

  const visibleGraph = useMemo(
    () => ({ ...filteredGraph, focusModule: activeModule ?? null }),
    [activeModule, filteredGraph],
  );

  useEffect(() => {
    if (appliedQueryFocusRef.current || loadingData || graph.nodes.length === 0) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const nodeId = params.get("node");
    if (!nodeId) {
      appliedQueryFocusRef.current = true;
      return;
    }
    const node = graph.nodes.find((item) => item.id === nodeId) ?? null;
    if (node) setSelectedNode(node);
    appliedQueryFocusRef.current = true;
  }, [graph.nodes, loadingData]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleBrainPopState() {
      const params = new URLSearchParams(window.location.search);
      const nodeId = params.get("node");
      const node = nodeId ? graph.nodes.find((item) => item.id === nodeId) ?? null : null;

      setSelectedNode(node);
      setLocalGraphOnly(Boolean(node));
    }

    window.addEventListener("popstate", handleBrainPopState);
    return () => window.removeEventListener("popstate", handleBrainPopState);
  }, [graph.nodes]);

  const visibleEdgesByNode = useMemo(() => {
    const byNode = new Map<string, BrainEdge[]>();
    for (const edge of visibleGraph.edges) {
      const sourceEdges = byNode.get(edge.source) ?? [];
      sourceEdges.push(edge);
      byNode.set(edge.source, sourceEdges);

      const targetEdges = byNode.get(edge.target) ?? [];
      targetEdges.push(edge);
      byNode.set(edge.target, targetEdges);
    }
    return byNode;
  }, [visibleGraph.edges]);
  const selectedNodeConnections = useMemo(
    () => selectedNode ? (visibleEdgesByNode.get(selectedNode.id) ?? []).slice(0, ASSISTANT_CONTEXT_EDGE_LIMIT) : [],
    [selectedNode?.id, visibleEdgesByNode],
  );
  const visibleConnected = useMemo(() => new Set(visibleGraph.edges.flatMap((edge) => [edge.source, edge.target])), [visibleGraph.edges]);
  const visiblePendingNodes = useMemo(
    () => visibleGraph.nodes.filter((node) => ["pending", "missing", "warning", "error", "orphan"].includes(node.status)).slice(0, ASSISTANT_CONTEXT_STATUS_LIMIT),
    [visibleGraph.nodes],
  );
  const visibleOrphanNodes = useMemo(
    () => visibleGraph.nodes.filter((node) => !visibleConnected.has(node.id)).slice(0, ASSISTANT_CONTEXT_STATUS_LIMIT),
    [visibleConnected, visibleGraph.nodes],
  );
  const assistantVisibleNodes = useMemo(() => {
    const selectedId = selectedNode?.id ?? null;
    const selected = selectedId ? visibleGraph.nodes.find((node) => node.id === selectedId) ?? null : null;
    const output: BrainNode[] = [];
    const seen = new Set<string>();
    const add = (node: BrainNode | null | undefined) => {
      if (!node || seen.has(node.id) || output.length >= ASSISTANT_CONTEXT_NODE_LIMIT) return;
      seen.add(node.id);
      output.push(node);
    };

    add(selected);
    visiblePendingNodes.forEach(add);
    visibleGraph.nodes.filter((node) => node.size === "lg" || node.type === "module" || node.type === "company" || node.type === "project").forEach(add);
    visibleGraph.nodes.forEach(add);

    return output.map(compactNodeForAssistant);
  }, [selectedNode?.id, visibleGraph.nodes, visiblePendingNodes]);
  const assistantVisibleNodeIds = useMemo(() => new Set(assistantVisibleNodes.map((node) => node.id)), [assistantVisibleNodes]);
  const assistantVisibleEdges = useMemo(() => {
    const selectedId = selectedNode?.id ?? null;
    const output: ReturnType<typeof compactEdgeForAssistant>[] = [];

    for (const edge of visibleGraph.edges) {
      const connectsSelected = Boolean(selectedId && (edge.source === selectedId || edge.target === selectedId));
      const connectsContext = assistantVisibleNodeIds.has(edge.source) && assistantVisibleNodeIds.has(edge.target);
      if (!connectsSelected && !connectsContext) continue;
      output.push(compactEdgeForAssistant(edge));
      if (output.length >= ASSISTANT_CONTEXT_EDGE_LIMIT) break;
    }

    return output;
  }, [assistantVisibleNodeIds, selectedNode?.id, visibleGraph.edges]);
  const currentCompanyName = contextCompanies.find((company) => company.id === selectedCompanyId)?.name ?? (canSeeAllCompanies ? "Todas as empresas" : contextCompanies[0]?.name) ?? "Contexto institucional";
  const currentProjectName = contextProjects.find((project) => project.id === selectedProjectId)?.name ?? "Todos os projetos";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const brainScreenRuntimeContext = {
      route: "/brain",
      currentPath: ["Quality Control", selectedProfileType, currentCompanyName, currentProjectName, activeModule, selectedNode?.label].filter(Boolean),
      companyId: selectedCompanyId,
      companyName: currentCompanyName,
      projectId: selectedProjectId,
      projectName: currentProjectName,
      selectedProfileType,
      activeModule,
      activeCore: visibleGraph.focusModule,
      selectedNodeId: selectedNode?.id ?? null,
      selectedNodeLabel: selectedNode?.label ?? null,
      selectedNodeType: selectedNode?.type ?? null,
      selectedNodeConnections,
      visibleNodes: assistantVisibleNodes,
      visibleEdges: assistantVisibleEdges,
      pendingNodes: visiblePendingNodes.map(compactNodeForAssistant),
      orphanNodes: visibleOrphanNodes.map(compactNodeForAssistant),
      source: graphSource,
      viewType: selectedNode ? "detail" : activeModule ? "module" : selectedCompanyId ? "company" : selectedProfileType ? "profile" : "profile-root",
      permissions: brainContext?.permissions ?? null,
    };

    (window as unknown as { __QC_BRAIN_CONTEXT__?: unknown }).__QC_BRAIN_CONTEXT__ = brainScreenRuntimeContext;
    window.dispatchEvent(
      new CustomEvent("assistant:context", {
        detail: {
          source: "brain",
          route: "/brain",
          nodeId: selectedNode?.id ?? null,
          nodeLabel: selectedNode?.label ?? null,
          nodeType: selectedNode?.type ?? null,
          entityId: selectedNode?.id ?? null,
          entityType: selectedNode?.type ?? "screen",
          agentMode: "qa",
          metadata: brainScreenRuntimeContext,
        },
      }),
    );
  }, [activeModule, assistantVisibleEdges, assistantVisibleNodes, brainContext?.permissions, currentCompanyName, currentProjectName, graphSource, selectedCompanyId, selectedNode, selectedNodeConnections, selectedProfileType, selectedProjectId, visibleGraph.focusModule, visibleOrphanNodes, visiblePendingNodes]);

  function pushBrainNodeUrl(node: BrainNode | null, mode: "push" | "replace" = "push") {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);

    if (node?.id) {
      url.searchParams.set("node", node.id);
    } else {
      url.searchParams.delete("node");
    }

    const state = node?.id
      ? { source: "brain-node", nodeId: node.id }
      : { source: "brain-core" };

    if (mode === "replace") {
      window.history.replaceState(state, "", url);
    } else {
      window.history.pushState(state, "", url);
    }
  }

  function goToBrainCore() {
    setSelectedNode(null);
    setNodeHistory([]);
    setActiveModule(null);
    setSelectedProfileType(null);
    setLocalGraphOnly(false);
    pushBrainNodeUrl(null, "replace");
  }

  function handleBackNode() {
    const previous = nodeHistory[nodeHistory.length - 1] ?? null;

    if (previous) {
      setNodeHistory((current) => current.slice(0, -1));
      setSelectedNode(previous);
      setLocalGraphOnly(true);
      pushBrainNodeUrl(previous, "replace");
      return;
    }

    goToBrainCore();
  }

  function resetScope() {
    goToBrainCore();
  }

  function handleSelectNode(node: BrainNode) {
    if (selectedNode && selectedNode.id !== node.id) {
      setNodeHistory((current) => [...current.filter((item) => item.id !== selectedNode.id), selectedNode].slice(-24));
    }

    setSelectedNode(node);
    setLocalGraphOnly(true);
    pushBrainNodeUrl(node);

    if (node.metadata?.isScopeHub) {
      if (node.metadata.scopeType === "requests") setNodeType("access_request");
      if (node.metadata.scopeType === "users") setNodeType("all");
      setActiveModule(null);
      return;
    }

    if (node.metadata?.isUserHub) {
      setActiveModule(null);
      return;
    }

    if (node.metadata?.isProfileRoot) {
      setSelectedProfileType(String(node.metadata.profileType ?? node.label));
      setActiveModule(null);
      return;
    }

    if (node.metadata?.isCompanyHub || node.type === "company") {
      if (node.companyId) setSelectedCompanyId(node.companyId);
      setActiveModule(null);
      return;
    }

    if (node.metadata?.isModuleHub) {
      setActiveModule(String(node.metadata?.module ?? node.label));
      return;
    }

    if (node.type === "module") {
      setActiveModule(node.module);
    }
  }

  function handleSelectCompany(companyId: string | null) {
    setSelectedCompanyId(companyId);
    setSelectedProjectId(null);
    setActiveModule(null);
    setNodeType("all");
    setNodeStatus("all");
    setSearchText("");
    setShowOrphansOnly(false);
    setShowPendingOnly(false);
    setLocalGraphOnly(false);
    setSelectedNode(null);
  }

  function handleSelectProject(projectId: string | null) {
    setSelectedProjectId(projectId);
    setActiveModule(null);
    setNodeType("all");
    setNodeStatus("all");
    setSearchText("");
    setShowOrphansOnly(false);
    setShowPendingOnly(false);
    setLocalGraphOnly(false);
    setSelectedNode(null);
  }

  function handleSelectProfile(profile: string | null) {
    setSelectedProfileType(profile);
    setActiveModule(null);
    setNodeType("all");
    setNodeStatus("all");
    setSelectedNode(null);
  }

  function handleSelectModule(module: string | null) {
    setActiveModule(module);
    setNodeType("all");
    setNodeStatus("all");
    setSearchText("");
    setShowOrphansOnly(false);
    setShowPendingOnly(false);
    setLocalGraphOnly(false);
    setSelectedNode(null);
  }

  function handleShowAll() {
    setSelectedCompanyId(defaultCompanyForBrain(brainContext));
    setSelectedProjectId(defaultProjectForBrain(brainContext));
    setSelectedProfileType(null);
    setActiveModule(null);
    setShowOrphansOnly(false);
    setShowPendingOnly(false);
    setSearchText("");
    setNodeType("all");
    setNodeStatus("all");
    setPeriod("all");
    setLocalGraphOnly(false);
    setSelectedNode(null);
  }

  const smartFilterResults = useMemo(() => {
    const query = searchText
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "")
      .trim();

    const degreeByNode = new Map<string, number>();
    for (const node of graph.nodes) degreeByNode.set(node.id, 0);
    for (const edge of graph.edges) {
      degreeByNode.set(edge.source, (degreeByNode.get(edge.source) ?? 0) + 1);
      degreeByNode.set(edge.target, (degreeByNode.get(edge.target) ?? 0) + 1);
    }

    const matches = graph.nodes.filter((node) => {
      if (!query) return true;

      const metadata = node.metadata ?? {};
      const haystack = [
        node.label,
        node.type,
        node.module,
        node.status,
        node.description,
        node.information,
        node.companyName,
        node.projectName,
        node.refType,
        node.refId,
        typeof metadata.route === "string" ? metadata.route : "",
        typeof metadata.source === "string" ? metadata.source : "",
        typeof metadata.entityType === "string" ? metadata.entityType : "",
        ...(node.missingKnowledge ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\\u0300-\\u036f]/g, "");

      return haystack.includes(query);
    });

    return matches
      .sort((left, right) => {
        const rightDegree = degreeByNode.get(right.id) ?? 0;
        const leftDegree = degreeByNode.get(left.id) ?? 0;
        if (rightDegree !== leftDegree) return rightDegree - leftDegree;
        return left.label.localeCompare(right.label, "pt-BR");
      })
      .slice(0, 10);
  }, [graph.edges, graph.nodes, searchText]);

  function openNodeFromSmartFilter(node: BrainNode) {
    setSelectedCompanyId(null);
    setSelectedProjectId(null);
    setNodeType("all");
    setNodeStatus("all");
    setShowPendingOnly(false);
    setShowOrphansOnly(false);
    setSelectedNode(node);
    setLocalGraphOnly(true);
    setFilterCollapsed(true);
    setSearchText(node.label);
  }

  function applySmartContextSearch(value: string) {
    setSelectedCompanyId(null);
    setSelectedProjectId(null);
    setNodeType("all");
    setNodeStatus("all");
    setShowPendingOnly(false);
    setShowOrphansOnly(false);
    setLocalGraphOnly(false);
    setSearchText(value);
    setFilterCollapsed(false);
  }

  const nodeTypeOptions = useMemo(
    () => Array.from(
      new Set(graph.nodes.map((node) => node.type).filter((value): value is BrainNodeType => Boolean(value))),
    ).sort(),
    [graph.nodes],
  );

  const nodeStatusOptions = useMemo(
    () => Array.from(
      new Set(graph.nodes.map((node) => node.status).filter((value): value is BrainNodeStatus => Boolean(value))),
    ).sort(),
    [graph.nodes],
  );

  const activeFilterCount = [
    selectedCompanyId,
    selectedProjectId,
    selectedProfileType,
    activeModule,
    searchText.trim() || null,
    nodeType !== "all" ? nodeType : null,
    nodeStatus !== "all" ? nodeStatus : null,
    period !== "all" ? period : null,
    localGraphOnly ? "local" : null,
    showPendingOnly ? "pending" : null,
    showOrphansOnly ? "orphan" : null,
  ].filter(Boolean).length;

  useEffect(() => {
    if (filterCollapsed) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFilterCollapsed(true);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filterCollapsed]);

  function clearSmartFilters() {
    setSelectedCompanyId(defaultCompanyForBrain(brainContext));
    setSelectedProjectId(defaultProjectForBrain(brainContext));
    setSelectedProfileType(null);
    setActiveModule(null);
    setSearchText("");
    setNodeType("all");
    setNodeStatus("all");
    setPeriod("all");
    setLocalGraphOnly(false);
    setShowPendingOnly(false);
    setShowOrphansOnly(false);
    setSelectedNode(null);
  }

  const filterHud = (
    <>
      {filterHelpVisible && filterCollapsed ? (
        <div className="pointer-events-auto fixed right-6 top-[164px] z-[2147482999] hidden w-72 rounded-2xl border border-cyan-100/20 bg-slate-950/94 p-4 text-sm leading-5 text-cyan-50 shadow-[0_18px_70px_rgba(0,0,0,0.42)] backdrop-blur-xl lg:block">
          <button
            type="button"
            onClick={() => setFilterHelpVisible(false)}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
            aria-label="Fechar dica"
          >
            <FiX className="h-3.5 w-3.5" />
          </button>
          <p className="pr-7 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/60">Encontre qualquer nó</p>
          <p className="mt-1 pr-4 font-semibold text-white/85">
            Use a busca, abra os filtros inteligentes ou peça ajuda ao Brian.
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setFilterCollapsed((current) => !current)}
        className="fixed right-6 top-24 z-[2147483001] flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-100/20 bg-slate-950/94 text-cyan-100 shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-100/40 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70"
        aria-label={filterCollapsed ? "Abrir filtros inteligentes do Brain" : "Fechar filtros inteligentes do Brain"}
        aria-expanded={!filterCollapsed}
        title="Filtros inteligentes do Brain"
      >
        <FiSliders className="h-5 w-5" />
        {activeFilterCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-cyan-300 px-1 text-[10px] font-black text-slate-950">
            {activeFilterCount}
          </span>
        ) : null}
      </button>

      {!filterCollapsed ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[2147482999] cursor-default bg-slate-950/20 backdrop-blur-[1px]"
            onClick={() => setFilterCollapsed(true)}
            aria-label="Fechar filtros"
          />
          <aside
            ref={filterPanelRef}
            className="fixed bottom-6 right-6 top-[164px] z-[2147483000] flex w-[min(430px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/96 text-white shadow-[0_24px_90px_rgba(0,0,0,0.62)] backdrop-blur-2xl"
            aria-label="Filtros inteligentes do Brain"
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-base font-black text-white">Filtros inteligentes</p>
                <p className="mt-0.5 text-xs font-medium text-slate-400">
                  {visibleGraph.nodes.length} nós encontrados · {visibleGraph.edges.length} conexões
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFilterCollapsed(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
                aria-label="Fechar filtros"
              >
                <FiX className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5">
              <section className="border-b border-white/[0.07] py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/55">Atalhos de contexto</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={clearSmartFilters} className="rounded-full bg-cyan-300/20 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-300/28">Todos</button>
                  <button type="button" onClick={() => applySmartContextSearch("login acesso auth usuario usuário perfil permissao permissão solicitacao solicitação token session")} className="rounded-full bg-white/6 px-3 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/12 hover:text-white">Acesso/Login</button>
                  <button type="button" onClick={() => applySmartContextSearch("empresa company projeto project application aplicacao aplicação cliente usuario usuário vinculo vínculo")} className="rounded-full bg-white/6 px-3 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/12 hover:text-white">Empresas/Projetos</button>
                  <button type="button" onClick={() => applySmartContextSearch("brain rag memoria memória contexto log audit auditoria historico histórico")} className="rounded-full bg-white/6 px-3 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/12 hover:text-white">Brain</button>
                  <button type="button" onClick={() => applySmartContextSearch("test teste run plano case caso execucao execução resultado smoke regressao regressão")} className="rounded-full bg-white/6 px-3 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/12 hover:text-white">QA/Testes</button>
                  <button type="button" onClick={() => applySmartContextSearch("wiki documento documentacao documentação evidencia evidência manual regra conhecimento")} className="rounded-full bg-white/6 px-3 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/12 hover:text-white">Docs/Wiki</button>
                  <button type="button" onClick={() => applySmartContextSearch("log logs auditoria audit historico histórico evento event")} className="rounded-full bg-white/6 px-3 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/12 hover:text-white">Logs</button>
                </div>
              </section>

              <section className="border-b border-white/[0.07] py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/55">Refinar busca</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2.5">
                    <span className="flex items-center gap-2 text-[10px] font-semibold text-slate-400"><FiBriefcase /> Empresa</span>
                    <select value={selectedCompanyId ?? "all"} onChange={(event) => handleSelectCompany(event.target.value === "all" ? null : event.target.value)} className="mt-1 w-full bg-transparent text-sm font-semibold text-white outline-none">
                      <option value="all">Todas</option>
                      {contextCompanies.map((company) => <option key={`${company.id}:${company.name}`} value={company.id}>{company.name}</option>)}
                    </select>
                  </label>
                  <label className="rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2.5">
                    <span className="flex items-center gap-2 text-[10px] font-semibold text-slate-400"><FiFolder /> Projeto</span>
                    <select value={selectedProjectId ?? "all"} onChange={(event) => handleSelectProject(event.target.value === "all" ? null : event.target.value)} className="mt-1 w-full bg-transparent text-sm font-semibold text-white outline-none">
                      <option value="all">Todos</option>
                      {contextProjects.map((project) => <option key={`${project.id}:${project.name}`} value={project.id}>{project.name}</option>)}
                    </select>
                  </label>
                  <label className="rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2.5">
                    <span className="flex items-center gap-2 text-[10px] font-semibold text-slate-400"><FiTag /> Tipo de nó</span>
                    <select value={nodeType} onChange={(event) => setNodeType(event.target.value as BrainNodeType | "all")} className="mt-1 w-full bg-transparent text-sm font-semibold text-white outline-none">
                      <option value="all">Todos</option>
                      {nodeTypeOptions.map((type) => <option key={type} value={type}>{nodeTypeLabel(type)}</option>)}
                    </select>
                  </label>
                  <label className="rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2.5">
                    <span className="flex items-center gap-2 text-[10px] font-semibold text-slate-400"><span className="h-2 w-2 rounded-full bg-slate-500" /> Status</span>
                    <select value={nodeStatus} onChange={(event) => setNodeStatus(event.target.value as BrainNodeStatus | "all")} className="mt-1 w-full bg-transparent text-sm font-semibold text-white outline-none">
                      <option value="all">Todos</option>
                      {nodeStatusOptions.map((status) => <option key={status} value={status}>{nodeStatusLabel(status)}</option>)}
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setLocalGraphOnly((current) => !current)} data-active={localGraphOnly ? "true" : "false"} className="rounded-full bg-white/6 px-3 py-2 text-[11px] font-semibold text-white/70 hover:bg-white/12 data-[active=true]:bg-cyan-300/25 data-[active=true]:text-cyan-100">Grafo local</button>
                  <button type="button" onClick={() => setShowPendingOnly((current) => !current)} data-active={showPendingOnly ? "true" : "false"} className="rounded-full bg-white/6 px-3 py-2 text-[11px] font-semibold text-white/70 hover:bg-white/12 data-[active=true]:bg-amber-300/25 data-[active=true]:text-amber-100">Pendências</button>
                  <button type="button" onClick={() => setShowOrphansOnly((current) => !current)} data-active={showOrphansOnly ? "true" : "false"} className="rounded-full bg-white/6 px-3 py-2 text-[11px] font-semibold text-white/70 hover:bg-white/12 data-[active=true]:bg-rose-300/25 data-[active=true]:text-rose-100">Órfãos</button>
                </div>
              </section>

              <section className="py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/55">Nós encontrados</p>
                  <span className="text-[10px] font-medium text-slate-500">clique para abrir</span>
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  {smartFilterResults.map((node) => {
                    const accent = node.status === "ok" ? "bg-emerald-300" : node.status === "error" || node.status === "missing" ? "bg-rose-300" : "bg-amber-300";
                    return (
                      <button key={node.id} type="button" onClick={() => openNodeFromSmartFilter(node)} className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-white/[0.06]">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${accent}`} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-white">{node.label}</p>
                          <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">{nodeTypeLabel(node.type)} · {node.module || "Brain"} · {nodeStatusLabel(node.status)}</p>
                        </div>
                        <span className="shrink-0 text-cyan-100/40 transition group-hover:text-cyan-100">→</span>
                      </button>
                    );
                  })}
                  {!smartFilterResults.length ? <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs font-bold text-slate-400">Nenhum nó encontrado neste contexto.</p> : null}
                </div>
              </section>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-white/10 bg-white/[0.025] px-5 py-3">
              <button type="button" onClick={clearSmartFilters} className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/8 hover:text-white">
                <FiRotateCcw className="h-3.5 w-3.5" /> Limpar
              </button>
              <button type="button" onClick={loadBrainData} className="flex items-center gap-2 rounded-full bg-cyan-300/15 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/25">
                <FiRefreshCw className="h-3.5 w-3.5" /> Atualizar
              </button>
            </footer>
          </aside>
        </>
      ) : null}
    </>
  );

  return (
    <main className="relative h-[100dvh] min-h-[720px] overflow-hidden bg-[#020713] text-white">
      <div className="absolute inset-0">
        <BrainNeuralCanvas
          nodes={visibleGraph.nodes}
          edges={visibleGraph.edges}
          selectedNodeId={selectedNode?.id ?? null}
          onSelectNode={handleSelectNode}
          onOpenRelatedModule={handleSelectModule}
          localGraphOnly={localGraphOnly}
          onToggleLocalGraph={() => setLocalGraphOnly((current) => !current)}
          loading={loadingData}
          debugMode={debugMode}
          onBackNode={handleBackNode}
          canBackNode={Boolean(selectedNode || nodeHistory.length)}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-5 z-[2147482999] flex justify-center">
        <label className="pointer-events-auto flex w-[min(480px,calc(100vw-32px))] items-center gap-2.5 rounded-full border border-white/10 bg-slate-950/92 px-4 py-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl focus-within:border-cyan-200/50">
          <FiSearch className="h-4 w-4 shrink-0 text-cyan-100/60" aria-hidden />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Buscar empresa, projeto, usuário, caso de teste..."
            className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
          />
          {searchText ? (
            <button type="button" onClick={() => setSearchText("")} className="shrink-0 text-slate-500 hover:text-white">
              <FiX className="h-4 w-4" />
            </button>
          ) : null}
        </label>
      </div>

      {filterHud}
    </main>
  );
}

export function BrainDashboard() {
  return <BrainNeuralDashboard />;
}

