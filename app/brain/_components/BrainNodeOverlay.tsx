"use client";

import { createPortal } from "react-dom";
import { FiExternalLink, FiRefreshCw, FiX } from "react-icons/fi";
import type { BrainEdge, BrainNode } from "../_types/brain.types";

type BrainNodeOverlayProps = {
  node: BrainNode;
  nodes: BrainNode[];
  edges: BrainEdge[];
  onClose: () => void;
  onResetFocus: () => void;
  onOpenRelatedModule: (module: string) => void;
};

function memoryText(node: BrainNode) {
  return (
    node.information ||
    node.description ||
    "Este no representa uma memoria do Brain dentro do contexto selecionado."
  );
}

function statusLabel(status: BrainNode["status"]) {
  if (status === "ok") return "ok";
  if (status === "warning") return "atencao";
  if (status === "error") return "erro";
  if (status === "orphan") return "orfao";
  return "pendente";
}

export function BrainNodeOverlay({
  node,
  nodes,
  edges,
  onClose,
  onResetFocus,
  onOpenRelatedModule,
}: BrainNodeOverlayProps) {
  if (typeof document === "undefined") return null;

  const relatedNodes = edges
    .filter((edge) => edge.source === node.id || edge.target === node.id)
    .map((edge) => {
      const relatedId = edge.source === node.id ? edge.target : edge.source;
      return nodes.find((item) => item.id === relatedId);
    })
    .filter((item): item is BrainNode => Boolean(item))
    .slice(0, 4);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[9999] text-white">
      <article
        className="pointer-events-auto fixed right-6 top-24 w-[min(420px,calc(100vw-32px))] overflow-hidden rounded-[24px] border border-cyan-100/20 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.62)]"
        style={{
          background:
            "linear-gradient(145deg, rgba(4, 13, 29, 0.98), rgba(6, 23, 42, 0.98))",
          color: "#fff",
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-100/20 bg-cyan-100/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-50">
                {statusLabel(node.status)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/70">
                {node.module}
              </span>
            </div>

            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/50">
              Memoria do no
            </p>
            <h2 className="mt-1 text-xl font-black leading-tight text-white">{node.label}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:border-rose-200/40 hover:text-white"
            aria-label="Fechar memoria"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <p className="rounded-2xl border border-white/10 bg-slate-950/55 p-3 text-sm font-semibold leading-6 text-slate-100">
          {memoryText(node)}
        </p>

        {relatedNodes.length ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/45">
              Conexoes proximas
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {relatedNodes.map((related) => (
                <button
                  key={related.id}
                  type="button"
                  onClick={() => onOpenRelatedModule(related.module)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/75 hover:border-cyan-100/40 hover:text-cyan-50"
                >
                  {related.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onResetFocus}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/70 hover:border-cyan-100/35 hover:text-white"
          >
            <FiRefreshCw className="h-3.5 w-3.5" />
            Limpar foco
          </button>

          <button
            type="button"
            onClick={() => onOpenRelatedModule(node.module)}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-100/25 bg-cyan-100/10 px-3 py-2 text-xs font-black text-cyan-50 hover:border-cyan-100/60"
          >
            Ver modulo
            <FiExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </article>
    </div>,
    document.body,
  );
}
