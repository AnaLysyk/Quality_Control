"use client";

import Link from "next/link";
import { useMemo } from "react";

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
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-[--tc-border]/40">
        <div className="h-full flex">
          <div className={`h-full ${w(pass)} bg-[--tc-pass]`} />
          <div className={`h-full ${w(fail)} bg-[--tc-fail]`} />
          <div className={`h-full ${w(blocked)} bg-[--tc-blocked]`} />
          <div className={`h-full ${w(notRun)} bg-[--tc-notrun]`} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-[--tc-text-muted]">
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
    return <div className="h-10 rounded-xl bg-slate-50 border border-[--tc-border]/40" />;
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
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full rounded-xl bg-slate-50 border border-[--tc-border]/40">
      <path d={path} fill="none" stroke="var(--tc-accent)" strokeWidth="2" />
    </svg>
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

  const tone = toneFromGate(company.gate.status);

  const companySlug = company.slug ?? null;

  return (
    <div
      className={`rounded-[28px] border bg-white shadow-sm transition ${
        focused ? "border-[--tc-accent]/50 shadow-[0_18px_40px_rgba(239,0,1,0.12)]" : "border-[--tc-border]/60"
      }`}
    >
      <div className="p-6 md:p-7 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[--tc-text-muted]">Empresa</p>
            <h2 className="mt-1 text-xl md:text-2xl font-extrabold text-[--tc-text-primary] truncate" title={company.name}>
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
              <span className="text-[11px] text-[--tc-text-muted]">Janela: {periodDays}d</span>
              {company.active === false && (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                  Inativa
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-end gap-2">
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[--tc-text-muted]">Pass rate</div>
              <div className="text-3xl font-extrabold text-[--tc-accent]">{passRate == null ? "—" : `${passRate}%`}</div>
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
                  ? "border-[--tc-accent]/50 bg-[--tc-accent]/10 text-[--tc-accent]"
                  : "border-[--tc-border]/60 bg-white text-[--tc-text-muted] hover:bg-slate-50"
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
                    ? "border-[--tc-accent]/50 bg-[--tc-accent]/10 text-[--tc-accent]"
                    : "border-[--tc-border]/60 bg-white text-[--tc-text-muted] hover:bg-slate-50"
                }`}
              >
                {app}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-[--tc-border]/50 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[--tc-text-muted]">Runs</div>
            <div className="mt-1 text-2xl font-extrabold text-[--tc-text-primary]">{releases.length}</div>
            <div className="text-[11px] text-[--tc-text-muted]">no período</div>
          </div>
          <div className="rounded-2xl border border-[--tc-border]/50 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[--tc-text-muted]">Releases em risco</div>
            <div className="mt-1 text-2xl font-extrabold text-[--tc-text-primary]">{releasesAtRisk}</div>
            <div className="text-[11px] text-[--tc-text-muted]">gate quebrado</div>
          </div>
          <div className="rounded-2xl border border-[--tc-border]/50 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[--tc-text-muted]">Defeitos abertos</div>
            <div className="mt-1 text-2xl font-extrabold text-[--tc-text-primary]">{openDefects == null ? "—" : openDefects}</div>
            <div className="text-[11px] text-[--tc-text-muted]">{defects?.loaded ? "Qase" : "carregando…"}</div>
          </div>
          <div className="rounded-2xl border border-[--tc-border]/50 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[--tc-text-muted]">Última execução</div>
            <div className="mt-1 text-sm font-semibold text-[--tc-text-primary] truncate" title={latest?.title ?? latest?.slug ?? ""}>
              {latest?.title ?? latest?.slug ?? "—"}
            </div>
            <div className="text-[11px] text-[--tc-text-muted]">{formatDate(latest?.createdAt)}</div>
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
              <Link
                href={`/empresas/${encodeURIComponent(companySlug)}/home`}
                className="rounded-xl border border-[--tc-border]/60 bg-white px-4 py-2 text-sm font-semibold text-[--tc-text-primary] hover:bg-slate-50"
              >
                Abrir empresa
              </Link>
              <Link
                href={`/empresas/${encodeURIComponent(companySlug)}/releases`}
                className="rounded-xl bg-[--tc-accent] px-4 py-2 text-sm font-semibold text-white hover:bg-[--tc-accent]"
              >
                Ver releases
              </Link>
            </div>
          ) : (
            <div className="text-sm text-[--tc-text-muted]">Empresa sem slug</div>
          )}
        </div>
      </div>
    </div>
  );
}
