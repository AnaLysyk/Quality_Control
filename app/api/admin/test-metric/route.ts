import { NextRequest } from "next/server";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { listLocalCompanies, type LocalAuthCompany } from "@/lib/auth/localStore";
import { getAllReleases, type ReleaseEntry } from "@/release/data";
import { getAllManualReleases } from "@/release/manualData";
import type { Release as ManualRelease } from "@/types/release";
import { buildCompanyRows, buildReleaseWithStats, sumStats, toPercent, type Stats } from "@/lib/quality";
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_OPTIONS = new Set([7, 30, 90]);

type ClientRow = {
  id: string;
  company_name?: string | null;
  name?: string | null;
  slug?: string | null;
  logo_url?: string | null;
  qase_project_code?: string | null;
  active?: boolean | null;
};

function mapLocalCompanies(companies: LocalAuthCompany[]): ClientRow[] {
  return companies.map((company) => ({
    id: company.id,
    company_name: (company.company_name ?? company.name ?? "").toString() || null,
    name: (company.name ?? company.company_name ?? "").toString() || null,
    slug: company.slug ?? null,
    logo_url: (company as { logo_url?: string | null }).logo_url ?? null,
    qase_project_code: (company as { qase_project_code?: string | null }).qase_project_code ?? null,
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
      pass: release.stats?.pass ?? 0,
      fail: release.stats?.fail ?? 0,
      blocked: release.stats?.blocked ?? 0,
      notRun: release.stats?.notRun ?? 0,
    },
  };
}

export async function GET(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    const legacy = { error: status === 401 ? "Nao autenticado" : "Sem permissao" };
    return apiFail(req, legacy.error, {
      status,
      code: status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
      extra: legacy,
    });
  }
  try {
    const periodParam = Number(req.nextUrl.searchParams.get("period") ?? 30);
    const period = PERIOD_OPTIONS.has(periodParam) ? periodParam : 30;
    const start = Date.now() - period * DAY_MS;

    const [localCompanies, releases, manualReleases] = await Promise.all([
      listLocalCompanies(),
      getAllReleases(),
      getAllManualReleases(),
    ]);

    const clientRows = mapLocalCompanies(localCompanies);
    const manualReleaseEntries = manualReleases
      .filter((release) => resolveManualReleaseKind(release) === "run")
      .map(mapManualRelease);

    const mergedReleases = [...releases, ...manualReleaseEntries]
      .map((release) => buildReleaseWithStats(release))
      .filter((release) => Number.isFinite(release.createdAtValue) && release.createdAtValue >= start);

    let releasesWithStats = 0;
    const globalStats: Stats = { pass: 0, fail: 0, blocked: 0, notRun: 0 };
    for (const release of mergedReleases) {
      if (!release.stats) continue;
      releasesWithStats += 1;
      globalStats.pass += release.stats.pass ?? 0;
      globalStats.fail += release.stats.fail ?? 0;
      globalStats.blocked += release.stats.blocked ?? 0;
      globalStats.notRun += release.stats.notRun ?? 0;
    }

    const coverage = {
      total: mergedReleases.length,
      withStats: releasesWithStats,
      percent: mergedReleases.length ? Math.round((releasesWithStats / mergedReleases.length) * 100) : 0,
    };

    const totalStats = sumStats(globalStats);
    const globalPassRate = totalStats > 0 ? toPercent(globalStats.pass, totalStats) : null;

    const companies = buildCompanyRows(normalizeClients(clientRows), mergedReleases);

    const gateCounts = {
      approved: 0,
      warning: 0,
      failed: 0,
      no_data: 0,
    };

    for (const row of companies) {
      gateCounts[row.gate.status] = (gateCounts[row.gate.status] ?? 0) + 1;
    }

    const mapped = companies.map((company) => ({
      id: company.id,
      name: company.name ?? "Empresa",
      slug: company.slug ?? null,
      status: company.active === false ? "inativo" : "ativo",
      releases: company.releases?.length ?? 0,
      approval: company.gate.status,
      passRate: company.passRate,
      stats: company.stats,
      latestRelease: company.latestRelease ?? null,
    }));

    const payload = {
      totals: {
        approved: gateCounts.approved,
        failed: gateCounts.failed,
        neutral: gateCounts.warning + gateCounts.no_data,
        quality: globalPassRate ?? 0,
        pass: globalStats.pass,
        fail: globalStats.fail,
        blocked: globalStats.blocked,
        notRun: globalStats.notRun,
        total: totalStats,
      },
      clients: mapped,
      period,
      coverage,
      releaseCount: mergedReleases.length,
      gateCounts,
      degraded: false,
    };

    const response = apiOk(req, payload, "OK", { extra: payload });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("[ADMIN][TEST-METRIC] Falha ao gerar metricas globais", error);
    const degradedPayload = {
      totals: {
        approved: 0,
        failed: 0,
        neutral: 0,
        quality: 0,
        pass: 0,
        fail: 0,
        blocked: 0,
        notRun: 0,
        total: 0,
      },
      clients: [],
      period: null,
      coverage: { total: 0, withStats: 0, percent: 0 },
      releaseCount: 0,
      gateCounts: { approved: 0, warning: 0, failed: 0, no_data: 0 },
      degraded: true,
    };

    const response = apiOk(req, degradedPayload, "DEGRADED", { extra: degradedPayload });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
