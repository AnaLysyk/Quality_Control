"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiAlertTriangle, FiTrendingDown, FiZap } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { extractMessageFromJson, extractRequestIdFromJson, formatMessageWithRequestId, unwrapEnvelopeData } from "@/lib/apiEnvelope";
import { useI18n } from "@/hooks/useI18n";
import { useAuthUser } from "@/hooks/useAuthUser";

type DefectItem = {
  id: string;
  title: string;
  status: string;
  severity?: string;
  run_id?: string | number | null;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  url?: string;
  projectCode: string;
  companyName?: string | null;
  companySlug?: string | null;
  origin?: "manual" | "automatico";
  createdBy?: string | null;
};

type Aggregated = {
  total: number;
  byApplication: { name: string; count: number }[];
  byRun: { runId: string; count: number; app: string }[];
  byCompany: { name: string; count: number; slug?: string | null }[];
  byStatus: { status: string; count: number }[];
  timeline: { month: string; count: number }[];
  items: DefectItem[];
  error?: string;
};

type CompanyOption = {
  id: string;
  name: string;
  slug: string;
};

function pctWidthClass(pct: number) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return `w-pct-${clamped}`;
}

const FALLBACK_DEFECTS: DefectItem[] = [
  {
    id: "df-1",
    title: "Checkout falha ao finalizar pagamento PIX",
    status: "fail",
    run_id: "run-123",
    projectCode: "SMART",
    companyName: "Demo Corp",
    companySlug: "demo",
    origin: "automatico",
    createdBy: "Qase",
    url: "https://app.qase.io/run/123",
  },
  {
    id: "df-2",
    title: "API de documentos intermitente",
    status: "blocked",
    run_id: "run-456",
    projectCode: "CDS",
    companyName: "Cidade Digital",
    companySlug: "cidade-digital",
    origin: "manual",
    createdBy: "ana.souza",
    url: "#",
  },
  {
    id: "df-3",
    title: "Dashboard sem atualizar métricas",
    status: "pending",
    run_id: "run-789",
    projectCode: "PRINT",
    companyName: "Demo Corp",
    companySlug: "demo",
    origin: "manual",
    createdBy: "carlos.melo",
  },
  {
    id: "df-4",
    title: "Login mobile expirando antes do tempo",
    status: "done",
    run_id: "run-321",
    projectCode: "GMT",
    companyName: "MobileCorp",
    companySlug: "mobilecorp",
    origin: "automatico",
    createdBy: "Qase",
    url: "https://app.qase.io/run/321",
  },
];

const STATUS_LABEL: Record<string, string> = {
  fail: "Em falha",
  blocked: "Bloqueado",
  pending: "Aguardando teste",
  done: "Concluído",
};

const STATUS_LABEL_EN: Record<string, string> = {
  fail: "Failing",
  blocked: "Blocked",
  pending: "Pending test",
  done: "Done",
};

export default function AdminDefeitosPage() {
  const { language } = useI18n();
  const isPt = language === "pt-BR";
  const router = useRouter();
  const { user } = useAuthUser();
  const role = typeof user?.role === "string" ? user.role.toLowerCase() : "";
  const isAdmin = Boolean(user?.isGlobalAdmin || role === "leader_tc" || role === "technical_support");

  const [payload, setPayload] = useState<Aggregated | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authBlocked, setAuthBlocked] = useState(false);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const allowFallback = typeof window !== "undefined" && window.location.hostname === "localhost";
  const ui = useMemo(
    () =>
      isPt
        ? {
            sessionExpired: "Sessao expirada. Faca login novamente.",
            noPermission: "Sem permissão",
            loadError: "Erro ao carregar dados",
            loadingDefects: "Carregando defeitos...",
            defects: "Defeitos",
            globalPanel: "Painel de defeitos (global)",
            panelSubtitle: "Visão consolidada de falhas por empresa e por run. Clique para entrar no contexto da empresa.",
            openDefects: "Defeitos abertos",
            companiesWithDefects: "Empresas com defeitos",
            defectsQaseManual: "Defeitos (Qase + manuais)",
            clickToOpenContext: "Clique para entrar no contexto",
            noCompaniesWithDefects: "Nenhuma empresa com defeitos.",
            defectsCount: "defeitos",
            viewDefects: "Ver defeitos",
            recentDefects: "Defeitos recentes",
            topN: "Top 6",
            noDefectsFound: "Nenhum defeito encontrado.",
            project: "Projeto",
            run: "Run",
            openInQase: "Abrir no Qase",
            defectsByRun: "Defeitos por run",
            noRunWithDefects: "Nenhuma run com defeitos.",
            openRun: "Abrir run",
            company: "Empresa",
            defectsByApp: "Defeitos por aplicação",
            noAppWithDefects: "Nenhuma aplicação com defeitos.",
            statusFallback: "status",
          }
        : {
            sessionExpired: "Session expired. Please sign in again.",
            noPermission: "No permission",
            loadError: "Error loading data",
            loadingDefects: "Loading defects...",
            defects: "Defects",
            globalPanel: "Global defects panel",
            panelSubtitle: "Consolidated failure view by company and by run. Click to open the company context.",
            openDefects: "Open defects",
            companiesWithDefects: "Companies with defects",
            defectsQaseManual: "Defects (Qase + manual)",
            clickToOpenContext: "Click to open the context",
            noCompaniesWithDefects: "No companies with defects.",
            defectsCount: "defects",
            viewDefects: "View defects",
            recentDefects: "Recent defects",
            topN: "Top 6",
            noDefectsFound: "No defects found.",
            project: "Project",
            run: "Run",
            openInQase: "Open in Qase",
            defectsByRun: "Defects by run",
            noRunWithDefects: "No run with defects.",
            openRun: "Open run",
            company: "Company",
            defectsByApp: "Defects by application",
            noAppWithDefects: "No application with defects.",
            statusFallback: "status",
          },
    [isPt],
  );
  const statusLabel = isPt ? STATUS_LABEL : STATUS_LABEL_EN;

  const handleUnauthorized = useCallback(() => {
    const msg = ui.sessionExpired;
    setAuthBlocked(true);
    setError(msg);
    toast.error(msg);
    router.push("/login");
  }, [router, ui.sessionExpired]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingCompanies(true);
    fetch("/api/clients", { cache: "no-store" })
      .then((r) => r.json().catch(() => null))
      .then((data) => {
        const items = Array.isArray(data?.items) ? data.items : [];
        setCompanies(
          items.map((item: Record<string, unknown>) => ({
            id: typeof item.id === "string" ? item.id : "",
            name: typeof item.name === "string" ? item.name : typeof item.company_name === "string" ? item.company_name : "",
            slug: typeof item.slug === "string" ? item.slug : "",
          })),
        );
      })
      .catch(() => setCompanies([]))
      .finally(() => setLoadingCompanies(false));
  }, [isAdmin]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setAuthBlocked(false);
      try {
        const companyParam = selectedCompany ? `?company=${encodeURIComponent(selectedCompany)}` : "";
        const clientParam = selectedCompany
          ? `?kind=defect&clientSlug=${encodeURIComponent(selectedCompany)}`
          : "?kind=defect";

        const [res, manualRes] = await Promise.all([
          fetch(`/api/admin/defeitos${companyParam}`, { cache: "no-store", credentials: "include" }),
          fetch(`/api/releases-manual${clientParam}`, { cache: "no-store", credentials: "include" }),
        ]);

        if (res.status === 401) {
          setPayload(null);
          handleUnauthorized();
          return;
        }
        if (res.status === 403) {
          setPayload(null);
          setAuthBlocked(true);
          setError(ui.noPermission);
          return;
        }

        if (!res.ok) {
          const raw = await res.json().catch(() => null);
          const message = extractMessageFromJson(raw) || ui.loadError;
          const requestId = extractRequestIdFromJson(raw) || res.headers.get("x-request-id") || null;
          setPayload(null);
          setError(formatMessageWithRequestId(message, requestId));
          return;
        }

        const raw = await res.json().catch(() => null);
        const data = unwrapEnvelopeData<Aggregated>(raw);
        if (!data) {
          const message = extractMessageFromJson(raw) || ui.loadError;
          const requestId = extractRequestIdFromJson(raw) || res.headers.get("x-request-id") || null;
          setPayload(null);
          setError(formatMessageWithRequestId(message, requestId));
          return;
        }

        // Mescla defeitos manuais
        if (manualRes.ok) {
          const manualJson = await manualRes.json().catch(() => []);
          const manualRows = Array.isArray(manualJson) ? manualJson : [];
          const manualDefects: DefectItem[] = manualRows.map((r: Record<string, unknown>) => ({
            id: typeof r.id === "string" ? r.id : typeof r.slug === "string" ? r.slug : String(r.id ?? ""),
            title: typeof r.name === "string" ? r.name : typeof r.title === "string" ? r.title : "Defeito manual",
            status: typeof r.status === "string" ? r.status : "pending",
            severity: typeof r.severity === "string" ? r.severity : undefined,
            projectCode: typeof r.app === "string" ? r.app.toUpperCase() : typeof r.qaseProject === "string" ? r.qaseProject : "MANUAL",
            companySlug: typeof r.clientSlug === "string" ? r.clientSlug : null,
            companyName: typeof r.clientSlug === "string" ? r.clientSlug : null,
            origin: "manual" as const,
            createdBy: typeof r.createdByName === "string" ? r.createdByName : null,
            created_at: typeof r.createdAt === "string" ? r.createdAt : undefined,
          }));
          data.items = [...(data.items ?? []), ...manualDefects];
          data.total = data.items.length;
        }

        const apiError = typeof (data as { error?: unknown } | null)?.error === "string" ? String((data as { error?: unknown }).error) : null;
        if (apiError) setError(apiError);
        setPayload(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : ui.loadError);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [handleUnauthorized, ui.loadError, ui.noPermission, selectedCompany]);

  const defects = useMemo(() => {
    if (authBlocked) return [];
    const apiItems = payload?.items ?? [];
    if (apiItems.length) return apiItems;
    return allowFallback ? FALLBACK_DEFECTS : [];
  }, [payload, authBlocked, allowFallback]);

  const companyCards = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        slug: string | null;
        total: number;
        statuses: Record<string, number>;
      }
    >();
    defects.forEach((d) => {
      const slug = d.companySlug || d.companyName?.toLowerCase().replace(/\s+/g, "-") || "empresa";
      const name = d.companyName || d.projectCode || "Empresa";
      const key = slug;
      if (!map.has(key)) {
        map.set(key, { name, slug, total: 0, statuses: { fail: 0, blocked: 0, pending: 0, done: 0 } });
      }
      const item = map.get(key)!;
      item.total += 1;
      const status = (d.status || "pending").toLowerCase();
      if (item.statuses[status] !== undefined) item.statuses[status] += 1;
    });
    return Array.from(map.values());
  }, [defects]);

  const defectsByRun = useMemo(() => {
    return (payload?.byRun ?? []).map((r) => ({ slug: r.runId, count: r.count, app: r.app, client: null }));
  }, [payload]);

  const defectsByApp = useMemo(() => {
    return (payload?.byApplication ?? []).map((a) => ({ app: a.name, count: a.count }));
  }, [payload]);

  return (
    <>
      <style jsx global>{`
        @keyframes pulseUp {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .metric-animate {
          animation: pulseUp 0.6s ease-out both;
        }
      `}</style>
      <div className="min-h-screen bg-(--page-bg,#f7f9fb) text-(--page-text,#0b1a3c) p-6 md:p-10 space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">{ui.defects}</p>
          <h1 className="text-3xl md:text-4xl font-extrabold text-(--tc-text-primary,#0b1a3c)">
            {ui.globalPanel}
          </h1>
          <p className="text-sm text-(--tc-text-secondary,#4b5563)">
            {ui.panelSubtitle}
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {loading && <p className="text-sm text-(--tc-text-muted,#6b7280)">{ui.loadingDefects}</p>}

        {isAdmin && (
          <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-(--tc-text-secondary,#4b5563)">
                  {isPt ? "Filtrar por empresa:" : "Filter by company:"}
                </label>
                <select
                  aria-label={isPt ? "Selecionar empresa" : "Select company"}
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  disabled={loadingCompanies}
                  className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-4 py-2 text-(--tc-text-primary,#011848) focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/40 min-w-50"
                >
                  <option value="">{isPt ? "Todas as empresas" : "All companies"}</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.slug}>
                      {company.name}
                    </option>
                  ))}
                </select>
                {loadingCompanies && (
                  <span className="text-xs text-(--tc-text-muted,#6b7280)">
                    {isPt ? "Carregando..." : "Loading..."}
                  </span>
                )}
              </div>
              {selectedCompany && (
                <span className="text-sm text-(--tc-accent,#ef0001)">
                  {isPt ? "Exibindo defeitos de:" : "Showing defects for:"}{" "}
                  <strong>{companies.find((c) => c.slug === selectedCompany)?.name || selectedCompany}</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {!loading && (
          <>
            {/* visão macro por empresa */}
            <section className="grid gap-4 md:grid-cols-3">
              <MetricCard label={ui.openDefects} value={defects.length} color="text-red-600" icon={<FiAlertTriangle />} />
              <MetricCard label={ui.companiesWithDefects} value={companyCards.length} icon={<FiTrendingDown />} />
              <MetricCard label={ui.defectsQaseManual} value={defects.length} icon={<FiZap />} />
            </section>

            <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">{ui.companiesWithDefects}</h2>
                  <p className="text-sm text-(--tc-text-secondary,#4b5563)">{ui.clickToOpenContext}</p>
                </div>
              </div>
              {companyCards.length === 0 ? (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">{ui.noCompaniesWithDefects}</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {companyCards.map((c) => {
                    const total = c.total;
                    const fail = c.statuses.fail ?? 0;
                    const blocked = c.statuses.blocked ?? 0;
                    const pending = c.statuses.pending ?? 0;
                    const done = c.statuses.done ?? 0;
                    return (
                      <div
                        key={c.slug ?? c.name}
                        className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm space-y-3 hover:shadow-md transition"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-semibold text-(--tc-text-primary,#0b1a3c)">{c.name}</p>
                            <p className="text-xs text-(--tc-text-muted,#6b7280)">{total} {ui.defectsCount}</p>
                          </div>
                          <a
                            href={`/admin/defeitos/${c.slug || "empresa"}`}
                            className="text-xs font-semibold text-(--tc-accent,#ef0001) hover:underline"
                          >
                            {ui.viewDefects}
                          </a>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-(--tc-text-secondary,#4b5563)">
                          <StatusPill label={statusLabel.fail} value={fail} colorClass="text-red-600" />
                          <StatusPill label={statusLabel.blocked} value={blocked} colorClass="text-amber-600" />
                          <StatusPill label={statusLabel.pending} value={pending} colorClass="text-blue-600" />
                          <StatusPill label={statusLabel.done} value={done} colorClass="text-emerald-600" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">{ui.recentDefects}</h2>
                <span className="text-sm text-(--tc-text-muted,#6b7280)">{ui.topN}</span>
              </div>
              {defects.length === 0 ? (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">{ui.noDefectsFound}</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {defects.slice(0, 6).map((d) => (
                    <div
                      key={d.id}
                      className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm space-y-2 hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-(--tc-text-primary,#0b1a3c)">{d.title}</p>
                        <span className="text-xs text-red-600">{d.status || ui.statusFallback}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="text-(--tc-text-secondary,#4b5563)">{ui.project}: {d.projectCode}</span>
                        {isAdmin && d.companyName && (
                          <span className="rounded-full border border-blue-400/60 bg-blue-50 px-2 py-0.5 text-blue-700">
                            {d.companyName}
                          </span>
                        )}
                        {d.origin === "manual" && (
                          <span className="rounded-full border border-amber-400/60 bg-amber-50 px-2 py-0.5 text-amber-700">
                            {isPt ? "Manual" : "Manual"}
                          </span>
                        )}
                      </div>
                      {d.run_id ? (
                        <p className="text-xs text-(--tc-text-muted,#6b7280)">{ui.run}: {String(d.run_id)}</p>
                      ) : null}
                      {d.url ? (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-(--tc-accent,#ef0001) hover:underline"
                        >
                          {ui.openInQase}
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Defeitos por run (grafico simples) */}
            <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm space-y-3">
              <h2 className="text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">{ui.defectsByRun}</h2>
              {defectsByRun.length === 0 ? (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">{ui.noRunWithDefects}</p>
              ) : (
                <div className="space-y-2">
                  {defectsByRun.map((r, idx) => {
                    const barWidth = Math.min(100, r.count * 12);
                    const widthClass = pctWidthClass(barWidth);
                    return (
                      <div key={r.slug ?? idx} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-(--tc-text-primary,#0b1a3c)">{r.slug}</span>
                          <a
                            href={`/runs/${r.slug}`}
                            className="text-xs font-semibold text-(--tc-accent,#ef0001) hover:underline"
                          >
                            {ui.openRun}
                          </a>
                        </div>
                        <div className="h-2 rounded-full bg-(--tc-input-bg,#eef4ff)">
                          <div className={`h-full rounded-full bg-red-500 ${widthClass}`} />
                        </div>
                        <p className="text-xs text-(--tc-text-secondary,#4b5563)">
                          {r.count} {ui.defectsCount} • {r.app} • {r.client ?? ui.company}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Defeitos por aplicação */}
            <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm space-y-3">
              <h2 className="text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">{ui.defectsByApp}</h2>
              {defectsByApp.length === 0 ? (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">{ui.noAppWithDefects}</p>
              ) : (
                <div className="space-y-2">
                  {defectsByApp.map((a, idx) => {
                    const barWidth = Math.min(100, a.count * 10);
                    const widthClass = pctWidthClass(barWidth);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-(--tc-text-primary,#0b1a3c)">{a.app}</span>
                        </div>
                        <div className="h-2 rounded-full bg-(--tc-input-bg,#eef4ff)">
                          <div className={`h-full rounded-full bg-amber-500 ${widthClass}`} />
                        </div>
                        <p className="text-xs text-(--tc-text-secondary,#4b5563)">{a.count} {ui.defectsCount}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

function StatusPill({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-(--tc-border,#e5e7eb)/60 bg-(--tc-input-bg,#eef4ff) px-3 py-2">
      <span className="text-xs font-semibold text-(--tc-text-primary,#0b1a3c)">{label}</span>
      <span className={`text-sm font-bold ${colorClass}`}>{value}</span>
    </div>
  );
}

function MetricCard({ label, value, color, icon }: { label: string; value: number; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-5 shadow-sm flex items-center gap-3">
      <div className="h-12 w-12 rounded-xl bg-(--tc-input-bg,#eef4ff) border border-(--tc-border,#e5e7eb) flex items-center justify-center text-(--tc-accent,#ef0001)">
        {icon}
      </div>
      <div>
        <p className="text-sm text-(--tc-text-muted,#6b7280)">{label}</p>
        <p className={`text-3xl font-bold ${color ?? "text-(--tc-text-primary,#0b1a3c)"}`}>{value}</p>
      </div>
    </div>
  );
}
