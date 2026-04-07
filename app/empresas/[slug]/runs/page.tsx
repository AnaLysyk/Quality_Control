"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CreateManualReleaseButton } from "@/components/CreateManualReleaseButton";
import { fetchApi } from "@/lib/api";
import { formatRunTitle } from "@/lib/runPresentation";

type RunStats = {
  pass: number;
  fail: number;
  blocked: number;
  notRun: number;
  total: number;
};

type RunStatsInput = Partial<RunStats> & {
  not_run?: number | null;
};

type ApplicationItem = {
  id: string;
  name: string;
  slug: string;
  qaseProjectCode?: string | null;
};

type IntegratedRun = {
  slug: string;
  title: string;
  summary: string | null;
  status: string | null;
  app: string | null;
  project: string | null;
  qaseProject: string | null;
  source: string | null;
  createdAt: string | null;
  clientId: string | null;
  clientName: string | null;
  manualSummary: RunStatsInput | null;
  metrics: RunStatsInput | null;
  responsibleLabel: string | null;
  responsibleName: string | null;
  responsibleEmail: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
};

type UnifiedRun = {
  key: string;
  slug: string;
  name: string;
  createdAt: string | null;
  statusLabel: string;
  sourceLabel: string;
  providerLabel: string | null;
  applicationLabel: string;
  projectCode: string | null;
  summary: string;
  responsibleLabel: string | null;
  passRate: number | null;
  stats: RunStats;
};

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeProjectCode(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
}

function toTimestamp(value: string | null) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function formatDate(value: string | null) {
  const time = toTimestamp(value);
  if (!time) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function resolveStatusLabel(value: string | null) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return "Sem status";
  if (["done", "closed", "finalized", "finalizada"].includes(normalized)) return "Concluida";
  if (["running", "in_progress", "em_andamento", "open", "active", "aberta"].includes(normalized)) return "Em andamento";
  if (["blocked", "bloqueada"].includes(normalized)) return "Bloqueada";
  if (["failed", "fail", "erro", "error", "falha", "violated"].includes(normalized)) return "Em risco";
  if (["draft", "saved", "pending", "pendente"].includes(normalized)) return "Pendente";
  return value ?? "Sem status";
}

function computeStats(input: RunStatsInput | null | undefined): RunStats {
  const pass = Math.max(0, Number(input?.pass ?? 0));
  const fail = Math.max(0, Number(input?.fail ?? 0));
  const blocked = Math.max(0, Number(input?.blocked ?? 0));
  const notRun = Math.max(0, Number(input?.notRun ?? input?.not_run ?? 0));
  return {
    pass,
    fail,
    blocked,
    notRun,
    total: pass + fail + blocked + notRun,
  };
}

function computePassRate(stats: RunStats) {
  return stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : null;
}

function resolveProvider(run: IntegratedRun) {
  const joined = [
    run.source,
    run.summary,
    run.title,
    run.app,
    run.project,
    run.qaseProject,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (joined.includes("jira")) return "Jira";
  if (run.qaseProject || joined.includes("qase")) return "Qase";
  return null;
}

function normalizeManualRuns(data: unknown[]): UnifiedRun[] {
  return data.reduce<UnifiedRun[]>((accumulator, item) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const slug = String(rec.slug ?? rec.id ?? "");
    if (!slug) return accumulator;

    const stats = computeStats((rec.stats ?? {}) as RunStatsInput);
    accumulator.push({
      key: `manual:${slug}`,
      slug,
      name: formatRunTitle(String(rec.name ?? rec.title ?? rec.slug ?? "Run manual"), "Run manual"),
      createdAt: typeof rec.createdAt === "string" ? rec.createdAt : null,
      statusLabel: resolveStatusLabel(typeof rec.status === "string" ? rec.status : null),
      sourceLabel: "Manual",
      providerLabel: null,
      applicationLabel: String(rec.app ?? rec.qaseProject ?? "Aplicacao manual"),
      projectCode: normalizeProjectCode(rec.qaseProject ?? rec.app),
      summary: `${stats.pass} aprovados, ${stats.fail} falhas, ${stats.blocked} bloqueados e ${stats.notRun} nao executados.`,
      responsibleLabel:
        typeof rec.responsibleLabel === "string" && rec.responsibleLabel.trim()
          ? rec.responsibleLabel.trim()
          : typeof rec.assignedToName === "string" && rec.assignedToName.trim()
            ? rec.assignedToName.trim()
            : typeof rec.createdByName === "string" && rec.createdByName.trim()
              ? rec.createdByName.trim()
              : null,
      passRate: computePassRate(stats),
      stats,
    });

    return accumulator;
  }, []);
}

function normalizeIntegratedRuns(data: unknown[]): IntegratedRun[] {
  return data.reduce<IntegratedRun[]>((accumulator, item) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const slug = String(rec.slug ?? rec.id ?? "");
    if (!slug) return accumulator;

    accumulator.push({
      slug,
      title: typeof rec.title === "string" ? rec.title : typeof rec.name === "string" ? rec.name : slug,
      summary: typeof rec.summary === "string" ? rec.summary : null,
      status: typeof rec.status === "string" ? rec.status : null,
      app: typeof rec.app === "string" ? rec.app : null,
      project: typeof rec.project === "string" ? rec.project : null,
      qaseProject: typeof rec.qaseProject === "string" ? rec.qaseProject : null,
      source: typeof rec.source === "string" ? rec.source : null,
      createdAt: typeof rec.createdAt === "string" ? rec.createdAt : null,
      clientId: typeof rec.clientId === "string" ? rec.clientId : null,
      clientName: typeof rec.clientName === "string" ? rec.clientName : null,
      manualSummary: typeof rec.manualSummary === "object" && rec.manualSummary ? (rec.manualSummary as RunStatsInput) : null,
      metrics: typeof rec.metrics === "object" && rec.metrics ? (rec.metrics as RunStatsInput) : null,
      responsibleLabel: typeof rec.responsibleLabel === "string" ? rec.responsibleLabel : null,
      responsibleName: typeof rec.responsibleName === "string" ? rec.responsibleName : null,
      responsibleEmail: typeof rec.responsibleEmail === "string" ? rec.responsibleEmail : null,
      createdByName: typeof rec.createdByName === "string" ? rec.createdByName : null,
      createdByEmail: typeof rec.createdByEmail === "string" ? rec.createdByEmail : null,
    });

    return accumulator;
  }, []);
}

function buildApplicationKeys(applications: ApplicationItem[]) {
  return new Set(
    applications
      .flatMap((application) => [application.slug, application.name, application.qaseProjectCode])
      .map((value) => normalizeKey(value))
      .filter(Boolean),
  );
}

function matchesCompanyRun(run: IntegratedRun, companySlug: string, applicationKeys: Set<string>) {
  const companyKey = normalizeKey(companySlug);
  if (normalizeKey(run.clientId) === companyKey || normalizeKey(run.clientName) === companyKey) {
    return true;
  }

  return [run.app, run.project, run.qaseProject]
    .map((value) => normalizeKey(value))
    .filter(Boolean)
    .some((value) => applicationKeys.has(value));
}

function toUnifiedIntegratedRuns(data: IntegratedRun[], companySlug: string, applicationKeys: Set<string>): UnifiedRun[] {
  return data
    .filter((run) => matchesCompanyRun(run, companySlug, applicationKeys))
    .map((run) => {
      const stats = computeStats(run.manualSummary ?? run.metrics);
      const providerLabel = resolveProvider(run);
      const applicationLabel =
        String(run.app ?? run.project ?? run.qaseProject ?? providerLabel ?? "Integracao").trim() || "Integracao";
      const responsibleLabel =
        run.responsibleLabel?.trim() ||
        run.responsibleName?.trim() ||
        run.createdByName?.trim() ||
        run.responsibleEmail?.trim() ||
        run.createdByEmail?.trim() ||
        null;

      return {
        key: `integrated:${run.slug}`,
        slug: run.slug,
        name: formatRunTitle(run.title, "Run integrada"),
        createdAt: run.createdAt,
        statusLabel: resolveStatusLabel(run.status),
        sourceLabel: "Integrada",
        providerLabel,
        applicationLabel,
        projectCode: normalizeProjectCode(run.qaseProject ?? run.project ?? run.app),
        summary:
          run.summary?.trim() ||
          (stats.total > 0
            ? `${stats.total} casos consolidados nesta sincronizacao.`
            : "Run integrada sincronizada sem telemetria detalhada no momento."),
        responsibleLabel,
        passRate: computePassRate(stats),
        stats,
      };
    });
}

export default function CompanyRunsPage() {
  const params = useParams();
  const slugParam = params?.slug;
  const companySlug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const [runs, setRuns] = useState<UnifiedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const currentCompanySlug = companySlug ?? "";
    if (!currentCompanySlug) return;

    let active = true;

    async function loadRuns() {
      setLoading(true);
      setError(null);
      try {
        const [manualResponse, integratedResponse, applicationsResponse] = await Promise.all([
          fetchApi(`/api/releases-manual?clientSlug=${encodeURIComponent(currentCompanySlug)}&kind=run`),
          // Use aggregated runs endpoint (all projects for company when available)
          fetchApi(
            `/api/v1/runs?all=true&limit=${encodeURIComponent(String(200))}&companySlug=${encodeURIComponent(currentCompanySlug)}`,
          ),
          fetchApi(`/api/applications?companySlug=${encodeURIComponent(currentCompanySlug)}`),
        ]);

        const manualData = await manualResponse.json().catch(() => []);
        const integratedData = await integratedResponse.json().catch(() => ({}));
        const applicationsData = await applicationsResponse.json().catch(() => ({}));

        // Normalize possible shapes from the runs endpoint:
        // - { data: [...] } (new /api/v1/runs)
        // - { releases: [...] } (legacy)
        // - { result: { entities: [...] } } (qase raw)
        const integratedEntities: unknown[] = Array.isArray(integratedData?.data)
          ? integratedData.data
          : Array.isArray(integratedData?.releases)
          ? integratedData.releases
          : Array.isArray(integratedData?.result?.entities)
          ? integratedData.result.entities
          : [];

        const applications = Array.isArray(applicationsData?.items)
          ? (applicationsData.items as ApplicationItem[])
          : [];
        const applicationKeys = buildApplicationKeys(applications);

        const manualRuns = normalizeManualRuns(Array.isArray(manualData) ? manualData : []);
        const integratedRuns = toUnifiedIntegratedRuns(
          normalizeIntegratedRuns(integratedEntities),
          currentCompanySlug,
          applicationKeys,
        );

        if (!active) return;
        setRuns(
          [...manualRuns, ...integratedRuns].sort(
            (left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt),
          ),
        );
      } catch {
        if (!active) return;
        setRuns([]);
        setError("Nao foi possivel carregar as runs da empresa.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadRuns();

    return () => {
      active = false;
    };
  }, [companySlug]);

  const filteredRuns = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return runs;

    return runs.filter((run) =>
      [run.name, run.slug, run.applicationLabel, run.projectCode, run.sourceLabel, run.providerLabel, run.responsibleLabel]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .some((value) => value.toLowerCase().includes(term)),
    );
  }, [runs, search]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRuns.length / pageSize)), [filteredRuns.length, pageSize]);

  useEffect(() => {
    // Reset to first page when filtering or page size changes
    setPage(1);
  }, [search, pageSize]);

  const pagedRuns = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRuns.slice(start, start + pageSize);
  }, [filteredRuns, page, pageSize]);

  const totals = useMemo(
    () => ({
      total: runs.length,
      manual: runs.filter((run) => run.sourceLabel === "Manual").length,
      integrated: runs.filter((run) => run.sourceLabel === "Integrada").length,
    }),
    [runs],
  );

  return (
    <div className="min-h-screen bg-(--page-bg,#f5f6fa) px-4 py-8 text-(--page-text,#0b1a3c) sm:px-6 lg:px-10" data-testid="runs-page">
      <div className="mx-auto w-full max-w-none space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-(--tc-accent,#ef0001)">Runs</p>
            <h1 className="mt-2 text-3xl font-extrabold">Execucoes da empresa {companySlug}</h1>
            <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
              Modulo unico com runs manuais e integradas, sem separar a leitura em duas telas.
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
              {totals.total} no total | {totals.manual} manual(is) | {totals.integrated} integrada(s)
            </p>
          </div>
          <CreateManualReleaseButton companySlug={companySlug} />
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Lista completa de runs</h2>
              <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">
                A selecao abaixo ja mistura execucoes locais e historico integrado por aplicacao/projeto.
              </p>
            </div>
            <input
              data-testid="runs-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, slug, app, projeto ou responsavel"
              className="w-full rounded-full border border-(--tc-border,#e5e7eb) px-4 py-2 text-sm outline-none focus:border-(--tc-accent,#ef0001) md:w-80"
            />
          </div>

          <div className="mt-5 flex items-center justify-between gap-3" data-testid="runs-controls">
            <div className="flex items-center gap-3">
              <label htmlFor="runs-page-size" className="text-sm text-(--tc-text-secondary,#4b5563)">Mostrar</label>
              <select
                id="runs-page-size"
                aria-label="Selecionar quantidade de itens por página"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) || 10)}
                className="rounded-full border border-(--tc-border,#e5e7eb) px-3 py-1 text-sm outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span className="text-sm text-(--tc-text-muted,#6b7280)">itens por página</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-full border px-3 py-1 text-sm disabled:opacity-50"
              >
                Anterior
              </button>
              <div className="text-sm text-(--tc-text-muted,#6b7280)">
                Página {page} / {totalPages}
              </div>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-full border px-3 py-1 text-sm disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3" data-testid="runs-list">
            {loading ? (
              <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando runs...</p>
            ) : filteredRuns.length === 0 ? (
              <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhuma run encontrada.</p>
            ) : (
              pagedRuns.map((run) => (
                <div
                  key={run.key}
                  className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={
                            companySlug
                              ? `/empresas/${encodeURIComponent(companySlug)}/runs/${encodeURIComponent(run.slug)}`
                              : `/release/${encodeURIComponent(run.slug)}`
                          }
                          className="text-base font-semibold text-(--tc-accent,#ef0001)"
                        >
                          {run.name}
                        </Link>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                          {run.sourceLabel}
                        </span>
                        {run.providerLabel ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                            {run.providerLabel}
                          </span>
                        ) : null}
                        {run.projectCode ? (
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                            {run.projectCode}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-sm font-medium text-(--tc-text-primary,#0b1a3c)">
                        {run.applicationLabel}
                      </div>
                      {run.responsibleLabel ? (
                        <div className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                          Responsavel: {run.responsibleLabel}
                        </div>
                      ) : null}
                      <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">{run.summary}</p>
                      <div className="mt-3 text-xs text-(--tc-text-muted,#6b7280)">
                        {formatDate(run.createdAt)} | Pass: {run.stats.pass} | Fail: {run.stats.fail} | Blocked: {run.stats.blocked} | Not run: {run.stats.notRun}
                      </div>
                    </div>

                    <div className="shrink-0 text-left md:text-right">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                        {run.statusLabel}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">
                        {run.passRate !== null ? `Pass rate ${run.passRate}%` : "Sem pass rate"}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
