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
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { listLocalCompanies, type LocalAuthCompany } from "@/lib/auth/localStore";

export const revalidate = 0;

const DAY_MS = 24 * 60 * 60 * 1000;

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

type CompanyListResponse = {
  companies: ReturnType<typeof buildCompanyRows>;
  projectRows: ProjectRow[];
  period: number;
  coverage: { total: number; withStats: number; percent: number };
  releaseCount: number;
  releaseGateCounts: Record<string, number>;
  releaseRiskCount: number;
  releaseWarningCount: number;
  globalStats: Stats;
  globalPassRate: number | null;
  passRateTone: "good" | "warn" | "neutral";
  gateCounts: Record<string, number>;
  riskCount: number;
  warningCount: number;
  trendPoints: TrendPoint[];
  trendSummary: TrendSummary;
  policy: typeof QUALITY_THRESHOLDS;
  filters?: { company: string | null; project: string | null; gate: string | null; query: string | null };
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
  return {
    slug: release.slug,
    title: release.name,
    summary: release.observations ?? "Release manual",
    runId: release.runId ?? 0,
    project: app,
    app,
    order: [app],
    source: "MANUAL",
    createdAt: release.createdAt,
    clientName: release.clientSlug ?? null,
    manualSummary: release.stats,
  };
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

export async function GET(request: NextRequest) {
  try {
    const periodParam = Number(request.nextUrl.searchParams.get("period") ?? 30);
    const period = [7, 30, 90].includes(periodParam) ? periodParam : 30;
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
    const manualReleaseEntries = manualReleases.filter((release) => resolveManualReleaseKind(release) === "run").map(mapManualRelease);
    const enrichedReleases = [...releases, ...manualReleaseEntries].map((release) => buildReleaseWithStats(release));
    const start = Date.now() - period * DAY_MS;
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
    const passRateTone = globalPassRate === null ? "neutral" : globalPassRate >= QUALITY_THRESHOLDS.passRate ? "good" : "warn";

    const releaseGateCounts: Record<string, number> = { approved: 0, warning: 0, failed: 0, no_data: 0 };
    let releaseRiskCount = 0;
    let releaseWarningCount = 0;
    scopedReleases.forEach((release) => {
      const status = release.gate.status;
      releaseGateCounts[status] = (releaseGateCounts[status] ?? 0) + 1;
      if (status === "failed") releaseRiskCount += 1;
      if (status === "warning") releaseWarningCount += 1;
    });

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
      releaseGateCounts,
      releaseRiskCount,
      releaseWarningCount,
      globalStats,
      globalPassRate,
      passRateTone,
      gateCounts,
      riskCount,
      warningCount,
      trendPoints: buildTrendPoints(scopedReleases, period),
      trendSummary: computeTrendSummary(scopedReleases),
      policy: QUALITY_THRESHOLDS,
      filters,
    };

    return apiOk(request, response, "OK", { extra: response });
  } catch (error) {
    console.error("GET /api/admin/quality/overview error", error);
    const msg = "Erro ao gerar overview";
    return apiFail(request, msg, { status: 500, code: "INTERNAL", details: error, extra: { error: msg } });
  }
}
