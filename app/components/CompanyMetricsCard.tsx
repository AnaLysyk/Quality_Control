"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FiFileText } from "react-icons/fi";
import StatusChart from "@/components/StatusChart";
import { formatRunTitle } from "@/lib/runPresentation";

type Stats = { pass: number; fail: number; blocked: number; notRun: number };

type TrendSummary = { direction: "up" | "down" | "flat"; delta: number };

type Gate = {
  status: "approved" | "warning" | "failed" | "no_data";
  passRate: number;
  failRate: number;
  blockedRate: number;
  notRunRate: number;
  total: number;
};

type ReleaseLike = {
  slug?: string;
  title?: string;
  createdAt?: string;
  created_at?: string;
  createdAtValue?: number;
  passRate?: number | null;
  stats?: Stats | null;
  gate?: { status?: "approved" | "warning" | "failed" | "no_data" };
  order?: string[];
  app?: string;
  project?: string;
};

type SparkPoint = {
  label: string;
  value: number | null;
  total: number;
  failRate: number | null;
  blockedRate: number | null;
};

type CompanyRow = {
  id: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
  active?: boolean | null;
  stats: Stats;
  passRate: number | null;
  gate: Gate;
  trend: TrendSummary;
  latestRelease?: { slug?: string; title?: string; createdAt?: string };
  releases: ReleaseLike[];
};

let testingLogoPromise: Promise<string | null> | null = null;

export type DefectsSummary = {
  loaded: boolean;
  openTotal: number | null;
  openByApp: Record<string, number>;
  appsFromDefects: string[];
};

function sumStats(stats: Stats) {
  return stats.pass + stats.fail + stats.blocked + stats.notRun;
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function formatDate(iso?: string) {
  if (!iso) return "--";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "--";
  return new Date(time).toLocaleDateString("pt-BR");
}

function formatDateTime(iso?: string) {
  if (!iso) return "--";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "--";
  return new Date(time).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDataAge(iso?: string) {
  if (!iso) return "Sem leitura recente";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "Sem leitura recente";
  const diffMs = Date.now() - time;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `Atualizado há ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Atualizado há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Atualizado há ${diffDays}d`;
}

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
        return blobToDataUrl(await response.blob());
      })
      .catch(() => null);
  }

  return testingLogoPromise;
}

function normalizeAppLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 4 && trimmed === trimmed.toUpperCase()) return trimmed;
  if (trimmed.length <= 3) return trimmed.toUpperCase();
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function extractAppsFromReleases(releases: ReleaseLike[]) {
  const set = new Set<string>();
  releases.forEach((release) => {
    (release.order ?? []).forEach((app) => {
      const label = typeof app === "string" ? normalizeAppLabel(app) : null;
      if (label) set.add(label);
    });
    const fallback = (release.app ?? release.project ?? "").trim();
    const label = fallback ? normalizeAppLabel(fallback) : null;
    if (label) set.add(label);
  });
  return Array.from(set);
}

function filterReleasesByApp(releases: ReleaseLike[], app: string | null) {
  if (!app) return releases;
  const target = app.toLowerCase();
  return releases.filter((release) => {
    const order = Array.isArray(release.order) ? release.order : [];
    if (order.some((value) => (value ?? "").toString().toLowerCase() === target)) return true;
    const key = (release.app ?? release.project ?? "").toString().toLowerCase();
    return key === target;
  });
}

function aggregateStats(releases: ReleaseLike[]): Stats {
  const acc: Stats = { pass: 0, fail: 0, blocked: 0, notRun: 0 };
  releases.forEach((release) => {
    const stats = release.stats;
    if (!stats) return;
    acc.pass += stats.pass ?? 0;
    acc.fail += stats.fail ?? 0;
    acc.blocked += stats.blocked ?? 0;
    acc.notRun += stats.notRun ?? 0;
  });
  return acc;
}

function computePassRateFromStats(stats: Stats): number | null {
  const total = sumStats(stats);
  if (!total) return null;
  return percent(stats.pass, total);
}

function toneFromGate(status: Gate["status"]) {
  if (status === "approved") return { label: "Saudavel", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (status === "warning") return { label: "Atencao", className: "bg-amber-50 text-amber-700 border-amber-200" };
  if (status === "failed") return { label: "Risco", className: "bg-red-50 text-red-700 border-red-200" };
  return { label: "Sem dados", className: "bg-slate-100 text-slate-700 border-slate-200" };
}

function Sparkline({ points }: { points: SparkPoint[] }) {
  const validPoints = points.filter((point) => typeof point.value === "number" && Number.isFinite(point.value));
  if (!validPoints.length) {
    return <div className="flex h-20 items-center justify-center rounded-xl border border-(--tc-border)/40 bg-slate-50 text-[11px] text-(--tc-text-muted)">Sem leitura de qualidade</div>;
  }

  const QUALITY_TARGET = 85;
  const width = 260;
  const height = 116;
  const left = 26;
  const right = 8;
  const top = 8;
  const bottom = 24;
  const displayPoints = validPoints;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const ticks = [100, 85, 0];

  const toX = (index: number) => {
    if (displayPoints.length <= 1) return left + plotW / 2;
    return left + (index * plotW) / (displayPoints.length - 1);
  };
  const toY = (value: number) => {
    return top + ((100 - value) / 100) * plotH;
  };

  const path = displayPoints
    .map((point, index) => {
      const resolved = typeof point.value === "number" && Number.isFinite(point.value) ? point.value : null;
      if (resolved === null) return null;
      const x = toX(index);
      const y = toY(resolved);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");

  const coords = displayPoints
    .map((point, index) => {
      const resolved = typeof point.value === "number" && Number.isFinite(point.value) ? point.value : null;
      if (resolved === null) return null;
      return { x: toX(index), y: toY(resolved) };
    })
    .filter((point): point is { x: number; y: number } => Boolean(point));

  const area = coords.length
    ? `${path} L${coords[coords.length - 1].x.toFixed(1)} ${(top + plotH).toFixed(1)} L${coords[0].x.toFixed(1)} ${(top + plotH).toFixed(1)} Z`
    : "";
  const currentPoint = coords[coords.length - 1] ?? null;
  const currentTone =
    !currentPoint || (displayPoints[coords.length - 1]?.value ?? 0) >= 85
      ? "rgba(16,185,129,0.96)"
      : (displayPoints[coords.length - 1]?.value ?? 0) >= 70
        ? "rgba(245,158,11,0.96)"
        : "rgba(239,68,68,0.96)";

  return (
    <div className="rounded-xl border border-(--tc-border)/40 bg-slate-50 p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full">
        <rect x={left} y={toY(100)} width={plotW} height={toY(85) - toY(100)} rx="10" fill="rgba(16,185,129,0.14)" />
        <rect x={left} y={toY(85)} width={plotW} height={toY(70) - toY(85)} rx="10" fill="rgba(245,158,11,0.14)" />
        <rect x={left} y={toY(70)} width={plotW} height={toY(0) - toY(70)} rx="10" fill="rgba(239,68,68,0.10)" />

        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={left} y1={toY(tick)} x2={width - right} y2={toY(tick)} stroke="rgba(15,23,42,0.08)" strokeWidth="1" />
            <text x={left - 6} y={toY(tick) + 4} textAnchor="end" fontSize="10" fill="rgba(71,85,105,0.9)">
              {tick}%
            </text>
          </g>
        ))}

        <line
          x1={left}
          y1={toY(QUALITY_TARGET)}
          x2={width - right}
          y2={toY(QUALITY_TARGET)}
          stroke="rgba(239,0,1,0.55)"
          strokeWidth="1.25"
          strokeDasharray="4 3"
        />

        {area ? <path d={area} fill="rgba(239,0,1,0.10)" /> : null}
        <path d={path} fill="none" stroke="rgba(37,99,235,0.9)" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point, index) => (
          <g key={`${point.x}-${point.y}-${index}`}>
            {index === coords.length - 1 ? <circle cx={point.x} cy={point.y} r="6.5" fill="rgba(15,23,42,0.08)" /> : null}
            <circle cx={point.x} cy={point.y} r={index === coords.length - 1 ? 4 : 2.5} fill={index === coords.length - 1 ? currentTone : "var(--tc-accent,#ef0001)"} />
            <title>{`${displayPoints[index]?.label ?? "--"} | pass rate ${displayPoints[index]?.value ?? 0}% | runs ${displayPoints[index]?.total ?? 0} | falhas ${displayPoints[index]?.failRate ?? 0}% | bloqueados ${displayPoints[index]?.blockedRate ?? 0}%${displayPoints[index]?.value === 0 ? " | sem aprovações nesta execução" : ""}`}</title>
          </g>
        ))}

        <text x={left} y={height - 6} fontSize="10" fill="rgba(71,85,105,0.9)">
          {displayPoints[0]?.label ?? "--"}
        </text>
        <text x={width - right} y={height - 6} textAnchor="end" fontSize="10" fill="rgba(71,85,105,0.9)">
          {displayPoints[displayPoints.length - 1]?.label ?? "--"}
        </text>
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-(--tc-text-muted)">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-(--tc-accent,#ef0001)" />Pass rate</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-px w-4 bg-red-400" />Meta 85%</span>
      </div>
    </div>
  );
}

function CountStat({
  label,
  value,
  pct,
  tone,
}: {
  label: string;
  value: number;
  pct: number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-(--tc-border)/60 bg-white px-3.5 py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="text-[11px] uppercase tracking-[0.22em] text-(--tc-text-muted)">{label}</div>
      <div className={`mt-2 text-2xl font-extrabold ${tone}`}>{value}</div>
      <div className="mt-1 text-[11px] text-(--tc-text-muted)">{pct}% do total</div>
    </div>
  );
}

function SummaryStat({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="rounded-2xl border border-(--tc-border)/50 bg-slate-50 p-3.5">
      <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">{value}</div>
      <div className="text-[11px] text-(--tc-text-muted)">{note}</div>
    </div>
  );
}

export function CompanyMetricsCard(props: {
  company: CompanyRow;
  periodDays: number;
  activeApp: string | null;
  onSelectApp: (app: string | null) => void;
  defects?: DefectsSummary;
  focused?: boolean;
}) {
  const { company, periodDays, activeApp, onSelectApp, defects, focused } = props;
  const [exportingPdf, setExportingPdf] = useState(false);

  const isActiveApp = (value: string) => (activeApp ?? "").toLowerCase() === value.toLowerCase();

  const releases = useMemo(() => filterReleasesByApp(company.releases ?? [], activeApp), [company.releases, activeApp]);
  const stats = useMemo(() => (activeApp ? aggregateStats(releases) : company.stats), [activeApp, releases, company.stats]);
  const total = sumStats(stats);
  const passRate = activeApp ? computePassRateFromStats(stats) : company.passRate;

  const releasesAtRisk = useMemo(() => (releases ?? []).filter((release) => release?.gate?.status === "failed").length, [releases]);

  const appsFromReleases = useMemo(() => extractAppsFromReleases(company.releases ?? []), [company.releases]);
  const apps = useMemo(() => {
    const merged = new Set<string>(appsFromReleases);
    (defects?.appsFromDefects ?? []).forEach((app) => merged.add(app));
    return Array.from(merged);
  }, [appsFromReleases, defects?.appsFromDefects]);

  const openDefects = useMemo(() => {
    if (!defects) return null;
    if (activeApp) return defects.openByApp[activeApp] ?? 0;
    return defects.openTotal;
  }, [defects, activeApp]);

  const sortedForTrend = useMemo(() => {
    const list = [...(releases ?? [])];
    list.sort((a, b) => (b.createdAtValue ?? 0) - (a.createdAtValue ?? 0));
    return list;
  }, [releases]);

  const trendPoints = useMemo(() => {
    const points = sortedForTrend
      .slice(0, 10)
      .reverse()
      .map((release) => ({
        label: formatDate(release.createdAt ?? release.created_at),
        value: typeof release.passRate === "number" ? release.passRate : null,
        total: release.stats ? sumStats(release.stats) : 0,
        failRate: release.stats ? percent(release.stats.fail, Math.max(sumStats(release.stats), 1)) : null,
        blockedRate: release.stats ? percent(release.stats.blocked, Math.max(sumStats(release.stats), 1)) : null,
      }));
    return points.length ? points : [{ label: "--", value: null, total: 0, failRate: null, blockedRate: null }];
  }, [sortedForTrend]);

  const trendSnapshot = useMemo(() => {
    const valid = trendPoints.filter((point) => typeof point.value === "number" && Number.isFinite(point.value));
    if (!valid.length) return null;
    const first = valid[0];
    const last = valid[valid.length - 1];
    const worst = valid.reduce((currentWorst, point) => ((point.value ?? 0) < (currentWorst.value ?? 0) ? point : currentWorst), valid[0]);
    return { first, last, worst };
  }, [trendPoints]);

  const latest = useMemo(() => {
    if (!activeApp) return company.latestRelease ?? null;
    const list = [...(releases ?? [])];
    list.sort((a, b) => (b.createdAtValue ?? 0) - (a.createdAtValue ?? 0));
    const top = list[0];
    if (!top) return null;
    return { slug: top.slug, title: top.title, createdAt: top.createdAt ?? top.created_at };
  }, [activeApp, company.latestRelease, releases]);

  const latestDataAt = latest?.createdAt ?? company.latestRelease?.createdAt;
  const dataAgeLabel = useMemo(() => formatDataAge(latestDataAt), [latestDataAt]);

  const tone = toneFromGate(company.gate.status);
  const companySlug = company.slug ?? null;
  const latestTitle = formatRunTitle(latest?.title ?? latest?.slug, latest?.slug ?? "--");
  const breakdown = [
    { label: "Pass", value: stats.pass, pct: percent(stats.pass, Math.max(total, 1)), tone: "text-emerald-600" },
    { label: "Fail", value: stats.fail, pct: percent(stats.fail, Math.max(total, 1)), tone: "text-red-600" },
    { label: "Blocked", value: stats.blocked, pct: percent(stats.blocked, Math.max(total, 1)), tone: "text-amber-600" },
    { label: "Not run", value: stats.notRun, pct: percent(stats.notRun, Math.max(total, 1)), tone: "text-slate-600" },
  ];

  const exportScopes = useMemo(() => {
    const buildScope = (label: string, app: string | null) => {
      const scopedReleases = filterReleasesByApp(company.releases ?? [], app);
      const scopedStats = app ? aggregateStats(scopedReleases) : company.stats;
      const scopedPassRate = app ? computePassRateFromStats(scopedStats) : company.passRate;
      const scopedLatest = [...scopedReleases].sort((a, b) => (b.createdAtValue ?? 0) - (a.createdAtValue ?? 0))[0];
      return {
        label,
        stats: scopedStats,
        total: sumStats(scopedStats),
        passRate: scopedPassRate,
        releasesAtRisk: scopedReleases.filter((release) => release?.gate?.status === "failed").length,
        openDefects: app ? (defects?.openByApp[app] ?? 0) : defects?.openTotal ?? 0,
        latestTitle: formatRunTitle(scopedLatest?.title ?? scopedLatest?.slug, scopedLatest?.slug ?? "--"),
        latestAt: scopedLatest?.createdAt ?? scopedLatest?.created_at ?? null,
      };
    };

    return [
      buildScope("Visão geral", null),
      ...apps.map((app) => buildScope(`Aplicação ${app}`, app)),
    ];
  }, [apps, company.passRate, company.releases, company.stats, defects?.openByApp, defects?.openTotal]);

  async function handleExportPdf() {
    try {
      setExportingPdf(true);
      const [{ jsPDF }, logoDataUrl] = await Promise.all([import("jspdf"), getTestingLogoDataUrl()]);
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 42;
      let cursorY = 46;

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
      doc.text("Quality Control | Métricas por empresa", marginX + 38, cursorY + 24);

      cursorY += 54;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(11, 26, 60);
      doc.text(company.name, marginX, cursorY);

      cursorY += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(75, 85, 99);
      doc.text(`Janela: ${periodDays} dias`, marginX, cursorY);
      doc.text(dataAgeLabel, marginX + 120, cursorY);
      doc.text(`Exportado em ${formatDateTime(new Date().toISOString())}`, marginX + 250, cursorY);

      cursorY += 20;
      doc.setDrawColor(214, 222, 232);
      doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
      cursorY += 18;

      exportScopes.forEach((scope, index) => {
        if (cursorY > pageHeight - 160) {
          doc.addPage();
          cursorY = 48;
        }

        doc.setFillColor(index === 0 ? 241 : 248, index === 0 ? 245 : 250, index === 0 ? 249 : 252);
        doc.roundedRect(marginX, cursorY, pageWidth - marginX * 2, 108, 14, 14, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(11, 26, 60);
        doc.text(scope.label, marginX + 16, cursorY + 18);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(75, 85, 99);
        doc.text(`Pass rate: ${scope.passRate == null ? "--" : `${scope.passRate}%`}`, marginX + 16, cursorY + 38);
        doc.text(`Execuções: ${scope.total}`, marginX + 180, cursorY + 38);
        doc.text(`Gate em risco: ${scope.releasesAtRisk}`, marginX + 320, cursorY + 38);

        doc.text(`Pass: ${scope.stats.pass}`, marginX + 16, cursorY + 58);
        doc.text(`Fail: ${scope.stats.fail}`, marginX + 120, cursorY + 58);
        doc.text(`Blocked: ${scope.stats.blocked}`, marginX + 220, cursorY + 58);
        doc.text(`Not run: ${scope.stats.notRun}`, marginX + 340, cursorY + 58);

        doc.text(`Defeitos abertos: ${scope.openDefects ?? 0}`, marginX + 16, cursorY + 78);
        doc.text(`Última execução: ${scope.latestTitle}`, marginX + 180, cursorY + 78);
        doc.text(scope.latestAt ? formatDateTime(scope.latestAt) : "Sem data de execução", marginX + 180, cursorY + 94);

        cursorY += 126;
      });

      doc.save(`metricas-${(company.slug ?? company.name).toString().replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div
      className={`flex h-full min-h-[44rem] flex-col rounded-[28px] border bg-white shadow-sm transition ${
        focused ? "border-(--tc-accent)/50 shadow-[0_18px_40px_rgba(239,0,1,0.12)]" : "border-(--tc-border)/60"
      }`}
    >
      <div className="flex h-full flex-col space-y-4 p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-(--tc-text-muted)">Empresa</p>
            <h2 className="mt-1 truncate text-xl font-extrabold text-(--tc-text-primary,#0b1a3c) md:text-2xl" title={company.name}>
              {company.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                data-testid="company-quality-status"
                data-status={company.gate.status}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${tone.className}`}
              >
                {tone.label}
              </span>
              <span className="text-[11px] text-(--tc-text-muted)">Janela: {periodDays}d</span>
              {company.active === false ? (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                  Inativa
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-[11px] text-(--tc-text-muted)">{dataAgeLabel}</div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">Pass rate</div>
            <div className="text-3xl font-extrabold text-(--tc-accent,#ef0001)">{passRate == null ? "--" : `${passRate}%`}</div>
            <div className="mt-1 text-[11px] text-(--tc-text-muted)">{total > 0 ? `${total} casos analisados` : "Sem execucoes na janela"}</div>
          </div>
        </div>

        {apps.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSelectApp(null)}
              className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
                !activeApp
                  ? "border-(--tc-accent)/50 bg-(--tc-accent)/10 text-(--tc-accent)"
                  : "border-(--tc-border)/60 bg-white text-(--tc-text-muted) hover:bg-slate-50"
              }`}
            >
              Todas
            </button>
            {apps.map((app) => (
              <button
                key={app}
                type="button"
                onClick={() => onSelectApp(app)}
                className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
                  isActiveApp(app)
                    ? "border-(--tc-accent)/50 bg-(--tc-accent)/10 text-(--tc-accent)"
                    : "border-(--tc-border)/60 bg-white text-(--tc-text-muted) hover:bg-slate-50"
                }`}
              >
                {app}
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.65fr)]">
          <div className="rounded-[24px] border border-(--tc-border)/60 bg-linear-to-b from-white to-slate-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Distribuicao real de execucao</h3>
                <p className="mt-1 text-[11px] text-(--tc-text-muted)">Grafico e contadores conectados aos resultados reais da empresa.</p>
              </div>
              <span className="rounded-full border border-(--tc-border)/60 bg-white px-3 py-1 text-[11px] font-semibold text-(--tc-text-muted)">
                Total {total}
              </span>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center">
              <StatusChart stats={stats} hasData={total > 0} emptyLabel="Sem execucoes" />

              <div className="grid gap-3 sm:grid-cols-2">
                {breakdown.map((item) => (
                  <CountStat key={item.label} label={item.label} value={item.value} pct={item.pct} tone={item.tone} />
                ))}
              </div>
            </div>
          </div>

          <div className="grid auto-rows-fr gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
            <SummaryStat label="Execucoes" value={releases.length} note="runs na janela selecionada" />
            <SummaryStat label="Gate em risco" value={releasesAtRisk} note="execucoes com gate quebrado" />
            <SummaryStat label="Defeitos abertos" value={openDefects == null ? "--" : openDefects} note={defects?.loaded ? "origem conectada" : "carregando dados"} />
            <SummaryStat label="Ultima execucao" value={latestTitle} note={formatDate(latest?.createdAt)} />
          </div>
        </div>

        <div className="rounded-[24px] border border-(--tc-border)/60 bg-linear-to-b from-white to-slate-50 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Qualidade das ultimas execucoes</h3>
              <p className="mt-1 text-[11px] text-(--tc-text-muted)">Linha de pass rate com apoio de falha e bloqueio.</p>
            </div>
            <span className="text-[11px] text-(--tc-text-muted)">
              {company.trend.delta === 0 ? "Sem variação" : `${company.trend.direction === "up" ? "+" : "-"}${Math.abs(company.trend.delta)} pp`}
            </span>
          </div>
          <div className="mt-4">
            <Sparkline points={trendPoints} />
          </div>
          {trendSnapshot ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-(--tc-border)/50 bg-white px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-(--tc-text-muted)">Primeira leitura</div>
                <div className="mt-1 text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{trendSnapshot.first.value ?? 0}%</div>
                <div className="text-[11px] text-(--tc-text-muted)">{trendSnapshot.first.label} · {trendSnapshot.first.total} casos</div>
              </div>
              <div className="rounded-2xl border border-(--tc-border)/50 bg-white px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-(--tc-text-muted)">Pior ponto do período</div>
                <div className="mt-1 text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{trendSnapshot.worst.value ?? 0}%</div>
                <div className="text-[11px] text-(--tc-text-muted)">
                  {trendSnapshot.worst.label} · falhas {trendSnapshot.worst.failRate ?? 0}% · bloqueados {trendSnapshot.worst.blockedRate ?? 0}%
                </div>
              </div>
              <div className="rounded-2xl border border-(--tc-border)/50 bg-white px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-(--tc-text-muted)">Última leitura</div>
                <div className="mt-1 text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{trendSnapshot.last.value ?? 0}%</div>
                <div className="text-[11px] text-(--tc-text-muted)">
                  {trendSnapshot.last.label} · falhas {trendSnapshot.last.failRate ?? 0}% · bloqueados {trendSnapshot.last.blockedRate ?? 0}%
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-[11px] text-(--tc-text-muted)">
            Gate: Pass {company.gate.passRate}% · Fail {company.gate.failRate}% · Blocked {company.gate.blockedRate}% · Not Run {company.gate.notRunRate}%
          </div>

          {companySlug ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleExportPdf()}
                disabled={exportingPdf}
                className="inline-flex items-center justify-center rounded-xl border border-(--tc-border)/60 bg-white px-3 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) hover:bg-slate-50 disabled:opacity-60"
                title="Exportar métricas em PDF"
                aria-label="Exportar métricas em PDF"
              >
                <FiFileText size={16} />
              </button>
              <Link
                href={`/empresas/${encodeURIComponent(companySlug)}/home`}
                className="rounded-xl border border-(--tc-border)/60 bg-white px-4 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) hover:bg-slate-50"
              >
                Abrir empresa
              </Link>
              <Link
                href={`/empresas/${encodeURIComponent(companySlug)}/releases`}
                className="rounded-xl bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white hover:bg-(--tc-accent,#d30001)"
              >
                Ver runs
              </Link>
            </div>
          ) : (
            <div className="text-sm text-(--tc-text-muted)">Empresa sem slug</div>
          )}
        </div>
      </div>
    </div>
  );
}

