import { NextRequest } from "next/server";
import { getAllReleases } from "@/release/data";
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
import { apiFail, apiOk } from "@/lib/apiResponse";

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

async function fetchClients(baseUrl: string, request: NextRequest): Promise<ClientRow[]> {
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);

  const res = await fetch(new URL("/api/clients", baseUrl).toString(), {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("failed to load clients");
  }

  const payload = await res.json();
  const items: ClientRow[] = Array.isArray(payload.items) ? payload.items : [];
  return items;
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

export async function GET(request: NextRequest) {
  try {
    const periodParam = Number(request.nextUrl.searchParams.get("period") ?? 30);
    const period = [7, 30, 90].includes(periodParam) ? periodParam : 30;
    const baseUrl = new URL(request.url).origin;

    const [clientRows, releases] = await Promise.all([fetchClients(baseUrl, request), getAllReleases()]);

    const enrichedReleases = releases.map((release) => buildReleaseWithStats(release));

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
