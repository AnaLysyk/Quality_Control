"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
const CompanyMetricsCard = dynamic(() => import("@/components/CompanyMetricsCard"), { ssr: false, loading: () => <div>Carregando métricas...</div> });
import type { DefectsSummary } from "@/components/CompanyMetricsCard";
import { extractMessageFromJson, extractRequestIdFromJson, formatMessageWithRequestId, unwrapEnvelopeData } from "@/lib/apiEnvelope";

type Stats = { pass: number; fail: number; blocked: number; notRun: number };

type TrendPoint = { label: string; value: number | null; total: number; failRate: number | null; blockedRate: number | null };

type GateStatus = "approved" | "warning" | "failed" | "no_data";

type ReleaseRow = {
  slug?: string;
  title?: string;
  createdAt?: string;
  created_at?: string;
  createdAtValue?: number;
  order?: string[];
  app?: string;
  project?: string;
  passRate?: number | null;
  gate?: { status?: GateStatus };
};

type CompanyRow = {
  id: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
  active?: boolean | null;
  releases: ReleaseRow[];
  stats: Stats;
  passRate: number | null;
  gate: {
    status: GateStatus;
    total: number;
    passRate: number;
    failRate: number;
    blockedRate: number;
    notRunRate: number;
  };
  trend: { direction: "up" | "down" | "flat"; delta: number };
  latestRelease?: { slug?: string; title?: string; createdAt?: string };
};

type OverviewResponse = {
  companies: CompanyRow[];
  period: number;
  coverage: { total: number; withStats: number; percent: number };
  releaseCount: number;
  releaseGateCounts: Record<string, number>;
  releaseRiskCount: number;
  releaseWarningCount: number;
  globalStats: Stats;
  globalPassRate: number | null;
  passRateTone: "good" | "warn" | "neutral";
  gateCounts: Record<string, number>;
  riskCount: number;
  warningCount: number;
  trendPoints: TrendPoint[];
  trendSummary: { direction: "up" | "down" | "flat"; delta: number };
};

type CompanyDefectItem = { app?: string; kanbanStatus?: string };
type CompanyDefectsResponse = { defects?: CompanyDefectItem[]; error?: string };

type AdminDefectItem = {
  id: string;
  title: string;
  status: string;
  severity?: string;
  created_at?: string;
  updated_at?: string;
  url?: string;
  projectCode: string;
  tags?: string[];
};

type AdminDefectsResponse = {
  total: number;
  byStatus: { status: string; count: number }[];
  items: AdminDefectItem[];
  error?: string;
};

function normalizeQuery(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeAppLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 4 && trimmed === trimmed.toUpperCase()) return trimmed;
  if (trimmed.length <= 3) return trimmed.toUpperCase();
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function formatDate(iso?: string) {
  if (!iso) return "-";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "-";
  return new Date(time).toLocaleDateString("pt-BR");
}

function gateLabel(status: GateStatus) {
  if (status === "approved") return "Estavel";
  if (status === "warning") return "Atencao";
  if (status === "failed") return "Risco";
  return "Sem dados";
}

function isDefectOpen(statusRaw: string) {
  const st = (statusRaw ?? "").toString().toLowerCase();
  if (!st) return true;
  return !(st.includes("resolve") || st.includes("closed") || st.includes("done") || st.includes("approved") || st.includes("aprovado"));
}

function isCriticalSeverity(severityRaw?: string) {
  const s = (severityRaw ?? "").toString().toLowerCase().trim();
  if (!s) return false;
  // Keep strict to avoid inventing severity thresholds.
  return s.includes("critical") || s.includes("blocker");
}

function GlobalTrendSparkline({ points }: { points: TrendPoint[] }) {
  const validPoints = points.filter((point) => typeof point.value === "number" && Number.isFinite(point.value));
  if (!validPoints.length) {
    return (
      <div className="flex h-44 items-center justify-center rounded-2xl border border-white/18 bg-white/12 text-[11px] font-medium text-white/68">
        Sem série de pass rate na janela
      </div>
    );
  }

  const QUALITY_TARGET = 85;
  const w = 780;
  const h = 180;
  const left = 42;
  const right = 72;
  const top = 12;
  const bottom = 30;
  const plotRight = w - right;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const displayPoints = validPoints;
  const ticks = [100, 85, 70, 50, 0];
  const toX = (i: number) => {
    if (displayPoints.length <= 1) return left + plotW / 2;
    return left + (i * plotW) / (displayPoints.length - 1);
  };
  const toY = (value: number) => top + ((100 - value) / 100) * plotH;

  const coords = displayPoints
    .map((point, index) => {
      if (typeof point.value !== "number" || !Number.isFinite(point.value)) return null;
      return { point, x: toX(index), y: toY(point.value) };
    })
    .filter((entry): entry is { point: TrendPoint; x: number; y: number } => Boolean(entry));

  const path = coords
    .map((entry, index) => `${index === 0 ? "M" : "L"}${entry.x.toFixed(1)} ${entry.y.toFixed(1)}`)
    .join(" ");

  const area = coords.length
    ? `${path} L${coords[coords.length - 1].x.toFixed(1)} ${(top + plotH).toFixed(1)} L${coords[0].x.toFixed(1)} ${(top + plotH).toFixed(1)} Z`
    : "";

  const zoneY = {
    healthy: toY(100),
    attention: toY(85),
    risk: toY(70),
    floor: toY(0),
  };
  const zoneLabelDisplayX = plotRight - 10;
  const zoneLabelY = {
    healthy: (zoneY.healthy + zoneY.attention) / 2,
    attention: (zoneY.attention + zoneY.risk) / 2,
    risk: (zoneY.risk + zoneY.floor) / 2,
  };
  const currentPoint = coords[coords.length - 1] ?? null;
  const currentTone =
    !currentPoint || (currentPoint.point.value ?? 0) >= 85
      ? "rgba(16,185,129,0.96)"
      : (currentPoint.point.value ?? 0) >= 70
        ? "rgba(245,158,11,0.96)"
        : "rgba(239,68,68,0.96)";

  return (
    <div className="rounded-2xl border border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full">
        <rect x={left} y={zoneY.healthy} width={plotW} height={zoneY.attention - zoneY.healthy} rx="12" fill="rgba(16,185,129,0.22)" />
        <rect x={left} y={zoneY.attention} width={plotW} height={zoneY.risk - zoneY.attention} rx="12" fill="rgba(245,158,11,0.2)" />
        <rect x={left} y={zoneY.risk} width={plotW} height={zoneY.floor - zoneY.risk} rx="12" fill="rgba(239,68,68,0.18)" />

        <text x={zoneLabelDisplayX} y={zoneLabelY.healthy} textAnchor="end" dominantBaseline="middle" fontSize="11" fontWeight="700" fill="rgba(220,252,231,0.96)">Saudável</text>
        <text x={zoneLabelDisplayX} y={zoneLabelY.attention} textAnchor="end" dominantBaseline="middle" fontSize="11" fontWeight="700" fill="rgba(254,243,199,0.96)">Atenção</text>
        <text x={zoneLabelDisplayX} y={zoneLabelY.risk} textAnchor="end" dominantBaseline="middle" fontSize="11" fontWeight="700" fill="rgba(254,226,226,0.96)">Risco</text>

        {ticks.map((tick) => {
          const y = toY(tick);
          return (
            <g key={tick}>
              <line x1={left} y1={y} x2={plotRight} y2={y} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
              <text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,0.72)">
                {tick}%
              </text>
            </g>
          );
        })}

        <line
          x1={left}
          y1={toY(QUALITY_TARGET)}
          x2={plotRight}
          y2={toY(QUALITY_TARGET)}
          stroke="rgba(255,255,255,0.78)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
        <text x={left + 8} y={toY(QUALITY_TARGET) - 8} textAnchor="start" fontSize="11" fontWeight="700" fill="rgba(255,255,255,0.9)">
          Meta 85%
        </text>

        {area ? <path d={area} fill="rgba(255,255,255,0.12)" /> : null}
        <path d={path} fill="none" stroke="rgba(219,234,254,0.98)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

        {coords.map((entry, index) => (
          <g key={`${entry.x}-${entry.y}-${index}`}>
            {index === coords.length - 1 ? (
              <circle cx={entry.x} cy={entry.y} r="8" fill="rgba(255,255,255,0.18)" />
            ) : null}
            <circle
              cx={entry.x}
              cy={entry.y}
              r={index === coords.length - 1 ? 5.5 : 4}
              fill={index === coords.length - 1 ? currentTone : "var(--tc-accent,#ef0001)"}
              stroke="rgba(255,255,255,0.96)"
              strokeWidth={index === coords.length - 1 ? "2" : "1.5"}
            />
            <title>{`${entry.point.label} | pass rate ${entry.point.value ?? 0}% | runs ${entry.point.total} | falhas ${entry.point.failRate ?? 0}% | bloqueados ${entry.point.blockedRate ?? 0}%${entry.point.value === 0 ? " | sem aprovações nesta janela" : ""}`}</title>
          </g>
        ))}

        {displayPoints.map((point, index) => (
          <text
            key={`${point.label}-${index}`}
            x={toX(index)}
            y={h - 8}
            textAnchor={index === 0 ? "start" : index === displayPoints.length - 1 ? "end" : "middle"}
            fontSize="11"
            fill="rgba(255,255,255,0.72)"
          >
            {point.label}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-white/78">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-white" />Pass rate</span>
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-white/80 bg-[repeating-linear-gradient(to_right,currentColor_0,currentColor_4px,transparent_4px,transparent_8px)]" />Meta 85%</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />Saudável</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />Atenção</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />Risco</span>
      </div>
    </div>
  );
}

export default function TestMetricPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  const handleUnauthorized = useCallback(() => {
    setError("Sessao expirada. Faca login novamente.");
    router.replace("/login");
  }, [router]);

  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeAppByCompany, setActiveAppByCompany] = useState<Record<string, string | null>>({});

  const [defectsBySlug, setDefectsBySlug] = useState<Record<string, DefectsSummary>>({});
  const loadedDefectsRef = useRef<Set<string>>(new Set());
  const [globalDefects, setGlobalDefects] = useState<{ loaded: boolean; criticalOpen: number | null; error?: string | null }>(
    { loaded: false, criticalOpen: null, error: null }
  );
  const carouselRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/quality/overview?period=${period}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (res.status === 401) {
          handleUnauthorized();
          return;
        }
        const raw = await res.json().catch(() => null);
        const json = unwrapEnvelopeData<OverviewResponse>(raw);
        if (!res.ok || !json) {
          const message = extractMessageFromJson(raw) || `Erro ao carregar metricas (${res.status})`;
          const requestId = extractRequestIdFromJson(raw) || res.headers.get("x-request-id") || null;
          throw new Error(formatMessageWithRequestId(message, requestId));
        }
        setOverview(json);
        setActiveIndex(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar metricas");
        setOverview(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period, handleUnauthorized]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/defeitos", { cache: "no-store", credentials: "include" });
        if (res.status === 401) {
          if (!cancelled) handleUnauthorized();
          return;
        }
        const raw = await res.json().catch(() => null);
        const json = unwrapEnvelopeData<AdminDefectsResponse>(raw);
        if (!res.ok || !json) {
          if (!cancelled) setGlobalDefects({ loaded: true, criticalOpen: null, error: "Defeitos indisponíveis no momento" });
          return;
        }
        if (typeof json.error === "string" && json.error) {
          if (!cancelled) setGlobalDefects({ loaded: true, criticalOpen: 0, error: "Integração de defeitos indisponível neste ambiente" });
          return;
        }
        const items = Array.isArray(json.items) ? json.items : [];
        const criticalOpen = items.filter((d) => isCriticalSeverity(d.severity) && isDefectOpen(d.status)).length;
        if (!cancelled) setGlobalDefects({ loaded: true, criticalOpen, error: null });
      } catch {
        if (!cancelled) setGlobalDefects({ loaded: true, criticalOpen: null, error: "Defeitos indisponíveis no momento" });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [handleUnauthorized]);

  const companies = useMemo(() => {
    const list = overview?.companies ?? [];
    return list.filter((c) => c.active !== false);
  }, [overview]);

  const companyCounts = useMemo(() => {
    const total = companies.length;
    const stable = companies.filter((c) => c.gate.status === "approved").length;
    const attention = companies.filter((c) => c.gate.status === "warning").length;
    const risk = companies.filter((c) => c.gate.status === "failed").length;
    const noData = companies.filter((c) => c.gate.status === "no_data").length;
    return { total, stable, attention, risk, noData };
  }, [companies]);

  const releaseRiskCount = useMemo(() => {
    let count = 0;
    companies.forEach((c) => {
      (c.releases ?? []).forEach((r) => {
        if (r?.gate?.status === "failed") count += 1;
      });
    });
    return count;
  }, [companies]);

  const globalTrendMeta = useMemo(() => {
    const source = overview?.trendPoints ?? [];
    const valid = source.filter((point) => typeof point.value === "number" && Number.isFinite(point.value));
    if (!valid.length) return null;

    const first = valid[0];
    const last = valid[valid.length - 1];
    const worst = valid.reduce((currentWorst, point) => ((point.value ?? 0) < (currentWorst.value ?? 0) ? point : currentWorst), valid[0]);

    return { first, last, worst };
  }, [overview]);

  const attentionNow = useMemo(() => {
    const now = Date.now();
    const staleDays = period <= 7 ? 3 : 7;
    const staleBefore = now - staleDays * 24 * 60 * 60 * 1000;

    const companiesNeedingAttention = companies
      .filter((c) => c.gate.status === "failed" || c.gate.status === "warning")
      .sort((a, b) => (a.gate.status === "failed" ? -1 : 0) - (b.gate.status === "failed" ? -1 : 0));

    const staleRiskReleases: Array<{ company: CompanyRow; release: ReleaseRow; status: GateStatus }> = [];
    companies.forEach((company) => {
      (company.releases ?? []).forEach((release) => {
        const st = release?.gate?.status ?? "no_data";
        const createdAtValue = release.createdAtValue ?? 0;
        if (st === "failed" && createdAtValue > 0 && createdAtValue < staleBefore) {
          staleRiskReleases.push({ company, release, status: st });
        }
      });
    });

    staleRiskReleases.sort((a, b) => (a.release.createdAtValue ?? 0) - (b.release.createdAtValue ?? 0));

    return { companiesNeedingAttention, staleRiskReleases, staleDays };
  }, [companies, period]);

  const activeCompany = companies[activeIndex] ?? null;
  const activeCompanySlug = activeCompany?.slug ?? null;

  useEffect(() => {
    const slug = typeof activeCompanySlug === "string" ? activeCompanySlug : null;
    if (!slug) return;
    if (loadedDefectsRef.current.has(slug)) return;

    loadedDefectsRef.current.add(slug);
    let cancelled = false;

    const run = async () => {
      setDefectsBySlug((prev) => {
        if (prev[slug]) return prev;
        return {
          ...prev,
          [slug]: { loaded: false, openTotal: null, openByApp: {}, appsFromDefects: [] },
        };
      });

      try {
        const res = await fetch(`/api/empresas/${encodeURIComponent(slug)}/defeitos`, { cache: "no-store", credentials: "include" });
        if (res.status === 401) {
          if (!cancelled) handleUnauthorized();
          return;
        }
        const json = (await res.json().catch(() => null)) as CompanyDefectsResponse | null;
        if (!res.ok || !json || json.error) return;

        const items = Array.isArray(json.defects) ? json.defects : [];
        const openByApp: Record<string, number> = {};
        const appSet = new Set<string>();
        let openTotal = 0;
        items.forEach((d) => {
          const raw = typeof d.app === "string" && d.app.trim() ? d.app.trim() : "Sem aplicação";
          const app = normalizeAppLabel(raw) ?? raw;
          appSet.add(app);
          const st = (d.kanbanStatus ?? "").toString().toLowerCase();
          const isOpen = st !== "aprovado";
          if (isOpen) {
            openTotal += 1;
            openByApp[app] = (openByApp[app] ?? 0) + 1;
          }
        });

        if (cancelled) return;
        setDefectsBySlug((prev) => ({
          ...prev,
          [slug]: {
            loaded: true,
            openTotal,
            openByApp,
            appsFromDefects: Array.from(appSet),
          },
        }));
      } catch {
        // ignore (keep placeholder)
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [activeCompanySlug, handleUnauthorized]);

  const focusCompany = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(companies.length - 1, index));
    setActiveIndex(clamped);
    const el = carouselRef.current?.querySelector<HTMLDivElement>(`[data-carousel-index="${clamped}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [companies.length]);

  const searchResult = useMemo(() => {
    const q = normalizeQuery(search);
    if (!q) return null;

    for (let i = 0; i < companies.length; i += 1) {
      const c = companies[i];
      const name = normalizeQuery(c.name ?? "");
      if (name.includes(q)) return { index: i, app: null as string | null };

      const releases = Array.isArray(c.releases) ? c.releases : [];
      for (const r of releases) {
        const title = normalizeQuery(String(r.title ?? ""));
        const slug = normalizeQuery(String(r.slug ?? ""));
        if (title.includes(q) || slug.includes(q)) return { index: i, app: null as string | null };
        const order = Array.isArray(r.order) ? r.order : [];
        for (const o of order) {
          const app = normalizeQuery(String(o ?? ""));
          if (app && app.includes(q)) {
            const raw = String(o ?? "");
            const label = normalizeAppLabel(raw) ?? raw;
            return { index: i, app: label };
          }
        }
      }

      // Best-effort: if defects already loaded for this company, allow app match.
      const slugKey = typeof c.slug === "string" ? c.slug : null;
      if (slugKey && defectsBySlug[slugKey]?.loaded) {
        const apps = defectsBySlug[slugKey]?.appsFromDefects ?? [];
        for (const a of apps) {
          if (normalizeQuery(a).includes(q)) return { index: i, app: a };
        }
      }
    }
    return null;
  }, [search, companies, defectsBySlug]);

  useEffect(() => {
    if (!searchResult) return;
    focusCompany(searchResult.index);
    const company = companies[searchResult.index];
    if (searchResult.app && company?.id) {
      setActiveAppByCompany((prev) => ({ ...prev, [company.id]: searchResult.app }));
    }
  }, [searchResult, focusCompany, companies]);

  return (
    <div className="min-h-screen bg-linear-to-b from-(--page-bg,#f8f8fb) to-(--page-bg,#f0f4ff) text-(--page-text,#0b1a3c)">
        <div className="mx-auto w-full max-w-none px-4 py-8 sm:px-6 lg:px-10 xl:px-12 2xl:px-14 space-y-8">
          <section className="tc-hero-panel">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.5em] text-white/80">Admin · Métricas</p>
                <h1 className="text-4xl md:text-5xl font-extrabold text-white">
                  Visão global multiempresa
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-white/85">
                  Entenda a saúde de qualidade de todas as empresas em segundos. Busque e compare sem trocar de tela.
                </p>
              </div>

              <div className="flex flex-col gap-2 md:items-end">
                <div className="inline-flex rounded-full border border-white/15 bg-white/10 p-1 shadow-[0_14px_34px_rgba(1,24,72,0.24)] backdrop-blur-sm">
                  {[7, 30, 90].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setPeriod(days as 7 | 30 | 90)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        period === days
                          ? "bg-white text-(--tc-primary,#011848)"
                          : "text-white/75 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
                <div className="text-xs font-medium text-white/80">Última execução: {formatDate(activeCompany?.latestRelease?.createdAt)}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl border border-white/12 bg-white/10 p-5 text-white shadow-[0_14px_34px_rgba(1,24,72,0.24)] backdrop-blur-sm">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/70">Empresas monitoradas</div>
                <div className="mt-1 text-3xl font-extrabold text-white">{companyCounts.total}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">🟢 {companyCounts.stable}</span>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-700">🟡 {companyCounts.attention}</span>
                  <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 font-semibold text-red-700">🔴 {companyCounts.risk}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-700">Sem dados {companyCounts.noData}</span>
                </div>
              </div>

              <div className="rounded-3xl border border-white/12 bg-white/10 p-5 text-white shadow-[0_14px_34px_rgba(1,24,72,0.24)] backdrop-blur-sm">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/70">Pass rate global</div>
                <div className="mt-1 text-3xl font-extrabold text-white">
                  {overview?.globalPassRate == null ? "—" : `${overview.globalPassRate}%`}
                </div>
                <div className="mt-2 text-xs text-white/75">
                  Cobertura: {overview?.coverage?.percent ?? 0}% ({overview?.coverage?.withStats ?? 0}/{overview?.coverage?.total ?? 0})
                </div>
              </div>

              <div className="rounded-3xl border border-white/12 bg-white/10 p-5 text-white shadow-[0_14px_34px_rgba(1,24,72,0.24)] backdrop-blur-sm">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/70">Releases em risco</div>
                <div className="mt-1 text-3xl font-extrabold text-white">{releaseRiskCount}</div>
                <div className="mt-2 text-xs font-medium text-white/78">no período ({period}d)</div>
              </div>

              <div className="rounded-3xl border border-white/12 bg-white/10 p-5 text-white shadow-[0_14px_34px_rgba(1,24,72,0.24)] backdrop-blur-sm">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/72">Defeitos críticos abertos</div>
                <div className="mt-1 text-3xl font-extrabold text-white">
                  {!globalDefects.loaded ? "…" : globalDefects.criticalOpen == null ? "—" : globalDefects.criticalOpen}
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-white/78">{globalDefects.error ? globalDefects.error : "Fonte: Qase (global)"}</div>
                  <Link
                    href="/admin/defeitos"
                    className="shrink-0 rounded-full border border-white/15 bg-white/12 px-3 py-2 text-xs font-semibold text-white hover:bg-white/18"
                  >
                    Abrir
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-white/12 bg-white/10 p-5 space-y-2 text-white shadow-[0_14px_34px_rgba(1,24,72,0.24)] backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/72">Qualidade por janela</div>
                <div className="text-xs font-medium text-white/78">
                  {(overview?.trendSummary?.delta ?? 0) === 0
                    ? "Sem variação"
                    : `${overview?.trendSummary?.direction === "up" ? "+" : "-"}${Math.abs(overview?.trendSummary?.delta ?? 0)} pp`}
                </div>
              </div>
              <GlobalTrendSparkline points={overview?.trendPoints ?? []} />
              {globalTrendMeta ? (
                <div className="grid gap-2 pt-1 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/12 bg-white/8 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/60">Primeira leitura</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {`${globalTrendMeta.first.value ?? 0}%`}
                    </div>
                    <div className="text-[11px] text-white/68">
                      {globalTrendMeta.first.label} · {globalTrendMeta.first.total} runs
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-white/8 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/60">Pior ponto do período</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {`${globalTrendMeta.worst.value ?? 0}%`}
                    </div>
                    <div className="text-[11px] text-white/68">
                      {globalTrendMeta.worst.label} · falhas {globalTrendMeta.worst.failRate ?? 0}% · bloqueados {globalTrendMeta.worst.blockedRate ?? 0}%
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-white/8 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/60">Última leitura</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {`${globalTrendMeta.last.value ?? 0}%`}
                    </div>
                    <div className="text-[11px] text-white/68">
                      {globalTrendMeta.last.label} · falhas {globalTrendMeta.last.failRate ?? 0}% · bloqueados {globalTrendMeta.last.blockedRate ?? 0}%
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="tc-panel space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Empresas</h2>
                <p className="text-sm font-medium text-(--tc-text-primary,#0b1a3c)/82">
                  Busque por empresa, aplicação ou release. O carrossel foca automaticamente.
                </p>
              </div>

              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar empresa, aplicação ou release"
                className="w-full md:w-105 rounded-2xl border border-(--tc-border)/60 bg-white px-4 py-3 text-sm text-(--tc-text,#0f172a) placeholder:text-(--tc-text-muted) focus:border-(--tc-accent) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/30"
              />
            </div>

            {loading && <p className="text-sm text-(--tc-text-muted)">Carregando métricas...</p>}
            {error && !loading && <p className="text-sm text-red-600">{error}</p>}

            {!loading && !error && companies.length === 0 && (
              <div className="rounded-2xl border border-dashed border-(--tc-border)/60 bg-white p-6 text-sm text-(--tc-text-muted)">
                Nenhuma empresa encontrada.
              </div>
            )}

            {!loading && !error && companies.length > 0 && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => focusCompany(activeIndex - 1)}
                    className="rounded-2xl border border-(--tc-border)/60 bg-white px-4 py-3 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) hover:bg-slate-50 disabled:opacity-40"
                    disabled={activeIndex <= 0}
                    aria-label="Empresa anterior"
                  >
                    ←
                  </button>
                  <div className="text-sm text-(--tc-text-muted)">
                    {activeIndex + 1} / {companies.length}
                  </div>
                  <button
                    type="button"
                    onClick={() => focusCompany(activeIndex + 1)}
                    className="rounded-2xl border border-(--tc-border)/60 bg-white px-4 py-3 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) hover:bg-slate-50 disabled:opacity-40"
                    disabled={activeIndex >= companies.length - 1}
                    aria-label="Próxima empresa"
                  >
                    →
                  </button>
                </div>

                <div
                  ref={carouselRef}
                  className="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2"
                >
                  {companies.map((company, index) => {
                    const slug = typeof company.slug === "string" ? company.slug : null;
                    const defects = slug ? defectsBySlug[slug] : undefined;
                    const activeAppForCompany = activeAppByCompany[company.id] ?? null;

                    return (
                      <div
                        key={company.id}
                        data-carousel-index={index}
                        className="flex h-full flex-none w-full snap-center md:w-200 lg:w-216 xl:w-232"
                        onFocus={() => setActiveIndex(index)}
                      >
                        <CompanyMetricsCard
                          company={company}
                          periodDays={period}
                          defects={defects}
                          focused={index === activeIndex}
                          activeApp={activeAppForCompany}
                          onSelectApp={(app) => setActiveAppByCompany((prev) => ({ ...prev, [company.id]: app }))}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {companies.map((c, idx) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => focusCompany(idx)}
                      className={`h-2.5 w-2.5 rounded-full transition ${
                        idx === activeIndex ? "bg-(--tc-accent,#ef0001)" : "bg-slate-300 hover:bg-slate-400"
                      }`}
                      aria-label={`Selecionar ${c.name}`}
                      title={c.name}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="tc-panel space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Atenção agora</h2>
              <p className="text-sm text-(--tc-text-secondary,#4b5563)">
                Só entra aqui o que exige ação. Sem ruído.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-(--tc-border)/60 bg-white p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Quebras de gate (empresas)</h3>
                  <span className="text-xs text-(--tc-text-muted)">{attentionNow.companiesNeedingAttention.length} no total</span>
                </div>

                {attentionNow.companiesNeedingAttention.length === 0 ? (
                  <div className="text-sm text-(--tc-text-muted)">Nenhuma empresa em risco/atenção no período.</div>
                ) : (
                  <div className="space-y-2">
                    {attentionNow.companiesNeedingAttention.slice(0, 6).map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-(--tc-border)/60 bg-slate-50 px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c) truncate" title={c.name}>{c.name}</div>
                          <div className="text-[11px] text-(--tc-text-muted)">
                            Status: {gateLabel(c.gate.status)} · Pass rate: {c.passRate == null ? "—" : `${c.passRate}%`}
                          </div>
                        </div>
                        {c.slug ? (
                          <a
                            href={`/empresas/${encodeURIComponent(c.slug)}/home`}
                            className="shrink-0 rounded-xl bg-(--tc-accent,#ef0001) px-3 py-2 text-xs font-semibold text-white hover:bg-(--tc-accent,#d30001)"
                          >
                            Abrir
                          </a>
                        ) : (
                          <span className="text-xs text-(--tc-text-muted)">sem slug</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-(--tc-border)/60 bg-white p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Releases em risco sem execução recente</h3>
                  <span className="text-xs text-(--tc-text-muted)">≥ {attentionNow.staleDays} dias</span>
                </div>

                {attentionNow.staleRiskReleases.length === 0 ? (
                  <div className="text-sm text-(--tc-text-muted)">Nenhuma release em risco com execução “antiga”.</div>
                ) : (
                  <div className="space-y-2">
                    {attentionNow.staleRiskReleases.slice(0, 6).map(({ company, release }) => (
                      <div
                        key={`${company.id}-${release.slug ?? release.title ?? "release"}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-(--tc-border)/60 bg-slate-50 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c) truncate" title={release.title ?? release.slug ?? ""}>
                            {release.title ?? release.slug ?? "Release"}
                          </div>
                          <div className="text-[11px] text-(--tc-text-muted)">
                            {company.name} · {formatDate(release.createdAt ?? release.created_at)}
                          </div>
                        </div>
                        {company.slug ? (
                          <a
                            href={`/empresas/${encodeURIComponent(company.slug)}/releases`}
                            className="shrink-0 rounded-xl border border-(--tc-border)/60 bg-white px-3 py-2 text-xs font-semibold text-(--tc-text-primary,#0b1a3c) hover:bg-slate-50"
                          >
                            Ver
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link
                href="/admin/defeitos"
                className="rounded-xl border border-(--tc-border)/60 bg-white px-4 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) hover:bg-slate-50"
              >
                Ver defeitos (global)
              </Link>
            </div>
          </section>

        </div>
      </div>
  );
}
