"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";
import { CompanyMetricsCard, type DefectsSummary } from "@/components/CompanyMetricsCard";
import { extractMessageFromJson, extractRequestIdFromJson, formatMessageWithRequestId, unwrapEnvelopeData } from "@/lib/apiEnvelope";

type Stats = { pass: number; fail: number; blocked: number; notRun: number };

type TrendPoint = { label: string; value: number | null; total: number };

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

type AuditLogRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
};

type AuditLogsResponse = {
  items: AuditLogRow[];
  retentionDays: number;
  warning: string | null;
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

function formatDateTime(iso?: string) {
  if (!iso) return "-";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "-";
  return new Date(time).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
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

function actionLabel(action: string) {
  const a = (action ?? "").toString();
  if (a === "client.created") return "Nova empresa criada";
  if (a === "client.updated") return "Empresa atualizada";
  if (a === "client.deleted") return "Empresa removida";
  if (a === "run.created") return "Nova run executada";
  if (a === "run.deleted") return "Run removida";
  if (a === "user.created") return "Usuário criado";
  if (a === "user.updated") return "Usuário atualizado";
  return a;
}

function GlobalTrendSparkline({ points }: { points: TrendPoint[] }) {
  const vals = points.map((p) => p.value).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!vals.length) {
    return <div className="h-12 rounded-2xl bg-white/70 border border-(--tc-border)/40" />;
  }
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const w = 260;
  const h = 48;
  const pad = 8;
  const toX = (i: number) => {
    if (points.length <= 1) return pad;
    return pad + (i * (w - pad * 2)) / (points.length - 1);
  };
  const toY = (value: number) => {
    const range = Math.max(1, max - min);
    const t = (value - min) / range;
    return pad + (1 - t) * (h - pad * 2);
  };
  const path = points
    .map((p, i) => {
      if (typeof p.value !== "number" || !Number.isFinite(p.value)) return null;
      const x = toX(i);
      const y = toY(p.value);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full rounded-2xl bg-white/70 border border-(--tc-border)/40">
      <path d={path} fill="none" stroke="var(--tc-accent,#ef0001)" strokeWidth="2.5" />
    </svg>
  );
}

export default function TestMetricPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  const handleUnauthorized = useCallback(() => {
    setError("Sessão expirada. Faça login novamente.");
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
  const [audit, setAudit] = useState<{ loaded: boolean; items: AuditLogRow[]; warning: string | null }>(
    { loaded: false, items: [], warning: null }
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
          const message = extractMessageFromJson(raw) || `Erro ao carregar métricas (${res.status})`;
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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/audit-logs?limit=20", { cache: "no-store", credentials: "include" });
        if (res.status === 401) {
          if (!cancelled) handleUnauthorized();
          return;
        }
        const raw = await res.json().catch(() => null);
        const json = unwrapEnvelopeData<AuditLogsResponse>(raw);
        if (!res.ok || !json) {
          if (!cancelled) setAudit({ loaded: true, items: [], warning: "Movimento recente indisponível" });
          return;
        }
        const items = Array.isArray(json.items) ? json.items : [];
        const rawWarning = json.warning ?? null;
        const warning = rawWarning ? "Movimento recente limitado (logs não configurados neste ambiente)" : null;
        if (!cancelled) setAudit({ loaded: true, items, warning });
      } catch {
        if (!cancelled) setAudit({ loaded: true, items: [], warning: "Movimento recente indisponível" });
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

  const recentReleases = useMemo(() => {
    const list: Array<{ company: CompanyRow; release: ReleaseRow }> = [];
    companies.forEach((company) => {
      (company.releases ?? []).forEach((release) => list.push({ company, release }));
    });
    list.sort((a, b) => (b.release.createdAtValue ?? 0) - (a.release.createdAtValue ?? 0));
    return list.slice(0, 10);
  }, [companies]);

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
    <RequireGlobalAdmin>
      <div className="min-h-screen bg-linear-to-b from-(--page-bg,#f8f8fb) to-(--page-bg,#f0f4ff) text-(--page-text,#0b1a3c)">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10 space-y-8">
          <header className="rounded-[28px] bg-white/80 p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.5em] text-(--tc-accent,#ef0001)">Admin · Métricas</p>
                <h1 className="text-3xl md:text-4xl font-extrabold text-(--tc-text-primary,#0b1a3c)">
                  Visão global multiempresa
                </h1>
                <p className="text-sm text-(--tc-text-secondary,#4b5563) max-w-3xl">
                  Entenda a saúde de qualidade de todas as empresas em segundos. Busque e compare sem trocar de tela.
                </p>
              </div>

              <div className="flex flex-col gap-2 md:items-end">
                <div className="inline-flex rounded-2xl border border-(--tc-border)/60 bg-white p-1">
                  {[7, 30, 90].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setPeriod(days as 7 | 30 | 90)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        period === days
                          ? "bg-(--tc-accent,#ef0001) text-white"
                          : "text-(--tc-text-muted) hover:bg-slate-50"
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
                <div className="text-xs text-(--tc-text-muted)">Última execução: {formatDate(activeCompany?.latestRelease?.createdAt)}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-(--tc-border)/60 bg-white p-5">
                <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">Empresas monitoradas</div>
                <div className="mt-1 text-3xl font-extrabold text-(--tc-text-primary,#0b1a3c)">{companyCounts.total}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">🟢 {companyCounts.stable}</span>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-700">🟡 {companyCounts.attention}</span>
                  <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 font-semibold text-red-700">🔴 {companyCounts.risk}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-700">Sem dados {companyCounts.noData}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-(--tc-border)/60 bg-white p-5">
                <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">Pass rate global</div>
                <div className="mt-1 text-3xl font-extrabold text-(--tc-accent,#ef0001)">
                  {overview?.globalPassRate == null ? "—" : `${overview.globalPassRate}%`}
                </div>
                <div className="mt-2 text-xs text-(--tc-text-muted)">
                  Cobertura: {overview?.coverage?.percent ?? 0}% ({overview?.coverage?.withStats ?? 0}/{overview?.coverage?.total ?? 0})
                </div>
              </div>

              <div className="rounded-2xl border border-(--tc-border)/60 bg-white p-5">
                <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">Releases em risco</div>
                <div className="mt-1 text-3xl font-extrabold text-red-600">{releaseRiskCount}</div>
                <div className="mt-2 text-xs text-(--tc-text-muted)">no período ({period}d)</div>
              </div>

              <div className="rounded-2xl border border-(--tc-border)/60 bg-white p-5">
                <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">Defeitos críticos abertos</div>
                <div className="mt-1 text-3xl font-extrabold text-(--tc-text-primary,#0b1a3c)">
                  {!globalDefects.loaded ? "…" : globalDefects.criticalOpen == null ? "—" : globalDefects.criticalOpen}
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="text-xs text-(--tc-text-muted)">{globalDefects.error ? globalDefects.error : "Fonte: Qase (global)"}</div>
                  <Link
                    href="/admin/defeitos"
                    className="shrink-0 rounded-xl border border-(--tc-border)/60 bg-white px-3 py-2 text-xs font-semibold text-(--tc-text-primary,#0b1a3c) hover:bg-slate-50"
                  >
                    Abrir
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-(--tc-border)/60 bg-white p-5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.24em] text-(--tc-text-muted)">Trend global</div>
                <div className="text-xs text-(--tc-text-muted)">
                  {overview?.trendSummary?.direction === "up" ? "+" : overview?.trendSummary?.direction === "down" ? "-" : ""}
                  {Math.abs(overview?.trendSummary?.delta ?? 0)}pp
                </div>
              </div>
              <GlobalTrendSparkline points={overview?.trendPoints ?? []} />
            </div>
          </header>

          <section className="rounded-[28px] bg-white/80 p-6 sm:p-7 shadow-xl space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Empresas</h2>
                <p className="text-sm text-(--tc-text-secondary,#4b5563)">
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
                        className="flex-none w-full md:w-180 lg:w-215 snap-center"
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

          <section className="rounded-[28px] bg-white/80 p-6 sm:p-7 shadow-xl space-y-5">
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

          <section className="rounded-[28px] bg-white/80 p-6 sm:p-7 shadow-xl space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Movimento recente</h2>
              <p className="text-sm text-(--tc-text-secondary,#4b5563)">O que mudou recentemente no sistema.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-(--tc-border)/60 bg-white p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Eventos (audit logs)</h3>
                  <span className="text-xs text-(--tc-text-muted)">{audit.loaded ? `${audit.items.length} itens` : "carregando…"}</span>
                </div>

                {audit.warning && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    {audit.warning}
                  </div>
                )}

                {audit.loaded && audit.items.length === 0 ? (
                  <div className="text-sm text-(--tc-text-muted)">Sem eventos recentes (ou audit logs não configurado).</div>
                ) : (
                  <div className="space-y-2">
                    {audit.items.slice(0, 10).map((item) => (
                      <div key={item.id} className="rounded-xl border border-(--tc-border)/60 bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{actionLabel(item.action)}</div>
                          <div className="text-[11px] text-(--tc-text-muted)">{formatDateTime(item.created_at)}</div>
                        </div>
                        <div className="mt-1 text-[11px] text-(--tc-text-muted)">
                          {item.entity_label ?? item.entity_id ?? ""}{item.actor_email ? ` · ${item.actor_email}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-(--tc-border)/60 bg-white p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Novas releases</h3>
                  <span className="text-xs text-(--tc-text-muted)">últimas {recentReleases.length}</span>
                </div>

                {recentReleases.length === 0 ? (
                  <div className="text-sm text-(--tc-text-muted)">Sem releases no período.</div>
                ) : (
                  <div className="space-y-2">
                    {recentReleases.map(({ company, release }) => (
                      <div
                        key={`${company.id}-${release.slug ?? release.title ?? "release"}-${release.createdAtValue ?? 0}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-(--tc-border)/60 bg-slate-50 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c) truncate" title={release.title ?? release.slug ?? ""}>
                            {release.title ?? release.slug ?? "Release"}
                          </div>
                          <div className="text-[11px] text-(--tc-text-muted)">{company.name} · {formatDate(release.createdAt ?? release.created_at)}</div>
                        </div>
                        <div className="shrink-0 rounded-full border border-(--tc-border)/60 bg-white px-3 py-1 text-[11px] font-semibold text-(--tc-text-muted)">
                          {gateLabel((release.gate?.status ?? "no_data") as GateStatus)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </RequireGlobalAdmin>
  );
}
