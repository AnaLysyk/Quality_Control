"use client";

import { FiArrowRight, FiBox, FiExternalLink, FiGitBranch, FiInfo } from "react-icons/fi";
import type { BrainEdge, BrainNode } from "../_types/brain.types";
import { nodeStatusLabel, nodeTypeLabel } from "../_utils/brainGraphFormatters";
import { describeInformation } from "../_utils/brainGraphLayout";

type BrainNodeInspectorProps = {
  node: BrainNode | null;
  nodes: BrainNode[];
  edges: BrainEdge[];
  onOpenRelatedModule: (module: string) => void;
};

export function BrainNodeInspector({ node, nodes, edges, onOpenRelatedModule }: BrainNodeInspectorProps) {
  if (!node) {
    return (
      <aside className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <FiInfo className="h-6 w-6 text-cyan-100" />
        <h2 className="mt-3 text-lg font-black">Selecione um neuronio</h2>
        <p className="mt-2 text-sm leading-6 text-white/62">Clique em um no para ver o conhecimento, as conexoes e a informacao formada.</p>
      </aside>
    );
  }

  const incoming = edges.filter((edge) => edge.target === node.id);
  const outgoing = edges.filter((edge) => edge.source === node.id);
  const missing = node.missingKnowledge ?? [];
  const actions = node.actions ?? ["Explicar conexoes", "Mostrar modulo", "Revisar pendencias"];
  const formedInformation = describeInformation(node, nodes, edges);

  function nodeLabel(id: string) {
    return nodes.find((candidate) => candidate.id === id)?.label ?? id;
  }

  return (
    <aside className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-200/24 bg-cyan-200/10 text-cyan-100">
              {node.type === "module" ? <FiGitBranch className="h-4 w-4" /> : <FiBox className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/80">{nodeTypeLabel(node.type)}</p>
              <h2 className="mt-0.5 text-xl font-black leading-7">{node.label}</h2>
            </div>
          </div>
          <p className="mt-2 text-xs font-bold text-white/52">{node.module} / {node.projectName ?? "Quality Control"}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/18 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/75">
          {nodeStatusLabel(node.status)}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-cyan-200/18 bg-cyan-200/[0.075] p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/75">Informacao formada</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-cyan-50/90">{formedInformation}</p>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/14 p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-black">{incoming.length + outgoing.length}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/42">total</p>
          </div>
          <div>
            <p className="text-2xl font-black">{incoming.length}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/42">entrada</p>
          </div>
          <div>
            <p className="text-2xl font-black">{outgoing.length}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/42">saida</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/14 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Principais conexoes de entrada</p>
          <div className="mt-2 space-y-2">
            {incoming.length ? (
              incoming.slice(0, 6).map((edge) => (
                <p key={edge.id} className="flex gap-2 text-xs font-semibold leading-5 text-white/70">
                  <FiArrowRight className="mt-1 h-3 w-3 shrink-0 text-cyan-100" />
                  <span>{nodeLabel(edge.source)}: {edge.label}</span>
                </p>
              ))
            ) : (
              <p className="text-xs font-semibold text-white/45">Sem conexoes de entrada.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/14 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Principais conexoes de saida</p>
          <div className="mt-2 space-y-2">
            {outgoing.length ? (
              outgoing.slice(0, 6).map((edge) => (
                <p key={edge.id} className="flex gap-2 text-xs font-semibold leading-5 text-white/70">
                  <FiArrowRight className="mt-1 h-3 w-3 shrink-0 text-cyan-100" />
                  <span>{edge.label}: {nodeLabel(edge.target)}</span>
                </p>
              ))
            ) : (
              <p className="text-xs font-semibold text-white/45">Sem conexoes de saida.</p>
            )}
          </div>
        </div>
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {[
          ["Empresa", node.companyName ?? "Restrito ou nao informado"],
          ["Projeto", node.projectName ?? "Quality Control"],
          ["Criado por", node.createdBy ?? "Sistema/ingestao"],
          ["Criado em", node.createdAt ? new Date(node.createdAt).toLocaleString("pt-BR") : "Nao informado"],
          ["Gerado por", node.generatedBy ?? "system"],
          ["Permissao", "Visivel conforme seu perfil"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-black/12 px-3 py-2">
            <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-white/42">{label}</dt>
            <dd className="mt-1 text-xs font-bold text-white/76">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 rounded-2xl border border-yellow-200/18 bg-yellow-200/[0.06] p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-yellow-100/75">Pendencias</p>
        {missing.length ? (
          <ul className="mt-2 space-y-1.5 text-xs font-semibold leading-5 text-yellow-50/82">
            {missing.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : (
          <p className="mt-2 text-xs font-semibold text-yellow-50/65">Sem pendencias especificas neste no.</p>
        )}
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Acoes possiveis</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => action === "Abrir modulo relacionado" || action === "Mostrar modulo" ? onOpenRelatedModule(node.module) : undefined}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-black text-white/76 transition hover:border-cyan-200/55 hover:text-cyan-100"
            >
              {action}
              {action.includes("modulo") ? <FiExternalLink className="h-3 w-3" /> : null}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

