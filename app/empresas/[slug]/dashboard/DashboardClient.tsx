"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CreateManualReleaseButton } from "@/components/CreateManualReleaseButton";

type ManualRun = {
  slug: string;
  name: string;
  status?: string | null;
  createdAt?: string | null;
  stats: { pass: number; fail: number; blocked: number; notRun: number };
  gateStatus: "approved" | "warning" | "failed" | "no_data";
  passRate: number | null;
  total: number;
};

type Summary = {
  qualityScore: number;
  totalDefects: number;
  openDefects: number;
  closedDefects: number;
  mttrAvg: number | null;
  slaOverdue: number;
};

type GoalStatus = {
  goal: string;
  status: string;
  value?: number;
  target?: number;
  evaluated_at?: string;
};

type QualityAlert = {
  type: string;
  severity: string;
  message: string;
  timestamp: string;
};

type DashboardClientProps = {
  companySlug: string;
  runs: ManualRun[];
  summary: Summary;
  goals: GoalStatus[];
  alerts: QualityAlert[];
  trendDirection: "up" | "down" | "flat";
  healthStatus: "healthy" | "attention" | "critical";
};

const GATE_LABEL: Record<ManualRun["gateStatus"], string> = {
  approved: "Ok",
  warning: "Atencao",
  failed: "Risco",
  no_data: "Sem dados",
};

function formatHours(value: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value}h`;
}

function parseStatusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "violated") return "Violada";
  if (normalized === "at_risk" || normalized === "risk") return "Em risco";
  if (normalized === "met") return "Atendida";
  return status;
}

function computeGateStatus(stats: ManualRun["stats"]) {
  const total = stats.pass + stats.fail + stats.blocked + stats.notRun;
  if (total < 1) return "no_data" as const;
  const passRate = Math.round((stats.pass / total) * 100);
  const failRate = Math.round((stats.fail / total) * 100);
  const blockedRate = Math.round((stats.blocked / total) * 100);
  const notRunRate = Math.round((stats.notRun / total) * 100);
  if (failRate > 5 || blockedRate > 3) return "failed" as const;
  if (passRate < 92 || notRunRate > 12) return "warning" as const;
  return "approved" as const;
}

export default function DashboardClient({
  companySlug,
  runs,
  summary,
  goals,
  alerts,
  trendDirection,
  healthStatus,
}: DashboardClientProps) {
  const [localRuns, setLocalRuns] = useState<ManualRun[]>(runs);

  useEffect(() => {
    setLocalRuns(runs);
  }, [runs]);

  const gateCounts = useMemo(() => {
    const counts: Record<string, number> = { approved: 0, warning: 0, failed: 0, no_data: 0 };
    localRuns.forEach((run) => {
      counts[run.gateStatus] = (counts[run.gateStatus] ?? 0) + 1;
    });
    return counts;
  }, [localRuns]);

  const riskHighlightSlug = useMemo(
    () => localRuns.find((run) => run.gateStatus === "failed")?.slug ?? null,
    [localRuns],
  );

  const mttrDisplay = formatHours(summary.mttrAvg);
  const healthTestId =
    healthStatus === "healthy"
      ? "health-score-healthy"
      : healthStatus === "attention"
        ? "health-score-attention"
        : "health-score-critical";

  return (
    <div className="min-h-screen bg-(--page-bg,#f5f6fa) text-(--page-text,#0b1a3c) px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-(--tc-accent,#ef0001)">Dashboard</p>
            <h1 className="mt-2 text-3xl font-extrabold">Qualidade da empresa</h1>
            <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
              Visao geral de risco, SLA e execucoes recentes.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <a
              data-testid="export-quality"
              href={`/api/empresas/${encodeURIComponent(companySlug)}/quality/export`}
              className="rounded-full border border-(--tc-border,#e5e7eb) bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text,#0b1a3c)"
            >
              Exportar CSV
            </a>
              <CreateManualReleaseButton
              companySlug={companySlug}
              redirectToRun={false}
              onCreated={(created) => {
                if (!created?.slug) return;
                const slugVal = created.slug as string;
                const stats = (created as { stats?: ManualRun["stats"] }).stats ?? {
                  pass: 0,
                  fail: 0,
                  blocked: 0,
                  notRun: 0,
                };
                const total = stats.pass + stats.fail + stats.blocked + stats.notRun;
                const passRate = total > 0 ? Math.round((stats.pass / total) * 100) : null;
                const gateStatus = computeGateStatus(stats);
                const nameVal = (created as { name?: string; title?: string }).name ?? (created as { title?: string }).title ?? slugVal;
                setLocalRuns((prev) => [
                  {
                    slug: slugVal,
                    name: nameVal,
                    createdAt: new Date().toISOString(),
                    stats,
                    total,
                    passRate,
                    gateStatus,
                  },
                  ...prev,
                ]);
              }}
            />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted)">Quality Score</p>
            <div className="mt-2 text-4xl font-extrabold text-(--tc-accent,#ef0001)" data-testid="quality-score">
              {summary.qualityScore}
            </div>
            <div
              data-testid={healthTestId}
              className="mt-2 inline-flex rounded-full border border-(--tc-border,#e5e7eb) px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
            >
              {healthStatus === "healthy" ? "Saudavel" : healthStatus === "attention" ? "Atencao" : "Critico"}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm" data-testid="mttr-card">
            <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted)">MTTR medio</p>
            <div className="mt-2 text-3xl font-extrabold" data-testid="mttr">
              {mttrDisplay}
            </div>
            <div className="text-xs text-(--tc-text-muted)" data-testid="metric-mttr">
              {mttrDisplay}
            </div>
            <div className="mt-1 text-xs text-(--tc-text-muted)" data-testid="mttr-trend">
              Tendencia: {trendDirection === "up" ? "melhora" : trendDirection === "down" ? "piora" : "estavel"}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm" data-testid="sla-card">
            <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted)">SLA</p>
            <div className="mt-2 text-3xl font-extrabold">{summary.slaOverdue}</div>
            <p className="text-xs text-(--tc-text-muted)">Defeitos fora do SLA</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted)">Defeitos</p>
            <div className="mt-2 text-3xl font-extrabold">{summary.openDefects}</div>
            <div className="text-xs text-(--tc-text-muted)" data-testid="metric-defects-closed">
              Fechados: {summary.closedDefects}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm" data-testid="runs-quality-table">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Qualidade por run</h2>
              <div
                data-testid={trendDirection === "up" ? "quality-trend-improving" : "quality-trend-stable"}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)"
              >
                {trendDirection === "up" ? "Melhorando" : trendDirection === "down" ? "Piorando" : "Estavel"}
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-(--tc-text-muted)">
                    <th className="text-left py-2">Run</th>
                    <th className="text-left py-2">Pass rate</th>
                    <th className="text-left py-2">Gate</th>
                  </tr>
                </thead>
                <tbody>
                  {localRuns.slice(0, 8).map((run, idx) => (
                    <tr key={`${run.slug ?? 'run'}-${run.createdAt ?? idx}`} className="border-t border-(--tc-border,#e5e7eb)">
                      <td className="py-2">
                        <Link
                          data-testid="run-drilldown-link"
                          href={`/empresas/${encodeURIComponent(companySlug)}/defeitos?run=${encodeURIComponent(run.slug)}`}
                          className="font-semibold text-(--tc-accent,#ef0001)"
                        >
                          {run.name}
                        </Link>
                      </td>
                      <td className="py-2">{run.passRate ?? "—"}%</td>
                      <td className="py-2">{GATE_LABEL[run.gateStatus]}</td>
                    </tr>
                  ))}
                  {localRuns.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-sm text-(--tc-text-muted)">
                        Nenhuma run registrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm" data-testid="releases-status">
            <h2 className="text-lg font-semibold">Status das releases</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Aprovadas</span>
                <strong>{gateCounts.approved}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Em atencao</span>
                <strong>{gateCounts.warning}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Em risco</span>
                <strong>{gateCounts.failed}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm" data-testid="alerts">
          <h2 className="text-lg font-semibold">Alertas recentes</h2>
          <div className="mt-4 grid gap-3">
            {alerts.length === 0 && <p className="text-sm text-(--tc-text-muted)">Nenhum alerta recente.</p>}
            {alerts.map((alert, index) => (
              <div key={`${alert.type}-${index}`} className="rounded-2xl border border-(--tc-border,#e5e7eb) px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <strong className="text-(--tc-text-primary,#0b1a3c)">{alert.message}</strong>
                  <span className="text-xs uppercase text-(--tc-text-muted)">{alert.severity}</span>
                </div>
                <p className="text-xs text-(--tc-text-muted)">{new Date(alert.timestamp).toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Releases em destaque</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {localRuns.slice(0, 4).map((run, idx) => {
                const isRisk = run.gateStatus === "failed";
                const isRiskHighlight = isRisk && run.slug === riskHighlightSlug;
                return (
                  <div
                    key={`${run.slug ?? 'run'}-${run.createdAt ?? idx}`}
                    data-testid="release-card"
                    className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) p-4"
                  >
                    <Link href={`/empresas/${encodeURIComponent(companySlug)}/runs/${encodeURIComponent(run.slug)}`} className="text-sm font-semibold text-(--tc-accent,#ef0001)">
                      {run.name}
                    </Link>
                    <div className="mt-2 text-xs text-(--tc-text-muted)">
                      Gate: <span data-testid="release-status">{GATE_LABEL[run.gateStatus]}</span>
                    </div>
                    {isRisk && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-rose-600">
                        <span data-testid="release-risk">Risco</span>
                        <span {...(isRiskHighlight ? { "data-testid": "release-quality-risk" } : {})}>
                          MTTR alto ou falhas
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              {localRuns.length === 0 && (
                <p className="text-sm text-(--tc-text-muted)">Nenhuma release manual registrada.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Metas de qualidade</h2>
            <div className="mt-4 grid gap-3">
              {goals.length === 0 && <p className="text-sm text-(--tc-text-muted)">Sem metas registradas.</p>}
              {goals.map((goal, index) => (
                <div key={`${goal.goal}-${index}`} data-testid="quality-goal-item" className="rounded-2xl border border-(--tc-border,#e5e7eb) px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{goal.goal}</span>
                    <span data-testid="quality-goal-status" className="text-xs uppercase text-(--tc-text-muted)">
                      {parseStatusLabel(goal.status)}
                    </span>
                  </div>
                  <div className="text-xs text-(--tc-text-muted)">
                    {goal.value ?? "—"} / {goal.target ?? "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
