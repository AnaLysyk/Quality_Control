"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiBarChart2, FiCheckCircle, FiClock, FiPlayCircle, FiPlus, FiRefreshCcw, FiSearch } from "react-icons/fi";
import { fetchApi } from "@/lib/api";

type RunStatus = "draft" | "scheduled" | "in_progress" | "paused" | "completed" | "cancelled" | "aborted";

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

type RunItem = {
  id: string;
  caseKey: string;
  caseTitle: string;
  status: string;
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
  createdBy: string;
  runOwnerId: string;
  createdAt: string;
  updatedAt: string;
  items: RunItem[];
  summary: RunSummary;
};

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  error?: { message?: string };
};

type FormState = {
  companyId: string;
  projectId: string;
  planId: string;
  title: string;
  environment: string;
  buildVersion: string;
  casesText: string;
};

const STATUS_OPTIONS = ["", "draft", "scheduled", "in_progress", "paused", "completed", "cancelled", "aborted"];

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  in_progress: "Em execução",
  paused: "Pausada",
  completed: "Finalizada",
  cancelled: "Cancelada",
  aborted: "Abortada",
};

const DEFAULT_CASES = `CID-001 | Validar login com sucesso | Login | high | 5
CID-002 | Consultar protocolo | Consulta | critical | 8`;

function statusTone(status: string) {
  if (status === "completed") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "cancelled" || status === "aborted") return "border-red-300 bg-red-50 text-red-800";
  if (status === "paused") return "border-amber-300 bg-amber-50 text-amber-800";
  if (status === "in_progress") return "border-sky-300 bg-sky-50 text-sky-800";
  return "border-slate-300 bg-slate-50 text-slate-700";
}

function StatusPill({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${statusTone(status)}`}>{STATUS_LABEL[status] ?? status}</span>;
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-[0_18px_38px_rgba(0,0,0,0.18)]">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/55">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs font-semibold text-white/55">{hint}</p> : null}
    </div>
  );
}

function parseCases(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [key, title, suitePath, priority, estimatedMinutes] = line.split("|").map((part) => part.trim());
      return {
        caseId: key || `case-${index + 1}`,
        caseKey: key || `CASE-${String(index + 1).padStart(3, "0")}`,
        caseTitle: title || `Caso ${index + 1}`,
        caseVersion: 1,
        suitePath: suitePath || "Geral",
        priority: priority || "medium",
        isRequired: true,
        estimatedMinutes: Number(estimatedMinutes || 5) || 5,
        expectedResultSnapshot: "Resultado esperado registrado no snapshot do plano.",
      };
    });
}

export default function RunsListClient() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState<FormState>({
    companyId: "testing-company",
    projectId: "cidadao-smart",
    planId: "plan-regressao-001",
    title: "Run Regressão Cidadão Smart",
    environment: "homologacao",
    buildVersion: "2.3.0",
    casesText: DEFAULT_CASES,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (projectId.trim()) params.set("projectId", projectId.trim());
      if (planId.trim()) params.set("planId", planId.trim());
      if (status.trim()) params.set("status", status.trim());
      params.set("limit", "100");
      const query = params.toString() ? `?${params.toString()}` : "";
      const response = await fetchApi(`/api/quality/runs${query}`);
      const json = (await response.json()) as ApiEnvelope<{ items: RunRecord[]; total: number }>;
      if (!response.ok || json.success === false) {
        throw new Error(json.message || json.error?.message || "Falha ao carregar runs");
      }
      setRuns(Array.isArray(json.data?.items) ? json.data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, planId, status]);

  const totals = useMemo(() => {
    return runs.reduce(
      (acc, run) => {
        acc.items += run.summary.totalItems || 0;
        acc.open += run.status === "completed" || run.status === "cancelled" || run.status === "aborted" ? 0 : 1;
        acc.failed += run.summary.failedCount || 0;
        acc.blocked += run.summary.blockedCount || 0;
        return acc;
      },
      { items: 0, open: 0, failed: 0, blocked: 0 },
    );
  }, [runs]);

  const createRun = async () => {
    const cases = parseCases(form.casesText);
    if (!form.companyId.trim() || !form.projectId.trim() || !form.planId.trim() || !form.title.trim() || cases.length === 0) {
      setError("Preencha empresa, projeto, plano, título e ao menos um caso.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const response = await fetchApi("/api/quality/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: form.companyId.trim(),
          projectId: form.projectId.trim(),
          planId: form.planId.trim(),
          title: form.title.trim(),
          environment: form.environment.trim() || null,
          buildVersion: form.buildVersion.trim() || null,
          actorId: "ui-runs-list",
          cases,
        }),
      });
      const json = (await response.json()) as ApiEnvelope<{ run: RunRecord }>;
      if (!response.ok || json.success === false || !json.data?.run) {
        throw new Error(json.message || json.error?.message || "Falha ao criar run");
      }
      setShowCreate(false);
      setProjectId(form.projectId.trim());
      setPlanId(form.planId.trim());
      setStatus("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-[#0f1626]/90 p-6 shadow-[0_22px_48px_rgba(0,0,0,0.28)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-orange-300"><FiPlayCircle /> Runs</p>
              <h1 className="mt-2 text-3xl font-black text-white">Execuções de teste</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-white/62">Listagem operacional de Runs locais, criadas a partir de plano, com progresso, falhas, bloqueios e link direto para execução por item.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowCreate((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-orange-100">
                <FiPlus /> Nova Run
              </button>
              <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15 disabled:opacity-50">
                <FiRefreshCcw /> {loading ? "Atualizando" : "Recarregar"}
              </button>
            </div>
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">{error}</div> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Runs" value={runs.length} hint={`${totals.open} abertas`} />
          <StatCard label="Itens" value={totals.items} hint="escopo total" />
          <StatCard label="Falhas" value={totals.failed} hint="em runs filtradas" />
          <StatCard label="Bloqueios" value={totals.blocked} hint="em runs filtradas" />
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/10 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_220px_auto] md:items-end">
            <label className="space-y-1 text-xs font-black uppercase tracking-[0.14em] text-white/55">
              Projeto
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-3 top-3.5 text-white/35" />
                <input value={projectId} onChange={(event) => setProjectId(event.target.value)} placeholder="cidadao-smart" className="w-full rounded-xl border border-white/10 bg-slate-950/40 py-3 pl-9 pr-3 text-sm font-semibold text-white outline-none placeholder:text-white/30" />
              </div>
            </label>
            <label className="space-y-1 text-xs font-black uppercase tracking-[0.14em] text-white/55">
              Plano
              <input value={planId} onChange={(event) => setPlanId(event.target.value)} placeholder="plan-regressao-001" className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/30" />
            </label>
            <label className="space-y-1 text-xs font-black uppercase tracking-[0.14em] text-white/55">
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm font-semibold text-white outline-none">
                {STATUS_OPTIONS.map((option) => <option key={option || "all"} value={option}>{option ? STATUS_LABEL[option] ?? option : "Todos"}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => { setProjectId(""); setPlanId(""); setStatus(""); }} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15">Limpar</button>
          </div>
        </section>

        {showCreate ? (
          <section className="rounded-3xl border border-orange-300/25 bg-orange-400/10 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Criar Run rápida</h2>
                <p className="mt-1 text-sm font-semibold text-white/60">Formato dos casos: chave | título | suite | prioridade | minutos</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-white/15 px-3 py-2 text-xs font-black text-white/70 hover:bg-white/10">Fechar</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input label="Empresa" value={form.companyId} onChange={(value) => setForm((current) => ({ ...current, companyId: value }))} />
              <Input label="Projeto" value={form.projectId} onChange={(value) => setForm((current) => ({ ...current, projectId: value }))} />
              <Input label="Plano" value={form.planId} onChange={(value) => setForm((current) => ({ ...current, planId: value }))} />
              <Input label="Título" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
              <Input label="Ambiente" value={form.environment} onChange={(value) => setForm((current) => ({ ...current, environment: value }))} />
              <Input label="Build" value={form.buildVersion} onChange={(value) => setForm((current) => ({ ...current, buildVersion: value }))} />
            </div>
            <label className="mt-3 block space-y-1 text-xs font-black uppercase tracking-[0.14em] text-white/55">
              Casos
              <textarea value={form.casesText} onChange={(event) => setForm((current) => ({ ...current, casesText: event.target.value }))} rows={5} className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/30" />
            </label>
            <button type="button" disabled={creating} onClick={createRun} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-orange-100 disabled:opacity-50">
              <FiPlus /> {creating ? "Criando..." : "Criar Run"}
            </button>
          </section>
        ) : null}

        {loading && !runs.length ? <EmptyState text="Carregando runs..." /> : null}
        {!loading && !runs.length ? <EmptyState text="Nenhuma run encontrada para os filtros atuais." /> : null}

        {runs.length ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {runs.map((run) => (
              <article key={run.id} className="rounded-3xl border border-white/10 bg-[#0f1626]/85 p-5 shadow-[0_18px_38px_rgba(0,0,0,0.22)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-300">{run.projectId}</p>
                    <h2 className="mt-1 text-xl font-black text-white">{run.title}</h2>
                    <p className="mt-1 text-xs font-semibold text-white/50">Plano {run.planId} • Snapshot {run.planSnapshotId}</p>
                  </div>
                  <StatusPill status={run.status} />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  <MiniStat label="Progresso" value={`${run.summary.progressPercent}%`} icon={<FiBarChart2 />} />
                  <MiniStat label="Pass" value={`${run.summary.passRate}%`} icon={<FiCheckCircle />} />
                  <MiniStat label="Falhas" value={run.summary.failedCount} icon={<FiClock />} />
                  <MiniStat label="Itens" value={run.summary.totalItems} icon={<FiPlayCircle />} />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-white/55">
                  <span>Ambiente: {run.environment || "N/D"}</span>
                  <span>Build: {run.buildVersion || "N/D"}</span>
                  <span>Qase: {run.qaseRunId || "N/D"}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/runs/${encodeURIComponent(run.id)}`} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-orange-100">
                    Abrir execução
                  </Link>
                  <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/55">{run.source}</span>
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 text-xs font-black uppercase tracking-[0.14em] text-white/55">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/30" />
    </label>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-white/45">{icon}{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-sm font-semibold text-white/60">{text}</div>;
}
