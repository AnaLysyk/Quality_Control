import { getAllReleases } from "@/release/data";
import { getAllManualReleases } from "@/release/manualData";
import { getRunDetails } from "@/services/qase";
import DashboardClient from "./DashboardClient";
import { getAppMeta } from "@/lib/appMeta";
import { getSupabaseServer } from "@/lib/supabaseServer";
import type { Release } from "@/types/release";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

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

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

type DashboardPageProps = {
  header?: {
    kicker?: string;
    title?: string;
    description?: string;
  };
  showHeader?: boolean;
  companySlug?: string;
  mode?: "full" | "metrics" | "overview";
};

function parseProjectCodes(value: unknown): string[] {
  const normalize = (code: string) => code.trim().toUpperCase();

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map(normalize)
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\s,;|]+/g)
      .map(normalize)
      .filter(Boolean);
  }

  return [];
}

async function resolveCompanyScope(companySlug: string): Promise<{ clientId: string | null; projectCodes: string[] }> {
  if (SUPABASE_MOCK) {
    try {
      const filePath = path.join(process.cwd(), "data", "mock-clients.json");
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const rows = Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
      const match =
        rows.find((row) => typeof row?.slug === "string" && row.slug === companySlug) ??
        rows.find((row) => typeof row?.id === "string" && row.id === companySlug) ??
        null;

      const clientId = typeof match?.id === "string" ? match.id : null;
      const fromSingle = parseProjectCodes(match?.qase_project_code);
      const fromMulti = parseProjectCodes(match?.qase_project_codes);
      const projectCodes = Array.from(new Set([...fromSingle, ...fromMulti]));

      return { clientId, projectCodes };
    } catch {
      return { clientId: null, projectCodes: [] };
    }
  }

  try {
    const supabase = getSupabaseServer();
    const primary = await supabase
      .from("cliente")
      .select("id,slug,qase_project_code,qase_project_codes")
      .or(`slug.eq.${companySlug},id.eq.${companySlug}`)
      .limit(1)
      .maybeSingle();

    if (!primary.error) {
      const data = primary.data as Record<string, unknown> | null;
      const clientId = data?.id;
      const fromSingle = parseProjectCodes(data?.qase_project_code);
      const fromMulti = parseProjectCodes(data?.qase_project_codes);
      const projectCodes = Array.from(new Set([...fromSingle, ...fromMulti]));
      return {
        clientId: typeof clientId === "string" && clientId.trim() ? clientId : null,
        projectCodes,
      };
    }

    // Legacy schema fallback (no qase_project_codes column)
    const legacy = await supabase
      .from("cliente")
      .select("id,slug,qase_project_code")
      .or(`slug.eq.${companySlug},id.eq.${companySlug}`)
      .limit(1)
      .maybeSingle();

    const clientId = (legacy.data as { id?: unknown } | null)?.id;
    const projectRaw = (legacy.data as { qase_project_code?: unknown } | null)?.qase_project_code;
    return {
      clientId: typeof clientId === "string" && clientId.trim() ? clientId : null,
      projectCodes: parseProjectCodes(projectRaw),
    };
  } catch {
    return { clientId: null, projectCodes: [] };
  }
}

export default async function DashboardPage({ header, showHeader = true, companySlug, mode = "overview" }: DashboardPageProps) {
  const [releasesAll, manualReleasesAll] = await Promise.all([getAllReleases(), getAllManualReleases()]);
  const companyScope = companySlug ? await resolveCompanyScope(companySlug) : null;
  const releases = companySlug
    ? releasesAll.filter((r) => {
        const project = typeof r.qaseProject === "string" ? r.qaseProject.toUpperCase() : null;
        const matchesProject = project ? (companyScope?.projectCodes ?? []).includes(project) : false;
        const matchesClient =
          companyScope?.clientId && typeof r.clientId === "string" ? r.clientId === companyScope.clientId : false;

        // In mock mode, when a company has no project codes configured yet, prefer showing all API releases
        // so the Métricas page doesn't look empty during dev.
        if (SUPABASE_MOCK && (companyScope?.projectCodes?.length ?? 0) === 0 && !companyScope?.clientId) {
          return true;
        }

        return matchesClient || matchesProject;
      })
    : releasesAll;
  const manualReleases = companySlug
    ? (manualReleasesAll as Release[]).filter((r) => (r.clientSlug ?? null) === companySlug)
    : manualReleasesAll;
  const thresholds = getQualityGateThresholds();

  const normalizeManualAppKey = (value: Release["app"] | string | undefined) => {
    const raw = (value ?? "smart").toString().trim().toLowerCase();
    if (raw === "cidadao smart") return "cidadao-smart";
    return raw;
  };

  const apiEnriched = await Promise.all(
    releases.map(async (rel) => {
      const projectKey = rel.project ?? rel.app ?? "smart";
      const projectCode = rel.qaseProject ?? (projectKey === "smart" ? "SFQ" : projectKey.toUpperCase());
      const appKey = projectCode;
      const appMeta = getAppMeta(appKey, projectCode);
      let stats: Stats = { pass: 0, fail: 0, blocked: 0, notRun: 0 };

      const manualStats = rel.manualSummary;

      if (manualStats) {
        stats = {
          pass: manualStats.pass,
          fail: manualStats.fail,
          blocked: manualStats.blocked,
          notRun: manualStats.notRun,
        };
      } else {
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
      }

      const total = stats.pass + stats.fail + stats.blocked + stats.notRun;
      const percent = total > 0 ? Math.round((stats.pass / total) * 100) : 0;
      const dateValue = rel.createdAt ? new Date(rel.createdAt).getTime() : 0;
      const gate = evaluateQualityGate(stats, thresholds);
      const type = inferReleaseType(rel.slug, rel.title);

      return {
        app: appKey,
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

  const manualEnriched = manualReleases.map((rel) => {
    const projectKey = normalizeManualAppKey(rel.app);
    const projectCode = projectKey === "smart" ? "SFQ" : projectKey.toUpperCase();
    const appKey = projectCode;
    const appMeta = getAppMeta(appKey, projectCode);
    const stats: Stats = {
      pass: rel.stats.pass,
      fail: rel.stats.fail,
      blocked: rel.stats.blocked,
      notRun: rel.stats.notRun,
    };

    const total = stats.pass + stats.fail + stats.blocked + stats.notRun;
    const percent = total > 0 ? Math.round((stats.pass / total) * 100) : 0;
    const dateValue = rel.createdAt ? new Date(rel.createdAt).getTime() : 0;
    const gate = evaluateQualityGate(stats, thresholds);
    const title = (rel.name ?? "").toString().trim() || rel.slug;
    const type = inferReleaseType(rel.slug, title);

    return {
      app: appKey,
      appLabel: appMeta.label,
      appColor: appMeta.color,
      slug: rel.slug,
      title,
      createdAt: rel.createdAt,
      createdAtValue: dateValue,
      stats,
      percent,
      appMeta,
      gate,
      type,
    };
  });

  const enriched = Array.from(
    new Map<string, (typeof apiEnriched)[number]>(
      [...manualEnriched, ...apiEnriched].map((item) => [item.slug, item])
    ).values()
  );

  const grouped = enriched.reduce((acc: Record<string, typeof enriched>, item) => {
    if (!acc[item.app]) acc[item.app] = [];
    acc[item.app].push(item);
    return acc;
  }, {});

  const desiredApps =
    companySlug && (companyScope?.projectCodes?.length ?? 0) > 0
      ? companyScope!.projectCodes
      : Object.keys(grouped);

  const sections = desiredApps.map((app) => {
    const items = grouped[app] ?? [];
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

  const executiveReleases: ExecutiveRelease[] | null =
    mode !== "metrics"
      ? [...enriched].sort((a, b) => {
          const order = { fail: 0, warn: 1, pass: 2, no_data: 3 } as const;
          const statusDiff = order[a.gate.status] - order[b.gate.status];
          if (statusDiff !== 0) return statusDiff;
          return b.createdAtValue - a.createdAtValue;
        })
      : null;

  const resolvedHeader = header ??
    (mode === "metrics"
      ? {
          kicker: "Métricas",
          title: "Métricas por aplicação",
          description: "Carrosseis com graficos e estatisticas por run, separados por aplicação.",
        }
      : mode === "overview"
        ? {
            kicker: "Dashboard",
            title: "Resumo executivo",
            description: "Visão consolidada sem os gráficos. Os detalhes por aplicação ficam em Métricas.",
          }
      : {
          kicker: "Testing Metric",
          title: "Dashboard Executivo",
          description: "Releases com quality gate consolidado e leitura rapida das runs mais criticas.",
        });

  return (
    <DashboardClient
      sections={sections}
      header={resolvedHeader}
      showHeader={showHeader}
      executive={mode !== "metrics" && executiveReleases ? { summary, releases: executiveReleases } : undefined}
      showMetricsSection={mode !== "overview"}
      metricsHref={companySlug ? `/empresas/${encodeURIComponent(companySlug)}/metricas` : "/metricas"}
    />
  );
}
