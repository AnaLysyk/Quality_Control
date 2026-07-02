"use client";

import { FiArrowRight, FiBox } from "react-icons/fi";
import type { BrainEdge, BrainNode } from "../_types/brain.types";
import { nodeStatusLabel, nodeTypeLabel } from "../_utils/brainGraphFormatters";

type BrainNodeDetailsPanelProps = {
  node: BrainNode | null;
  nodes: BrainNode[];
  edges: BrainEdge[];
};

export function BrainNodeDetailsPanel({ node, nodes, edges }: BrainNodeDetailsPanelProps) {
  if (!node) {
    return (
      <aside className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.07)] dark:border-slate-700 dark:bg-slate-900">
        <FiBox className="h-8 w-8 text-slate-400" />
        <h2 className="mt-3 text-lg font-black text-slate-950 dark:text-white">Selecione um no</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Clique em qualquer card do grafo para ver detalhes, conexoes e pendencias.
        </p>
      </aside>
    );
  }

  const relatedEdges = edges.filter((edge) => edge.source === node.id || edge.target === node.id);
  const relatedNodes = relatedEdges
    .map((edge) => nodes.find((candidate) => candidate.id === (edge.source === node.id ? edge.target : edge.source)))
    .filter((candidate): candidate is BrainNode => Boolean(candidate));

  return (
    <aside className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.07)] dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ef0001] dark:text-rose-200">
            {nodeTypeLabel(node.type)}
          </p>
          <h2 className="mt-2 text-xl font-black leading-7 text-slate-950 dark:text-white">{node.label}</h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {nodeStatusLabel(node.status)}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{node.description || "Sem descricao registrada."}</p>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Conexoes</p>
        {relatedEdges.length ? (
          <div className="mt-3 space-y-2">
            {relatedEdges.slice(0, 12).map((edge, index) => {
              const target = relatedNodes[index];
              return (
                <div key={edge.id} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <FiArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-[#ef0001]" />
                  <span>
                    <strong>{edge.label}</strong>
                    {target ? `: ${target.label}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Este no esta orfao neste recorte.</p>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Acoes disponiveis</p>
        <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <li>Consultar conexoes e pendencias do no.</li>
          {node.type === "access_request" ? <li>Abrir Solicitacoes de acesso para conferir a solicitacao.</li> : null}
          {node.status === "missing" || node.status === "pending" ? <li>Registrar integracao pendente no Brain real.</li> : null}
        </ul>
      </div>
    </aside>
  );
}

