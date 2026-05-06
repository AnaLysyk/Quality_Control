"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiSearch,
  FiTerminal,
  FiXCircle,
} from "react-icons/fi";

import { useAuthUser } from "@/hooks/useAuthUser";

import { useAutomationModuleContext } from "../_components/AutomationModuleContext";

type AuditPayload = {
  route: string;
  ok: boolean;
  actorUserId?: string | null;
  companySlug?: string | null;
  durationMs?: number | null;
  statusCode?: number | null;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
};

type AuditEntry = {
  key: string;
  payload: AuditPayload;
};

const KNOWN_ROUTES = ["http", "qc-page-smoke", "griaule-biometrics"] as const;
const TIME_WINDOWS = ["all", "1h", "24h", "7d"] as const;

type TimeWindow = (typeof TIME_WINDOWS)[number];

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function formatDuration(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${Math.max(0, Math.round(value))}ms`;
}

function formatTimestamp(value?: string) {
  if (!value) return "--:--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function routeLabel(route: string) {
  if (route === "http") return "HTTP";
  if (route === "qc-page-smoke") return "Smoke";
  if (route === "griaule-biometrics") return "Biometria";
  return route;
}

function routeDescription(route: string) {
  if (route === "http") return "Chamadas HTTP automatizadas";
  if (route === "qc-page-smoke") return "Validacao de tela e login";
  if (route === "griaule-biometrics") return "Runner biometrico";
  return "Execucao registrada";
}

export default function AutomacoesLogsPage() {
  const { access, activeClient, clients } = useAutomationModuleContext();
  const { user } = useAuthUser();

  const [routeFilter, setRouteFilter] = useState<string>("");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("24h");
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "error">("all");
  const [refreshSeconds, setRefreshSeconds] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>(activeClient?.slug ?? "");

  const canSeeAll = access.hasGlobalCompanyVisibility;
  const effectiveCompanySlug = canSeeAll ? companyFilter || null : activeClient?.slug ?? null;

  useEffect(() => {
    setCompanyFilter(activeClient?.slug ?? "");
  }, [activeClient?.slug]);

  const loadAudits = useCallback(
    async (options?: { append?: boolean; cursor?: string | null }) => {
      if (!access.canViewTechnicalLogs) return;

      const append = options?.append === true;
      const cursor = options?.cursor ?? null;
      let cancelled = false;
      const controller = new AbortController();

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
        setExpandedKey(null);
      }

      try {
        const searchParams = new URLSearchParams();
        if (routeFilter) searchParams.set("route", routeFilter);
        if (effectiveCompanySlug) {
          searchParams.set("companySlug", effectiveCompanySlug);
        }
        searchParams.set("window", timeWindow);
        searchParams.set("limit", "100");
        if (cursor) searchParams.set("cursor", cursor);

        const response = await fetch(`/api/automations/audit?${searchParams.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const body = (await response.json().catch(() => null)) as
          | { audits?: AuditEntry[]; error?: string; nextCursor?: string | null }
          | null;

        if (!response.ok) {
          throw new Error(body?.error || "Falha ao carregar auditoria.");
        }

        if (!cancelled) {
          const incoming = Array.isArray(body?.audits) ? body.audits : [];
          setItems((prev) => {
            if (!append) return incoming;
            const merged = [...prev, ...incoming];
            const deduped = new Map<string, AuditEntry>();
            for (const item of merged) deduped.set(item.key, item);
            return Array.from(deduped.values());
          });
          setNextCursor(typeof body?.nextCursor === "string" && body.nextCursor.length > 0 ? body.nextCursor : null);
        }
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Falha ao carregar auditoria.");
        if (!append) {
          setItems([]);
          setNextCursor(null);
        }
      } finally {
        if (!cancelled) {
          if (append) setLoadingMore(false);
          else setLoading(false);
        }
      }

      return () => {
        cancelled = true;
        controller.abort();
      };
    },
    [access.canViewTechnicalLogs, effectiveCompanySlug, routeFilter, timeWindow],
  );

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void loadAudits().then((result) => {
      if (typeof result === "function") cleanup = result;
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, [loadAudits]);

  useEffect(() => {
    if (!access.canViewTechnicalLogs) return;
    if (refreshSeconds <= 0) return;
    const intervalId = window.setInterval(() => void loadAudits(), refreshSeconds * 1000);
    return () => window.clearInterval(intervalId);
  }, [access.canViewTechnicalLogs, loadAudits, refreshSeconds]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((entry) => {
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "ok" && entry.payload.ok) ||
        (statusFilter === "error" && !entry.payload.ok);
      const matchSearch =
        !query ||
        entry.payload.route.toLowerCase().includes(query) ||
        (entry.payload.companySlug ?? "").toLowerCase().includes(query) ||
        (entry.payload.actorUserId ?? "").toLowerCase().includes(query) ||
        (entry.payload.error ?? "").toLowerCase().includes(query);
      return matchStatus && matchSearch;
    });
  }, [items, search, statusFilter]);

  const totalOk = useMemo(() => items.filter((e) => e.payload.ok).length, [items]);
  const totalError = useMemo(() => items.filter((e) => !e.payload.ok).length, [items]);

  if (!access.canViewTechnicalLogs) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-8 dark:bg-zinc-950">
        <div className="max-w-md rounded-3xl border border-slate-300 bg-white p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.06)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <FiTerminal className="mx-auto mb-4 h-10 w-10 text-[#ef0001] dark:text-zinc-500" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Logs tecnicos</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
            Seu perfil nao possui acesso aos logs tecnicos de automacao.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-slate-900 dark:bg-[#0b1020] dark:text-zinc-300">
      <div className="shrink-0 border-b border-slate-300 bg-white px-5 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-500">
            <FiTerminal className="h-4 w-4 text-red-500" />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em]">Console · Logs de Automacao</span>
          </div>

          <div className="ml-2 flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
              <FiCheckCircle className="h-3 w-3" />
              {totalOk} OK
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
              <FiXCircle className="h-3 w-3" />
              {totalError} erro{totalError !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="h-8 w-40 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-[13px] text-slate-900 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:focus:border-red-500 dark:focus:ring-red-500/20"
              />
            </div>

            {canSeeAll && clients.length > 1 && (
              <select
                aria-label="Filtrar por empresa"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-red-500 dark:focus:ring-red-500/20"
              >
                <option value="">Todas as empresas</option>
                {clients.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <select
              aria-label="Filtrar por rota"
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-red-500 dark:focus:ring-red-500/20"
            >
              <option value="">Todas as rotas</option>
              {KNOWN_ROUTES.map((route) => (
                <option key={route} value={route}>
                  {route}
                </option>
              ))}
            </select>

            <select
              aria-label="Janela de tempo"
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value as TimeWindow)}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-red-500 dark:focus:ring-red-500/20"
            >
              {TIME_WINDOWS.map((window) => (
                <option key={window} value={window}>
                  {window === "all" ? "Tudo" : window}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
              {(["all", "ok", "error"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-md px-2.5 py-0.5 text-[12px] font-semibold transition-colors ${
                    statusFilter === s
                      ? s === "ok"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : s === "error"
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                          : "bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-200"
                      : "text-slate-600 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-zinc-200"
                  }`}
                >
                  {s === "all" ? "Todos" : s === "ok" ? "OK" : "Erro"}
                </button>
              ))}
            </div>

            <select
              aria-label="Auto refresh"
              value={String(refreshSeconds)}
              onChange={(e) => setRefreshSeconds(Number(e.target.value))}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-red-500 dark:focus:ring-red-500/20"
            >
              <option value="0">Auto off</option>
              <option value="10">10s</option>
              <option value="30">30s</option>
            </select>

            <button
              type="button"
              onClick={() => void loadAudits({ append: false })}
              disabled={loading}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] text-slate-900 transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-red-500 dark:hover:text-red-300"
            >
              <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto bg-white font-mono text-[12px] dark:bg-[#0b1020]">
        {loading && (
          <div className="flex items-center gap-2 px-5 py-4 text-slate-600 dark:text-zinc-500">
            <span className="animate-pulse">▍</span>
            <span>Carregando logs...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-5 py-3 text-rose-600 dark:text-rose-400">
            <FiAlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="px-5 py-4 text-slate-600 dark:text-zinc-500">
            {items.length === 0
              ? "Nenhuma execucao auditada encontrada para os filtros atuais."
              : "Nenhum resultado para os filtros aplicados."}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="hidden border-b border-slate-300 bg-white px-5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-500 xl:grid xl:grid-cols-[80px_28px_120px_minmax(180px,1fr)_140px_140px_90px_70px_minmax(120px,1fr)]">
            <span>Hora</span>
            <span />
            <span>Rota</span>
            <span>Descricao</span>
            <span>Empresa</span>
            <span>Usuario</span>
            <span>Duração</span>
            <span>HTTP</span>
            <span>Erro</span>
          </div>
        )}

        {filtered.map((entry) => {
          const isExpanded = expandedKey === entry.key;
          const isOk = entry.payload.ok;
          return (
            <Fragment key={entry.key}>
              <div
                className={`group flex min-h-9 cursor-pointer items-center gap-3 border-b border-slate-300 bg-white px-5 py-2 transition-colors hover:bg-slate-50 dark:border-zinc-800 dark:bg-transparent dark:hover:bg-zinc-900/70 ${
                  isExpanded ? "bg-red-50/60 ring-1 ring-inset ring-red-200 dark:bg-red-950/20 dark:ring-0" : ""
                }`}
                onClick={() => setExpandedKey(isExpanded ? null : entry.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setExpandedKey(isExpanded ? null : entry.key);
                }}
              >
                <span className="w-20 shrink-0 text-slate-700 dark:text-zinc-500">{formatTimestamp(entry.payload.createdAt)}</span>
                <span className={`shrink-0 ${isOk ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {isOk ? "●" : "✖"}
                </span>
                <span className={`w-40 shrink-0 truncate font-semibold ${isOk ? "text-slate-900 dark:text-zinc-200" : "text-rose-700 dark:text-rose-300"}`}>
                  {routeLabel(entry.payload.route)}
                </span>
                <span className="w-32 shrink-0 truncate text-sky-700 dark:text-sky-300">
                  {routeDescription(entry.payload.route)}
                </span>
                <span className="w-32 shrink-0 truncate text-violet-700 dark:text-violet-300">
                  {entry.payload.companySlug || "-"}
                </span>
                <span className="w-32 shrink-0 truncate text-violet-700 dark:text-violet-300">
                  {entry.payload.actorUserId ? `uid:${String(entry.payload.actorUserId).slice(0, 8)}` : "-"}
                </span>
                <span className="w-20 shrink-0 text-slate-700 dark:text-zinc-500">{formatDuration(entry.payload.durationMs)}</span>
                <span
                  className={`w-12 shrink-0 font-semibold ${
                    (entry.payload.statusCode ?? 0) >= 400 ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-zinc-400"
                  }`}
                >
                  {entry.payload.statusCode ?? "-"}
                </span>
                {entry.payload.error && (
                  <span className="flex-1 truncate text-rose-600 opacity-80 dark:text-rose-400">{entry.payload.error}</span>
                )}
              </div>

              {isExpanded && (
                <div className="border-b border-slate-300 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
                  <div className="mb-2 flex items-center gap-3 text-slate-700 dark:text-zinc-500">
                    <FiClock className="h-3.5 w-3.5" />
                    <span>{formatDate(entry.payload.createdAt)}</span>
                    <span>·</span>
                    <span>{entry.payload.route}</span>
                    <span>·</span>
                    <span className={isOk ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}>
                      {isOk ? "Sucesso" : "Erro"}
                    </span>
                  </div>
                  <pre className="max-h-72 overflow-auto rounded-lg border border-slate-300 bg-white p-3 text-[11px] text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                    {JSON.stringify(entry.payload.metadata ?? {}, null, 2)}
                  </pre>
                  {entry.payload.error && (
                    <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">Erro: {entry.payload.error}</p>
                  )}
                </div>
              )}
            </Fragment>
          );
        })}

        {nextCursor && !loading && (
          <div className="flex justify-center py-4">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-[13px] text-slate-900 transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-red-500 dark:hover:text-red-300"
              disabled={loadingMore}
              onClick={() => void loadAudits({ append: true, cursor: nextCursor })}
            >
              {loadingMore ? <FiRefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FiActivity className="h-3.5 w-3.5" />}
              {loadingMore ? "Carregando..." : "Carregar mais"}
            </button>
          </div>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-4 border-t border-slate-300 bg-white px-5 py-1.5 text-[11px] text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500">
        <span>
          {filtered.length} de {items.length} entradas
        </span>
        {canSeeAll ? (
          <span>
            Empresa:{" "}
            <span className="text-sky-700 dark:text-sky-300">
              {companyFilter ? clients.find((company) => company.slug === companyFilter)?.name ?? companyFilter : "Todas as empresas"}
            </span>
          </span>
        ) : activeClient?.name ? (
          <span>
            Empresa: <span className="text-slate-700 dark:text-sky-300">{activeClient.name}</span>
          </span>
        ) : null}
        {user?.email && (
          <span>
            Usuario: <span className="text-violet-700 dark:text-violet-300">{user.email}</span>
          </span>
        )}
        {refreshSeconds > 0 && (
          <span className="ml-auto flex items-center gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Auto-refresh {refreshSeconds}s
          </span>
        )}
      </div>
    </div>
  );
}
