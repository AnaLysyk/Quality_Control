"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CreateManualReleaseButton } from "@/components/CreateManualReleaseButton";
import { RunDetailKanbanPanel } from "./RunDetailKanbanPanel";
import { useI18n } from "@/hooks/useI18n";
import { fetchApi } from "@/lib/api";
import { formatRunTitle } from "@/lib/runPresentation";
import {
  FiActivity,
  FiBarChart2,
  FiBookOpen,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiExternalLink,
  FiGrid,
  FiLayers,
  FiSearch,
  FiX,
} from "react-icons/fi";

type RunStats = {
  pass: number;
  fail: number;
  blocked: number;
  notRun: number;
  total: number;
};

type QaseStatuses = Record<string, number | null | undefined>;

type RunStatsInput = Partial<RunStats> & {
  not_run?: number | null;
  passed?: number | null;
  failed?: number | null;
  untested?: number | null;
  skipped?: number | null;
  retest?: number | null;
  in_progress?: number | null;
  invalid?: number | null;
  statuses?: QaseStatuses | null;
};

type ApplicationItem = {
  id: string;
  name: string;
  slug: string;
  qaseProjectCode?: string | null;
};

type IntegratedRun = {
  slug: string;
  title: string;
  runId: number | null;
  summary: string | null;
  status: string | null;
  app: string | null;
  project: string | null;
  qaseProject: string | null;
  source: string | null;
  createdAt: string | null;
  clientId: string | null;
  clientName: string | null;
  manualSummary: RunStatsInput | null;
  metrics: RunStatsInput | null;
  stats: RunStatsInput | null;
  responsibleLabel: string | null;
  responsibleName: string | null;
  responsibleEmail: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  testPlanId: string | null;
  statusText: string | null;
  testPlanName: string | null;
  testPlanSource: "manual" | "qase" | null;
  testPlanProjectCode: string | null;
};

type UnifiedRun = {
  key: string;
  slug: string;
  name: string;
  runId: number | null;
  createdAt: string | null;
  statusLabel: string;
  sourceType: "manual" | "integrated";
  sourceLabel: string;
  providerLabel: string | null;
  applicationLabel: string;
  projectCode: string | null;
  summary: string;
  responsibleLabel: string | null;
  passRate: number | null;
  stats: RunStats;
  testPlanName: string | null;
  testPlanSource: "manual" | "qase" | null;
  testPlanProjectCode: string | null;
  raw: Record<string, unknown>;
};

type RunSortKey = "createdAt" | "name" | "statusLabel" | "applicationLabel" | "sourceLabel" | "passRate";

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildApplicationKeys(companySlug: string, applications: ApplicationItem[]) {
  const keys = new Set<string>();
  const seeds = [companySlug, ...applications.flatMap((application) => [application.slug, application.name, application.qaseProjectCode])];
  for (const seed of seeds) {
    const key = normalizeKey(seed);
    if (key) keys.add(key);
  }
  return keys;
}

function normalizeProjectCode(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
}

function normalizeNumericId(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toTimestamp(value: string | null) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function formatDate(value: string | null, language: "pt-BR" | "en-US", t: (key: string) => string) {
  const time = toTimestamp(value);
  if (!time) return t("runsPage.noDate");
  return new Intl.DateTimeFormat(language === "pt-BR" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function resolveStatusLabel(value: string | null, t: (key: string) => string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return t("runsPage.noStatus");
  if (["1", "done", "closed", "finalized", "finalizada"].includes(normalized)) return t("runsPage.statusCompleted");
  if (["0", "running", "in_progress", "em_andamento", "open", "active", "aberta"].includes(normalized)) return t("runsPage.statusInProgress");
  if (["blocked", "bloqueada"].includes(normalized)) return t("runsPage.statusBlocked");
  if (["2", "abort", "aborted", "failed", "fail", "erro", "error", "falha", "violated"].includes(normalized)) return t("runsPage.statusAtRisk");
  if (["draft", "saved", "pending", "pendente"].includes(normalized)) return t("runsPage.statusPending");
  return value ?? t("runsPage.noStatus");
}

function computeStats(input: RunStatsInput | null | undefined): RunStats {
  const statuses = input?.statuses ?? {};
  const pass = Math.max(0, Number(input?.pass ?? input?.passed ?? statuses?.passed ?? 0));
  const fail = Math.max(0, Number(input?.fail ?? input?.failed ?? statuses?.failed ?? 0));
  const blocked = Math.max(0, Number(input?.blocked ?? statuses?.blocked ?? 0));
  const skipped = Math.max(0, Number(input?.skipped ?? statuses?.skipped ?? 0));
  const retest = Math.max(0, Number(input?.retest ?? statuses?.retest ?? 0));
  const inProgress = Math.max(0, Number(input?.in_progress ?? statuses?.in_progress ?? 0));
  const invalid = Math.max(0, Number(input?.invalid ?? statuses?.invalid ?? 0));
  const notRun = Math.max(0, Number(input?.notRun ?? input?.not_run ?? input?.untested ?? statuses?.untested ?? 0));
  return {
    pass,
    fail,
    blocked,
    notRun: notRun + skipped + retest + inProgress + invalid,
    total: pass + fail + blocked + notRun + skipped + retest + inProgress + invalid,
  };
}

function computePassRate(stats: RunStats) {
  return stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : null;
}

function resolveProvider(run: IntegratedRun, t: (key: string) => string) {
  const joined = [run.source, run.summary, run.title, run.app, run.project, run.qaseProject].filter(Boolean).join(" ").toLowerCase();
  if (joined.includes("jira")) return t("runsPage.providerJira");
  if (run.qaseProject || joined.includes("qase")) return t("runsPage.providerQase");
  return null;
}

function normalizeManualRuns(data: unknown[], t: (key: string, params?: Record<string, string | number>) => string): UnifiedRun[] {
  return data.reduce<UnifiedRun[]>((accumulator, item) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const slug = String(rec.slug ?? rec.id ?? "");
    if (!slug) return accumulator;

    const testPlanSource = rec.testPlanSource === "qase" || rec.testPlanSource === "manual" ? rec.testPlanSource : null;
    const testPlanId = typeof rec.testPlanId === "string" && rec.testPlanId.trim() ? rec.testPlanId.trim() : null;
    const testPlanName =
      typeof rec.testPlanName === "string" && rec.testPlanName.trim()
        ? rec.testPlanName.trim()
        : testPlanId
          ? t("runsPage.planFallback", { id: testPlanId })
          : null;
    const stats = computeStats((rec.stats ?? rec.metrics ?? {}) as RunStatsInput);

    accumulator.push({
      key: `manual:${slug}`,
      slug,
      name: formatRunTitle(String(rec.name ?? rec.title ?? rec.slug ?? t("runsPage.manualNameFallback")), t("runsPage.manualNameFallback")),
      runId: normalizeNumericId(rec.runId ?? rec.run_id),
      createdAt: typeof rec.createdAt === "string" ? rec.createdAt : typeof rec.created_at === "string" ? rec.created_at : null,
      statusLabel: resolveStatusLabel(typeof rec.status === "string" ? rec.status : null, t),
      sourceType: "manual",
      sourceLabel: t("runsPage.manualSource"),
      providerLabel: null,
      applicationLabel: String(rec.app ?? rec.qaseProject ?? t("runsPage.manualAppFallback")),
      projectCode: normalizeProjectCode(rec.qaseProject ?? rec.app),
      summary: t("runsPage.manualSummary", { pass: stats.pass, fail: stats.fail, blocked: stats.blocked, notRun: stats.notRun }),
      responsibleLabel:
        typeof rec.responsibleLabel === "string" && rec.responsibleLabel.trim()
          ? rec.responsibleLabel.trim()
          : typeof rec.assignedToName === "string" && rec.assignedToName.trim()
            ? rec.assignedToName.trim()
            : typeof rec.createdByName === "string" && rec.createdByName.trim()
              ? rec.createdByName.trim()
              : null,
      passRate: computePassRate(stats),
      stats,
      testPlanName,
      testPlanSource,
      testPlanProjectCode: normalizeProjectCode(rec.testPlanProjectCode ?? rec.qaseProject ?? rec.app),
      raw: rec,
    });

    return accumulator;
  }, []);
}

function normalizeIntegratedRuns(data: unknown[]): IntegratedRun[] {
  return data.reduce<IntegratedRun[]>((accumulator, item) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const slug = String(rec.slug ?? rec.id ?? "");
    if (!slug) return accumulator;

    accumulator.push({
      slug,
      title: typeof rec.title === "string" ? rec.title : typeof rec.name === "string" ? rec.name : slug,
      runId: normalizeNumericId(rec.runId ?? rec.run_id ?? rec.run),
      summary: typeof rec.summary === "string" ? rec.summary : null,
      status: typeof rec.status === "string" ? rec.status : typeof rec.status === "number" ? String(rec.status) : null,
      app: typeof rec.app === "string" ? rec.app : null,
      project: typeof rec.project === "string" ? rec.project : null,
      qaseProject: typeof rec.qaseProject === "string" ? rec.qaseProject : null,
      source: typeof rec.source === "string" ? rec.source : null,
      createdAt:
        typeof rec.createdAt === "string"
          ? rec.createdAt
          : typeof rec.created_at === "string"
            ? rec.created_at
            : typeof rec.start_time === "string"
              ? rec.start_time
              : null,
      clientId: typeof rec.clientId === "string" ? rec.clientId : null,
      clientName: typeof rec.clientName === "string" ? rec.clientName : null,
      manualSummary: typeof rec.manualSummary === "object" && rec.manualSummary ? (rec.manualSummary as RunStatsInput) : null,
      metrics: typeof rec.metrics === "object" && rec.metrics ? (rec.metrics as RunStatsInput) : null,
      stats: typeof rec.stats === "object" && rec.stats ? (rec.stats as RunStatsInput) : null,
      statusText: typeof rec.status_text === "string" ? rec.status_text : null,
      responsibleLabel: typeof rec.responsibleLabel === "string" ? rec.responsibleLabel : null,
      responsibleName: typeof rec.responsibleName === "string" ? rec.responsibleName : null,
      responsibleEmail: typeof rec.responsibleEmail === "string" ? rec.responsibleEmail : null,
      createdByName: typeof rec.createdByName === "string" ? rec.createdByName : null,
      createdByEmail: typeof rec.createdByEmail === "string" ? rec.createdByEmail : null,
      testPlanId:
        typeof rec.plan_id === "number" || typeof rec.plan_id === "string"
          ? String(rec.plan_id)
          : typeof rec.planId === "number" || typeof rec.planId === "string"
            ? String(rec.planId)
            : null,
      testPlanName:
        typeof rec.plan_name === "string" && rec.plan_name.trim()
          ? rec.plan_name.trim()
          : typeof rec.planName === "string" && rec.planName.trim()
            ? rec.planName.trim()
            : null,
      testPlanSource:
        rec.plan_id !== undefined || rec.planId !== undefined || rec.plan_name !== undefined || rec.planName !== undefined ? "qase" : null,
      testPlanProjectCode:
        typeof rec.planProjectCode === "string" && rec.planProjectCode.trim() ? rec.planProjectCode.trim().toUpperCase() : null,
    });

    return accumulator;
  }, []);
}

function toUnifiedIntegratedRuns(data: IntegratedRun[], t: (key: string, params?: Record<string, string | number>) => string): UnifiedRun[] {
  return data.map((run) => {
    const stats = computeStats(run.manualSummary ?? run.metrics ?? run.stats);
    const providerLabel = resolveProvider(run, t);
    const applicationLabel = String(run.app ?? run.project ?? run.qaseProject ?? providerLabel ?? t("runsPage.integratedFallback")).trim() || t("runsPage.integratedFallback");
    const responsibleLabel =
      run.responsibleLabel?.trim() ||
      run.responsibleName?.trim() ||
      run.createdByName?.trim() ||
      run.responsibleEmail?.trim() ||
      run.createdByEmail?.trim() ||
      null;

    return {
      key: `integrated:${run.slug}`,
      slug: run.slug,
      name: formatRunTitle(run.title, t("runsPage.integratedNameFallback")),
      runId: run.runId,
      createdAt: run.createdAt,
      statusLabel: resolveStatusLabel(run.statusText ?? run.status, t),
      sourceType: "integrated",
      sourceLabel: t("runsPage.integratedSource"),
      providerLabel,
      applicationLabel,
      projectCode: normalizeProjectCode(run.qaseProject ?? run.project ?? run.app),
      summary:
        run.summary?.trim() ||
        (stats.total > 0 ? t("runsPage.integratedSummaryWithTelemetry", { total: stats.total }) : t("runsPage.integratedSummaryNoTelemetry")),
      responsibleLabel,
      passRate: computePassRate(stats),
      stats,
      testPlanName: run.testPlanName?.trim() || (run.testPlanId ? t("runsPage.planFallback", { id: run.testPlanId }) : null),
      testPlanSource: run.testPlanSource,
      testPlanProjectCode: run.testPlanProjectCode || normalizeProjectCode(run.qaseProject ?? run.project ?? run.app),
      raw: {
        slug: run.slug,
        title: run.title,
        runId: run.runId,
        summary: run.summary,
        status: run.status,
        app: run.app,
        project: run.project,
        qaseProject: run.qaseProject,
        source: run.source,
        createdAt: run.createdAt,
        clientId: run.clientId,
        clientName: run.clientName,
        manualSummary: run.manualSummary,
        metrics: run.metrics,
        stats: run.stats,
        statusText: run.statusText,
        responsibleLabel: run.responsibleLabel,
        responsibleName: run.responsibleName,
        responsibleEmail: run.responsibleEmail,
        createdByName: run.createdByName,
        createdByEmail: run.createdByEmail,
        testPlanId: run.testPlanId,
        testPlanName: run.testPlanName,
        testPlanSource: run.testPlanSource,
        testPlanProjectCode: run.testPlanProjectCode,
      },
    };
  });
}

function passRateColor(rate: number | null) {
  if (rate === null) return { bg: "bg-slate-200", text: "text-slate-500", border: "border-slate-300" };
  if (rate >= 80) return { bg: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-400" };
  if (rate >= 50) return { bg: "bg-amber-400", text: "text-amber-700", border: "border-amber-400" };
  return { bg: "bg-rose-500", text: "text-rose-700", border: "border-rose-400" };
}

function statusColor(label: string) {
  const value = label.toLowerCase();
  if (["completed", "concluida"].some((s) => value.includes(s))) return "bg-emerald-500/20 text-emerald-800 border-emerald-500/40";
  if (["andamento", "progress", "running"].some((s) => value.includes(s))) return "bg-blue-500/20 text-blue-800 border-blue-500/40";
  if (["risco", "risk", "falha", "fail"].some((s) => value.includes(s))) return "bg-rose-500/20 text-rose-800 border-rose-500/40";
  if (["bloqueada", "blocked"].some((s) => value.includes(s))) return "bg-amber-500/20 text-amber-800 border-amber-500/40";
  if (["pendente", "pending", "draft"].some((s) => value.includes(s))) return "bg-slate-500/20 text-slate-800 border-slate-500/40";
  return "bg-slate-500/20 text-slate-800 border-slate-500/40";
}

function PassRateBar({ pass, fail, blocked, total }: { pass: number; fail: number; blocked: number; total: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.style.setProperty("--pass-w", `${(pass / total) * 100}%`);
    ref.current.style.setProperty("--fail-w", `${(fail / total) * 100}%`);
    ref.current.style.setProperty("--block-w", `${(blocked / total) * 100}%`);
  }, [pass, fail, blocked, total]);

  return (
    <div ref={ref} className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
      <div className="w-(--pass-w) bg-emerald-500 transition-all" />
      <div className="w-(--fail-w) bg-rose-400 transition-all" />
      <div className="w-(--block-w) bg-amber-400 transition-all" />
    </div>
  );
}

export default function CompanyRunsPageClient() {
  const { t, language } = useI18n();
  const params = useParams();
  const slugParam = params?.slug;
  const companySlug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const [runs, setRuns] = useState<UnifiedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<RunSortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedRun, setSelectedRun] = useState<UnifiedRun | null>(null);
  const [detailTab, setDetailTab] = useState<"resumo" | "kanban" | "fluxo" | "detalhes" | "bruto">("resumo");
  const [reloadNonce, setReloadNonce] = useState(0);
  const pageSize = 12;

  useEffect(() => {
    const currentCompanySlug = companySlug ?? "";
    if (!currentCompanySlug) return;

    let active = true;

    async function loadRuns() {
      setLoading(true);
      setError(null);

      try {
        let timeParams = "";
        if (dateFrom) {
          const fromTs = Math.floor(new Date(`${dateFrom}T00:00:00`).getTime() / 1000);
          if (fromTs > 0) timeParams += `&from_start_time=${encodeURIComponent(String(fromTs))}`;
        }
        if (dateTo) {
          const toTs = Math.floor(new Date(`${dateTo}T23:59:59`).getTime() / 1000);
          if (toTs > 0) timeParams += `&to_start_time=${encodeURIComponent(String(toTs))}`;
        }

        const [manualScopedResult, integratedScopedResult, applicationsResult, releasesAllResult] = await Promise.allSettled([
          fetchApi(`/api/releases-manual?clientSlug=${encodeURIComponent(currentCompanySlug)}&kind=run`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
          fetchApi(`/api/v1/runs?all=true&limit=${encodeURIComponent(String(200))}&companySlug=${encodeURIComponent(currentCompanySlug)}${timeParams}`)
            .then((r) => (r.ok ? r.json() : {}))
            .catch(() => ({})),
          fetchApi(`/api/applications?companySlug=${encodeURIComponent(currentCompanySlug)}`).then((r) => r.json()).catch(() => ({})),
          fetchApi(`/api/releases`).then((r) => r.json()).catch(() => ({})),
        ]);

        const manualScopedData = manualScopedResult.status === "fulfilled" ? manualScopedResult.value : [];
        const integratedScopedData = integratedScopedResult.status === "fulfilled" ? integratedScopedResult.value : {};
        const applicationsData = applicationsResult.status === "fulfilled" ? applicationsResult.value : {};
        const releasesAllData = releasesAllResult.status === "fulfilled" ? releasesAllResult.value : {};

        const applications = Array.isArray(applicationsData?.items) ? (applicationsData.items as ApplicationItem[]) : [];
        const companyKey = normalizeKey(currentCompanySlug);
        const applicationKeys = buildApplicationKeys(currentCompanySlug, applications);

        const toArrayPayload = (payload: unknown): unknown[] =>
          Array.isArray(payload)
            ? payload
            : Array.isArray((payload as Record<string, unknown> | null | undefined)?.data)
              ? ((payload as Record<string, unknown>).data as unknown[])
              : [];

        const toIntegratedEntities = (payload: unknown): unknown[] => {
          const record = (payload ?? {}) as Record<string, unknown>;
          if (Array.isArray(record.data)) return record.data;
          if (Array.isArray(record.releases)) return record.releases;
          if (Array.isArray((record.result as Record<string, unknown> | undefined)?.entities)) {
            return (record.result as Record<string, unknown>).entities as unknown[];
          }
          return [];
        };

        const matchesIntegratedContext = (item: unknown) => {
          const record = (item ?? {}) as Record<string, unknown>;
          const clientIdKey = normalizeKey(record.clientId);
          const clientNameKey = normalizeKey(record.clientName);
          if (clientIdKey && clientIdKey === companyKey) return true;
          if (clientNameKey && clientNameKey === companyKey) return true;

          const appKey = normalizeKey(record.app);
          const projectKey = normalizeKey(record.project);
          const qaseProjectKey = normalizeKey(record.qaseProject);
          return applicationKeys.has(appKey) || applicationKeys.has(projectKey) || applicationKeys.has(qaseProjectKey);
        };

        const manualScopedArray = toArrayPayload(manualScopedData);
        let manualArray: unknown[] = manualScopedArray;
        if (manualScopedArray.length === 0) {
          const manualAllData = await fetchApi(`/api/releases-manual?kind=run`).then((r) => r.json()).catch(() => []);
          manualArray = toArrayPayload(manualAllData).filter((item) => {
            const record = (item ?? {}) as Record<string, unknown>;
            const clientSlugKey = normalizeKey(record.clientSlug);
            if (clientSlugKey && clientSlugKey === companyKey) return true;
            const appKey = normalizeKey(record.app);
            const qaseProjectKey = normalizeKey(record.qaseProject);
            return applicationKeys.has(appKey) || applicationKeys.has(qaseProjectKey);
          });
        }

        let integratedEntities: unknown[] = toIntegratedEntities(integratedScopedData);
        if (integratedEntities.length === 0) {
          const integratedAllData = await fetchApi(`/api/v1/runs?all=true&limit=${encodeURIComponent(String(200))}${timeParams}`).then((r) => r.json()).catch(() => ({}));
          integratedEntities = toIntegratedEntities(integratedAllData).filter(matchesIntegratedContext);
        }

        const releasesEntries: unknown[] = Array.isArray(releasesAllData?.releases) ? releasesAllData.releases.filter(matchesIntegratedContext) : [];
        if (releasesEntries.length > 0) {
          const existingSlugs = new Set(integratedEntities.map((entry) => String((entry as Record<string, unknown>)?.slug ?? "")).filter(Boolean));
          integratedEntities = [...integratedEntities, ...releasesEntries.filter((entry) => !existingSlugs.has(String((entry as Record<string, unknown>)?.slug ?? "")))];
        }

        const manualRuns = normalizeManualRuns(manualArray, t);
        const integratedRuns = toUnifiedIntegratedRuns(normalizeIntegratedRuns(integratedEntities), t);

        if (!active) return;
        setRuns([...manualRuns, ...integratedRuns].sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt)));
      } catch {
        if (!active) return;
        setRuns([]);
        setError(t("runsPage.loadError"));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadRuns();

    return () => {
      active = false;
    };
  }, [companySlug, t, dateFrom, dateTo, reloadNonce]);

  const filteredRuns = useMemo(() => {
    let result = runs;
    if (dateFrom || dateTo) {
      result = result.filter((run) => {
        const timestamp = toTimestamp(run.createdAt);
        if (!timestamp) return false;
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const localDateKey = `${year}-${month}-${day}`;
        if (dateFrom && localDateKey < dateFrom) return false;
        if (dateTo && localDateKey > dateTo) return false;
        return true;
      });
    }

    const term = search.trim().toLowerCase();
    if (!term) return result;

    return result.filter((run) =>
      [run.name, run.slug, run.applicationLabel, run.projectCode, run.sourceLabel, run.providerLabel, run.responsibleLabel, run.testPlanName]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .some((value) => value.toLowerCase().includes(term)),
    );
  }, [runs, search, dateFrom, dateTo]);

  const sortedRuns = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filteredRuns].sort((left, right) => {
      const leftValue =
        sortKey === "createdAt" ? toTimestamp(left.createdAt) : sortKey === "passRate" ? left.passRate ?? -1 : String(left[sortKey] ?? "").toLowerCase();
      const rightValue =
        sortKey === "createdAt" ? toTimestamp(right.createdAt) : sortKey === "passRate" ? right.passRate ?? -1 : String(right[sortKey] ?? "").toLowerCase();

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction;
      }

      return String(leftValue).localeCompare(String(rightValue), "pt-BR") * direction;
    });
  }, [filteredRuns, sortDirection, sortKey]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedRuns.length / pageSize)), [sortedRuns.length]);

  useEffect(() => {
    setPage(1);
  }, [search, dateFrom, dateTo, sortKey, sortDirection]);

  const pagedRuns = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRuns.slice(start, start + pageSize);
  }, [sortedRuns, page]);

  useEffect(() => {
    if (!selectedRun) return;
    const refreshedRun = sortedRuns.find((run) => run.key === selectedRun.key) ?? null;
    if (!refreshedRun) {
      setSelectedRun(null);
      return;
    }
    if (refreshedRun !== selectedRun) {
      setSelectedRun(refreshedRun);
    }
  }, [selectedRun, sortedRuns]);

  useEffect(() => {
    if (!selectedRun) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedRun(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedRun]);

  function toggleSort(key: RunSortKey) {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "createdAt" || key === "passRate" ? "desc" : "asc");
  }

  function sortIcon(key: RunSortKey) {
    if (sortKey !== key) return <FiChevronUp className="h-3.5 w-3.5 opacity-30" />;
    return sortDirection === "asc" ? <FiChevronUp className="h-3.5 w-3.5" /> : <FiChevronDown className="h-3.5 w-3.5" />;
  }

  function openRun(run: UnifiedRun) {
    setSelectedRun(run);
    setDetailTab("resumo");
  }

  function formatRawValue(value: unknown) {
    if (value === null || value === undefined) return "-";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  const activeRun = selectedRun;

  return (
    <div className="w-full space-y-4 py-4 sm:py-6" data-testid="runs-page">
      <header className="rounded-[28px] border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 shadow-sm sm:p-5 dark:bg-slate-950">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--tc-text-muted,#6b7280)">
              <FiSearch className="h-4 w-4" />
            </span>
            <input
              data-testid="runs-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("runsPage.searchPlaceholder")}
              className="w-full rounded-2xl border border-(--tc-border,#d9e1ec) bg-(--tc-surface,#f8fafc) py-3 pr-4 pl-11 text-sm font-medium text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/15 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CreateManualReleaseButton
              companySlug={companySlug}
              redirectToRun={false}
              onCreated={() => setReloadNonce((current) => current + 1)}
            />
            <input
              aria-label="Data inicial"
              title="De"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-2xl border border-(--tc-border,#d9e1ec) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-medium text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001) dark:bg-slate-950 dark:text-slate-100"
            />
            <input
              aria-label="Data final"
              title="Ate"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-2xl border border-(--tc-border,#d9e1ec) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-medium text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001) dark:bg-slate-950 dark:text-slate-100"
            />
            {(dateFrom || dateTo) ? (
              <button
                type="button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="rounded-2xl border border-(--tc-border,#d9e1ec) px-4 py-3 text-sm font-semibold text-(--tc-text-muted,#6b7280) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-text,#0b1a3c) dark:text-slate-300"
              >
                Limpar data
              </button>
            ) : null}
          </div>
        </div>
        {error ? <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div> : null}
      </header>

      <section className="rounded-[28px] border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) shadow-sm dark:bg-slate-950" data-testid="runs-list">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-(--tc-surface,#ffffff) dark:bg-slate-950">
              <tr className="text-left text-[11px] font-bold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                {[
                  { key: "name", label: "Run" },
                  { key: "applicationLabel", label: "Aplicacao" },
                  { key: "statusLabel", label: "Status" },
                  { key: "sourceLabel", label: "Origem" },
                  { key: "createdAt", label: "Data" },
                  { key: "passRate", label: "Aprovacao" },
                ].map((column) => (
                  <th key={column.key} className="border-b border-(--tc-border,#e5e7eb) px-4 py-4">
                    <button type="button" onClick={() => toggleSort(column.key as RunSortKey)} className="inline-flex items-center gap-2 transition hover:text-(--tc-text,#0b1a3c)">
                      <span>{column.label}</span>
                      {sortIcon(column.key as RunSortKey)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-(--tc-accent,#ef0001)" />
                    </div>
                  </td>
                </tr>
              ) : pagedRuns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900">
                        <FiLayers className="h-7 w-7 text-slate-400" />
                      </div>
                      <p className="mt-4 text-sm font-medium text-(--tc-text-muted,#6b7280)">{t("runsPage.empty")}</p>
                      <div className="mt-5">
                        <CreateManualReleaseButton
                          companySlug={companySlug}
                          redirectToRun={false}
                          onCreated={() => setReloadNonce((current) => current + 1)}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedRuns.map((run, index) => {
                  const selected = activeRun?.key === run.key;
                  const rate = passRateColor(run.passRate);
                  const rowTone =
                    run.passRate === null
                      ? "border-l-slate-300"
                      : run.passRate >= 80
                        ? "border-l-emerald-500"
                        : run.passRate >= 50
                          ? "border-l-amber-500"
                          : "border-l-rose-500";

                  return (
                    <tr
                      key={run.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => openRun(run)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openRun(run);
                        }
                      }}
                      className={[
                        "cursor-pointer border-b border-(--tc-border,#edf2f7) transition",
                        "hover:bg-slate-50 dark:hover:bg-slate-900/60",
                        selected ? "bg-rose-50/80 dark:bg-rose-950/30" : index % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50/60 dark:bg-slate-900/20",
                      ].join(" ")}
                    >
                      <td className={`border-l-4 ${rowTone} px-4 py-4 align-top`}>
                        <p className="truncate text-sm font-bold text-(--tc-text,#0b1a3c)">{run.name}</p>
                        <p className="mt-1 truncate text-xs text-(--tc-text-muted,#6b7280)">{run.slug}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="truncate text-sm font-semibold text-(--tc-text,#0b1a3c)">{run.applicationLabel}</p>
                        {run.projectCode ? <p className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">{run.projectCode}</p> : null}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${statusColor(run.statusLabel)}`}>
                          {run.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                            run.sourceType === "integrated"
                              ? "border-emerald-600/30 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "border-blue-600/30 bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                          }`}>
                            {run.sourceLabel}
                          </span>
                          {run.providerLabel ? <p className="text-xs text-(--tc-text-muted,#6b7280)">{run.providerLabel}</p> : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-(--tc-text,#0b1a3c)">{formatDate(run.createdAt, language, t)}</td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-11 w-11 items-center justify-center">
                            <svg className="h-11 w-11 -rotate-90" viewBox="0 0 48 48">
                              <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-slate-200 dark:text-slate-800" />
                              <circle
                                cx="24"
                                cy="24"
                                r="20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeDasharray={`${((run.passRate ?? 0) / 100) * 125.7} 125.7`}
                                className={rate.text}
                              />
                            </svg>
                            <span className={`absolute text-[11px] font-black ${rate.text}`}>{run.passRate !== null ? `${run.passRate}%` : "-"}</span>
                          </div>
                          <div className="min-w-0 text-xs text-(--tc-text-muted,#6b7280)">
                            <p className="font-semibold text-(--tc-text,#0b1a3c)">{run.stats.pass}/{run.stats.total}</p>
                            <p>pass rate</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && sortedRuns.length > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t border-(--tc-border,#e5e7eb) px-4 py-4">
            <p className="text-sm text-(--tc-text-muted,#6b7280)">{t("runsPage.pageLabel", { page, totalPages })}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label={t("runsPage.prevPage")}
                title={t("runsPage.prevPage")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) transition hover:border-(--tc-accent,#ef0001) disabled:opacity-40"
              >
                <FiChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label={t("runsPage.nextPage")}
                title={t("runsPage.nextPage")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) transition hover:border-(--tc-accent,#ef0001) disabled:opacity-40"
              >
                <FiChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {activeRun ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-3 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Detalhe da execucao"
          onClick={() => setSelectedRun(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) shadow-2xl dark:bg-slate-950"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-(--tc-border,#e5e7eb) px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Execucao</p>
                <h2 className="truncate text-xl font-black text-(--tc-text,#0b1a3c)">{activeRun.name}</h2>
                <p className="truncate text-sm text-(--tc-text-muted,#6b7280)">
                  {activeRun.applicationLabel} · {formatDate(activeRun.createdAt, language, t)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-(--tc-border,#e5e7eb) text-(--tc-text-muted,#6b7280) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-text,#0b1a3c)"
                aria-label="Fechar modal"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-(--tc-border,#e5e7eb) px-5 pt-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "resumo", label: "Resumo" },
                  { key: "kanban", label: activeRun.sourceType === "manual" ? "Kanban" : "Kanban integrado" },
                  { key: "fluxo", label: "Fluxo" },
                  { key: "detalhes", label: "Detalhes" },
                  { key: "bruto", label: "Bruto" },
                ].map((tab) => {
                  const active = detailTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setDetailTab(tab.key as typeof detailTab)}
                      className={[
                        "rounded-full border px-4 py-2 text-sm font-semibold transition",
                        active
                          ? "border-(--tc-accent,#ef0001) bg-(--tc-accent,#ef0001) text-white"
                          : "border-(--tc-border,#d9e1ec) bg-transparent text-(--tc-text-muted,#6b7280) hover:border-(--tc-accent,#ef0001) hover:text-(--tc-text,#0b1a3c)",
                      ].join(" ")}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="max-h-[calc(92vh-11rem)] overflow-y-auto p-5">
              {detailTab === "resumo" ? (
                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f8fafc) p-4">
                      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                        <FiGrid className="h-3.5 w-3.5" /> Registro
                      </p>
                      <p className="mt-2 text-lg font-black text-(--tc-text,#0b1a3c)">{activeRun.slug}</p>
                    </div>
                    <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f8fafc) p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">Status</p>
                      <p className="mt-2 text-lg font-black text-(--tc-text,#0b1a3c)">{activeRun.statusLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f8fafc) p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">Origem</p>
                      <p className="mt-2 text-lg font-black text-(--tc-text,#0b1a3c)">{activeRun.sourceLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f8fafc) p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">Aprovacao</p>
                      <p className="mt-2 text-lg font-black text-(--tc-text,#0b1a3c)">{activeRun.passRate !== null ? `${activeRun.passRate}%` : "-"}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f8fafc) p-4">
                    <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                      <FiBookOpen className="h-3.5 w-3.5" /> Resumo
                    </p>
                    <p className="mt-2 text-sm leading-6 text-(--tc-text,#0b1a3c)">{activeRun.summary}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-3 dark:bg-slate-950">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">Plano</p>
                        <p className="mt-1 font-semibold text-(--tc-text,#0b1a3c)">{activeRun.testPlanName ?? "-"}</p>
                      </div>
                      <div className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-3 dark:bg-slate-950">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">Responsavel</p>
                        <p className="mt-1 font-semibold text-(--tc-text,#0b1a3c)">{activeRun.responsibleLabel ?? "-"}</p>
                      </div>
                      <div className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-3 dark:bg-slate-950">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">Aplicacao</p>
                        <p className="mt-1 font-semibold text-(--tc-text,#0b1a3c)">{activeRun.applicationLabel}</p>
                      </div>
                      <div className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-3 dark:bg-slate-950">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">Tipo</p>
                        <p className="mt-1 font-semibold text-(--tc-text,#0b1a3c)">{activeRun.sourceType}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {detailTab === "kanban" ? (
                <RunDetailKanbanPanel
                  run={{
                    slug: activeRun.slug,
                    sourceType: activeRun.sourceType,
                    applicationLabel: activeRun.applicationLabel,
                    projectCode: activeRun.projectCode,
                    runId: activeRun.runId,
                    stats: activeRun.stats,
                    raw: activeRun.raw,
                  }}
                  companySlug={companySlug}
                  onRunUpdated={() => setReloadNonce((current) => current + 1)}
                />
              ) : null}

              {detailTab === "fluxo" ? (
                <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f8fafc) p-4">
                    <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-(--tc-text-muted,#6b7280)">
                      <FiActivity className="h-3.5 w-3.5" /> Fluxo completo
                    </p>
                    <div className="mt-4 space-y-4">
                      {["Receber payload", "Resolver contexto", "Executar fluxo", "Ler resposta"].map((title, index) => (
                        <div key={title} className="flex gap-3">
                          <div className="mt-1 h-3 w-3 rounded-full bg-emerald-500" />
                          <div className="min-w-0">
                            <p className="font-semibold text-(--tc-text,#0b1a3c)">
                              {index + 1}. {title}
                            </p>
                            <p className="text-sm text-(--tc-text-muted,#6b7280)">
                              {index === 0
                                ? "Dados recebidos para esta run."
                                : index === 1
                                  ? "Empresa, usuario e plano vinculados."
                                  : index === 2
                                    ? "Sequencia aplicada na automacao."
                                    : "Status final e resultados capturados."}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f8fafc) p-4">
                    <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-(--tc-text-muted,#6b7280)">
                      <FiBarChart2 className="h-3.5 w-3.5" /> Metricas
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-4 dark:bg-slate-950">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">Pass</p>
                        <p className="mt-2 text-2xl font-black text-emerald-600">{activeRun.stats.pass}</p>
                      </div>
                      <div className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-4 dark:bg-slate-950">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">Fail</p>
                        <p className="mt-2 text-2xl font-black text-rose-600">{activeRun.stats.fail}</p>
                      </div>
                      <div className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-4 dark:bg-slate-950">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">Blocked</p>
                        <p className="mt-2 text-2xl font-black text-amber-600">{activeRun.stats.blocked}</p>
                      </div>
                      <div className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-4 dark:bg-slate-950">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">Not run</p>
                        <p className="mt-2 text-2xl font-black text-slate-600">{activeRun.stats.notRun}</p>
                      </div>
                    </div>
                    {activeRun.stats.total > 0 ? (
                      <div className="mt-4">
                        <PassRateBar pass={activeRun.stats.pass} fail={activeRun.stats.fail} blocked={activeRun.stats.blocked} total={activeRun.stats.total} />
                        <p className="mt-1 text-right text-[10px] text-(--tc-text-muted,#6b7280)">{activeRun.stats.total} casos total</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {detailTab === "detalhes" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {[
                    { label: "Data", value: formatDate(activeRun.createdAt, language, t) },
                    { label: "Aplicacao", value: activeRun.applicationLabel },
                    { label: "Projeto", value: activeRun.projectCode ?? "-" },
                    { label: "Origem", value: activeRun.sourceLabel },
                    { label: "Responsavel", value: activeRun.responsibleLabel ?? "-" },
                    { label: "Plano", value: activeRun.testPlanName ?? "-" },
                    { label: "Pass rate", value: activeRun.passRate !== null ? `${activeRun.passRate}%` : "-" },
                    { label: "Slug", value: activeRun.slug },
                    { label: "Cliente", value: formatRawValue(activeRun.raw["clientName"]) },
                    { label: "Status bruto", value: formatRawValue(activeRun.raw["status"]) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f8fafc) p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">{item.label}</p>
                      <p className="mt-2 break-words text-sm font-semibold text-(--tc-text,#0b1a3c)">{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {detailTab === "bruto" ? (
                <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#0b1220) p-4">
                  <pre className="max-h-[56vh] overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-100">
                    {JSON.stringify(activeRun.raw, null, 2)}
                  </pre>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-(--tc-border,#e5e7eb) pt-4">
                <p className="text-sm text-(--tc-text-muted,#6b7280)">Clique fora do modal ou pressione Esc para fechar.</p>
                <Link
                  href={companySlug ? `/empresas/${encodeURIComponent(companySlug)}/runs/${encodeURIComponent(activeRun.slug)}` : `/release/${encodeURIComponent(activeRun.slug)}`}
                  className="inline-flex items-center gap-2 rounded-2xl bg-(--tc-accent,#ef0001) px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  <FiExternalLink className="h-4 w-4" />
                  Abrir run
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
