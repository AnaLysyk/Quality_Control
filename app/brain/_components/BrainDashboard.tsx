"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiDatabase, FiRefreshCw, FiShield } from "react-icons/fi";
import { fetchBrainDashboardData } from "../_api/brain.client";
import { buildMockBrainGraph } from "../_data/brainMockGraph";
import type { BrainContextCompany, BrainContextProject, BrainContextResponse, BrainEdge, BrainGraphSummary, BrainNode, BrainNodeStatus, BrainNodeType, BuiltBrainGraph } from "../_types/brain.types";
import { buildAccessRequestsBrainGraph } from "../_utils/brainGraphBuilder";
import { getVisibleGraph } from "../_utils/brainGraphLayout";
import { BrainContextSelector } from "./BrainContextSelector";
import { BrainNeuralCanvas } from "./BrainNeuralCanvas";

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

type BrainContextOption = {
  id: string;
  name: string;
  companyId?: string | null;
};

function contextCompaniesFromBrainNodes(nodes: BrainNode[]): BrainContextOption[] {
  return uniqueById(
    nodes
      .filter((node) => node.companyId && node.companyName)
      .map((node) => ({
        id: node.companyId as string,
        name: node.companyName as string,
      })),
  ).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function contextProjectsFromBrainNodes(nodes: BrainNode[], selectedCompanyId: string | null): BrainContextOption[] {
  return uniqueById(
    nodes
      .filter((node) => node.projectId && node.projectName)
      .filter((node) => !selectedCompanyId || !node.companyId || node.companyId === selectedCompanyId)
      .map((node) => ({
        id: node.projectId as string,
        name: node.projectName as string,
        companyId: node.companyId ?? null,
      })),
  ).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
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

type BrainCoreDefinition = {
  id: string;
  label: string;
  modules: string[];
  description: string;
};

const BRAIN_CORES: BrainCoreDefinition[] = [
  {
    id: "defeitos",
    label: "Defeitos",
    modules: ["Defeitos"],
    description: "Defeitos abertos, críticos, responsáveis, status, testes relacionados e logs.",
  },
  {
    id: "repositorio-testes",
    label: "Repositório de Testes",
    modules: ["Repositorio de Testes", "Repositório de Testes", "Casos de Teste"],
    description: "Suítes, casos, automações, execuções, status e bugs relacionados.",
  },
  {
    id: "plano-teste",
    label: "Plano de Teste",
    modules: ["Plano de Teste", "Planos de Teste"],
    description: "Planos, ciclos, escopo, execuções e cobertura do projeto.",
  },
  {
    id: "automacao",
    label: "Automação",
    modules: ["Automacao", "Automação"],
    description: "Scripts, execuções, resultados, falhas e evidências automatizadas.",
  },
  {
    id: "documentos",
    label: "Documentos",
    modules: ["Documentos"],
    description: "Políticas, PDFs, evidências e documentação relacionada ao contexto.",
  },
  {
    id: "suporte",
    label: "Suporte",
    modules: ["Suporte", "Chamados"],
    description: "Chamados permitidos pelo perfil, responsáveis, status e histórico.",
  },
  {
    id: "solicitacoes",
    label: "Solicitações",
    modules: ["Solicitacoes", "Solicitações"],
    description: "Solicitações de acesso, solicitantes, perfil, decisão, logs e pendências.",
  },
  {
    id: "usuarios-permissoes",
    label: "Empresas / Usuários",
    modules: ["Empresas", "Usuarios", "Usuários", "Permissoes", "Permissões"],
    description: "Empresas, pessoas, perfis, matriz de acesso, integrações e permissões efetivas.",
  },
  {
    id: "logs",
    label: "Logs",
    modules: ["Logs"],
    description: "Eventos, auditoria, trilhas de execução e evidências temporais.",
  },
];

function matchesCore(node: BrainNode, core: BrainCoreDefinition) {
  return core.modules.includes(node.module);
}

function makeCoreNode(core: BrainCoreDefinition, nodes: BrainNode[]): BrainNode {
  const coreNodes = nodes.filter((node) => matchesCore(node, core));
  const pendingCount = coreNodes.filter((node) => ["pending", "missing", "warning", "error", "orphan"].includes(node.status)).length;
  const status: BrainNodeStatus = !coreNodes.length ? "missing" : pendingCount ? "pending" : "ok";
  return {
    id: `core:${core.id}`,
    type: "module",
    module: core.label,
    label: core.label,
    description: core.description,
    status,
    size: "lg",
    information: `${core.label} reúne ${coreNodes.length} conhecimento(s) deste contexto${pendingCount ? ` e ${pendingCount} pendência(s)` : ""}.`,
    missingKnowledge: coreNodes.length ? [] : [`Ainda não há nós estruturados para ${core.label} neste contexto.`],
    metadata: {
      isBrainCore: true,
      coreId: core.id,
      modules: core.modules,
      count: coreNodes.length,
      pendingCount,
    },
  };
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function modulesForNode(node: BrainNode) {
  const modules = readStringArray(node.metadata?.modules);
  return modules.length ? modules : [node.module];
}

function isCoreNode(node: BrainNode) {
  return Boolean(node.metadata?.isBrainCore);
}

function metadataFlag(node: BrainNode, key: string) {
  return Boolean(node.metadata?.[key]);
}

function buildProgressiveGraphView(options: {
  nodes: BrainNode[];
  edges: BrainEdge[];
  selectedNode: BrainNode | null;
  activeModule: string | null;
  hasActiveFilter: boolean;
  companies: BrainContextCompany[];
  projects: BrainContextProject[];
  selectedCompanyId: string | null;
  selectedProjectId: string | null;
  canViewSupport: boolean;
}) {
  const {
    nodes,
    edges,
    selectedNode,
    activeModule,
    hasActiveFilter,
    companies,
    projects,
    selectedCompanyId,
    selectedProjectId,
    canViewSupport,
  } = options;
  const company = companies.find((item) => item.id === selectedCompanyId) ?? companies[0] ?? null;
  const project = projects.find((item) => item.id === selectedProjectId) ?? projects.find((item) => !company || item.companyId === company.id) ?? null;
  const contextNodes: BrainNode[] = [
    {
      id: "context:company",
      type: "company",
      module: "Contexto",
      label: company?.name ?? "Contexto institucional",
      description: "Empresa é contexto: dentro dela aparecem projetos, módulos, solicitações, suporte, documentos, usuários e permissões.",
      status: "ok",
      size: "lg",
      companyId: company?.id,
      companyName: company?.name,
      information: "Empresa define o recorte institucional do mapa neural.",
      metadata: { isContextCore: true },
    },
    {
      id: "context:project",
      type: "project",
      module: "Contexto",
      label: project?.name ?? "Todos os projetos",
      description: "Projeto organiza defeitos, planos, casos, automações, documentos e evidências.",
      status: project ? "ok" : "pending",
      size: "lg",
      companyId: company?.id,
      companyName: company?.name,
      projectId: project?.id,
      projectName: project?.name,
      information: "Projeto aproxima módulos e evidências em um contexto de análise.",
      metadata: { isContextCore: true },
    },
  ];
  const visibleCores = BRAIN_CORES.filter((core) => canViewSupport || core.id !== "suporte").map((core) => makeCoreNode(core, nodes));
  const coreByModule = visibleCores.find((core) => activeModule && modulesForNode(core).includes(activeModule));
  const focusNode = selectedNode ?? coreByModule ?? null;
  const focusModules = focusNode ? modulesForNode(focusNode) : [];
  const focusCore = focusNode && isCoreNode(focusNode) ? focusNode : visibleCores.find((core) => focusModules.includes(core.label) || modulesForNode(core).includes(focusNode?.module ?? ""));
  const shouldExpand = Boolean(focusNode || activeModule || hasActiveFilter);
  const coreIds = new Set([...contextNodes, ...visibleCores].map((node) => node.id));
  const detailCandidates = shouldExpand
    ? nodes.filter((node) => !coreIds.has(node.id) && node.type !== "module" && (focusModules.length ? focusModules.includes(node.module) : true))
    : [];
  const directIds = new Set<string>();
  if (focusNode && !isCoreNode(focusNode)) {
    directIds.add(focusNode.id);
    edges.forEach((edge) => {
      if (edge.source === focusNode.id) directIds.add(edge.target);
      if (edge.target === focusNode.id) directIds.add(edge.source);
    });
  }
  const detailLimit = hasActiveFilter ? 18 : 10;
  const prioritizedDetails = uniqueById(
    [...detailCandidates.filter((node) => directIds.has(node.id)), ...detailCandidates]
      .filter((node) => !isCoreNode(node))
      .map((node) => ({
        ...node,
        metadata: { ...node.metadata, isDetailNode: true },
      })),
  ).slice(0, detailLimit);
  const remainingCount = Math.max(0, detailCandidates.length - prioritizedDetails.length);
  const aggregateNode: BrainNode | null = shouldExpand && remainingCount
    ? {
        id: `aggregate:${focusCore?.id ?? focusNode?.id ?? "context"}`,
        type: "entity",
        module: focusCore?.module ?? focusNode?.module ?? "Contexto",
        label: `+ ${remainingCount} itens`,
        description: "Itens agrupados para manter o mapa legível. Refine filtros ou busca para abrir menos nós.",
        status: "pending",
        size: "sm",
        information: `${remainingCount} conhecimento(s) foram agrupados para evitar sobreposição.`,
        metadata: { isAggregate: true },
      }
    : null;
  const expandedNodes = aggregateNode ? [...prioritizedDetails, aggregateNode] : prioritizedDetails;
  const displayCores = shouldExpand && focusCore ? [focusCore] : hasActiveFilter ? [] : visibleCores;
  const viewNodes = [...contextNodes, ...displayCores, ...expandedNodes];
  const viewIds = new Set(viewNodes.map((node) => node.id));
  const contextEdges: BrainEdge[] = [
    { id: "context-company-project", source: "context:company", target: "context:project", label: "possui projeto", type: "belongs_to_project", status: "ok" },
    ...displayCores.map((core) => ({
      id: `context-project-${core.id}`,
      source: "context:project",
      target: core.id,
      label: "organiza núcleo",
      type: "belongs_to_module" as const,
      status: core.status,
    })),
  ];
  const expansionEdges: BrainEdge[] = shouldExpand
    ? expandedNodes.map((node) => ({
        id: `expand-${focusCore?.id ?? focusNode?.id ?? "context"}-${node.id}`,
        source: focusCore?.id ?? "context:project",
        target: node.id,
        label: metadataFlag(node, "isAggregate") ? "agrupa" : "expande",
        type: "contains" as const,
        status: node.status,
      }))
    : [];
  const retainedEdges = edges.filter((edge) => viewIds.has(edge.source) && viewIds.has(edge.target));
  return {
    nodes: viewNodes,
    edges: uniqueById([...contextEdges, ...retainedEdges, ...expansionEdges]),
    focusNodeId: focusNode?.id ?? null,
    focusModule: focusCore?.label ?? focusNode?.module ?? null,
  };
}


function brainCanSeeAllCompanies(context: BrainContextResponse | null) {
  const user = context?.user as Record<string, unknown> | undefined;
  const permissions = context?.permissions as Record<string, unknown> | undefined;

  const roleValues = [
    user?.role,
    user?.companyRole,
    user?.globalRole,
    user?.userOrigin,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return Boolean(
    permissions?.canViewAll ||
      permissions?.canViewAllCompanies ||
      permissions?.canViewSupport ||
      user?.isGlobalAdmin ||
      roleValues.some((role) =>
        ["leader_tc", "technical_support", "testing_company", "admin", "global_admin"].includes(role),
      ),
  );
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

function defaultCompanyForBrain(context: BrainContextResponse | null) {
  return brainCanSeeAllCompanies(context) ? null : context?.defaultContext.companyId ?? null;
}

function defaultProjectForBrain(context: BrainContextResponse | null) {
  return brainCanSeeAllCompanies(context) ? null : context?.defaultContext.projectId ?? null;
}
export function BrainNeuralDashboard() {
  const [graph, setGraph] = useState<BuiltBrainGraph>(() => emptyGraph());
  const [brainContext, setBrainContext] = useState<BrainContextResponse | null>(null);
  const [, setDataErrors] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [showOrphansOnly, setShowOrphansOnly] = useState(false);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [nodeType, setNodeType] = useState<BrainNodeType | "all">("all");
  const [nodeStatus, setNodeStatus] = useState<BrainNodeStatus | "all">("all");
  const [period, setPeriod] = useState<"all" | "today" | "7d" | "30d">("all");
  const [localGraphOnly, setLocalGraphOnly] = useState(false);
  const [selectedNode, setSelectedNode] = useState<BrainNode | null>(null);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [graphSource, setGraphSource] = useState<"database" | "fallback" | "partial">("fallback");
  const [debugMode, setDebugMode] = useState(false);
  const appliedQueryFocusRef = useRef(false);

  useEffect(() => {
    document.body.classList.add("qc-brain-route");
    document.body.classList.add("qc-brain-active-route");
    return () => {
      document.body.classList.remove("qc-brain-route");
      document.body.classList.remove("qc-brain-active-route");
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setDebugMode(params.get("debug") === "1");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchBrainDashboardData()
      .then((data) => {
        if (cancelled) return;
        const built = buildAccessRequestsBrainGraph({
          requests: data.requests,
          removalHistory: data.removalHistory,
          auditLogs: data.auditLogs,
          domainNodes: data.domainGraph.nodes,
          domainEdges: data.domainGraph.edges,
          realBrainNodes: data.graph.nodes,
          realBrainEdges: data.graph.edges,
        });
        const merged = mergeWithNeuralMock(built);
        setBrainContext(data.context);
        setSelectedCompanyId(defaultCompanyForBrain(data.context));
        setSelectedProjectId(defaultProjectForBrain(data.context));
        setActiveModule(data.context?.defaultContext.module ?? null);
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
      }),
    [activeModule, graph.edges, graph.nodes, localGraphOnly, nodeStatus, nodeType, period, searchText, selectedCompanyId, selectedNode?.id, selectedProjectId, showOrphansOnly, showPendingOnly],
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
    if (node) {
      setSelectedNode(node);
      setExpandedNodeId(node.id);
      if (node.module) setActiveModule(node.module);
    }
    appliedQueryFocusRef.current = true;
  }, [graph.nodes, loadingData]);
  const contextCompanies = useMemo(() => mergeContextCompanies(brainContext, graph.nodes), [brainContext, graph.nodes]);
  const contextProjects = useMemo(() => mergeContextProjects(brainContext, graph.nodes), [brainContext, graph.nodes]);
  const visibleGraph = useMemo(
    () =>
      buildProgressiveGraphView({
        nodes: filteredGraph.nodes,
        edges: filteredGraph.edges,
        selectedNode,
        activeModule,
        hasActiveFilter: Boolean(searchText.trim() || nodeType !== "all" || nodeStatus !== "all" || period !== "all" || showOrphansOnly || showPendingOnly),
        companies: contextCompanies,
        projects: contextProjects,
        selectedCompanyId,
        selectedProjectId,
        canViewSupport: Boolean(brainContext?.permissions.canViewGlobalBrain || brainContext?.permissions.canViewLogs || graph.nodes.some((node) => ["Suporte", "Chamados"].includes(node.module))),
      }),
    [activeModule, brainContext?.permissions.canViewGlobalBrain, brainContext?.permissions.canViewLogs, contextCompanies, contextProjects, filteredGraph.edges, filteredGraph.nodes, graph.nodes, nodeStatus, nodeType, period, searchText, selectedCompanyId, selectedNode, selectedProjectId, showOrphansOnly, showPendingOnly],
  );

  const pendingCount = graph.summary.pendingNodes ?? graph.nodes.filter((node) => ["pending", "missing", "warning", "error", "orphan"].includes(node.status)).length;
  const selectedNodeConnections = useMemo(
    () => selectedNode ? visibleGraph.edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id) : [],
    [selectedNode, visibleGraph.edges],
  );
  const visibleConnected = useMemo(() => new Set(visibleGraph.edges.flatMap((edge) => [edge.source, edge.target])), [visibleGraph.edges]);
  const visiblePendingNodes = useMemo(
    () => visibleGraph.nodes.filter((node) => ["pending", "missing", "warning", "error", "orphan"].includes(node.status)),
    [visibleGraph.nodes],
  );
  const visibleOrphanNodes = useMemo(
    () => visibleGraph.nodes.filter((node) => !visibleConnected.has(node.id)),
    [visibleConnected, visibleGraph.nodes],
  );
  const currentCompanyName = contextCompanies.find((company) => company.id === selectedCompanyId)?.name ?? contextCompanies[0]?.name ?? "Contexto institucional";
  const currentProjectName = contextProjects.find((project) => project.id === selectedProjectId)?.name ?? "Todos os projetos";
  const brainScreenRuntimeContext = useMemo(
    () => ({
      route: "/brain",
      currentPath: ["Quality Control", currentCompanyName, currentProjectName, activeModule, selectedNode?.label].filter(Boolean),
      companyId: selectedCompanyId,
      companyName: currentCompanyName,
      projectId: selectedProjectId,
      projectName: currentProjectName,
      activeModule,
      activeCore: visibleGraph.focusModule,
      selectedNodeId: selectedNode?.id ?? null,
      selectedNodeLabel: selectedNode?.label ?? null,
      selectedNodeType: selectedNode?.type ?? null,
      selectedNodeStatus: selectedNode?.status ?? null,
      selectedNodeConnections: selectedNodeConnections.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: edge.type,
        status: edge.status,
      })),
      filters: {
        searchText,
        nodeType,
        nodeStatus,
        period,
        showPendingOnly,
        showOrphansOnly,
      },
      visibleNodes: visibleGraph.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        type: node.type,
        module: node.module,
        status: node.status,
        source: node.generatedBy ?? "initial",
      })),
      visibleEdges: visibleGraph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: edge.type,
        status: edge.status,
      })),
      pendingNodes: visiblePendingNodes.map((node) => ({ id: node.id, label: node.label, module: node.module, status: node.status })),
      orphanNodes: visibleOrphanNodes.map((node) => ({ id: node.id, label: node.label, module: node.module, status: node.status })),
      source: graphSource,
      viewType: selectedNode ? "detail" : activeModule ? "module" : "root",
      navigationLevel: selectedNode ? 2 : activeModule ? 1 : 0,
      permissions: brainContext?.permissions ?? null,
      availableActions: [
        "select_module",
        "select_node",
        "show_pending",
        "show_orphans",
        "clear_filters",
        "center_graph",
        "expand_node_details",
        "open_related_route",
      ],
    }),
    [activeModule, brainContext?.permissions, currentCompanyName, currentProjectName, graphSource, nodeStatus, nodeType, period, searchText, selectedCompanyId, selectedNode, selectedNodeConnections, selectedProjectId, showOrphansOnly, showPendingOnly, visibleGraph.edges, visibleGraph.focusModule, visibleGraph.nodes, visibleOrphanNodes, visiblePendingNodes],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const suggestedPrompts = [
      "O que estou vendo?",
      "Me explica esse nó",
      "Mostra só pendências",
      "Abre o núcleo de defeitos",
      "Qual próximo nó eu devo olhar?",
    ];
    const screenSummary = [
      "Brain é o cérebro visual da plataforma Quality Control.",
      `Contexto atual: ${brainScreenRuntimeContext.currentPath.join(" > ")}.`,
      `Visão ${brainScreenRuntimeContext.viewType} com ${brainScreenRuntimeContext.visibleNodes.length} nós, ${brainScreenRuntimeContext.visibleEdges.length} conexões, ${brainScreenRuntimeContext.pendingNodes.length} pendências e ${brainScreenRuntimeContext.orphanNodes.length} órfãos.`,
      "O chat global pode consultar esse contexto e executar ações visuais permitidas no mapa.",
    ].join(" ");

    const context = {
      route: "/brain",
      module: "brain" as const,
      screenLabel: "Brain",
      screenSummary,
      entityType: "screen" as const,
      entityId: selectedNode?.id ?? null,
      companySlug: brainScreenRuntimeContext.companyId ?? null,
      suggestedPrompts,
      metadata: brainScreenRuntimeContext,
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
          context,
          metadata: brainScreenRuntimeContext,
        },
      }),
    );
  }, [brainScreenRuntimeContext, selectedNode]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function normalize(value: string) {
      return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    }

    function selectModuleByText(text: string) {
      const normalized = normalize(text);
      const core = BRAIN_CORES.find((item) => {
        const label = normalize(item.label);
        return normalized.includes(label) || item.modules.some((module) => normalized.includes(normalize(module)));
      });
      if (!core) return false;
      setActiveModule(core.label);
      setSelectedNode(null);
      setExpandedNodeId(null);
      setShowPendingOnly(false);
      setShowOrphansOnly(false);
      return true;
    }

    function selectNodeByText(text: string) {
      const normalized = normalize(text);
      const node = visibleGraph.nodes.find((item) => normalized.includes(normalize(item.label)));
      if (!node) return false;
      setSelectedNode(node);
      return true;
    }

    function handleBrainCommand(event: Event) {
      const detail = (event as CustomEvent<{ command?: string; value?: string | null }>).detail ?? {};
      const command = detail.command ?? "";
      const value = detail.value ?? "";

      switch (command) {
        case "select_module":
          selectModuleByText(value);
          break;
        case "select_node":
          selectNodeByText(value);
          break;
        case "show_pending":
          setShowPendingOnly(true);
          setShowOrphansOnly(false);
          break;
        case "show_orphans":
          setShowOrphansOnly(true);
          setShowPendingOnly(false);
          break;
        case "clear_filters":
          setSelectedCompanyId(defaultCompanyForBrain(brainContext));
          setSelectedProjectId(defaultProjectForBrain(brainContext));
          setActiveModule(brainContext?.defaultContext.module ?? null);
          setShowOrphansOnly(false);
          setShowPendingOnly(false);
          setSearchText("");
          setNodeType("all");
          setNodeStatus("all");
          setPeriod("all");
          setLocalGraphOnly(false);
          setSelectedNode(null);
          setExpandedNodeId(null);
          break;
        case "center_graph":
          setSelectedNode(null);
          break;
        case "expand_node_details":
          if (selectedNode) setExpandedNodeId(selectedNode.id);
          break;
        default:
          if (value) {
            const moduleSelected = selectModuleByText(value);
            if (!moduleSelected) selectNodeByText(value);
          }
      }
    }

    window.addEventListener("brain:command", handleBrainCommand);
    return () => window.removeEventListener("brain:command", handleBrainCommand);
  }, [brainContext?.defaultContext.companyId, brainContext?.defaultContext.module, brainContext?.defaultContext.projectId, selectedNode, visibleGraph.nodes]);
  const statusLabel = loadingData
    ? "Atualizando grafo"
    : graphSource === "database"
      ? "Dados reais"
      : graphSource === "partial"
        ? "Dados reais + dados iniciais"
        : "Dados iniciais do Brain";
function handleSelectNode(node: BrainNode) {
    setSelectedNode(node);
  }

  function handleToggleNodeDetails(nodeId: string) {
    setExpandedNodeId((current) => current === nodeId ? null : nodeId);
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
  }

  function handleSelectModule(module: string | null) {
    setActiveModule(module);
    setNodeType("all");
    setNodeStatus("all");
    setSearchText("");
    setShowOrphansOnly(false);
    setShowPendingOnly(false);
    setLocalGraphOnly(false);

    if (module) {
      const next =
        graph.nodes.find((node) => node.module === module && node.type === "module") ??
        graph.nodes.find((node) => node.module === module) ??
        null;

      setSelectedNode(next);
    }
  }

  function handleShowAll() {
    setSelectedCompanyId(defaultCompanyForBrain(brainContext));
    setSelectedProjectId(defaultProjectForBrain(brainContext));
    setActiveModule(brainContext?.defaultContext.module ?? null);
    setShowOrphansOnly(false);
    setShowPendingOnly(false);
    setSearchText("");
    setNodeType("all");
    setNodeStatus("all");
    setPeriod("all");
    setLocalGraphOnly(false);
    setSelectedNode(null);
    setExpandedNodeId(null);
  }

  function handleRefresh() {
    setLoadingData(true);
    fetchBrainDashboardData()
      .then((data) => {
        const built = buildAccessRequestsBrainGraph({
          requests: data.requests,
          removalHistory: data.removalHistory,
          auditLogs: data.auditLogs,
          domainNodes: data.domainGraph.nodes,
          domainEdges: data.domainGraph.edges,
          realBrainNodes: data.graph.nodes,
          realBrainEdges: data.graph.edges,
        });
        const merged = mergeWithNeuralMock(built);
        setBrainContext(data.context);
        setGraph(merged);
        setDataErrors(data.errors);
        setGraphSource(data.errors.length ? "partial" : "database");
      })
      .catch((error) => {
        setDataErrors([error instanceof Error ? error.message : "Não consegui carregar o grafo completo agora. Estou mostrando os dados iniciais disponíveis."]);
        setGraphSource("fallback");
      })
      .finally(() => setLoadingData(false));
  }

  const filterHud = (
    <div className="brain-filter-hud pointer-events-auto absolute left-1/2 top-6 z-30 w-[min(760px,calc(100%-48px))] -translate-x-1/2">
      <BrainContextSelector
          nodes={graph.nodes}
          companies={contextCompanies}
          projects={contextProjects}
          selectedCompanyId={selectedCompanyId}
          selectedProjectId={selectedProjectId}
          activeModule={activeModule}
          searchText={searchText}
          nodeType={nodeType}
          nodeStatus={nodeStatus}
          period={period}
          showOrphansOnly={showOrphansOnly}
          showPendingOnly={showPendingOnly}
          visibleNodeCount={visibleGraph.nodes.length}
          visibleEdgeCount={visibleGraph.edges.length}
          pendingCount={visiblePendingNodes.length}
          source={graphSource}
          onCompanyChange={handleSelectCompany}
          onProjectChange={handleSelectProject}
          onModuleChange={handleSelectModule}
          onSearchTextChange={setSearchText}
          onNodeTypeChange={setNodeType}
          onNodeStatusChange={setNodeStatus}
          onPeriodChange={setPeriod}
          onClear={handleShowAll}
          onTogglePending={() => {
            setShowPendingOnly((current) => !current);
            setShowOrphansOnly(false);
          }}
          onToggleOrphans={() => {
            setShowOrphansOnly((current) => !current);
            setShowPendingOnly(false);
          }}
          onCenter={() => setSelectedNode(visibleGraph.nodes.find((node) => node.type === "module") ?? visibleGraph.nodes[0] ?? null)}
          onRefresh={handleRefresh}
        />
    </div>
  );

  return (
    <main className="relative h-[calc(100dvh-88px)] min-h-[620px] overflow-hidden bg-[#020713] text-white">
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
        />
      </div>

      {filterHud}
    </main>
  );
}

export function BrainDashboard() {
  return <BrainNeuralDashboard />;
}








