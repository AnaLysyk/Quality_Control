import { NextResponse } from "next/server";

import { getRedis } from "@/lib/redis";
import { listLocalCompanies, listLocalUsers } from "@/lib/auth/localStore";
import { getAllReleases } from "@/release/data";
import { readManualReleaseStore } from "@/data/manualData";

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

    const releaseBySlug = new Map<string, { status?: string }>();
    releases.forEach((release) => releaseBySlug.set(release.slug, { status: release.status }));
    manualReleases.forEach((release) => {
      const rec = release as { slug?: unknown; status?: unknown };
      const slug = typeof rec.slug === "string" ? rec.slug : "";
      if (slug) releaseBySlug.set(slug, { status: typeof rec.status === "string" ? rec.status : undefined });
    });

    const totalReleases = releaseBySlug.size;
    const totalTestRuns = totalReleases;

    const releaseStats = {
      draft: 0,
      published: 0,
      archived: 0,
    };
    for (const entry of releaseBySlug.values()) {
      const status = (entry.status ?? "").toString().toLowerCase();
      if (status === "draft") releaseStats.draft += 1;
      if (status === "published") releaseStats.published += 1;
      if (status === "archived") releaseStats.archived += 1;
    }

    const testStats = { total: 0, passed: 0, failed: 0, blocked: 0, skipped: 0 };
    manualReleases.forEach((release) => {
      const stats = (release as { stats?: { pass?: number; fail?: number; blocked?: number; notRun?: number } }).stats;
      if (stats) {
        testStats.passed += Number(stats.pass) || 0;
        testStats.failed += Number(stats.fail) || 0;
        testStats.blocked += Number(stats.blocked) || 0;
        testStats.skipped += Number(stats.notRun) || 0;
      }
    });
    releases.forEach((release) => {
      const summary = (release as { manualSummary?: { pass?: number; fail?: number; blocked?: number; notRun?: number } }).manualSummary;
      if (summary) {
        testStats.passed += Number(summary.pass) || 0;
        testStats.failed += Number(summary.fail) || 0;
        testStats.blocked += Number(summary.blocked) || 0;
        testStats.skipped += Number(summary.notRun) || 0;
      }
    });
    testStats.total = testStats.passed + testStats.failed + testStats.blocked + testStats.skipped;

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
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    return NextResponse.json({ error: "Erro ao buscar métricas" }, { status: 500 });
  }
}
