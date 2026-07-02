import { NextResponse } from "next/server";

import { getRedis } from "@/lib/redis";
import { listLocalCompanies, listLocalUsers } from "@/lib/auth/localStore";
import { getAllReleases } from "@/release/data";
import { readManualReleaseStore } from "@/data/manualData";

type ReleaseLike = Record<string, unknown>;

type CompanyQuality = {
  id: string;
  slug: string;
  name: string;
  status: string;
  runs: number;
  projects: number;
  qaseProjects: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  totalTests: number;
  passRate: number;
  openDefects: number;
  risk: "critical" | "warning" | "stable" | "empty";
  lastActivityAt: string | null;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSlug(value: unknown) {
  return asString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeStatus(value: unknown) {
  return asString(value).toLowerCase();
}

function readStats(record: ReleaseLike) {
  const stats = (record.stats ?? record.manualSummary ?? record.metrics ?? {}) as Record<string, unknown>;
  return {
    pass: Number(stats.pass ?? stats.passed ?? 0) || 0,
    fail: Number(stats.fail ?? stats.failed ?? 0) || 0,
    blocked: Number(stats.blocked ?? 0) || 0,
    notRun: Number(stats.notRun ?? stats.not_run ?? stats.skipped ?? 0) || 0,
  };
}

function getActivityAt(record: ReleaseLike) {
  return asString(record.updatedAt) || asString(record.createdAt) || asString(record.created_at) || null;
}

function isOpenDefect(record: ReleaseLike) {
  const kind = normalizeStatus(record.kind ?? record.type ?? record.category);
  if (kind !== "defect" && kind !== "bug" && kind !== "defeito") return false;
  const status = normalizeStatus(record.status);
  return !["done", "closed", "resolved", "finalized", "arquivado", "archived"].includes(status);
}

function buildRisk(passRate: number, openDefects: number, failed: number, blocked: number, runs: number): CompanyQuality["risk"] {
  if (runs === 0) return "empty";
  if (openDefects >= 3 || passRate < 70 || failed + blocked >= 10) return "critical";
  if (openDefects > 0 || passRate < 90 || failed + blocked > 0) return "warning";
  return "stable";
}

function compareRisk(left: CompanyQuality, right: CompanyQuality) {
  const weight = { critical: 4, warning: 3, empty: 2, stable: 1 } as const;
  return weight[right.risk] - weight[left.risk] || right.openDefects - left.openDefects || right.runs - left.runs;
}

export async function GET() {
  try {
    const [users, companies, releases, manualReleases, activeSessions] = await Promise.all([
      listLocalUsers(),
      listLocalCompanies(),
      getAllReleases(),
      readManualReleaseStore(),
      (async () => {
        try {
          const redis = getRedis();
          const keys = await redis.keys("session:*");
          return keys.length;
        } catch {
          return 0;
        }
      })(),
    ]);

    const companyById = new Map(companies.map((company) => [company.id, company]));
    const companyBySlug = new Map(companies.map((company) => [normalizeSlug(company.slug), company]));
    const companyQuality = new Map<string, CompanyQuality>();

    function ensureCompany(input: { id?: unknown; slug?: unknown; name?: unknown }): CompanyQuality {
      const id = asString(input.id);
      const requestedSlug = normalizeSlug(input.slug);
      const company = (id ? companyById.get(id) : null) ?? (requestedSlug ? companyBySlug.get(requestedSlug) : null) ?? null;
      const slug = normalizeSlug(company?.slug ?? input.slug ?? input.name) || "testing-company";
      const existing = companyQuality.get(slug);
      if (existing) return existing;

      const record: CompanyQuality = {
        id: asString(company?.id ?? input.id) || slug,
        slug,
        name: asString(company?.name ?? input.name) || "Testing Company",
        status: asString(company?.status) || (company?.active === false ? "inactive" : "active"),
        runs: 0,
        projects: 0,
        qaseProjects: Array.isArray(company?.qase_project_codes) ? company.qase_project_codes.length : 0,
        passed: 0,
        failed: 0,
        blocked: 0,
        skipped: 0,
        totalTests: 0,
        passRate: 0,
        openDefects: 0,
        risk: "empty",
        lastActivityAt: null,
      };
      companyQuality.set(slug, record);
      return record;
    }

    for (const company of companies) {
      const record = ensureCompany({ id: company.id, slug: company.slug, name: company.name });
      const configuredProjects = Array.isArray(company.qase_project_codes) ? company.qase_project_codes.filter(Boolean).length : 0;
      record.projects = Math.max(record.projects, configuredProjects);
      record.qaseProjects = Math.max(record.qaseProjects, configuredProjects);
    }

    const releaseBySlug = new Map<string, { status?: string }>();
    const allEntries: ReleaseLike[] = [];

    releases.forEach((release) => {
      releaseBySlug.set(release.slug, { status: release.status });
      allEntries.push(release as ReleaseLike);
    });
    manualReleases.forEach((release) => {
      const rec = release as ReleaseLike;
      const slug = asString(rec.slug);
      if (slug) releaseBySlug.set(slug, { status: asString(rec.status) || undefined });
      allEntries.push(rec);
    });

    const totalReleases = releaseBySlug.size;
    const totalTestRuns = totalReleases;

    const releaseStats = {
      draft: 0,
      published: 0,
      archived: 0,
    };
    for (const entry of releaseBySlug.values()) {
      const status = normalizeStatus(entry.status);
      if (status === "draft") releaseStats.draft += 1;
      if (["published", "active", "finalized", "done", "finalizada"].includes(status)) releaseStats.published += 1;
      if (status === "archived") releaseStats.archived += 1;
    }

    const testStats = { total: 0, passed: 0, failed: 0, blocked: 0, skipped: 0 };

    for (const entry of allEntries) {
      const stats = readStats(entry);
      testStats.passed += stats.pass;
      testStats.failed += stats.fail;
      testStats.blocked += stats.blocked;
      testStats.skipped += stats.notRun;

      const companyId = asString(entry.companyId ?? entry.clientId);
      const companySlug = asString(entry.companySlug ?? entry.clientSlug);
      const companyName = asString(entry.companyName ?? entry.clientName);
      const target = ensureCompany({ id: companyId, slug: companySlug, name: companyName || "Testing Company" });
      const hasStats = stats.pass + stats.fail + stats.blocked + stats.notRun > 0;
      if (hasStats || normalizeStatus(entry.kind) !== "defect") target.runs += 1;
      target.passed += stats.pass;
      target.failed += stats.fail;
      target.blocked += stats.blocked;
      target.skipped += stats.notRun;
      target.totalTests += stats.pass + stats.fail + stats.blocked + stats.notRun;
      if (isOpenDefect(entry)) target.openDefects += 1;

      const projectKey = normalizeSlug(entry.project ?? entry.app ?? entry.qaseProject ?? entry.testPlanProjectCode ?? entry.runName);
      if (projectKey) target.projects += 1;
      if (asString(entry.qaseProject ?? entry.testPlanProjectCode)) target.qaseProjects += 1;

      const activityAt = getActivityAt(entry);
      if (activityAt && (!target.lastActivityAt || Date.parse(activityAt) > Date.parse(target.lastActivityAt))) {
        target.lastActivityAt = activityAt;
      }
    }

    testStats.total = testStats.passed + testStats.failed + testStats.blocked + testStats.skipped;

    const companyQualityList = Array.from(companyQuality.values()).map((company) => {
      const passRate = company.totalTests > 0 ? Math.round((company.passed / company.totalTests) * 100) : 0;
      return {
        ...company,
        projects: Math.max(0, company.projects),
        qaseProjects: Math.max(0, company.qaseProjects),
        passRate,
        risk: buildRisk(passRate, company.openDefects, company.failed, company.blocked, company.runs),
      };
    }).sort(compareRisk);

    const companiesWithQuality = companyQualityList.filter((company) => company.runs > 0);
    const averagePassRate = companiesWithQuality.length
      ? Math.round(companiesWithQuality.reduce((sum, company) => sum + company.passRate, 0) / companiesWithQuality.length)
      : 0;

    return NextResponse.json({
      overview: {
        totalUsers: users.length,
        totalCompanies: companies.length,
        totalReleases,
        totalTestRuns,
        activeSessions,
      },
      testStats,
      releaseStats,
      companyQuality: companyQualityList,
      consultingStats: {
        averagePassRate,
        criticalCompanies: companyQualityList.filter((company) => company.risk === "critical").length,
        attentionCompanies: companyQualityList.filter((company) => company.risk === "warning").length,
        stableCompanies: companyQualityList.filter((company) => company.risk === "stable").length,
        companiesWithoutRuns: companyQualityList.filter((company) => company.risk === "empty").length,
        openDefects: companyQualityList.reduce((sum, company) => sum + company.openDefects, 0),
        totalProjects: companyQualityList.reduce((sum, company) => sum + company.projects, 0),
        qaseProjects: companyQualityList.reduce((sum, company) => sum + company.qaseProjects, 0),
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    return NextResponse.json({ error: "Erro ao buscar métricas" }, { status: 500 });
  }
}

