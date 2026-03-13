"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { FiFileText } from "react-icons/fi";

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

export type DefectsSummary = {
  loaded: boolean;
  openTotal: number | null;
  openByApp: Record<string, number>;
  appsFromDefects: string[];
};

type ExportScope = {
  key: string;
  app: string | null;
  stats: Stats;
  total: number;
  passRate: number | null;
  releasesCount: number;
  releasesAtRisk: number;
  openDefects: number | null;
  latest: { slug?: string; title?: string; createdAt?: string } | null;
  trendPoints: Array<number | null>;
};

function sumStats(stats: Stats) {
  return stats.pass + stats.fail + stats.blocked + stats.notRun;
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "—";
  return new Date(time).toLocaleDateString("pt-BR");
}

function formatDateTime(iso?: string) {
  if (!iso) return "â€”";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "â€”";
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
  if (diffMinutes < 60) return `Atualizado ha ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Atualizado ha ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Atualizado ha ${diffDays}d`;
}

function normalizeAppLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Keep small acronyms uppercase.
  if (trimmed.length <= 4 && trimmed === trimmed.toUpperCase()) return trimmed;
  if (trimmed.length <= 3) return trimmed.toUpperCase();
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function extractAppsFromReleases(releases: ReleaseLike[]) {
  const set = new Set<string>();
  releases.forEach((r) => {
    (r.order ?? []).forEach((a) => {
      const label = typeof a === "string" ? normalizeAppLabel(a) : null;
      if (label) set.add(label);
    });
    const fallback = (r.app ?? r.project ?? "").trim();
    const label = fallback ? normalizeAppLabel(fallback) : null;
    if (label) set.add(label);
  });
  return Array.from(set);
}

function filterReleasesByApp(releases: ReleaseLike[], app: string | null) {
  if (!app) return releases;
  const target = app.toLowerCase();
  return releases.filter((r) => {
    const order = Array.isArray(r.order) ? r.order : [];
    if (order.some((a) => (a ?? "").toString().toLowerCase() === target)) return true;
    const key = (r.app ?? r.project ?? "").toString().toLowerCase();
    return key === target;
  });
}

function aggregateStats(releases: ReleaseLike[]): Stats {
  const acc: Stats = { pass: 0, fail: 0, blocked: 0, notRun: 0 };
  releases.forEach((r) => {
    const s = r.stats;
    if (!s) return;
    acc.pass += s.pass ?? 0;
    acc.fail += s.fail ?? 0;
    acc.blocked += s.blocked ?? 0;
    acc.notRun += s.notRun ?? 0;
  });
  return acc;
}

function computePassRateFromStats(stats: Stats): number | null {
  const total = sumStats(stats);
  if (!total) return null;
  return percent(stats.pass, total);
}

function toneFromGate(status: Gate["status"]) {
  if (status === "approved") return { label: "Saudável", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (status === "warning") return { label: "Atenção", className: "bg-amber-50 text-amber-700 border-amber-200" };
  if (status === "failed") return { label: "Risco", className: "bg-red-50 text-red-700 border-red-200" };
  return { label: "Sem dados", className: "bg-slate-100 text-slate-700 border-slate-200" };
}

function MiniStatusBar({ stats }: { stats: Stats }) {
  const total = sumStats(stats);
  const pass = total ? percent(stats.pass, total) : 0;
  const fail = total ? percent(stats.fail, total) : 0;
  const blocked = total ? percent(stats.blocked, total) : 0;
  const notRun = Math.max(0, 100 - pass - fail - blocked);

  const w = (value: number) => `w-pct-${Math.max(0, Math.min(100, Math.round(value)))}`;

  return (
    <div className="w-full">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-(--tc-border)/40">
        <div className="h-full flex">
          <div className={`h-full ${w(pass)} bg-(--tc-pass,#22c55e)`} />
          <div className={`h-full ${w(fail)} bg-(--tc-fail,#ef4444)`} />
          <div className={`h-full ${w(blocked)} bg-(--tc-blocked,#facc15)`} />
          <div className={`h-full ${w(notRun)} bg-(--tc-notrun,#64748b)`} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-(--tc-text-muted)">
        <span>Pass {pass}%</span>
        <span>Fail {fail}%</span>
        <span>Blocked {blocked}%</span>
        <span>Not Run {notRun}%</span>
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: Array<number | null> }) {
  const data = points.filter((p): p is number => typeof p === "number" && Number.isFinite(p));
  if (!data.length) {
    return <div className="h-10 rounded-xl bg-slate-50 border border-(--tc-border)/40" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const w = 160;
  const h = 40;
  const pad = 6;

  const toX = (index: number) => {
    if (points.length <= 1) return pad;
    return pad + (index * (w - pad * 2)) / (points.length - 1);
  };
  const toY = (value: number) => {
    const range = Math.max(1, max - min);
    const t = (value - min) / range;
    return pad + (1 - t) * (h - pad * 2);
  };

  const path = points
    .map((p, i) => {
      const v = typeof p === "number" && Number.isFinite(p) ? p : null;
      if (v === null) return null;
      const x = toX(i);
      const y = toY(v);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full rounded-xl bg-slate-50 border border-(--tc-border)/40">
      <path d={path} fill="none" stroke="var(--tc-accent,#ef0001)" strokeWidth="2" />
    </svg>
  );
}

function ExportScopePreview({
  companyName,
  tone,
  periodDays,
  dataAgeLabel,
  apps,
  scope,
}: {
  companyName: string;
  tone: { label: string; className: string };
  periodDays: number;
  dataAgeLabel: string;
  apps: string[];
  scope: ExportScope;
}) {
  const total = sumStats(scope.stats);
  const latestTitle = scope.latest?.title ?? scope.latest?.slug ?? "â€”";

  return (
    <div className="w-[920px] rounded-[28px] border border-(--tc-border)/60 bg-white shadow-sm">
      <div className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-(--tc-text-muted)">Empresa</p>
            <h2 className="mt-1 text-xl font-extrabold text-(--tc-text-primary,#0b1a3c)">{companyName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${tone.className}`}>{tone.label}</span>
              <span className="text-[11px] text-(--tc-text-muted)">Janela: {periodDays}d</span>
            </div>
            <div className="mt-2 inline-flex items-center rounded-full border border-(--tc-border)/60 bg-slate-50 px-3 py-1 text-[11px] font-medium text-(--tc-text-muted)">
              Dados: {dataAgeLabel}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">Pass rate</div>
            <div className="text-3xl font-extrabold text-(--tc-accent,#ef0001)">{scope.passRate == null ? "â€”" : `${scope.passRate}%`}</div>
          </div>
        </div>

        {apps.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${scope.app == null ? "border-(--tc-accent)/50 bg-(--tc-accent)/10 text-(--tc-accent)" : "border-(--tc-border)/60 bg-white text-(--tc-text-muted)"}`}>Todas</span>
            {apps.map((app) => (
              <span
                key={app}
                className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${
                  scope.app?.toLowerCase() === app.toLowerCase()
                    ? "border-(--tc-accent)/50 bg-(--tc-accent)/10 text-(--tc-accent)"
                    : "border-(--tc-border)/60 bg-white text-(--tc-text-muted)"
                }`}
              >
                {app}
              </span>
            ))}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-(--tc-border)/50 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">Runs</div>
            <div className="mt-1 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">{scope.releasesCount}</div>
            <div className="text-[11px] text-(--tc-text-muted)">no periodo</div>
          </div>
          <div className="rounded-2xl border border-(--tc-border)/50 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">Releases em risco</div>
            <div className="mt-1 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">{scope.releasesAtRisk}</div>
            <div className="text-[11px] text-(--tc-text-muted)">gate quebrado</div>
          </div>
          <div className="rounded-2xl border border-(--tc-border)/50 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">Defeitos abertos</div>
            <div className="mt-1 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">{scope.openDefects == null ? "â€”" : scope.openDefects}</div>
            <div className="text-[11px] text-(--tc-text-muted)">Qase</div>
          </div>
          <div className="rounded-2xl border border-(--tc-border)/50 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">Ultima execucao</div>
            <div className="mt-1 truncate text-sm font-semibold text-(--tc-text-primary,#0b1a3c)" title={latestTitle}>
              {latestTitle}
            </div>
            <div className="text-[11px] text-(--tc-text-muted)">{formatDate(scope.latest?.createdAt)}</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Distribuicao de status</h3>
              <span className="text-[11px] text-(--tc-text-muted)">Total {total}</span>
            </div>
            <MiniStatusBar stats={scope.stats} />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Trend (pass rate)</h3>
            </div>
            <Sparkline points={scope.trendPoints} />
          </div>
        </div>

        <div className="text-[11px] text-(--tc-text-muted)">
          Gate: Pass {percent(scope.stats.pass, Math.max(total, 1))}% Â· Fail {percent(scope.stats.fail, Math.max(total, 1))}% Â· Blocked {percent(scope.stats.blocked, Math.max(total, 1))}% Â· Not Run {percent(scope.stats.notRun, Math.max(total, 1))}%
        </div>
      </div>
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
  const exportCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActiveApp = (value: string) => (activeApp ?? "").toLowerCase() === value.toLowerCase();

  const releases = useMemo(() => filterReleasesByApp(company.releases ?? [], activeApp), [company.releases, activeApp]);
  const stats = useMemo(() => (activeApp ? aggregateStats(releases) : company.stats), [activeApp, releases, company.stats]);
  const total = sumStats(stats);
  const passRate = activeApp ? computePassRateFromStats(stats) : company.passRate;

  const releasesAtRisk = useMemo(() => {
    return (releases ?? []).filter((r) => r?.gate?.status === "failed").length;
  }, [releases]);

  const appsFromReleases = useMemo(() => extractAppsFromReleases(company.releases ?? []), [company.releases]);
  const apps = useMemo(() => {
    const merged = new Set<string>(appsFromReleases);
    (defects?.appsFromDefects ?? []).forEach((a) => merged.add(a));
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
    const maxPoints = 10;
    const points = sortedForTrend
      .slice(0, maxPoints)
      .reverse()
      .map((r) => (typeof r.passRate === "number" ? r.passRate : null));
    return points.length ? points : [null];
  }, [sortedForTrend]);

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

  const exportScopes = useMemo<ExportScope[]>(() => {
    const buildScope = (app: string | null): ExportScope => {
      const scopedReleases = filterReleasesByApp(company.releases ?? [], app);
      const scopedStats = app ? aggregateStats(scopedReleases) : company.stats;
      const scopedPassRate = app ? computePassRateFromStats(scopedStats) : company.passRate;
      const sorted = [...scopedReleases].sort((a, b) => (b.createdAtValue ?? 0) - (a.createdAtValue ?? 0));
      const latestScope = app
        ? (sorted[0]
            ? { slug: sorted[0].slug, title: sorted[0].title, createdAt: sorted[0].createdAt ?? sorted[0].created_at }
            : null)
        : (company.latestRelease ?? null);

      return {
        key: app ?? "__all__",
        app,
        stats: scopedStats,
        total: sumStats(scopedStats),
        passRate: scopedPassRate,
        releasesCount: scopedReleases.length,
        releasesAtRisk: scopedReleases.filter((r) => r?.gate?.status === "failed").length,
        openDefects: app ? (defects?.openByApp[app] ?? 0) : defects?.openTotal ?? null,
        latest: latestScope,
        trendPoints: sorted
          .slice(0, 10)
          .reverse()
          .map((r) => (typeof r.passRate === "number" ? r.passRate : null)),
      };
    };

    return [buildScope(null), ...apps.map((app) => buildScope(app))];
  }, [apps, company.latestRelease, company.passRate, company.releases, company.stats, defects?.openByApp, defects?.openTotal]);

  async function handleExportPdf() {
    try {
      setExportingPdf(true);
      const [{ jsPDF }, html2canvasModule] = await Promise.all([import("jspdf"), import("html2canvas")]);
      const html2canvas = html2canvasModule.default;
      const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 18;
      const marginY = 18;
      const maxWidth = pageWidth - marginX * 2;
      const maxHeight = pageHeight - marginY * 2;

      for (let index = 0; index < exportScopes.length; index += 1) {
        const scope = exportScopes[index];
        const node = exportCardRefs.current[scope.key];
        if (!node) continue;

        const canvas = await html2canvas(node, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: node.scrollWidth,
          windowHeight: node.scrollHeight,
        });

        const image = canvas.toDataURL("image/png");
        const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
        const renderWidth = canvas.width * scale;
        const renderHeight = canvas.height * scale;
        const offsetX = marginX + (maxWidth - renderWidth) / 2;
        const offsetY = marginY + (maxHeight - renderHeight) / 2;

        if (index > 0) doc.addPage();
        doc.addImage(image, "PNG", offsetX, offsetY, renderWidth, renderHeight, undefined, "FAST");
      }

      doc.save(`metricas-${(company.slug ?? company.name).toString().replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div
      className={`rounded-[28px] border bg-white shadow-sm transition ${
        focused ? "border-(--tc-accent)/50 shadow-[0_18px_40px_rgba(239,0,1,0.12)]" : "border-(--tc-border)/60"
      }`}
    >
      <div className="p-6 md:p-7 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-(--tc-text-muted)">Empresa</p>
            <h2 className="mt-1 text-xl md:text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c) truncate" title={company.name}>
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
              {company.active === false && (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                  Inativa
                </span>
              )}
            </div>
            <div className="mt-2 inline-flex items-center rounded-full border border-(--tc-border)/60 bg-slate-50 px-3 py-1 text-[11px] font-medium text-(--tc-text-muted)">
              Dados: {dataAgeLabel}
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-end gap-2">
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">Pass rate</div>
              <div className="text-3xl font-extrabold text-(--tc-accent,#ef0001)">{passRate == null ? "—" : `${passRate}%`}</div>
            </div>
          </div>
        </div>

        {apps.length > 0 && (
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
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-(--tc-border)/50 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">Runs</div>
            <div className="mt-1 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">{releases.length}</div>
            <div className="text-[11px] text-(--tc-text-muted)">no período</div>
          </div>
          <div className="rounded-2xl border border-(--tc-border)/50 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">Releases em risco</div>
            <div className="mt-1 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">{releasesAtRisk}</div>
            <div className="text-[11px] text-(--tc-text-muted)">gate quebrado</div>
          </div>
          <div className="rounded-2xl border border-(--tc-border)/50 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">Defeitos abertos</div>
            <div className="mt-1 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">{openDefects == null ? "—" : openDefects}</div>
            <div className="text-[11px] text-(--tc-text-muted)">{defects?.loaded ? "Qase" : "carregando…"}</div>
          </div>
          <div className="rounded-2xl border border-(--tc-border)/50 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">Última execução</div>
            <div className="mt-1 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) truncate" title={latest?.title ?? latest?.slug ?? ""}>
              {latest?.title ?? latest?.slug ?? "—"}
            </div>
            <div className="text-[11px] text-(--tc-text-muted)">{formatDate(latest?.createdAt)}</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Distribuição de status</h3>
              <span className="text-[11px] text-(--tc-text-muted)">Total {total}</span>
            </div>
            <MiniStatusBar stats={stats} />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Trend (pass rate)</h3>
              <span className="text-[11px] text-(--tc-text-muted)">
                {company.trend.direction === "up" ? "+" : company.trend.direction === "down" ? "-" : ""}
                {Math.abs(company.trend.delta)}pp
              </span>
            </div>
            <Sparkline points={trendPoints} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-[11px] text-(--tc-text-muted)">
            Gate: Pass {company.gate.passRate}% · Fail {company.gate.failRate}% · Blocked {company.gate.blockedRate}% · Not Run {company.gate.notRunRate}%
          </div>

          {companySlug ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleExportPdf()}
                disabled={exportingPdf}
                className="inline-flex items-center gap-2 rounded-xl border border-(--tc-border)/60 bg-white px-4 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                title="Exportar card e aplicações em PDF"
                aria-label="Exportar card e aplicações em PDF"
              >
                <FiFileText size={16} />
                <span>{exportingPdf ? "Gerando PDF" : "PDF"}</span>
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
                Ver releases
              </Link>
            </div>
          ) : (
            <div className="text-sm text-(--tc-text-muted)">Empresa sem slug</div>
          )}
        </div>
      </div>
      <div aria-hidden="true" className="fixed -left-[200vw] top-0 z-[-1] flex flex-col gap-6">
        {exportScopes.map((scope) => (
          <div
            key={scope.key}
            ref={(node) => {
              exportCardRefs.current[scope.key] = node;
            }}
            className="w-[920px] bg-white p-4"
          >
            <ExportScopePreview
              companyName={company.name}
              tone={tone}
              periodDays={periodDays}
              dataAgeLabel={scope.latest?.createdAt ? formatDataAge(scope.latest.createdAt) : dataAgeLabel}
              apps={apps}
              scope={scope}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
