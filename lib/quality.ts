import { ReleaseEntry } from "@/release/data";

export type Stats = { pass: number; fail: number; blocked: number; notRun: number };

export type ReleaseWithStats = ReleaseEntry & {
  createdAtValue: number;
  stats: Stats | null;
  passRate: number | null;
};

export type TrendPoint = {
  label: string;
  value: number | null;
  total: number;
};

export type TrendSummary = {
  direction: "up" | "down" | "flat";
  delta: number;
};

export type QualityGateStatus = "approved" | "warning" | "failed" | "no_data";
export type QualityGateReasonKey =
  | "noDataReason"
  | "passBelow"
  | "failAbove"
  | "blockedAbove"
  | "notRunAbove";

export type QualityGateReason = {
  key: QualityGateReasonKey;
  value?: number;
};

export type QualityGateResult = {
  status: QualityGateStatus;
  total: number;
  passRate: number;
  failRate: number;
  blockedRate: number;
  notRunRate: number;
  reasons: QualityGateReason[];
};

export const QUALITY_THRESHOLDS = {
  passRate: readEnvNumber("NEXT_PUBLIC_QUALITY_GATE_PASS_RATE", 92),
  maxFailRate: readEnvNumber("NEXT_PUBLIC_QUALITY_GATE_MAX_FAIL_RATE", 5),
  maxBlockedRate: readEnvNumber("NEXT_PUBLIC_QUALITY_GATE_MAX_BLOCKED_RATE", 3),
  maxNotRunRate: readEnvNumber("NEXT_PUBLIC_QUALITY_GATE_MAX_NOTRUN_RATE", 12),
  minTotal: readEnvNumber("NEXT_PUBLIC_QUALITY_GATE_MIN_TOTAL", 1),
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function readEnvNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNumber(value: unknown): number {
  const num = Number(value ?? 0);
  if (Number.isFinite(num)) return num;
  const parsed = parseInt((value as string) ?? "", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStats(input?: Partial<Stats> | null): Stats {
  return {
    pass: Math.max(0, toNumber(input?.pass)),
    fail: Math.max(0, toNumber(input?.fail)),
    blocked: Math.max(0, toNumber(input?.blocked)),
    notRun: Math.max(0, toNumber(input?.notRun)),
  };
}

export function sumStats(stats: Stats) {
  return stats.pass + stats.fail + stats.blocked + stats.notRun;
}

export function toPercent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function statsFromRelease(release: ReleaseEntry): Stats | null {
  if (release.manualSummary) {
    return normalizeStats({
      pass: release.manualSummary.pass,
      fail: release.manualSummary.fail,
      blocked: release.manualSummary.blocked,
      notRun: release.manualSummary.notRun,
    });
  }

  if (release.metrics) {
    return normalizeStats({
      pass: release.metrics.pass,
      fail: release.metrics.fail,
      blocked: release.metrics.blocked,
      notRun: release.metrics.notRun ?? release.metrics.not_run,
    });
  }

  return null;
}

function getCreatedAtValue(release: ReleaseEntry) {
  const raw = release.createdAt ?? release.created_at;
  const time = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export function buildReleaseWithStats(release: ReleaseEntry): ReleaseWithStats {
  const stats = statsFromRelease(release);
  const total = stats ? sumStats(stats) : 0;
  const passRate = total > 0 ? toPercent(stats!.pass, total) : null;
  return {
    ...release,
    stats,
    createdAtValue: getCreatedAtValue(release),
    passRate,
  };
}

export function buildTrendPoints(releases: ReleaseWithStats[], period: number): TrendPoint[] {
  const bucketCount = period <= 7 ? 7 : 6;
  const start = Date.now() - period * DAY_MS;
  const bucketSize = Math.max(1, Math.floor((period * DAY_MS) / bucketCount));

  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    start: start + index * bucketSize,
    stats: { pass: 0, fail: 0, blocked: 0, notRun: 0 } as Stats,
  }));

  releases.forEach((release) => {
    if (!release.stats) return;
    if (release.createdAtValue < start) return;
    const index = Math.min(bucketCount - 1, Math.floor((release.createdAtValue - start) / bucketSize));
    addStats(buckets[index].stats, release.stats);
  });

  return buckets.map((bucket) => {
    const total = sumStats(bucket.stats);
    const value = total > 0 ? toPercent(bucket.stats.pass, total) : null;
    const label = new Date(bucket.start + bucketSize - DAY_MS / 2).toISOString().slice(5, 10);
    return { label, value, total };
  });
}

function addStats(target: Stats, source: Stats) {
  target.pass += source.pass;
  target.fail += source.fail;
  target.blocked += source.blocked;
  target.notRun += source.notRun;
}

export function computeTrendSummary(releases: ReleaseWithStats[]): TrendSummary {
  const sorted = [...releases]
    .filter((release) => release.passRate !== null)
    .sort((a, b) => b.createdAtValue - a.createdAtValue);
  const rates = sorted.map((release) => release.passRate ?? 0);

  if (rates.length < 2) {
    return { direction: "flat", delta: 0 };
  }

  const delta = Math.round(rates[0] - rates[1]);
  if (Math.abs(delta) < 2) {
    return { direction: "flat", delta };
  }
  return { direction: delta > 0 ? "up" : "down", delta };
}

export function evaluateQualityGate(stats: Stats | null): QualityGateResult {
  const total = stats ? sumStats(stats) : 0;
  const normalized = stats ?? { pass: 0, fail: 0, blocked: 0, notRun: 0 };
  const passRate = total === 0 ? 0 : toPercent(normalized.pass, total);
  const failRate = total === 0 ? 0 : toPercent(normalized.fail, total);
  const blockedRate = total === 0 ? 0 : toPercent(normalized.blocked, total);
  const notRunRate = total === 0 ? 0 : toPercent(normalized.notRun, total);

  if (total < QUALITY_THRESHOLDS.minTotal) {
    return {
      status: "no_data",
      total,
      passRate,
      failRate,
      blockedRate,
      notRunRate,
      reasons: [{ key: "noDataReason" }],
    };
  }

  const reasons: QualityGateReason[] = [];
  if (passRate < QUALITY_THRESHOLDS.passRate) {
    reasons.push({ key: "passBelow", value: QUALITY_THRESHOLDS.passRate });
  }
  if (failRate > QUALITY_THRESHOLDS.maxFailRate) {
    reasons.push({ key: "failAbove", value: QUALITY_THRESHOLDS.maxFailRate });
  }
  if (blockedRate > QUALITY_THRESHOLDS.maxBlockedRate) {
    reasons.push({ key: "blockedAbove", value: QUALITY_THRESHOLDS.maxBlockedRate });
  }
  if (notRunRate > QUALITY_THRESHOLDS.maxNotRunRate) {
    reasons.push({ key: "notRunAbove", value: QUALITY_THRESHOLDS.maxNotRunRate });
  }

  let status: QualityGateStatus = "approved";
  if (failRate > QUALITY_THRESHOLDS.maxFailRate || blockedRate > QUALITY_THRESHOLDS.maxBlockedRate) {
    status = "failed";
  } else if (passRate < QUALITY_THRESHOLDS.passRate || notRunRate > QUALITY_THRESHOLDS.maxNotRunRate) {
    status = "warning";
  }

  return {
    status,
    total,
    passRate,
    failRate,
    blockedRate,
    notRunRate,
    reasons,
  };
}

export type ClientItem = {
  id: string;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  logo?: string | null;
  qase_project_code?: string | null;
  active?: boolean | null;
};

export type CompanyRow = {
  id: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
  active?: boolean | null;
  releases: ReleaseWithStats[];
  stats: Stats;
  passRate: number | null;
  gate: QualityGateResult;
  trend: TrendSummary;
  analystCount?: number | null;
  latestRelease?: {
    slug?: string;
    title?: string;
    createdAt?: string;
  };
};

function resolveCompanyKey(
  release: ReleaseWithStats,
  byId: Map<string, ClientItem>,
  bySlug: Map<string, string>,
  byName: Map<string, string>,
  byQaseProjectCode: Map<string, string>
) {
  if (release.clientId && byId.has(release.clientId)) return release.clientId;

  if (release.qaseProject) {
    const key = byQaseProjectCode.get(release.qaseProject.toLowerCase());
    if (key) return key;
  }

  if (release.clientName) {
    const key = byName.get(release.clientName.toLowerCase());
    if (key) return key;
  }
  const slugCandidate = (release.clientName ?? release.project ?? release.app ?? "").toLowerCase();
  if (slugCandidate && bySlug.has(slugCandidate)) return bySlug.get(slugCandidate) ?? null;
  return null;
}

export function buildCompanyRows(clients: ClientItem[], releases: ReleaseWithStats[]): CompanyRow[] {
  const byId = new Map(clients.map((client) => [client.id, client]));
  const bySlug = new Map(
    clients
      .filter((client) => client.slug)
      .map((client) => [(client.slug ?? "").toLowerCase(), client.id])
  );
  const byName = new Map(clients.map((client) => [client.name.toLowerCase(), client.id]));
  const byQaseProjectCode = new Map(
    clients
      .filter((client) => client.qase_project_code)
      .map((client) => [(client.qase_project_code ?? "").toLowerCase(), client.id])
  );

  const releasesByCompany = new Map<string, ReleaseWithStats[]>();
  releases.forEach((release) => {
    const key = resolveCompanyKey(release, byId, bySlug, byName, byQaseProjectCode);
    if (!key) return;
    const list = releasesByCompany.get(key) ?? [];
    list.push(release);
    releasesByCompany.set(key, list);
  });

  return clients.map((client) => {
    const list = releasesByCompany.get(client.id) ?? [];
    const statsAccumulator: Stats = { pass: 0, fail: 0, blocked: 0, notRun: 0 };
    list.forEach((item) => {
      if (item.stats) addStats(statsAccumulator, item.stats);
    });

    const total = sumStats(statsAccumulator);
    const passRate = total > 0 ? toPercent(statsAccumulator.pass, total) : null;

    const sortedReleases = [...list].sort((a, b) => b.createdAtValue - a.createdAtValue);
    const gate = evaluateQualityGate(total > 0 ? statsAccumulator : null);
    const trend = computeTrendSummary(sortedReleases);
    const latest = sortedReleases[0];

    return {
      id: client.id,
      name: client.name,
      slug: client.slug ?? null,
      logo: client.logo_url ?? client.logo ?? null,
      active: client.active ?? false,
      releases: sortedReleases,
      stats: statsAccumulator,
      passRate,
      gate,
      trend,
      latestRelease: latest
        ? {
            slug: latest.slug,
            title: latest.title,
            createdAt: latest.createdAt ?? latest.created_at,
          }
        : undefined,
    };
  });
}

