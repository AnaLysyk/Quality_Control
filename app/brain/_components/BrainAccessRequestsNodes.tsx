"use client";

import Link from "next/link";
import type { BuiltBrainGraph } from "../_types/brain.types";

type BrainAccessRequestsNodesProps = {
  graph: BuiltBrainGraph;
};

export function BrainAccessRequestsNodes({ graph }: BrainAccessRequestsNodesProps) {
  const requests = graph.requests;
  const withoutNode = requests.filter((request) => {
    const node = graph.nodes.find((candidate) => candidate.id === `access_request:${request.id}`);
    return node?.metadata?.hasRealNode !== true;
  });

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.07)] dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Solicitacoes de acesso</p>
          <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Cobertura no Brain</h2>
        </div>
        <Link
          href="/admin/access-requests"
          className="rounded-2xl bg-[#011848] px-4 py-2 text-sm font-black text-white transition hover:bg-[#ef0001] dark:bg-white dark:text-[#011848] dark:hover:bg-rose-100"
        >
          Abrir Solicitacoes de acesso
        </Link>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/60">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Carregadas</p>
          <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{requests.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">Sem no real</p>
          <p className="mt-1 text-2xl font-black text-amber-800 dark:text-amber-100">{withoutNode.length}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-500/30 dark:bg-rose-500/10">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-700 dark:text-rose-200">Logs vinculados</p>
          <p className="mt-1 text-2xl font-black text-rose-800 dark:text-rose-100">{graph.summary.logsLinked}</p>
        </div>
      </div>

      <div className="mt-4 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        {requests.length === 0 ? (
          <p className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Nenhuma solicitacao carregada para o Brain agora.</p>
        ) : (
          requests.slice(0, 12).map((request) => {
            const missing = withoutNode.some((item) => item.id === request.id);
            return (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950 dark:text-white">{request.name}</p>
                  <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{request.email} | {request.accessType}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                  missing
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                }`}>
                  {missing ? "sem no real" : "com no"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

