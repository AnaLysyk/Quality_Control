"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiAlertTriangle, FiTrendingDown, FiZap } from "react-icons/fi";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";
import { toast } from "react-hot-toast";
import { extractMessageFromJson, extractRequestIdFromJson, formatMessageWithRequestId, unwrapEnvelopeData } from "@/lib/apiEnvelope";

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
    companyName: "Griaule",
    companySlug: "griaule",
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
    companyName: "Griaule",
    companySlug: "griaule",
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

export default function AdminDefeitosPage() {
  const router = useRouter();
  const [payload, setPayload] = useState<Aggregated | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authBlocked, setAuthBlocked] = useState(false);
  const allowFallback = typeof window !== "undefined" && window.location.hostname === "localhost";

  function handleUnauthorized() {
    const msg = "Sessão expirada. Faça login novamente.";
    setAuthBlocked(true);
    setError(msg);
    toast.error(msg);
    router.push("/login");
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setAuthBlocked(false);
      try {
        const res = await fetch("/api/admin/defeitos", { cache: "no-store", credentials: "include" });

        if (res.status === 401) {
          setPayload(null);
          handleUnauthorized();
          return;
        }
        if (res.status === 403) {
          setPayload(null);
          setAuthBlocked(true);
          setError("Sem permissão");
          return;
        }

        if (!res.ok) {
          const raw = await res.json().catch(() => null);
          const message = extractMessageFromJson(raw) || "Erro ao carregar dados";
          const requestId = extractRequestIdFromJson(raw) || res.headers.get("x-request-id") || null;
          setPayload(null);
          setError(formatMessageWithRequestId(message, requestId));
          return;
        }

        const raw = await res.json().catch(() => null);
        const data = unwrapEnvelopeData<Aggregated>(raw);
        if (!data) {
          const message = extractMessageFromJson(raw) || "Erro ao carregar dados";
          const requestId = extractRequestIdFromJson(raw) || res.headers.get("x-request-id") || null;
          setPayload(null);
          setError(formatMessageWithRequestId(message, requestId));
          return;
        }

        const apiError = typeof (data as any)?.error === "string" ? String((data as any).error) : null;
        if (apiError) setError(apiError);
        setPayload(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
    <RequireGlobalAdmin>
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
          <p className="text-xs uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Defeitos</p>
          <h1 className="text-3xl md:text-4xl font-extrabold text-(--tc-text-primary,#0b1a3c)">
            Painel de defeitos (global)
          </h1>
          <p className="text-sm text-(--tc-text-secondary,#4b5563)">
            Visao consolidada de falhas por empresa e por run. Clique para entrar no contexto da empresa.
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {loading && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando defeitos...</p>}

        {!loading && (
          <>
            {/* visão macro por empresa */}
            <section className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Defeitos abertos" value={defects.length} color="text-red-600" icon={<FiAlertTriangle />} />
              <MetricCard label="Empresas com defeitos" value={companyCards.length} icon={<FiTrendingDown />} />
              <MetricCard label="Defeitos (Qase + manuais)" value={defects.length} icon={<FiZap />} />
            </section>

            <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Empresas com defeitos</h2>
                  <p className="text-sm text-(--tc-text-secondary,#4b5563)">Clique para entrar no contexto</p>
                </div>
              </div>
              {companyCards.length === 0 ? (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhuma empresa com defeitos.</p>
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
                            <p className="text-xs text-(--tc-text-muted,#6b7280)">{total} defeitos</p>
                          </div>
                          <a
                            href={`/admin/defeitos/${c.slug || "empresa"}`}
                            className="text-xs font-semibold text-(--tc-accent,#ef0001) hover:underline"
                          >
                            Ver defeitos
                          </a>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-(--tc-text-secondary,#4b5563)">
                          <StatusPill label={STATUS_LABEL.fail} value={fail} colorClass="text-red-600" />
                          <StatusPill label={STATUS_LABEL.blocked} value={blocked} colorClass="text-amber-600" />
                          <StatusPill label={STATUS_LABEL.pending} value={pending} colorClass="text-blue-600" />
                          <StatusPill label={STATUS_LABEL.done} value={done} colorClass="text-emerald-600" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Defeitos recentes</h2>
                <span className="text-sm text-(--tc-text-muted,#6b7280)">Top 6</span>
              </div>
              {defects.length === 0 ? (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhum defeito encontrado.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {defects.slice(0, 6).map((d) => (
                    <div
                      key={d.id}
                      className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm space-y-2 hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-(--tc-text-primary,#0b1a3c)">{d.title}</p>
                        <span className="text-xs text-red-600">{d.status || "status"}</span>
                      </div>
                      <p className="text-xs text-(--tc-text-secondary,#4b5563)">Projeto: {d.projectCode}</p>
                      {d.run_id ? (
                        <p className="text-xs text-(--tc-text-muted,#6b7280)">Run: {String(d.run_id)}</p>
                      ) : null}
                      {d.url ? (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-(--tc-accent,#ef0001) hover:underline"
                        >
                          Abrir no Qase
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Defeitos por run (grafico simples) */}
            <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm space-y-3">
              <h2 className="text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Defeitos por run</h2>
              {defectsByRun.length === 0 ? (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhuma run com defeitos.</p>
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
                            Abrir run
                          </a>
                        </div>
                        <div className="h-2 rounded-full bg-(--tc-input-bg,#eef4ff)">
                          <div className={`h-full rounded-full bg-red-500 ${widthClass}`} />
                        </div>
                        <p className="text-xs text-(--tc-text-secondary,#4b5563)">
                          {r.count} defeitos • {r.app} • {r.client ?? "Empresa"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Defeitos por aplicação */}
            <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm space-y-3">
              <h2 className="text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Defeitos por aplicação</h2>
              {defectsByApp.length === 0 ? (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhuma aplicação com defeitos.</p>
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
                        <p className="text-xs text-(--tc-text-secondary,#4b5563)">{a.count} defeitos</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </RequireGlobalAdmin>
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
