"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowDownRight,
  FiArrowRight,
  FiArrowUpRight,
  FiDownload,
  FiFilter,
  FiLayers,
  FiMinus,
  FiRefreshCw,
  FiTrendingDown,
  FiTrendingUp,
  FiZap,
} from "react-icons/fi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAppMeta } from "@/lib/appMeta";
import css from "./CompanyIntelligenceDashboard.module.css";
import type { CompanyDashboardData } from "./companyDashboardData";

type PeriodPreset = "all" | "7d" | "30d" | "90d" | "180d" | "custom";
type GroupBy = "day" | "week" | "month" | "release" | "application";
type ChartMetric = "passRate" | "failRate" | "runs" | "blocked";
type ChartView = "qualityTimeline" | "runsTimeline" | "applicationHealth" | "applicationDefects";
type RiskLevel = "critical" | "warning" | "stable";
type StatusFilter = string;
type SourceFilter = "all" | "manual" | "integration";
type ResultView = "overview" | "comparatives" | "drilldown";

type EnrichedRun = CompanyDashboardData["runs"][number] & {
  time: number;
  passRate: number;
  failRate: number;
  directDefectCount: number;
  appDefectCount: number;
  deltaPassRate: number | null;
  deltaFailCount: number | null;
  isRegression: boolean;
  riskLevel: RiskLevel;
};

type SeriesPoint = {
  key: string;
  label: string;
  runs: number;
  passRate: number;
  failRate: number;
  blocked: number;
  defects: number;
};

type ApplicationAggregate = {
  key: string;
  label: string;
  runs: number;
  totalCases: number;
  passRate: number;
  failRate: number;
  blocked: number;
  defects: number;
  regressions: number;
  riskLevel: RiskLevel;
};

type ExecutiveSummary = {
  totalRuns: number;
  totalCases: number;
  passRate: number;
  failRate: number;
  blocked: number;
  defects: number;
  applicationsAtRisk: number;
  worstRun: EnrichedRun | null;
  bestRun: EnrichedRun | null;
};

type InsightItem = {
  id: string;
  title: string;
  detail: string;
  tone: "positive" | "warning" | "critical" | "neutral";
};

type MetricDelta = {
  label: string;
  tone: "positive" | "warning" | "neutral";
};

type Range = {
  start: number | null;
  end: number | null;
  durationMs: number | null;
};

type DashboardFilterState = {
  periodPreset: PeriodPreset;
  groupBy: GroupBy;
  chartView: ChartView;
  applicationFilter: string;
  runFilter: string;
  statusFilter: StatusFilter;
  environmentFilter: string;
  sourceFilter: SourceFilter;
  responsibleFilter: string;
  riskFilter: "all" | RiskLevel;
  compareEnabled: boolean;
  onlyWithDefects: boolean;
  onlyRegression: boolean;
  dateFrom: string;
  dateTo: string;
};

type ContextualFilterKey =
  | "applicationFilter"
  | "runFilter"
  | "environmentFilter"
  | "responsibleFilter"
  | "statusFilter";

const PERIOD_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
  { value: "all", label: "Todo período" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "180d", label: "180 dias" },
  { value: "custom", label: "Customizado" },
];

const GROUP_OPTIONS: Array<{ value: GroupBy; label: string }> = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "release", label: "Run" },
];

const CHART_VIEW_OPTIONS: Array<{ value: ChartView; label: string }> = [
  { value: "qualityTimeline", label: "Qualidade no tempo" },
  { value: "runsTimeline", label: "Volume de runs" },
  { value: "applicationHealth", label: "Saúde por aplicação" },
  { value: "applicationDefects", label: "Defeitos por aplicação" },
];

const DEFAULT_FILTERS: DashboardFilterState = {
  periodPreset: "all",
  groupBy: "month",
  chartView: "qualityTimeline",
  applicationFilter: "all",
  runFilter: "all",
  statusFilter: "all",
  environmentFilter: "all",
  sourceFilter: "all",
  responsibleFilter: "all",
  riskFilter: "all",
  compareEnabled: true,
  onlyWithDefects: false,
  onlyRegression: false,
  dateFrom: "",
  dateTo: "",
};

const STATUS_FILTER_ALL = "all";
const STATUS_ORDER = [
  "concluida",
  "em-andamento",
  "pendente",
  "bloqueada",
  "em-risco",
  "sem-status",
];

let testingLogoPromise: Promise<string | null> | null = null;

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result?.toString() ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function getTestingLogoDataUrl() {
  if (!testingLogoPromise) {
    testingLogoPromise = fetch("/images/tc.png", { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) return null;
        const blob = await response.blob();
        return blobToDataUrl(blob);
      })
      .catch(() => null);
  }

  return testingLogoPromise;
}

function toTimestamp(value?: string | null) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTime(value?: string | null) {
  const time = toTimestamp(value);
  if (!time) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function formatMonthLabel(time: number) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(time);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(value >= 100 ? 0 : 1).replace(".0", "")}%`;
}

function startOfDay(time: number) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function endOfDay(time: number) {
  const date = new Date(time);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function startOfWeek(time: number) {
  const date = new Date(time);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function startOfMonth(time: number) {
  const date = new Date(time);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function parseCommaList(value?: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeFilterValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveRunStatusValue(run: Pick<EnrichedRun, "statusLabel" | "statusRaw">) {
  const candidate = run.statusLabel || run.statusRaw || "Sem status";
  return normalizeFilterValue(candidate) || "sem-status";
}

function buildStatusOptions(runs: EnrichedRun[]) {
  const statusMap = new Map<string, { value: string; label: string }>();

  for (const run of runs) {
    const label = run.statusLabel || run.statusRaw || "Sem status";
    const value = resolveRunStatusValue(run);
    if (!statusMap.has(value)) {
      statusMap.set(value, { value, label });
    }
  }

  return Array.from(statusMap.values()).sort((left, right) => {
    const leftIndex = STATUS_ORDER.indexOf(left.value);
    const rightIndex = STATUS_ORDER.indexOf(right.value);
    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    }
    return left.label.localeCompare(right.label, "pt-BR", { sensitivity: "base" });
  });
}

function matchesStatusFilter(run: EnrichedRun, statusFilter: StatusFilter) {
  return statusFilter === STATUS_FILTER_ALL || resolveRunStatusValue(run) === statusFilter;
}

function toneClasses(tone: "positive" | "warning" | "critical" | "neutral") {
  if (tone === "positive") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300";
  if (tone === "critical") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300";
  return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function softInsightClasses(tone: "positive" | "warning" | "critical" | "neutral") {
  if (tone === "positive") return "border-[rgba(16,185,129,0.16)] bg-[linear-gradient(180deg,rgba(236,253,245,0.72)_0%,rgba(255,255,255,0.98)_100%)] dark:border-emerald-800/40 dark:bg-[linear-gradient(180deg,rgba(6,78,59,0.32)_0%,rgba(15,23,42,0.98)_100%)]";
  if (tone === "warning") return "border-[rgba(245,158,11,0.16)] bg-[linear-gradient(180deg,rgba(255,251,235,0.84)_0%,rgba(255,255,255,0.98)_100%)] dark:border-amber-800/40 dark:bg-[linear-gradient(180deg,rgba(120,53,15,0.32)_0%,rgba(15,23,42,0.98)_100%)]";
  if (tone === "critical") return "border-[rgba(244,63,94,0.16)] bg-[linear-gradient(180deg,rgba(255,241,242,0.82)_0%,rgba(255,255,255,0.98)_100%)] dark:border-rose-800/40 dark:bg-[linear-gradient(180deg,rgba(136,19,55,0.32)_0%,rgba(15,23,42,0.98)_100%)]";
  return "border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(248,250,252,0.92)_0%,rgba(255,255,255,0.98)_100%)] dark:border-slate-700/40 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.72)_0%,rgba(15,23,42,0.98)_100%)]";
}

function softInsightAccent(tone: "positive" | "warning" | "critical" | "neutral") {
  if (tone === "positive") return "bg-emerald-500";
  if (tone === "warning") return "bg-amber-500";
  if (tone === "critical") return "bg-rose-500";
  return "bg-slate-400";
}

function riskWeight(level: RiskLevel) {
  if (level === "critical") return 3;
  if (level === "warning") return 2;
  return 1;
}

function riskTone(level: RiskLevel) {
  if (level === "critical") return "critical" as const;
  if (level === "warning") return "warning" as const;
  return "positive" as const;
}

function resolveRange(periodPreset: PeriodPreset, from: string, to: string): Range {
  if (periodPreset === "all") {
    return { start: null, end: null, durationMs: null };
  }

  const now = Date.now();
  if (periodPreset === "custom") {
    const start = from ? startOfDay(Date.parse(from)) : null;
    const end = to ? endOfDay(Date.parse(to)) : null;
    if (start != null && !Number.isFinite(start)) return { start: null, end: null, durationMs: null };
    if (end != null && !Number.isFinite(end)) return { start: null, end: null, durationMs: null };
    if (start != null && end != null && start > end) {
      return { start: null, end: null, durationMs: null };
    }
    return { start, end, durationMs: start != null && end != null ? end - start : null };
  }

  const days =
    periodPreset === "7d" ? 7 :
    periodPreset === "30d" ? 30 :
    periodPreset === "90d" ? 90 : 180;
  const end = endOfDay(now);
  const start = startOfDay(now - (days - 1) * 24 * 60 * 60 * 1000);
  return { start, end, durationMs: end - start };
}

function buildPreviousRange(range: Range): Range | null {
  if (range.start == null || range.end == null || range.durationMs == null) return null;
  const previousEnd = range.start - 1;
  const previousStart = previousEnd - range.durationMs;
  return { start: previousStart, end: previousEnd, durationMs: range.durationMs };
}

function withinRange(time: number, start: number | null, end: number | null) {
  if (!time) return false;
  if (start != null && time < start) return false;
  if (end != null && time > end) return false;
  return true;
}

function determineRunRisk(run: CompanyDashboardData["runs"][number], directDefectCount: number): RiskLevel {
  const passRate = run.stats.passRate ?? 0;
  if (run.stats.fail >= 3 || passRate < 70 || directDefectCount >= 2) return "critical";
  if (run.stats.fail > 0 || run.stats.blocked > 0 || passRate < 85 || directDefectCount > 0) return "warning";
  return "stable";
}

function summarizeRuns(runs: EnrichedRun[], defects: CompanyDashboardData["defects"]) {
  const totalCases = runs.reduce((sum, run) => sum + run.stats.total, 0);
  const totalPass = runs.reduce((sum, run) => sum + run.stats.pass, 0);
  const totalFail = runs.reduce((sum, run) => sum + run.stats.fail, 0);
  const totalBlocked = runs.reduce((sum, run) => sum + run.stats.blocked, 0);
  const passRate = totalCases > 0 ? (totalPass / totalCases) * 100 : 0;
  const failRate = totalCases > 0 ? (totalFail / totalCases) * 100 : 0;
  const applicationsAtRisk = new Set(runs.filter((run) => run.riskLevel !== "stable").map((run) => run.applicationKey)).size;
  const worstRun = [...runs].sort((left, right) => {
    if (riskWeight(left.riskLevel) !== riskWeight(right.riskLevel)) {
      return riskWeight(right.riskLevel) - riskWeight(left.riskLevel);
    }
    if (left.passRate !== right.passRate) return left.passRate - right.passRate;
    return right.directDefectCount - left.directDefectCount;
  })[0] ?? null;
  const bestRun = [...runs].sort((left, right) => {
    if (right.passRate !== left.passRate) return right.passRate - left.passRate;
    return right.stats.total - left.stats.total;
  })[0] ?? null;

  return {
    totalRuns: runs.length,
    totalCases,
    passRate,
    failRate,
    blocked: totalBlocked,
    defects: defects.length,
    applicationsAtRisk,
    worstRun,
    bestRun,
  } satisfies ExecutiveSummary;
}

function buildDelta(
  current: number,
  previous: number,
  kind: "higher_better" | "lower_better" | "neutral",
  suffix = "",
): MetricDelta {
  const diff = current - previous;
  const rounded = Math.abs(diff) >= 10 ? Math.round(diff) : Number(diff.toFixed(1));
  const label = `${diff >= 0 ? "+" : ""}${rounded}${suffix} vs. período anterior`;

  if (kind === "neutral" || Math.abs(diff) < 0.1) {
    return { label, tone: "neutral" };
  }

  const better = kind === "higher_better" ? diff > 0 : diff < 0;
  return {
    label,
    tone: better ? "positive" : "warning",
  };
}

function chartMetricValue(point: SeriesPoint, metric: ChartMetric) {
  return (
    metric === "passRate" ? point.passRate :
    metric === "failRate" ? point.failRate :
    metric === "runs" ? point.runs :
    point.blocked
  );
}

function formatChartMetricValue(metric: ChartMetric, value: number) {
  return metric === "passRate" || metric === "failRate"
    ? formatPercent(value)
    : formatCompactNumber(value);
}

function resolveChartMetricMeta(metric: ChartMetric) {
  if (metric === "passRate") {
    return {
      label: "Pass rate",
      hint: "Meta visual em 90%",
      targetValue: 90,
      colors: ["#011848", "#245295", "#22c55e"],
      surface: "rgba(34,197,94,0.08)",
    };
  }

  if (metric === "failRate") {
    return {
      label: "Falhas",
      hint: "Quanto menor, melhor",
      targetValue: 10,
      colors: ["#011848", "#245295", "#ef0001"],
      surface: "rgba(239,0,1,0.06)",
    };
  }

  if (metric === "runs") {
    return {
      label: "Runs",
      hint: "Volume ao longo do recorte",
      targetValue: null,
      colors: ["#011848", "#245295", "#60a5fa"],
      surface: "rgba(36,82,149,0.07)",
    };
  }

  return {
    label: "Bloqueios",
    hint: "Interrupções no período",
    targetValue: null,
    colors: ["#011848", "#245295", "#f59e0b"],
    surface: "rgba(245,158,11,0.08)",
  };
}

function buildChartScale(values: number[], metric: ChartMetric) {
  if (metric === "passRate" || metric === "failRate") {
    return { min: 0, max: 100, ticks: [100, 75, 50, 25, 0] };
  }

  const peak = Math.max(...values, 0);
  if (peak <= 4) {
    return { min: 0, max: 4, ticks: [4, 3, 2, 1, 0] };
  }

  const roughStep = peak / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const step =
    normalized <= 1 ? magnitude :
    normalized <= 2 ? 2 * magnitude :
    normalized <= 5 ? 5 * magnitude :
    10 * magnitude;
  const max = Math.ceil(peak / step) * step;

  return {
    min: 0,
    max,
    ticks: Array.from({ length: 5 }, (_, index) => max - step * index),
  };
}

function isTimeChartView(view: ChartView) {
  return view === "qualityTimeline" || view === "runsTimeline";
}

function resolveChartPanelCopy(view: ChartView) {
  if (view === "qualityTimeline") {
    return {
      eyebrow: "Gráfico principal",
      title: "Qualidade ao longo do tempo",
      description: "Evolução da qualidade no recorte atual.",
    };
  }

  if (view === "runsTimeline") {
    return {
      eyebrow: "Gráfico principal",
      title: "Volume de runs no tempo",
      description: "Quantidade de execuções em cada período do recorte.",
    };
  }

  if (view === "applicationHealth") {
    return {
      eyebrow: "Gráfico principal",
      title: "Saúde por aplicação",
      description: "Comparativo entre aplicações já filtradas no painel.",
    };
  }

  return {
    eyebrow: "Gráfico principal",
    title: "Defeitos por aplicação",
    description: "Concentração de defeitos nas aplicações do recorte atual.",
  };
}

function buildSeries(runs: EnrichedRun[], defects: CompanyDashboardData["defects"], groupBy: GroupBy) {
  const buckets = new Map<string, { label: string; runs: EnrichedRun[]; defects: number; sortValue: number }>();
 
  for (const run of runs) {
    let key = run.slug;
    let label = run.title;
    let sortValue = run.time;

    if (groupBy === "day") {
      sortValue = startOfDay(run.time);
      key = String(sortValue);
      label = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(sortValue);
    } else if (groupBy === "week") {
      sortValue = startOfWeek(run.time);
      key = String(sortValue);
      const end = sortValue + 6 * 24 * 60 * 60 * 1000;
      label = `${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(sortValue)} - ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(end)}`;
    } else if (groupBy === "month") {
      sortValue = startOfMonth(run.time);
      key = String(sortValue);
      label = formatMonthLabel(sortValue);
    } else if (groupBy === "application") {
      key = run.applicationKey;
      label = run.applicationName;
    }

    const current = buckets.get(key) ?? { label, runs: [], defects: 0, sortValue };
    current.runs.push(run);
    current.sortValue = groupBy === "application" ? Math.max(current.sortValue, sortValue) : sortValue;
    buckets.set(key, current);
  }

  for (const defect of defects) {
    const time = Math.max(toTimestamp(defect.updatedAt), toTimestamp(defect.createdAt));
    let key = defect.runSlug || defect.slug;
    if (groupBy === "day") key = String(startOfDay(time));
    else if (groupBy === "week") key = String(startOfWeek(time));
    else if (groupBy === "month") key = String(startOfMonth(time));
    else if (groupBy === "application") key = defect.applicationKey;
    const current = buckets.get(key);
    if (current) current.defects += 1;
  }

  return Array.from(buckets.entries())
    .map(([key, bucket]) => {
      const totalCases = bucket.runs.reduce((sum, run) => sum + run.stats.total, 0);
      const totalPass = bucket.runs.reduce((sum, run) => sum + run.stats.pass, 0);
      const totalFail = bucket.runs.reduce((sum, run) => sum + run.stats.fail, 0);
      const totalBlocked = bucket.runs.reduce((sum, run) => sum + run.stats.blocked, 0);
      return {
        key,
        label: bucket.label,
        runs: bucket.runs.length,
        passRate: totalCases > 0 ? (totalPass / totalCases) * 100 : 0,
        failRate: totalCases > 0 ? (totalFail / totalCases) * 100 : 0,
        blocked: totalBlocked,
        defects: bucket.defects,
        sortValue: bucket.sortValue,
      };
    })
    .sort((left, right) => left.sortValue - right.sortValue)
    .map((point) => ({
      key: point.key,
      label: point.label,
      runs: point.runs,
      passRate: point.passRate,
      failRate: point.failRate,
      blocked: point.blocked,
      defects: point.defects,
    }));
}

function chartValueToY(value: number, min: number, max: number, height = 52, paddingY = 4) {
  const range = max - min || 1;
  const plotHeight = height - paddingY * 2;
  return paddingY + plotHeight - ((value - min) / range) * plotHeight;
}

function buildLinePath(values: number[], min: number, max: number, width = 100, height = 52, paddingY = 4) {
  if (values.length === 0) return { line: "", area: "", points: [] as Array<{ x: number; y: number }> };
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = chartValueToY(value, min, max, height, paddingY);
    return { x, y };
  });

  const line =
    points.length === 1
      ? `M ${points[0]?.x ?? 0} ${points[0]?.y ?? 0}`
      : points.reduce((path, point, index, allPoints) => {
          if (index === 0) return `M ${point.x} ${point.y}`;
          const previous = allPoints[index - 1];
          const controlX = previous.x + (point.x - previous.x) / 2;
          return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
        }, "");

  const firstPoint = points[0];
  const lastPoint = points.at(-1);
  const area = firstPoint && lastPoint
    ? `${line} L ${lastPoint.x} ${height - paddingY} L ${firstPoint.x} ${height - paddingY} Z`
    : "";
  return { line, area, points };
}

function downloadCsv(rows: EnrichedRun[]) {
  const header = [
    "Run",
    "Aplicação",
    "Status",
    "Origem",
    "Pass rate",
    "Falhas",
    "Bloqueados",
    "Defeitos vinculados",
    "Última atualização",
  ];
  const body = rows.map((row) => [
    row.title,
    row.applicationName,
    row.statusLabel,
    row.sourceType === "manual" ? "Manual" : `Integração${row.integrationProvider ? ` ${row.integrationProvider}` : ""}`,
    row.passRate.toFixed(1),
    String(row.stats.fail),
    String(row.stats.blocked),
    String(row.directDefectCount),
    formatDateTime(row.updatedAt ?? row.createdAt),
  ]);
  const csv = [header, ...body]
    .map((columns) => columns.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "desktopboard-empresa.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function Panel(props: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: "default" | "softGradient";
}) {
  const surfaceClassName =
    props.variant === "softGradient"
      ? "border-[rgba(1,24,72,0.08)] [background:radial-gradient(circle_at_top_left,rgba(1,24,72,0.09)_0%,transparent_26%),radial-gradient(circle_at_bottom_right,rgba(239,0,1,0.1)_0%,transparent_32%)] dark:border-(--tc-border,#334155) dark:[background:radial-gradient(circle_at_top_left,rgba(100,160,255,0.1)_0%,transparent_26%),radial-gradient(circle_at_bottom_right,rgba(239,0,1,0.08)_0%,transparent_32%)]"
      : "border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) dark:border-(--tc-border,#334155) dark:bg-(--tc-surface,#0f172a)";

  const eyebrowClassName =
    props.variant === "softGradient"
      ? "text-[rgba(8,32,77,0.56)] dark:text-(--tc-text-muted,#94a3b8)"
      : "text-(--tc-text-muted,#6b7280)";
  const titleClassName =
    props.variant === "softGradient"
      ? "text-[#08204d] dark:text-(--tc-text,#e2e8f0)"
      : "text-(--tc-text,#0b1a3c) dark:text-(--tc-text,#e2e8f0)";
  const descriptionClassName =
    props.variant === "softGradient"
      ? "text-[rgba(8,32,77,0.66)] dark:text-(--tc-text-muted,#94a3b8)"
      : "text-(--tc-text-muted,#6b7280)";

  return (
    <section className={`h-full rounded-3xl border p-4 sm:p-4.5 ${surfaceClassName} ${props.className ?? ""}`}>
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${eyebrowClassName}`}>{props.eyebrow}</p>
            <div>
              <h2 className={`text-lg font-bold tracking-[-0.03em] ${titleClassName}`}>{props.title}</h2>
              {props.description ? (
                <p className={`mt-1 max-w-4xl text-sm leading-5 ${descriptionClassName}`}>{props.description}</p>
              ) : null}
            </div>
          </div>
          {props.actions ? <div className="flex flex-wrap items-center gap-2">{props.actions}</div> : null}
        </div>
        <div className="mt-4">{props.children}</div>
      </div>
    </section>
  );
}

function StatCard(props: {
  label: string;
  value: string;
  note: string;
  tone?: "positive" | "warning" | "critical" | "neutral";
  delta?: MetricDelta | null;
  icon: ReactNode;
}) {
  const tone =
    props.tone === "critical" ? "text-rose-600" :
    props.tone === "warning" ? "text-amber-600" :
    props.tone === "positive" ? "text-emerald-600" :
    "text-(--tc-text,#0b1a3c)";

  return (
    <div className="h-full min-h-43 rounded-[20px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 py-4 dark:border-(--tc-border,#334155) dark:bg-(--tc-surface,#0f172a)">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">{props.label}</div>
          <div className={`mt-2 text-3xl font-extrabold tracking-[-0.04em] ${tone}`}>{props.value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--tc-surface-2,#f1f5f9) text-(--tc-primary,#0b1a3c) dark:bg-(--tc-surface-2,#1e293b) dark:text-(--tc-text,#e2e8f0)">
          {props.icon}
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-(--tc-text-muted,#6b7280)">{props.note}</p>
      {props.delta ? (
        <div className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] ${toneClasses(props.delta.tone)}`}>
          {props.delta.tone === "positive" ? <FiArrowUpRight className="h-3.5 w-3.5" /> : props.delta.tone === "warning" ? <FiArrowDownRight className="h-3.5 w-3.5" /> : <FiMinus className="h-3.5 w-3.5" />}
          {props.delta.label}
        </div>
      ) : null}
    </div>
  );
}

function MiniLineChart(props: { points: SeriesPoint[]; metric: Exclude<ChartMetric, "all"> }) {
  const values = props.points.map((point) => chartMetricValue(point, props.metric));
  const meta = resolveChartMetricMeta(props.metric);
  const scale = buildChartScale(values, props.metric);
  const chartHeight = 58;
  const chartPadding = 5;
  const plotBottom = chartHeight - chartPadding;
  const { line, area, points } = buildLinePath(values, scale.min, scale.max, 100, chartHeight, 5);
  const latest = values.at(-1) ?? 0;
  const previous = values.length > 1 ? values[values.length - 2] : null;
  const momentum = previous == null ? null : latest - previous;
  const targetY = meta.targetValue == null
    ? null
    : chartValueToY(meta.targetValue, scale.min, scale.max, chartHeight, 5);
  const displayTicks = scale.ticks.length <= 3
    ? scale.ticks
    : [scale.ticks[0], scale.ticks[Math.floor(scale.ticks.length / 2)] ?? scale.ticks[0], scale.ticks.at(-1) ?? scale.ticks[0]];
  const xAxisLabels = props.points.filter((_, index) => {
    if (props.points.length <= 5) return true;
    if (index === 0 || index === props.points.length - 1) return true;
    const stride = Math.max(1, Math.floor((props.points.length - 1) / 3));
    return index % stride === 0;
  }).slice(0, 5);
  const metricFormatter = (value: number) => formatChartMetricValue(props.metric, value);
  const momentumTone =
    momentum == null || Math.abs(momentum) < 0.01
      ? "neutral"
      : props.metric === "failRate" || props.metric === "blocked"
        ? (momentum < 0 ? "positive" : "warning")
        : (momentum > 0 ? "positive" : "warning");
  const momentumLabel =
    momentum == null
      ? "Sem referência"
      : `${momentum >= 0 ? "+" : ""}${props.metric === "passRate" || props.metric === "failRate" ? momentum.toFixed(1) : Math.round(momentum)}${props.metric === "passRate" || props.metric === "failRate" ? " p.p." : ""}`;
  const chartGradientId = `desktopboard-line-${props.metric}`;
  const chartAreaId = `desktopboard-area-${props.metric}`;
  const chartShadowId = `desktopboard-shadow-${props.metric}`;
  const periodStartLabel = props.points[0]?.label ?? "-";
  const periodEndLabel = props.points.at(-1)?.label ?? "-";

  return (
    <div className={`overflow-hidden rounded-[20px] border p-5 ${css.chartContainer}`}>
      <div className="mb-4 flex flex-col gap-4 border-b border-[rgba(15,23,42,0.06)] pb-4 dark:border-slate-700/30 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">
            {meta.label}
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <div className="text-[40px] font-extrabold leading-none tracking-[-0.06em] text-(--tc-text,#0b1a3c)">
              {metricFormatter(latest)}
            </div>
            <div className={`mb-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClasses(momentumTone)}`}>
              {momentumTone === "positive" ? <FiArrowUpRight className="h-3.5 w-3.5" /> : momentumTone === "warning" ? <FiArrowDownRight className="h-3.5 w-3.5" /> : <FiMinus className="h-3.5 w-3.5" />}
              {momentumLabel}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {meta.targetValue != null ? (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(8,32,77,0.46)] dark:text-slate-400">Meta</span>
              <span className="ml-2 font-bold text-[rgba(11,160,122,0.92)]">{metricFormatter(meta.targetValue)}</span>
            </div>
          ) : null}
          <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(8,32,77,0.46)] dark:text-slate-400">Período</span>
            <span className="ml-2 font-medium text-[rgba(8,32,77,0.68)] dark:text-slate-300">{periodStartLabel} a {periodEndLabel}</span>
          </div>
        </div>
      </div>

      {props.points.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
          <div className="hidden h-64 flex-col justify-between py-2 text-[11px] font-semibold text-[rgba(8,32,77,0.52)] dark:text-slate-400 lg:flex">
            {displayTicks.map((tick) => (
              <div key={tick}>{metricFormatter(tick)}</div>
            ))}
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-[rgba(8,32,77,0.58)] dark:text-slate-400">
              <span className="inline-flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${css.seriesDot}`} {...{ style: { '--dot-color': meta.colors[1] } as React.CSSProperties }} />
                Série: {meta.label}
              </span>
              {meta.targetValue != null ? (
                <span className="inline-flex items-center gap-2">
                  <span className="block h-px w-5 border-t border-dashed border-[rgba(16,185,129,0.45)]" />
                  Meta: {metricFormatter(meta.targetValue)}
                </span>
              ) : null}
            </div>

            <svg viewBox={`0 0 100 ${chartHeight}`} className="h-64 w-full overflow-visible">
              <defs>
                <linearGradient id={chartGradientId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={meta.colors[0]} />
                  <stop offset="60%" stopColor={meta.colors[1]} />
                  <stop offset="100%" stopColor={meta.colors[2]} />
                </linearGradient>
                <linearGradient id={chartAreaId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={meta.surface} />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
                </linearGradient>
                <filter id={chartShadowId} x="-20%" y="-20%" width="140%" height="160%">
                  <feDropShadow dx="0" dy="1.25" stdDeviation="1.35" floodColor={meta.colors[1]} floodOpacity="0.18" />
                </filter>
              </defs>

              <rect x="0" y={chartPadding} width="100" height={plotBottom - chartPadding} rx="3.5" className={css.chartBgRect} />

              {displayTicks.map((tick) => {
                const y = chartValueToY(tick, scale.min, scale.max, chartHeight, 5);
                return (
                  <line
                    key={tick}
                    x1="0"
                    y1={y}
                    x2="100"
                    y2={y}
                    stroke={tick === 0 ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.08)"}
                    strokeDasharray="2 6"
                  />
                );
              })}

              <line x1="0" y1={plotBottom} x2="100" y2={plotBottom} stroke="rgba(148,163,184,0.18)" />

              {targetY != null ? (
                <line
                  x1="0"
                  y1={targetY}
                  x2="100"
                  y2={targetY}
                  stroke="rgba(16,185,129,0.18)"
                  strokeDasharray="3 6"
                />
              ) : null}

              <path d={area} fill={`url(#${chartAreaId})`} />
              <path d={line} fill="none" stroke={`url(#${chartGradientId})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${chartShadowId})`} />

              {points.map((point, index) => (
                <g key={`${point.x}-${point.y}`}>
                  {index === points.length - 1 ? <circle cx={point.x} cy={point.y} r="3.2" fill="rgba(36,82,149,0.12)" /> : null}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={index === points.length - 1 ? "1.95" : "1.3"}
                    fill={index === points.length - 1 ? meta.colors[1] : undefined}
                    className={index === points.length - 1 ? undefined : css.chartDotFill}
                    stroke={meta.colors[1]}
                    strokeWidth={index === points.length - 1 ? "1.35" : "1.05"}
                  />
                </g>
              ))}
            </svg>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-[rgba(8,32,77,0.56)] dark:text-slate-400 sm:grid-cols-3 lg:grid-cols-5">
              {xAxisLabels.map((point) => (
                <div key={point.key} className="truncate">
                  <span className="font-medium">{point.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 text-[11px] font-medium uppercase tracking-[0.12em] text-[rgba(8,32,77,0.48)] dark:text-slate-500">
              Período analisado: {periodStartLabel} a {periodEndLabel}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-44 items-center justify-center rounded-[22px] border border-dashed border-(--tc-border,#d7deea) text-sm text-(--tc-text-muted,#6b7280)">
          Sem pontos suficientes no filtro atual.
        </div>
      )}
    </div>
  );
}

function RunsBarChart(props: { points: SeriesPoint[] }) {
  const peak = Math.max(...props.points.map((point) => point.runs), 1);
  const totalRuns = props.points.reduce((sum, point) => sum + point.runs, 0);
  const periodStartLabel = props.points[0]?.label ?? "-";
  const periodEndLabel = props.points.at(-1)?.label ?? "-";

  return (
    <div className={`overflow-hidden rounded-[20px] border p-5 ${css.chartContainer}`}>
      <div className="mb-4 flex flex-col gap-3 border-b border-[rgba(15,23,42,0.06)] pb-4 dark:border-slate-700/30 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgba(8,32,77,0.48)] dark:text-slate-400">Execuções</div>
          <div className="mt-2 text-[40px] font-extrabold leading-none tracking-[-0.06em] text-(--tc-text,#0b1a3c)">
            {formatCompactNumber(totalRuns)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(8,32,77,0.46)] dark:text-slate-400">Pico</span>
            <span className="ml-2 font-medium text-[rgba(8,32,77,0.68)] dark:text-slate-300">{formatCompactNumber(peak)} run(s)</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(8,32,77,0.46)] dark:text-slate-400">Período</span>
            <span className="ml-2 font-medium text-[rgba(8,32,77,0.68)] dark:text-slate-300">{periodStartLabel} a {periodEndLabel}</span>
          </div>
        </div>
      </div>

      <div
        className={`grid h-64 items-end gap-3 ${css.dynamicGrid}`}
        {...{ style: { '--col-count': Math.max(props.points.length, 1) } as React.CSSProperties }}
      >
        {props.points.map((point) => {
          const height = Math.max((point.runs / peak) * 100, point.runs > 0 ? 12 : 0);
          return (
            <div key={point.key} className="flex min-w-0 flex-col items-center gap-2">
              <div className="text-[11px] font-semibold text-[rgba(8,32,77,0.68)] dark:text-slate-300">{formatCompactNumber(point.runs)}</div>
              <div className={`relative flex h-48 w-full items-end justify-center rounded-[18px] px-2 pb-2 ${css.barBg}`}>
                <div
                  className={`w-full rounded-[14px] bg-[linear-gradient(180deg,rgba(36,82,149,0.92)_0%,rgba(1,24,72,0.98)_100%)] shadow-[0_10px_22px_rgba(1,24,72,0.14)] ${css.barHeight}`}
                  {...{ style: { '--bar-h': `${height}%` } as React.CSSProperties }}
                />
              </div>
              <div className="truncate text-center text-[11px] font-medium text-[rgba(8,32,77,0.58)] dark:text-slate-400">{point.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApplicationHealthChart(props: { applications: ApplicationAggregate[] }) {
  const items = [...props.applications]
    .sort((left, right) => {
      if (left.passRate !== right.passRate) return left.passRate - right.passRate;
      return right.defects - left.defects;
    })
    .slice(0, 8);

  return (
    <div className={`overflow-hidden rounded-[20px] border p-5 ${css.chartContainer}`}>
      <div className="mb-4 flex flex-col gap-2 border-b border-[rgba(15,23,42,0.06)] pb-4 dark:border-slate-700/30">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgba(8,32,77,0.48)] dark:text-slate-400">Aplicações comparadas</div>
        <div className="text-sm text-[rgba(8,32,77,0.66)] dark:text-slate-400">Pass rate por aplicação já considerando os filtros ativos.</div>
      </div>

      <div className="space-y-4">
        {items.map((application) => {
          const barTone =
            application.riskLevel === "critical"
              ? "linear-gradient(90deg,rgba(239,68,68,0.92)_0%,rgba(220,38,38,0.98)_100%)"
              : application.riskLevel === "warning"
                ? "linear-gradient(90deg,rgba(245,158,11,0.9)_0%,rgba(217,119,6,0.98)_100%)"
                : "linear-gradient(90deg,rgba(36,82,149,0.9)_0%,rgba(1,24,72,0.98)_100%)";
          const riskLabel =
            application.riskLevel === "critical"
              ? "Crítico"
              : application.riskLevel === "warning"
                ? "Atenção"
                : "Estável";

          return (
            <div key={application.key}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-(--tc-text,#0b1a3c)">{application.label}</div>
                  <div className="mt-1 text-[11px] text-(--tc-text-muted,#6b7280)">
                    {application.runs} run(s) • {application.defects} defeito(s) • {riskLabel}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-bold text-(--tc-text,#0b1a3c)">{formatPercent(application.passRate)}</div>
              </div>
              <div className={`mt-2 h-2.5 rounded-full ${css.barTrack}`}>
                <div
                  className={`h-full rounded-full shadow-[0_8px_16px_rgba(15,23,42,0.12)] ${css.barWidth}`}
                  {...{ style: { '--bar-w': `${Math.max(application.passRate, application.runs > 0 ? 4 : 0)}%`, background: barTone } as React.CSSProperties }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApplicationDefectsChart(props: { applications: ApplicationAggregate[] }) {
  const items = [...props.applications]
    .sort((left, right) => right.defects - left.defects || right.regressions - left.regressions)
    .slice(0, 8);
  const peak = Math.max(...items.map((application) => application.defects), 1);

  return (
    <div className={`overflow-hidden rounded-[20px] border p-5 ${css.chartContainer}`}>
      <div className="mb-4 flex flex-col gap-2 border-b border-[rgba(15,23,42,0.06)] pb-4 dark:border-slate-700/30">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgba(8,32,77,0.48)] dark:text-slate-400">Concentração de defeitos</div>
        <div className="text-sm text-[rgba(8,32,77,0.66)] dark:text-slate-400">Onde os defeitos estão se acumulando dentro do recorte filtrado.</div>
      </div>

      <div className="space-y-4">
        {items.map((application) => {
          const width = application.defects > 0 ? Math.max((application.defects / peak) * 100, 8) : 0;

          return (
            <div key={application.key}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-(--tc-text,#0b1a3c)">{application.label}</div>
                  <div className="mt-1 text-[11px] text-(--tc-text-muted,#6b7280)">
                    {application.runs} run(s) • {application.regressions} regressão(ões)
                  </div>
                </div>
                <div className="shrink-0 text-sm font-bold text-(--tc-text,#0b1a3c)">{formatCompactNumber(application.defects)}</div>
              </div>
              <div className={`mt-2 h-2.5 rounded-full ${css.barTrack}`}>
                <div
                  className={`h-full rounded-full bg-[linear-gradient(90deg,rgba(1,24,72,0.92)_0%,rgba(239,0,1,0.95)_100%)] shadow-[0_8px_16px_rgba(239,0,1,0.12)] ${css.barWidth}`}
                  {...{ style: { '--bar-w': `${width}%` } as React.CSSProperties }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  hint?: string;
  disabled?: boolean;
}) {
  const selectedOption = props.options.find((option) => option.value === props.value);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-(--tc-text-muted,#6b7280)">{props.label}</span>
      <Select value={props.value} onValueChange={props.onChange} disabled={props.disabled}>
        <SelectTrigger className={`h-10.5 rounded-2xl border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3.5 py-2 text-[15px] font-semibold text-(--tc-text,#0b1a3c) shadow-none focus-visible:ring-[rgba(36,82,149,0.16)] data-placeholder:text-(--tc-text-muted,#6b7280) dark:border-(--tc-border,#334155) dark:bg-(--tc-surface,#0f172a) ${props.disabled ? "cursor-not-allowed opacity-55" : ""}`}>
          <SelectValue aria-label={selectedOption?.label}>{selectedOption?.label ?? "Selecionar"}</SelectValue>
        </SelectTrigger>
        <SelectContent className="w-(--radix-select-trigger-width) rounded-[18px] border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) shadow-[0_18px_38px_rgba(1,24,72,0.12)] dark:border-(--tc-border,#334155) dark:bg-(--tc-surface,#0f172a)">
          {props.options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="rounded-xl py-2.5 pl-9 pr-3 text-[14px] font-medium text-(--tc-text,#0b1a3c) focus:bg-(--tc-surface-2,#eef4ff) focus:text-(--tc-text,#0b1a3c)"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {props.hint ? <span className="pl-1 text-[11px] leading-4 text-(--tc-text-muted,#6b7280)">{props.hint}</span> : null}
    </label>
  );
}

function ToggleChip(props: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold tracking-[0.03em] transition ${props.active ? "border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text,#0b1a3c) shadow-[0_4px_10px_rgba(1,24,72,0.08)] dark:border-(--tc-border,#334155) dark:bg-(--tc-surface,#0f172a)" : "border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) text-(--tc-text-muted,#6b7280) dark:border-(--tc-border,#334155) dark:bg-(--tc-surface-2,#1e293b)"}`}
    >
      {props.label}
    </button>
  );
}

function ResultViewButton(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`inline-flex items-center rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
        props.active
          ? "border-transparent bg-(--tc-primary,#0b1a3c) text-white dark:bg-(--tc-primary,#245295)"
          : "border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text,#0b1a3c) dark:border-(--tc-border,#334155) dark:bg-(--tc-surface,#0f172a)"
      }`}
    >
      {props.label}
    </button>
  );
}

function areFilterStatesEqual(left: DashboardFilterState | null, right: DashboardFilterState | null) {
  if (!left || !right) return false;
  return (
    left.periodPreset === right.periodPreset &&
    left.groupBy === right.groupBy &&
    left.chartView === right.chartView &&
    left.applicationFilter === right.applicationFilter &&
    left.runFilter === right.runFilter &&
    left.statusFilter === right.statusFilter &&
    left.environmentFilter === right.environmentFilter &&
    left.sourceFilter === right.sourceFilter &&
    left.responsibleFilter === right.responsibleFilter &&
    left.riskFilter === right.riskFilter &&
    left.compareEnabled === right.compareEnabled &&
    left.onlyWithDefects === right.onlyWithDefects &&
    left.onlyRegression === right.onlyRegression &&
    left.dateFrom === right.dateFrom &&
    left.dateTo === right.dateTo
  );
}

function buildFilterChipList(
  filters: DashboardFilterState,
  filterOptions: {
    applications: Array<{ key: string; label: string }>;
    runs: Array<{ key: string; label: string }>;
    environments: string[];
    statuses?: Array<{ value: string; label: string }>;
  },
) {
  const chips: string[] = [];
  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === filters.periodPreset)?.label ?? filters.periodPreset;
  chips.push(periodLabel);
  if (filters.applicationFilter !== "all") {
    chips.push(filterOptions.applications.find((option) => option.key === filters.applicationFilter)?.label ?? filters.applicationFilter);
  }
  if (filters.runFilter !== "all") {
    chips.push(filterOptions.runs.find((option) => option.key === filters.runFilter)?.label ?? filters.runFilter);
  }
  if (filters.environmentFilter !== "all" && filterOptions.environments.length > 1) {
    chips.push(`Ambiente ${filters.environmentFilter}`);
  }
  if (filters.sourceFilter !== "all") chips.push(filters.sourceFilter === "manual" ? "Somente manual" : "Somente integração");
  if (filters.responsibleFilter !== "all") chips.push(`Responsável ${filters.responsibleFilter}`);
  if (filters.riskFilter !== "all") chips.push(filters.riskFilter === "critical" ? "Risco crítico" : filters.riskFilter === "warning" ? "Em atenção" : "Estável");
  if (filters.statusFilter !== "all") {
    chips.push(
      filters.statusFilter === "completed"
        ? "Concluídas"
        : filters.statusFilter === "in_progress"
          ? "Em andamento"
          : filters.statusFilter === "risk"
            ? "Com risco"
            : "Com bloqueio",
    );
  }
  if (filters.onlyWithDefects) chips.push("Com defeitos");
  if (filters.onlyRegression) chips.push("Com regressão");
  if (isTimeChartView(filters.chartView) && filters.groupBy !== "month") {
    chips.push(`Agrupado por ${GROUP_OPTIONS.find((option) => option.value === filters.groupBy)?.label ?? filters.groupBy}`);
  }
  return chips;
}

function buildResolvedFilterChipList(
  filters: DashboardFilterState,
  filterOptions: {
    applications: Array<{ key: string; label: string }>;
    runs: Array<{ key: string; label: string }>;
    environments: string[];
    statuses?: Array<{ value: string; label: string }>;
  },
) {
  const chips: string[] = [];
  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === filters.periodPreset)?.label ?? filters.periodPreset;
  chips.push(periodLabel);
  if (filters.applicationFilter !== "all") {
    chips.push(filterOptions.applications.find((option) => option.key === filters.applicationFilter)?.label ?? filters.applicationFilter);
  }
  if (filters.runFilter !== "all") {
    chips.push(filterOptions.runs.find((option) => option.key === filters.runFilter)?.label ?? filters.runFilter);
  }
  if (filters.environmentFilter !== "all" && filterOptions.environments.length > 1) {
    chips.push(`Ambiente ${filters.environmentFilter}`);
  }
  if (filters.sourceFilter !== "all") chips.push(filters.sourceFilter === "manual" ? "Somente manual" : "Somente integração");
  if (filters.responsibleFilter !== "all") chips.push(`Responsável ${filters.responsibleFilter}`);
  if (filters.riskFilter !== "all") chips.push(filters.riskFilter === "critical" ? "Risco crítico" : filters.riskFilter === "warning" ? "Em atenção" : "Estável");
  if (filters.statusFilter !== STATUS_FILTER_ALL) {
    chips.push(filterOptions.statuses?.find((option) => option.value === filters.statusFilter)?.label ?? filters.statusFilter);
  }
  if (filters.onlyWithDefects) chips.push("Com defeitos");
  if (filters.onlyRegression) chips.push("Com regressão");
  if (isTimeChartView(filters.chartView) && filters.groupBy !== "month") {
    chips.push(`Agrupado por ${GROUP_OPTIONS.find((option) => option.value === filters.groupBy)?.label ?? filters.groupBy}`);
  }
  return chips;
}

export default function CompanyIntelligenceDashboardClient(props: CompanyDashboardData) {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>(DEFAULT_FILTERS.periodPreset);
  const [groupBy, setGroupBy] = useState<GroupBy>(DEFAULT_FILTERS.groupBy);
  const [chartView, setChartView] = useState<ChartView>(DEFAULT_FILTERS.chartView);
  const [applicationFilter, setApplicationFilter] = useState<string>(DEFAULT_FILTERS.applicationFilter);
  const [runFilter, setRunFilter] = useState<string>(DEFAULT_FILTERS.runFilter);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(DEFAULT_FILTERS.statusFilter);
  const [environmentFilter, setEnvironmentFilter] = useState<string>(DEFAULT_FILTERS.environmentFilter);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(DEFAULT_FILTERS.sourceFilter);
  const [responsibleFilter, setResponsibleFilter] = useState<string>(DEFAULT_FILTERS.responsibleFilter);
  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>(DEFAULT_FILTERS.riskFilter);
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [onlyWithDefects, setOnlyWithDefects] = useState(false);
  const [onlyRegression, setOnlyRegression] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilterState | null>(DEFAULT_FILTERS);
  const [activeView, setActiveView] = useState<ResultView>("overview");
  const resultsRef = useRef<HTMLDivElement>(null);

  const currentDraftFilters = useMemo<DashboardFilterState>(
    () => ({
      periodPreset,
      groupBy,
      chartView,
      applicationFilter,
      runFilter,
      statusFilter,
      environmentFilter,
      sourceFilter,
      responsibleFilter,
      riskFilter,
      compareEnabled,
      onlyWithDefects,
      onlyRegression,
      dateFrom,
      dateTo,
    }),
    [
      periodPreset,
      groupBy,
      chartView,
      applicationFilter,
      runFilter,
      statusFilter,
      environmentFilter,
      sourceFilter,
      responsibleFilter,
      riskFilter,
      compareEnabled,
      onlyWithDefects,
      onlyRegression,
      dateFrom,
      dateTo,
    ],
  );
  const draftRanges = useMemo(() => resolveRange(periodPreset, dateFrom, dateTo), [periodPreset, dateFrom, dateTo]);

  const analysisRequested = appliedFilters !== null;
  const hasPendingFilterChanges = !analysisRequested || !areFilterStatesEqual(currentDraftFilters, appliedFilters);
  const activeFilters = appliedFilters ?? DEFAULT_FILTERS;
  const activePeriodPreset = activeFilters.periodPreset;
  const activeGroupBy = activeFilters.groupBy;
  const activeChartView = activeFilters.chartView;
  const activeApplicationFilter = activeFilters.applicationFilter;
  const activeRunFilter = activeFilters.runFilter;
  const activeStatusFilter = activeFilters.statusFilter;
  const activeEnvironmentFilter = activeFilters.environmentFilter;
  const activeSourceFilter = activeFilters.sourceFilter;
  const activeResponsibleFilter = activeFilters.responsibleFilter;
  const activeRiskFilter = activeFilters.riskFilter;
  const activeCompareEnabled = activeFilters.compareEnabled;
  const activeOnlyWithDefects = activeFilters.onlyWithDefects;
  const activeOnlyRegression = activeFilters.onlyRegression;
  const activeDateFrom = activeFilters.dateFrom;
  const activeDateTo = activeFilters.dateTo;

  const ranges = useMemo(() => resolveRange(activePeriodPreset, activeDateFrom, activeDateTo), [activePeriodPreset, activeDateFrom, activeDateTo]);
  const previousRange = useMemo(() => (activeCompareEnabled ? buildPreviousRange(ranges) : null), [activeCompareEnabled, ranges]);

  const enrichedRuns = useMemo<EnrichedRun[]>(() => {
    const directDefects = new Map<string, number>();
    const appDefects = new Map<string, number>();

    for (const defect of props.defects) {
      if (defect.runSlug) {
        directDefects.set(defect.runSlug, (directDefects.get(defect.runSlug) ?? 0) + 1);
      }
      appDefects.set(defect.applicationKey, (appDefects.get(defect.applicationKey) ?? 0) + 1);
    }

    const sequenceByApp = new Map<string, EnrichedRun[]>();
    const baseRuns = [...props.runs]
      .map((run) => {
        const time = Math.max(toTimestamp(run.updatedAt), toTimestamp(run.createdAt));
        const total = Math.max(run.stats.total, 1);
        const passRate = run.stats.passRate ?? (run.stats.pass / total) * 100;
        const failRate = (run.stats.fail / total) * 100;
        const directDefectCount = directDefects.get(run.slug) ?? 0;
        const appDefectCount = appDefects.get(run.applicationKey) ?? 0;
        return {
          ...run,
          time,
          passRate,
          failRate,
          directDefectCount,
          appDefectCount,
          deltaPassRate: null,
          deltaFailCount: null,
          isRegression: false,
          riskLevel: determineRunRisk(run, directDefectCount),
        } as EnrichedRun;
      })
      .sort((left, right) => left.time - right.time);

    for (const run of baseRuns) {
      const list = sequenceByApp.get(run.applicationKey) ?? [];
      const previous = list.at(-1) ?? null;
      run.deltaPassRate = previous ? run.passRate - previous.passRate : null;
      run.deltaFailCount = previous ? run.stats.fail - previous.stats.fail : null;
      run.isRegression = Boolean(
        previous &&
        ((run.deltaPassRate ?? 0) <= -5 || (run.deltaFailCount ?? 0) >= 2 || run.directDefectCount > previous.directDefectCount),
      );
      list.push(run);
      sequenceByApp.set(run.applicationKey, list);
    }

    return baseRuns.sort((left, right) => right.time - left.time);
  }, [props.defects, props.runs]);

  const filterOptions = useMemo(() => {
    const appMap = new Map<string, { key: string; label: string }>();
    // Start with run-derived applications (authoritative keys)
    for (const run of enrichedRuns) {
      appMap.set(run.applicationKey, { key: run.applicationKey, label: run.applicationName });
    }
    // Add all registered applications not already covered by a run-derived key
    for (const app of props.applications ?? []) {
      const key = app.slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      if (!key || appMap.has(key)) continue;
      appMap.set(key, { key, label: app.name });
    }
    const applications = Array.from(appMap.values());
    const runs = enrichedRuns.map((run) => ({ key: run.slug, label: run.title }));
    const statuses = buildStatusOptions(enrichedRuns);
    const environments = Array.from(new Set(enrichedRuns.flatMap((run) => run.environments))).sort();
    const runResponsibles = enrichedRuns.flatMap((run) => parseCommaList(run.responsibleLabel));
    const memberNames = (props.companyMembers ?? []).map((m) => m.name);
    const responsibles = Array.from(new Set([...runResponsibles, ...memberNames])).sort();
    return { applications, runs, statuses, environments, responsibles };
  }, [enrichedRuns, props.companyMembers, props.applications]);

  const draftFilterOptions = useMemo(() => {
    const matchesDraftRun = (run: EnrichedRun, ignore?: ContextualFilterKey) => {
      if (!withinRange(run.time, draftRanges.start, draftRanges.end)) return false;
      if (ignore !== "applicationFilter" && applicationFilter !== "all" && run.applicationKey !== applicationFilter) return false;
      if (ignore !== "runFilter" && runFilter !== "all" && run.slug !== runFilter) return false;
      if (sourceFilter !== "all" && run.sourceType !== sourceFilter) return false;
      if (ignore !== "environmentFilter" && environmentFilter !== "all" && !run.environments.includes(environmentFilter)) return false;
      if (ignore !== "responsibleFilter" && responsibleFilter !== "all" && !parseCommaList(run.responsibleLabel).includes(responsibleFilter)) return false;
      if (riskFilter !== "all" && run.riskLevel !== riskFilter) return false;
      if (ignore !== "statusFilter" && !matchesStatusFilter(run, statusFilter)) return false;
      if (onlyWithDefects && run.directDefectCount < 1) return false;
      if (onlyRegression && !run.isRegression) return false;
      return true;
    };

    const appMap = new Map<string, { key: string; label: string }>();
    for (const run of enrichedRuns) {
      appMap.set(run.applicationKey, { key: run.applicationKey, label: run.applicationName });
    }
    const draftRunProjectCodes = new Set(
      enrichedRuns.map((run) => run.projectCode?.trim().toUpperCase()).filter(Boolean),
    );
    for (const app of props.applications ?? []) {
      const key = app.slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const code = app.qaseProjectCode?.trim().toUpperCase();
      if (!key || appMap.has(key) || (code && draftRunProjectCodes.has(code))) continue;
      appMap.set(key, { key, label: app.name });
    }
    const applications = Array.from(appMap.values());
    const runs = enrichedRuns
      .filter((run) => matchesDraftRun(run, "runFilter"))
      .map((run) => ({ key: run.slug, label: run.title }));
    const statuses = buildStatusOptions(
      enrichedRuns.filter((run) => matchesDraftRun(run, "statusFilter")),
    );
    const environments = Array.from(
      new Set(
        enrichedRuns
          .filter((run) => matchesDraftRun(run, "environmentFilter"))
          .flatMap((run) => run.environments),
      ),
    ).sort();
    const responsibles = Array.from(
      new Set(
        enrichedRuns
          .filter((run) => matchesDraftRun(run, "responsibleFilter"))
          .flatMap((run) => parseCommaList(run.responsibleLabel)),
      ),
    ).sort();

    return { applications, runs, statuses, environments, responsibles };
  }, [
    enrichedRuns,
    draftRanges,
    applicationFilter,
    runFilter,
    sourceFilter,
    environmentFilter,
    responsibleFilter,
    riskFilter,
    statusFilter,
    onlyWithDefects,
    onlyRegression,
    props.applications,
  ]);
  const hasMultipleEnvironments = filterOptions.environments.length > 1;

  useEffect(() => {
    if (applicationFilter !== "all" && !filterOptions.applications.some((option) => option.key === applicationFilter)) {
      setApplicationFilter("all");
    }
  }, [applicationFilter, filterOptions.applications]);

  useEffect(() => {
    if (runFilter !== "all" && !draftFilterOptions.runs.some((option) => option.key === runFilter)) {
      setRunFilter("all");
    }
  }, [runFilter, draftFilterOptions.runs]);

  useEffect(() => {
    if (
      environmentFilter !== "all" &&
      (draftFilterOptions.environments.length <= 1 || !draftFilterOptions.environments.includes(environmentFilter))
    ) {
      setEnvironmentFilter("all");
    }
  }, [environmentFilter, draftFilterOptions.environments]);

  useEffect(() => {
    if (responsibleFilter !== "all" && !draftFilterOptions.responsibles.includes(responsibleFilter)) {
      setResponsibleFilter("all");
    }
  }, [responsibleFilter, draftFilterOptions.responsibles]);

  useEffect(() => {
    if (statusFilter !== STATUS_FILTER_ALL && !draftFilterOptions.statuses.some((option) => option.value === statusFilter)) {
      setStatusFilter(STATUS_FILTER_ALL);
    }
  }, [statusFilter, draftFilterOptions.statuses]);

  const filteredRuns = useMemo(
    () =>
      enrichedRuns.filter((run) => {
        if (ranges && !withinRange(run.time, ranges.start, ranges.end)) return false;
        if (activeApplicationFilter !== "all" && run.applicationKey !== activeApplicationFilter) return false;
        if (activeRunFilter !== "all" && run.slug !== activeRunFilter) return false;
        if (activeSourceFilter !== "all" && run.sourceType !== activeSourceFilter) return false;
        if (hasMultipleEnvironments && activeEnvironmentFilter !== "all" && !run.environments.includes(activeEnvironmentFilter)) return false;
        if (activeResponsibleFilter !== "all" && !parseCommaList(run.responsibleLabel).includes(activeResponsibleFilter)) return false;
        if (activeRiskFilter !== "all" && run.riskLevel !== activeRiskFilter) return false;
        if (!matchesStatusFilter(run, activeStatusFilter)) return false;
        if (activeOnlyWithDefects && run.directDefectCount < 1) return false;
        if (activeOnlyRegression && !run.isRegression) return false;
        return true;
      }),
    [
      enrichedRuns,
      ranges,
      activeApplicationFilter,
      activeRunFilter,
      activeSourceFilter,
      activeEnvironmentFilter,
      hasMultipleEnvironments,
      activeResponsibleFilter,
      activeRiskFilter,
      activeStatusFilter,
      activeOnlyWithDefects,
      activeOnlyRegression,
    ],
  );

  const previousRuns = useMemo(
    () =>
      previousRange
        ? enrichedRuns.filter((run) => {
            if (!withinRange(run.time, previousRange.start, previousRange.end)) return false;
            if (activeApplicationFilter !== "all" && run.applicationKey !== activeApplicationFilter) return false;
            if (activeRunFilter !== "all" && run.slug !== activeRunFilter) return false;
            if (activeSourceFilter !== "all" && run.sourceType !== activeSourceFilter) return false;
            if (hasMultipleEnvironments && activeEnvironmentFilter !== "all" && !run.environments.includes(activeEnvironmentFilter)) return false;
            if (activeResponsibleFilter !== "all" && !parseCommaList(run.responsibleLabel).includes(activeResponsibleFilter)) return false;
            if (activeRiskFilter !== "all" && run.riskLevel !== activeRiskFilter) return false;
            if (!matchesStatusFilter(run, activeStatusFilter)) return false;
            if (activeOnlyWithDefects && run.directDefectCount < 1) return false;
            if (activeOnlyRegression && !run.isRegression) return false;
            return true;
          })
        : [],
    [
      enrichedRuns,
      previousRange,
      activeApplicationFilter,
      activeRunFilter,
      activeSourceFilter,
      activeEnvironmentFilter,
      hasMultipleEnvironments,
      activeResponsibleFilter,
      activeRiskFilter,
      activeStatusFilter,
      activeOnlyWithDefects,
      activeOnlyRegression,
    ],
  );

  const filteredDefects = useMemo(() => {
    if (activeSourceFilter === "integration") return [];
    const runSlugs = new Set(filteredRuns.map((run) => run.slug));
    const applicationKeys = new Set(
      (filteredRuns.length > 0 ? filteredRuns : enrichedRuns).map((run) => run.applicationKey),
    );

    return props.defects.filter((defect) => {
      const time = Math.max(toTimestamp(defect.updatedAt), toTimestamp(defect.createdAt));
      if (!withinRange(time, ranges.start, ranges.end)) return false;
      if (activeApplicationFilter !== "all" && defect.applicationKey !== activeApplicationFilter) return false;
      if (activeRunFilter !== "all" && defect.runSlug !== activeRunFilter) return false;
      if (hasMultipleEnvironments && activeEnvironmentFilter !== "all" && !defect.environments.includes(activeEnvironmentFilter)) return false;
      if (defect.runSlug) return runSlugs.has(defect.runSlug);
      return applicationKeys.has(defect.applicationKey);
    });
  }, [props.defects, filteredRuns, enrichedRuns, ranges, activeApplicationFilter, activeRunFilter, activeEnvironmentFilter, hasMultipleEnvironments, activeSourceFilter]);

  const previousDefects = useMemo(() => {
    if (!previousRange || activeSourceFilter === "integration") return [];
    const runSlugs = new Set(previousRuns.map((run) => run.slug));
    const applicationKeys = new Set(
      (previousRuns.length > 0 ? previousRuns : enrichedRuns).map((run) => run.applicationKey),
    );

    return props.defects.filter((defect) => {
      const time = Math.max(toTimestamp(defect.updatedAt), toTimestamp(defect.createdAt));
      if (!withinRange(time, previousRange.start, previousRange.end)) return false;
      if (activeApplicationFilter !== "all" && defect.applicationKey !== activeApplicationFilter) return false;
      if (activeRunFilter !== "all" && defect.runSlug !== activeRunFilter) return false;
      if (hasMultipleEnvironments && activeEnvironmentFilter !== "all" && !defect.environments.includes(activeEnvironmentFilter)) return false;
      if (defect.runSlug) return runSlugs.has(defect.runSlug);
      return applicationKeys.has(defect.applicationKey);
    });
  }, [props.defects, previousRuns, enrichedRuns, previousRange, activeApplicationFilter, activeRunFilter, activeEnvironmentFilter, hasMultipleEnvironments, activeSourceFilter]);

  const executiveSummary = useMemo(
    () => summarizeRuns(filteredRuns, filteredDefects),
    [filteredRuns, filteredDefects],
  );

  const previousSummary = useMemo(
    () => summarizeRuns(previousRuns, previousDefects),
    [previousRuns, previousDefects],
  );

  const series = useMemo(
    () => buildSeries(filteredRuns, filteredDefects, activeGroupBy),
    [filteredRuns, filteredDefects, activeGroupBy],
  );

  const chartPoints = useMemo(() => series.slice(-12), [series]);

  const applicationRanking = useMemo<ApplicationAggregate[]>(() => {
    const map = new Map<string, ApplicationAggregate>();

    for (const run of filteredRuns) {
      const current = map.get(run.applicationKey) ?? {
        key: run.applicationKey,
        label: run.applicationName,
        runs: 0,
        totalCases: 0,
        passRate: 0,
        failRate: 0,
        blocked: 0,
        defects: 0,
        regressions: 0,
        riskLevel: "stable" as RiskLevel,
      };
      current.runs += 1;
      current.totalCases += run.stats.total;
      current.blocked += run.stats.blocked;
      if (run.isRegression) current.regressions += 1;
      current.defects += run.directDefectCount;
      map.set(run.applicationKey, current);
    }

    for (const defect of filteredDefects) {
      const current = map.get(defect.applicationKey);
      if (current) current.defects += defect.runSlug ? 0 : 1;
    }

    for (const [key, aggregate] of map.entries()) {
      const appRuns = filteredRuns.filter((run) => run.applicationKey === key);
      const totalCases = appRuns.reduce((sum, run) => sum + run.stats.total, 0);
      const totalPass = appRuns.reduce((sum, run) => sum + run.stats.pass, 0);
      const totalFail = appRuns.reduce((sum, run) => sum + run.stats.fail, 0);
      aggregate.passRate = totalCases > 0 ? (totalPass / totalCases) * 100 : 0;
      aggregate.failRate = totalCases > 0 ? (totalFail / totalCases) * 100 : 0;
      if (aggregate.failRate >= 15 || aggregate.defects >= 4 || aggregate.regressions >= 2) aggregate.riskLevel = "critical";
      else if (aggregate.failRate > 0 || aggregate.defects > 0 || aggregate.regressions > 0 || aggregate.blocked > 0) aggregate.riskLevel = "warning";
      else aggregate.riskLevel = "stable";
    }

    return Array.from(map.values()).sort((left, right) => {
      if (riskWeight(left.riskLevel) !== riskWeight(right.riskLevel)) {
        return riskWeight(right.riskLevel) - riskWeight(left.riskLevel);
      }
      if (right.defects !== left.defects) return right.defects - left.defects;
      if (right.failRate !== left.failRate) return right.failRate - left.failRate;
      return left.passRate - right.passRate;
    });
  }, [filteredRuns, filteredDefects]);

  const riskRuns = useMemo(
    () =>
      [...filteredRuns]
        .filter((run) => run.riskLevel !== "stable")
        .sort((left, right) => {
          if (riskWeight(left.riskLevel) !== riskWeight(right.riskLevel)) {
            return riskWeight(right.riskLevel) - riskWeight(left.riskLevel);
          }
          if ((right.deltaFailCount ?? 0) !== (left.deltaFailCount ?? 0)) {
            return (right.deltaFailCount ?? 0) - (left.deltaFailCount ?? 0);
          }
          return left.passRate - right.passRate;
        }),
    [filteredRuns],
  );

  const relevantAlerts = useMemo(
    () =>
      props.alerts
        .filter((alert) => {
          const time = toTimestamp(alert.timestamp);
          if (ranges.start == null || ranges.end == null) return true;
          return withinRange(time, ranges.start, ranges.end);
        })
        .slice(0, 4),
    [props.alerts, ranges],
  );

  const topApplication = applicationRanking[0] ?? null;
  const worstRegression = useMemo(
    () =>
      [...filteredRuns]
        .filter((run) => run.isRegression)
        .sort((left, right) => (left.deltaPassRate ?? 0) - (right.deltaPassRate ?? 0))[0] ?? null,
    [filteredRuns],
  );

  const topRiskRun = riskRuns[0] ?? null;
  const recurringProblem = useMemo(() => {
    if (!topApplication) return false;
    return topApplication.regressions >= 2 || topApplication.defects >= 4 || riskRuns.filter((run) => run.applicationKey === topApplication.key).length >= 2;
  }, [topApplication, riskRuns]);

  const trendSummary = useMemo(() => {
    const delta = executiveSummary.passRate - previousSummary.passRate;
    if (!activeCompareEnabled || previousSummary.totalRuns === 0) {
      if (executiveSummary.passRate >= 92) return { label: "Saúde forte", tone: "positive" as const };
      if (executiveSummary.passRate >= 80) return { label: "Atenção moderada", tone: "warning" as const };
      return { label: "Risco elevado", tone: "critical" as const };
    }
    if (delta >= 2) return { label: "Melhorou", tone: "positive" as const };
    if (delta <= -2) return { label: "Piorou", tone: "critical" as const };
    return { label: "Estável", tone: "neutral" as const };
  }, [activeCompareEnabled, executiveSummary.passRate, previousSummary.passRate, previousSummary.totalRuns]);

  const syncDraftFilters = (next: DashboardFilterState) => {
    setPeriodPreset(next.periodPreset);
    setGroupBy(next.groupBy);
    setChartView(next.chartView);
    setApplicationFilter(next.applicationFilter);
    setRunFilter(next.runFilter);
    setStatusFilter(next.statusFilter);
    setEnvironmentFilter(next.environmentFilter);
    setSourceFilter(next.sourceFilter);
    setResponsibleFilter(next.responsibleFilter);
    setRiskFilter(next.riskFilter);
    setCompareEnabled(next.compareEnabled);
    setOnlyWithDefects(next.onlyWithDefects);
    setOnlyRegression(next.onlyRegression);
    setDateFrom(next.dateFrom);
    setDateTo(next.dateTo);
  };

  const applyAnalysis = (next: DashboardFilterState = currentDraftFilters) => {
    syncDraftFilters(next);
    setAppliedFilters(next);
    setActiveView("overview");
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const resetFilters = () => {
    syncDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(null);
    setActiveView("overview");
  };

  async function handleExportPdf() {
    try {
      setExportingPdf(true);
      const [{ jsPDF }, logoDataUrl] = await Promise.all([import("jspdf"), getTestingLogoDataUrl()]);
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 42;
      const maxWidth = pageWidth - marginX * 2;
      const bottomLimit = pageHeight - 46;
      let cursorY = 42;

      const ensureSpace = (required = 24) => {
        if (cursorY + required <= bottomLimit) return;
        doc.addPage();
        cursorY = 42;
      };

      const writeLine = (text: string, options?: { size?: number; weight?: "normal" | "bold"; color?: [number, number, number]; indent?: number; gapAfter?: number }) => {
        const size = options?.size ?? 10;
        const indent = options?.indent ?? 0;
        const gapAfter = options?.gapAfter ?? 8;
        const color = options?.color ?? [11, 26, 60];
        doc.setFont("helvetica", options?.weight ?? "normal");
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        const lines = doc.splitTextToSize(text, maxWidth - indent);
        ensureSpace(lines.length * (size + 3) + gapAfter);
        doc.text(lines, marginX + indent, cursorY);
        cursorY += lines.length * (size + 3) + gapAfter;
      };

      const writeDivider = () => {
        ensureSpace(14);
        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
        cursorY += 14;
      };

      const writeBulletList = (items: string[]) => {
        for (const item of items) {
          writeLine(`- ${item}`, { size: 10, color: [75, 85, 99], gapAfter: 6 });
        }
      };

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", marginX, cursorY - 4, 28, 28);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(1, 24, 72);
      doc.text("Testing Company", marginX + 38, cursorY + 8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(93, 105, 128);
      doc.text("Desktopboard | Exportação filtrada", marginX + 38, cursorY + 24);
      cursorY += 48;

      writeLine(`Empresa: ${props.companyName}`, { size: 18, weight: "bold", color: [11, 26, 60], gapAfter: 10 });
      writeLine(`Exportado em ${formatDateTime(new Date().toISOString())}`, { size: 10, color: [93, 105, 128], gapAfter: 4 });
      writeLine(`Recorte atual: ${activeFilterChips.join(" | ")}`, { size: 10, color: [93, 105, 128], gapAfter: 12 });
      writeDivider();

      writeLine("Resumo executivo", { size: 14, weight: "bold", color: [11, 26, 60], gapAfter: 10 });
      writeBulletList([
        `Runs no período: ${formatCompactNumber(executiveSummary.totalRuns)}`,
        `Pass rate médio: ${formatPercent(executiveSummary.passRate)}`,
        `Taxa de falha: ${formatPercent(executiveSummary.failRate)}`,
        `Defeitos vinculados: ${formatCompactNumber(executiveSummary.defects)}`,
        `Aplicações em risco: ${formatCompactNumber(executiveSummary.applicationsAtRisk)}`,
        `Melhor run: ${executiveSummary.bestRun?.title ?? "Sem referência"}`,
        `Run crítica: ${executiveSummary.worstRun?.title ?? "Nenhuma crítica"}`,
        `Tendência: ${trendSummary.label}`,
      ]);
      writeDivider();

      writeLine("Perguntas respondidas pelo filtro", { size: 14, weight: "bold", color: [11, 26, 60], gapAfter: 10 });
      for (const answer of overviewAnswers) {
        writeLine(answer.label, { size: 11, weight: "bold", color: [11, 26, 60], gapAfter: 4 });
        writeLine(`${answer.value}. ${answer.detail}`, { size: 10, color: [75, 85, 99], indent: 10, gapAfter: 8 });
      }
      writeDivider();

      writeLine("Insights automáticos", { size: 14, weight: "bold", color: [11, 26, 60], gapAfter: 10 });
      if (insights.length > 0) {
        for (const insight of insights) {
          writeLine(insight.title, { size: 11, weight: "bold", color: [11, 26, 60], gapAfter: 4 });
          writeLine(insight.detail, { size: 10, color: [75, 85, 99], indent: 10, gapAfter: 8 });
        }
      } else {
        writeLine("Sem massa suficiente para gerar insights automáticos no recorte atual.", { size: 10, color: [75, 85, 99], gapAfter: 8 });
      }
      writeDivider();

      writeLine("Saúde por aplicação", { size: 14, weight: "bold", color: [11, 26, 60], gapAfter: 10 });
      if (applicationRanking.length > 0) {
        applicationRanking.forEach((aggregate, index) => {
          writeLine(`${index + 1}. ${aggregate.label}`, { size: 11, weight: "bold", color: [11, 26, 60], gapAfter: 4 });
          writeLine(
            `${aggregate.runs} run(s) | pass ${formatPercent(aggregate.passRate)} | falha ${formatPercent(aggregate.failRate)} | defeitos ${aggregate.defects} | regressão(ões) ${aggregate.regressions} | risco ${aggregate.riskLevel}`,
            { size: 10, color: [75, 85, 99], indent: 10, gapAfter: 8 },
          );
        });
      } else {
        writeLine("Sem aplicações suficientes no recorte atual.", { size: 10, color: [75, 85, 99], gapAfter: 8 });
      }
      writeDivider();

      writeLine("Runs filtradas", { size: 14, weight: "bold", color: [11, 26, 60], gapAfter: 10 });
      if (filteredRuns.length > 0) {
        filteredRuns.forEach((run, index) => {
          writeLine(`${index + 1}. ${run.title}`, { size: 11, weight: "bold", color: [11, 26, 60], gapAfter: 4 });
          writeLine(
            `${run.applicationName} | ${run.sourceType === "manual" ? "Manual" : `Integração${run.integrationProvider ? ` ${run.integrationProvider}` : ""}`} | status ${run.statusLabel} | pass ${formatPercent(run.passRate)} | falhas ${run.stats.fail} | bloqueios ${run.stats.blocked} | defeitos ${run.directDefectCount} | atualização ${formatDateTime(run.updatedAt ?? run.createdAt)}`,
            { size: 10, color: [75, 85, 99], indent: 10, gapAfter: 8 },
          );
        });
      } else {
        writeLine("Nenhuma run entrou no filtro atual.", { size: 10, color: [75, 85, 99], gapAfter: 8 });
      }
      writeDivider();

      writeLine("Defeitos e alertas do recorte", { size: 14, weight: "bold", color: [11, 26, 60], gapAfter: 10 });
      writeLine(`Defeitos relacionados: ${filteredDefects.length}`, { size: 10, color: [75, 85, 99], gapAfter: 6 });
      if (relevantAlerts.length > 0) {
        relevantAlerts.forEach((alert, index) => {
          writeLine(`${index + 1}. ${alert.message}`, { size: 10, color: [75, 85, 99], gapAfter: 4 });
          writeLine(`${alert.severity.toUpperCase()} | ${formatDateTime(alert.timestamp)}`, { size: 9, color: [120, 130, 150], indent: 10, gapAfter: 8 });
        });
      } else {
        writeLine("Nenhum alerta recente entrou no período filtrado.", { size: 10, color: [75, 85, 99], gapAfter: 8 });
      }

      doc.save(`desktopboard-${props.companySlug}-filtrado.pdf`);
    } finally {
      setExportingPdf(false);
    }
  }

  const overviewAnswers = useMemo(
    () => [
      {
        label: "Empresa melhorou ou piorou?",
        value: trendSummary.label,
        detail:
          activeCompareEnabled && previousSummary.totalRuns > 0
            ? `${buildDelta(executiveSummary.passRate, previousSummary.passRate, "higher_better", " p.p.").label}.`
            : `Pass rate médio em ${formatPercent(executiveSummary.passRate)} no recorte atual.`,
        tone: trendSummary.tone,
      },
      {
        label: "Aplicação puxando para baixo",
        value: topApplication ? topApplication.label : "Sem concentração clara",
        detail: topApplication
          ? `${formatPercent(topApplication.passRate)} de pass rate, ${topApplication.defects} defeitos e ${topApplication.regressions} regressão(ões).`
          : "Não há massa suficiente para destacar uma aplicação dominante.",
        tone: topApplication ? riskTone(topApplication.riskLevel) : "neutral",
      },
      {
        label: "Run com regressão",
        value: worstRegression ? worstRegression.title : "Sem regressão relevante",
        detail: worstRegression
          ? `${worstRegression.applicationName} caiu ${Math.abs(worstRegression.deltaPassRate ?? 0).toFixed(1)} p.p. em relação à execução anterior.`
          : "O recorte atual não mostra regressão relevante frente às execuções anteriores.",
        tone: worstRegression ? "critical" : "positive",
      },
      {
        label: "Onde está o risco",
        value: topRiskRun ? topRiskRun.applicationName : "Risco distribuído baixo",
        detail: topRiskRun
          ? `${topRiskRun.title} combina ${topRiskRun.stats.fail} falha(s), ${topRiskRun.stats.blocked} bloqueio(s) e ${topRiskRun.directDefectCount} defeito(s) direto(s).`
          : "Nenhuma run entrou no bloco crítico ou de atenção com o filtro atual.",
        tone: topRiskRun ? riskTone(topRiskRun.riskLevel) : "positive",
      },
    ],
    [
      trendSummary,
      activeCompareEnabled,
      previousSummary.totalRuns,
      executiveSummary.passRate,
      previousSummary.passRate,
      topApplication,
      worstRegression,
      topRiskRun,
    ],
  );

  const insights = useMemo<InsightItem[]>(() => {
    const items: InsightItem[] = [];

    if (activeCompareEnabled && previousSummary.totalRuns > 0) {
      const delta = executiveSummary.passRate - previousSummary.passRate;
      items.push({
        id: "trend",
        title: delta >= 2 ? "A qualidade melhorou no período." : delta <= -2 ? "A qualidade piorou no período." : "A qualidade ficou estável no período.",
        detail: `Pass rate médio atual em ${formatPercent(executiveSummary.passRate)} contra ${formatPercent(previousSummary.passRate)} no período anterior comparável.`,
        tone: delta >= 2 ? "positive" : delta <= -2 ? "critical" : "neutral",
      });
    }

    if (topApplication) {
      items.push({
        id: "app",
        title: `${topApplication.label} concentra a maior pressão de qualidade.`,
        detail: `${topApplication.defects} defeito(s), ${topApplication.regressions} regressão(ões) e ${formatPercent(topApplication.failRate)} de taxa de falha no recorte filtrado.`,
        tone: riskTone(topApplication.riskLevel),
      });
    }

    if (worstRegression) {
      items.push({
        id: "regression",
        title: `${worstRegression.title} foi a principal regressão observada.`,
        detail: `A execução caiu ${Math.abs(worstRegression.deltaPassRate ?? 0).toFixed(1)} p.p. e gerou ${worstRegression.directDefectCount} defeito(s) direto(s).`,
        tone: "critical",
      });
    }

    if (topRiskRun) {
      items.push({
        id: "risk",
        title: recurringProblem ? "O problema parece recorrente." : "O problema parece mais pontual.",
        detail: recurringProblem
          ? `${topRiskRun.applicationName} repete sinais de risco em mais de uma execução ou concentração de defeitos.`
          : `O maior risco atual está concentrado em ${topRiskRun.title}, sem repetição forte em outras execuções filtradas.`,
        tone: recurringProblem ? "warning" : "neutral",
      });
    }

    if (relevantAlerts[0]) {
      items.push({
        id: "alerts",
        title: "Alertas recentes reforçam o contexto do período.",
        detail: `${relevantAlerts[0].message} (${formatDateTime(relevantAlerts[0].timestamp)}).`,
        tone: relevantAlerts[0].severity === "critical" ? "critical" : "warning",
      });
    }

    return items.slice(0, 5);
  }, [
    activeCompareEnabled,
    executiveSummary.passRate,
    previousSummary.passRate,
    previousSummary.totalRuns,
    topApplication,
    worstRegression,
    topRiskRun,
    recurringProblem,
    relevantAlerts,
  ]);

  const draftFilterChips = useMemo(
    () => buildResolvedFilterChipList(currentDraftFilters, filterOptions),
    [currentDraftFilters, filterOptions],
  );

  const activeFilterChips = useMemo(
    () => buildResolvedFilterChipList(activeFilters, filterOptions),
    [activeFilters, filterOptions],
  );

  const hasFilterResults = filteredRuns.length > 0 || filteredDefects.length > 0;
  const showInsightPanel = insights.length > 0 || relevantAlerts.length > 0;
  const showEnvironmentFilter = draftFilterOptions.environments.length > 1;
  const showResponsibleFilter = filterOptions.responsibles.length > 0;
  const chartUsesGrouping = isTimeChartView(activeChartView);
  const activeChartLabel = CHART_VIEW_OPTIONS.find((option) => option.value === activeChartView)?.label ?? activeChartView;
  const chartPanelCopy = resolveChartPanelCopy(activeChartView);
  const activeGroupLabel = GROUP_OPTIONS.find((option) => option.value === activeGroupBy)?.label ?? activeGroupBy;
  const chartHasData =
    activeChartView === "applicationHealth" || activeChartView === "applicationDefects"
      ? applicationRanking.length > 0
      : chartPoints.length > 0;
  const compactDraftChips = draftFilterChips.slice(0, 4);
  const compactActiveChips = activeFilterChips.slice(0, 4);
  const hiddenDraftChipCount = Math.max(0, draftFilterChips.length - compactDraftChips.length);
  const hiddenActiveChipCount = Math.max(0, activeFilterChips.length - compactActiveChips.length);
  const resultSummaryLine = analysisRequested && hasFilterResults
    ? `Recorte atual: ${activeFilterChips[0] ?? "Filtro aplicado"} | ${filteredRuns.length} runs | ${filteredDefects.length} defeitos | ${applicationRanking.length} aplicações`
    : "Defina o recorte para gerar a leitura executiva.";

  return (
    <div className="relative isolate min-h-screen bg-(--page-bg,#f5f6fa) px-4 pb-6 pt-2 text-(--page-text,#0b1a3c) sm:px-6 sm:pb-7 sm:pt-3 lg:px-10 lg:pb-8 lg:pt-4">
      <div className="relative z-10 flex w-full max-w-none flex-col gap-4 2xl:gap-5">
        <section className="flex flex-col gap-2.5 border-b border-[rgba(15,23,42,0.08)] pb-3 dark:border-slate-700/30 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
              Dashboard {props.companyName}
            </div>
            <h1 className="mt-0.5 text-[clamp(1.55rem,1.9vw,1.95rem)] font-extrabold tracking-[-0.04em] text-(--tc-text,#0b1a3c)">
              Resumo executivo de qualidade
            </h1>
            <p className="mt-1.5 text-sm leading-5 text-(--tc-text-muted,#6b7280)">
              {resultSummaryLine}
            </p>
            {analysisRequested && hasFilterResults ? (
              <div className="mt-2.5 flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] ${toneClasses(trendSummary.tone)}`}>
                  {trendSummary.label}
                </span>
                {compactActiveChips.map((chip) => (
                  <span key={chip} className="inline-flex rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-(--tc-text,#0b1a3c)">
                    {chip}
                  </span>
                ))}
                {hiddenActiveChipCount > 0 ? (
                  <span className="inline-flex rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-(--tc-text,#0b1a3c)">
                    +{hiddenActiveChipCount}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-start gap-2 lg:justify-end lg:self-start">
            <Link
              href="../metrics"
              className="inline-flex h-10.5 items-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3.5 text-[14px] font-semibold text-(--tc-text,#0b1a3c) dark:border-(--tc-border,#334155) dark:bg-(--tc-surface,#0f172a)"
            >
              <FiLayers className="h-4 w-4" />
              Métricas
            </Link>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={!analysisRequested || !hasFilterResults || exportingPdf}
              className="inline-flex h-10.5 items-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3.5 text-[14px] font-semibold text-(--tc-text,#0b1a3c) disabled:cursor-not-allowed disabled:opacity-60 dark:border-(--tc-border,#334155) dark:bg-(--tc-surface,#0f172a)"
            >
              <FiDownload className="h-4 w-4" />
              {exportingPdf ? "Gerando PDF..." : "Exportar PDF"}
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(filteredRuns)}
              disabled={!analysisRequested || !hasFilterResults}
              className="inline-flex h-10.5 items-center gap-2 rounded-2xl bg-(--tc-primary,#0b1a3c) px-3.5 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiDownload className="h-4 w-4" />
              Exportar CSV
            </button>
          </div>
        </section>

        <Panel
          eyebrow="Filtros"
          title="Recorte analítico"
          description={analysisRequested && !hasPendingFilterChanges ? "Recorte aplicado." : undefined}
          variant="softGradient"
        >
          <div className="space-y-3.5">
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPeriodPreset(periodPreset === option.value ? "all" : option.value)}
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.03em] transition ${periodPreset === option.value ? "border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text,#0b1a3c) shadow-[0_4px_10px_rgba(1,24,72,0.08)]" : "border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) text-(--tc-text-muted,#6b7280)"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="grid gap-2.5 lg:grid-cols-3">
              <SelectField
                label="Aplicação"
                value={applicationFilter}
                onChange={setApplicationFilter}
                options={[{ value: "all", label: "Todas" }, ...filterOptions.applications.map((option) => ({ value: option.key, label: option.label }))]}
              />
              <SelectField
                label="Runs"
                value={runFilter}
                onChange={setRunFilter}
                options={[{ value: "all", label: "Todas" }, ...draftFilterOptions.runs.map((option) => ({ value: option.key, label: option.label }))]}
              />
              <SelectField
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[{ value: STATUS_FILTER_ALL, label: "Todos" }, ...draftFilterOptions.statuses]}
              />
            </div>

            <div className="grid gap-2.5 lg:grid-cols-4">
              <SelectField
                label="Origem"
                value={sourceFilter}
                onChange={(value) => setSourceFilter(value as SourceFilter)}
                options={[
                  { value: "all", label: "Todas" },
                  { value: "manual", label: "Manual" },
                  { value: "integration", label: "Integração" },
                ]}
              />
              {showEnvironmentFilter ? (
                <SelectField
                  label="Ambiente da execução"
                  value={environmentFilter}
                  onChange={setEnvironmentFilter}
                  options={[{ value: "all", label: "Todos" }, ...draftFilterOptions.environments.map((option) => ({ value: option, label: option }))]}
                />
              ) : null}
              {showResponsibleFilter ? (
                <SelectField
                  label="Responsável"
                  value={responsibleFilter}
                  onChange={setResponsibleFilter}
                  options={[{ value: "all", label: "Todos" }, ...draftFilterOptions.responsibles.map((option) => ({ value: option, label: option }))]}
                />
              ) : (
                <SelectField
                  label="Responsável"
                  value="all"
                  onChange={() => {}}
                  options={[{ value: "all", label: "Nenhum usuário vinculado" }]}
                  hint="Vincule usuários à empresa para filtrar por responsável."
                />
              )}
              <SelectField
                label="Risco"
                value={riskFilter}
                onChange={(value) => setRiskFilter(value as "all" | RiskLevel)}
                options={[
                  { value: "all", label: "Todos" },
                  { value: "critical", label: "Crítico" },
                  { value: "warning", label: "Atenção" },
                  { value: "stable", label: "Estável" },
                ]}
              />
              <SelectField
                label="Agrupamento"
                value={groupBy}
                onChange={(value) => setGroupBy(value as GroupBy)}
                options={GROUP_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                disabled={!chartUsesGrouping}
                hint={chartUsesGrouping ? "Define como o gráfico temporal distribui as execuções." : "Usado apenas nas visualizações ao longo do tempo."}
              />
            </div>

            <div className="grid gap-2.5 lg:grid-cols-3">
              <SelectField
                label="Visualização principal"
                value={chartView}
                onChange={(value) => setChartView(value as ChartView)}
                options={CHART_VIEW_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                hint="Escolha como deseja enxergar as execuções já filtradas."
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgba(8,32,77,0.58)] dark:text-slate-400">Data inicial</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setPeriodPreset("custom");
                  }}
                  className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3.5 py-2 text-[15px] font-semibold text-(--tc-text,#0b1a3c) outline-none transition focus:border-[rgba(36,82,149,0.32)] dark:border-(--tc-border,#334155) dark:bg-(--tc-surface,#0f172a)"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgba(8,32,77,0.58)] dark:text-slate-400">Data final</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setPeriodPreset("custom");
                  }}
                  className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3.5 py-2 text-[15px] font-semibold text-(--tc-text,#0b1a3c) outline-none transition focus:border-[rgba(36,82,149,0.32)] dark:border-(--tc-border,#334155) dark:bg-(--tc-surface,#0f172a)"
                />
              </label>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgba(8,32,77,0.58)] dark:text-slate-400">Atalhos</span>
              <div className="flex flex-wrap gap-2">
                <ToggleChip active={compareEnabled} onClick={() => setCompareEnabled((value) => !value)} label="Comparar período" />
                <ToggleChip active={onlyWithDefects} onClick={() => setOnlyWithDefects((value) => !value)} label="Com defeitos" />
                <ToggleChip active={onlyRegression} onClick={() => setOnlyRegression((value) => !value)} label="Com regressão" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {compactDraftChips.map((chip) => (
                <span key={chip} className="inline-flex items-center rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 py-1 text-[10px] font-semibold tracking-[0.03em] text-(--tc-text,#0b1a3c)">
                  <FiFilter className="mr-1.5 h-3 w-3" />
                  {chip}
                </span>
              ))}
              {hiddenDraftChipCount > 0 ? (
                <span className="inline-flex items-center rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 py-1 text-[10px] font-semibold tracking-[0.03em] text-(--tc-text,#0b1a3c)">
                  +{hiddenDraftChipCount}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-(--tc-border,#e6ecf5) pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-(--tc-text-muted,#6b7280)">
                {analysisRequested && !hasPendingFilterChanges ? "Recorte atual sincronizado." : "Aplique para atualizar a leitura."}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
                >
                  <FiRefreshCw className="h-4 w-4" />
                  Limpar filtros
                </button>
                <button
                  type="button"
                  onClick={() => applyAnalysis(currentDraftFilters)}
                  disabled={!hasPendingFilterChanges}
                  className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--tc-primary,#011848)_0%,var(--tc-primary-dark,#245295)_72%,var(--tc-accent,#ef0001)_130%)] px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(1,24,72,0.16)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FiZap className="h-4 w-4" />
                  {analysisRequested ? "Aplicar nova análise" : "Aplicar análise"}
                </button>
              </div>
            </div>
          </div>
        </Panel>

        <div ref={resultsRef} />
        {!analysisRequested ? (
          <Panel
            eyebrow="Estado inicial"
            title="Selecione os filtros para gerar a leitura analítica."
            description={undefined}
          >
            <div className="rounded-[20px] border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-(--tc-surface,#ffffff) dark:bg-(--tc-surface-2,#1e293b) text-(--tc-primary,#0b1a3c) dark:text-(--tc-text,#e2e8f0)">
                <FiFilter className="h-5 w-5" />
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-(--tc-text-muted,#6b7280)">
                Defina o recorte e aplique a análise. Os resultados entram só depois disso.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => applyAnalysis({ ...currentDraftFilters, periodPreset: "7d", dateFrom: "", dateTo: "" })} className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">Últimos 7 dias</button>
                <button type="button" onClick={() => applyAnalysis({ ...currentDraftFilters, periodPreset: "30d", groupBy: "release", runFilter: "all", dateFrom: "", dateTo: "" })} className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">Últimas runs</button>
                <button type="button" onClick={() => applyAnalysis({ ...currentDraftFilters, riskFilter: "critical", applicationFilter: "all", runFilter: "all" })} className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">Aplicações críticas</button>
              </div>
            </div>
          </Panel>
        ) : !hasFilterResults ? (
          <Panel
            eyebrow="Sem dados"
            title="Nenhum dado encontrado para esse recorte."
            description="Não faz sentido ocupar a tela com blocos vazios. Ajuste o período ou alivie os filtros para ampliar a leitura."
          >
            <div className="rounded-3xl border border-dashed border-(--tc-border,#d7deea) bg-slate-50/70 dark:bg-(--tc-surface-2,#1e293b)/70 p-6">
              <div className="flex flex-wrap gap-2">
                {activeFilterChips.map((chip) => (
                  <span key={chip} className="inline-flex items-center rounded-full border border-slate-200 dark:border-(--tc-border,#334155) bg-white dark:bg-(--tc-surface,#0f172a) px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-slate-700 dark:text-(--tc-text,#e2e8f0)">
                    {chip}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-(--tc-text-muted,#6b7280)">
                Nenhuma run, insight, gráfico ou tabela foi renderizado para esse recorte. Tente ampliar o período, remover restrições ou trocar a aplicação analisada.
              </p>
            </div>
          </Panel>
        ) : (
          <>
            <div className="flex flex-col gap-3 rounded-[20px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 py-3 dark:border-(--tc-border,#334155) dark:bg-(--tc-surface,#0f172a) sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-(--tc-text,#0b1a3c)">Leitura aplicada</div>
                <div className="mt-1 text-sm text-(--tc-text-muted,#6b7280)">{resultSummaryLine}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <ResultViewButton active={activeView === "overview"} label="Visão geral" onClick={() => setActiveView("overview")} />
                <ResultViewButton active={activeView === "comparatives"} label="Comparativos" onClick={() => setActiveView("comparatives")} />
                <ResultViewButton active={activeView === "drilldown"} label="Drilldown" onClick={() => setActiveView("drilldown")} />
              </div>
            </div>

            {activeView === "overview" ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:gap-5">
                <StatCard label="Runs" value={formatCompactNumber(executiveSummary.totalRuns)} note="Total no recorte aplicado." tone="neutral" delta={activeCompareEnabled && previousSummary.totalRuns > 0 ? buildDelta(executiveSummary.totalRuns, previousSummary.totalRuns, "neutral") : null} icon={<FiActivity className="h-5 w-5" />} />
                <StatCard label="Pass rate" value={formatPercent(executiveSummary.passRate)} note="Leitura consolidada." tone={trendSummary.tone} delta={activeCompareEnabled && previousSummary.totalRuns > 0 ? buildDelta(executiveSummary.passRate, previousSummary.passRate, "higher_better", " p.p.") : null} icon={<FiTrendingUp className="h-5 w-5" />} />
                <StatCard label="Falhas" value={formatPercent(executiveSummary.failRate)} note="Falhas sobre o total executado." tone={executiveSummary.failRate >= 15 ? "critical" : executiveSummary.failRate > 0 ? "warning" : "positive"} delta={activeCompareEnabled && previousSummary.totalRuns > 0 ? buildDelta(executiveSummary.failRate, previousSummary.failRate, "lower_better", " p.p.") : null} icon={<FiTrendingDown className="h-5 w-5" />} />
                <StatCard label="Defeitos" value={formatCompactNumber(executiveSummary.defects)} note="Vinculados ao recorte." tone={executiveSummary.defects > 0 ? "warning" : "positive"} delta={activeCompareEnabled && previousSummary.totalRuns > 0 ? buildDelta(executiveSummary.defects, previousSummary.defects, "lower_better") : null} icon={<FiAlertTriangle className="h-5 w-5" />} />
              </div>
            ) : null}
          </>
        )}

        {analysisRequested && hasFilterResults && activeView === "overview" ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] 2xl:grid-cols-[minmax(0,1.45fr)_minmax(24rem,0.75fr)]">
            {chartHasData ? (
              <Panel
                eyebrow={chartPanelCopy.eyebrow}
                title={chartPanelCopy.title}
                description={chartPanelCopy.description}
              >
                {activeChartView === "qualityTimeline" ? <MiniLineChart points={chartPoints} metric="passRate" /> : null}
                {activeChartView === "runsTimeline" ? <RunsBarChart points={chartPoints} /> : null}
                {activeChartView === "applicationHealth" ? <ApplicationHealthChart applications={applicationRanking} /> : null}
                {activeChartView === "applicationDefects" ? <ApplicationDefectsChart applications={applicationRanking} /> : null}
                <div className="mt-4 text-[11px] font-medium uppercase tracking-[0.12em] text-[rgba(8,32,77,0.48)] dark:text-slate-500">
                  {chartUsesGrouping
                    ? `Visualização: ${activeChartLabel} | Agrupado por: ${activeGroupLabel}`
                    : `Visualização: ${activeChartLabel} | Base: aplicações filtradas`}
                </div>
              </Panel>
            ) : null}

            {showInsightPanel ? (
              <Panel eyebrow="Insights" title="Leitura executiva" description={undefined}>
                <div className="grid gap-3">
                  {insights[0] ? (
                    <div className={`rounded-[20px] border px-4 py-4 ${softInsightClasses(insights[0].tone)}`}>
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgba(8,32,77,0.52)] dark:text-slate-400">
                        <span className={`h-2 w-2 rounded-full ${softInsightAccent(insights[0].tone)}`} />
                        Principal
                      </div>
                      <div className="mt-2 text-base font-bold text-(--tc-text,#0b1a3c)">{insights[0].title}</div>
                      <p className="mt-2 text-sm leading-5 text-[rgba(8,32,77,0.72)] dark:text-slate-300">{insights[0].detail}</p>
                    </div>
                  ) : null}

                  {insights.slice(1, 3).map((insight) => (
                    <div key={insight.id} className="rounded-[18px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 py-3 dark:border-(--tc-border,#334155) dark:bg-(--tc-surface,#0f172a)">
                      <div className="text-sm font-semibold text-(--tc-text,#0b1a3c)">{insight.title}</div>
                      <p className="mt-1 text-xs leading-5 text-(--tc-text-muted,#6b7280)">{insight.detail}</p>
                    </div>
                  ))}

                  {relevantAlerts.length > 0 ? (
                    <div className="rounded-[18px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3 dark:border-(--tc-border,#334155) dark:bg-(--tc-surface-2,#1e293b)">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">Alertas recentes</div>
                      <div className="mt-3 grid gap-2">
                        {relevantAlerts.slice(0, 2).map((alert, index) => (
                          <div key={`${alert.type}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                            <div className="min-w-0 font-medium text-(--tc-text,#0b1a3c)">{alert.message}</div>
                            <div className="shrink-0 text-xs text-(--tc-text-muted,#6b7280)">{formatDateTime(alert.timestamp)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Panel>
            ) : null}
          </div>
        ) : null}

        {analysisRequested && hasFilterResults && activeView === "comparatives" ? (
          filteredRuns.length > 0 ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] 2xl:grid-cols-[minmax(0,1.2fr)_minmax(26rem,0.8fr)]">
          <Panel eyebrow="Comparativos" title="Runs com mais impacto" description={undefined} actions={<Link href="../runs" className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">Lista completa<FiArrowRight className="h-4 w-4" /></Link>}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-(--tc-border,#e6ecf5) text-left text-[11px] font-semibold tracking-[0.04em] text-(--tc-text-muted,#6b7280)">
                    <th className="px-2 py-3">Run</th><th className="px-2 py-3">Aplicação</th><th className="px-2 py-3">Pass rate</th><th className="px-2 py-3">Variação</th><th className="px-2 py-3">Defeitos</th><th className="px-2 py-3">Risco</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.slice(0, 10).map((run) => (
                    <tr key={run.id} className="border-b border-(--tc-border,#eef2f7) align-top">
                      <td className="px-2 py-3"><div className="font-semibold text-(--tc-text,#0b1a3c)">{run.title}</div><div className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">{formatDateTime(run.updatedAt ?? run.createdAt)}</div></td>
                      <td className="px-2 py-3"><div className="font-semibold text-(--tc-text,#0b1a3c)">{run.applicationName}</div><div className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">{run.sourceType === "manual" ? "Manual" : `Integração${run.integrationProvider ? ` ${run.integrationProvider}` : ""}`}</div></td>
                      <td className="px-2 py-3 font-semibold text-(--tc-text,#0b1a3c)">{formatPercent(run.passRate)}</td>
                      <td className="px-2 py-3">{run.deltaPassRate != null ? <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.04em] ${run.deltaPassRate <= -5 ? toneClasses("critical") : run.deltaPassRate >= 2 ? toneClasses("positive") : toneClasses("neutral")}`}>{run.deltaPassRate <= -5 ? <FiArrowDownRight className="h-3.5 w-3.5" /> : run.deltaPassRate >= 2 ? <FiArrowUpRight className="h-3.5 w-3.5" /> : <FiMinus className="h-3.5 w-3.5" />}{`${run.deltaPassRate >= 0 ? "+" : ""}${run.deltaPassRate.toFixed(1)} p.p.`}</span> : <span className="text-xs text-(--tc-text-muted,#6b7280)">Primeira referência</span>}</td>
                      <td className="px-2 py-3 font-semibold text-(--tc-text,#0b1a3c)">{run.directDefectCount}</td>
                      <td className="px-2 py-3"><span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.04em] ${toneClasses(riskTone(run.riskLevel))}`}>{run.riskLevel === "critical" ? "Crítico" : run.riskLevel === "warning" ? "Atenção" : "Estável"}</span></td>
                    </tr>
                  ))}
                  {filteredRuns.length === 0 ? <tr><td colSpan={6} className="px-2 py-8 text-center text-sm text-(--tc-text-muted,#6b7280)">Nenhuma run entrou no filtro atual.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel eyebrow="Aplicações" title="Saúde por aplicação" description={undefined}>
            <div className="grid gap-3">
              {applicationRanking.length > 0 ? applicationRanking.slice(0, 6).map((aggregate) => {
                const appMeta = getAppMeta(aggregate.key, aggregate.label);
                return (
                  <div key={aggregate.key} className="rounded-[18px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 py-3 dark:border-(--tc-border,#334155) dark:bg-(--tc-surface,#0f172a)">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.04em] ${css.appPill}`} {...{ style: { '--app-color': appMeta.color, '--app-border': `${appMeta.color}35`, '--app-bg': `${appMeta.color}12` } as React.CSSProperties }}>{appMeta.label}</span>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.04em] ${toneClasses(riskTone(aggregate.riskLevel))}`}>{aggregate.riskLevel === "critical" ? "Crítica" : aggregate.riskLevel === "warning" ? "Atenção" : "Estável"}</span>
                        </div>
                        <div className="mt-2 text-base font-bold text-(--tc-text,#0b1a3c)">{aggregate.label}</div>
                        <div className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">{aggregate.runs} run(s) • {aggregate.defects} defeito(s) • {aggregate.regressions} regressão(ões)</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-extrabold text-(--tc-text,#0b1a3c)">{formatPercent(aggregate.passRate)}</div>
                        <div className="text-xs text-(--tc-text-muted,#6b7280)">pass rate</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold tracking-[0.04em] text-(--tc-text-muted,#6b7280)">
                      <span className="rounded-full bg-(--tc-surface-2,#f1f5f9) px-3 py-1 dark:bg-(--tc-surface-2,#1e293b)">falha {formatPercent(aggregate.failRate)}</span>
                      <span className="rounded-full bg-(--tc-surface-2,#f1f5f9) px-3 py-1 dark:bg-(--tc-surface-2,#1e293b)">bloqueios {aggregate.blocked}</span>
                    </div>
                  </div>
                );
              }) : <div className="rounded-3xl border border-dashed border-(--tc-border,#d7deea) px-4 py-8 text-center text-sm text-(--tc-text-muted,#6b7280)">Sem aplicações suficientes no recorte atual.</div>}
            </div>
          </Panel>
        </div>
          ) : (
            <Panel eyebrow="Comparativo" title="Sem comparativos para exibir" description="Esse recorte não trouxe runs suficientes para comparação.">
              <div className="rounded-3xl border border-dashed border-(--tc-border,#d7deea) px-4 py-8 text-center text-sm text-(--tc-text-muted,#6b7280)">
                Ajuste o recorte para incluir runs consolidadas e liberar os comparativos.
              </div>
            </Panel>
          )
        ) : null}

        {analysisRequested && hasFilterResults && activeView === "drilldown" ? (
          filteredRuns.length > 0 ? (
        <Panel eyebrow="Drilldown" title="Base detalhada" description={undefined} actions={<div className="flex flex-wrap gap-2"><button type="button" onClick={handleExportPdf} disabled={exportingPdf} className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) disabled:opacity-60"><FiDownload className="h-4 w-4" />{exportingPdf ? "Gerando PDF..." : "PDF do filtro"}</button><button type="button" onClick={() => downloadCsv(filteredRuns)} className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"><FiDownload className="h-4 w-4" />CSV do filtro</button></div>}>
          <div className="mb-4 flex flex-wrap gap-2">
            {compactActiveChips.map((chip) => (
              <span key={chip} className="inline-flex items-center rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f1f5f9) px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-(--tc-text,#0b1a3c)">
                <FiFilter className="mr-1.5 h-3.5 w-3.5" />
                {chip}
              </span>
            ))}
            {hiddenActiveChipCount > 0 ? <span className="inline-flex items-center rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f1f5f9) px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-(--tc-text,#0b1a3c)">+{hiddenActiveChipCount}</span> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-(--tc-border,#e6ecf5) text-left text-[11px] font-semibold tracking-[0.04em] text-(--tc-text-muted,#6b7280)"><th className="px-2 py-3">Run</th><th className="px-2 py-3">Aplicação</th><th className="px-2 py-3">Status</th><th className="px-2 py-3">Origem</th><th className="px-2 py-3">Pass</th><th className="px-2 py-3">Falhas</th><th className="px-2 py-3">Defeitos</th><th className="px-2 py-3">Atualização</th><th className="px-2 py-3">Abrir</th></tr></thead>
              <tbody>
                {filteredRuns.map((run) => (
                  <tr key={run.id} className="border-b border-(--tc-border,#eef2f7)">
                    <td className="px-2 py-3"><div className="font-semibold text-(--tc-text,#0b1a3c)">{run.title}</div><div className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">{run.releaseLabel ?? "Sem run vinculada"}</div></td>
                    <td className="px-2 py-3"><div className="font-semibold text-(--tc-text,#0b1a3c)">{run.applicationName}</div><div className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">{run.environments.length > 0 ? run.environments.join(", ") : "Sem ambiente"}</div></td>
                    <td className="px-2 py-3"><span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.04em] ${toneClasses(riskTone(run.riskLevel))}`}>{run.statusLabel}</span></td>
                    <td className="px-2 py-3 text-(--tc-text,#0b1a3c)">{run.sourceType === "manual" ? "Manual" : `Integração${run.integrationProvider ? ` ${run.integrationProvider}` : ""}`}</td>
                    <td className="px-2 py-3 font-semibold text-(--tc-text,#0b1a3c)">{formatPercent(run.passRate)}</td>
                    <td className="px-2 py-3 font-semibold text-(--tc-text,#0b1a3c)">{run.stats.fail}</td>
                    <td className="px-2 py-3 font-semibold text-(--tc-text,#0b1a3c)">{run.directDefectCount}</td>
                    <td className="px-2 py-3 text-(--tc-text-muted,#6b7280)">{formatDateTime(run.updatedAt ?? run.createdAt)}</td>
                    <td className="px-2 py-3"><Link href={run.href} className="inline-flex items-center gap-2 font-semibold text-(--tc-accent,#ef0001)">Drilldown<FiArrowRight className="h-4 w-4" /></Link></td>
                  </tr>
                ))}
                {filteredRuns.length === 0 ? <tr><td colSpan={9} className="px-2 py-8 text-center text-sm text-(--tc-text-muted,#6b7280)">Nenhuma linha disponível com o filtro atual.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Panel>
          ) : (
            <Panel eyebrow="Drilldown" title="Sem linhas detalhadas" description="Não há runs suficientes para abrir a grade detalhada neste recorte.">
              <div className="rounded-3xl border border-dashed border-(--tc-border,#d7deea) px-4 py-8 text-center text-sm text-(--tc-text-muted,#6b7280)">
                Ajuste os filtros para incluir runs e habilitar o drilldown.
              </div>
            </Panel>
          )
        ) : null}
      </div>
    </div>
  );
}
