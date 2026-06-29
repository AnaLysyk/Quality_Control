"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiDatabase, FiMessageCircle, FiRefreshCw, FiShield, FiSliders } from "react-icons/fi";
import { useAppShellCoverSlot } from "@/components/AppShellCoverSlotContext";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { fetchBrainDashboardData } from "../_api/brain.client";
import { buildMockBrainGraph } from "../_data/brainMockGraph";
import type { BrainChatMessage, BrainEdge, BrainGraphFilter, BrainGraphSummary, BrainNode, BrainNodeStatus, BrainNodeType, BuiltBrainGraph } from "../_types/brain.types";
import { buildAccessRequestsBrainGraph } from "../_utils/brainGraphBuilder";
import { normalizeBrainText } from "../_utils/brainGraphFormatters";
import { getVisibleGraph } from "../_utils/brainGraphLayout";
import { BrainChatDock } from "./BrainChatDock";
import { BrainContextSelector } from "./BrainContextSelector";
import { BrainCreatedGeneratedPanel } from "./BrainCreatedGeneratedPanel";
import { BrainKnowledgeStats } from "./BrainKnowledgeStats";
import { BrainMissingKnowledgePanel } from "./BrainMissingKnowledgePanel";
import { BrainModuleRail } from "./BrainModuleRail";
import { BrainNeuralCanvas } from "./BrainNeuralCanvas";
import { BrainNodeInspector } from "./BrainNodeInspector";

function makeMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
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

function buildInitialMessage(userName: string) {
  return [
    `Oi, ${userName}. Estou no Brain em modo mapa neural.`,
    "",
    "Cada neuronio e um conhecimento. Quando ele se conecta a outro, eu mostro a informacao formada e o que ainda falta mapear.",
  ].join("\n");
}

function selectedConnectionsText(node: BrainNode | null, graph: BuiltBrainGraph) {
  if (!node) return "Selecione um no para eu explicar as conexoes dele.";
  const related = graph.edges.filter((edge) => edge.source === node.id || edge.target === node.id);
  if (!related.length) return `${node.label} esta orfao: e conhecimento isolado, mas ainda nao forma informacao completa.`;
  return [
    `${node.label} tem ${related.length} conexao(oes):`,
    ...related.slice(0, 10).map((edge) => {
      const otherId = edge.source === node.id ? edge.target : edge.source;
      const other = graph.nodes.find((candidate) => candidate.id === otherId);
      return `- ${edge.label}: ${other?.label ?? otherId}.`;
    }),
    "",
    node.information ? `Informacao formada: ${node.information}` : "Essas conexoes formam o contexto deste conhecimento.",
  ].join("\n");
}

type DashboardCommandResult = {
  reply: string;
  module?: string | null;
  filter?: BrainGraphFilter;
  selectedNode?: BrainNode | null;
  navigateTo?: string;
  showOrphansOnly?: boolean;
  showPendingOnly?: boolean;
};

function moduleForCommand(text: string) {
  if (/\bsolicitacoes?\b|\bacesso\b/.test(text)) return "Solicitacoes";
  if (/\bdefeitos?\b|\bbug\b/.test(text)) return "Defeitos";
  if (/\bautomacao\b|\bautomatizados?\b|\bscript\b/.test(text)) return "Automacao";
  if (/\bdocumentos?\b|\bpolitica\b/.test(text)) return "Documentos";
  if (/\busuarios?\b|\bpessoas?\b/.test(text)) return "Usuarios";
  if (/\bpermissoes?\b|\bperfil\b/.test(text)) return "Permissoes";
  if (/\blogs?\b|\bauditoria\b/.test(text)) return "Logs";
  return null;
}

function answerBrainCommand(command: string, graph: BuiltBrainGraph, selectedNode: BrainNode | null): DashboardCommandResult {
  const text = normalizeBrainText(command);
  const connected = new Set(graph.edges.flatMap((edge) => [edge.source, edge.target]));
  const orphanNodes = graph.nodes.filter((node) => !connected.has(node.id));
  const pendingNodes = graph.nodes.filter((node) => ["pending", "missing", "warning", "error"].includes(node.status));
  const targetModule = moduleForCommand(text);

  if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai)\b/.test(text)) {
    return { reply: "Oi. Posso mostrar modulos, nos orfaos, pendencias, defeitos abertos, solicitacoes ou explicar o no selecionado." };
  }

  if (/\b(abre|abrir|vai|ir)\b.*\b(solicitacoes|solicitacao|acesso)\b/.test(text)) {
    return { reply: "Vou abrir o modulo de Solicitacoes de acesso.", navigateTo: "/admin/access-requests" };
  }

  if (/\b(abre|abrir|vai|ir)\b.*\bdefeitos?\b/.test(text)) {
    return { reply: "Vou abrir o modulo de Defeitos.", navigateTo: "/admin/defeitos" };
  }

  if (/\b(explica|explicar)\b.*\b(no|node)\b|\bexplica esse no\b|\binformacao.*forma\b/.test(text)) {
    return { reply: selectedConnectionsText(selectedNode, graph), selectedNode };
  }

  if (/\borfaos?\b/.test(text)) {
    return {
      showOrphansOnly: true,
      showPendingOnly: false,
      reply: orphanNodes.length
        ? [`Mostrei os nos orfaos. Encontrei ${orphanNodes.length}:`, ...orphanNodes.slice(0, 10).map((node) => `- ${node.label} (${node.module}).`)].join("\n")
        : "Nao encontrei nos orfaos neste recorte.",
    };
  }

  if (/\bo que falta mapear\b|\bfalta mapear\b|\bpendencias\b/.test(text)) {
    return {
      showPendingOnly: true,
      showOrphansOnly: false,
      reply: [
        `Mostrei pendencias. Ha ${pendingNodes.length} no(s) em atencao, pendentes ou sem evidencia.`,
        ...graph.summary.pendingMappings.slice(0, 6).map((item) => `- ${item}`),
      ].join("\n"),
    };
  }

  if (targetModule) {
    const count = graph.nodes.filter((node) => node.module === targetModule).length;
    return {
      module: targetModule,
      reply: `Filtrei o mapa por ${targetModule}. Esse modulo tem ${count} no(s) neste recorte.`,
    };
  }

  if (/\bmostrar tudo\b|\btodos\b|\blimpar\b/.test(text)) {
    return { module: null, showOrphansOnly: false, showPendingOnly: false, reply: "Mostrei o cerebro completo novamente." };
  }

  return {
    reply: "Consigo responder: mostra nos de solicitacoes, mostra defeitos abertos, quais nos estao orfaos, o que falta mapear, explica esse no, abre o modulo solicitacoes ou abre o modulo defeitos.",
  };
}

function filterByLegacyCommand(graph: BuiltBrainGraph, filter: BrainGraphFilter) {
  if (filter === "access_requests") return { module: "Solicitacoes" };
  if (filter === "defects") return { module: "Defeitos" };
  if (filter === "automation") return { module: "Automacao" };
  if (filter === "documents") return { module: "Documentos" };
  if (filter === "users") return { module: "Usuarios" };
  if (filter === "permissions") return { module: "Permissoes" };
  if (filter === "logs") return { module: "Logs" };
  return { module: null as string | null };
}

export function BrainNeuralDashboard() {
  const router = useRouter();
  const { user } = usePermissionAccess();
  const [graph, setGraph] = useState<BuiltBrainGraph>(() => emptyGraph());
  const [, setDataErrors] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [showOrphansOnly, setShowOrphansOnly] = useState(false);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [nodeType, setNodeType] = useState<BrainNodeType | "all">("all");
  const [nodeStatus, setNodeStatus] = useState<BrainNodeStatus | "all">("all");
  const [period, setPeriod] = useState<"all" | "today" | "7d" | "30d">("all");
  const [localGraphOnly, setLocalGraphOnly] = useState(false);
  const [sideTab, setSideTab] = useState<"node" | "chat">("node");
  const [selectedNode, setSelectedNode] = useState<BrainNode | null>(null);
  const [graphSource, setGraphSource] = useState<"database" | "fallback" | "partial">("fallback");
  const firstName = (user?.fullName || user?.name || user?.email || "Ana").split(/\s+/)[0] || "Ana";
  const [messages, setMessages] = useState<BrainChatMessage[]>(() => [
    { id: "welcome", from: "brain", text: buildInitialMessage(firstName), ts: Date.now() },
  ]);

  useEffect(() => {
    let cancelled = false;
    fetchBrainDashboardData()
      .then((data) => {
        if (cancelled) return;
        const built = buildAccessRequestsBrainGraph({
          requests: data.requests,
          removalHistory: data.removalHistory,
          auditLogs: data.auditLogs,
          realBrainNodes: data.graph.nodes,
          realBrainEdges: data.graph.edges,
        });
        const merged = mergeWithNeuralMock(built);
        setGraph(merged);
        setSelectedNode(merged.nodes.find((node) => node.type === "defect") ?? merged.nodes[0] ?? null);
        setDataErrors(data.errors);
        setGraphSource(data.errors.length ? "partial" : "database");
      })
      .catch((error) => {
        if (cancelled) return;
        const fallback = emptyGraph();
        setDataErrors([error instanceof Error ? error.message : "Erro ao carregar Brain. Usando grafo inicial."]);
        setGraph(fallback);
        setSelectedNode(fallback.nodes[0] ?? null);
        setGraphSource("fallback");
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleGraph = useMemo(
    () =>
      getVisibleGraph(graph.nodes, graph.edges, {
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
    [activeModule, graph.edges, graph.nodes, localGraphOnly, nodeStatus, nodeType, period, searchText, selectedNode?.id, showOrphansOnly, showPendingOnly],
  );

  const pendingCount = graph.summary.pendingNodes ?? graph.nodes.filter((node) => ["pending", "missing", "warning", "error", "orphan"].includes(node.status)).length;
  const statusLabel = loadingData
    ? "Atualizando grafo"
    : graphSource === "database"
      ? "Dados reais"
      : graphSource === "partial"
        ? "Dados reais + dados iniciais"
        : "Dados iniciais do Brain";
  const coverContent = useMemo(
    () => (
      <div className="flex flex-wrap justify-end gap-2 text-xs">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 font-black text-white/82 shadow-sm backdrop-blur">
          <FiShield className="h-3.5 w-3.5 text-emerald-100" />
          Conforme seu perfil
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100/22 bg-cyan-100/12 px-3 py-2 font-black text-cyan-50 shadow-sm backdrop-blur">
          {loadingData ? <FiRefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FiDatabase className="h-3.5 w-3.5" />}
          {statusLabel}
        </span>
        <span className="rounded-full border border-white/15 bg-black/20 px-3 py-2 font-black text-white/72 shadow-sm backdrop-blur">
          {graph.summary.totalNodes} nos / {graph.summary.totalEdges} conexoes
        </span>
      </div>
    ),
    [graph.summary.totalEdges, graph.summary.totalNodes, loadingData, statusLabel],
  );

  useAppShellCoverSlot(coverContent);

  function handleSelectNode(node: BrainNode) {
    setSelectedNode(node);
    setSideTab("node");
  }

  function handleSelectModule(module: string | null) {
    setActiveModule(module);
    setShowOrphansOnly(false);
    setShowPendingOnly(false);
    setLocalGraphOnly(false);
    if (module) {
      const next = graph.nodes.find((node) => node.module === module && node.type === "module") ?? graph.nodes.find((node) => node.module === module) ?? null;
      setSelectedNode(next);
    }
  }

  function handleShowAll() {
    setActiveModule(null);
    setShowOrphansOnly(false);
    setShowPendingOnly(false);
    setSearchText("");
    setNodeType("all");
    setNodeStatus("all");
    setPeriod("all");
    setLocalGraphOnly(false);
  }

  function handleRefresh() {
    setLoadingData(true);
    fetchBrainDashboardData()
      .then((data) => {
        const built = buildAccessRequestsBrainGraph({
          requests: data.requests,
          removalHistory: data.removalHistory,
          auditLogs: data.auditLogs,
          realBrainNodes: data.graph.nodes,
          realBrainEdges: data.graph.edges,
        });
        const merged = mergeWithNeuralMock(built);
        setGraph(merged);
        setDataErrors(data.errors);
        setGraphSource(data.errors.length ? "partial" : "database");
      })
      .catch((error) => {
        setDataErrors([error instanceof Error ? error.message : "Nao consegui carregar o grafo completo agora. Estou mostrando os dados iniciais disponiveis."]);
        setGraphSource("fallback");
      })
      .finally(() => setLoadingData(false));
  }

  function handleCommand(command: string) {
    const result = answerBrainCommand(command, graph, selectedNode);
    setMessages((current) => [
      ...current,
      { id: makeMessageId(), from: "user", text: command, ts: Date.now() },
      { id: makeMessageId(), from: "brain", text: result.reply, ts: Date.now() + 1 },
    ]);
    if (result.filter) setActiveModule(filterByLegacyCommand(graph, result.filter).module);
    if (result.module !== undefined) setActiveModule(result.module);
    if (result.showOrphansOnly !== undefined) setShowOrphansOnly(result.showOrphansOnly);
    if (result.showPendingOnly !== undefined) setShowPendingOnly(result.showPendingOnly);
    if (result.selectedNode !== undefined) setSelectedNode(result.selectedNode);
    setSideTab("chat");
    if (result.navigateTo) router.push(result.navigateTo);
  }

  return (
    <main className="min-h-screen bg-[#050b16] px-3 pb-4 pt-0 text-white sm:px-5 lg:px-7">
      <div className="mx-auto flex max-w-[1900px] flex-col gap-4">
        <BrainContextSelector
          nodes={graph.nodes}
          activeModule={activeModule}
          searchText={searchText}
          nodeType={nodeType}
          nodeStatus={nodeStatus}
          period={period}
          showOrphansOnly={showOrphansOnly}
          showPendingOnly={showPendingOnly}
          visibleNodeCount={visibleGraph.nodes.length}
          visibleEdgeCount={visibleGraph.edges.length}
          pendingCount={pendingCount}
          source={graphSource}
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

        <BrainKnowledgeStats summary={graph.summary} />

        <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_380px] 2xl:grid-cols-[250px_minmax(0,1fr)_400px]">
          <BrainModuleRail nodes={graph.nodes} edges={graph.edges} activeModule={activeModule} onSelectModule={handleSelectModule} />

          <BrainNeuralCanvas
            nodes={visibleGraph.nodes}
            edges={visibleGraph.edges}
            selectedNodeId={selectedNode?.id ?? null}
            onSelectNode={handleSelectNode}
            onOpenRelatedModule={handleSelectModule}
            localGraphOnly={localGraphOnly}
            onToggleLocalGraph={() => setLocalGraphOnly((current) => !current)}
            loading={loadingData}
          />

          <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSideTab("node")}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${
                    sideTab === "node" ? "bg-cyan-200 text-[#021026]" : "bg-black/16 text-white/68 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <FiSliders className="h-3.5 w-3.5" />
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setSideTab("chat")}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${
                    sideTab === "chat" ? "bg-cyan-200 text-[#021026]" : "bg-black/16 text-white/68 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <FiMessageCircle className="h-3.5 w-3.5" />
                  Chat
                </button>
              </div>
            </section>
            {sideTab === "node" ? (
              <>
                <BrainNodeInspector node={selectedNode} nodes={graph.nodes} edges={graph.edges} onOpenRelatedModule={handleSelectModule} />
                <BrainCreatedGeneratedPanel summary={graph.summary} nodes={graph.nodes} edges={graph.edges} />
                <BrainMissingKnowledgePanel summary={graph.summary} nodes={graph.nodes} />
              </>
            ) : (
              <BrainChatDock messages={messages} onCommand={handleCommand} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export function BrainDashboard() {
  return <BrainNeuralDashboard />;
}
