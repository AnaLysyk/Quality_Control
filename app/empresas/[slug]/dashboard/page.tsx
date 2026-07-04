import { notFound } from "next/navigation";
import CompanyIntelligenceDashboardClient from "./CompanyIntelligenceDashboardClient";
import CompanyDashboardPrintShell from "./CompanyDashboardPrintShell";
import { loadCompanyDashboardData, type CompanyDashboardData } from "./companyDashboardData";
import { applyProjectDashboardScope } from "./projectDashboardScope";

export const dynamic = "force-dynamic";

const COMPANY_DASHBOARD_CACHE_TTL_MS = 30_000;

type DashboardCacheEntry = {
  expiresAt: number;
  data: CompanyDashboardData | null;
};

type DashboardCacheGlobalState = typeof globalThis & {
  __qcCompanyDashboardCache?: Map<string, DashboardCacheEntry>;
};

function getDashboardCache() {
  const state = globalThis as DashboardCacheGlobalState;
  if (!state.__qcCompanyDashboardCache) {
    state.__qcCompanyDashboardCache = new Map();
  }
  return state.__qcCompanyDashboardCache;
}

async function loadCompanyDashboardDataCached(slug: string) {
  const cacheKey = slug.trim().toLowerCase();
  const cache = getDashboardCache();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const data = await loadCompanyDashboardData(slug);
  cache.set(cacheKey, {
    data,
    expiresAt: Date.now() + COMPANY_DASHBOARD_CACHE_TTL_MS,
  });
  return data;
}

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    projectSlug?: string;
    projectCode?: string;
    project?: string;
    qaseProjectCode?: string;
  }>;
};

export default async function CompanyDashboardPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const data = await loadCompanyDashboardDataCached(slug);

  if (!data) {
    notFound();
  }

  const scopedData = applyProjectDashboardScope(data, {
    projectSlug: query.projectSlug ?? query.project ?? null,
    projectCode: query.projectCode ?? query.qaseProjectCode ?? null,
  });

  return (
    <CompanyDashboardPrintShell>
      <CompanyIntelligenceDashboardClient {...scopedData} />
    </CompanyDashboardPrintShell>
  );
}
