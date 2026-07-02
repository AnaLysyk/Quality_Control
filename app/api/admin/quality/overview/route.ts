import { NextRequest } from "next/server";
import { getAllReleases, type ReleaseEntry } from "@/release/data";
import { getAllManualReleases } from "@/release/manualData";
import type { Release as ManualRelease } from "@/types/release";
import {
  buildCompanyRows,
  buildReleaseWithStats,
  buildTrendPoints,
  computeTrendSummary,
  QUALITY_THRESHOLDS,
  sumStats,
  toPercent,
  TrendSummary,
  TrendPoint,
  Stats,
} from "@/lib/quality";
import { normalizeDefectStatus } from "@/lib/defectNormalization";
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { listLocalCompanies, type LocalAuthCompany } from "@/lib/auth/localStore";

export const revalidate = 0;

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RUN_RISK_FAILURE_RATE = 60;

type ClientRow = {
  id: string;
  company_name?: string | null;
  name?: string | null;
  slug?: string | null;
  logo_url?: string | null;
  qase_project_code?: string | null;
  qase_project_codes?: string[] | null;
  active?: boolean | null;
};

type ProjectRow = {
  id: string;
  name: string;
  releaseCount: number;
  passRate: number | null;
  gateStatus: string;
  latestRelease?: { slug?: string; title?: string; createdAt?: string };
};

type RunRiskItem = {
  slug: string;
  title: string;
  companyName: string | null;
  companySlug: string | null;
  project: string | null;
  createdAt: string | null;
  executorName: string | null;
  passRate: number | null;
  failureRate: number | null;
  fail: number;
  blocked: number;
  total: number;
  status: string | null;
};

type CompanyRunSummary = {
  id: string;
  slug: string | null;
  name: string;
  runCount: number;
  runsAtRisk: number;
  activeDefects: number;
  passRate: number | null;
  averageApprovalTimeMs: number | null;
  averageApprovalTimeLabel: string;
  latestRunAt: string | null;
  latestRunTitle: string | null;
};

type CompanyListResponse = {
  companies: ReturnType<typeof buildCompanyRows>;
  projectRows: ProjectRow[];
  period: number | "all";
  coverage: { total: number; withStats: number; percent: number };
  releaseCount: number;
  runCount: number;
  releaseGateCounts: Record<string, number>;
  releaseRiskCount: number;
  releaseWarningCount: number;
  runsAtRiskCount: number;
  riskFailureThreshold: number;
  runsAtRisk: RunRiskItem[];
  runExecutionsByCompany: CompanyRunSummary[];
  activeDefectCount: number;
  activeDefectStatusCounts: Record<string, number>;
  activeDefectStatuses: string[];
  globalStats: Stats;
  globalPassRate: number | null;
  averageApprovalTimeMs: number | null;
  averageApprovalTimeLabel: string;
  passRateTone: "good" | "warn" | "neutral";
  gateCounts: Record<string, number>;
  riskCount: number;
  warningCount: number;
  trendPoints: TrendPoint[];
  trendSummary: TrendSummary;
  policy: typeof QUALITY_THRESHOLDS & { runRiskFailureRate: number };
  filters?: { company: string | null; project: string | null; gate: string | null; query: string | null };
};

type TelemetryRelease = ReturnType<typeof buildReleaseWithStats> & {
  closedAt?: string | null;
  updatedAt?: string | null;
  createdByName?: string | null;
  assignedToName?: string | null;
  clientSlug?: string | null;
};

function mapLocalCompanies(companies: LocalAuthCompany[]): ClientRow[] {
  return companies.map((company) => {
    let codes: string[] = [];
    if (Array.isArray((company as any).integrations)) {
      const qaseIntegration = (company as any).integrations.find((it: any) => String(it?.type ?? "").toUpperCase() === "QASE");
      const projects = qaseIntegration?.config?.projects;
      if (Array.isArray(projects)) codes = projects.filter(Boolean).map(String);
    }
    if (!codes.length && Array.isArray((company as any).qase_project_codes)) codes = ((company as any).qase_project_codes).filter(Boolean).map(String);
    if (!codes.length && (company as any).qase_project_code) codes = [String((company as any).qase_project_code)];
    return {
      id: company.id,
      company_name: (company.company_name ?? company.name ?? "").toString() || null,
      name: (company.name ?? company.company_name ?? "").toString() || null,
      slug: company.slug ?? null,
      logo_url: (company as { logo_url?: string | null }).logo_url ?? null,
      qase_project_code: codes[0] ?? null,
      qase_project_codes: codes.length ? codes : null,
      active: company.active ?? true,
    };
  });
}

function normalizeClients(items: ClientRow[]) {
  return items.filter((item) => typeof item.id === "string" && (item.company_name || item.name)).map((item) => ({
    id: item.id,
    name: item.company_name || item.name || "Empresa",
    slug: item.slug ?? null,
    logo_url: item.logo_url ?? null,
    qase_project_code: item.qase_project_code ?? null,
    qase_project_codes: item.qase_project_codes ?? null,
    active: item.active ?? false,
  }));
}

function mapManualRelease(release: ManualRelease): ReleaseEntry {
  const app = (release.app ?? "smart").toString();
  const entry: ReleaseEntry = {
    slug: release.slug,
    title: release.name,
    summary: release.observations ?? "Release manual",
    runId: release.runId ?? 0,
    project: app,
    app,
    order: [app],
    source: "MANUAL",
    status: release.status,
    createdAt: release.createdAt,
    clientName: release.clientSlug ?? null,
    manualSummary: release.stats,
  };

  return Object.assign(entry, {
    closedAt: release.closedAt ?? null,
    updatedAt: release.updatedAt ?? null,
    createdByName: release.createdByName ?? null,
    assignedToName: release.assignedToName ?? null,
    clientSlug: release.clientSlug ?? null,
  });
}

function text(value: string | null | undefined) {
  return (value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function param(request: NextRequest, ...names: string[]) {
  for (const name of names) {
    const value = request.nextUrl.searchParams.get(name)?.trim();
    if (value && value !== "all") return value;
  }
  return null;
}

function gateParam(value: string | null) {
  return value === "none" ? "no_data" : value;
}

function periodParam(request: NextRequest): number | "all" {
  const raw = request.nextUrl.searchParams.get("period")?.trim().toLowerCase();
  if (raw === "all" || raw === "todos" || raw === "todas") return "all";
  const parsed = Number(raw ?? 30);
  return [7, 30, 90].includes(parsed) ? parsed : 30;
}

function readPercentParam(request: NextRequest, name: string, fallback: number) {
  const raw = request.nextUrl.searchParams.get(name) ?? process.env.NEXT_PUBLIC_RUN_RISK_FAIL_RATE;
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function matchesProject(release: ReturnType<typeof buildReleaseWithStats>, project: string | null) {
  if (!project) return true;
  const needle = text(project);
  const haystack = text([release.project, release.app, release.qaseProject, release.title, ...(Array.isArray(release.order) ? release.order : [])].filter(Boolean).join(" "));
  return haystack.includes(needle);
}

function uniqueReleases(companies: ReturnType<typeof buildCompanyRows>) {
  const map = new Map<string, ReturnType<typeof buildReleaseWithStats>>();
  companies.forEach((company) => company.releases.forEach((release) => map.set(release.slug || `${release.title}-${release.createdAtValue}`, release)));
  return Array.from(map.values());
}

function sumReleases(releases: ReturnType<typeof buildReleaseWithStats>[]) {
  const stats: Stats = { pass: 0, fail: 0, blocked: 0, notRun: 0 };
  releases.forEach((release) => {
    if (!release.stats) return;
    stats.pass += release.stats.pass;
    stats.fail += release.stats.fail;
    stats.blocked += release.stats.blocked;
    stats.notRun += release.stats.notRun;
  });
  return stats;
}

function projectName(release: ReturnType<typeof buildReleaseWithStats>) {
  return release.project || release.app || release.qaseProject || release.title || "Sem projeto";
}

function buildProjectRows(releases: ReturnType<typeof buildReleaseWithStats>[]): ProjectRow[] {
  const gatePriority: Record<string, number> = { failed: 0, warning: 1, approved: 2, no_data: 3 };
  const rows = new Map<string, ProjectRow>();
  releases.forEach((release) => {
    const name = projectName(release);
    const id = text(name) || "sem-projeto";
    const current = rows.get(id) ?? { id, name, releaseCount: 0, passRate: null, gateStatus: "no_data" };
    current.releaseCount += 1;
    if ((gatePriority[release.gate.status] ?? 99) < (gatePriority[current.gateStatus] ?? 99)) current.gateStatus = release.gate.status;
    if (release.passRate !== null && (current.passRate === null || release.passRate < current.passRate)) current.passRate = release.passRate;
    if (!current.latestRelease || release.createdAtValue >= new Date(current.latestRelease.createdAt ?? "").getTime()) {
      current.latestRelease = { slug: release.slug, title: release.title, createdAt: release.createdAt ?? release.created_at };
    }
    rows.set(id, current);
  });
  return Array.from(rows.values()).sort((a, b) => (gatePriority[a.gateStatus] ?? 99) - (gatePriority[b.gateStatus] ?? 99) || (a.passRate ?? -1) - (b.passRate ?? -1) || a.name.localeCompare(b.name)).slice(0, 12);
}

function totalFromStats(stats?: Stats | null) {
  return stats ? sumStats(stats) : 0;
}

function runFailureRate(release: ReturnType<typeof buildReleaseWithStats>) {
  const total = totalFromStats(release.stats);
  if (!total || !release.stats) return null;
  return toPercent(release.stats.fail + release.stats.blocked, total);
}

function isApprovedRunStatus(status?: string | null) {
  const normalized = text(status).replace(/[\s-]+/g, "_");
  return ["done", "closed", "resolved", "approved", "aprovado", "aprovada", "finalized", "finalizado", "finalizada"].includes(normalized);
}

function parseDateValue(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function resolveRunApprovedAt(release: TelemetryRelease) {
  const closedAt = parseDateValue(release.closedAt);
  if (closedAt !== null) return closedAt;
  if (isApprovedRunStatus(release.status)) return parseDateValue(release.updatedAt ?? release.createdAt ?? release.created_at ?? null);
  return null;
}

function approvalDurations(releases: ReturnType<typeof buildReleaseWithStats>[]) {
  return releases
    .map((release) => {
      const telemetry = release as TelemetryRelease;
      const createdAt = parseDateValue(telemetry.createdAt ?? telemetry.created_at ?? null);
      const approvedAt = resolveRunApprovedAt(telemetry);
      if (createdAt === null || approvedAt === null || approvedAt < createdAt) return null;
      return approvedAt - createdAt;
    })
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatDuration(ms: number | null) {
  if (ms === null) return "--";
  const minutes = Math.max(1, Math.round(ms / (60 * 1000)));
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${Math.round(hours * 10) / 10}h`;
  const days = hours / 24;
  return `${Math.round(days * 10) / 10} dias`;
}

function releaseCompanyKey(release: ReturnType<typeof buildReleaseWithStats>) {
  const telemetry = release as TelemetryRelease;
  return telemetry.clientSlug ?? telemetry.clientName ?? release.clientName ?? null;
}

function releaseExecutor(release: ReturnType<typeof buildReleaseWithStats>) {
  const telemetry = release as TelemetryRelease;
  return telemetry.assignedToName ?? telemetry.createdByName ?? release.assigneeNames?.[0] ?? release.assignees?.[0] ?? null;
}

function buildRunRiskItems(releases: ReturnType<typeof buildReleaseWithStats>[], threshold: number, companyByKey: Map<string, { name: string; slug: string | null }>): RunRiskItem[] {
  return releases
    .map((release): RunRiskItem | null => {
      const failureRate = runFailureRate(release);
      if (failureRate === null || failureRate < threshold) return null;
      const companyKey = releaseCompanyKey(release);
      const company = companyKey ? companyByKey.get(text(companyKey)) ?? null : null;
      const total = totalFromStats(release.stats);
      return {
        slug: release.slug,
        title: release.title,
        companyName: company?.name ?? release.clientName ?? companyKey,
        companySlug: company?.slug ?? null,
        project: projectName(release),
        createdAt: release.createdAt ?? release.created_at ?? null,
        executorName: releaseExecutor(release),
        passRate: release.passRate,
        failureRate,
        fail: release.stats?.fail ?? 0,
        blocked: release.stats?.blocked ?? 0,
        total,
        status: release.status ?? null,
      };
    })
    .filter((item): item is RunRiskItem => Boolean(item))
    .sort((a, b) => (b.failureRate ?? 0) - (a.failureRate ?? 0) || new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 20);
}

function buildCompanyRunSummaries(companies: ReturnType<typeof buildCompanyRows>, activeDefectsByCompany: Map<string, number>, threshold: number): CompanyRunSummary[] {
  return companies
    .map((company) => {
      const durations = approvalDurations(company.releases);
      const averageApprovalTimeMs = average(durations);
      const runsAtRisk = company.releases.filter((release) => (runFailureRate(release) ?? -1) >= threshold).length;
      const slugKey = text(company.slug ?? company.id);
      const nameKey = text(company.name);
      return {
        id: company.id,
        slug: company.slug ?? null,
        name: company.name,
        runCount: company.releases.length,
        runsAtRisk,
        activeDefects: activeDefectsByCompany.get(slugKey) ?? activeDefectsByCompany.get(nameKey) ?? 0,
        passRate: company.passRate,
        averageApprovalTimeMs,
        averageApprovalTimeLabel: formatDuration(averageApprovalTimeMs),
        latestRunAt: company.latestRelease?.createdAt ?? null,
        latestRunTitle: company.latestRelease?.title ?? null,
      };
    })
    .sort((a, b) => b.runsAtRisk - a.runsAtRisk || b.runCount - a.runCount || a.name.localeCompare(b.name));
}

function activeDefectsFromManualReleases(releases: ManualRelease[], companyFilter: string | null) {
  return releases
    .filter((release) => resolveManualReleaseKind(release) === "defect")
    .map((release) => ({ release, status: normalizeDefectStatus(release.status) }))
    .filter(({ status }) => status !== "done")
    .filter(({ release }) => !companyFilter || release.clientSlug === companyFilter);
}

function buildActiveDefectCounters(defects: ReturnType<typeof activeDefectsFromManualReleases>) {
  const statusCounts: Record<string, number> = {};
  const byCompany = new Map<string, number>();
  defects.forEach(({ release, status }) => {
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    const keys = [release.clientSlug, release.clientSlug ? text(release.clientSlug) : null].filter(Boolean) as string[];
    keys.forEach((key) => byCompany.set(key, (byCompany.get(key) ?? 0) + 1));
  });
  return { statusCounts, byCompany };
}

export async function GET(request: NextRequest) {
  try {
    const period = periodParam(request);
    const riskFailureThreshold = readPercentParam(request, "riskFailRate", DEFAULT_RUN_RISK_FAILURE_RATE);
    const filters = {
      company: param(request, "companyId", "company", "companySlug"),
      project: param(request, "project", "projectId", "app"),
      gate: gateParam(param(request, "gate", "status")),
      query: param(request, "q", "query", "search"),
    };
    const scopedByCompany = Boolean(filters.company || filters.gate || filters.query);
    const { admin, status } = await requireGlobalAdminWithStatus(request);
    if (!admin) {
      const msg = status === 401 ? "Não autenticado" : "Sem permissão";
      return apiFail(request, msg, { status, code: status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }

    const [localCompanies, releases, manualReleases] = await Promise.all([listLocalCompanies(), getAllReleases(), getAllManualReleases()]);
    const manualRunEntries = manualReleases.filter((release) => resolveManualReleaseKind(release) === "run").map(mapManualRelease);
    const enrichedReleases = [...releases, ...manualRunEntries].map((release) => buildReleaseWithStats(release));
    const start = period === "all" ? 0 : Date.now() - period * DAY_MS;
    const periodReleases = enrichedReleases.filter((release) => release.createdAtValue >= start && matchesProject(release, filters.project));

    let companies = buildCompanyRows(normalizeClients(mapLocalCompanies(localCompanies)), periodReleases).filter((company) => {
      if (filters.company && company.id !== filters.company && company.slug !== filters.company) return false;
      if (filters.gate && company.gate.status !== filters.gate) return false;
      if (!filters.query) return true;
      return text(`${company.name} ${company.slug ?? ""} ${company.gate.status} ${company.latestRelease?.title ?? ""}`).includes(text(filters.query));
    });
    const gatePriority: Record<string, number> = { failed: 0, warning: 1, approved: 2, no_data: 3 };
    companies = companies.sort((a, b) => (gatePriority[a.gate.status] ?? 99) - (gatePriority[b.gate.status] ?? 99) || a.name.localeCompare(b.name));

    const scopedReleases = scopedByCompany ? uniqueReleases(companies) : periodReleases;
    const projectRows = buildProjectRows(scopedReleases);
    const companiesWithStats = companies.filter((company) => company.releases.some((release) => release.stats !== null)).length;
    const coverage = { total: companies.length, withStats: companiesWithStats, percent: companies.length ? Math.round((companiesWithStats / companies.length) * 100) : 0 };
    const globalStats = sumReleases(scopedReleases);
    const globalTotal = sumStats(globalStats);
    const globalPassRate = globalTotal > 0 ? toPercent(globalStats.pass, globalTotal) : null;
    const approvalAverageMs = average(approvalDurations(scopedReleases));
    const passRateTone = globalPassRate === null ? "neutral" : globalPassRate >= QUALITY_THRESHOLDS.passRate ? "good" : "warn";

    const companyByKey = new Map<string, { name: string; slug: string | null }>();
    companies.forEach((company) => {
      companyByKey.set(text(company.id), { name: company.name, slug: company.slug ?? null });
      if (company.slug) companyByKey.set(text(company.slug), { name: company.name, slug: company.slug });
      companyByKey.set(text(company.name), { name: company.name, slug: company.slug ?? null });
    });

    const activeDefects = activeDefectsFromManualReleases(manualReleases, filters.company);
    const { statusCounts: activeDefectStatusCounts, byCompany: activeDefectsByCompany } = buildActiveDefectCounters(activeDefects);

    const releaseGateCounts: Record<string, number> = { approved: 0, warning: 0, failed: 0, no_data: 0 };
    let releaseWarningCount = 0;
    scopedReleases.forEach((release) => {
      const status = release.gate.status;
      releaseGateCounts[status] = (releaseGateCounts[status] ?? 0) + 1;
      if (status === "warning") releaseWarningCount += 1;
    });

    const runsAtRisk = buildRunRiskItems(scopedReleases, riskFailureThreshold, companyByKey);

    const gateCounts: Record<string, number> = { approved: 0, warning: 0, failed: 0, no_data: 0 };
    let riskCount = 0;
    let warningCount = 0;
    companies.forEach((row) => {
      gateCounts[row.gate.status] = (gateCounts[row.gate.status] ?? 0) + 1;
      if (row.gate.status === "failed") riskCount += 1;
      if (row.gate.status === "warning") warningCount += 1;
    });

    const response: CompanyListResponse = {
      companies,
      projectRows,
      period,
      coverage,
      releaseCount: scopedReleases.length,
      runCount: scopedReleases.length,
      releaseGateCounts,
      releaseRiskCount: runsAtRisk.length,
      releaseWarningCount,
      runsAtRiskCount: runsAtRisk.length,
      riskFailureThreshold,
      runsAtRisk,
      runExecutionsByCompany: buildCompanyRunSummaries(companies, activeDefectsByCompany, riskFailureThreshold),
      activeDefectCount: activeDefects.length,
      activeDefectStatusCounts,
      activeDefectStatuses: Object.keys(activeDefectStatusCounts),
      globalStats,
      globalPassRate,
      averageApprovalTimeMs: approvalAverageMs,
      averageApprovalTimeLabel: formatDuration(approvalAverageMs),
      passRateTone,
      gateCounts,
      riskCount,
      warningCount,
      trendPoints: buildTrendPoints(scopedReleases, period === "all" ? 90 : period),
      trendSummary: computeTrendSummary(scopedReleases),
      policy: { ...QUALITY_THRESHOLDS, runRiskFailureRate: riskFailureThreshold },
      filters,
    };

    return apiOk(request, response, "OK", { extra: response });
  } catch (error) {
    console.error("GET /api/admin/quality/overview error", error);
    const msg = "Erro ao gerar overview";
    return apiFail(request, msg, { status: 500, code: "INTERNAL", details: error, extra: { error: msg } });
  }
}

