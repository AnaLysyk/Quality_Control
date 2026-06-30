"use client";

import { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiBarChart2, FiBriefcase, FiDownload, FiRefreshCw, FiShield, FiTrendingUp } from "react-icons/fi";

import { fetchApi } from "@/lib/api";

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
  releases?: unknown[];
};

type QualityOverview = {
  period: number;
  companies: QualityCompany[];
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

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function percent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "Sem dados";
  return `${Math.round(value)}%`;
}

function scoreLabel(score: number | null) {
  if (score == null) return "Sem dados suficientes";
  if (score >= 90) return "Saudável";
  if (score >= 75) return "Atenção leve";
  if (score >= 60) return "Atenção";
  return "Risco alto";
}

function gateLabel(status?: string | null) {
  if (status === "approved") return "Aprovado";
  if (status === "warning") return "Atenção";
  if (status === "failed") return "Bloqueado";
  return "Sem dados";
}

function buildExecutiveNote(data: QualityOverview | null) {
  if (!data) return "Carregue os dados para gerar a leitura executiva.";
  const score = data.globalPassRate;
  const scoreText = score == null ? "sem score consolidado" : `${Math.round(score)}% de sucesso`;
  const riskText = data.riskCount || data.releaseRiskCount
    ? `Existem ${data.riskCount} empresa(s) e ${data.releaseRiskCount} release(s) em risco.`
    : "Não há risco bloqueante consolidado no período.";
  const warningText = data.warningCount || data.releaseWarningCount
    ? `Há ${data.warningCount} empresa(s) e ${data.releaseWarningCount} release(s) em atenção.`
    : "Os alertas do período estão controlados.";

  return `No período de ${data.period} dias, a Central de Qualidade está com ${scoreText}. ${riskText} ${warningText} Recomenda-se priorizar projetos com gate bloqueado, revisar falhas recorrentes e atualizar as runs sem cobertura estatística.`;
}

function downloadExecutiveNote(data: QualityOverview | null) {
  const note = buildExecutiveNote(data);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchApi(`/api/admin/quality/overview?period=${period}`, { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        const root = payload?.data ?? payload;
        if (!response.ok || !root) {
          throw new Error(payload?.message || payload?.error || "Não foi possível carregar a Central de Qualidade.");
        }
        if (!cancelled) setData(root as QualityOverview);
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
  }, [period, refreshNonce]);

  const orderedCompanies = useMemo(() => {
    return [...(data?.companies ?? [])].sort((a, b) => {
      const aScore = a.passRate ?? -1;
      const bScore = b.passRate ?? -1;
      return aScore - bScore;
    });
  }, [data?.companies]);

  const totalTests = data ? Object.values(data.globalStats).reduce((sum, value) => sum + asNumber(value), 0) : 0;
  const executiveNote = buildExecutiveNote(data);

  return (
    <main className="min-h-screen bg-(--page-bg,#f5f7fb) px-4 py-6 text-(--page-text,#0b1a3c) sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                <FiShield className="h-4 w-4" /> Central de Qualidade
              </span>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-(--tc-text,#0b1a3c)">Qualidade por empresa, projeto e visão executiva</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                Consolida runs, releases, gates, score e riscos para apoiar decisão de QA, liderança e suporte técnico.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[7, 30, 90].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={`inline-flex min-h-10 items-center rounded-xl border px-4 py-2 text-sm font-bold ${period === value ? "border-(--tc-primary,#011848) bg-(--tc-primary,#011848) text-white" : "border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"}`}
                >
                  {value} dias
                </button>
              ))}
              <button
                type="button"
                onClick={() => setRefreshNonce((value) => value + 1)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-bold text-(--tc-text,#0b1a3c)"
              >
                <FiRefreshCw className="h-4 w-4" /> Atualizar
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Score consolidado", value: percent(data?.globalPassRate), icon: FiTrendingUp, note: scoreLabel(data?.globalPassRate ?? null) },
            { label: "Runs/Releases", value: loading ? "..." : String(data?.releaseCount ?? 0), icon: FiBarChart2, note: `${totalTests} testes consolidados` },
            { label: "Empresas em risco", value: loading ? "..." : String(data?.riskCount ?? 0), icon: FiAlertTriangle, note: `${data?.warningCount ?? 0} em atenção` },
            { label: "Cobertura", value: loading ? "..." : percent(data?.coverage?.percent), icon: FiBriefcase, note: `${data?.coverage?.withStats ?? 0}/${data?.coverage?.total ?? 0} com estatística` },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className="rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">{card.label}</p>
                  <Icon className="h-5 w-5 text-(--tc-accent,#ef0001)" />
                </div>
                <p className="mt-3 text-3xl font-black text-(--tc-text,#0b1a3c)">{card.value}</p>
                <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">{card.note}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <article className="rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-(--tc-text,#0b1a3c)">Projetos/empresas priorizados por risco</h2>
              <span className="rounded-full border border-(--tc-border,#d7deea) px-3 py-1 text-xs font-bold text-(--tc-text-muted,#6b7280)">{orderedCompanies.length} empresa(s)</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-(--tc-border,#d7deea)">
              <table className="w-full text-left text-sm">
                <thead className="bg-(--tc-surface-2,#f8fafc) text-[11px] uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">
                  <tr>
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Gate</th>
                    <th className="px-4 py-3">Falhas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--tc-border,#d7deea)">
                  {loading ? (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-(--tc-text-muted,#6b7280)">Carregando dados...</td></tr>
                  ) : orderedCompanies.length ? orderedCompanies.map((company) => (
                    <tr key={company.id} className="bg-white">
                      <td className="px-4 py-3 font-bold text-(--tc-text,#0b1a3c)">{company.name}</td>
                      <td className="px-4 py-3">{percent(company.passRate)}</td>
                      <td className="px-4 py-3">{gateLabel(company.gate?.status)}</td>
                      <td className="px-4 py-3">{company.stats?.fail ?? 0}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-(--tc-text-muted,#6b7280)">Nenhum dado encontrado para o período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <aside className="rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-(--tc-text,#0b1a3c)">Nota executiva</h2>
              <button
                type="button"
                onClick={() => downloadExecutiveNote(data)}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) px-3 text-xs font-bold text-(--tc-text,#0b1a3c)"
              >
                <FiDownload className="h-4 w-4" /> TXT
              </button>
            </div>
            <p className="mt-3 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3 text-sm leading-7 text-(--tc-text-secondary,#4b5563)">{executiveNote}</p>
            <div className="mt-4 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-secondary,#4b5563)">
              <p className="font-bold text-(--tc-text,#0b1a3c)">Quality Gates</p>
              <p className="mt-1">Aprovado, Atenção, Bloqueado ou Sem dados. A leitura usa os gates já calculados no overview administrativo.</p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
