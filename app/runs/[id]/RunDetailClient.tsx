"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiCheckCircle,
  FiClock,
  FiCloud,
  FiFileText,
  FiGitBranch,
  FiRefreshCcw,
  FiShield,
  FiXCircle,
} from "react-icons/fi";
import { fetchApi } from "@/lib/api";

type RunStatus = "draft" | "scheduled" | "in_progress" | "paused" | "completed" | "cancelled" | "aborted";
type RunItemStatus = "not_run" | "in_progress" | "passed" | "failed" | "blocked" | "skipped" | "retest";

type RunSummary = {
  totalItems: number;
  notRunCount: number;
  inProgressCount: number;
  passedCount: number;
  failedCount: number;
  blockedCount: number;
  skippedCount: number;
  retestCount: number;
  passRate: number;
  failRate: number;
  blockedRate: number;
  progressPercent: number;
  defectsLinked: number;
  evidenceCount: number;
  estimatedMinutes: number;
  actualMinutes: number;
  varianceMinutes: number;
};

type RunEvidence = {
  id: string;
  type?: string | null;
  name?: string | null;
  url?: string | null;
  createdAt: string;
};

type RunAttempt = {
  id: string;
  attemptNumber: number;
  status: RunItemStatus;
  executorId?: string | null;
  actualResult?: string | null;
  failureReason?: string | null;
  blockedReason?: string | null;
  skipReason?: string | null;
  durationSeconds?: number | null;
  createdAt: string;
};

type RunItem = {
  id: string;
  caseId: string;
  caseVersion: number;
  caseKey: string;
  caseTitle: string;
  suitePath?: string | null;
  priority?: string | null;
  isRequired: boolean;
  assigneeId?: string | null;
  executorId?: string | null;
  status: RunItemStatus;
  durationSeconds?: number | null;
  estimatedMinutes: number;
  attemptNumber: number;
  failureReason?: string | null;
  blockedReason?: string | null;
  skipReason?: string | null;
  actualResult?: string | null;
  notes?: string | null;
  defectId?: string | null;
  evidenceIds: string[];
  evidences: RunEvidence[];
  qaseResultId?: string | null;
  qaseSyncStatus?: "pending" | "synced" | "failed" | "skipped";
  qaseSyncError?: string | null;
  attempts: RunAttempt[];
  updatedAt: string;
};

type RunRecord = {
  id: string;
  companyId: string;
  projectId: string;
  planId: string;
  planSnapshotId: string;
  title: string;
  description?: string | null;
  runType: string;
  status: RunStatus;
  source: string;
  qaseRunId?: string | null;
  qaseProjectCode?: string | null;
  environment?: string | null;
  buildVersion?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdBy: string;
  runOwnerId: string;
  items: RunItem[];
  summary: RunSummary;
  updatedAt: string;
};

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  error?: { message?: string; details?: unknown };
};

type TabId = "overview" | "items" | "evidence" | "defects" | "history" | "qase";

const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "overview", label: "VisÃ£o geral", icon: FiBarChart2 },
  { id: "items", label: "Itens", icon: FiCheckCircle },
  { id: "evidence", label: "EvidÃªncias", icon: FiFileText },
  { id: "defects", label: "Defeitos", icon: FiAlertTriangle },
  { id: "history", label: "HistÃ³rico", icon: FiClock },
  { id: "qase", label: "Qase", icon: FiCloud },
];

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  in_progress: "Em execuÃ§Ã£o",
  paused: "Pausada",
  completed: "Finalizada",
  cancelled: "Cancelada",
  aborted: "Abortada",
  not_run: "NÃ£o executado",
  passed: "Passou",
  failed: "Falhou",
  blocked: "Bloqueado",
  skipped: "Ignorado",
  retest: "Reteste",
  pending: "Pendente",
  synced: "Sincronizado",
};

function formatDate(value?: string | null) {
  if (!value) return "N/D";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusTone(status: string) {
  if (status === "passed" || status === "completed" || status === "synced") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "failed" || status === "aborted" || status === "cancelled") return "border-red-300 bg-red-50 text-red-800";
  if (status === "blocked" || status === "paused" || status === "pending") return "border-amber-300 bg-amber-50 text-amber-800";
  if (status === "in_progress" || status === "retest") return "border-sky-300 bg-sky-50 text-sky-800";
  return "border-slate-300 bg-slate-50 text-slate-700";
}

function StatusPill({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${statusTone(status)}`}>{STATUS_LABEL[status] ?? status}</span>;
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4 shadow-[0_18px_38px_rgba(0,0,0,0.18)]">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/55">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs font-semibold text-white/55">{hint}</p> : null}
    </div>
  );
}

export default function RunDetailClient({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunRecord | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchApi(`/api/quality/runs/${encodeURIComponent(runId)}`);
      const json = (await response.json()) as ApiEnvelope<{ run: RunRecord }>;
      if (!response.ok || json.success === false || !json.data?.run) {
        throw new Error(json.message || json.error?.message || "Falha ao carregar run");
      }
      setRun(json.data.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
      setRun(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const allAttempts = useMemo(() => {
    return run?.items.flatMap((item) => item.attempts.map((attempt) => ({ ...attempt, caseKey: item.caseKey, caseTitle: item.caseTitle }))) ?? [];
  }, [run]);

  const allEvidence = useMemo(() => {
    return run?.items.flatMap((item) => item.evidences.map((evidence) => ({ ...evidence, caseKey: item.caseKey, caseTitle: item.caseTitle }))) ?? [];
  }, [run]);

  const defects = useMemo(() => run?.items.filter((item) => item.defectId) ?? [], [run]);
  const qasePending = useMemo(() => run?.items.filter((item) => item.qaseSyncStatus === "pending" || item.qaseSyncStatus === "failed") ?? [], [run]);

  const updateRunStatus = async (status: RunStatus) => {
    if (!run) return;
    setSaving(`run-${status}`);
    setError(null);
    try {
      const response = await fetchApi(`/api/quality/runs/${encodeURIComponent(run.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, actorId: "ui-run-detail" }),
      });
      const json = (await response.json()) as ApiEnvelope<{ run: RunRecord }>;
      if (!response.ok || json.success === false || !json.data?.run) {
        throw new Error(json.message || json.error?.message || "Falha ao atualizar status");
      }
      setRun(json.data.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(null);
    }
  };

  const updateItem = async (item: RunItem, status: RunItemStatus) => {
    if (!run) return;
    const payload: Record<string, unknown> = { status, actorId: "ui-run-detail", executorId: "ui-run-detail" };
    if (status === "failed") {
      const reason = typeof window !== "undefined" ? window.prompt("Motivo da falha / resultado atual") : "Falha registrada pela UI";
      if (!reason) return;
      payload.failureReason = reason;
      payload.actualResult = reason;
    }
    if (status === "blocked") {
      const reason = typeof window !== "undefined" ? window.prompt("Motivo do bloqueio") : "Bloqueio registrado pela UI";
      if (!reason) return;
      payload.blockedReason = reason;
    }
    if (status === "skipped" && item.isRequired) {
      const reason = typeof window !== "undefined" ? window.prompt("Justificativa para pular item obrigatÃ³rio") : "Item pulado pela UI";
      if (!reason) return;
      payload.skipReason = reason;
    }
    setSaving(item.id);
    setError(null);
    try {
      const response = await fetchApi(`/api/quality/runs/${encodeURIComponent(run.id)}/items/${encodeURIComponent(item.id)}/result`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json()) as ApiEnvelope<{ run: RunRecord }>;
      if (!response.ok || json.success === false || !json.data?.run) {
        throw new Error(json.message || json.error?.message || "Falha ao atualizar item");
      }
      setRun(json.data.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(null);
    }
  };

  if (loading && !run) {
    return <main className="min-h-screen px-6 py-10 text-white"><div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-white/8 p-6">Carregando run...</div></main>;
  }

  if (error && !run) {
    return <main className="min-h-screen px-6 py-10 text-white"><div className="mx-auto max-w-7xl rounded-2xl border border-red-400/40 bg-red-500/10 p-6 text-red-100">{error}</div></main>;
  }

  if (!run) {
    return <main className="min-h-screen px-6 py-10 text-white"><div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-white/8 p-6">Run nÃ£o encontrada.</div></main>;
  }

  return (
    <main className="min-h-screen px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-[#0f1626]/88 p-6 shadow-[0_22px_48px_rgba(0,0,0,0.28)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-orange-300"><FiGitBranch /> Run operacional</p>
              <h1 className="mt-2 text-3xl font-black text-white">{run.title}</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-white/62">{run.description || "ExecuÃ§Ã£o local criada a partir de plano de teste, com itens, evidÃªncias, defeitos e sync Qase rastreÃ¡veis."}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-white/68">
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1">Projeto: {run.projectId}</span>
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1">Plano: {run.planId}</span>
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1">Snapshot: {run.planSnapshotId}</span>
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1">Ambiente: {run.environment || "N/D"}</span>
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1">Build: {run.buildVersion || "N/D"}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/8 p-4 lg:min-w-72">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/55">Status</span>
                <StatusPill status={run.status} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={saving !== null} onClick={() => updateRunStatus("in_progress")} className="rounded-xl border border-sky-300/30 bg-sky-400/15 px-3 py-2 text-xs font-black text-sky-50 disabled:opacity-50">Iniciar</button>
                <button disabled={saving !== null} onClick={() => updateRunStatus("paused")} className="rounded-xl border border-amber-300/30 bg-amber-400/15 px-3 py-2 text-xs font-black text-amber-50 disabled:opacity-50">Pausar</button>
                <button disabled={saving !== null} onClick={() => updateRunStatus("completed")} className="rounded-xl border border-emerald-300/30 bg-emerald-400/15 px-3 py-2 text-xs font-black text-emerald-50 disabled:opacity-50">Finalizar</button>
                <button disabled={saving !== null} onClick={load} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white disabled:opacity-50"><FiRefreshCcw className="inline" /> Reload</button>
              </div>
            </div>
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">{error}</div> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Progresso" value={`${run.summary.progressPercent}%`} hint={`${run.summary.totalItems} itens`} />
          <StatCard label="Pass rate" value={`${run.summary.passRate}%`} hint={`${run.summary.passedCount} passou`} />
          <StatCard label="Falhas" value={run.summary.failedCount} hint={`${run.summary.defectsLinked} defeitos vinculados`} />
          <StatCard label="Tempo" value={`${run.summary.actualMinutes}m`} hint={`estimado ${run.summary.estimatedMinutes}m`} />
        </div>

        <nav className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/8 p-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition ${selected ? "bg-white text-slate-950" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                <Icon className="h-4 w-4" /> {tab.label}
              </button>
            );
          })}
        </nav>

        {activeTab === "overview" ? (
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/8 p-5 lg:col-span-2">
              <h2 className="text-lg font-black">SaÃºde da execuÃ§Ã£o</h2>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, Math.max(0, run.summary.progressPercent))}%` }} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <StatCard label="NÃ£o executado" value={run.summary.notRunCount} />
                <StatCard label="Bloqueado" value={run.summary.blockedCount} />
                <StatCard label="Reteste" value={run.summary.retestCount} />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 p-5">
              <h2 className="text-lg font-black">Risco</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-white/65">
                {run.summary.failedCount || run.summary.blockedCount ? "HÃ¡ risco operacional: existem falhas ou bloqueios na execuÃ§Ã£o." : "Sem risco crÃ­tico registrado atÃ© o momento."}
              </p>
              <p className="mt-4 text-xs font-semibold text-white/50">Atualizado em {formatDate(run.updatedAt)}</p>
            </div>
          </section>
        ) : null}

        {activeTab === "items" ? (
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/8">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-white/8 text-xs uppercase tracking-[0.16em] text-white/55">
                  <tr>
                    <th className="px-4 py-3">Caso</th>
                    <th className="px-4 py-3">Suite</th>
                    <th className="px-4 py-3">Resp.</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Tempo</th>
                    <th className="px-4 py-3">Defeito/EvidÃªncia</th>
                    <th className="px-4 py-3">AÃ§Ãµes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {run.items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-black text-white">{item.caseKey}</p>
                        <p className="mt-1 max-w-sm text-xs font-semibold text-white/60">{item.caseTitle}</p>
                      </td>
                      <td className="px-4 py-3 text-white/65">{item.suitePath || "N/D"}</td>
                      <td className="px-4 py-3 text-white/65">{item.assigneeId || item.executorId || "N/D"}</td>
                      <td className="px-4 py-3"><StatusPill status={item.status} /></td>
                      <td className="px-4 py-3 text-white/65">{Math.round((item.durationSeconds || 0) / 60)}m / {item.estimatedMinutes}m</td>
                      <td className="px-4 py-3 text-xs font-semibold text-white/65">
                        <p>Defeito: {item.defectId || "N/D"}</p>
                        <p>EvidÃªncias: {item.evidenceIds.length}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button disabled={saving !== null} onClick={() => updateItem(item, "passed")} className="rounded-lg bg-emerald-500/20 px-2 py-1 text-xs font-black text-emerald-100 disabled:opacity-50"><FiCheckCircle className="inline" /> Pass</button>
                          <button disabled={saving !== null} onClick={() => updateItem(item, "failed")} className="rounded-lg bg-red-500/20 px-2 py-1 text-xs font-black text-red-100 disabled:opacity-50"><FiXCircle className="inline" /> Fail</button>
                          <button disabled={saving !== null} onClick={() => updateItem(item, "blocked")} className="rounded-lg bg-amber-500/20 px-2 py-1 text-xs font-black text-amber-100 disabled:opacity-50"><FiShield className="inline" /> Block</button>
                          <button disabled={saving !== null} onClick={() => updateItem(item, "retest")} className="rounded-lg bg-sky-500/20 px-2 py-1 text-xs font-black text-sky-100 disabled:opacity-50">Reteste</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === "evidence" ? (
          <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {allEvidence.length ? allEvidence.map((evidence) => (
              <article key={evidence.id} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/50">{evidence.type || "evidence"}</p>
                <h3 className="mt-2 font-black">{evidence.name || evidence.id}</h3>
                <p className="mt-1 text-xs font-semibold text-white/55">{evidence.caseKey} â€” {evidence.caseTitle}</p>
                {evidence.url ? <a href={evidence.url} className="mt-3 inline-flex text-sm font-black text-sky-200">Abrir evidÃªncia</a> : null}
              </article>
            )) : <EmptyState text="Nenhuma evidÃªncia vinculada ainda." />}
          </section>
        ) : null}

        {activeTab === "defects" ? (
          <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {defects.length ? defects.map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-red-200">Defeito</p>
                <h3 className="mt-2 font-black">{item.defectId}</h3>
                <p className="mt-1 text-sm font-semibold text-white/65">{item.caseKey} â€” {item.caseTitle}</p>
                <p className="mt-2 text-xs text-white/50">Motivo: {item.failureReason || item.blockedReason || "N/D"}</p>
              </article>
            )) : <EmptyState text="Nenhum defeito vinculado Ã  run." />}
          </section>
        ) : null}

        {activeTab === "history" ? (
          <section className="space-y-3">
            {allAttempts.length ? allAttempts.slice().reverse().map((attempt) => (
              <article key={attempt.id} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black">Tentativa {attempt.attemptNumber} â€” {attempt.caseKey}</p>
                  <StatusPill status={attempt.status} />
                </div>
                <p className="mt-1 text-sm font-semibold text-white/60">{attempt.caseTitle}</p>
                <p className="mt-2 text-xs text-white/45">Executor: {attempt.executorId || "N/D"} â€¢ {formatDate(attempt.createdAt)}</p>
              </article>
            )) : <EmptyState text="Nenhuma tentativa registrada ainda." />}
          </section>
        ) : null}

        {activeTab === "qase" ? (
          <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-2xl border border-white/10 bg-white/8 p-5">
              <h2 className="text-lg font-black">SincronizaÃ§Ã£o Qase</h2>
              <p className="mt-3 text-sm font-semibold text-white/60">Projeto: {run.qaseProjectCode || "N/D"}</p>
              <p className="mt-1 text-sm font-semibold text-white/60">Run ID: {run.qaseRunId || "N/D"}</p>
              <p className="mt-1 text-sm font-semibold text-white/60">Pendentes/falhos: {qasePending.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 p-5">
              <h2 className="text-lg font-black">Itens com sync</h2>
              <div className="mt-3 space-y-2">
                {run.items.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-sm font-semibold text-white/70">{item.caseKey}</span>
                    <StatusPill status={item.qaseSyncStatus || "skipped"} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-sm font-semibold text-white/60">{text}</div>;
}

