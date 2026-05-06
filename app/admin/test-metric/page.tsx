"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamicImport from "next/dynamic";
import { useAuthUser } from "@/hooks/useAuthUser";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";
const CompanyMetricsCard = dynamicImport(
  () => import("@/components/CompanyMetricsCard").then((mod) => mod.CompanyMetricsCard),
  { ssr: false, loading: () => <div>Carregando métricas...</div> }
);
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
  if (status === "approved") return "Estável";
  if (status === "warning") return "Atenção";
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
  const w = 820;
  const h = 230;
  const left = 46;
  const right = 84;
  const top = 18;
  const bottom = 34;
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

  function smoothPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const tension = 0.28;
    let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 2] ?? pts[0];
      const p1 = pts[i - 1];
      const p2 = pts[i];
      const p3 = pts[i + 1] ?? p2;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  const path = smoothPath(coords);
  const plotBottom = top + plotH;
  const area = coords.length
    ? `${path} L${coords[coords.length - 1].x.toFixed(1)} ${plotBottom.toFixed(1)} L${coords[0].x.toFixed(1)} ${plotBottom.toFixed(1)} Z`
    : "";

  const zoneY = { healthy: toY(100), attention: toY(85), risk: toY(70), floor: toY(0) };
  const zoneMidY = {
    healthy: (zoneY.healthy + zoneY.attention) / 2,
    attention: (zoneY.attention + zoneY.risk) / 2,
    risk: (zoneY.risk + zoneY.floor) / 2,
  };

  const pointTone = (value: number | null) => {
    if (value == null || value >= 85) return { fill: "rgba(52,211,153,0.96)", glow: "rgba(52,211,153,0.22)" };
    if (value >= 70) return { fill: "rgba(251,191,36,0.96)", glow: "rgba(251,191,36,0.22)" };
    return { fill: "rgba(248,113,113,0.96)", glow: "rgba(248,113,113,0.22)" };
  };

  const gradId = "spark-grad";
  const lineColor = "rgba(147,197,253,0.96)";

  // Show at most ~7 x-axis labels to avoid crowding
  const xLabelStep = Math.max(1, Math.ceil(displayPoints.length / 7));

  return (
    <div className="rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(147,197,253,0.28)" />
            <stop offset="100%" stopColor="rgba(147,197,253,0.02)" />
          </linearGradient>
        </defs>

        {/* Zone bands */}
        <rect x={left} y={zoneY.healthy} width={plotW} height={zoneY.attention - zoneY.healthy} fill="rgba(16,185,129,0.16)" />
        <rect x={left} y={zoneY.attention} width={plotW} height={zoneY.risk - zoneY.attention} fill="rgba(245,158,11,0.13)" />
        <rect x={left} y={zoneY.risk} width={plotW} height={zoneY.floor - zoneY.risk} fill="rgba(239,68,68,0.12)" />

        {/* Vertical grid per data point */}
        {coords.map((entry, index) => (
          <line key={`vg-${index}`} x1={entry.x} y1={top} x2={entry.x} y2={plotBottom} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        ))}

        {/* Horizontal ticks + Y labels */}
        {ticks.map((tick) => {
          const y = toY(tick);
          const isTarget = tick === QUALITY_TARGET;
          return (
            <g key={tick}>
              <line x1={left} y1={y} x2={plotRight} y2={y}
                stroke={isTarget ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.1)"}
                strokeWidth={isTarget ? "1.5" : "0.8"}
                strokeDasharray={isTarget ? "6 3" : undefined}
              />
              <text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,0.6)">{tick}%</text>
            </g>
          );
        })}

        {/* Meta 85% badge */}
        <rect x={left + 4} y={toY(QUALITY_TARGET) - 13} width={58} height={15} rx="4" fill="rgba(255,255,255,0.16)" />
        <text x={left + 8} y={toY(QUALITY_TARGET) - 2} fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.92)">Meta {QUALITY_TARGET}%</text>

        {/* Zone pill badges on right */}
        {([
          { key: "healthy", label: "Saudável", bg: "rgba(16,185,129,0.28)", color: "rgba(167,243,208,0.96)" },
          { key: "attention", label: "Atenção",  bg: "rgba(245,158,11,0.28)", color: "rgba(253,230,138,0.96)" },
          { key: "risk",     label: "Risco",     bg: "rgba(239,68,68,0.28)",  color: "rgba(252,165,165,0.96)" },
        ] as const).map(({ key, label, bg, color }) => (
          <g key={key}>
            <rect x={plotRight + 3} y={zoneMidY[key] - 9} width={right - 6} height={17} rx="5" fill={bg} />
            <text x={plotRight + 3 + (right - 6) / 2} y={zoneMidY[key] + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>{label}</text>
          </g>
        ))}

        {/* Area fill */}
        {area ? <path d={area} fill={`url(#${gradId})`} /> : null}

        {/* Line */}
        <path d={path} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {coords.map((entry, index) => {
          const isLast = index === coords.length - 1;
          const tone = pointTone(entry.point.value);
          return (
            <g key={`pt-${index}`}>
              {isLast && <circle cx={entry.x} cy={entry.y} r="14" fill={tone.glow} />}
              {isLast && <circle cx={entry.x} cy={entry.y} r="9"  fill={tone.glow} />}
              <circle cx={entry.x} cy={entry.y} r={isLast ? 5.5 : 3.5}
                fill={tone.fill} stroke="rgba(255,255,255,0.9)" strokeWidth={isLast ? "2" : "1.5"} />
              <title>{`${entry.point.label} | pass rate ${entry.point.value ?? 0}% | runs ${entry.point.total} | falhas ${entry.point.failRate ?? 0}% | bloqueados ${entry.point.blockedRate ?? 0}%`}</title>
            </g>
          );
        })}

        {/* X-axis labels */}
        {displayPoints.map((point, index) => {
          const isFirst = index === 0;
          const isLast = index === displayPoints.length - 1;
          if (!isFirst && !isLast && index % xLabelStep !== 0) return null;
          return (
            <text key={`xl-${index}`} x={toX(index)} y={h - 7}
              textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
              fontSize="11" fill="rgba(255,255,255,0.62)">
              {point.label}
            </text>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-4 px-4 pb-3 text-[11px] text-white/72">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 rounded-full bg-[rgba(147,197,253,0.96)]" />Pass rate</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />Saudável ≥85%</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />Atenção 70–85%</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />Risco &lt;70%</span>
      </div>
    </div>
  );
}

export default function TestMetricPage() {
  const router = useRouter();
  const { user } = useAuthUser();
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
  const companyRouteInput = {
    isGlobalAdmin: user?.isGlobalAdmin === true || user?.is_global_admin === true,
    permissionRole: user?.permissionRole ?? null,
    role: user?.role ?? null,
    companyRole: user?.companyRole ?? null,
    userOrigin: user?.userOrigin ?? user?.user_origin ?? null,
    companyCount: Array.isArray(user?.clientSlugs) ? user.clientSlugs.length : 0,
    clientSlug: user?.clientSlug ?? null,
    defaultClientSlug: user?.defaultClientSlug ?? null,
  };

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
        setError(err instanceof Error ? err.message : "Erro ao carregar métricas");
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
                <div className="grid gap-3 pt-2 sm:grid-cols-3">
                  {([
                    { key: "first", label: "Primeira leitura",     data: globalTrendMeta.first, accent: "border-blue-400/40"    },
                    { key: "worst", label: "Pior ponto do período", data: globalTrendMeta.worst, accent: "border-red-400/40"     },
                    { key: "last",  label: "Última leitura",        data: globalTrendMeta.last,  accent: "border-emerald-400/40" },
                  ] as const).map(({ key, label, data, accent }) => {
                    const tone =
                      (data.value ?? 0) >= 85 ? { text: "text-emerald-300", dot: "bg-emerald-400" }
                      : (data.value ?? 0) >= 70 ? { text: "text-amber-300", dot: "bg-amber-400" }
                      : { text: "text-red-300", dot: "bg-red-400" };
                    return (
                      <div key={key} className={`rounded-2xl border ${accent} bg-white/8 px-4 py-3 space-y-1`}>
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${tone.dot}`} />
                          <span className="text-[10px] uppercase tracking-[0.22em] text-white/56">{label}</span>
                        </div>
                        <div className={`text-2xl font-black tracking-tight ${tone.text}`}>{data.value ?? 0}%</div>
                        <div className="text-[11px] text-white/60">{data.label} · {data.total} runs</div>
                        <div className="text-[11px] text-white/48">falhas {data.failRate ?? 0}% · bloqueados {data.blockedRate ?? 0}%</div>
                      </div>
                    );
                  })}
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
                className="w-full md:w-105 rounded-2xl border border-(--tc-border)/60 bg-(--tc-surface) px-4 py-3 text-sm text-(--tc-text,#0f172a) placeholder:text-(--tc-text-muted) focus:border-(--tc-accent) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/30"
              />
            </div>

            {loading && <p className="text-sm text-(--tc-text-muted)">Carregando métricas...</p>}
            {error && !loading && <p className="text-sm text-red-600">{error}</p>}

            {!loading && !error && companies.length === 0 && (
              <div className="rounded-2xl border border-dashed border-(--tc-border)/60 bg-(--tc-surface) p-6 text-sm text-(--tc-text-muted)">
                Nenhuma empresa encontrada.
              </div>
            )}

            {!loading && !error && companies.length > 0 && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => focusCompany(activeIndex - 1)}
                    className="rounded-2xl border border-(--tc-border)/60 bg-(--tc-surface) px-4 py-3 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) hover:bg-(--tc-surface-2) disabled:opacity-40"
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
                    className="rounded-2xl border border-(--tc-border)/60 bg-(--tc-surface) px-4 py-3 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) hover:bg-(--tc-surface-2) disabled:opacity-40"
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
                          onSelectApp={(app: string | null) => setActiveAppByCompany((prev) => ({ ...prev, [company.id]: app }))}
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
              <div className="rounded-2xl border border-(--tc-border)/60 bg-(--tc-surface) p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Quebras de gate (empresas)</h3>
                  <span className="text-xs text-(--tc-text-muted)">{attentionNow.companiesNeedingAttention.length} no total</span>
                </div>

                {attentionNow.companiesNeedingAttention.length === 0 ? (
                  <div className="text-sm text-(--tc-text-muted)">Nenhuma empresa em risco/atenção no período.</div>
                ) : (
                  <div className="space-y-2">
                    {attentionNow.companiesNeedingAttention.slice(0, 6).map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-(--tc-border)/60 bg-(--tc-surface-2) px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c) truncate" title={c.name}>{c.name}</div>
                          <div className="text-[11px] text-(--tc-text-muted)">
                            Status: {gateLabel(c.gate.status)} · Pass rate: {c.passRate == null ? "—" : `${c.passRate}%`}
                          </div>
                        </div>
                        {c.slug ? (
                          <Link
                            href={buildCompanyPathForAccess(c.slug, "home", companyRouteInput)}
                            className="shrink-0 rounded-xl bg-(--tc-accent,#ef0001) px-3 py-2 text-xs font-semibold text-white hover:bg-(--tc-accent,#d30001)"
                          >
                            Abrir
                          </Link>
                        ) : (
                          <span className="text-xs text-(--tc-text-muted)">sem slug</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-(--tc-border)/60 bg-(--tc-surface) p-5 space-y-3">
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
                        className="flex items-center justify-between gap-3 rounded-xl border border-(--tc-border)/60 bg-(--tc-surface-2) px-4 py-3"
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
                          <Link
                            href={buildCompanyPathForAccess(company.slug, "runs", companyRouteInput)}
                            className="shrink-0 rounded-xl border border-(--tc-border)/60 bg-(--tc-surface) px-3 py-2 text-xs font-semibold text-(--tc-text-primary,#0b1a3c) hover:bg-(--tc-surface-2)"
                          >
                            Ver
                          </Link>
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
                className="rounded-xl border border-(--tc-border)/60 bg-(--tc-surface) px-4 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) hover:bg-(--tc-surface-2)"
              >
                Ver defeitos (global)
              </Link>
            </div>
          </section>

        </div>
      </div>
  );
}
