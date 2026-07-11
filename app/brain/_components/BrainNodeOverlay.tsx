"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { FiMove, FiRefreshCw, FiSearch, FiX, FiZap } from "react-icons/fi";
import type { BrainEdge, BrainNode } from "../_types/brain.types";
import { nodeStatusLabel, nodeTypeLabel } from "../_utils/brainGraphFormatters";

type BrainRagContext = {
  source?: string;
  summary?: {
    nodeCount?: number;
    edgeCount?: number;
    memoryCount?: number;
    moduleCount?: number;
  };
  nodes?: Array<{ id: string; label: string; type?: string; module?: string; score?: number }>;
  memory?: Array<{ id: string; kind?: string; title?: string; status?: string | null; route?: string | null; updatedAt?: string | null }>;
  events?: Array<{ id: string; kind?: string; title?: string; label?: string; module?: string }>;
  documents?: Array<{ id: string; title?: string; route?: string | null }>;
  availableActions?: string[];
};

type BrainNodeOverlayProps = {
  node: BrainNode;
  nodes: BrainNode[];
  edges: BrainEdge[];
  onClose: () => void;
  onResetFocus: () => void;
  onSelectRelatedNode: (node: BrainNode) => void;
  debugMode?: boolean;
  onBackNode?: () => void;
  canBackNode?: boolean;
};

function memoryText(node: BrainNode) {
  return node.information || node.description || "Este nó representa uma memória do Brain dentro do contexto selecionado.";
}

function readable(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(readable).filter(Boolean).join(", ");
  return null;
}

function compactMetadata(node: BrainNode) {
  const hidden = new Set([
    "isBrainCore",
    "isContextCore",
    "isDetailNode",
    "modules",
    "key",
    "id",
    "refId",
    "companyId",
    "projectId",
    "createdAt",
    "updatedAt",
    "createdBy",
    "actorUserId",
    "requestId",
    "auditLogId",
  ]);
  return Object.entries(node.metadata ?? {})
    .filter(([key]) => !hidden.has(key))
    .map(([key, value]) => ({ key, value: readable(value) }))
    .filter((item): item is { key: string; value: string } => Boolean(item.value))
    .slice(0, 10);
}

function relationRows(node: BrainNode, nodes: BrainNode[], edges: BrainEdge[]) {
  return edges
    .filter((edge) => edge.source === node.id || edge.target === node.id)
    .map((edge) => {
      const relatedId = edge.source === node.id ? edge.target : edge.source;
      const related = nodes.find((item) => item.id === relatedId);
      return related ? { edge, related, direction: edge.source === node.id ? "saída" : "entrada" } : null;
    })
    .filter((item): item is { edge: BrainEdge; related: BrainNode; direction: string } => Boolean(item));
}

function responsibleFromRelations(relations: ReturnType<typeof relationRows>) {
  const match = relations.find(
    (item) => item.direction === "entrada" && /respons/i.test(item.edge.label ?? ""),
  );
  return match?.related.label ?? null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString("pt-BR");
}

function groupCounts(nodes: BrainNode[]) {
  const groups = new Map<string, number>();
  for (const item of nodes) groups.set(item.module, (groups.get(item.module) ?? 0) + 1);
  return Array.from(groups.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
}

function formatKey(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function BrainNodeOverlay({ node, nodes, edges, onClose, onResetFocus, onSelectRelatedNode, debugMode = false, onBackNode, canBackNode = false }: BrainNodeOverlayProps) {
  const relations = relationRows(node, nodes, edges);
  const relatedNodes = relations.map((item) => item.related);
  const metadata = compactMetadata(node);
  const pendingItems = [...(node.missingKnowledge ?? []), ...relatedNodes.flatMap((item) => item.missingKnowledge ?? []).slice(0, 8)];
  const areaCounts = groupCounts([node, ...relatedNodes]);
  const responsible = responsibleFromRelations(relations);
  const whoWhen = [
    { label: "Criado por", value: node.createdByName ?? node.createdByEmail ?? node.createdBy ?? null },
    { label: "Criado em", value: formatDate(node.createdAt) },
    { label: "Atualizado por", value: node.updatedBy ?? null },
    { label: "Atualizado em", value: formatDate(node.updatedAt) },
    { label: "Responsável", value: responsible },
  ].filter((item) => Boolean(item.value));
  const origin = [
    { label: "Banco", value: node.source?.table ?? null },
    { label: "API/rota", value: node.source?.route ?? null },
    { label: "Integração", value: node.source?.provider ?? null },
    { label: "Origem", value: node.source?.type ?? node.sourceType ?? node.generatedBy ?? null },
  ].filter((item) => Boolean(item.value));
  const [ragContext, setRagContext] = useState<BrainRagContext | null>(null);
  const [ragQuery, setRagQuery] = useState(node.label);
  const [ragLoading, setRagLoading] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const canSendToGithub = node.type === "defect" || node.type === "execution";
  const [githubSources, setGithubSources] = useState<Array<{ id: string; name: string }>>([]);
  const [githubSourceId, setGithubSourceId] = useState("");
  const [githubSending, setGithubSending] = useState(false);
  const [githubFeedback, setGithubFeedback] = useState<string | null>(null);

  useEffect(() => {
    setPosition({ x: 0, y: 0 });
    setRagQuery(node.label);
  }, [node.id, node.label]);

  useEffect(() => {
    if (!canSendToGithub) return;
    fetch("/api/brain/settings/sources", { credentials: "include", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { sources?: Array<{ id: string; name: string; provider?: string | null; sourceType?: string; status?: string }> } | null) => {
        const options = (data?.sources ?? []).filter(
          (item) => item.sourceType === "external_api" && (item.provider ?? "").toLowerCase() === "github" && item.status === "active",
        );
        setGithubSources(options.map((item) => ({ id: item.id, name: item.name })));
        setGithubSourceId((current) => current || options[0]?.id || "");
      })
      .catch(() => setGithubSources([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSendToGithub]);

  async function sendToGithub() {
    if (!githubSourceId) {
      setGithubFeedback("Selecione uma fonte GitHub configurada.");
      return;
    }
    setGithubSending(true);
    setGithubFeedback(null);
    try {
      const response = await fetch("/api/brain/integrations/github/issues", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: githubSourceId,
          title: `[${nodeTypeLabel(node.type)}] ${node.label}`,
          body: [memoryText(node), "", `Enviado pelo Brain (Quality Control) · nó ${node.id}`].join("\n"),
          labels: [node.type],
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : "Falha ao enviar ao GitHub");
      setGithubFeedback(`Issue criada: ${json.issue?.url ?? ""}`);
    } catch (error) {
      setGithubFeedback(error instanceof Error ? error.message : "Erro ao enviar ao GitHub");
    } finally {
      setGithubSending(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    const query = ragQuery.trim() || node.label;
    params.set("q", query);
    params.set("module", node.module);
    params.set("limit", "8");
    setRagLoading(true);

    fetch(`/api/brain/rag/context?${params.toString()}`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: BrainRagContext | null) => setRagContext(data))
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setRagContext(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRagLoading(false);
      });

    return () => controller.abort();
  }, [node.id, node.label, node.module, ragQuery]);

  function handleDragStart(event: PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("button,input,textarea,select,a")) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, baseX: position.x, baseY: position.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDragMove(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition({ x: drag.baseX + event.clientX - drag.startX, y: drag.baseY + event.clientY - drag.startY });
  }

  function handleDragEnd(event: PointerEvent<HTMLElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function askBrainChatAboutNode() {
    const payload = {
      source: "brain-node",
      route: "/brain",
      nodeId: node.id,
      nodeLabel: node.label,
      nodeType: node.type,
      nodeStatus: node.status,
      module: node.module,
      description: memoryText(node),
      metadata: node.metadata ?? {},
      relations: relations.slice(0, 12).map(({ edge, related, direction }) => ({
        edgeId: edge.id,
        edgeLabel: edge.label,
        direction,
        relatedNodeId: related.id,
        relatedNodeLabel: related.label,
        relatedNodeType: related.type,
        relatedNodeStatus: related.status,
        relatedModule: related.module,
      })),
      missingKnowledge: pendingItems,
      suggestedPrompt: `Me explica o nó "${node.label}" no Brain. Usa contexto do banco, logs, histórico, relações, permissões e memórias RAG disponíveis.`,
    };

    window.dispatchEvent(new CustomEvent("assistant:context", { detail: { source: "brain", route: "/brain", entityId: node.id, entityType: node.type, nodeId: node.id, nodeLabel: node.label, agentMode: "qa", metadata: payload } }));
    window.dispatchEvent(new CustomEvent("assistant:open", { detail: { source: "brain", route: "/brain", initialMessage: payload.suggestedPrompt, prompt: payload.suggestedPrompt, panelMode: "side", focusInput: true, metadata: payload } }));
    window.dispatchEvent(new CustomEvent("brain:ask-chat", { detail: payload }));
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[9999] text-white">
      <article
        className="qc-brain-memory-panel pointer-events-auto fixed right-6 top-20 flex max-h-[calc(100dvh-112px)] w-[min(560px,calc(100vw-32px))] flex-col overflow-hidden rounded-[26px] border border-cyan-100/18 bg-[linear-gradient(145deg,rgba(4,13,29,0.98),rgba(8,23,42,0.98))] text-white shadow-[0_28px_100px_rgba(0,0,0,0.68)]"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      >
        <header
          className="cursor-move border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.94),rgba(88,28,135,0.32))] p-4"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          title="Arraste este cabeçalho para mover o modal de contexto"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-100/20 bg-cyan-100/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-50">
                  <FiMove className="h-3 w-3" /> arraste o contexto
                </span>
                <span className="rounded-full border border-cyan-100/20 bg-cyan-100/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-50">{nodeStatusLabel(node.status)}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/72">{nodeTypeLabel(node.type)}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/72">{node.module}</span>
                {node.companyName ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/72">{node.companyName}</span> : null}
                {node.projectName ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/72">{node.projectName}</span> : null}
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100/55">Modal de contexto do nó</p>
              <h2 className="mt-1 text-2xl font-black leading-tight text-white">{node.label}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-200/82">{memoryText(node)}</p>
            </div>
            <button type="button" onClick={onClose} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:border-rose-200/40 hover:text-white" aria-label="Fechar memória">
              <FiX className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/46 p-3"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/45">Conexões</p><p className="mt-1 text-2xl font-black text-white">{relations.length}</p></div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/46 p-3"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/45">Pendências</p><p className="mt-1 text-2xl font-black text-white">{pendingItems.length}</p></div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/46 p-3"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/45">Áreas</p><p className="mt-1 text-2xl font-black text-white">{areaCounts.length}</p></div>
          </div>

          {whoWhen.length ? <section className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/45">Quem e quando</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{whoWhen.map((item) => <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</p><p className="mt-1 break-words text-xs font-bold text-slate-100">{item.value}</p></div>)}</div></section> : null}

          <section className="qc-brain-rag-context-card mt-3 rounded-2xl border border-cyan-100/14 bg-cyan-100/[0.055] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/55">Memórias e contexto recuperado</p><h3 className="mt-1 text-sm font-black text-white">O que o Brain encontrou para este nó</h3></div>
              <span className="rounded-full border border-emerald-200/20 bg-emerald-200/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">{ragLoading ? "buscando" : "contexto encontrado"}</span>
            </div>

            <label className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <FiSearch className="h-4 w-4 shrink-0 text-cyan-100/70" aria-hidden />
              <input
                value={ragQuery}
                onChange={(event) => setRagQuery(event.target.value)}
                placeholder="Buscar memória, log, documento, regra ou relação deste nó..."
                className="w-full bg-transparent text-xs font-bold text-white outline-none placeholder:text-slate-500"
              />
              <button type="button" onClick={() => setRagQuery(node.label)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/70">
                Reset
              </button>
            </label>

            {ragLoading ? <p className="mt-3 text-xs font-bold text-slate-200/78">Consultando cérebro, permissões, eventos, notas e documentos vinculados...</p> : ragContext ? (
              <div className="mt-3 grid gap-3">
                <div className="grid gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Nós</p><p className="mt-1 text-lg font-black text-white">{ragContext.summary?.nodeCount ?? ragContext.nodes?.length ?? 0}</p></div>
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Conexões</p><p className="mt-1 text-lg font-black text-white">{ragContext.summary?.edgeCount ?? 0}</p></div>
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Memórias</p><p className="mt-1 text-lg font-black text-white">{ragContext.summary?.memoryCount ?? ragContext.memory?.length ?? 0}</p></div>
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Ações</p><p className="mt-1 text-lg font-black text-white">{ragContext.availableActions?.length ?? 0}</p></div>
                </div>
                {ragContext.memory?.length ? <div className="rounded-xl border border-white/10 bg-black/18 p-3"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/45">Memórias encontradas</p><div className="mt-2 grid gap-2">{ragContext.memory.slice(0, 4).map((item) => <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2"><p className="text-xs font-black text-slate-50">{item.title ?? item.kind ?? "Memória"}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{item.kind ?? "contexto"}{item.status ? ` · ${item.status}` : ""}</p></div>)}</div></div> : <p className="rounded-xl border border-white/10 bg-black/18 p-3 text-xs font-bold text-slate-200/72">Nenhuma memória salva para este nó ainda. Pergunte ao Brain para cruzar logs, documentos e relações, ou registre uma nova memória em Memórias do Brain.</p>}
              </div>
            ) : <p className="mt-3 text-xs font-bold text-slate-200/78">Contexto RAG ainda não respondeu para este nó.</p>}
          </section>

          {origin.length ? <section className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/45">Origem</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{origin.map((item) => <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</p><p className="mt-1 break-words text-xs font-bold text-slate-100">{item.value}</p></div>)}</div></section> : null}

          {canSendToGithub ? (
            <section className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/45">Enviar ao GitHub</p>
              {githubSources.length ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select value={githubSourceId} onChange={(event) => setGithubSourceId(event.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs font-bold text-white outline-none">
                    {githubSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                  </select>
                  <button type="button" onClick={sendToGithub} disabled={githubSending} className="rounded-lg border border-cyan-100/25 bg-cyan-100/10 px-3 py-2 text-xs font-black text-cyan-50 hover:border-cyan-100/60 disabled:opacity-60">
                    {githubSending ? "Enviando..." : "Criar issue no GitHub"}
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs font-bold text-slate-400">Nenhuma fonte GitHub ativa configurada. Configure em Configurações do Brain (provider &quot;github&quot;).</p>
              )}
              {githubFeedback ? <p className="mt-2 break-words text-xs font-bold text-emerald-200">{githubFeedback}</p> : null}
            </section>
          ) : null}

          {debugMode && metadata.length ? <section className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/45">Dados úteis do nó (debug)</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{metadata.map((item) => <div key={item.key} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{formatKey(item.key)}</p><p className="mt-1 break-words text-xs font-bold text-slate-100">{item.value}</p></div>)}</div></section> : null}

          {debugMode ? <section className="mt-3 rounded-2xl border border-sky-200/18 bg-sky-200/[0.07] p-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-100/70">Debug QA</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{[["nodeId", node.id], ["type", node.type], ["moduleId", node.module], ["requiredPermissions", readable(node.requiredPermissions ?? node.metadata?.requiredPermissions ?? node.metadata?.requiredPermission) ?? "nao informado"], ["visibleByPermission", String(node.visibleByPermission ?? true)], ["source", readable(node.source ?? node.metadata?.source ?? node.generatedBy ?? "initial") ?? "initial"], ["edges count", String(relations.length)]].map(([key, value]) => <div key={key} className="rounded-xl border border-sky-100/10 bg-black/18 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-sky-100/45">{key}</p><p className="mt-1 break-words text-xs font-bold text-sky-50/90">{value}</p></div>)}</div></section> : null}

          <section className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/45">Relações principais</p><div className="mt-2 grid gap-2">{relations.slice(0, 12).map(({ edge, related, direction }) => <button key={edge.id} type="button" onClick={() => onSelectRelatedNode(related)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left hover:border-cyan-100/32"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-white">{related.label}</p><p className="mt-1 text-xs font-semibold text-slate-400">{edge.label} · {direction} · {nodeTypeLabel(related.type)} · {related.module}</p></div><span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[10px] font-black uppercase text-slate-300">{nodeStatusLabel(related.status)}</span></div></button>)}{!relations.length ? <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs font-bold text-slate-400">Nenhuma relação disponível neste recorte.</p> : null}</div></section>

          {pendingItems.length ? <section className="mt-3 rounded-2xl border border-amber-200/16 bg-amber-200/[0.06] p-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/70">Contexto que o Brain deve completar</p><ul className="mt-2 grid gap-2">{Array.from(new Set(pendingItems)).slice(0, 8).map((item) => <li key={item} className="rounded-xl border border-amber-200/12 bg-black/16 px-3 py-2 text-xs font-bold leading-5 text-amber-50/88">{item}</li>)}</ul></section> : null}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-white/10 bg-slate-950/72 p-3">
          <button type="button" onClick={onBackNode ?? onResetFocus} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/70 hover:border-cyan-100/35 hover:text-white"><FiRefreshCw className="h-3.5 w-3.5" />{canBackNode ? "Voltar nó" : "Voltar ao núcleo"}</button>
          <button type="button" onClick={askBrainChatAboutNode} className="qc-brain-ask-chat-button inline-flex items-center gap-2 rounded-xl border border-cyan-100/25 bg-cyan-100/10 px-3 py-2 text-xs font-black text-cyan-50 hover:border-cyan-100/60"><FiZap className="h-3.5 w-3.5" />Perguntar ao Brain</button>
        </footer>
      </article>
    </div>,
    document.body,
  );
}
