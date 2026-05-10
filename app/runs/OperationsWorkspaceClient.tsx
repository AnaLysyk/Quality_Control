"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiFilter, FiRefreshCw, FiSearch, FiXCircle } from "react-icons/fi";

import { useClientContext } from "@/context/ClientContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";

type OperationSignal = {
  id: string;
  type: "run" | "defect" | "automation" | "integration";
  title: string;
  companySlug: string;
  companyName: string;
  application: string;
  module: string;
  status: "new" | "analyzing" | "in_progress" | "blocked" | "resolved" | "failed" | "alert";
  owner: string;
  severity: "critical" | "high" | "medium" | "low";
  priority: "P0" | "P1" | "P2" | "P3";
  runCode: string;
  defectCode: string;
  updatedAtIso: string;
  passRate?: number;
  failCount?: number;
  durationMin?: number;
};

type CompanyRouteInput = {
  isGlobalAdmin: boolean;
  permissionRole: string | null;
  role: string | null;
  companyRole: string | null;
  userOrigin: string | null;
  companyCount: number;
  clientSlug: string | null;
  defaultClientSlug: string | null;
};

type PeriodPreset = "24h" | "7d" | "30d" | "month" | "custom";
type ModuleView = "none" | "Aplicacoes" | "Runs" | "Defeitos" | "Automacoes" | "Integracoes";

type AppliedFilters = {
  companySlugs: string[];
  application: string;
  module: ModuleView;
  status: string;
  periodPreset: PeriodPreset;
  dateFrom: string;
  dateTo: string;
  search: string;
};

type StatusOption = {
  value: string;
  label: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function parseItemsFromPayload(payload: unknown, ...keys: string[]) {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  if (!root) return [];

  for (const key of keys) {
    const direct = root[key];
    if (Array.isArray(direct)) return direct;
  }

  const dataNode = root.data;
  if (Array.isArray(dataNode)) return dataNode;
  const dataRecord = asRecord(dataNode);
  if (dataRecord) {
    for (const key of keys) {
      const nested = dataRecord[key];
      if (Array.isArray(nested)) return nested;
    }
  }

  return [];
}

function normalizeModule(raw: string): ModuleView {
  const value = raw.toLowerCase();
  if (value.includes("run")) return "Runs";
  if (value.includes("defeit")) return "Defeitos";
  if (value.includes("automat")) return "Automacoes";
  if (value.includes("integra")) return "Integracoes";
  return "none";
}

function mapStatusByModule(module: ModuleView): StatusOption[] {
  if (module === "Runs") {
    return [
      { value: "all", label: "Todos" },
      { value: "in_progress", label: "Em andamento" },
      { value: "failed", label: "Falhou" },
      { value: "blocked", label: "Bloqueada" },
      { value: "resolved", label: "Finalizada" },
      { value: "new", label: "Pendente" },
      { value: "analyzing", label: "Em análise" },
    ];
  }

  if (module === "Defeitos") {
    return [
      { value: "all", label: "Todos" },
      { value: "new", label: "Aberto" },
      { value: "analyzing", label: "Em análise" },
      { value: "in_progress", label: "Em correção" },
      { value: "alert", label: "Reaberto" },
      { value: "resolved", label: "Fechado" },
      { value: "blocked", label: "Bloqueado" },
    ];
  }

  if (module === "Automacoes") {
    return [
      { value: "all", label: "Todos" },
      { value: "new", label: "Nova" },
      { value: "in_progress", label: "Em execução" },
      { value: "failed", label: "Falhou" },
      { value: "alert", label: "Com alerta" },
      { value: "resolved", label: "Concluída" },
    ];
  }

  if (module === "Integracoes") {
    return [
      { value: "all", label: "Todos" },
      { value: "in_progress", label: "Ativa" },
      { value: "failed", label: "Falha" },
      { value: "alert", label: "Com alerta" },
      { value: "resolved", label: "Saudável" },
    ];
  }

  return [];
}

function statusFieldLabel(module: ModuleView) {
  if (module === "Runs") return "Status da run";
  if (module === "Defeitos") return "Status do defeito";
  if (module === "Automacoes") return "Status da automação";
  if (module === "Integracoes") return "Status da integração";
  return "Status";
}

function formatAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min`;
  const hour = Math.floor(min / 60);
  return `${hour}h`;
}

function filterCustomPeriod(items: OperationSignal[], from: string, to: string) {
  if (!from && !to) return items;
  const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null;

  return items.filter((item) => {
    const ts = new Date(item.updatedAtIso).getTime();
    if (fromTs != null && ts < fromTs) return false;
    if (toTs != null && ts > toTs) return false;
    return true;
  });
}

export function OperationsWorkspaceClient() {
  const { user, normalizedUser } = useAuthUser();
  const { clients, activeClientSlug } = useClientContext();

  const visibleCompanies = useMemo(() => {
    const nonSeed = clients.filter((company) => {
      const haystack = `${company.name} ${company.slug}`.toLowerCase();
      return !(haystack.includes("persist") || haystack.includes("seed") || haystack.includes("fake"));
    });
    return nonSeed.length > 0 ? nonSeed : clients;
  }, [clients]);

  const [draftCompanySlugs, setDraftCompanySlugs] = useState<string[]>([]);
  const [draftApplication, setDraftApplication] = useState("all");
  const [draftModule, setDraftModule] = useState<ModuleView>("none");
  const [draftStatus, setDraftStatus] = useState("all");
  const [draftPeriodPreset, setDraftPeriodPreset] = useState<PeriodPreset>("24h");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [companyFilterQuery, setCompanyFilterQuery] = useState("");
  const [applicationFilterQuery, setApplicationFilterQuery] = useState("");
  const [moduleFilterQuery, setModuleFilterQuery] = useState("");

  const [applied, setApplied] = useState<AppliedFilters>({
    companySlugs: [],
    application: "all",
    module: "none",
    status: "all",
    periodPreset: "24h",
    dateFrom: "",
    dateTo: "",
    search: "",
  });

  const [signals, setSignals] = useState<OperationSignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const companyRouteInput: CompanyRouteInput = {
    isGlobalAdmin: user?.isGlobalAdmin === true,
    permissionRole: user?.permissionRole ?? null,
    role: user?.role ?? null,
    companyRole: user?.companyRole ?? null,
    userOrigin:
      (user as { userOrigin?: string | null } | null)?.userOrigin ??
      (user as { user_origin?: string | null } | null)?.user_origin ??
      null,
    companyCount: normalizedUser.companyCount,
    clientSlug: normalizedUser.primaryCompanySlug,
    defaultClientSlug: normalizedUser.defaultCompanySlug,
  };

  useEffect(() => {
    if (visibleCompanies.length === 0) return;
    if (draftCompanySlugs.length > 0) return;

    const firstSlug =
      activeClientSlug && visibleCompanies.some((company) => company.slug === activeClientSlug)
        ? activeClientSlug
        : visibleCompanies[0]?.slug;

    if (firstSlug) {
      setDraftCompanySlugs([firstSlug]);
    }
  }, [activeClientSlug, draftCompanySlugs.length, visibleCompanies]);

  useEffect(() => {
    if (draftCompanySlugs.length !== 1) {
      setDraftApplication("all");
      setDraftModule("none");
      setDraftStatus("all");
    }
  }, [draftCompanySlugs]);

  useEffect(() => {
    setDraftStatus("all");
  }, [draftModule]);

  const periodForApi = useMemo(() => {
    if (applied.periodPreset === "24h") return "24h";
    if (applied.periodPreset === "7d") return "7d";
    return "30d";
  }, [applied.periodPreset]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (applied.companySlugs.length === 0) {
        if (!cancelled) {
          setSignals([]);
          setError(null);
          setLoading(false);
          setLoadingApplications(false);
        }
        return;
      }

      setLoading(true);
      setLoadingApplications(true);
      setError(null);

      try {
        const query = new URLSearchParams();
        query.set("period", periodForApi);
        applied.companySlugs.forEach((slug) => query.append("companySlug", slug));

        const response = await fetch(`/api/operacao/summary?${query.toString()}`, { cache: "no-store" });
        const payload = response.ok ? await response.json().catch(() => null) : null;

        if (!payload) {
          throw new Error("Falha ao carregar dados operacionais.");
        }

        const mappedSignals = parseItemsFromPayload(payload, "signals")
          .map((item) => asRecord(item))
          .filter((item): item is Record<string, unknown> => Boolean(item))
          .map((row, index) => ({
            id: asString(row.id, `signal-${index}`),
            type: asString(row.type, "run") as OperationSignal["type"],
            title: asString(row.title, "Item operacional"),
            companySlug: asString(row.companySlug),
            companyName: asString(row.companyName),
            application: asString(row.application, "N/A"),
            module: asString(row.module, "N/A"),
            status: asString(row.status, "new") as OperationSignal["status"],
            owner: asString(row.owner, "Sem responsável"),
            severity: asString(row.severity, "medium") as OperationSignal["severity"],
            priority: asString(row.priority, "P2") as OperationSignal["priority"],
            runCode: asString(row.runCode),
            defectCode: asString(row.defectCode),
            updatedAtIso: asString(row.updatedAtIso, new Date().toISOString()),
            passRate: typeof row.passRate === "number" ? row.passRate : undefined,
            failCount: typeof row.failCount === "number" ? row.failCount : undefined,
            durationMin: typeof row.durationMin === "number" ? row.durationMin : undefined,
          }));

        if (!cancelled) {
          setSignals(mappedSignals);
          setLastUpdatedAt(new Date().toISOString());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar operação.");
          setSignals([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingApplications(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [applied.companySlugs, periodForApi, refreshNonce]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => setRefreshNonce((current) => current + 1), 60000);
    return () => window.clearInterval(id);
  }, [autoRefresh]);

  const selectedCompanies = useMemo(
    () => visibleCompanies.filter((company) => applied.companySlugs.includes(company.slug)),
    [applied.companySlugs, visibleCompanies],
  );

  const filteredVisibleCompanies = useMemo(() => {
    const term = companyFilterQuery.trim().toLowerCase();
    if (!term) return visibleCompanies;
    return visibleCompanies.filter((company) =>
      `${company.name} ${company.slug}`.toLowerCase().includes(term),
    );
  }, [companyFilterQuery, visibleCompanies]);

  const hasCompanySearchQuery = companyFilterQuery.trim().length > 0;

  const applicationsForSelection = useMemo(() => {
    const apps = new Set(
      signals
        .filter((signal) => applied.companySlugs.includes(signal.companySlug))
        .map((signal) => signal.application)
        .filter((value) => value && value !== "N/A"),
    );
    return Array.from(apps).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [applied.companySlugs, signals]);

  const modulesForSelection = useMemo(() => {
    if (applied.application === "all") return [] as ModuleView[];

    const available = new Set<ModuleView>();
    signals
      .filter((signal) => signal.application === applied.application)
      .forEach((signal) => {
        const moduleName = normalizeModule(signal.module);
        if (moduleName !== "none") available.add(moduleName);
      });

    available.add("Aplicacoes");
    return Array.from(available);
  }, [applied.application, signals]);

  const filteredApplicationsForSelection = useMemo(() => {
    const term = applicationFilterQuery.trim().toLowerCase();
    if (!term) return applicationsForSelection;
    return applicationsForSelection.filter((application) => application.toLowerCase().includes(term));
  }, [applicationFilterQuery, applicationsForSelection]);

  const availableModulesForSelection = useMemo<ModuleView[]>(
    () =>
      modulesForSelection.length > 0
        ? modulesForSelection
        : ["Aplicacoes", "Runs", "Defeitos", "Automacoes", "Integracoes"],
    [modulesForSelection],
  );

  const filteredModulesForSelection = useMemo(() => {
    const term = moduleFilterQuery.trim().toLowerCase();
    if (!term) return availableModulesForSelection;
    return availableModulesForSelection.filter((module) => module.toLowerCase().includes(term));
  }, [availableModulesForSelection, moduleFilterQuery]);

  const filteredSignals = useMemo(() => {
    let result = signals.filter((signal) => applied.companySlugs.includes(signal.companySlug));

    if (applied.application !== "all") {
      result = result.filter((signal) => signal.application === applied.application);
    }

    if (applied.module !== "none" && applied.module !== "Aplicacoes") {
      result = result.filter((signal) => normalizeModule(signal.module) === applied.module);
    }

    if (applied.status !== "all") {
      result = result.filter((signal) => signal.status === applied.status);
    }

    if (applied.periodPreset === "custom") {
      result = filterCustomPeriod(result, applied.dateFrom, applied.dateTo);
    }

    if (applied.search.trim()) {
      const term = applied.search.trim().toLowerCase();
      if (applied.module === "Runs") {
        result = result.filter((signal) =>
          signal.title.toLowerCase().includes(term) || signal.runCode.toLowerCase().includes(term),
        );
      } else if (applied.module === "Defeitos") {
        result = result.filter((signal) =>
          signal.title.toLowerCase().includes(term) || signal.defectCode.toLowerCase().includes(term),
        );
      } else if (applied.module === "Aplicacoes") {
        result = result.filter((signal) => signal.application.toLowerCase().includes(term));
      }
    }

    return result;
  }, [applied, signals]);

  const applicationsSummary = useMemo(() => {
    const map = new Map<string, { name: string; lastIso: string; modules: Set<string>; total: number }>();

    signals
      .filter((signal) => applied.companySlugs.includes(signal.companySlug))
      .forEach((signal) => {
        const current = map.get(signal.application);
        if (!current) {
          map.set(signal.application, {
            name: signal.application,
            lastIso: signal.updatedAtIso,
            modules: new Set([signal.module]),
            total: 1,
          });
          return;
        }

        current.total += 1;
        current.modules.add(signal.module);
        if (new Date(signal.updatedAtIso).getTime() > new Date(current.lastIso).getTime()) {
          current.lastIso = signal.updatedAtIso;
        }
      });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [applied.companySlugs, signals]);

  const canSelectApplication = draftCompanySlugs.length === 1;
  const statusOptions = mapStatusByModule(draftModule);

  const applyFilters = () => {
    setApplied({
      companySlugs: [...draftCompanySlugs],
      application: canSelectApplication ? draftApplication : "all",
      module: canSelectApplication ? draftModule : "none",
      status: draftStatus,
      periodPreset: draftPeriodPreset,
      dateFrom: draftDateFrom,
      dateTo: draftDateTo,
      search: draftSearch,
    });
  };

  const clearFilters = () => {
    const firstSlug =
      activeClientSlug && visibleCompanies.some((company) => company.slug === activeClientSlug)
        ? [activeClientSlug]
        : [];

    setDraftCompanySlugs(firstSlug);
    setDraftApplication("all");
    setDraftModule("none");
    setDraftStatus("all");
    setDraftPeriodPreset("24h");
    setDraftDateFrom("");
    setDraftDateTo("");
    setDraftSearch("");

    setApplied({
      companySlugs: firstSlug,
      application: "all",
      module: "none",
      status: "all",
      periodPreset: "24h",
      dateFrom: "",
      dateTo: "",
      search: "",
    });
  };

  const toggleDraftCompany = (slug: string) => {
    setDraftCompanySlugs((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug],
    );
  };

  const singleCompanySlug = applied.companySlugs.length === 1 ? applied.companySlugs[0] : null;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const context = {
      companySlugs: applied.companySlugs,
      application: applied.application,
      module: applied.module,
      status: applied.status,
      periodPreset: applied.periodPreset,
      dateFrom: applied.dateFrom,
      dateTo: applied.dateTo,
      resultCount: filteredSignals.length,
      lastUpdatedAt,
      state:
        applied.companySlugs.length === 0
          ? "initial"
          : applied.application === "all"
            ? "company_selected"
            : applied.module === "none"
              ? "application_selected"
              : "module_selected",
    };

    (window as unknown as { __TC_OPERATIONS_CONTEXT__?: unknown }).__TC_OPERATIONS_CONTEXT__ = context;
  }, [applied, filteredSignals.length, lastUpdatedAt]);

  return (
    <div className="min-h-screen bg-(--page-bg,#fff) px-4 py-6 text-(--page-text,#0b1a3c) sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 sm:p-6">
          <h1 className="text-2xl font-extrabold tracking-tight">Operações</h1>
          <p className="mt-2 text-sm text-(--tc-text-muted,#6b7280)">
            Monitore em tempo real as aplicações, módulos, runs, defeitos e eventos das empresas.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-(--tc-text-muted,#6b7280)">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-(--tc-border,#d7deea) px-2.5 py-1">
              <FiClock className="h-3.5 w-3.5" />
              {lastUpdatedAt ? `Atualizado há ${formatAgo(lastUpdatedAt)}` : "Sem atualização"}
            </span>
            <button
              type="button"
              onClick={() => setAutoRefresh((current) => !current)}
              className="inline-flex items-center gap-1.5 rounded-full border border-(--tc-border,#d7deea) px-2.5 py-1 font-semibold"
            >
              {autoRefresh ? <FiCheckCircle className="h-3.5 w-3.5 text-emerald-600" /> : <FiXCircle className="h-3.5 w-3.5 text-rose-600" />}
              Atualização automática {autoRefresh ? "ativada" : "desativada"}
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <FiFilter className="h-4 w-4" />
            Filtros principais
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-12">
            <div className="md:col-span-2 lg:col-span-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-(--tc-text-muted,#6b7280)">Empresa</label>
              <div className="space-y-2 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-2.5">
                <div className="relative">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--tc-text-muted,#6b7280)" />
                  <input
                    type="search"
                    value={companyFilterQuery}
                    onChange={(event) => setCompanyFilterQuery(event.target.value)}
                    placeholder="Buscar empresa"
                    className="min-h-10 w-full rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) pl-9 pr-3 text-sm"
                  />
                </div>
                <div className="max-h-32 space-y-1 overflow-auto rounded-xl bg-(--tc-surface,#fff) p-1.5">
                {filteredVisibleCompanies.map((company) => (
                  <label key={company.slug} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={draftCompanySlugs.includes(company.slug)}
                      onChange={() => toggleDraftCompany(company.slug)}
                    />
                    <span className="truncate">{company.name}</span>
                  </label>
                ))}
                {filteredVisibleCompanies.length === 0 ? (
                  <p className="px-1.5 py-1 text-xs text-(--tc-text-muted,#6b7280)">
                    {visibleCompanies.length === 0
                      ? "Sem empresas disponíveis para o seu acesso."
                      : hasCompanySearchQuery
                        ? "Nenhuma empresa encontrada para a busca."
                        : "Selecione uma empresa para continuar."}
                  </p>
                ) : null}
                </div>
              </div>
            </div>

            <label className="grid gap-1 text-sm lg:col-span-3">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-(--tc-text-muted,#6b7280)">Aplicação</span>
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--tc-text-muted,#6b7280)" />
                <input
                  type="search"
                  value={applicationFilterQuery}
                  onChange={(event) => setApplicationFilterQuery(event.target.value)}
                  disabled={!canSelectApplication || loadingApplications}
                  placeholder="Buscar aplicação"
                  className="min-h-10 w-full rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) pl-9 pr-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <select
                value={draftApplication}
                onChange={(event) => setDraftApplication(event.target.value)}
                disabled={!canSelectApplication || loadingApplications}
                className="min-h-11 w-full rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) px-3 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {draftCompanySlugs.length === 0 ? (
                  <option value="all">Selecione uma empresa primeiro</option>
                ) : draftCompanySlugs.length > 1 ? (
                  <option value="all">Selecione apenas uma empresa para filtrar aplicação específica</option>
                ) : loadingApplications ? (
                  <option value="all">Carregando aplicações...</option>
                ) : (
                  <>
                    <option value="all">Todas as aplicações da empresa selecionada</option>
                    {filteredApplicationsForSelection.map((application) => (
                      <option key={application} value={application}>{application}</option>
                    ))}
                    {filteredApplicationsForSelection.length === 0 ? (
                      <option value="all">Nenhuma aplicação encontrada na busca</option>
                    ) : null}
                  </>
                )}
              </select>
            </label>

            <label className="grid gap-1 text-sm lg:col-span-3">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-(--tc-text-muted,#6b7280)">Módulo</span>
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--tc-text-muted,#6b7280)" />
                <input
                  type="search"
                  value={moduleFilterQuery}
                  onChange={(event) => setModuleFilterQuery(event.target.value)}
                  disabled={draftApplication === "all" || !canSelectApplication}
                  placeholder="Buscar módulo"
                  className="min-h-10 w-full rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) pl-9 pr-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <select
                value={draftModule}
                onChange={(event) => setDraftModule(event.target.value as ModuleView)}
                disabled={draftApplication === "all" || !canSelectApplication}
                className="min-h-11 w-full rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) px-3 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {draftApplication === "all" ? (
                  <option value="none">Selecione uma aplicação primeiro</option>
                ) : (
                  <>
                    <option value="none">Selecione o módulo</option>
                    {filteredModulesForSelection.map((module) => (
                        <option key={module} value={module}>{module}</option>
                      ))}
                    {filteredModulesForSelection.length === 0 ? (
                      <option value="none">Nenhum módulo encontrado na busca</option>
                    ) : null}
                  </>
                )}
              </select>
            </label>

            <label className="grid gap-1 text-sm lg:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-(--tc-text-muted,#6b7280)">Período</span>
              <select
                value={draftPeriodPreset}
                onChange={(event) => setDraftPeriodPreset(event.target.value as PeriodPreset)}
                className="min-h-11 w-full rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) px-3"
              >
                <option value="24h">Últimas 24h</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="month">Este mês</option>
                <option value="custom">Personalizado</option>
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-4">
            {statusOptions.length > 0 ? (
              <label className="grid gap-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-(--tc-text-muted,#6b7280)">{statusFieldLabel(draftModule)}</span>
                <select
                  value={draftStatus}
                  onChange={(event) => setDraftStatus(event.target.value)}
                  className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) px-3"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {draftPeriodPreset === "custom" ? (
              <>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-(--tc-text-muted,#6b7280)">Data inicial</span>
                  <input
                    type="date"
                    value={draftDateFrom}
                    onChange={(event) => setDraftDateFrom(event.target.value)}
                    className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) px-3"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-(--tc-text-muted,#6b7280)">Data final</span>
                  <input
                    type="date"
                    value={draftDateTo}
                    onChange={(event) => setDraftDateTo(event.target.value)}
                    className="min-h-11 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) px-3"
                  />
                </label>
              </>
            ) : null}

            {draftModule !== "none" && draftModule !== "Automacoes" && draftModule !== "Integracoes" ? (
              <label className="grid gap-1 text-sm lg:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-(--tc-text-muted,#6b7280)">
                  {draftModule === "Runs"
                    ? "Buscar run por ID ou nome"
                    : draftModule === "Defeitos"
                      ? "Buscar defeito por título ou ID"
                      : "Buscar aplicação"}
                </span>
                <div className="relative">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--tc-text-muted,#6b7280)" />
                  <input
                    value={draftSearch}
                    onChange={(event) => setDraftSearch(event.target.value)}
                    placeholder={draftModule === "Runs" ? "Ex.: RUN-123" : draftModule === "Defeitos" ? "Ex.: DEF-10" : "Ex.: Quality Control"}
                    className="min-h-11 w-full rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) pl-9 pr-3"
                  />
                </div>
              </label>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyFilters}
              className="rounded-xl bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white"
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) px-4 py-2 text-sm font-semibold"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => setRefreshNonce((current) => current + 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) px-4 py-2 text-sm font-semibold"
            >
              <FiRefreshCw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 sm:p-6">
          {applied.companySlugs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-6 text-sm text-(--tc-text-muted,#6b7280)">
              <p className="font-semibold text-(--page-text,#0b1a3c)">Selecione uma empresa para começar.</p>
              <p className="mt-1">Depois escolha a aplicação e o módulo que deseja monitorar.</p>
            </div>
          ) : loading ? (
            <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando dados operacionais...</p>
          ) : error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</p>
          ) : applied.application === "all" ? (
            <div>
              <h2 className="text-lg font-bold">Aplicações da empresa {selectedCompanies[0]?.name ?? "selecionada"}</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {applicationsSummary.map((app) => (
                  <button
                    key={app.name}
                    type="button"
                    onClick={() => {
                      setDraftApplication(app.name);
                      setApplied((current) => ({ ...current, application: app.name, module: "none", status: "all", search: "" }));
                    }}
                    className="rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-4 text-left"
                  >
                    <p className="font-semibold text-(--page-text,#0b1a3c)">{app.name}</p>
                    <p className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">Status geral: {app.total > 0 ? "Com eventos" : "Sem eventos"}</p>
                    <p className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">Última atividade: {new Date(app.lastIso).toLocaleString("pt-BR")}</p>
                    <p className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">Módulos disponíveis: {app.modules.size}</p>
                    <p className="mt-1 text-xs font-semibold text-(--tc-accent,#ef0001)">Abrir</p>
                  </button>
                ))}
                {applicationsSummary.length === 0 ? (
                  <p className="text-sm text-(--tc-text-muted,#6b7280)">Sem aplicações encontradas para o recorte.</p>
                ) : null}
              </div>
            </div>
          ) : applied.module === "none" ? (
            <div>
              <h2 className="text-lg font-bold">Módulos de {applied.application}</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  modulesForSelection.length > 0
                    ? modulesForSelection
                    : (["Aplicacoes", "Runs", "Defeitos", "Automacoes", "Integracoes"] as ModuleView[])
                ).map((module) => (
                  <button
                    key={module}
                    type="button"
                    onClick={() => {
                      setDraftModule(module);
                      setApplied((current) => ({ ...current, module, status: "all", search: "" }));
                    }}
                    className="rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) px-3 py-2 text-left text-sm font-semibold"
                  >
                    {module}
                  </button>
                ))}
              </div>
            </div>
          ) : applied.module === "Runs" ? (
            <div className="overflow-auto">
              <h2 className="mb-3 text-lg font-bold">Runs em tempo real</h2>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-(--tc-border,#d7deea) text-left text-xs uppercase tracking-widest text-(--tc-text-muted,#6b7280)">
                    <th className="px-2 py-2">Run</th>
                    <th className="px-2 py-2">Status da run</th>
                    <th className="px-2 py-2">Aplicação</th>
                    <th className="px-2 py-2">Módulo</th>
                    <th className="px-2 py-2">Responsável</th>
                    <th className="px-2 py-2">Início</th>
                    <th className="px-2 py-2">Fim ou duração</th>
                    <th className="px-2 py-2">Resultado</th>
                    <th className="px-2 py-2">Última atualização</th>
                    <th className="px-2 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSignals.map((item) => (
                    <tr key={item.id} className="border-b border-(--tc-border,#eef2f7)">
                      <td className="px-2 py-2 font-semibold">{item.runCode || item.title}</td>
                      <td className="px-2 py-2">{item.status}</td>
                      <td className="px-2 py-2">{item.application}</td>
                      <td className="px-2 py-2">{item.module}</td>
                      <td className="px-2 py-2">{item.owner}</td>
                      <td className="px-2 py-2">{new Date(item.updatedAtIso).toLocaleString("pt-BR")}</td>
                      <td className="px-2 py-2">{item.durationMin != null ? `${item.durationMin} min` : "-"}</td>
                      <td className="px-2 py-2">{item.passRate != null ? `${item.passRate}%` : "-"}</td>
                      <td className="px-2 py-2">{formatAgo(item.updatedAtIso)}</td>
                      <td className="px-2 py-2">
                        {singleCompanySlug ? (
                          <Link href={buildCompanyPathForAccess(singleCompanySlug, "runs", companyRouteInput)} className="text-(--tc-accent,#ef0001)">
                            Abrir
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSignals.length === 0 ? <p className="mt-3 text-sm text-(--tc-text-muted,#6b7280)">Nenhuma run encontrada para o recorte.</p> : null}
            </div>
          ) : applied.module === "Defeitos" ? (
            <div className="overflow-auto">
              <h2 className="mb-3 text-lg font-bold">Defeitos em tempo real</h2>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-(--tc-border,#d7deea) text-left text-xs uppercase tracking-widest text-(--tc-text-muted,#6b7280)">
                    <th className="px-2 py-2">Defeito</th>
                    <th className="px-2 py-2">Título</th>
                    <th className="px-2 py-2">Severidade</th>
                    <th className="px-2 py-2">Prioridade</th>
                    <th className="px-2 py-2">Status do defeito</th>
                    <th className="px-2 py-2">Responsável</th>
                    <th className="px-2 py-2">Criado em</th>
                    <th className="px-2 py-2">Atualizado em</th>
                    <th className="px-2 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSignals.map((item) => (
                    <tr key={item.id} className="border-b border-(--tc-border,#eef2f7)">
                      <td className="px-2 py-2 font-semibold">{item.defectCode || item.id}</td>
                      <td className="px-2 py-2">{item.title}</td>
                      <td className="px-2 py-2">{item.severity}</td>
                      <td className="px-2 py-2">{item.priority}</td>
                      <td className="px-2 py-2">{item.status}</td>
                      <td className="px-2 py-2">{item.owner}</td>
                      <td className="px-2 py-2">{new Date(item.updatedAtIso).toLocaleString("pt-BR")}</td>
                      <td className="px-2 py-2">{formatAgo(item.updatedAtIso)}</td>
                      <td className="px-2 py-2">
                        {singleCompanySlug ? (
                          <Link href={buildCompanyPathForAccess(singleCompanySlug, "defeitos", companyRouteInput)} className="text-(--tc-accent,#ef0001)">
                            Abrir
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSignals.length === 0 ? <p className="mt-3 text-sm text-(--tc-text-muted,#6b7280)">Nenhum defeito encontrado para o recorte.</p> : null}
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-bold">{applied.module}</h2>
              <div className="mt-3 space-y-2">
                {filteredSignals.map((item) => (
                  <div key={item.id} className="rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-2">
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-xs text-(--tc-text-muted,#6b7280)">
                      {item.companyName} · {item.application} · {item.status} · {new Date(item.updatedAtIso).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ))}
                {filteredSignals.length === 0 ? <p className="text-sm text-(--tc-text-muted,#6b7280)">Sem resultados para o módulo no recorte aplicado.</p> : null}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

