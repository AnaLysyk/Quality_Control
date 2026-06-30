"use client";

import { FiCheckCircle, FiSend } from "react-icons/fi";
import { QASE_EVERYTHING_SCOPES, QASE_SYNC_SCOPE_LABELS, type QaseSyncMode, type QaseSyncScope } from "@/lib/qaseIntegrationPolicy";

export type QaseFullSyncSummaryProps = {
  mode: QaseSyncMode;
  scopes?: QaseSyncScope[];
  hasToken: boolean;
  selectedProjectCodes: string[];
  primaryProjectCode?: string | null;
};

export function QaseFullSyncSummary({
  mode,
  scopes,
  hasToken,
  selectedProjectCodes,
  primaryProjectCode,
}: QaseFullSyncSummaryProps) {
  const projectCodes = selectedProjectCodes.map((code) => code.trim().toUpperCase()).filter(Boolean);
  const canSync = hasToken && projectCodes.length > 0;
  const effectiveScopes = mode === "everything" ? QASE_EVERYTHING_SCOPES : scopes ?? [];

  if (!canSync) {
    return (
      <div className="rounded-xl border border-dashed border-sky-300 bg-sky-50 px-4 py-4 text-sm font-semibold leading-6 text-sky-900 dark:border-sky-700/55 dark:bg-sky-950/30 dark:text-sky-100">
        Configure token e ao menos um projeto Qase para habilitar sincronização.
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-sky-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] dark:border-sky-700/45 dark:bg-slate-950/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-slate-50">
            <FiSend className="h-4 w-4 text-sky-500" /> Sincronização com Qase
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
            Quando a empresa optar por sincronização completa, o Quality Control fica como origem operacional e o Qase recebe os artefatos selecionados.
          </p>
        </div>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black text-sky-700 dark:border-sky-700/55 dark:bg-sky-950/50 dark:text-sky-100">
          {mode === "everything" ? "Enviar tudo ao Qase" : "Sincronização seletiva"}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">Projetos Qase</p>
          <p className="mt-1 text-sm font-black text-slate-950 dark:text-slate-50">{projectCodes.length} selecionado{projectCodes.length === 1 ? "" : "s"}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">Principal: {primaryProjectCode || projectCodes[0] || "não definido"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">Escopos</p>
          <p className="mt-1 text-sm font-black text-slate-950 dark:text-slate-50">{effectiveScopes.length} habilitado{effectiveScopes.length === 1 ? "" : "s"}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">Casos, runs, resultados, defeitos e evidências ficam rastreáveis.</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {effectiveScopes.map((scope) => (
          <span key={scope} className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-black text-sky-700 dark:border-sky-700/55 dark:bg-sky-950/50 dark:text-sky-100">
            <FiCheckCircle className="h-3 w-3" /> {QASE_SYNC_SCOPE_LABELS[scope]}
          </span>
        ))}
      </div>
    </section>
  );
}
