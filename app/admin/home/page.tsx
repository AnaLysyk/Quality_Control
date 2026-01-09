"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowDownRight,
  FiArrowUpRight,
  FiCheckCircle,
  FiMinus,
  FiShield,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";
import { useI18n } from "@/hooks/useI18n";
import { type TranslateFn } from "@/lib/i18n";
import {
  CompanyRow,
  QUALITY_THRESHOLDS,
  QualityGateResult,
  QualityGateStatus,
  Stats,
  TrendPoint,
  TrendSummary,
  sumStats,
} from "@/lib/quality";

type QualityOverviewResponse = {
  companies: CompanyRow[];
  period: number;
  coverage: { total: number; withStats: number; percent: number };
  releaseCount: number;
  globalStats: Stats;
  globalPassRate: number | null;
  passRateTone: "good" | "warn" | "neutral";
  gateCounts: Record<QualityGateStatus, number>;
  riskCount: number;
  warningCount: number;
  trendPoints: TrendPoint[];
  trendSummary: TrendSummary;
  policy: typeof QUALITY_THRESHOLDS;
};

function KpiCard({
  icon: Icon,
  label,
  value,
  status,
  tone,
}: {
  icon: typeof FiUsers;
  label: string;
  value: number | string;
  status: string;
  tone: "good" | "warn" | "danger" | "neutral";
}) {
  const toneMap = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    neutral: "border-slate-200 bg-slate-100 text-slate-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.32em] text-slate-400">{label}</p>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${toneMap[tone]}`}>
          {status}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
          <Icon />
        </div>
        <div className="text-3xl font-extrabold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

function TrendChart({ points, emptyLabel }: { points: TrendPoint[]; emptyLabel?: string }) {
  const hasData = points.some((point) => point.value !== null);
  const safePoints = points.map((point) => point.value ?? 0);
  const emptyText = emptyLabel ?? "No data";
  const pointCoords = safePoints.map((value, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 100 - value;
    return `${x},${y}`;
  });

  const areaPath = `M ${pointCoords[0]} L ${pointCoords.slice(1).join(" ")} L 100 100 L 0 100 Z`;

  return (
    <div className="mt-4 space-y-4">
      <div className="relative h-44">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <defs>
            <linearGradient id="trendStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ef0001" />
              <stop offset="100%" stopColor="#ffb44a" />
            </linearGradient>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(239,0,1,0.25)" />
              <stop offset="100%" stopColor="rgba(239,0,1,0)" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#trendFill)" opacity={hasData ? 1 : 0.2} />
          <polyline
            fill="none"
            stroke="url(#trendStroke)"
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointCoords.join(" ")}
            opacity={hasData ? 1 : 0.35}
          />
          {points.map((point, index) => {
            const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
            const y = 100 - (point.value ?? 0);
            return (
              <circle key={point.label} cx={x} cy={y} r={2.8} fill="#0f172a">
                <title>{point.value !== null ? `${point.value}%` : emptyText}</title>
              </circle>
            );
          })}
        </svg>
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            {emptyText}
          </div>
        )}
      </div>
      <div className="flex justify-between text-[11px] text-slate-500">
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}

function StatusBreakdown({
  stats,
  labels,
}: {
  stats: Stats;
  labels: { pass: string; fail: string; blocked: string; notRun: string };
}) {
  const total = sumStats(stats);
  const segments = [
    { label: labels.pass, value: stats.pass, className: "bg-emerald-500" },
    { label: labels.fail, value: stats.fail, className: "bg-red-500" },
    { label: labels.blocked, value: stats.blocked, className: "bg-amber-400" },
    { label: labels.notRun, value: stats.notRun, className: "bg-slate-300" },
  ];

  return (
    <div className="mt-4 space-y-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {segments.map((segment) => {
          const width = total > 0 ? (segment.value / total) * 100 : 0;
          return <span key={segment.label} className={segment.className} style={{ width: `${width}%` }} />;
        })}
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <span>{segment.label}</span>
            <span className="font-semibold text-slate-900">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GateStack({ counts }: { counts: Record<QualityGateStatus, number> }) {
  const total = counts.approved + counts.warning + counts.failed + counts.no_data;
  const segments = [
    { key: "approved", className: "bg-emerald-500" },
    { key: "warning", className: "bg-amber-400" },
    { key: "failed", className: "bg-red-500" },
    { key: "no_data", className: "bg-slate-300" },
  ] as const;

  return (
    <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
      {segments.map((segment) => {
        const value = counts[segment.key];
        const width = total > 0 ? (value / total) * 100 : 0;
        return <span key={segment.key} className={segment.className} style={{ width: `${width}%` }} />;
      })}
    </div>
  );
}

function GateBadge({
  gate,
  compact = false,
  fallbackTitle = "",
  t,
}: {
  gate: QualityGateResult;
  compact?: boolean;
  fallbackTitle?: string;
  t: TranslateFn;
}) {
  const styles: Record<QualityGateStatus, string> = {
    approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    failed: "border-red-200 bg-red-50 text-red-700",
    no_data: "border-slate-200 bg-slate-100 text-slate-500",
  };

  const label = t(`gate.${gate.status}`);
  const reasonText = gate.reasons.length
    ? gate.reasons
        .map((reason) =>
          reason.value !== undefined
            ? t(`gate.${reason.key}`, { value: reason.value })
            : t(`gate.${reason.key}`)
        )
        .join(" | ")
    : fallbackTitle;

  return (
    <span
      title={reasonText || fallbackTitle}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${styles[gate.status]} ${
        compact ? "px-2 py-0.5 text-[10px]" : ""
      }`}
    >
      {label}
    </span>
  );
}

function TrendIndicator({ direction, delta }: { direction: "up" | "down" | "flat"; delta: number }) {
  const Icon = direction === "up" ? FiArrowUpRight : direction === "down" ? FiArrowDownRight : FiMinus;
  const color =
    direction === "up" ? "text-emerald-600" : direction === "down" ? "text-red-600" : "text-slate-400";
  const sign = delta > 0 ? "+" : "";
  const label = direction === "flat" ? "0%" : `${sign}${delta}%`;

  return (
    <div className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
      <Icon size={14} />
      <span>{label}</span>
    </div>
  );
}

function RuleLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function formatDate(value?: string, locale?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return date.toLocaleDateString(locale ?? "pt-BR");
}

export default function AdminHomePage() {
  const [overview, setOverview] = useState<QualityOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const { t, language } = useI18n();

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/quality/overview?period=${period}`, { cache: "no-store" });
        const payload = (await res.json()) as QualityOverviewResponse;
        if (!res.ok) {
          throw new Error(t("adminHome.errorUnexpected"));
        }
        if (!canceled) {
          setOverview(payload);
        }
      } catch (err) {
        if (!canceled) {
          setError(err instanceof Error ? err.message : t("adminHome.errorUnexpected"));
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      canceled = true;
    };
  }, [period, t]);

  const coverage = overview?.coverage ?? { total: 0, withStats: 0, percent: 0 };
  const releaseCount = overview?.releaseCount ?? 0;
  const companies = overview?.companies ?? [];
  const globalStats = overview?.globalStats ?? { pass: 0, fail: 0, blocked: 0, notRun: 0 };
  const globalTotal = sumStats(globalStats);
  const globalPassRate =
    overview?.globalPassRate ?? (globalTotal > 0 ? Math.round((globalStats.pass / globalTotal) * 100) : null);
  const gateCounts = overview?.gateCounts ?? { approved: 0, warning: 0, failed: 0, no_data: 0 };
  const riskCount = overview?.riskCount ?? 0;
  const warningCount = overview?.warningCount ?? 0;
  const trendPoints = overview?.trendPoints ?? [];
  const trendSummary = overview?.trendSummary ?? { direction: "flat", delta: 0 };
  const passRateTone =
    overview?.passRateTone ??
    (globalPassRate === null
      ? "neutral"
      : globalPassRate >= QUALITY_THRESHOLDS.passRate
        ? "good"
        : "warn");
  const latestTrendLabel = overview
    ? `${trendSummary.delta > 0 ? "+" : ""}${trendSummary.delta}%`
    : t("adminHome.latestValueFallback");
  const boardCompanies = companies.slice(0, 9);
  const policy = overview?.policy ?? QUALITY_THRESHOLDS;
  const coverageLabel = t("adminHome.coverage", { percent: coverage.percent });

  return (
    <RequireGlobalAdmin>
      <div className="relative min-h-screen pb-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(239,0,1,0.1),transparent_45%),radial-gradient(circle_at_75%_20%,rgba(17,24,39,0.08),transparent_40%),linear-gradient(140deg,#f5f7fb_0%,#eef2f7_45%,#f9fafb_100%)]" />
        <div className="space-y-10 pt-8">
          <header className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur md:p-10">
            <div className="absolute right-0 top-0 h-40 w-40 translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,rgba(239,0,1,0.18),transparent_65%)]" />
            <div className="relative space-y-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.45em] text-red-600">{t("adminHome.headerKicker")}</p>
                  <h1 className="text-3xl font-extrabold text-slate-900 md:text-5xl">{t("adminHome.headerTitle")}</h1>
                  <p className="max-w-2xl text-sm text-slate-600 md:text-base">{t("adminHome.headerSubtitle")}</p>
                </div>
                <div className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-xs text-slate-600 shadow-sm">
                  <span className="uppercase tracking-[0.28em] text-[10px] text-slate-400">{t("adminHome.periodLabel")}</span>
                  <div className="flex gap-2">
                    {[7, 30, 90].map((value) => (
                      <button
                        key={value}
                        onClick={() => setPeriod(value as 7 | 30 | 90)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          period === value
                            ? "bg-red-600 text-white shadow"
                            : "border border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {value}d
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-500">{coverageLabel}</div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200/60 bg-slate-900 px-5 py-4 text-white shadow-[0_18px_30px_rgba(15,23,42,0.25)]">
                  <p className="text-xs uppercase tracking-[0.35em] text-white/60">{t("adminHome.centralSignalTitle")}</p>
                  <p className="mt-2 text-2xl font-bold">{t("adminHome.centralSignalStatus")}</p>
                  <p className="text-xs text-white/60">{t("adminHome.centralSignalDesc")}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{t("adminHome.qualityGateTitle")}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {t("adminHome.qualityGateSummary", { failed: riskCount, warning: warningCount })}
                  </p>
                  <p className="text-xs text-slate-500">{t("adminHome.qualityGateDesc")}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{t("adminHome.releasePulseTitle")}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{releaseCount}</p>
                  <p className="text-xs text-slate-500">{t("adminHome.releasePulseDesc")}</p>
                </div>
              </div>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={FiUsers}
              label={t("adminHome.kpiCompanies")}
              value={companies.length}
              status={companies.length > 0 ? t("adminHome.kpiCompaniesOk") : t("adminHome.kpiCompaniesNone")}
              tone="good"
            />
            <KpiCard
              icon={FiActivity}
              label={t("adminHome.kpiReleases")}
              value={releaseCount}
              status={releaseCount > 0 ? t("adminHome.kpiReleasesOk") : t("adminHome.kpiReleasesNone")}
              tone="neutral"
            />
            <KpiCard
              icon={FiTrendingUp}
              label={t("adminHome.kpiPassRate")}
              value={globalPassRate !== null ? `${globalPassRate}%` : "--"}
              status={globalPassRate !== null ? t("adminHome.kpiPassRateOk") : t("adminHome.kpiPassRateNone")}
              tone={passRateTone}
            />
            <KpiCard
              icon={FiAlertTriangle}
              label={t("adminHome.kpiRisk")}
              value={riskCount}
              status={riskCount > 0 ? t("adminHome.kpiRiskOk") : t("adminHome.kpiRiskNone")}
              tone={riskCount > 0 ? "danger" : "good"}
            />
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{t("adminHome.pulseTitle")}</h2>
                <p className="text-sm text-slate-600">{t("adminHome.pulseSubtitle")}</p>
              </div>
              <div className="text-xs text-slate-500">
                {t("adminHome.pulseRules", {
                  passRate: policy.passRate,
                  failRate: policy.maxFailRate,
                })}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-slate-400">{t("adminHome.trendTitle")}</p>
                    <h3 className="text-lg font-semibold text-slate-900">{t("adminHome.trendSubtitle")}</h3>
                  </div>
                  <div className="text-xs text-slate-500">{t("adminHome.trendLatest", { value: latestTrendLabel })}</div>
                </div>
                <TrendChart points={trendPoints} emptyLabel={t("adminHome.trendNoData")} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-slate-400">{t("adminHome.statusTitle")}</p>
                    <h3 className="text-lg font-semibold text-slate-900">{t("adminHome.statusSubtitle")}</h3>
                  </div>
                  <span className="text-xs text-slate-500">{t("adminHome.statusTotal", { total: globalTotal })}</span>
                </div>
                <StatusBreakdown
                  stats={globalStats}
                  labels={{
                    pass: t("status.pass"),
                    fail: t("status.fail"),
                    blocked: t("status.blocked"),
                    notRun: t("status.notRun"),
                  }}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-slate-400">{t("adminHome.gateMapTitle")}</p>
                    <h3 className="text-lg font-semibold text-slate-900">{t("adminHome.gateMapSubtitle")}</h3>
                  </div>
                  <FiShield className="text-slate-400" />
                </div>
                <GateStack counts={gateCounts} />
                <div className="mt-4 grid gap-2 text-xs text-slate-600">
                  <span>{t("adminHome.gateMapApproved", { count: gateCounts.approved })}</span>
                  <span>{t("adminHome.gateMapWarning", { count: gateCounts.warning })}</span>
                  <span>{t("adminHome.gateMapFailed", { count: gateCounts.failed })}</span>
                  <span>{t("adminHome.gateMapNoData", { count: gateCounts.no_data })}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{t("adminHome.tableTitle")}</h2>
                <p className="text-sm text-slate-600">{t("adminHome.tableSubtitle")}</p>
              </div>
              <div className="text-xs text-slate-500">
                {loading ? t("adminHome.tableLoadingCompanies") : t("adminHome.tableCount", { count: companies.length })}
              </div>
            </div>
            {error && !loading && <p className="mt-4 text-sm text-red-600">{error}</p>}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="text-xs uppercase tracking-[0.28em] text-slate-400">
                  <tr className="border-b border-slate-200">
                    <th className="py-3 text-left">{t("adminHome.tableCompany")}</th>
                    <th className="py-3 text-left">{t("adminHome.tablePassRate")}</th>
                    <th className="py-3 text-left">{t("adminHome.tableLatest")}</th>
                    <th className="py-3 text-left">{t("adminHome.tableCriticalFails")}</th>
                    <th className="py-3 text-left">{t("adminHome.tableTrend")}</th>
                    <th className="py-3 text-left">{t("adminHome.tableGate")}</th>
                    <th className="py-3 text-left">{t("adminHome.tableAnalysts")}</th>
                    <th className="py-3 text-right">{t("adminHome.tableAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-500">
                        {t("adminHome.tableLoadingData")}
                      </td>
                    </tr>
                  )}
                  {!loading && companies.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-500">
                        {t("adminHome.tableNoCompanies")}
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    companies.map((row) => {
                      const passRateLabel = row.passRate !== null ? `${row.passRate}%` : "--";
                      const failCount = row.gate.total ? row.stats.fail : 0;
                      return (
                        <tr key={row.id} className="border-b border-slate-100 text-slate-700 hover:bg-slate-50">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-500">
                                {row.logo ? (
                                  <img src={row.logo} alt={`${row.name} logo`} className="h-9 w-9 rounded-lg object-contain" />
                                ) : (
                                  row.name.slice(0, 2).toUpperCase()
                                )}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900">{row.name}</div>
                                <div className="text-xs text-slate-500">
                                  {row.active === false ? t("adminHome.tableInactive") : t("adminHome.tableActive")} | {row.releases.length}{" "}
                                  {t("adminHome.tableReleases")}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                row.passRate !== null && row.passRate >= policy.passRate
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : row.passRate !== null
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-slate-200 bg-slate-100 text-slate-500"
                              }`}
                            >
                              {passRateLabel}
                            </span>
                          </td>
                          <td className="py-4">
                            <div className="text-sm font-semibold text-slate-900">
                              {row.latestRelease?.title ?? t("adminHome.tableNoRelease")}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatDate(row.latestRelease?.createdAt ?? undefined, language)}
                            </div>
                          </td>
                          <td className="py-4 text-sm font-semibold text-slate-900">{row.gate.total ? failCount : "--"}</td>
                          <td className="py-4">
                            <TrendIndicator direction={row.trend.direction} delta={row.trend.delta} />
                          </td>
                          <td className="py-4">
                            <GateBadge gate={row.gate} compact t={t} fallbackTitle={t("adminHome.boardGateOk")} />
                          </td>
                          <td className="py-4 text-sm text-slate-700">{row.analystCount ?? "--"}</td>
                          <td className="py-4 text-right">
                            {row.slug ? (
                              <Link
                                href={`/empresas/${row.slug}/dashboard`}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-red-600 hover:text-red-600"
                              >
                                {t("adminHome.tableViewDetails")}
                              </Link>
                            ) : (
                              <span className="text-xs text-slate-400">{t("adminHome.tableNoLink")}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-slate-400">{t("adminHome.boardTitle")}</p>
                  <h2 className="text-xl font-bold text-slate-900">{t("adminHome.boardSubtitle")}</h2>
                </div>
                <FiShield className="text-slate-400" />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {boardCompanies.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">{row.name}</div>
                      <GateBadge gate={row.gate} compact t={t} fallbackTitle={t("adminHome.boardGateOk")} />
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {t("status.pass")}: {row.passRate !== null ? `${row.passRate}%` : "--"} | {t("status.fail")}: {row.gate.total ? row.stats.fail : "--"}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-400 space-y-1">
                      {row.gate.reasons.length ? (
                        row.gate.reasons.map((reason, idx) => (
                          <span key={`${row.id}-reason-${idx}`}>
                            {reason.value !== undefined ? t(`gate.${reason.key}`, { value: reason.value }) : t(`gate.${reason.key}`)}
                          </span>
                        ))
                      ) : (
                        <span>{t("adminHome.boardGateOk")}</span>
                      )}
                    </div>
                  </div>
                ))}
                {boardCompanies.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                    {t("adminHome.boardEmpty")}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-slate-400">{t("adminHome.policyTitle")}</p>
                  <h2 className="text-xl font-bold text-slate-900">{t("adminHome.policySubtitle")}</h2>
                </div>
                <FiCheckCircle className="text-emerald-500" />
              </div>
              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <RuleLine label={t("adminHome.policyMinPass")} value={`${policy.passRate}%`} />
                <RuleLine label={t("adminHome.policyMaxFail")} value={`${policy.maxFailRate}%`} />
                <RuleLine label={t("adminHome.policyMaxBlocked")} value={`${policy.maxBlockedRate}%`} />
                <RuleLine label={t("adminHome.policyMaxNotRun")} value={`${policy.maxNotRunRate}%`} />
                <RuleLine label={t("adminHome.policyMinTotal")} value={`${policy.minTotal}`} />
              </div>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-xs text-white">
                {t("adminHome.policyBanner")}
              </div>
            </div>
          </section>
        </div>
      </div>
    </RequireGlobalAdmin>
  );
}
