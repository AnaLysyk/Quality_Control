"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiChevronDown,
  FiChevronUp,
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

type TimeWindow = "all" | "1h" | "24h" | "7d";
type StatusFilter = "all" | "ok" | "error";
type SortOption = "recent" | "oldest" | "duration_desc" | "duration_asc" | "status";
type ExecutionTab = "overview" | "flow" | "details" | "raw";

const KNOWN_ROUTES = ["http", "qc-page-smoke", "griaule-biometrics"] as const;
const TIME_WINDOWS: TimeWindow[] = ["all", "1h", "24h", "7d"];
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

function formatDateTime(value?: string) {
  return formatDate(value);
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
  return "Execução registrada";
}

function stringifySafe(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildRouteSteps(entry: AuditEntry) {
  const payload = entry.payload;
  const statusLabel = payload.ok ? "Sucesso" : "Falha";
  const metadata = payload.metadata ?? {};

  if (payload.route === "http") {
    return [
      { title: "Receber payload", detail: `Metodo ${String(metadata.method ?? "-")} e URL alvo carregados.` },
      { title: "Executar chamada", detail: `Fetch realizado contra ${String(metadata.targetUrl ?? "-")}.` },
      { title: "Ler resposta", detail: `Status ${String(payload.statusCode ?? "-")} em ${formatDuration(payload.durationMs)}.` },
      { title: "Registrar auditoria", detail: `${statusLabel} gravado para o usuario e empresa atuais.` },
    ];
  }

  if (payload.route === "qc-page-smoke") {
    return [
      { title: "Abrir rota alvo", detail: `Tela interna ${String(metadata.targetPath ?? "-")} foi chamada via GET.` },
      { title: "Seguir redirecionamentos", detail: `URL final ${String(metadata.finalUrl ?? "-")}.` },
      { title: "Validar resposta", detail: `Redirect para login: ${String(metadata.redirectedToLogin ? "sim" : "nao")}.` },
      { title: "Registrar auditoria", detail: `${statusLabel} salvo com status ${String(payload.statusCode ?? "-")}.` },
    ];
  }

  if (payload.route === "griaule-biometrics") {
    return [
      { title: "Preparar fixture", detail: `Fixture ${String(metadata.fingerprintFixture ?? "-")} e modo ${String(metadata.mode ?? "-")}.` },
      { title: "Executar runner", detail: `includeFace=${String(metadata.includeFace ?? "-")} processId=${String(metadata.processId ?? "-")}.` },
      { title: "Receber resposta", detail: `Resposta tecnica registrada com status ${String(payload.statusCode ?? "-")}.` },
      { title: "Registrar auditoria", detail: `${statusLabel} persistido apos ${formatDuration(payload.durationMs)}.` },
    ];
  }

  return [
    { title: "Receber execução", detail: "Entrada capturada no audit store." },
    { title: "Executar fluxo", detail: "Detalhe especifico indisponivel para esta rota." },
    { title: "Registrar resposta", detail: `Status ${String(payload.statusCode ?? "-")} em ${formatDuration(payload.durationMs)}.` },
    { title: "Persistir auditoria", detail: `${statusLabel} salvo no historico.` },
  ];
}

function compareEntries(a: AuditEntry, b: AuditEntry, sortBy: SortOption) {
  const timeA = new Date(a.payload.createdAt ?? 0).getTime();
  const timeB = new Date(b.payload.createdAt ?? 0).getTime();
  const durationA = a.payload.durationMs ?? -1;
  const durationB = b.payload.durationMs ?? -1;
  const statusA = a.payload.ok ? 1 : 0;
  const statusB = b.payload.ok ? 1 : 0;

  switch (sortBy) {
    case "oldest":
      return timeA - timeB;
    case "duration_desc":
      return durationB - durationA || timeB - timeA;
    case "duration_asc":
      return durationA - durationB || timeB - timeA;
    case "status":
      return statusA - statusB || timeB - timeA;
    case "recent":
    default:
      return timeB - timeA;
  }
}

function tabLabel(tab: ExecutionTab) {
  if (tab === "overview") return "Resumo";
  if (tab === "flow") return "Fluxo";
  if (tab === "details") return "Detalhes";
  return "Bruto";
}

function SortArrows({ activeDirection }: { activeDirection: "up" | "down" | null }) {
  return (
    <span className="inline-flex flex-col leading-none">
      <FiChevronUp className={activeDirection === "up" ? "h-3 w-3 text-red-600" : "h-3 w-3 text-slate-300 dark:text-zinc-700"} />
      <FiChevronDown className={activeDirection === "down" ? "h-3 w-3 text-red-600" : "h-3 w-3 text-slate-300 dark:text-zinc-700"} />
    </span>
  );
}

export default function AutomationExecutionsDashboard() {
  const { access, activeClient } = useAutomationModuleContext();
  const { user } = useAuthUser();
  const requestSeq = useRef(0);

  const canSeeAllCompanies = access.hasGlobalCompanyVisibility;
  const [routeFilter, setRouteFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("24h");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<ExecutionTab>("overview");
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const effectiveCompanySlug = activeClient?.slug ?? null;
  const selectedCompanyLabel = activeClient?.name ?? (canSeeAllCompanies ? "Todas as empresas" : "empresa atual");

  const routeOptions = useMemo(() => {
    const seen = new Set(KNOWN_ROUTES.map((route) => route));
    const extra = items
      .map((item) => item.payload.route)
      .filter((route) => !seen.has(route));

    return [
      { value: "", label: "Todas as rotas" },
      ...KNOWN_ROUTES.map((route) => ({ value: route, label: routeLabel(route) })),
      ...Array.from(new Set(extra)).map((route) => ({ value: route, label: route })),
    ];
  }, [items]);

  const loadExecutions = useCallback(
    async (options?: { append?: boolean; cursor?: string | null }) => {
      if (!access.canViewTechnicalLogs) return;

      const append = options?.append === true;
      const cursor = options?.cursor ?? null;
      const requestId = ++requestSeq.current;
      const controller = new AbortController();

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
        setItems([]);
        setNextCursor(null);
        setSelectedKey(null);
        setSelectedTab("overview");
      }

      try {
        const searchParams = new URLSearchParams();
        if (effectiveCompanySlug) searchParams.set("companySlug", effectiveCompanySlug);
        if (routeFilter) searchParams.set("route", routeFilter);
        searchParams.set("window", timeWindow);
        searchParams.set("limit", "50");
        if (cursor) searchParams.set("cursor", cursor);

        const response = await fetch(`/api/automations/audit?${searchParams.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => null)) as
          | { audits?: AuditEntry[]; error?: string; nextCursor?: string | null }
          | null;

        if (!response.ok) {
          throw new Error(body?.error || "Falha ao carregar execuções.");
        }

        if (requestSeq.current !== requestId) return;

        const incoming = Array.isArray(body?.audits) ? body.audits : [];
        setItems((prev) => {
          if (!append) return incoming;
          const merged = [...prev, ...incoming];
          const deduped = new Map<string, AuditEntry>();
          for (const entry of merged) deduped.set(entry.key, entry);
          return Array.from(deduped.values());
        });
        setNextCursor(typeof body?.nextCursor === "string" && body.nextCursor.length > 0 ? body.nextCursor : null);
        setLastLoadedAt(new Date().toISOString());
      } catch (err) {
        if (requestSeq.current !== requestId || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Falha ao carregar execuções.");
        if (!append) {
          setItems([]);
          setNextCursor(null);
          setSelectedKey(null);
          setSelectedTab("overview");
        }
      } finally {
        if (requestSeq.current === requestId) {
          if (append) setLoadingMore(false);
          else setLoading(false);
        }
      }
    },
    [access.canViewTechnicalLogs, effectiveCompanySlug, routeFilter, timeWindow],
  );

  useEffect(() => {
    void loadExecutions();
  }, [loadExecutions]);

  const processedItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items
      .filter((entry) => {
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "ok" && entry.payload.ok) ||
          (statusFilter === "error" && !entry.payload.ok);
        const searchableText = [
          entry.payload.route,
          routeLabel(entry.payload.route),
          entry.payload.companySlug ?? "",
          entry.payload.actorUserId ?? "",
          entry.payload.error ?? "",
          entry.payload.statusCode ?? "",
          entry.payload.durationMs ?? "",
          stringifySafe(entry.payload.metadata ?? {}),
        ]
          .join(" ")
          .toLowerCase();
        const createdAtDate = entry.payload.createdAt ? new Date(entry.payload.createdAt) : null;
        const entryDate =
          createdAtDate && !Number.isNaN(createdAtDate.getTime())
            ? `${createdAtDate.getFullYear()}-${String(createdAtDate.getMonth() + 1).padStart(2, "0")}-${String(createdAtDate.getDate()).padStart(2, "0")}`
            : "";
        const matchesDate = !dateFilter || entryDate === dateFilter;
        const matchesSearch = !query || searchableText.includes(query);
        return matchesStatus && matchesSearch && matchesDate;
      })
      .sort((a, b) => compareEntries(a, b, sortBy));
  }, [dateFilter, items, search, sortBy, statusFilter]);

  useEffect(() => {
    if (processedItems.length === 0) {
      if (selectedKey !== null) setSelectedKey(null);
      setSelectedTab("overview");
      return;
    }

    const selectedVisible = processedItems.some((item) => item.key === selectedKey);
    if (selectedKey && !selectedVisible) {
      setSelectedKey(null);
    }
  }, [processedItems, selectedKey]);

  const selectedEntry = useMemo(
    () => processedItems.find((item) => item.key === selectedKey) ?? null,
    [processedItems, selectedKey],
  );

  const selectedSteps = useMemo(() => (selectedEntry ? buildRouteSteps(selectedEntry) : []), [selectedEntry]);
  const selectedMetadataEntries = useMemo(
    () => (selectedEntry ? Object.entries(selectedEntry.payload.metadata ?? {}).filter(([, value]) => value !== undefined) : []),
    [selectedEntry],
  );

  const successCount = useMemo(() => items.filter((entry) => entry.payload.ok).length, [items]);
  const errorCount = useMemo(() => items.filter((entry) => !entry.payload.ok).length, [items]);

  if (!access.canViewTechnicalLogs) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-white p-8 dark:bg-zinc-950">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <FiTerminal className="mx-auto mb-4 h-10 w-10 text-[#ef0001] dark:text-zinc-500" />
          <h2 className="text-lg font-bold text-[#0b1a3c] dark:text-zinc-100">Execuções</h2>
          <p className="mt-2 text-sm text-[#38507a] dark:text-zinc-400">
            Seu perfil não possui acesso às execuções técnicas de automação.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(8,11,21,0.98),rgba(17,24,39,0.98))] dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#0b1a3c] dark:text-zinc-500">
              <FiActivity className="h-4 w-4 text-red-500" />
              Execuções de automação
            </div>
            <h1 className="text-2xl font-semibold text-[#0b1a3c] dark:text-zinc-100">Fila, filtros e detalhe em modal</h1>
            <p className="max-w-3xl text-sm text-[#38507a] dark:text-zinc-400">
              Mostrando execuções da empresa <span className="font-semibold text-[#0b1a3c] dark:text-zinc-100">{selectedCompanyLabel}</span>.
              Clique em uma linha para abrir o modal com o fluxo completo e os detalhes em abas.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-200 bg-white px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-emerald-900/60 dark:bg-emerald-950/40">
              <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Sucesso</div>
              <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">{successCount}</div>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-white px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-rose-900/60 dark:bg-rose-950/40">
              <div className="text-[11px] uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">Falhas</div>
              <div className="text-lg font-semibold text-rose-700 dark:text-rose-300">{errorCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#38507a] dark:text-zinc-500">Carregadas</div>
              <div className="text-lg font-semibold text-[#0b1a3c] dark:text-zinc-100">{items.length}</div>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="relative flex-1 min-w-0">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#38507a] dark:text-zinc-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por rota, empresa, usuário, erro ou metadata"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-[#0b1a3c] outline-none transition placeholder:text-[#7a8bb5] focus:border-red-300 focus:ring-4 focus:ring-red-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-red-500 dark:focus:ring-red-500/20"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <select
                aria-label="Filtrar por rota"
                value={routeFilter}
                onChange={(event) => setRouteFilter(event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-[#0b1a3c] outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-red-500 dark:focus:ring-red-500/20"
              >
                {routeOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <input
                type="date"
                aria-label="Filtrar por data"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-[#0b1a3c] outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-red-500 dark:focus:ring-red-500/20"
              />

              <select
                aria-label="Período"
                value={timeWindow}
                onChange={(event) => setTimeWindow(event.target.value as TimeWindow)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-[#0b1a3c] outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-red-500 dark:focus:ring-red-500/20"
              >
                {TIME_WINDOWS.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "Tudo" : option}
                  </option>
                ))}
              </select>

              <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
                {(["all", "ok", "error"] as const).map((option) => {
                  const active = statusFilter === option;
                  const label = option === "all" ? "Todos" : option === "ok" ? "Sucesso" : "Falha";
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setStatusFilter(option)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? option === "ok"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : option === "error"
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                              : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                          : "text-[#38507a] hover:bg-slate-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-red-300"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => void loadExecutions({ append: false })}
                disabled={loading}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#0b1a3c] transition hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-red-500 dark:hover:text-red-300"
              >
                <FiRefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Atualizar
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#38507a] dark:text-zinc-500">
            <span>{loading ? "Consultando execuções..." : `Mostrando ${processedItems.length} de ${items.length} carregadas${lastLoadedAt ? ` • atualizado em ${formatTimestamp(lastLoadedAt)}` : ""}`}</span>
            <span className="uppercase tracking-[0.18em] text-[10px]">
              {statusFilter === "all" ? "Todos os status" : statusFilter === "ok" ? "Somente sucesso" : "Somente falha"}
            </span>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        {error && (
          <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            <FiAlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-[#38507a] dark:text-zinc-500">
            <span className="animate-pulse">▍</span>
            Carregando execuções...
          </div>
        )}

        {!loading && !error && processedItems.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-[#38507a] dark:text-zinc-500">
            {items.length === 0
              ? "Nenhuma execução foi registrada para os filtros atuais."
              : "Nenhum resultado encontrado para a busca e filtros aplicados."}
          </div>
        )}

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="grid grid-cols-[minmax(0,1.7fr)_170px_110px_110px_24px] items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#38507a] dark:text-zinc-500">
            <div>Rota</div>
            <button
              type="button"
              onClick={() => setSortBy((current) => (current === "recent" ? "oldest" : "recent"))}
              className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-white/80 hover:text-red-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 ${sortBy === "recent" || sortBy === "oldest" ? "text-red-600 dark:text-red-300" : ""}`}
            >
              <span>Data</span>
              <SortArrows activeDirection={sortBy === "recent" ? "down" : sortBy === "oldest" ? "up" : null} />
            </button>
            <button
              type="button"
              onClick={() => setSortBy((current) => (current === "duration_desc" ? "duration_asc" : "duration_desc"))}
              className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-white/80 hover:text-red-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 ${sortBy === "duration_desc" || sortBy === "duration_asc" ? "text-red-600 dark:text-red-300" : ""}`}
            >
              <span>Duração</span>
              <SortArrows activeDirection={sortBy === "duration_desc" ? "down" : sortBy === "duration_asc" ? "up" : null} />
            </button>
            <button
              type="button"
              onClick={() => setSortBy("status")}
              className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-white/80 hover:text-red-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 ${sortBy === "status" ? "text-red-600 dark:text-red-300" : ""}`}
            >
              <span>Status</span>
              <SortArrows activeDirection={sortBy === "status" ? "down" : null} />
            </button>
            <div />
          </div>
        </div>

        <div className="divide-y divide-slate-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
          {processedItems.map((entry) => {
            const statusOk = entry.payload.ok;
            const statusLabel = statusOk ? "Sucesso" : "Falha";
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => {
                  setSelectedKey(entry.key);
                  setSelectedTab("overview");
                }}
                className={`grid w-full grid-cols-[minmax(0,1.7fr)_170px_110px_110px_24px] items-center gap-3 px-4 py-4 text-left transition ${
                  selectedKey === entry.key
                    ? "bg-[#fff5f5] shadow-[inset_0_0_0_1px_rgba(239,0,1,0.12)] dark:bg-zinc-900/90"
                    : "hover:bg-[#fbfdff] dark:hover:bg-zinc-900/80"
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className={`mt-0.5 rounded-full p-2 ${statusOk ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"}`}>
                    {statusOk ? <FiCheckCircle className="h-4 w-4" /> : <FiXCircle className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#38507a] dark:border-zinc-700 dark:text-zinc-400">
                        {routeLabel(entry.payload.route)}
                      </span>
                      <span className={`text-xs font-semibold ${statusOk ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-[#0b1a3c] dark:text-zinc-100">
                      {entry.payload.route}
                      <span className="ml-2 text-xs font-normal text-[#38507a] dark:text-zinc-500">{routeDescription(entry.payload.route)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-[#38507a] dark:text-zinc-500">
                      <span>Empresa: {entry.payload.companySlug ?? "-"}</span>
                      <span>Usuário: {entry.payload.actorUserId ? `uid:${String(entry.payload.actorUserId).slice(0, 8)}` : "-"}</span>
                    </div>
                    {entry.payload.error && (
                      <div className="mt-2 line-clamp-2 text-sm text-rose-600 dark:text-rose-400">{entry.payload.error}</div>
                    )}
                  </div>
                </div>

                <div className="text-xs text-[#38507a] dark:text-zinc-500">{formatDateTime(entry.payload.createdAt)}</div>
                <div className="text-xs text-[#38507a] dark:text-zinc-500">{formatDuration(entry.payload.durationMs)}</div>
                <div className={`text-xs font-semibold ${statusOk ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {entry.payload.statusCode ?? "-"}
                </div>
                <div className="justify-self-end text-[#7a8bb5] dark:text-zinc-600">
                  <FiArrowRight className="h-4 w-4 shrink-0" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-slate-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
          {nextCursor ? (
            <button
              type="button"
              onClick={() => void loadExecutions({ append: true, cursor: nextCursor })}
              disabled={loadingMore}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#0b1a3c] transition hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-red-500 dark:hover:text-red-300"
            >
              {loadingMore ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiActivity className="h-4 w-4" />}
              {loadingMore ? "Carregando..." : "Carregar mais"}
            </button>
          ) : (
            <div className="text-sm text-[#38507a] dark:text-zinc-500">Fim da lista carregada.</div>
          )}
        </div>
      </section>

      {selectedEntry ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm dark:bg-black/70"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedKey(null);
            }
          }}
        >
          <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white text-[#0b1a3c] shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0b1a3c] dark:text-zinc-400">Detalhe da execução</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-[#0b1a3c] dark:text-zinc-50">{routeLabel(selectedEntry.payload.route)}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${selectedEntry.payload.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}>
                    {selectedEntry.payload.ok ? "Sucesso" : "Falha"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#0b1a3c] dark:text-zinc-400">{routeDescription(selectedEntry.payload.route)}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedKey(null);
                  setSelectedTab("overview");
                }}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-[#0b1a3c] transition hover:border-red-300 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-red-500 dark:hover:text-red-300"
              >
                Fechar
              </button>
            </div>

            <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
                {(["overview", "flow", "details", "raw"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSelectedTab(tab)}
                    className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                      selectedTab === tab
                        ? "bg-red-600 text-white shadow-sm dark:bg-red-500 dark:text-white"
                        : "text-[#0b1a3c] hover:text-[#ef0001] dark:text-zinc-400 dark:hover:text-zinc-100"
                    }`}
                  >
                    {tabLabel(tab)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid flex-1 gap-3 overflow-hidden bg-white p-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.7fr)] dark:bg-zinc-950">
              <div className="min-h-0 space-y-3 overflow-auto rounded-[22px] bg-white p-3 pr-1 shadow-[inset_0_1px_0_rgba(15,23,42,0.04)] dark:bg-zinc-900/80">
                {selectedTab === "overview" && (
                  <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[#0b1a3c] dark:text-zinc-400">Empresa</div>
                        <div className="mt-1 text-sm font-semibold text-[#0b1a3c] dark:text-zinc-50">{selectedEntry.payload.companySlug ?? "-"}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[#0b1a3c] dark:text-zinc-400">Usuário</div>
                        <div className="mt-1 text-sm font-semibold text-[#0b1a3c] dark:text-zinc-50">{selectedEntry.payload.actorUserId ? `uid:${String(selectedEntry.payload.actorUserId)}` : "-"}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[#0b1a3c] dark:text-zinc-400">Status</div>
                        <div className="mt-1 text-sm font-semibold text-[#0b1a3c] dark:text-zinc-50">{selectedEntry.payload.statusCode ?? "-"}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[#0b1a3c] dark:text-zinc-400">Duração</div>
                        <div className="mt-1 text-sm font-semibold text-[#0b1a3c] dark:text-zinc-50">{formatDuration(selectedEntry.payload.durationMs)}</div>
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#0b1a3c] dark:text-zinc-400">Resumo</div>
                      <p className="mt-1.5 text-sm text-[#0b1a3c] dark:text-zinc-300">
                        Executada em {formatDate(selectedEntry.payload.createdAt)}.
                      </p>
                      {selectedEntry.payload.error && (
                        <div className="mt-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                          <div className="font-semibold">Erro registrado</div>
                          <div className="mt-1">{selectedEntry.payload.error}</div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {selectedTab === "flow" && (
                  <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#0b1a3c] dark:text-zinc-50">
                      <FiClock className="h-4 w-4 text-red-500" />
                      Fluxo completo até a resposta
                    </div>
                    <div className="mt-3 space-y-2.5">
                      {selectedSteps.map((step, index) => (
                        <div key={step.title} className="flex gap-3">
                          <div className="flex w-7 shrink-0 flex-col items-center">
                            <div
                              className={`mt-1 h-3 w-3 rounded-full ${selectedEntry.payload.ok || index < selectedSteps.length - 1 ? "bg-emerald-500" : "bg-rose-500"}`}
                            />
                            {index < selectedSteps.length - 1 && <div className="mt-1 h-full w-px bg-slate-200 dark:bg-zinc-700" />}
                          </div>
                          <div className="min-w-0 flex-1 pb-2">
                            <div className="text-sm font-semibold text-[#0b1a3c] dark:text-zinc-50">{step.title}</div>
                            <div className="mt-1 text-sm text-[#0b1a3c] dark:text-zinc-300">{step.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selectedTab === "details" && (
                  <section className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedMetadataEntries.length > 0 ? (
                        selectedMetadataEntries.map(([key, value]) => (
                          <div key={key} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-[#0b1a3c] dark:text-zinc-400">{key}</div>
                            <div className="mt-1 break-words text-sm font-semibold text-[#0b1a3c] dark:text-zinc-50">
                              {typeof value === "string" ? value : stringifySafe(value)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-[#0b1a3c] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400 sm:col-span-2">
                          Nenhum metadata adicional foi persistido nesta execução.
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {selectedTab === "raw" && (
                  <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                    <div className="text-sm font-semibold text-[#0b1a3c] dark:text-zinc-50">Evento bruto</div>
                    <pre className="mt-2.5 max-h-[44vh] overflow-auto rounded-2xl border border-slate-200 bg-white p-3 text-[12px] leading-6 text-[#0b1a3c] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                      {stringifySafe(selectedEntry.payload)}
                    </pre>
                  </section>
                )}
              </div>

              <aside className="min-h-0 space-y-3 overflow-auto rounded-[22px] bg-white p-3 shadow-[inset_0_1px_0_rgba(15,23,42,0.04)] dark:bg-zinc-950">
                <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#0b1a3c] dark:text-zinc-400">Contexto</div>
                  <div className="mt-2 space-y-1.5 text-sm text-[#0b1a3c] dark:text-zinc-300">
                    <p>Empresa: {selectedEntry.payload.companySlug ?? "-"}</p>
                    <p>Usuario: {selectedEntry.payload.actorUserId ? `uid:${String(selectedEntry.payload.actorUserId)}` : "-"}</p>
                    <p>Status: {selectedEntry.payload.statusCode ?? "-"}</p>
                    <p>Duração: {formatDuration(selectedEntry.payload.durationMs)}</p>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#0b1a3c] dark:text-zinc-400">Observação</div>
                  <p className="mt-1.5 text-sm leading-6 text-[#0b1a3c] dark:text-zinc-300">
                    A listagem mostra só o resumo. Os detalhes completos, passos e metadata ficam nesta modal.
                  </p>
                </section>
              </aside>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-xs text-[#38507a] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500">
        {loading
          ? "Consultando a fila de execuções..."
          : `Paginacao por cursor ativa. Carregue mais resultados para ampliar o historico visivel.${user?.email ? ` Usuario: ${user.email}.` : ""}`}
      </footer>
    </div>
  );
}




