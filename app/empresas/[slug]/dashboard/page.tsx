import fs from "fs/promises";
import path from "path";
import { readManualReleaseStore } from "@/data/manualData";
import { evaluateQualityGate, sumStats, toPercent } from "@/lib/quality";
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";
import { getCompanyQualitySummary } from "@/lib/quality";
import { readAlertsStore, type QualityAlert } from "@/lib/qualityAlert";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

type ManualRun = {
  slug: string;
  name: string;
  status?: string | null;
  createdAt?: string | null;
  stats: { pass: number; fail: number; blocked: number; notRun: number };
  gateStatus: "approved" | "warning" | "failed" | "no_data";
  passRate: number | null;
  total: number;
};

type GoalStatus = {
  company_slug: string;
  goal: string;
  status: string;
  value?: number;
  target?: number;
  evaluated_at?: string;
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

function toIso(value?: string | null) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export default async function CompanyDashboardPage({ params }: PageProps) {
  const { slug } = await params;
  const manualReleases = await readManualReleaseStore();
  const runs = manualReleases
    .filter((release) => resolveManualReleaseKind(release) === "run")
    .filter((release) => (release.clientSlug ?? null) === slug)
    .map((release) => {
      const stats = release.stats ?? { pass: 0, fail: 0, blocked: 0, notRun: 0 };
      const total = sumStats(stats);
      const passRate = total > 0 ? toPercent(stats.pass, total) : null;
      const gate = evaluateQualityGate(total > 0 ? stats : null);
      return {
        slug: release.slug,
        name: release.name,
        status: release.status,
        createdAt: toIso(release.createdAt),
        stats,
        total,
        passRate,
        gateStatus: gate.status,
      } satisfies ManualRun;
    })
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

  const summary = await getCompanyQualitySummary(slug);

  let goals: GoalStatus[] = [];
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", "quality_goal_status.json"), "utf8");
    const parsed = JSON.parse(raw) as GoalStatus[];
    goals = Array.isArray(parsed) ? parsed.filter((item) => item.company_slug === slug) : [];
  } catch {
    goals = [];
  }

  let alerts: QualityAlert[] = [];
  try {
    const all = await readAlertsStore();
    alerts = all
      .filter((alert) => alert.companySlug === slug)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
  } catch {
    alerts = [];
  }

  const recentPassRates = runs.map((run) => run.passRate).filter((value): value is number => value !== null);
  const trendDelta = recentPassRates.length >= 2 ? recentPassRates[0] - recentPassRates[1] : 0;
  const trendDirection = trendDelta > 2 ? "up" : trendDelta < -2 ? "down" : "flat";

  const score = summary.qualityScore;
  const health =
    score >= 85 ? "healthy" : score >= 70 ? "attention" : "critical";

  return (
    <DashboardClient
      companySlug={slug}
      runs={runs}
      summary={summary}
      goals={goals}
      alerts={alerts}
      trendDirection={trendDirection}
      healthStatus={health}
    />
  );
}
