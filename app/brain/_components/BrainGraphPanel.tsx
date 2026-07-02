"use client";

import { FiGitBranch, FiInfo } from "react-icons/fi";
import type { BrainEdge, BrainNode } from "../_types/brain.types";
import { nodeStatusLabel, nodeTypeLabel } from "../_utils/brainGraphFormatters";

type BrainGraphPanelProps = {
  nodes: BrainNode[];
  edges: BrainEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: BrainNode) => void;
};

function statusClass(status: BrainNode["status"]) {
  if (status === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200";
  if (status === "warning") return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200";
  if (status === "missing") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200";
  if (status === "pending") return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200";
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";
}

export function BrainGraphPanel({ nodes, edges, selectedNodeId, onSelectNode }: BrainGraphPanelProps) {
  const connectionCounts = edges.reduce<Record<string, number>>((acc, edge) => {
    acc[edge.source] = (acc[edge.source] ?? 0) + 1;
    acc[edge.target] = (acc[edge.target] ?? 0) + 1;
    return acc;
  }, {});

  if (nodes.length === 0) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <div className="max-w-md">
          <FiGitBranch className="mx-auto h-10 w-10 text-slate-400" />
          <h2 className="mt-4 text-lg font-black text-slate-950 dark:text-white">Nenhum no carregado</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            O Brain nao encontrou dados visiveis para este recorte. Verifique permissoes ou tente recarregar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {nodes.map((node) => {
        const selected = selectedNodeId === node.id;
        return (
          <button
            key={node.id}
            type="button"
            onClick={() => onSelectNode(node)}
            className={`min-h-44 rounded-[22px] border bg-white p-4 text-left shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(15,23,42,0.10)] dark:bg-slate-900 ${
              selected ? "border-[#ef0001] ring-4 ring-rose-100 dark:ring-rose-500/20" : "border-slate-200 dark:border-slate-700"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {nodeTypeLabel(node.type)}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass(node.status)}`}>
                {nodeStatusLabel(node.status)}
              </span>
            </div>
            <h3 className="mt-3 line-clamp-2 text-base font-black leading-6 text-slate-950 dark:text-white">{node.label}</h3>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{node.description || "Sem descricao registrada."}</p>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>{connectionCounts[node.id] ?? 0} conexao(oes)</span>
              <span className="inline-flex items-center gap-1 text-[#ef0001] dark:text-rose-200">
                <FiInfo /> ver detalhes
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

