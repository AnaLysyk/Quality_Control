import { getAllReleases } from "@/release/data";
import { getRunDetails } from "@/services/qase";
import DashboardClient from "./DashboardClient";
import { getAppMeta } from "@/lib/appMeta";

type Stats = { pass: number; fail: number; blocked: number; notRun: number };
type ReleaseType = "aceitacao" | "regressao" | "outro";
type QualityGateStatus = "pass" | "warn" | "fail" | "no_data";

type QualityGateThresholds = {
  passRate: number;
  maxFailRate: number;
  maxBlockedRate: number;
  maxNotRunRate: number;
  minTotal: number;
};

type QualityGate = {
  status: QualityGateStatus;
  label: string;
  reasons: string[];
  total: number;
  passRate: number;
  failRate: number;
  blockedRate: number;
  notRunRate: number;
};

type ExecutiveRelease = {
  app: string;
  appLabel: string;
  appColor?: string;
  slug: string;
  title: string;
  createdAt?: string;
  createdAtValue: number;
  stats: Stats;
  percent: number;
  type: ReleaseType;
  gate: QualityGate;
};

type ExecutiveSummary = {
  totalReleases: number;
  totalCases: number;
  stats: Stats;
  passRate: number;
  failRate: number;
  blockedRate: number;
  notRunRate: number;
  gate: Record<QualityGateStatus, number>;
  thresholds: QualityGateThresholds;
};

function readThreshold(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = raw ? Number.parseFloat(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getQualityGateThresholds(): QualityGateThresholds {
  return {
    passRate: readThreshold("QUALITY_GATE_PASS_RATE", 92),
    maxFailRate: readThreshold("QUALITY_GATE_MAX_FAIL_RATE", 5),
    maxBlockedRate: readThreshold("QUALITY_GATE_MAX_BLOCKED_RATE", 3),
    maxNotRunRate: readThreshold("QUALITY_GATE_MAX_NOTRUN_RATE", 12),
    minTotal: readThreshold("QUALITY_GATE_MIN_TOTAL", 1),
  };
}

function toPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function inferReleaseType(slug: string, title: string): ReleaseType {
  const safeSlug = slug.toLowerCase();
  const safeTitle = title.toLowerCase();
  if (safeSlug.includes("_ace") || safeTitle.includes("aceitacao")) return "aceitacao";
  if (safeSlug.includes("_reg") || safeTitle.includes("regressao")) return "regressao";
  return "outro";
}

function evaluateQualityGate(stats: Stats, thresholds: QualityGateThresholds): QualityGate {
  const total = stats.pass + stats.fail + stats.blocked + stats.notRun;
  const passRate = toPercent(stats.pass, total);
  const failRate = toPercent(stats.fail, total);
  const blockedRate = toPercent(stats.blocked, total);
  const notRunRate = toPercent(stats.notRun, total);
  const reasons: string[] = [];

  if (total < thresholds.minTotal) {
    return {
      status: "no_data",
      label: "Sem dados",
      reasons: ["Total insuficiente para quality gate."],
      total,
      passRate,
      failRate,
      blockedRate,
      notRunRate,
    };
  }

  if (passRate < thresholds.passRate) {
    reasons.push(`Pass abaixo de ${thresholds.passRate}%`);
  }
  if (failRate > thresholds.maxFailRate) {
    reasons.push(`Fail acima de ${thresholds.maxFailRate}%`);
  }
  if (blockedRate > thresholds.maxBlockedRate) {
    reasons.push(`Blocked acima de ${thresholds.maxBlockedRate}%`);
  }
  if (notRunRate > thresholds.maxNotRunRate) {
    reasons.push(`Not Run acima de ${thresholds.maxNotRunRate}%`);
  }

  let status: QualityGateStatus = "pass";
  if (failRate > thresholds.maxFailRate || blockedRate > thresholds.maxBlockedRate) {
    status = "fail";
  } else if (passRate < thresholds.passRate || notRunRate > thresholds.maxNotRunRate) {
    status = "warn";
  }

  const label = status === "pass" ? "Aprovado" : status === "warn" ? "Atencao" : "Reprovado";

  return {
    status,
    label,
    reasons,
    total,
    passRate,
    failRate,
    blockedRate,
    notRunRate,
  };
}

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  header?: {
    kicker?: string;
    title?: string;
    description?: string;
  };
  showHeader?: boolean;
};

export default async function DashboardPage({ header, showHeader = true }: DashboardPageProps) {
  const releases = await getAllReleases();
  const thresholds = getQualityGateThresholds();

  const enriched = await Promise.all(
    releases.map(async (rel) => {
      const projectKey = rel.project ?? rel.app ?? "smart";
      const projectCode = rel.qaseProject ?? (projectKey === "smart" ? "SFQ" : projectKey.toUpperCase());
      const appMeta = getAppMeta(projectKey, projectCode);
      let stats: Stats = { pass: 0, fail: 0, blocked: 0, notRun: 0 };

      try {
        const run = await getRunDetails(projectCode, rel.runId);
        if (run) {
          stats = {
            pass: run.pass,
            fail: run.fail,
            blocked: run.blocked,
            notRun: run.notRun,
          };
        }
      } catch (error) {
        console.error(`Erro ao buscar stats da run ${rel.runId}:`, error);
      }

      const total = stats.pass + stats.fail + stats.blocked + stats.notRun;
      const percent = total > 0 ? Math.round((stats.pass / total) * 100) : 0;
      const dateValue = rel.createdAt ? new Date(rel.createdAt).getTime() : 0;
      const gate = evaluateQualityGate(stats, thresholds);
      const type = inferReleaseType(rel.slug, rel.title);

      return {
        app: projectKey,
        appLabel: appMeta.label,
        appColor: appMeta.color,
        slug: rel.slug,
        title: rel.title,
        createdAt: rel.createdAt,
        createdAtValue: dateValue,
        stats,
        percent,
        appMeta,
        gate,
        type,
      };
    })
  );

  const grouped = enriched.reduce((acc: Record<string, typeof enriched>, item) => {
    if (!acc[item.app]) acc[item.app] = [];
    acc[item.app].push(item);
    return acc;
  }, {});

  const sections = Object.entries(grouped).map(([app, items]) => {
    const sorted = [...items].sort((a, b) => b.createdAtValue - a.createdAtValue);
    const meta = getAppMeta(app);
    return {
      app,
      appLabel: meta.label,
      appColor: meta.color,
      releases: sorted,
    };
  });

  const totals = enriched.reduce(
    (acc, rel) => {
      acc.pass += rel.stats.pass;
      acc.fail += rel.stats.fail;
      acc.blocked += rel.stats.blocked;
      acc.notRun += rel.stats.notRun;
      return acc;
    },
    { pass: 0, fail: 0, blocked: 0, notRun: 0 }
  );
  const totalCases = totals.pass + totals.fail + totals.blocked + totals.notRun;
  const summary: ExecutiveSummary = {
    totalReleases: enriched.length,
    totalCases,
    stats: totals,
    passRate: toPercent(totals.pass, totalCases),
    failRate: toPercent(totals.fail, totalCases),
    blockedRate: toPercent(totals.blocked, totalCases),
    notRunRate: toPercent(totals.notRun, totalCases),
    gate: enriched.reduce(
      (acc, rel) => {
        acc[rel.gate.status] += 1;
        return acc;
      },
      { pass: 0, warn: 0, fail: 0, no_data: 0 }
    ),
    thresholds,
  };

  const executiveReleases: ExecutiveRelease[] = [...enriched].sort((a, b) => {
    const order = { fail: 0, warn: 1, pass: 2, no_data: 3 } as const;
    const statusDiff = order[a.gate.status] - order[b.gate.status];
    if (statusDiff !== 0) return statusDiff;
    return b.createdAtValue - a.createdAtValue;
  });

  const resolvedHeader = header ?? {
    kicker: "Testing Metric",
    title: "Dashboard Executivo",
    description: "Releases com quality gate consolidado e leitura rapida das runs mais criticas.",
  };

  return (
    <DashboardClient
      sections={sections}
      header={resolvedHeader}
      showHeader={showHeader}
      executive={{ summary, releases: executiveReleases }}
    />
  );
}
