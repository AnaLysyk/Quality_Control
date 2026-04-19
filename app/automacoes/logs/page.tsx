"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

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
  return `${Math.max(0, Math.round(value))} ms`;
}

export default function AutomacoesLogsPage() {
  const { access, activeClient } = useAutomationModuleContext();
  const [routeFilter, setRouteFilter] = useState<string>("");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("24h");
  const [refreshSeconds, setRefreshSeconds] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const loadAudits = useCallback(async (options?: { append?: boolean; cursor?: string | null }) => {
    if (!access.canViewTechnicalLogs) return;
    if (!activeClient?.slug) return;
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
      searchParams.set("companySlug", activeClient.slug);
      searchParams.set("window", timeWindow);
      searchParams.set("limit", "100");
      if (cursor) searchParams.set("cursor", cursor);
      const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
      const response = await fetch(`/api/automations/audit${query}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => null)) as {
        audits?: AuditEntry[];
        error?: string;
        nextCursor?: string | null;
      } | null;

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
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [access.canViewTechnicalLogs, activeClient?.slug, routeFilter, timeWindow]);

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

    const intervalId = window.setInterval(() => {
      void loadAudits();
    }, refreshSeconds * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [access.canViewTechnicalLogs, loadAudits, refreshSeconds]);

  const totalOk = useMemo(() => items.filter((entry) => entry.payload.ok).length, [items]);

  if (!access.canViewTechnicalLogs) {
    return (
      <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5">
        <h1 className="text-lg font-semibold text-(--tc-text,#0b1a3c)">Logs técnicos</h1>
        <p className="mt-2 text-sm text-(--tc-text-muted,#6b7280)">
          Seu perfil atual não possui acesso aos logs técnicos de automação.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5">
        <h1 className="text-lg font-semibold text-(--tc-text,#0b1a3c)">Logs técnicos de automação</h1>
        <p className="mt-1 text-sm text-(--tc-text-muted,#6b7280)">
          Últimas execuções auditadas no banco dedicado da automação.
        </p>
        {activeClient?.name ? (
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--tc-text-muted,#6b7280)">
            Empresa: {activeClient.name}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-(--tc-text-muted,#6b7280)" htmlFor="automation-route-filter">
            Rota
          </label>
          <select
            id="automation-route-filter"
            className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 text-sm text-(--tc-text,#0b1a3c)"
            value={routeFilter}
            onChange={(event) => setRouteFilter(event.target.value)}
          >
            <option value="">Todas</option>
            {KNOWN_ROUTES.map((route) => (
              <option key={route} value={route}>
                {route}
              </option>
            ))}
          </select>

          <label className="ml-3 text-xs font-semibold uppercase tracking-[0.12em] text-(--tc-text-muted,#6b7280)" htmlFor="automation-time-window">
            Janela
          </label>
          <select
            id="automation-time-window"
            className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 text-sm text-(--tc-text,#0b1a3c)"
            value={timeWindow}
            onChange={(event) => setTimeWindow(event.target.value as TimeWindow)}
          >
            <option value="all">Tudo</option>
            <option value="1h">1h</option>
            <option value="24h">24h</option>
            <option value="7d">7d</option>
          </select>

          <label className="ml-3 text-xs font-semibold uppercase tracking-[0.12em] text-(--tc-text-muted,#6b7280)" htmlFor="automation-auto-refresh">
            Auto refresh
          </label>
          <select
            id="automation-auto-refresh"
            className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 text-sm text-(--tc-text,#0b1a3c)"
            value={String(refreshSeconds)}
            onChange={(event) => setRefreshSeconds(Number(event.target.value))}
          >
            <option value="0">Off</option>
            <option value="10">10s</option>
            <option value="30">30s</option>
          </select>

          <button
            type="button"
            className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 text-sm font-semibold text-(--tc-text,#0b1a3c) hover:border-(--tc-accent,#ef0001)"
            onClick={() => {
              void loadAudits({ append: false });
            }}
          >
            Atualizar
          </button>

          <span className="ml-auto rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-xs text-(--tc-text-muted,#6b7280)">
            {totalOk}/{items.length} OK
          </span>
        </div>
      </header>

      <div className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5">
        {loading ? <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando logs...</p> : null}
        {error ? <p className="text-sm text-[#b91c1c]">{error}</p> : null}
        {!loading && !error && items.length === 0 ? (
          <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhuma execução auditada encontrada.</p>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div className="overflow-x-auto space-y-3">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-(--tc-text-muted,#6b7280)">
                  <th className="px-3 py-2">Rota</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Empresa</th>
                  <th className="px-3 py-2">Duração</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Quando</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => {
                  const isExpanded = expandedKey === entry.key;
                  const metadataText = JSON.stringify(entry.payload.metadata ?? {}, null, 2);
                  return (
                    <Fragment key={entry.key}>
                      <tr className="rounded-lg bg-(--tc-surface-2,#f8fafc)">
                        <td className="px-3 py-2 font-medium text-(--tc-text,#0b1a3c)">{entry.payload.route}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              entry.payload.ok ? "bg-[#ecfdf3] text-[#166534]" : "bg-[#fef2f2] text-[#991b1b]"
                            }`}
                          >
                            {entry.payload.ok ? "OK" : "Erro"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-(--tc-text-secondary,#4b5563)">{entry.payload.companySlug || "-"}</td>
                        <td className="px-3 py-2 text-(--tc-text-secondary,#4b5563)">{formatDuration(entry.payload.durationMs)}</td>
                        <td className="px-3 py-2 text-(--tc-text-secondary,#4b5563)">{entry.payload.statusCode ?? "-"}</td>
                        <td className="px-3 py-2 text-(--tc-text-secondary,#4b5563)">{formatDate(entry.payload.createdAt)}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            className="rounded-md border border-(--tc-border,#d7deea) px-2 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c) hover:border-(--tc-accent,#ef0001)"
                            onClick={() => setExpandedKey(isExpanded ? null : entry.key)}
                          >
                            {isExpanded ? "Ocultar" : "Detalhes"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="bg-(--tc-surface,#ffffff)">
                          <td className="px-3 pb-4" colSpan={7}>
                            <pre className="max-h-72 overflow-auto rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3 text-xs text-(--tc-text-secondary,#4b5563)">
                              {metadataText}
                            </pre>
                            {entry.payload.error ? (
                              <p className="mt-2 text-xs text-[#991b1b]">Erro: {entry.payload.error}</p>
                            ) : null}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {nextCursor ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  className="min-h-10 rounded-lg border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 text-sm font-semibold text-(--tc-text,#0b1a3c) hover:border-(--tc-accent,#ef0001) disabled:opacity-60"
                  disabled={loadingMore}
                  onClick={() => {
                    void loadAudits({ append: true, cursor: nextCursor });
                  }}
                >
                  {loadingMore ? "Carregando..." : "Carregar mais"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
