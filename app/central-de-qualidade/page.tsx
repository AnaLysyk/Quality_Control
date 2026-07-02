"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiBarChart2, FiBriefcase, FiDownload, FiRefreshCw, FiSearch, FiShield, FiTrendingUp } from "react-icons/fi";

import { fetchApi } from "@/lib/api";

type QualityRelease = {
  slug?: string | null;
  title?: string | null;
  project?: string | null;
  app?: string | null;
  qaseProject?: string | null;
};

type QualityProjectRow = {
  id: string;
  name: string;
  releaseCount: number;
  passRate: number | null;
  gateStatus: string;
  latestRelease?: {
    slug?: string | null;
    title?: string | null;
    createdAt?: string | null;
  } | null;
};

type QualityCompany = {
  id: string;
  name: string;
  slug?: string | null;
  passRate?: number | null;
  total?: number;
  stats?: {
    pass?: number;
    fail?: number;
    blocked?: number;
    notRun?: number;
  } | null;
  gate?: {
    status?: string;
    label?: string;
    reason?: string;
  } | null;
  releases?: QualityRelease[];
  latestRelease?: {
    slug?: string | null;
    title?: string | null;
    createdAt?: string | null;
  } | null;
};

type QualityOverview = {
  period: number;
  companies: QualityCompany[];
  projectRows?: QualityProjectRow[];
  releaseCount: number;
  releaseRiskCount: number;
  releaseWarningCount: number;
  riskCount: number;
  warningCount: number;
  globalPassRate: number | null;
  globalStats: {
    pass: number;
    fail: number;
    blocked: number;
    notRun: number;
  };
  coverage?: {
    total: number;
    withStats: number;
    percent: number;
  };
  trendSummary?: {
    direction?: string;
    label?: string;
    delta?: number;
  };
};

const GATE_FILTERS = [
  { value: "all", label: "Todos os gates" },
  { value: "approved", label: "Aprovado" },
  { value: "warning", label: "AtenÃ§Ã£o" },
  { value: "failed", label: "Bloqueado" },
  { value: "none", label: "Sem dados" },
];

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function percent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "Sem dados";
  return `${Math.round(value)}%`;
}

function scoreLabel(score: number | null) {
  if (score == null) return "Sem dados suficientes";
  if (score >= 90) return "SaudÃ¡vel";
  if (score >= 75) return "AtenÃ§Ã£o leve";
  if (score >= 60) return "AtenÃ§Ã£o";
  return "Risco alto";
}

function gateLabel(status?: string | null) {
  if (status === "approved") return "Aprovado";
  if (status === "warning") return "AtenÃ§Ã£o";
  if (status === "failed") return "Bloqueado";
  return "Sem dados";
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function companyGate(company: QualityCompany) {
  const status = company.gate?.status;
  if (status === "no_data") return "none";
  return status || "none";
}

function releaseLabel(company: QualityCompany) {
  const latest = company.latestRelease?.title || company.latestRelease?.slug;
  if (latest) return latest;
  const firstRelease = company.releases?.[0];
  return firstRelease?.title || firstRelease?.project || firstRelease?.app || firstRelease?.qaseProject || "Sem release vinculada";
}

function projectReleaseLabel(project: QualityProjectRow) {
  return project.latestRelease?.title || project.latestRelease?.slug || "Sem release vinculada";
}

function buildExecutiveNote(data: QualityOverview | null, visibleCompanies?: QualityCompany[]) {
  if (!data) return "Carregue os dados para gerar a leitura executiva.";
  const companies = visibleCompanies ?? data.companies;
  const score = data.globalPassRate;
  const scoreText = score == null ? "sem score consolidado" : `${Math.round(score)}% de sucesso`;
  const riskyCompanies = companies.filter((company) => companyGate(company) === "failed").length;
  const warningCompanies = companies.filter((company) => companyGate(company) === "warning").length;
  const riskyProjects = data.projectRows?.filter((project) => project.gateStatus === "failed").length ?? 0;
  const warningProjects = data.projectRows?.filter((project) => project.gateStatus === "warning").length ?? 0;
  const riskText = riskyCompanies || data.releaseRiskCount || riskyProjects
    ? `Existem ${riskyCompanies} empresa(s), ${riskyProjects} projeto(s) e ${data.releaseRiskCount} release(s) em risco.`
    : "NÃ£o hÃ¡ risco bloqueante consolidado no recorte atual.";
  const warningText = warningCompanies || data.releaseWarningCount || warningProjects
    ? `HÃ¡ ${warningCompanies} empresa(s), ${warningProjects} projeto(s) e ${data.releaseWarningCount} release(s) em atenÃ§Ã£o.`
    : "Os alertas do recorte atual estÃ£o controlados.";

  return `No perÃ­odo de ${data.period} dias, a Central de Qualidade estÃ¡ com ${scoreText}. ${riskText} ${warningText} Recomenda-se priorizar projetos com gate bloqueado, revisar falhas recorrentes e atualizar as runs sem cobertura estatÃ­stica.`;
}

function downloadExecutiveNote(data: QualityOverview | null, companies: QualityCompany[]) {
  const note = buildExecutiveNote(data, companies);
  const blob = new Blob([note], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "nota-executiva-central-qualidade.txt";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function CentralDeQualidadePage() {
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState<QualityOverview | null>(null);
  const [availableCompanies, setAvailableCompanies] = useState<QualityCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [gateFilter, setGateFilter] = useState("all");

  const overviewQuery = useMemo(() => {
    const params = new URLSearchParams({ period: String(period) });
    if (companyFilter !== "all") params.set("company", companyFilter);
    if (gateFilter !== "all") params.set("gate", gateFilter);
    const trimmedQuery = query.trim();
    if (trimmedQuery) params.set("q", trimmedQuery);
    return params.toString();
  }, [companyFilter, gateFilter, period, query]);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchApi(`/api/admin/quality/overview?${overviewQuery}`, { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        const root = payload?.data ?? payload;
        if (!response.ok || !root) {
          throw new Error(payload?.message || payload?.error || "NÃ£o foi possÃ­vel carregar a Central de Qualidade.");
        }
        if (!cancelled) {
          const overview = root as QualityOverview;
          setData(overview);
          setAvailableCompanies((current) => {
            const isUnfiltered = companyFilter === "all" && gateFilter === "all" && !query.trim();
            if (isUnfiltered || current.length === 0) return overview.companies;
            return current;
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Erro ao carregar a Central de Qualidade.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, [companyFilter, gateFilter, overviewQuery, query, refreshNonce]);

  const companyOptions = useMemo(() => {
    return [...availableCompanies].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [availableCompanies]);

  const orderedCompanies = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return [...(data?.companies ?? [])]
      .filter((company) => {
        if (companyFilter !== "all" && company.id !== companyFilter && company.slug !== companyFilter) return false;
        if (gateFilter !== "all" && companyGate(company) !== gateFilter) return false;
        if (!normalizedQuery) return true;
        return normalizeText(`${company.name} ${company.slug ?? ""} ${gateLabel(company.gate?.status)} ${releaseLabel(company)}`).includes(normalizedQuery);
      })
      .sort((a, b) => {
        const aScore = a.passRate ?? -1;
        const bScore = b.passRate ?? -1;
        return aScore - bScore;
      });
  }, [companyFilter, data?.companies, gateFilter, query]);

  const priorityProjects = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return [...(data?.projectRows ?? [])].filter((project) => {
      if (gateFilter !== "all" && gateFilter !== "none" && project.gateStatus !== gateFilter) return false;
      if (gateFilter === "none" && project.gateStatus !== "no_data") return false;
      if (!normalizedQuery) return true;
      return normalizeText(`${project.name} ${gateLabel(project.gateStatus)} ${projectReleaseLabel(project)}`).includes(normalizedQuery);
    });
  }, [data?.projectRows, gateFilter, query]);

  const totalTests = data ? Object.values(data.globalStats).reduce((sum, value) => sum + asNumber(value), 0) : 0;
  const filteredFailures = orderedCompanies.reduce((sum, company) => sum + asNumber(company.stats?.fail), 0);
  const filteredBlocked = orderedCompanies.reduce((sum, company) => sum + asNumber(company.stats?.blocked), 0);
  const executiveNote = buildExecutiveNote(data, orderedCompanies);

  return (
    <main className="min-h-screen bg-(--page-bg,#f5f7fb) px-4 py-6 text-(--page-text,#0b1a3c) sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">
                <FiShield className="h-4 w-4" /> Central de Qualidade
              </span>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--tc-text,#0b1a3c)]">Qualidade por empresa, projeto e visÃ£o executiva</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">
                Consolida runs, releases, gates, score e riscos para apoiar decisÃ£o de QA, lideranÃ§a e suporte tÃ©cnico.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[7, 30, 90].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={`inline-flex min-h-10 items-center rounded-xl border px-4 py-2 text-sm font-bold ${period === value ? "border-[var(--tc-primary,#011848)] bg-[var(--tc-primary,#011848)] text-white" : "border-[var(--tc-border,#d7deea)] bg-white text-[var(--tc-text,#0b1a3c)]"}`}
                >
                  {value} dias
                </button>
              ))}
              <button
                type="button"
                onClick={() => setRefreshNonce((value) => value + 1)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-4 py-2 text-sm font-bold text-[var(--tc-text,#0b1a3c)]"
              >
                <FiRefreshCw className="h-4 w-4" /> Atualizar
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <label className="grid flex-1 gap-2 text-sm font-bold text-[var(--tc-text,#0b1a3c)]">
              Buscar empresa, projeto ou gate
              <span className="flex min-h-11 items-center gap-2 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3">
                <FiSearch className="h-4 w-4 text-[var(--tc-text-muted,#6b7280)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ex.: cliente crÃ­tico, homologaÃ§Ã£o, bloqueado..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--tc-text-muted,#6b7280)]"
                />
              </span>
            </label>
            <label className="grid min-w-[220px] gap-2 text-sm font-bold text-[var(--tc-text,#0b1a3c)]">
              Empresa
              <select
                value={companyFilter}
                onChange={(event) => setCompanyFilter(event.target.value)}
                className="min-h-11 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white px-3 text-sm font-semibold outline-none"
              >
                <option value="all">Todas as empresas</option>
                {companyOptions.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </label>
            <label className="grid min-w-[200px] gap-2 text-sm font-bold text-[var(--tc-text,#0b1a3c)]">
              Gate / status
              <select
                value={gateFilter}
                onChange={(event) => setGateFilter(event.target.value)}
                className="min-h-11 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white px-3 text-sm font-semibold outline-none"
              >
                {GATE_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[var(--tc-text-muted,#6b7280)]">
            <span className="rounded-full border border-[var(--tc-border,#d7deea)] px-3 py-1">{orderedCompanies.length}/{data?.companies.length ?? 0} empresa(s) no recorte</span>
            <span className="rounded-full border border-[var(--tc-border,#d7deea)] px-3 py-1">{priorityProjects.length}/{data?.projectRows?.length ?? 0} projeto(s) no recorte</span>
            <span className="rounded-full border border-[var(--tc-border,#d7deea)] px-3 py-1">{filteredFailures} falha(s)</span>
            <span className="rounded-full border border-[var(--tc-border,#d7deea)] px-3 py-1">{filteredBlocked} bloqueado(s)</span>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Score consolidado", value: percent(data?.globalPassRate), icon: FiTrendingUp, note: scoreLabel(data?.globalPassRate ?? null) },
            { label: "Runs/Releases", value: loading ? "..." : String(data?.releaseCount ?? 0), icon: FiBarChart2, note: `${totalTests} testes consolidados` },
            { label: "Projetos priorizados", value: loading ? "..." : String(priorityProjects.length), icon: FiAlertTriangle, note: `${priorityProjects.filter((project) => project.gateStatus === "failed").length} projeto(s) bloqueado(s)` },
            { label: "Cobertura", value: loading ? "..." : percent(data?.coverage?.percent), icon: FiBriefcase, note: `${data?.coverage?.withStats ?? 0}/${data?.coverage?.total ?? 0} com estatÃ­stica` },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className="rounded-[24px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">{card.label}</p>
                  <Icon className="h-5 w-5 text-[var(--tc-accent,#ef0001)]" />
                </div>
                <p className="mt-3 text-3xl font-black text-[var(--tc-text,#0b1a3c)]">{card.value}</p>
                <p className="mt-1 text-sm text-[var(--tc-text-secondary,#4b5563)]">{card.note}</p>
              </article>
            );
          })}
        </section>

        <section className="rounded-[24px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-[var(--tc-text,#0b1a3c)]">Projetos prioritÃ¡rios</h2>
            <span className="rounded-full border border-[var(--tc-border,#d7deea)] px-3 py-1 text-xs font-bold text-[var(--tc-text-muted,#6b7280)]">{priorityProjects.length} projeto(s)</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              <div className="rounded-2xl border border-[var(--tc-border,#d7deea)] px-4 py-5 text-sm font-semibold text-[var(--tc-text-muted,#6b7280)]">Carregando projetos...</div>
            ) : priorityProjects.length ? priorityProjects.map((project) => (
              <article key={project.id} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-[var(--tc-text,#0b1a3c)]">{project.name}</h3>
                    <p className="mt-1 text-xs text-[var(--tc-text-muted,#6b7280)]">{projectReleaseLabel(project)}</p>
                  </div>
                  <span className="rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-2 py-1 text-xs font-bold text-[var(--tc-text,#0b1a3c)]">{gateLabel(project.gateStatus)}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--tc-text-muted,#6b7280)]">Score</p>
                    <p className="mt-1 font-black text-[var(--tc-text,#0b1a3c)]">{percent(project.passRate)}</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--tc-text-muted,#6b7280)]">Releases</p>
                    <p className="mt-1 font-black text-[var(--tc-text,#0b1a3c)]">{project.releaseCount}</p>
                  </div>
                </div>
              </article>
            )) : (
              <div className="rounded-2xl border border-[var(--tc-border,#d7deea)] px-4 py-5 text-sm font-semibold text-[var(--tc-text-muted,#6b7280)]">Nenhum projeto encontrado para o recorte aplicado.</div>
            )}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <article className="rounded-[24px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-[var(--tc-text,#0b1a3c)]">Empresas priorizadas por risco</h2>
              <span className="rounded-full border border-[var(--tc-border,#d7deea)] px-3 py-1 text-xs font-bold text-[var(--tc-text-muted,#6b7280)]">{orderedCompanies.length} empresa(s)</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--tc-border,#d7deea)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--tc-surface-2,#f8fafc)] text-[11px] uppercase tracking-[0.16em] text-[var(--tc-text-muted,#6b7280)]">
                  <tr>
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Projeto/release</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Gate</th>
                    <th className="px-4 py-3">Falhas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--tc-border,#d7deea)">
                  {loading ? (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-[var(--tc-text-muted,#6b7280)]">Carregando dados...</td></tr>
                  ) : orderedCompanies.length ? orderedCompanies.map((company) => (
                    <tr key={company.id} className="bg-white">
                      <td className="px-4 py-3 font-bold text-[var(--tc-text,#0b1a3c)]">{company.name}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[var(--tc-text,#0b1a3c)]">{releaseLabel(company)}</p>
                        <p className="text-xs text-[var(--tc-text-muted,#6b7280)]">{company.releases?.length ?? 0} release(s) no perÃ­odo</p>
                      </td>
                      <td className="px-4 py-3">{percent(company.passRate)}</td>
                      <td className="px-4 py-3">{gateLabel(company.gate?.status)}</td>
                      <td className="px-4 py-3">{company.stats?.fail ?? 0}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-[var(--tc-text-muted,#6b7280)]">Nenhum dado encontrado para o recorte aplicado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <aside className="rounded-[24px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-[var(--tc-text,#0b1a3c)]">Nota executiva</h2>
              <button
                type="button"
                onClick={() => downloadExecutiveNote(data, orderedCompanies)}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--tc-border,#d7deea)] px-3 text-xs font-bold text-[var(--tc-text,#0b1a3c)]"
              >
                <FiDownload className="h-4 w-4" /> TXT
              </button>
            </div>
            <p className="mt-3 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-4 py-3 text-sm leading-7 text-[var(--tc-text-secondary,#4b5563)]">{executiveNote}</p>
            <div className="mt-4 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white px-4 py-3 text-sm text-[var(--tc-text-secondary,#4b5563)]">
              <p className="font-bold text-[var(--tc-text,#0b1a3c)]">Quality Gates</p>
              <p className="mt-1">Aprovado, AtenÃ§Ã£o, Bloqueado ou Sem dados. A leitura usa os gates jÃ¡ calculados no overview administrativo e respeita os filtros combinados da pÃ¡gina.</p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

