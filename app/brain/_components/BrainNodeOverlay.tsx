"use client";

import { createPortal } from "react-dom";
import { FiActivity, FiExternalLink, FiRefreshCw, FiX, FiZap } from "react-icons/fi";
import type { BrainEdge, BrainNode } from "../_types/brain.types";
import { nodeStatusLabel, nodeTypeLabel } from "../_utils/brainGraphFormatters";

type BrainNodeOverlayProps = {
  node: BrainNode;
  nodes: BrainNode[];
  edges: BrainEdge[];
  onClose: () => void;
  onResetFocus: () => void;
  onOpenRelatedModule: (module: string) => void;
  debugMode?: boolean;
};

const ACTION_LABELS: Record<string, string> = {
  integration: "Abrir empresa relacionada, revisar token, projeto e status da integração",
  profile: "Abrir usuários por perfil e conferir origem correta do cadastro",
  screen: "Abrir tela relacionada e revisar a fila operacional",
  status: "Filtrar a fila por este status",
  access_request: "Abrir solicitação, revisar perfil, solicitar ajuste, aprovar ou recusar",
  automation: "Abrir automação, conferir execução, evidências e falhas",
  company: "Ver empresas, usuários vinculados, projetos, permissões e chamados",
  defect: "Abrir defeito, checar responsável, status, severidade e testes relacionados",
  document: "Abrir documento, evidência ou PDF vinculado",
  log: "Consultar trilha, auditoria e origem do evento",
  module: "Expandir área e listar nós conectados",
  permission: "Revisar permissão efetiva e impacto por perfil",
  person: "Ver usuário, empresa, permissões, solicitações e ações recentes",
  project: "Ver projeto, planos, casos, defeitos, runs e documentos",
  requester: "Ver solicitante, pedidos, comentários e pendências",
  test_case: "Abrir caso, automação, execução e defeitos associados",
};

function memoryText(node: BrainNode) {
  return (
    node.information ||
    node.description ||
    "Este nó representa uma memória do Brain dentro do contexto selecionado."
  );
}

function readable(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(readable).filter(Boolean).join(", ");
  return null;
}

function compactMetadata(node: BrainNode) {
  const hidden = new Set(["isBrainCore", "isContextCore", "isDetailNode", "modules"]);
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

function groupCounts(nodes: BrainNode[]) {
  const groups = new Map<string, number>();
  for (const item of nodes) groups.set(item.module, (groups.get(item.module) ?? 0) + 1);
  return Array.from(groups.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
}

function inferActions(node: BrainNode, relations: ReturnType<typeof relationRows>) {
  return Array.from(
    new Set([
      ...(node.actions ?? []),
      ACTION_LABELS[node.type],
      relations.some((item) => item.related.type === "defect") ? "Investigar defeitos conectados" : null,
      relations.some((item) => item.related.type === "test_case") ? "Abrir casos de teste relacionados" : null,
      relations.some((item) => item.related.type === "person" || item.related.type === "requester") ? "Ver usuários e solicitantes relacionados" : null,
      relations.some((item) => item.related.module === "Suporte") ? "Abrir chamados de suporte relacionados" : null,
      relations.some((item) => item.related.type === "document" || item.related.type === "pdf") ? "Abrir documentos e evidências" : null,
    ].filter((item): item is string => Boolean(item))),
  ).slice(0, 8);
}

function formatKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function BrainNodeOverlay({
  node,
  nodes,
  edges,
  onClose,
  onResetFocus,
  onOpenRelatedModule,
  debugMode = false,
}: BrainNodeOverlayProps) {
  if (typeof document === "undefined") return null;

  const relations = relationRows(node, nodes, edges);
  const relatedNodes = relations.map((item) => item.related);
  const metadata = compactMetadata(node);
  const actions = inferActions(node, relations);
  const pendingItems = [
    ...(node.missingKnowledge ?? []),
    ...relatedNodes.flatMap((item) => item.missingKnowledge ?? []).slice(0, 8),
  ];
  const areaCounts = groupCounts([node, ...relatedNodes]);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[9999] text-white">
      <article className="qc-brain-memory-panel pointer-events-auto fixed right-6 top-20 flex max-h-[calc(100dvh-112px)] w-[min(560px,calc(100vw-32px))] flex-col overflow-hidden rounded-[26px] border border-cyan-100/18 bg-[linear-gradient(145deg,rgba(4,13,29,0.98),rgba(8,23,42,0.98))] text-white shadow-[0_28px_100px_rgba(0,0,0,0.68)]">
        <header className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.94),rgba(88,28,135,0.32))] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-100/20 bg-cyan-100/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-50">
                  {nodeStatusLabel(node.status)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/72">
                  {nodeTypeLabel(node.type)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/72">
                  {node.module}
                </span>
              </div>

              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100/55">Memória do nó</p>
              <h2 className="mt-1 text-2xl font-black leading-tight text-white">{node.label}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-200/82">{memoryText(node)}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:border-rose-200/40 hover:text-white"
              aria-label="Fechar memória"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/46 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/45">Conexões</p>
              <p className="mt-1 text-2xl font-black text-white">{relations.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/46 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/45">Pendências</p>
              <p className="mt-1 text-2xl font-black text-white">{pendingItems.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/46 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/45">Áreas</p>
              <p className="mt-1 text-2xl font-black text-white">{areaCounts.length}</p>
            </div>
          </div>

          {metadata.length ? (
            <section className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/45">Dados conhecidos</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {metadata.map((item) => (
                  <div key={item.key} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{formatKey(item.key)}</p>
                    <p className="mt-1 break-words text-xs font-bold text-slate-100">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {debugMode ? (
            <section className="mt-3 rounded-2xl border border-sky-200/18 bg-sky-200/[0.07] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-100/70">Debug QA</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  ["nodeId", node.id],
                  ["type", node.type],
                  ["moduleId", node.module],
                  ["requiredPermissions", readable(node.requiredPermissions ?? node.metadata?.requiredPermissions ?? node.metadata?.requiredPermission) ?? "nao informado"],
                  ["visibleByPermission", String(node.visibleByPermission ?? true)],
                  ["source", readable(node.source ?? node.metadata?.source ?? node.generatedBy ?? "initial") ?? "initial"],
                  ["edges count", String(relations.length)],
                  ["actions count", String(actions.length)],
                ].map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-sky-100/10 bg-black/18 px-3 py-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-sky-100/45">{key}</p>
                    <p className="mt-1 break-words text-xs font-bold text-sky-50/90">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/45">Ações disponíveis</p>
            <div className="mt-2 grid gap-2">
              {actions.map((action) => (
                <button key={action} type="button" onClick={() => onOpenRelatedModule(node.module)} className="flex items-center gap-2 rounded-xl border border-cyan-100/12 bg-cyan-100/[0.06] px-3 py-2 text-left text-xs font-bold text-cyan-50 hover:border-cyan-100/35">
                  <FiZap className="h-3.5 w-3.5 shrink-0" />
                  {action}
                </button>
              ))}
            </div>
          </section>

          {areaCounts.length ? (
            <section className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/45">Áreas relacionadas</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {areaCounts.map(([module, count]) => (
                  <button key={module} type="button" onClick={() => onOpenRelatedModule(module)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/78 hover:border-cyan-100/40 hover:text-cyan-50">
                    {module} · {count}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/45">Relações principais</p>
            <div className="mt-2 grid gap-2">
              {relations.slice(0, 12).map(({ edge, related, direction }) => (
                <button key={edge.id} type="button" onClick={() => onOpenRelatedModule(related.module)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left hover:border-cyan-100/32">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">{related.label}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">{edge.label} · {direction} · {related.module}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[10px] font-black uppercase text-slate-300">
                      {nodeStatusLabel(related.status)}
                    </span>
                  </div>
                </button>
              ))}
              {!relations.length ? <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs font-bold text-slate-400">Nenhuma relação disponível neste recorte.</p> : null}
            </div>
          </section>

          {pendingItems.length ? (
            <section className="mt-3 rounded-2xl border border-amber-200/16 bg-amber-200/[0.06] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/70">Conhecimento faltante</p>
              <ul className="mt-2 grid gap-2">
                {Array.from(new Set(pendingItems)).slice(0, 8).map((item) => (
                  <li key={item} className="rounded-xl border border-amber-200/12 bg-black/16 px-3 py-2 text-xs font-bold leading-5 text-amber-50/88">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-white/10 bg-slate-950/72 p-3">
          <button type="button" onClick={onResetFocus} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/70 hover:border-cyan-100/35 hover:text-white">
            <FiRefreshCw className="h-3.5 w-3.5" />
            Limpar foco
          </button>

          <button type="button" onClick={() => onOpenRelatedModule(node.module)} className="inline-flex items-center gap-2 rounded-xl border border-cyan-100/25 bg-cyan-100/10 px-3 py-2 text-xs font-black text-cyan-50 hover:border-cyan-100/60">
            <FiActivity className="h-3.5 w-3.5" />
            Ver área
            <FiExternalLink className="h-3.5 w-3.5" />
          </button>
        </footer>
      </article>
    </div>,
    document.body,
  );
}

