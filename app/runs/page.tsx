"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowRight,
  FiBarChart2,
  FiBriefcase,
  FiClipboard,
  FiColumns,
  FiExternalLink,
  FiGrid,
  FiLayers,
  FiList,
  FiRefreshCw,
  FiTarget,
  FiTrendingUp,
} from "react-icons/fi";

import { useClientContext } from "@/context/ClientContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useI18n } from "@/hooks/useI18n";
import { fetchApi } from "@/lib/api";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";
import {
  buildApplicationMatchKeys,
  classifyRunStatus,
  computePassRate,
  computeRunStats,
  matchesApplicationKeys,
  normalizeOperationModuleKey,
  normalizeProjectCode,
  normalizeText,
  type ApplicationMatchKeys,
  type OperationModuleKey,
  type RunStatusKey,
  type RunStats,
  type RunStatsInput,
} from "./operationsWorkspace";

type OperationModule = {
  key: OperationModuleKey;
  label: string;
  description: string;
  route: string;
  icon: typeof FiGrid;
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

type LoadState<T> = {
  items: T[];
  loading: boolean;
  error: string | null;
  warning: string | null;
  updatedAt: number | null;
};

type OperationApplication = {
  id: string;
  name: string;
  slug: string;
  qaseProjectCode: string | null;
  source: string | null;
  active: boolean;
  unavailable: boolean;
  accessMessage: string | null;
};

type OperationRun = {
  id: string;
  slug: string;
  title: string;
  sourceLabel: string;
  createdAt: string | null;
  runId: number | null;
  projectCode: string | null;
  applicationLabel: string;
  statusLabel: string;
  statusKey: RunStatusKey;
  responsibleLabel: string | null;
  passRate: number | null;
  stats: RunStats;
  isLive: boolean;
};

type OperationPlan = {
  id: string;
  title: string;
  source: "manual" | "qase";
  casesCount: number;
  applicationId: string | null;
  applicationName: string | null;
  projectCode: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  automationCasesCount: number;
};

type OperationDefect = {
  id: string;
  slug: string;
  title: string;
  status: string;
  severity: string | null;
  projectCode: string | null;
  runName: string | null;
  openedAt: string | null;
  externalUrl: string | null;
};

type OperationTicket = {
  id: string;
  code: string | null;
  title: string;
  status: string;
  priority: string | null;
  assignedToName: string | null;
  createdByName: string | null;
  updatedAt: string | null;
};

function createLoadState<T>(items: T[] = []): LoadState<T> {
  return {
    items,
    loading: false,
    error: null,
    warning: null,
    updatedAt: null,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeNumericId(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolvePayloadMessage(payload: unknown, fallback: string) {
  const record = asRecord(payload);
  const nestedError = asRecord(record?.error);
  return (
    normalizeText(record?.message) ??
    normalizeText(nestedError?.message) ??
    normalizeText(record?.warning) ??
    fallback
  );
}

async function fetchJson(path: string, signal: AbortSignal) {
  const response = await fetchApi(path, { cache: "no-store", signal });
  const payload = (await response.json().catch(() => null)) as unknown;
  return { response, payload };
}

function extractRunsPayload(payload: unknown) {
  const record = asRecord(payload);
  if (Array.isArray(record?.data)) return record.data;
  const nestedData = asRecord(record?.data);
  if (Array.isArray(nestedData?.data)) return nestedData.data;
  return [];
}

function formatDateTime(value: string | null, locale: "pt-BR" | "en-US") {
  const time = value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(time)) return "Sem data";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function resolveRunStatusLabel(statusKey: RunStatusKey, t: (key: string) => string) {
  if (statusKey === "completed") return t("runsPage.statusCompleted");
  if (statusKey === "in_progress") return t("runsPage.statusInProgress");
  if (statusKey === "blocked") return t("runsPage.statusBlocked");
  if (statusKey === "at_risk") return t("runsPage.statusAtRisk");
  if (statusKey === "pending") return t("runsPage.statusPending");
  return t("runsPage.noStatus");
}

function normalizeRun(raw: unknown, t: (key: string) => string): OperationRun | null {
  const record = asRecord(raw);
  if (!record) return null;

  const slug = normalizeText(record.slug) ?? normalizeText(record.id);
  const title =
    normalizeText(record.title) ??
    normalizeText(record.name) ??
    (slug ? `Run ${slug}` : null);

  if (!slug || !title) return null;

  const statusSource =
    normalizeText(record.status_text) ??
    normalizeText(record.status) ??
    (typeof record.status === "number" ? String(record.status) : null);
  const statusKey = classifyRunStatus(statusSource);
  const stats = computeRunStats((record.metrics ?? record.stats ?? record) as RunStatsInput);
  const projectCode = normalizeProjectCode(record.qaseProject ?? record.project ?? record.app);
  const applicationLabel =
    normalizeText(record.app) ??
    normalizeText(record.project) ??
    normalizeText(record.qaseProject) ??
    projectCode ??
    "Sem aplicacao";

  return {
    id: slug,
    slug,
    title,
    sourceLabel: normalizeText(record.source) ?? "Qase",
    createdAt:
      normalizeText(record.createdAt) ??
      normalizeText(record.created_at) ??
      normalizeText(record.start_time),
    runId: normalizeNumericId(record.runId ?? record.run_id ?? record.id),
    projectCode,
    applicationLabel,
    statusLabel: resolveRunStatusLabel(statusKey, t),
    statusKey,
    responsibleLabel:
      normalizeText(record.responsibleLabel) ??
      normalizeText(record.responsibleName) ??
      normalizeText(record.createdByName) ??
      normalizeText(record.createdByEmail),
    passRate: computePassRate(stats),
    stats,
    isLive: statusKey === "in_progress",
  };
}

function normalizePlan(raw: unknown): OperationPlan | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = normalizeText(record.id);
  const title = normalizeText(record.title);
  if (!id || !title) return null;

  const source = normalizeText(record.source) === "qase" ? "qase" : "manual";

  return {
    id,
    title,
    source,
    casesCount: Math.max(0, Number(record.casesCount ?? 0)),
    applicationId: normalizeText(record.applicationId),
    applicationName: normalizeText(record.applicationName),
    projectCode: normalizeProjectCode(record.projectCode),
    createdAt: normalizeText(record.createdAt),
    updatedAt: normalizeText(record.updatedAt),
    automationCasesCount: Math.max(0, Number(record.automationCasesCount ?? 0)),
  };
}

function normalizeDefect(raw: unknown): OperationDefect | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = normalizeText(record.id) ?? normalizeText(record.slug);
  const title = normalizeText(record.title);
  if (!id || !title) return null;

  return {
    id,
    slug: normalizeText(record.slug) ?? id,
    title,
    status: normalizeText(record.status) ?? normalizeText(record.kanbanStatus) ?? "aberto",
    severity: normalizeText(record.severity),
    projectCode: normalizeProjectCode(record.projectCode ?? record.app),
    runName: normalizeText(record.runName),
    openedAt: normalizeText(record.openedAt),
    externalUrl: normalizeText(record.externalUrl),
  };
}

function normalizeTicket(raw: unknown): OperationTicket | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = normalizeText(record.id);
  const title = normalizeText(record.title);
  if (!id || !title) return null;

  return {
    id,
    code: normalizeText(record.code),
    title,
    status: normalizeText(record.status) ?? "open",
    priority: normalizeText(record.priority),
    assignedToName: normalizeText(record.assignedToName) ?? normalizeText(record.assignedToUserName),
    createdByName: normalizeText(record.createdByName),
    updatedAt: normalizeText(record.updatedAt) ?? normalizeText(record.createdAt),
  };
}

function statusToneClasses(statusKey: RunStatusKey) {
  if (statusKey === "completed") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (statusKey === "in_progress") return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  if (statusKey === "blocked") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (statusKey === "at_risk") return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  if (statusKey === "pending") return "border-white/15 bg-white/8 text-white/75";
  return "border-white/12 bg-white/6 text-white/72";
}

function defectToneClasses(status: string) {
  const normalized = status.trim().toLowerCase();
  if (["aprovado", "done", "closed", "resolvido"].includes(normalized)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  if (["em_andamento", "in_progress", "doing"].includes(normalized)) {
    return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  }
  if (["aberto", "open", "backlog"].includes(normalized)) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  return "border-rose-500/30 bg-rose-500/10 text-rose-200";
}

function ticketToneClasses(status: string) {
  const normalized = status.trim().toLowerCase();
  if (["done", "closed", "resolved"].includes(normalized)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  if (["in_progress", "doing", "review"].includes(normalized)) {
    return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  }
  if (["backlog", "open"].includes(normalized)) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  return "border-white/12 bg-white/6 text-white/72";
}

function priorityToneClasses(priority: string | null) {
  const normalized = (priority ?? "").trim().toLowerCase();
  if (normalized === "critical") return "text-rose-200";
  if (normalized === "high" || normalized === "alta") return "text-amber-200";
  if (normalized === "medium" || normalized === "media") return "text-sky-200";
  return "text-white/70";
}

function formatPercent(value: number | null) {
  return value == null ? "--" : `${value}%`;
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,25,46,0.94),rgba(9,18,33,0.92))] px-4 py-4 shadow-[0_18px_38px_rgba(1,12,28,0.22)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/46">{label}</p>
      <div className="mt-2 text-2xl font-black tracking-tight text-white">{value}</div>
      <p className="mt-1 text-sm text-white/58">{hint}</p>
    </div>
  );
}

function EmptyBlock({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[26px] border border-dashed border-white/12 bg-white/4 px-5 py-10 text-center">
      <div className="text-base font-semibold text-white/84">{title}</div>
      <p className="mt-2 text-sm leading-6 text-white/58">{description}</p>
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white/62">
      Carregando {label}...
    </div>
  );
}

function ModuleSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,20,38,0.94),rgba(8,15,28,0.94))] shadow-[0_24px_52px_rgba(1,12,28,0.24)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-white/56">{description}</p>
        </div>
        {action}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

export default function RunsIndexPage() {
  const { t, language } = useI18n();
  const locale = language === "en-US" ? "en-US" : "pt-BR";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const { user, normalizedUser } = useAuthUser();
  const { clients, activeClientSlug } = useClientContext();

  const [refreshTick, setRefreshTick] = useState(0);
  const [applicationsState, setApplicationsState] = useState<LoadState<OperationApplication>>(createLoadState());
  const [runsState, setRunsState] = useState<LoadState<OperationRun>>(createLoadState());
  const [plansState, setPlansState] = useState<LoadState<OperationPlan>>(createLoadState());
  const [defectsState, setDefectsState] = useState<LoadState<OperationDefect>>(createLoadState());
  const [ticketsState, setTicketsState] = useState<LoadState<OperationTicket>>(createLoadState());

  const modules = useMemo<OperationModule[]>(
    () => [
      {
        key: "dashboard",
        label: t("nav.dashboard"),
        description: "Resumo operacional da empresa e leitura rápida do que merece atenção agora.",
        route: "dashboard",
        icon: FiGrid,
      },
      {
        key: "runs",
        label: t("nav.operations"),
        description: "Runs em andamento, histórico recente e sinais de execução sem trocar de contexto.",
        route: "runs",
        icon: FiList,
      },
      {
        key: "applications",
        label: t("nav.apps"),
        description: "Aplicações disponíveis, projetos vinculados e bloqueios de integração.",
        route: "aplicacoes",
        icon: FiBriefcase,
      },
      {
        key: "test-plans",
        label: t("nav.testPlans"),
        description: "Planos manuais e integrados renderizados dentro da operação.",
        route: "planos-de-teste",
        icon: FiClipboard,
      },
      {
        key: "defects",
        label: t("nav.defects"),
        description: "Defeitos abertos e em andamento por empresa e aplicação.",
        route: "defeitos",
        icon: FiAlertTriangle,
      },
      {
        key: "support",
        label: t("nav.support"),
        description: "Chamados visíveis no seu escopo atual de suporte, sem sair da operação.",
        route: "chamados",
        icon: FiColumns,
      },
      {
        key: "metrics",
        label: t("nav.metrics"),
        description: "Leitura sintética de pass rate, risco, volume e cobertura da empresa filtrada.",
        route: "metrics",
        icon: FiBarChart2,
      },
    ],
    [t],
  );

  const queryParams = useMemo(() => new URLSearchParams(searchParamsString), [searchParamsString]);
  const requestedCompanySlug = normalizeText(queryParams.get("companySlug"))?.toLowerCase() ?? null;
  const fallbackCompanySlug =
    activeClientSlug ??
    normalizedUser.primaryCompanySlug ??
    normalizedUser.defaultCompanySlug ??
    clients[0]?.slug ??
    null;

  const selectedCompanySlug = useMemo(() => {
    if (requestedCompanySlug && clients.some((company) => company.slug === requestedCompanySlug)) {
      return requestedCompanySlug;
    }
    if (fallbackCompanySlug && clients.some((company) => company.slug === fallbackCompanySlug)) {
      return fallbackCompanySlug;
    }
    return clients[0]?.slug ?? null;
  }, [clients, fallbackCompanySlug, requestedCompanySlug]);

  const selectedModuleKey = normalizeOperationModuleKey(queryParams.get("module"));
  const selectedModule = modules.find((module) => module.key === selectedModuleKey) ?? modules[0];
  const selectedCompany = clients.find((company) => company.slug === selectedCompanySlug) ?? null;

  const replaceQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParamsString);
      for (const [key, value] of Object.entries(updates)) {
        if (!value) {
          params.delete(key);
          continue;
        }
        params.set(key, value);
      }
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchParamsString],
  );

  const companyRouteInput: CompanyRouteInput = useMemo(
    () => ({
      isGlobalAdmin: user?.isGlobalAdmin === true,
      permissionRole: user?.permissionRole ?? null,
      role: user?.role ?? null,
      companyRole: user?.companyRole ?? null,
      userOrigin:
        (user as { userOrigin?: string | null } | null)?.userOrigin ??
        (user as { user_origin?: string | null } | null)?.user_origin ??
        null,
      companyCount: normalizedUser.companyCount,
      clientSlug: normalizedUser.primaryCompanySlug ?? activeClientSlug ?? null,
      defaultClientSlug: normalizedUser.defaultCompanySlug ?? null,
    }),
    [activeClientSlug, normalizedUser, user],
  );

  const selectedApplicationId = normalizeText(queryParams.get("applicationId"));
  const selectedApplication =
    applicationsState.items.find((application) => application.id === selectedApplicationId) ?? null;
  const applicationMatchKeys = useMemo<ApplicationMatchKeys | null>(() => {
    if (!selectedApplication || !selectedCompanySlug) return null;
    return buildApplicationMatchKeys({
      slug: selectedApplication.slug,
      name: selectedApplication.name,
      projectCode: selectedApplication.qaseProjectCode,
      companySlug: selectedCompanySlug,
    });
  }, [selectedApplication, selectedCompanySlug]);

  const fullScreenHref = useMemo(() => {
    if (!selectedCompanySlug) return "/operacao";
    return buildCompanyPathForAccess(selectedCompanySlug, selectedModule.route, companyRouteInput);
  }, [companyRouteInput, selectedCompanySlug, selectedModule.route]);

  useEffect(() => {
    if (!selectedCompanySlug) return undefined;
    const intervalId = window.setInterval(() => setRefreshTick((value) => value + 1), 30_000);
    return () => window.clearInterval(intervalId);
  }, [selectedCompanySlug]);

  useEffect(() => {
    if (!selectedCompanySlug) {
      setApplicationsState(createLoadState());
      return undefined;
    }

    const controller = new AbortController();
    setApplicationsState((current) => ({
      ...current,
      loading: true,
      error: null,
      warning: null,
    }));

    void (async () => {
      try {
        const { response, payload } = await fetchJson(
          `/api/applications?companySlug=${encodeURIComponent(selectedCompanySlug)}`,
          controller.signal,
        );

        if (!response.ok) {
          throw new Error(resolvePayloadMessage(payload, "Nao foi possivel carregar as aplicacoes."));
        }

        const record = asRecord(payload);
        const items = Array.isArray(record?.items) ? record.items : [];
        const blockedItems = Array.isArray(record?.blockedItems) ? record.blockedItems : [];
        const normalizedItems = items
          .map((item) => {
            const current = asRecord(item);
            const id = normalizeText(current?.id);
            const name = normalizeText(current?.name);
            const slug = normalizeText(current?.slug);
            if (!id || !name || !slug) return null;
            return {
              id,
              name,
              slug,
              qaseProjectCode: normalizeProjectCode(current?.qaseProjectCode),
              source: normalizeText(current?.source),
              active: current?.active !== false,
              unavailable: current?.unavailable === true,
              accessMessage: normalizeText(current?.accessMessage),
            } satisfies OperationApplication;
          })
          .filter((item): item is OperationApplication => item !== null);

        setApplicationsState({
          items: normalizedItems,
          loading: false,
          error: null,
          warning:
            blockedItems.length > 0
              ? `${blockedItems.length} aplicacao(oes) ficaram fora desta leitura por indisponibilidade de integracao.`
              : null,
          updatedAt: Date.now(),
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setApplicationsState({
          items: [],
          loading: false,
          error: error instanceof Error ? error.message : "Nao foi possivel carregar as aplicacoes.",
          warning: null,
          updatedAt: null,
        });
      }
    })();

    return () => controller.abort();
  }, [refreshTick, selectedCompanySlug]);

  useEffect(() => {
    if (!selectedCompanySlug) {
      setRunsState(createLoadState());
      return undefined;
    }

    const controller = new AbortController();
    setRunsState((current) => ({
      ...current,
      loading: true,
      error: null,
      warning: null,
    }));

    void (async () => {
      try {
        const { response, payload } = await fetchJson(
          `/api/v1/runs?all=true&limit=120&companySlug=${encodeURIComponent(selectedCompanySlug)}`,
          controller.signal,
        );

        if (!response.ok) {
          throw new Error(resolvePayloadMessage(payload, "Nao foi possivel carregar as runs."));
        }

        const record = asRecord(payload);
        const warning = normalizeText(record?.warning);
        const normalizedRuns = extractRunsPayload(payload)
          .map((item) => normalizeRun(item, t))
          .filter((item): item is OperationRun => item !== null)
          .sort((left, right) => {
            const leftTime = left.createdAt ? Date.parse(left.createdAt) || 0 : 0;
            const rightTime = right.createdAt ? Date.parse(right.createdAt) || 0 : 0;
            return rightTime - leftTime;
          });

        setRunsState({
          items: normalizedRuns,
          loading: false,
          error: null,
          warning,
          updatedAt: Date.now(),
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setRunsState({
          items: [],
          loading: false,
          error: error instanceof Error ? error.message : "Nao foi possivel carregar as runs.",
          warning: null,
          updatedAt: null,
        });
      }
    })();

    return () => controller.abort();
  }, [refreshTick, selectedCompanySlug, t]);

  useEffect(() => {
    if (!selectedCompanySlug) {
      setPlansState(createLoadState());
      return undefined;
    }

    const controller = new AbortController();
    setPlansState((current) => ({
      ...current,
      loading: true,
      error: null,
      warning: null,
    }));

    const params = new URLSearchParams({ companySlug: selectedCompanySlug });
    if (selectedApplication?.id) {
      params.set("applicationId", selectedApplication.id);
    }

    void (async () => {
      try {
        const { response, payload } = await fetchJson(`/api/test-plans?${params.toString()}`, controller.signal);

        if (!response.ok) {
          throw new Error(resolvePayloadMessage(payload, "Nao foi possivel carregar os planos de teste."));
        }

        const record = asRecord(payload);
        const plans = Array.isArray(record?.plans) ? record.plans : [];
        setPlansState({
          items: plans.map((item) => normalizePlan(item)).filter((item): item is OperationPlan => item !== null),
          loading: false,
          error: null,
          warning: normalizeText(record?.warning),
          updatedAt: Date.now(),
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setPlansState({
          items: [],
          loading: false,
          error: error instanceof Error ? error.message : "Nao foi possivel carregar os planos de teste.",
          warning: null,
          updatedAt: null,
        });
      }
    })();

    return () => controller.abort();
  }, [refreshTick, selectedApplication?.id, selectedCompanySlug]);

  useEffect(() => {
    if (!selectedCompanySlug) {
      setDefectsState(createLoadState());
      return undefined;
    }

    const controller = new AbortController();
    setDefectsState((current) => ({
      ...current,
      loading: true,
      error: null,
      warning: null,
    }));

    void (async () => {
      try {
        const { response, payload } = await fetchJson(
          `/api/empresas/${encodeURIComponent(selectedCompanySlug)}/defeitos`,
          controller.signal,
        );

        if (!response.ok) {
          throw new Error(resolvePayloadMessage(payload, "Nao foi possivel carregar os defeitos."));
        }

        const record = asRecord(payload);
        const defects = Array.isArray(record?.defects) ? record.defects : [];
        setDefectsState({
          items: defects.map((item) => normalizeDefect(item)).filter((item): item is OperationDefect => item !== null),
          loading: false,
          error: null,
          warning: normalizeText(record?.warning),
          updatedAt: Date.now(),
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setDefectsState({
          items: [],
          loading: false,
          error: error instanceof Error ? error.message : "Nao foi possivel carregar os defeitos.",
          warning: null,
          updatedAt: null,
        });
      }
    })();

    return () => controller.abort();
  }, [refreshTick, selectedCompanySlug]);

  useEffect(() => {
    if (!selectedCompanySlug) {
      setTicketsState(createLoadState());
      return undefined;
    }

    const controller = new AbortController();
    setTicketsState((current) => ({
      ...current,
      loading: true,
      error: null,
      warning: null,
    }));

    void (async () => {
      try {
        const { response, payload } = await fetchJson(
          `/api/tickets?companySlug=${encodeURIComponent(selectedCompanySlug)}&limit=60`,
          controller.signal,
        );

        if (!response.ok) {
          if (response.status === 403) {
            setTicketsState({
              items: [],
              loading: false,
              error: null,
              warning: "Chamados seguem o escopo de suporte ja implementado para o seu perfil.",
              updatedAt: null,
            });
            return;
          }
          throw new Error(resolvePayloadMessage(payload, "Nao foi possivel carregar os chamados."));
        }

        const record = asRecord(payload);
        const items = Array.isArray(record?.items) ? record.items : [];
        setTicketsState({
          items: items.map((item) => normalizeTicket(item)).filter((item): item is OperationTicket => item !== null),
          loading: false,
          error: null,
          warning: null,
          updatedAt: Date.now(),
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setTicketsState({
          items: [],
          loading: false,
          error: error instanceof Error ? error.message : "Nao foi possivel carregar os chamados.",
          warning: null,
          updatedAt: null,
        });
      }
    })();

    return () => controller.abort();
  }, [refreshTick, selectedCompanySlug]);

  const filteredRuns = useMemo(() => {
    return runsState.items.filter((run) =>
      matchesApplicationKeys(applicationMatchKeys, [run.applicationLabel, run.projectCode]),
    );
  }, [applicationMatchKeys, runsState.items]);

  const filteredDefects = useMemo(() => {
    return defectsState.items.filter((defect) =>
      matchesApplicationKeys(applicationMatchKeys, [defect.projectCode]),
    );
  }, [applicationMatchKeys, defectsState.items]);

  const filteredPlans = useMemo(() => {
    return plansState.items.filter((plan) => {
      if (selectedApplication?.id) {
        return plan.applicationId === selectedApplication.id || plan.projectCode === selectedApplication.qaseProjectCode;
      }
      return true;
    });
  }, [plansState.items, selectedApplication]);

  const liveRuns = useMemo(() => filteredRuns.filter((run) => run.isLive), [filteredRuns]);
  const openDefects = useMemo(() => {
    return filteredDefects.filter((defect) => {
      const normalized = defect.status.trim().toLowerCase();
      return !["aprovado", "done", "closed", "resolvido"].includes(normalized);
    });
  }, [filteredDefects]);
  const openTickets = useMemo(() => {
    return ticketsState.items.filter((ticket) => {
      const normalized = ticket.status.trim().toLowerCase();
      return !["done", "closed", "resolved"].includes(normalized);
    });
  }, [ticketsState.items]);

  const averagePassRate = useMemo(() => {
    const values = filteredRuns.map((run) => run.passRate).filter((value): value is number => value != null);
    if (!values.length) return null;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [filteredRuns]);

  const totalExecutedCases = useMemo(() => {
    return filteredRuns.reduce((sum, run) => sum + run.stats.total, 0);
  }, [filteredRuns]);

  const totalBlockedCases = useMemo(() => {
    return filteredRuns.reduce((sum, run) => sum + run.stats.blocked, 0);
  }, [filteredRuns]);

  const moduleCounts = useMemo(() => {
    return {
      dashboard: selectedCompany ? "ao vivo" : "0",
      runs: String(liveRuns.length),
      applications: String(applicationsState.items.length),
      "test-plans": String(filteredPlans.length),
      defects: String(openDefects.length),
      support: String(openTickets.length),
      metrics: averagePassRate == null ? "--" : `${averagePassRate}%`,
    } satisfies Record<OperationModuleKey, string>;
  }, [
    applicationsState.items.length,
    averagePassRate,
    filteredPlans.length,
    liveRuns.length,
    openDefects.length,
    openTickets.length,
    selectedCompany,
  ]);

  function renderRunsModule() {
    if (runsState.loading && runsState.items.length === 0) {
      return <LoadingBlock label="runs da empresa" />;
    }
    if (runsState.error) {
      return <EmptyBlock title="Nao foi possivel carregar as runs" description={runsState.error} />;
    }
    if (filteredRuns.length === 0) {
      return (
        <EmptyBlock
          title="Nenhuma run encontrada neste recorte"
          description="Selecione outra aplicacao ou atualize o contexto para buscar novas execucoes."
        />
      );
    }

    return (
      <div className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[24px] border border-white/10 bg-white/4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/46">Agora</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Execucoes em andamento</h3>
              </div>
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200">
                {liveRuns.length} ativas
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {liveRuns.length > 0 ? (
                liveRuns.slice(0, 6).map((run) => (
                  <div key={run.id} className="rounded-[20px] border border-white/10 bg-[#0f1b33] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{run.title}</div>
                        <div className="mt-1 text-xs text-white/52">
                          {run.applicationLabel} {run.projectCode ? `| ${run.projectCode}` : ""} {run.runId ? `| Run ${run.runId}` : ""}
                        </div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusToneClasses(run.statusKey)}`}>
                        {run.statusLabel}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/58">
                      <span>Pass rate {formatPercent(run.passRate)}</span>
                      <span>{run.stats.total} casos</span>
                      <span>{run.responsibleLabel ?? "Sem responsavel"}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-[20px] border border-dashed border-white/10 bg-white/4 px-4 py-6 text-sm text-white/58">
                  Nenhuma run esta em andamento agora para este recorte.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/46">Historico</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Ultimas execucoes</h3>
              </div>
              <span className="text-xs text-white/52">
                {runsState.updatedAt ? `Atualizado ${formatDateTime(new Date(runsState.updatedAt).toISOString(), locale)}` : "Sem sincronizacao"}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {filteredRuns.slice(0, 10).map((run) => (
                <div key={`history-${run.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-white/8 bg-white/4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{run.title}</div>
                    <div className="mt-1 truncate text-xs text-white/52">
                      {run.applicationLabel} {run.projectCode ? `| ${run.projectCode}` : ""} {run.createdAt ? `| ${formatDateTime(run.createdAt, locale)}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-white/60">{formatPercent(run.passRate)}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusToneClasses(run.statusKey)}`}>
                      {run.statusLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderApplicationsModule() {
    if (applicationsState.loading && applicationsState.items.length === 0) {
      return <LoadingBlock label="aplicacoes da empresa" />;
    }
    if (applicationsState.error) {
      return <EmptyBlock title="Nao foi possivel carregar as aplicacoes" description={applicationsState.error} />;
    }
    if (applicationsState.items.length === 0) {
      return (
        <EmptyBlock
          title="Nenhuma aplicacao encontrada"
          description="Assim que a empresa tiver aplicacoes cadastradas ou integradas, elas aparecem aqui."
        />
      );
    }

    return (
      <div className="space-y-3">
        {applicationsState.warning ? (
          <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {applicationsState.warning}
          </div>
        ) : null}
        {applicationsState.items.map((application) => {
          const isSelected = selectedApplication?.id === application.id;
          return (
            <button
              key={application.id}
              type="button"
              onClick={() => replaceQuery({ applicationId: isSelected ? null : application.id })}
              className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-[22px] border px-4 py-4 text-left transition ${
                isSelected
                  ? "border-(--tc-accent,#ef0001)/70 bg-(--tc-accent,#ef0001)/10"
                  : "border-white/10 bg-white/4 hover:border-white/18 hover:bg-white/7"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">{application.name}</span>
                  {application.qaseProjectCode ? (
                    <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">
                      {application.qaseProjectCode}
                    </span>
                  ) : null}
                  {application.unavailable ? (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                      indisponivel
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                      {application.active ? "ativa" : "inativa"}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-white/50">
                  /{application.slug} {application.source ? `| ${application.source}` : ""}{" "}
                  {application.accessMessage ? `| ${application.accessMessage}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/64">
                <span>{isSelected ? "Recorte ativo" : "Usar no recorte"}</span>
                <FiArrowRight className="h-4 w-4" />
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  function renderPlansModule() {
    if (plansState.loading && plansState.items.length === 0) {
      return <LoadingBlock label="planos de teste" />;
    }
    if (plansState.error) {
      return <EmptyBlock title="Nao foi possivel carregar os planos" description={plansState.error} />;
    }
    if (filteredPlans.length === 0) {
      return (
        <EmptyBlock
          title="Nenhum plano encontrado"
          description="Selecione outra aplicacao ou aguarde a sincronizacao de planos manuais e integrados."
        />
      );
    }

    return (
      <div className="space-y-3">
        {plansState.warning ? (
          <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {plansState.warning}
          </div>
        ) : null}
        {filteredPlans.slice(0, 24).map((plan) => (
          <div key={plan.id} className="rounded-[22px] border border-white/10 bg-white/4 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{plan.title}</div>
                <div className="mt-1 text-xs text-white/52">
                  {plan.applicationName ?? "Sem aplicacao"} {plan.projectCode ? `| ${plan.projectCode}` : ""}{" "}
                  {plan.updatedAt ? `| ${formatDateTime(plan.updatedAt, locale)}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-white/12 bg-white/6 px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-white/72">
                  {plan.source}
                </span>
                <span className="rounded-full border border-white/12 bg-white/6 px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-white/72">
                  {plan.casesCount} casos
                </span>
                {plan.automationCasesCount > 0 ? (
                  <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-sky-200">
                    {plan.automationCasesCount} autom.
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderDefectsModule() {
    if (defectsState.loading && defectsState.items.length === 0) {
      return <LoadingBlock label="defeitos" />;
    }
    if (defectsState.error) {
      return <EmptyBlock title="Nao foi possivel carregar os defeitos" description={defectsState.error} />;
    }
    if (filteredDefects.length === 0) {
      return (
        <EmptyBlock
          title="Nenhum defeito encontrado"
          description="Os defeitos abertos e sincronizados da empresa aparecerao aqui."
        />
      );
    }

    return (
      <div className="space-y-3">
        {defectsState.warning ? (
          <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {defectsState.warning}
          </div>
        ) : null}
        {filteredDefects.slice(0, 30).map((defect) => (
          <div key={defect.id} className="rounded-[22px] border border-white/10 bg-white/4 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{defect.title}</div>
                <div className="mt-1 text-xs text-white/52">
                  {defect.projectCode ?? "Sem projeto"} {defect.runName ? `| ${defect.runName}` : ""}{" "}
                  {defect.openedAt ? `| ${formatDateTime(defect.openedAt, locale)}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.18em] ${defectToneClasses(defect.status)}`}>
                  {defect.status}
                </span>
                {defect.severity ? (
                  <span className="rounded-full border border-white/12 bg-white/6 px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-white/72">
                    {defect.severity}
                  </span>
                ) : null}
                {defect.externalUrl ? (
                  <a
                    href={defect.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/6 px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-white/72 transition hover:border-white/20 hover:bg-white/10"
                  >
                    Abrir <FiExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderSupportModule() {
    if (ticketsState.loading && ticketsState.items.length === 0) {
      return <LoadingBlock label="chamados" />;
    }
    if (ticketsState.error) {
      return <EmptyBlock title="Nao foi possivel carregar os chamados" description={ticketsState.error} />;
    }
    if (ticketsState.warning && ticketsState.items.length === 0) {
      return <EmptyBlock title="Chamados seguem o escopo atual" description={ticketsState.warning} />;
    }
    if (ticketsState.items.length === 0) {
      return (
        <EmptyBlock
          title="Nenhum chamado visivel neste recorte"
          description="Os chamados aparecem aqui respeitando o fluxo e o escopo de suporte ja existente."
        />
      );
    }

    return (
      <div className="space-y-3">
        {ticketsState.warning ? (
          <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {ticketsState.warning}
          </div>
        ) : null}
        {ticketsState.items.slice(0, 24).map((ticket) => (
          <div key={ticket.id} className="rounded-[22px] border border-white/10 bg-white/4 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {ticket.code ? <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/46">{ticket.code}</span> : null}
                  <span className="text-sm font-semibold text-white">{ticket.title}</span>
                </div>
                <div className="mt-1 text-xs text-white/52">
                  {ticket.assignedToName ? `Responsavel: ${ticket.assignedToName}` : "Sem responsavel"}{" "}
                  {ticket.updatedAt ? `| ${formatDateTime(ticket.updatedAt, locale)}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.18em] ${ticketToneClasses(ticket.status)}`}>
                  {ticket.status}
                </span>
                {ticket.priority ? (
                  <span className={`rounded-full border border-white/12 bg-white/6 px-2.5 py-1 font-semibold uppercase tracking-[0.18em] ${priorityToneClasses(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderDashboardModule() {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Runs ativas" value={String(liveRuns.length)} hint="Execucoes em andamento neste instante." />
          <MetricCard label="Pass rate medio" value={formatPercent(averagePassRate)} hint="Media do recorte atual por empresa/aplicacao." />
          <MetricCard label="Defeitos abertos" value={String(openDefects.length)} hint="Itens ainda sem resolucao final." />
          <MetricCard label="Casos executados" value={String(totalExecutedCases)} hint="Total de casos consolidados nas runs filtradas." />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-[24px] border border-white/10 bg-white/4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/46">Prioridade</p>
                <h3 className="mt-1 text-lg font-semibold text-white">O que olhar primeiro</h3>
              </div>
              <FiTarget className="h-5 w-5 text-white/40" />
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-[20px] border border-white/10 bg-[#0f1b33] px-4 py-3">
                <div className="text-sm font-semibold text-white">Runs em andamento</div>
                <p className="mt-1 text-sm leading-6 text-white/58">
                  {liveRuns.length > 0
                    ? `${liveRuns.length} execucao(oes) ainda estao rodando para este recorte.`
                    : "Nenhuma execucao em andamento agora."}
                </p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-[#0f1b33] px-4 py-3">
                <div className="text-sm font-semibold text-white">Defeitos em aberto</div>
                <p className="mt-1 text-sm leading-6 text-white/58">
                  {openDefects.length > 0
                    ? `${openDefects.length} defeito(s) seguem sem fechamento no recorte atual.`
                    : "Nenhum defeito aberto neste recorte."}
                </p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-[#0f1b33] px-4 py-3">
                <div className="text-sm font-semibold text-white">Chamados visiveis</div>
                <p className="mt-1 text-sm leading-6 text-white/58">
                  {openTickets.length > 0
                    ? `${openTickets.length} chamado(s) ainda pedem resposta ou movimentacao.`
                    : "Nenhum chamado aberto no escopo visivel."}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/46">Leitura rapida</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Recorte atual</h3>
              </div>
              <FiTrendingUp className="h-5 w-5 text-white/40" />
            </div>
            <div className="mt-4 space-y-3 text-sm text-white/62">
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3">
                <span>Aplicacao ativa no recorte</span>
                <strong className="text-white">{selectedApplication?.name ?? "Todas"}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3">
                <span>Casos bloqueados</span>
                <strong className="text-white">{totalBlockedCases}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3">
                <span>Planos visiveis</span>
                <strong className="text-white">{filteredPlans.length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3">
                <span>Aplicacoes da empresa</span>
                <strong className="text-white">{applicationsState.items.length}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderMetricsModule() {
    const atRiskRuns = filteredRuns.filter((run) => run.statusKey === "at_risk").length;
    const completedRuns = filteredRuns.filter((run) => run.statusKey === "completed").length;
    const qaseApplications = applicationsState.items.filter((application) => application.qaseProjectCode).length;

    return (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Runs concluidas" value={String(completedRuns)} hint="Historico encerrado no recorte atual." />
          <MetricCard label="Runs em risco" value={String(atRiskRuns)} hint="Falha, abort ou status fora do esperado." />
          <MetricCard label="Aplicacoes Qase" value={String(qaseApplications)} hint="Aplicacoes com projeto integrado e legivel." />
          <MetricCard label="Chamados abertos" value={String(openTickets.length)} hint="Visiveis no escopo do seu perfil." />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-[24px] border border-white/10 bg-white/4 p-4">
            <div className="flex items-center gap-2 text-white">
              <FiActivity className="h-5 w-5 text-(--tc-accent,#ef0001)" />
              <h3 className="text-lg font-semibold">Saude da execucao</h3>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-white/64">
                <span>Pass rate medio</span>
                <strong className="text-white">{formatPercent(averagePassRate)}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-white/64">
                <span>Casos executados</span>
                <strong className="text-white">{totalExecutedCases}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-white/64">
                <span>Casos bloqueados</span>
                <strong className="text-white">{totalBlockedCases}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-white/64">
                <span>Runs ao vivo</span>
                <strong className="text-white">{liveRuns.length}</strong>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/4 p-4">
            <div className="flex items-center gap-2 text-white">
              <FiLayers className="h-5 w-5 text-(--tc-accent,#ef0001)" />
              <h3 className="text-lg font-semibold">Cobertura do workspace</h3>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-white/64">
                <span>Aplicacoes visiveis</span>
                <strong className="text-white">{applicationsState.items.length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-white/64">
                <span>Planos visiveis</span>
                <strong className="text-white">{filteredPlans.length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-white/64">
                <span>Defeitos abertos</span>
                <strong className="text-white">{openDefects.length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-white/64">
                <span>Chamados abertos</span>
                <strong className="text-white">{openTickets.length}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderMainModule() {
    if (!selectedCompanySlug) {
      return (
        <EmptyBlock
          title="Selecione uma empresa para iniciar"
          description="A operacao agora vive em contexto temporario. Voce escolhe empresa e aplicacao sem misturar sua sessao."
        />
      );
    }

    if (selectedModule.key === "dashboard") return renderDashboardModule();
    if (selectedModule.key === "runs") return renderRunsModule();
    if (selectedModule.key === "applications") return renderApplicationsModule();
    if (selectedModule.key === "test-plans") return renderPlansModule();
    if (selectedModule.key === "defects") return renderDefectsModule();
    if (selectedModule.key === "support") return renderSupportModule();
    return renderMetricsModule();
  }

  return (
    <div className="min-h-[calc(100vh-var(--topbar-h))] w-full bg-transparent pb-5 pt-0 text-white">
      <div className="flex w-full max-w-none flex-col gap-4 px-3 sm:px-4 lg:px-5 xl:px-6">
        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,17,32,0.96),rgba(13,27,49,0.95))] px-5 py-5 shadow-[0_28px_60px_rgba(1,12,28,0.28)] sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-(--tc-accent,#ef0001)/30 bg-(--tc-accent,#ef0001)/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ffd2d2]">
                  Operacao inteligente
                </span>
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  Sem trocar sessao
                </span>
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  Atualizacao automatica 30s
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Empresa, modulo e aplicacao no mesmo workspace
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/62 sm:text-base">
                Aqui a empresa selecionada vira apenas um recorte operacional temporario. A tela renderiza os dados que importam
                dentro de Operacao, sem forcar troca de contexto global e sem misturar sua permissao com a permissao da empresa.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setRefreshTick((value) => value + 1)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/8 px-4 py-2.5 text-sm font-semibold text-white/84 transition hover:border-white/20 hover:bg-white/12 hover:text-white"
              >
                <FiRefreshCw className="h-4 w-4" />
                Atualizar dados
              </button>
              {selectedCompanySlug ? (
                <Link
                  href={fullScreenHref}
                  className="inline-flex items-center gap-2 rounded-2xl border border-(--tc-accent,#ef0001)/35 bg-(--tc-accent,#ef0001)/12 px-4 py-2.5 text-sm font-semibold text-[#ffd2d2] transition hover:border-(--tc-accent,#ef0001)/55 hover:bg-(--tc-accent,#ef0001)/18"
                >
                  Abrir tela completa
                  <FiExternalLink className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(240px,0.9fr)_minmax(240px,0.9fr)_minmax(0,1.2fr)]">
            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Empresa</span>
              <select
                value={selectedCompanySlug ?? ""}
                onChange={(event) => replaceQuery({ companySlug: event.target.value || null, applicationId: null })}
                className="min-h-12 w-full rounded-[20px] border border-white/12 bg-white/6 px-4 text-sm text-white outline-none transition focus:border-(--tc-accent,#ef0001)/60"
              >
                {clients.map((company) => (
                  <option key={company.id} value={company.slug} className="bg-slate-900 text-white">
                    {company.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Aplicacao</span>
              <select
                value={selectedApplication?.id ?? ""}
                onChange={(event) => replaceQuery({ applicationId: event.target.value || null })}
                className="min-h-12 w-full rounded-[20px] border border-white/12 bg-white/6 px-4 text-sm text-white outline-none transition focus:border-(--tc-accent,#ef0001)/60"
              >
                <option value="" className="bg-slate-900 text-white">
                  Todas as aplicacoes
                </option>
                {applicationsState.items.map((application) => (
                  <option key={application.id} value={application.id} className="bg-slate-900 text-white">
                    {application.name}
                    {application.qaseProjectCode ? ` (${application.qaseProjectCode})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/46">Empresa ativa no recorte</div>
                <div className="mt-2 text-sm font-semibold text-white">{selectedCompany?.name ?? "Sem empresa"}</div>
                <div className="mt-1 text-xs text-white/52">Este recorte nao altera a sua empresa ativa na sessao.</div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/46">Perfil</div>
                <div className="mt-2 text-sm font-semibold text-white">{user?.permissionRole ?? user?.role ?? "Sem perfil"}</div>
                <div className="mt-1 text-xs text-white/52">As leituras respeitam o escopo de permissao ja existente.</div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/46">Aplicacao do recorte</div>
                <div className="mt-2 text-sm font-semibold text-white">{selectedApplication?.name ?? "Todas"}</div>
                <div className="mt-1 text-xs text-white/52">Use a lista da esquerda para trocar o foco rapidamente.</div>
              </div>
            </div>
          </div>
        </section>

        {clients.length === 0 ? (
          <EmptyBlock
            title="Nenhuma empresa visivel no momento"
            description="Quando houver empresas no seu escopo, o workspace operacional passa a renderizar os modulos desta tela."
          />
        ) : (
          <div className="grid min-h-[calc(100vh-19rem)] gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,17,30,0.96),rgba(10,18,32,0.94))] shadow-[0_24px_52px_rgba(1,12,28,0.24)]">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/46">Recorte atual</p>
                    <h2 className="mt-1 text-lg font-semibold text-white">{selectedCompany?.name ?? "Selecione uma empresa"}</h2>
                  </div>
                  <span className="rounded-full border border-(--tc-accent,#ef0001)/35 bg-(--tc-accent,#ef0001)/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffd2d2]">
                    {selectedApplication?.qaseProjectCode ?? "global"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/56">
                  Modulos renderizados aqui dentro, com empresa e aplicacao como filtro local.
                </p>
              </div>

              <div className="px-4 py-4">
                <div className="space-y-2">
                  {modules.map((module) => {
                    const isActive = module.key === selectedModule.key;
                    return (
                      <button
                        key={module.key}
                        type="button"
                        onClick={() => replaceQuery({ module: module.key })}
                        className={`flex w-full items-start gap-3 rounded-[22px] border px-4 py-4 text-left transition ${
                          isActive
                            ? "border-(--tc-accent,#ef0001)/55 bg-(--tc-accent,#ef0001)/12 shadow-[0_16px_32px_rgba(239,0,1,0.12)]"
                            : "border-white/10 bg-white/4 hover:border-white/20 hover:bg-white/7"
                        }`}
                      >
                        <span className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border ${isActive ? "border-(--tc-accent,#ef0001)/45 bg-(--tc-accent,#ef0001)/12 text-[#ffd2d2]" : "border-white/10 bg-white/6 text-white/74"}`}>
                          <module.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-semibold text-white">{module.label}</span>
                            <span className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/62">
                              {moduleCounts[module.key]}
                            </span>
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-white/52">{module.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/46">Aplicacoes no recorte</p>
                    <span className="text-xs text-white/46">{applicationsState.items.length} visiveis</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={() => replaceQuery({ applicationId: null })}
                      className={`flex w-full items-center justify-between rounded-[18px] border px-3 py-3 text-left text-sm transition ${
                        !selectedApplication
                          ? "border-(--tc-accent,#ef0001)/45 bg-(--tc-accent,#ef0001)/10 text-white"
                          : "border-white/10 bg-white/4 text-white/74 hover:border-white/18 hover:bg-white/8"
                      }`}
                    >
                      <span>Todas as aplicacoes</span>
                      <FiArrowRight className="h-4 w-4" />
                    </button>
                    {applicationsState.items.slice(0, 8).map((application) => {
                      const isActive = selectedApplication?.id === application.id;
                      return (
                        <button
                          key={`aside-${application.id}`}
                          type="button"
                          onClick={() => replaceQuery({ applicationId: isActive ? null : application.id })}
                          className={`flex w-full items-center justify-between rounded-[18px] border px-3 py-3 text-left text-sm transition ${
                            isActive
                              ? "border-(--tc-accent,#ef0001)/45 bg-(--tc-accent,#ef0001)/10 text-white"
                              : "border-white/10 bg-white/4 text-white/74 hover:border-white/18 hover:bg-white/8"
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate">{application.name}</span>
                          <span className="ml-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/46">
                            {application.qaseProjectCode ?? "--"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </aside>

            <div className="space-y-4">
              <ModuleSection
                title={selectedModule.label}
                description={selectedModule.description}
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
                      {selectedCompany?.name ?? "Sem empresa"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
                      {selectedApplication?.name ?? "Todas"}
                    </span>
                  </div>
                }
              >
                {renderMainModule()}
              </ModuleSection>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <ModuleSection
                  title="Atalhos da empresa"
                  description="Se precisar aprofundar, daqui voce abre a tela completa ja no contexto certo."
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    {modules.map((module) => (
                      <Link
                        key={`shortcut-${module.key}`}
                        href={selectedCompanySlug ? buildCompanyPathForAccess(selectedCompanySlug, module.route, companyRouteInput) : "/operacao"}
                        className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/4 px-4 py-4 text-sm font-semibold text-white/82 transition hover:border-white/20 hover:bg-white/8 hover:text-white"
                      >
                        <span className="inline-flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-white/6">
                            <module.icon className="h-4 w-4" />
                          </span>
                          {module.label}
                        </span>
                        <FiExternalLink className="h-4 w-4 text-white/40" />
                      </Link>
                    ))}
                  </div>
                </ModuleSection>

                <ModuleSection
                  title="Estado do workspace"
                  description="Leituras auxiliares para entender o que carregou e o que ainda depende de integracao."
                >
                  <div className="space-y-3 text-sm text-white/62">
                    {[
                      {
                        label: "Aplicacoes",
                        loading: applicationsState.loading,
                        error: applicationsState.error,
                        warning: applicationsState.warning,
                        updatedAt: applicationsState.updatedAt,
                      },
                      {
                        label: "Runs",
                        loading: runsState.loading,
                        error: runsState.error,
                        warning: runsState.warning,
                        updatedAt: runsState.updatedAt,
                      },
                      {
                        label: "Planos",
                        loading: plansState.loading,
                        error: plansState.error,
                        warning: plansState.warning,
                        updatedAt: plansState.updatedAt,
                      },
                      {
                        label: "Defeitos",
                        loading: defectsState.loading,
                        error: defectsState.error,
                        warning: defectsState.warning,
                        updatedAt: defectsState.updatedAt,
                      },
                      {
                        label: "Chamados",
                        loading: ticketsState.loading,
                        error: ticketsState.error,
                        warning: ticketsState.warning,
                        updatedAt: ticketsState.updatedAt,
                      },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[20px] border border-white/10 bg-white/4 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-white">{item.label}</span>
                          <span className="text-xs text-white/50">
                            {item.loading
                              ? "Sincronizando"
                              : item.updatedAt
                                ? formatDateTime(new Date(item.updatedAt).toISOString(), locale)
                                : "Sem sincronizacao"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs leading-5 text-white/56">
                          {item.error ?? item.warning ?? "Leitura pronta para este bloco."}
                        </div>
                      </div>
                    ))}
                  </div>
                </ModuleSection>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
