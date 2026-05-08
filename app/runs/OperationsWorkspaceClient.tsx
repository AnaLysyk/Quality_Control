"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowRight,
  FiBarChart2,
  FiBook,
  FiBriefcase,
  FiCheckCircle,
  FiClipboard,
  FiColumns,
  FiDownload,
  FiFilter,
  FiLayers,
  FiList,
  FiRefreshCw,
  FiShield,
  FiUser,
  FiZap,
} from "react-icons/fi";

import { useClientContext } from "@/context/ClientContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useI18n } from "@/hooks/useI18n";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";

type OperationContextItem = {
  key: string;
  route: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

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

export function OperationsWorkspaceClient() {
  const { t } = useI18n();
  const { user, normalizedUser } = useAuthUser();
  const { clients, activeClientSlug } = useClientContext();

  const tx = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const normalizedRole = String(user?.role ?? "").toLowerCase();
  const normalizedPermissionRole = String(user?.permissionRole ?? "").toLowerCase();
  const canAccessOperationsWorkspace =
    user?.isGlobalAdmin === true ||
    normalizedRole === "leader_tc" ||
    normalizedRole === "technical_support" ||
    normalizedPermissionRole === "leader_tc" ||
    normalizedPermissionRole === "technical_support";

  const isCompanyScopedUser =
    normalizedRole === "empresa" ||
    normalizedRole === "company_user" ||
    normalizedPermissionRole === "empresa" ||
    normalizedPermissionRole === "company_user";

  const visibleCompanies = useMemo(() => {
    const nonSeed = clients.filter((company) => {
      const haystack = `${company.name} ${company.slug}`.toLowerCase();
      return !(haystack.includes("persist") || haystack.includes("seed") || haystack.includes("fake"));
    });
    return nonSeed.length > 0 ? nonSeed : clients;
  }, [clients]);

  const hiddenSeedCompanies = Math.max(0, clients.length - visibleCompanies.length);

  const allowedCompanies = useMemo(() => {
    if (!isCompanyScopedUser) return visibleCompanies;

    const preferredSlug =
      activeClientSlug ?? normalizedUser.primaryCompanySlug ?? normalizedUser.defaultCompanySlug ?? null;

    const scoped = preferredSlug
      ? visibleCompanies.find((company) => company.slug === preferredSlug)
      : null;

    if (scoped) return [scoped];
    return visibleCompanies.length > 0 ? [visibleCompanies[0]] : [];
  }, [
    activeClientSlug,
    isCompanyScopedUser,
    normalizedUser.defaultCompanySlug,
    normalizedUser.primaryCompanySlug,
    visibleCompanies,
  ]);

  const [selectedCompanySlugs, setSelectedCompanySlugs] = useState<string[]>([]);
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("critical_blocked");
  const [runFilter, setRunFilter] = useState("");
  const [defectFilter, setDefectFilter] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("24h");
  const [assistantPrompt, setAssistantPrompt] = useState("");

  const selectedCompanies = useMemo(() => {
    if (allowedCompanies.length === 0) return [];

    const safeSelected = selectedCompanySlugs.filter((slug) =>
      allowedCompanies.some((company) => company.slug === slug),
    );

    if (isCompanyScopedUser) return allowedCompanies;
    if (safeSelected.length === 0) return allowedCompanies;

    return allowedCompanies.filter((company) => safeSelected.includes(company.slug));
  }, [allowedCompanies, isCompanyScopedUser, selectedCompanySlugs]);

  const companyScopeLabel = useMemo(() => {
    if (selectedCompanies.length === 0) {
      return "Nenhuma empresa permitida";
    }
    if (selectedCompanies.length === 1) {
      return selectedCompanies[0].name;
    }
    return `${selectedCompanies.length} empresas selecionadas`;
  }, [selectedCompanies]);

  const operationContexts: OperationContextItem[] = [
    {
      key: "applications",
      route: "aplicacoes",
      label: "Aplicacoes",
      description: "Visao de aplicacoes por empresa",
      icon: FiBriefcase,
    },
    {
      key: "runs",
      route: "runs",
      label: "Runs",
      description: "Execucoes de teste em andamento",
      icon: FiList,
    },
    {
      key: "test-plans",
      route: "planos-de-teste",
      label: "Planos de teste",
      description: "Planejamento e cobertura",
      icon: FiClipboard,
    },
    {
      key: "defects",
      route: "defeitos",
      label: "Defeitos",
      description: "Bugs ativos por severidade",
      icon: FiAlertTriangle,
    },
    {
      key: "support",
      route: "chamados",
      label: "Chamados",
      description: "Fila de suporte tecnico",
      icon: FiColumns,
    },
    {
      key: "metrics",
      route: "metrics",
      label: "Metricas",
      description: "Indicadores de qualidade",
      icon: FiBarChart2,
    },
    {
      key: "documents",
      route: "documentos",
      label: "Documentos",
      description: "Documentos e evidencias",
      icon: FiBook,
    },
  ];

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

  const operationsSignals = useMemo<OperationSignal[]>(() => {
    const companiesSeed = selectedCompanies.length > 0 ? selectedCompanies : allowedCompanies;
    const applications = ["Portal", "Backoffice", "API", "Mobile"];
    const modules = ["Runs", "Defeitos", "Integracoes", "Automacoes", "Documentos"];
    const owners = ["Aline", "Bruno", "Camila", "Diego", "Sem responsavel"];

    if (companiesSeed.length === 0) return [];

    const signals: OperationSignal[] = [];

    companiesSeed.forEach((company, companyIndex) => {
      for (let i = 0; i < 6; i += 1) {
        const idx = companyIndex * 6 + i;
        const statusCycle: OperationSignal["status"][] = [
          "new",
          "analyzing",
          "in_progress",
          "blocked",
          "failed",
          "alert",
          "resolved",
        ];
        const severityCycle: OperationSignal["severity"][] = ["critical", "high", "medium", "low"];
        const priorityCycle: OperationSignal["priority"][] = ["P0", "P1", "P2", "P3"];
        const typeCycle: OperationSignal["type"][] = ["run", "defect", "automation", "integration", "run", "defect"];

        const status = statusCycle[idx % statusCycle.length];
        const severity = severityCycle[idx % severityCycle.length];
        const priority = priorityCycle[idx % priorityCycle.length];
        const type = typeCycle[idx % typeCycle.length];
        const owner = owners[idx % owners.length];
        const module = modules[idx % modules.length];
        const application = applications[idx % applications.length];

        signals.push({
          id: `${company.slug}-${idx}`,
          type,
          title: `${module} ${idx + 100}`,
          companySlug: company.slug,
          companyName: company.name,
          application,
          module,
          status,
          owner,
          severity,
          priority,
          runCode: `RUN-${companyIndex + 1}${idx + 100}`,
          defectCode: `DEF-${companyIndex + 1}${idx + 100}`,
          updatedAtIso: new Date(Date.now() - idx * 36 * 60 * 1000).toISOString(),
          passRate: Math.max(42, 96 - (idx % 9) * 5),
          failCount: idx % 6,
          durationMin: 8 + (idx % 11) * 3,
        });
      }
    });

    return signals;
  }, [allowedCompanies, selectedCompanies]);

  const filteredSignals = useMemo(() => {
    return operationsSignals.filter((signal) => {
      if (selectedCompanies.length > 0 && !selectedCompanies.some((company) => company.slug === signal.companySlug)) {
        return false;
      }
      if (applicationFilter !== "all" && signal.application !== applicationFilter) return false;
      if (moduleFilter !== "all" && signal.module !== moduleFilter) return false;
      if (responsibleFilter !== "all" && signal.owner !== responsibleFilter) return false;
      if (priorityFilter !== "all" && signal.priority !== priorityFilter) return false;
      if (severityFilter !== "all" && signal.severity !== severityFilter) return false;

      if (statusFilter === "critical_blocked") {
        if (!(signal.status === "blocked" || signal.severity === "critical" || signal.status === "failed")) {
          return false;
        }
      } else if (statusFilter === "active") {
        if (!(signal.status === "new" || signal.status === "analyzing" || signal.status === "in_progress")) {
          return false;
        }
      } else if (statusFilter !== "all" && signal.status !== statusFilter) {
        return false;
      }

      if (runFilter.trim() && !signal.runCode.toLowerCase().includes(runFilter.trim().toLowerCase())) return false;
      if (defectFilter.trim() && !signal.defectCode.toLowerCase().includes(defectFilter.trim().toLowerCase())) return false;

      const cutoffByPeriod: Record<string, number> = {
        "24h": 24,
        "7d": 24 * 7,
        "30d": 24 * 30,
      };
      const maxHours = cutoffByPeriod[periodFilter] ?? 24;
      const ageHours = (Date.now() - new Date(signal.updatedAtIso).getTime()) / (1000 * 60 * 60);
      if (ageHours > maxHours) return false;

      return true;
    });
  }, [
    applicationFilter,
    defectFilter,
    moduleFilter,
    operationsSignals,
    periodFilter,
    priorityFilter,
    responsibleFilter,
    runFilter,
    selectedCompanies,
    severityFilter,
    statusFilter,
  ]);

  const operationalCards = useMemo(() => {
    const runs = filteredSignals.filter((item) => item.type === "run");
    const defects = filteredSignals.filter((item) => item.type === "defect");
    const automations = filteredSignals.filter((item) => item.type === "automation");
    const integrations = filteredSignals.filter((item) => item.type === "integration");

    const blockedCount = filteredSignals.filter((item) => item.status === "blocked").length;
    const failedCount = filteredSignals.filter((item) => item.status === "failed").length;
    const criticalCount = filteredSignals.filter((item) => item.severity === "critical").length;
    const unresolved = filteredSignals.filter((item) => item.status !== "resolved").length;
    const healthScore = Math.max(0, 100 - blockedCount * 6 - failedCount * 7 - criticalCount * 4 - Math.floor(unresolved / 2));

    return [
      { label: "Saude operacional", value: `${healthScore}%`, accent: "text-emerald-700" },
      { label: "Runs em andamento", value: String(runs.filter((item) => item.status === "in_progress").length), accent: "text-sky-700" },
      { label: "Runs com falha", value: String(runs.filter((item) => item.status === "failed").length), accent: "text-rose-700" },
      { label: "Runs bloqueadas", value: String(runs.filter((item) => item.status === "blocked").length), accent: "text-amber-700" },
      { label: "Defeitos abertos", value: String(defects.filter((item) => item.status !== "resolved").length), accent: "text-orange-700" },
      { label: "Defeitos criticos", value: String(defects.filter((item) => item.severity === "critical").length), accent: "text-red-700" },
      { label: "Automacoes com erro", value: String(automations.filter((item) => item.status === "failed" || item.status === "alert").length), accent: "text-fuchsia-700" },
      { label: "Integracoes com alerta", value: String(integrations.filter((item) => item.status === "alert" || item.status === "failed").length), accent: "text-violet-700" },
      { label: "Itens sem responsavel", value: String(filteredSignals.filter((item) => item.owner === "Sem responsavel").length), accent: "text-slate-700" },
    ];
  }, [filteredSignals]);

  const riskAlerts = useMemo(() => {
    const alerts: string[] = [];
    const failedRuns = filteredSignals.filter((item) => item.type === "run" && item.status === "failed").length;
    const blockedRuns = filteredSignals.filter((item) => item.type === "run" && item.status === "blocked").length;
    const criticalWithoutOwner = filteredSignals.filter(
      (item) => item.severity === "critical" && item.owner === "Sem responsavel",
    ).length;
    const integrationAlerts = filteredSignals.filter(
      (item) => item.type === "integration" && (item.status === "alert" || item.status === "failed"),
    ).length;

    if (failedRuns >= 3) alerts.push("Risco alto: modulo Runs concentra falhas recentes.");
    if (integrationAlerts >= 2) alerts.push("Risco medio: integracoes sem sincronizacao recente.");
    if (criticalWithoutOwner >= 1) alerts.push("Risco alto: defeitos criticos sem responsavel.");
    if (blockedRuns >= 2) alerts.push("Risco medio: existe acumulado de runs bloqueadas.");

    if (alerts.length === 0) {
      alerts.push("Sem alertas criticos no periodo atual. Monitoramento continua ativo.");
    }

    return alerts;
  }, [filteredSignals]);

  const statusToKanbanColumn = (status: OperationSignal["status"]) => {
    if (status === "new") return "Novo";
    if (status === "analyzing") return "Em analise";
    if (status === "in_progress") return "Em andamento";
    if (status === "blocked" || status === "alert" || status === "failed") return "Bloqueado";
    return "Resolvido";
  };

  const kanbanColumns = useMemo(() => {
    const base: Record<string, OperationSignal[]> = {
      Novo: [],
      "Em analise": [],
      "Em andamento": [],
      Bloqueado: [],
      Resolvido: [],
    };

    filteredSignals.forEach((signal) => {
      const column = statusToKanbanColumn(signal.status);
      base[column].push(signal);
    });

    return base;
  }, [filteredSignals]);

  const recentHistory = useMemo(() => {
    return [...filteredSignals]
      .sort((a, b) => new Date(b.updatedAtIso).getTime() - new Date(a.updatedAtIso).getTime())
      .slice(0, 10);
  }, [filteredSignals]);

  const runMetrics = useMemo(() => {
    return filteredSignals
      .filter((signal) => signal.type === "run")
      .slice(0, 8);
  }, [filteredSignals]);

  const applicationOptions = useMemo(() => {
    const values = Array.from(new Set(operationsSignals.map((signal) => signal.application)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [operationsSignals]);

  const moduleOptions = useMemo(() => {
    const values = Array.from(new Set(operationsSignals.map((signal) => signal.module)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [operationsSignals]);

  const ownerOptions = useMemo(() => {
    const values = Array.from(new Set(operationsSignals.map((signal) => signal.owner)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [operationsSignals]);

  const activeCompanyForLinks = selectedCompanies.length === 1 ? selectedCompanies[0].slug : null;

  const toggleCompanySlug = (slug: string) => {
    if (isCompanyScopedUser) return;
    setSelectedCompanySlugs((current) => {
      if (current.includes(slug)) {
        const next = current.filter((item) => item !== slug);
        return next.length === 0 ? current : next;
      }
      return [...current, slug];
    });
  };

  const selectAllCompanies = () => {
    if (isCompanyScopedUser) return;
    setSelectedCompanySlugs(allowedCompanies.map((company) => company.slug));
  };

  const clearFilters = () => {
    setApplicationFilter("all");
    setModuleFilter("all");
    setStatusFilter("critical_blocked");
    setRunFilter("");
    setDefectFilter("");
    setResponsibleFilter("all");
    setPriorityFilter("all");
    setSeverityFilter("all");
    setPeriodFilter("24h");
    setSelectedCompanySlugs(allowedCompanies.map((company) => company.slug));
  };

  useEffect(() => {
    if (allowedCompanies.length === 0) {
      if (selectedCompanySlugs.length > 0) setSelectedCompanySlugs([]);
      return;
    }

    if (isCompanyScopedUser) {
      const scopedSlugs = allowedCompanies.map((company) => company.slug);
      const current = selectedCompanySlugs.join("|");
      const next = scopedSlugs.join("|");
      if (current !== next) setSelectedCompanySlugs(scopedSlugs);
      return;
    }

    const valid = selectedCompanySlugs.filter((slug) =>
      allowedCompanies.some((company) => company.slug === slug),
    );

    if (valid.length === 0) {
      setSelectedCompanySlugs(allowedCompanies.map((company) => company.slug));
      return;
    }

    if (valid.length !== selectedCompanySlugs.length) {
      setSelectedCompanySlugs(valid);
    }
  }, [allowedCompanies, isCompanyScopedUser, selectedCompanySlugs]);

  if (!canAccessOperationsWorkspace) {
    return (
      <div className="min-h-screen bg-(--page-bg,#ffffff) px-4 py-8 text-(--page-text,#0b1a3c) sm:px-6 md:px-10 md:py-10">
        <div className="mx-auto max-w-4xl rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-accent,#ef0001)">Operação</p>
          <h1 className="mt-2 text-2xl font-bold">Acesso restrito</h1>
          <p className="mt-3 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
            Este workspace de operação com seleção de empresa e contexto está disponível apenas para líder TC e suporte técnico.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) px-4 py-8 text-(--page-text,#0b1a3c) sm:px-6 md:px-10 md:py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="space-y-3">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-accent,#ef0001)">
                <FiActivity className="h-4 w-4" />
                {tx("operationsPage.kicker", "Operacoes")}
              </p>
              <h1 className="text-3xl font-black tracking-tight text-(--tc-text,#0b1a3c) md:text-4xl">
                {tx("operationsPage.title", "Central de Operacoes")}
              </h1>
              <p className="max-w-4xl text-sm leading-7 text-(--tc-text-secondary,#4b5563) md:text-base">
                {tx(
                  "operationsPage.subtitle",
                  "Acompanhe a saude operacional das empresas, runs, defeitos, automacoes e integracoes.",
                )}
              </p>
              <p className="text-sm font-medium text-(--tc-text-secondary,#4b5563)">
                Contexto atual: {companyScopeLabel} · Ultimas {periodFilter === "24h" ? "24h" : periodFilter === "7d" ? "7 dias" : "30 dias"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="rounded-xl border border-(--tc-border,#d7deea) px-3 py-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-2"><FiRefreshCw className="h-4 w-4" />Atualizar</span>
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border border-(--tc-border,#d7deea) px-3 py-2 text-xs font-semibold"
              >
                <span className="inline-flex items-center gap-2"><FiFilter className="h-4 w-4" />Limpar filtros</span>
              </button>
              <button type="button" className="rounded-xl border border-(--tc-border,#d7deea) px-3 py-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-2"><FiDownload className="h-4 w-4" />Exportar</span>
              </button>
              <button type="button" className="rounded-xl bg-(--tc-accent,#ef0001) px-3 py-2 text-xs font-semibold text-white">
                <span className="inline-flex items-center gap-2"><FiZap className="h-4 w-4" />Perguntar ao assistente</span>
              </button>
            </div>
          </div>

          {hiddenSeedCompanies > 0 ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {hiddenSeedCompanies} empresa(s) de seed/teste foram ocultadas automaticamente nesta visao operacional.
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Empresa</p>
              <div className="rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium">{isCompanyScopedUser ? "Empresa vinculada" : "Multiselecao"}</span>
                  {!isCompanyScopedUser ? (
                    <button type="button" onClick={selectAllCompanies} className="text-xs font-semibold text-(--tc-accent,#ef0001)">
                      Selecionar todas
                    </button>
                  ) : null}
                </div>
                <div className="max-h-32 space-y-1 overflow-auto pr-1">
                  {allowedCompanies.map((company) => (
                    <label key={company.slug} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedCompanies.some((selected) => selected.slug === company.slug)}
                        onChange={() => toggleCompanySlug(company.slug)}
                        disabled={isCompanyScopedUser}
                      />
                      <span>{company.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <label className="grid gap-1 text-sm font-medium">
              Aplicacao
              <select value={applicationFilter} onChange={(event) => setApplicationFilter(event.target.value)} className="min-h-10 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3">
                <option value="all">Todas</option>
                {applicationOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Modulo
              <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} className="min-h-10 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3">
                <option value="all">Todos</option>
                {moduleOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-10 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3">
                <option value="critical_blocked">Criticos + Bloqueados</option>
                <option value="active">Ativos</option>
                <option value="all">Todos</option>
                <option value="blocked">Bloqueado</option>
                <option value="failed">Falha</option>
                <option value="alert">Alerta</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Responsavel
              <select value={responsibleFilter} onChange={(event) => setResponsibleFilter(event.target.value)} className="min-h-10 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3">
                <option value="all">Todos</option>
                {ownerOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Periodo
              <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)} className="min-h-10 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3">
                <option value="24h">Ultimas 24h</option>
                <option value="7d">Ultimos 7 dias</option>
                <option value="30d">Ultimos 30 dias</option>
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-5">
            <label className="grid gap-1 text-sm font-medium">
              Run
              <input value={runFilter} onChange={(event) => setRunFilter(event.target.value)} placeholder="RUN-" className="min-h-10 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Defeito
              <input value={defectFilter} onChange={(event) => setDefectFilter(event.target.value)} placeholder="DEF-" className="min-h-10 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Prioridade
              <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="min-h-10 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3">
                <option value="all">Todas</option>
                <option value="P0">P0</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Severidade
              <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="min-h-10 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3">
                <option value="all">Todas</option>
                <option value="critical">Critica</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baixa</option>
              </select>
            </label>
            <div className="grid gap-1 text-sm font-medium">
              Modulos da empresa
              {activeCompanyForLinks ? (
                <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-2 py-1">
                  {operationContexts.slice(0, 4).map((context) => {
                    const href = buildCompanyPathForAccess(activeCompanyForLinks, context.route, companyRouteInput);
                    return (
                      <Link key={context.key} href={href} className="inline-flex items-center gap-1 rounded-lg border border-(--tc-border,#d7deea) px-2 py-1 text-xs font-semibold">
                        <context.icon className="h-3.5 w-3.5" />
                        {context.label}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-10 items-center rounded-xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 text-xs text-(--tc-text-muted,#6b7280)">
                  Selecione uma unica empresa para abrir modulo direto.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {operationalCards.map((card) => (
            <article key={card.label} className="rounded-2xl border border-(--tc-border,#d7deea) bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">{card.label}</p>
              <p className={`mt-3 text-3xl font-black ${card.accent}`}>{card.value}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_1.3fr]">
          <article className="rounded-3xl border border-(--tc-border,#d7deea) bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Alertas e riscos</h2>
            <div className="mt-3 space-y-2">
              {riskAlerts.map((alert) => (
                <p key={alert} className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                  {alert}
                </p>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-(--tc-border,#d7deea) bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Operacao em andamento</h2>
            <div className="mt-3 space-y-2">
              {filteredSignals.filter((item) => item.status !== "resolved").slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <span className="text-xs font-semibold uppercase text-(--tc-accent,#ef0001)">{item.status.replace("_", " ")}</span>
                  </div>
                  <p className="mt-1 text-xs text-(--tc-text-secondary,#4b5563)">
                    {item.companyName} · {item.application} · {item.module} · {item.owner}
                  </p>
                </div>
              ))}
              {filteredSignals.length === 0 ? (
                <p className="text-sm text-(--tc-text-secondary,#4b5563)">Sem itens no recorte atual.</p>
              ) : null}
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <FiLayers className="h-5 w-5 text-(--tc-accent,#ef0001)" />
            <h2 className="text-lg font-bold">Kanban operacional</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-5">
            {Object.entries(kanbanColumns).map(([column, items]) => (
              <div key={column} className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                  {column} ({items.length})
                </p>
                <div className="mt-2 space-y-2">
                  {items.slice(0, 4).map((item) => (
                    <div key={item.id} className="rounded-lg border border-white bg-white px-2 py-1.5 text-xs">
                      <p className="font-semibold">{item.runCode}</p>
                      <p className="text-(--tc-text-secondary,#4b5563)">{item.companyName}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <article className="rounded-3xl border border-(--tc-border,#d7deea) bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Metricas por run</h2>
            <div className="mt-3 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.2em] text-(--tc-text-muted,#6b7280)">
                    <th className="px-2 py-2">Run</th>
                    <th className="px-2 py-2">Empresa</th>
                    <th className="px-2 py-2">Pass rate</th>
                    <th className="px-2 py-2">Falhas</th>
                    <th className="px-2 py-2">Duracao</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {runMetrics.map((run) => (
                    <tr key={run.id} className="border-t border-(--tc-border,#d7deea)">
                      <td className="px-2 py-2 font-semibold">{run.runCode}</td>
                      <td className="px-2 py-2">{run.companyName}</td>
                      <td className="px-2 py-2">{run.passRate ?? 0}%</td>
                      <td className="px-2 py-2">{run.failCount ?? 0}</td>
                      <td className="px-2 py-2">{run.durationMin ?? 0} min</td>
                      <td className="px-2 py-2">{run.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-3xl border border-(--tc-border,#d7deea) bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Historico recente</h2>
            <div className="mt-3 space-y-2">
              {recentHistory.map((item) => (
                <div key={item.id} className="rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-2">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-(--tc-text-secondary,#4b5563)">
                    {new Date(item.updatedAtIso).toLocaleString("pt-BR")} · {item.companyName} · {item.module}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-bold">Assistente operacional contextualizado</h2>
          <p className="mb-3 text-sm text-(--tc-text-secondary,#4b5563)">
            Pergunte sobre riscos, bloqueios, prioridades e proximas acoes no recorte atual.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={assistantPrompt}
              onChange={(event) => setAssistantPrompt(event.target.value)}
              placeholder="Ex.: Quais itens criticos estao sem responsavel nas ultimas 24h?"
              className="min-h-11 flex-1 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3"
            />
            <button type="button" className="min-h-11 rounded-xl bg-(--tc-accent,#ef0001) px-4 text-sm font-semibold text-white">
              <span className="inline-flex items-center gap-2"><FiArrowRight className="h-4 w-4" />Perguntar sobre esta operacao</span>
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-(--tc-border,#d7deea) px-2 py-1"><FiCheckCircle className="h-3.5 w-3.5" />Contexto aplicado</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-(--tc-border,#d7deea) px-2 py-1"><FiShield className="h-3.5 w-3.5" />Escopo de acesso respeitado</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-(--tc-border,#d7deea) px-2 py-1"><FiUser className="h-3.5 w-3.5" />Responsaveis mapeados</span>
          </div>
        </section>
      </div>
    </div>
  );
}
