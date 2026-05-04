"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CreateManualReleaseButton } from "@/components/CreateManualReleaseButton";
import { useI18n } from "@/hooks/useI18n";
import { fetchApi } from "@/lib/api";
import { formatRunTitle } from "@/lib/runPresentation";
import { FiSearch, FiCalendar, FiChevronLeft, FiChevronRight, FiActivity, FiLayers, FiGrid } from "react-icons/fi";

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
};

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
  const seeds = [
    companySlug,
    ...applications.flatMap((application) => [application.slug, application.name, application.qaseProjectCode]),
  ];
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
  // Qase numeric statuses: 0=active, 1=complete, 2=abort
  if (["1", "done", "closed", "finalized", "finalizada"].includes(normalized)) return t("runsPage.statusCompleted");
  if (["0", "running", "in_progress", "em_andamento", "open", "active", "aberta"].includes(normalized)) return t("runsPage.statusInProgress");
  if (["blocked", "bloqueada"].includes(normalized)) return t("runsPage.statusBlocked");
  if (["2", "abort", "aborted", "failed", "fail", "erro", "error", "falha", "violated"].includes(normalized)) return t("runsPage.statusAtRisk");
  if (["draft", "saved", "pending", "pendente"].includes(normalized)) return t("runsPage.statusPending");
  return value ?? t("runsPage.noStatus");
}

function computeStats(input: RunStatsInput | null | undefined): RunStats {
  // Qase stats.statuses is a map like { "passed": 5, "failed": 2, ... }
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
  const joined = [
    run.source,
    run.summary,
    run.title,
    run.app,
    run.project,
    run.qaseProject,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (joined.includes("jira")) return t("runsPage.providerJira");
  if (run.qaseProject || joined.includes("qase")) return t("runsPage.providerQase");
  return null;
}

function normalizeManualRuns(data: unknown[], t: (key: string, params?: Record<string, string | number>) => string): UnifiedRun[] {
  return data.reduce<UnifiedRun[]>((accumulator, item) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const slug = String(rec.slug ?? rec.id ?? "");
    if (!slug) return accumulator;

    const testPlanSource =
      rec.testPlanSource === "qase" || rec.testPlanSource === "manual"
        ? rec.testPlanSource
        : null;
    const testPlanId =
      typeof rec.testPlanId === "string" && rec.testPlanId.trim() ? rec.testPlanId.trim() : null;
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
      createdAt: typeof rec.createdAt === "string" ? rec.createdAt : typeof rec.created_at === "string" ? rec.created_at : null,
      statusLabel: resolveStatusLabel(typeof rec.status === "string" ? rec.status : null, t),
      sourceType: "manual",
      sourceLabel: t("runsPage.manualSource"),
      providerLabel: null,
      applicationLabel: String(rec.app ?? rec.qaseProject ?? t("runsPage.manualAppFallback")),
      projectCode: normalizeProjectCode(rec.qaseProject ?? rec.app),
      summary: t("runsPage.manualSummary", {
        pass: stats.pass,
        fail: stats.fail,
        blocked: stats.blocked,
        notRun: stats.notRun,
      }),
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
      summary: typeof rec.summary === "string" ? rec.summary : null,
      status: typeof rec.status === "string" ? rec.status : typeof rec.status === "number" ? String(rec.status) : null,
      app: typeof rec.app === "string" ? rec.app : null,
      project: typeof rec.project === "string" ? rec.project : null,
      qaseProject: typeof rec.qaseProject === "string" ? rec.qaseProject : null,
      source: typeof rec.source === "string" ? rec.source : null,
      createdAt: typeof rec.createdAt === "string" ? rec.createdAt : typeof rec.created_at === "string" ? rec.created_at : typeof rec.start_time === "string" ? rec.start_time : null,
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
        rec.plan_id !== undefined || rec.planId !== undefined || rec.plan_name !== undefined || rec.planName !== undefined
          ? "qase"
          : null,
      testPlanProjectCode:
        typeof rec.planProjectCode === "string" && rec.planProjectCode.trim()
          ? rec.planProjectCode.trim().toUpperCase()
          : null,
    });

    return accumulator;
  }, []);
}

function toUnifiedIntegratedRuns(
  data: IntegratedRun[],
  t: (key: string, params?: Record<string, string | number>) => string,
): UnifiedRun[] {
  return data
    .map((run) => {
      const stats = computeStats(run.manualSummary ?? run.metrics ?? run.stats);
      const providerLabel = resolveProvider(run, t);
      const applicationLabel =
        String(run.app ?? run.project ?? run.qaseProject ?? providerLabel ?? t("runsPage.integratedFallback")).trim() ||
        t("runsPage.integratedFallback");
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
        createdAt: run.createdAt,
        statusLabel: resolveStatusLabel(run.statusText ?? run.status, t),
        sourceType: "integrated",
        sourceLabel: t("runsPage.integratedSource"),
        providerLabel,
        applicationLabel,
        projectCode: normalizeProjectCode(run.qaseProject ?? run.project ?? run.app),
        summary:
          run.summary?.trim() ||
          (stats.total > 0
            ? t("runsPage.integratedSummaryWithTelemetry", { total: stats.total })
            : t("runsPage.integratedSummaryNoTelemetry")),
        responsibleLabel,
        passRate: computePassRate(stats),
        stats,
        testPlanName:
          run.testPlanName?.trim() ||
          (run.testPlanId ? t("runsPage.planFallback", { id: run.testPlanId }) : null),
        testPlanSource: run.testPlanSource,
        testPlanProjectCode: run.testPlanProjectCode || normalizeProjectCode(run.qaseProject ?? run.project ?? run.app),
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
  const l = label.toLowerCase();
  if (["concluída", "completed"].some((s) => l.includes(s))) return "bg-emerald-500/20 text-emerald-800 border-emerald-500/40";
  if (["andamento", "progress"].some((s) => l.includes(s))) return "bg-blue-500/20 text-blue-800 border-blue-500/40";
  if (["risco", "risk", "falha", "fail"].some((s) => l.includes(s))) return "bg-rose-500/20 text-rose-800 border-rose-500/40";
  if (["bloqueada", "blocked"].some((s) => l.includes(s))) return "bg-amber-500/20 text-amber-800 border-amber-500/40";
  if (["pendente", "pending", "draft"].some((s) => l.includes(s))) return "bg-slate-500/20 text-slate-800 border-slate-500/40";
  return "bg-slate-500/20 text-slate-800 border-slate-500/40";
}

export default function CompanyRunsPage() {
  const { t, language } = useI18n();
  const params = useParams();
  const router = useRouter();
  const slugParam = params?.slug;
  const companySlug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const [runs, setRuns] = useState<UnifiedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reloadToken, setReloadToken] = useState(0);
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const currentCompanySlug = companySlug ?? "";
    if (!currentCompanySlug) return;

    let active = true;

    async function loadRuns() {
      setLoading(true);
      setError(null);
      try {
        // Build server-side time range params for Qase API
        let timeParams = "";
        if (dateFrom) {
          const fromTs = Math.floor(new Date(dateFrom + "T00:00:00").getTime() / 1000);
          if (fromTs > 0) timeParams += `&from_start_time=${encodeURIComponent(String(fromTs))}`;
        }
        if (dateTo) {
          const toTs = Math.floor(new Date(dateTo + "T23:59:59").getTime() / 1000);
          if (toTs > 0) timeParams += `&to_start_time=${encodeURIComponent(String(toTs))}`;
        }

        // Fetch scoped sources in parallel first — fallbacks are lazy
        const [manualScopedResult, integratedScopedResult, applicationsResult, releasesAllResult] = await Promise.allSettled([
          fetchApi(`/api/releases-manual?clientSlug=${encodeURIComponent(currentCompanySlug)}&kind=run`)
            .then((r) => {
              if (!r.ok) console.warn("[runs] manual API status", r.status);
              return r.json();
            })
            .catch((err) => { console.warn("[runs] manual fetch error", err); return []; }),
          fetchApi(
            `/api/v1/runs?all=true&limit=${encodeURIComponent(String(200))}&companySlug=${encodeURIComponent(currentCompanySlug)}${timeParams}`,
          )
            .then((r) => {
              if (!r.ok) console.warn("[runs] integrated API status", r.status);
              return r.json();
            })
            .catch((err) => { console.warn("[runs] integrated fetch error", err); return {}; }),
          fetchApi(`/api/applications?companySlug=${encodeURIComponent(currentCompanySlug)}`)
            .then((r) => r.json())
            .catch(() => ({})),
          fetchApi(`/api/releases`)
            .then((r) => r.json())
            .catch(() => ({})),
        ]);

        const manualScopedData = manualScopedResult.status === "fulfilled" ? manualScopedResult.value : [];
        const integratedScopedData = integratedScopedResult.status === "fulfilled" ? integratedScopedResult.value : {};
        const applicationsData = applicationsResult.status === "fulfilled" ? applicationsResult.value : {};
        const releasesAllData = releasesAllResult.status === "fulfilled" ? releasesAllResult.value : {};

        const applications = Array.isArray(applicationsData?.items)
          ? (applicationsData.items as ApplicationItem[])
          : [];
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
            return ((record.result as Record<string, unknown>).entities as unknown[]);
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

        // Manual: only fetch all-runs fallback when the scoped call returned nothing
        const manualScopedArray = toArrayPayload(manualScopedData);
        let manualArray: unknown[] = manualScopedArray;
        if (manualScopedArray.length === 0) {
          const manualAllData = await fetchApi(`/api/releases-manual?kind=run`)
            .then((r) => r.json())
            .catch(() => []);
          const manualAllArray = toArrayPayload(manualAllData);
          manualArray = manualAllArray.filter((item) => {
            const record = (item ?? {}) as Record<string, unknown>;
            const clientSlugKey = normalizeKey(record.clientSlug);
            if (clientSlugKey && clientSlugKey === companyKey) return true;
            const appKey = normalizeKey(record.app);
            const qaseProjectKey = normalizeKey(record.qaseProject);
            return applicationKeys.has(appKey) || applicationKeys.has(qaseProjectKey);
          });
        }

        // Integrated: only fetch all-runs fallback when the scoped call returned nothing
        let integratedEntities: unknown[] = toIntegratedEntities(integratedScopedData);
        if (integratedEntities.length === 0) {
          const integratedAllData = await fetchApi(`/api/v1/runs?all=true&limit=${encodeURIComponent(String(200))}${timeParams}`)
            .then((r) => r.json())
            .catch(() => ({}));
          integratedEntities = toIntegratedEntities(integratedAllData).filter(matchesIntegratedContext);
        }

        // Merge releases-store entries (from /api/releases)
        const releasesEntries: unknown[] = Array.isArray(releasesAllData?.releases)
          ? releasesAllData.releases.filter(matchesIntegratedContext)
          : [];
        if (releasesEntries.length > 0) {
          const existingSlugs = new Set(
            integratedEntities.map((e) => String((e as Record<string, unknown>)?.slug ?? "")).filter(Boolean),
          );
          const newEntries = releasesEntries.filter(
            (e) => !existingSlugs.has(String((e as Record<string, unknown>)?.slug ?? "")),
          );
          integratedEntities = [...integratedEntities, ...newEntries];
        }

        const manualRuns = normalizeManualRuns(manualArray, t);
        const integratedRuns = toUnifiedIntegratedRuns(normalizeIntegratedRuns(integratedEntities), t);

        if (!active) return;
        setRuns(
          [...manualRuns, ...integratedRuns].sort(
            (left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt),
          ),
        );
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
  }, [companySlug, reloadToken, t, dateFrom, dateTo]);

  const filteredRuns = useMemo(() => {
    let result = runs;

    if (applicationFilter !== "all") {
      result = result.filter((run) => run.applicationLabel === applicationFilter);
    }

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
  }, [runs, search, applicationFilter, dateFrom, dateTo]);

  const applicationOptions = useMemo(
    () => Array.from(new Set(runs.map((run) => run.applicationLabel).filter((label) => label.trim().length > 0))).sort((a, b) => a.localeCompare(b)),
    [runs],
  );

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRuns.length / pageSize)), [filteredRuns.length, pageSize]);

  useEffect(() => {
    // Reset to first page when filtering or page size changes
    setPage(1);
  }, [search, pageSize, applicationFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (applicationFilter === "all") return;
    if (!applicationOptions.includes(applicationFilter)) {
      setApplicationFilter("all");
    }
  }, [applicationFilter, applicationOptions]);

  const pagedRuns = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRuns.slice(start, start + pageSize);
  }, [filteredRuns, page, pageSize]);

  const totals = useMemo(
    () => ({
      total: runs.length,
      manual: runs.filter((run) => run.sourceType === "manual").length,
      integrated: runs.filter((run) => run.sourceType === "integrated").length,
    }),
    [runs],
  );

  return (
    <div className="w-full space-y-4 py-4 sm:py-6" data-testid="runs-page">
        {/* â”€â”€ Header â”€â”€ */}
        <header className="rounded-[28px] border border-(--tc-border,#e5e7eb) bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-(--tc-accent,#ef0001)">{t("runsPage.kicker")}</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-(--tc-text,#0b1a3c)">{t("runsPage.title")}</h1>
              <p className="mt-1 max-w-xl text-sm text-(--tc-text-muted,#6b7280)">{t("runsPage.subtitle")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: t("runsPage.totalLabel"), value: totals.total, icon: <FiGrid className="h-3 w-3" /> },
                { label: t("runsPage.manualLabel"), value: totals.manual, icon: <FiLayers className="h-3 w-3" /> },
                { label: t("runsPage.integratedLabel"), value: totals.integrated, icon: <FiActivity className="h-3 w-3" /> },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-2 rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-(--tc-text,#0b1a3c)">
                  {m.icon}
                  <span>{m.value}</span>
                  <span className="font-semibold text-(--tc-text-muted,#6b7280)">{m.label}</span>
                </div>
              ))}
              <CreateManualReleaseButton companySlug={companySlug} manualOnly onCreated={() => setReloadToken((c) => c + 1)} />
            </div>
          </div>

          {error ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
          ) : null}

        </header>
        {/* â”€â”€ Runs list â”€â”€ */}
        <div className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm sm:p-5" data-testid="runs-list">
          {/* Filters */}
          <div className="flex flex-col gap-3 pb-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <FiSearch className="h-4 w-4" />
              </span>
              <input
                data-testid="runs-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("runsPage.searchPlaceholder")}
                className="w-full rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) py-2.5 pr-4 pl-10 text-sm font-medium text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
              />
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <select
                id="runs-application-filter"
                aria-label="Filtrar por aplicação"
                value={applicationFilter}
                onChange={(e) => setApplicationFilter(e.target.value)}
                className="flex-1 rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) px-4 py-2.5 text-sm font-medium text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
              >
                <option value="all">{t("runsPage.allApplications")}</option>
                {applicationOptions.map((application) => (
                  <option key={application} value={application}>
                    {application}
                  </option>
                ))}
              </select>
              <input
                id="runs-date-from"
                aria-label="Data início"
                title="De"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) px-4 py-2.5 text-sm font-medium text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
              />
              <span className="text-sm font-semibold text-(--tc-text-muted,#6b7280)">{t("runsPage.dateRangeTo")}</span>
              <input
                id="runs-date-to"
                aria-label="Data fim"
                title="Até"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) px-4 py-2.5 text-sm font-medium text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
              />
              {(applicationFilter !== "all" || dateFrom || dateTo) ? (
                <button
                  type="button"
                  onClick={() => {
                    setApplicationFilter("all");
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="rounded-full border border-(--tc-border,#e5e7eb) px-4 py-2.5 text-sm font-bold uppercase tracking-[0.12em] text-(--tc-text-muted,#6b7280) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-text,#0b1a3c)"
                >
                  {t("runsPage.clearFilters")}
                </button>
              ) : null}
              <select
                id="runs-page-size"
                aria-label={t("runsPage.pageSizeAria")}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) || 10)}
                className="ml-auto rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) px-4 py-2 text-sm font-medium outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Runs */}
          <div className="space-y-2 border-t border-(--tc-border,#e5e7eb) pt-3">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-(--tc-accent,#ef0001)" />
              </div>
            ) : filteredRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                  <FiLayers className="h-7 w-7 text-slate-400" />
                </div>
                <p className="mt-4 text-sm font-medium text-(--tc-text-muted,#6b7280)">{t("runsPage.empty")}</p>
              </div>
            ) : (
              pagedRuns.map((run) => {
                const prColor = passRateColor(run.passRate);
                const runHref = companySlug
                  ? `./runs/${encodeURIComponent(run.slug)}`
                  : `/release/${encodeURIComponent(run.slug)}`;

                return (
                  <div
                    key={run.key}
                    onClick={() => router.push(runHref)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(runHref); } }}
                    className="group relative cursor-pointer overflow-hidden rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) p-5 shadow-sm transition hover:border-(--tc-accent,#ef0001)/30 hover:shadow-md"
                  >
                    {/* Pass rate left accent */}
                    <div className={`absolute left-0 top-0 h-full w-1 ${prColor.bg} transition-all group-hover:w-1.5`} />

                    <div className="flex flex-col gap-4 pl-4 md:flex-row md:items-center">
                      {/* Left: Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={runHref}
                            onClick={(e) => e.stopPropagation()}
                            className="text-lg font-bold text-(--tc-text,#0b1a3c) transition group-hover:text-(--tc-accent,#ef0001)"
                          >
                            {run.name}
                          </Link>
                          <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusColor(run.statusLabel)}`}>
                            {run.statusLabel}
                          </span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                            run.sourceType === "integrated"
                              ? "border-emerald-600/30 bg-emerald-100 text-emerald-800"
                              : "border-blue-600/30 bg-blue-100 text-blue-800"
                          }`}>
                            {run.sourceLabel}
                          </span>
                          {run.providerLabel ? (
                            <span className="rounded-full border border-violet-600/30 bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-800">
                              {run.providerLabel}
                            </span>
                          ) : null}
                          {run.projectCode ? (
                            <span className="rounded-full border border-slate-300 bg-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-800">
                              {run.projectCode}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-sm text-(--tc-text-muted,#6b7280)">
                          <span className="font-semibold text-(--tc-text,#0b1a3c)">{run.applicationLabel}</span>
                          {run.testPlanName ? (
                            <span className="flex items-center gap-1 rounded-full border border-indigo-600/30 bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800">
                              {run.testPlanName}
                            </span>
                          ) : null}
                          {run.responsibleLabel ? (
                            <span>· {run.responsibleLabel}</span>
                          ) : null}
                          <span className="flex items-center gap-1">
                            <FiCalendar className="h-3.5 w-3.5" />
                            {formatDate(run.createdAt, language, t)}
                          </span>
                        </div>
                      </div>

                      {/* Right: Stats */}
                      <div className="flex shrink-0 items-center gap-4">
                        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                          {([
                            { label: t("runsPage.statsPass"), value: run.stats.pass, color: "text-emerald-600" },
                            { label: t("runsPage.statsFail"), value: run.stats.fail, color: "text-rose-600" },
                            { label: t("runsPage.statsBlocked"), value: run.stats.blocked, color: "text-amber-600" },
                            { label: t("runsPage.statsNotRun"), value: run.stats.notRun, color: "text-slate-500" },
                          ]).map((s) => (
                            <div key={s.label} className="min-w-14">
                              <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-(--tc-text-muted,#6b7280)">{s.label}</div>
                            </div>
                          ))}
                        </div>

                        {/* Pass rate ring */}
                        <div className="flex flex-col items-center">
                          <div className="relative flex h-16 w-16 items-center justify-center">
                            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-200" />
                              <circle
                                cx="32"
                                cy="32"
                                r="28"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="5"
                                strokeLinecap="round"
                                strokeDasharray={`${((run.passRate ?? 0) / 100) * 175.9} 175.9`}
                                className={prColor.text}
                              />
                            </svg>
                            <span className={`absolute text-sm font-black ${prColor.text}`}>
                              {run.passRate !== null ? `${run.passRate}%` : "—"}
                            </span>
                          </div>
                          <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-(--tc-text-muted,#6b7280)">
                            {t("runsPage.statsPassRate")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {!loading && filteredRuns.length > 0 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label={t("runsPage.prevPage")}
                title={t("runsPage.prevPage")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) text-sm transition hover:border-(--tc-accent,#ef0001) disabled:opacity-40"
              >
                <FiChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-24 text-center text-sm font-medium text-(--tc-text-muted,#6b7280)">
                {t("runsPage.pageLabel", { page, totalPages })}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label={t("runsPage.nextPage")}
                title={t("runsPage.nextPage")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) text-sm transition hover:border-(--tc-accent,#ef0001) disabled:opacity-40"
              >
                <FiChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

    </div>
  );
}
