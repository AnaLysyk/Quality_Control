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
  active?: boolean | null;
};

type CompanyListResponse = {
  companies: ReturnType<typeof buildCompanyRows>;
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
};

function mapLocalCompanies(companies: LocalAuthCompany[]): ClientRow[] {
  return companies.map((company) => ({
    id: company.id,
    company_name: (company.company_name ?? company.name ?? "").toString() || null,
    name: (company.name ?? company.company_name ?? "").toString() || null,
    slug: company.slug ?? null,
    logo_url: (company as { logo_url?: string | null }).logo_url ?? null,
    qase_project_code:
      Array.isArray((company as any).integrations)
        ? (((company as any).integrations.find((it: any) => String(it?.type ?? "").toUpperCase() === "QASE")?.config?.projects ?? []) as any[])[0] ?? (company as any).qase_project_code ?? null
        : (company as { qase_project_code?: string | null }).qase_project_code ?? null,
    active: company.active ?? true,
  }));
}

function normalizeClients(items: ClientRow[]) {
  return items
    .filter((item) => typeof item.id === "string" && (item.company_name || item.name))
    .map((item) => ({
      id: item.id,
      name: item.company_name || item.name || "Empresa",
      slug: item.slug ?? null,
      logo_url: item.logo_url ?? null,
      qase_project_code: item.qase_project_code ?? null,
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
    manualSummary: {
      pass: release.stats.pass,
      fail: release.stats.fail,
      blocked: release.stats.blocked,
      notRun: release.stats.notRun,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const periodParam = Number(request.nextUrl.searchParams.get("period") ?? 30);
    const period = [7, 30, 90].includes(periodParam) ? periodParam : 30;
    const { admin, status } = await requireGlobalAdminWithStatus(request);
    if (!admin) {
      const msg = status === 401 ? "Nao autenticado" : "Sem permissao";
      return apiFail(request, msg, { status, code: status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }

    const [localCompanies, releases, manualReleases] = await Promise.all([
      listLocalCompanies(),
      getAllReleases(),
      getAllManualReleases(),
    ]);
    const clientRows = mapLocalCompanies(localCompanies);

    const manualReleaseEntries = manualReleases
      .filter((release) => resolveManualReleaseKind(release) === "run")
      .map(mapManualRelease);
    const enrichedReleases = [...releases, ...manualReleaseEntries].map((release) => buildReleaseWithStats(release));

    const start = Date.now() - period * DAY_MS;
    const periodReleases = enrichedReleases.filter((release) => release.createdAtValue >= start);

    const coverage = {
      total: periodReleases.length,
      withStats: periodReleases.filter((release) => release.stats !== null).length,
      percent:
        periodReleases.length > 0
          ? Math.round((periodReleases.filter((release) => release.stats !== null).length / periodReleases.length) * 100)
          : 0,
    };

    const globalStats: Stats = { pass: 0, fail: 0, blocked: 0, notRun: 0 };
    periodReleases.forEach((release) => {
      if (release.stats) {
        globalStats.pass += release.stats.pass;
        globalStats.fail += release.stats.fail;
        globalStats.blocked += release.stats.blocked;
        globalStats.notRun += release.stats.notRun;
      }
    });

    const globalTotal = sumStats(globalStats);
    const globalPassRate = globalTotal > 0 ? toPercent(globalStats.pass, globalTotal) : null;
    const passRateTone =
      globalPassRate === null
        ? "neutral"
        : globalPassRate >= QUALITY_THRESHOLDS.passRate
          ? "good"
          : "warn";

    const companies = buildCompanyRows(normalizeClients(clientRows), periodReleases);
    const gatePriority: Record<string, number> = { failed: 0, warning: 1, approved: 2, no_data: 3 };
    companies.sort((a, b) => {
      const aRank = gatePriority[a.gate.status] ?? 99;
      const bRank = gatePriority[b.gate.status] ?? 99;
      if (aRank !== bRank) return aRank - bRank;
      return a.name.localeCompare(b.name);
    });

    const releaseGateCounts: Record<string, number> = {
      approved: 0,
      warning: 0,
      failed: 0,
      no_data: 0,
    };
    let releaseRiskCount = 0;
    let releaseWarningCount = 0;
    periodReleases.forEach((release) => {
      const status = release.gate.status;
      releaseGateCounts[status] = (releaseGateCounts[status] ?? 0) + 1;
      if (status === "failed") releaseRiskCount += 1;
      if (status === "warning") releaseWarningCount += 1;
    });

    const gateCounts: Record<string, number> = {
      approved: 0,
      warning: 0,
      failed: 0,
      no_data: 0,
    };
    let riskCount = 0;
    let warningCount = 0;
    companies.forEach((row) => {
      gateCounts[row.gate.status] = (gateCounts[row.gate.status] ?? 0) + 1;
      if (row.gate.status === "failed") {
        riskCount += 1;
      }
      if (row.gate.status === "warning") {
        warningCount += 1;
      }
    });

    const trendPoints = buildTrendPoints(periodReleases, period);
    const trendSummary = computeTrendSummary(periodReleases);

    const response: CompanyListResponse = {
      companies,
      period,
      coverage,
      releaseCount: periodReleases.length,
      releaseGateCounts,
      releaseRiskCount,
      releaseWarningCount,
      globalStats,
      globalPassRate,
      passRateTone,
      gateCounts,
      riskCount,
      warningCount,
      trendPoints,
      trendSummary,
      policy: QUALITY_THRESHOLDS,
    };

    return apiOk(request, response, "OK", { extra: response });
  } catch (error) {
    console.error("GET /api/admin/quality/overview error", error);
    const msg = "Erro ao gerar overview";
    return apiFail(request, msg, { status: 500, code: "INTERNAL", details: error, extra: { error: msg } });
  }
}
