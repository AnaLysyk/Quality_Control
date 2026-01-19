import { getClientQaseSettings } from "@/lib/qaseConfig";
import { readManualReleaseStore } from "@/data/manualData";
import { calcMTTR } from "@/lib/mttr";
import { normalizeDefectStatus, resolveClosedAt, resolveOpenedAt } from "@/lib/defectNormalization";
// Resumo de qualidade para exportação executiva
export async function getCompanyQualitySummary(slug: string, period: string = "30d") {
  // Manual defects
  const manualReleases = await readManualReleaseStore();
  const manualDefects = manualReleases.map((r: any) => {
    const status = normalizeDefectStatus(r.status);
    const openedAt = resolveOpenedAt((r as any).openedAt ?? r.createdAt);
    const closedAt = resolveClosedAt(status, r.closedAt ?? null, r.updatedAt ?? null);
    return {
      id: r.slug ?? r.id ?? "",
      title: r.name ?? r.title ?? "Defeito manual",
      status,
      openedAt,
      closedAt,
      mttrMs: calcMTTR(openedAt, closedAt),
      origin: "manual",
      runSlug: r.runId ? String(r.runId) : undefined,
      severity: r.severity ?? null,
    };
  });

  // Qase defects
  const clientSettings = await getClientQaseSettings(slug);
  const token = clientSettings?.token || process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";
  const projectCodesSet = new Set<string>();
  const settingsCodes = clientSettings?.projectCodes ?? [];
  settingsCodes.forEach((code) => {
    const normalized = typeof code === "string" ? code.trim().toUpperCase() : "";
    if (normalized) projectCodesSet.add(normalized);
  });
  if (!projectCodesSet.size && clientSettings?.projectCode) {
    const normalized = clientSettings.projectCode.trim().toUpperCase();
    if (normalized) projectCodesSet.add(normalized);
  }
  const projectCodes = Array.from(projectCodesSet);

  let qaseDefects: any[] = [];
  for (const code of projectCodes) {
    const defects = await fetch(`https://api.qase.io/v1/defect/${code}?limit=1000`, {
      headers: { Token: token, Accept: "application/json" },
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((json) => Array.isArray(json?.result?.entities) ? json.result.entities : [])
      .catch(() => []);
    qaseDefects.push(
      ...defects.map((d: any) => {
        const status = normalizeDefectStatus(d.status ?? "open");
        const openedAt = resolveOpenedAt(d.created_at ?? d.updated_at);
        const closedAt = resolveClosedAt(status, d.closed_at ?? null, d.updated_at ?? null);
        return {
          id: d.id ?? d.defect_id ?? "",
          title: d.title ?? d.name ?? "Defeito Qase",
          status,
          openedAt,
          closedAt,
          mttrMs: calcMTTR(openedAt, closedAt),
          origin: "qase",
          runSlug: d.run_id ? String(d.run_id) : undefined,
          severity: d.severity ?? d.severity_name ?? null,
        };
      })
    );
  }

  // Unify
  const all = [...manualDefects, ...qaseDefects].filter((d) => d.openedAt);
  const openDefects = all.filter((d) => d.status !== "done");
  const closedDefects = all.filter((d) => d.status === "done");
  const totalDefects = all.length;
  const mttrClosed = closedDefects.filter((d) => d.mttrMs != null);
  const mttrAvg = mttrClosed.length ? Math.round((mttrClosed.reduce((acc, d) => acc + (d.mttrMs || 0), 0) / mttrClosed.length) / 360000) / 10 : null;
  // SLA: abertos há mais de 48h
  const SLA_MS = 172800000;
  const now = Date.now();
  const slaOverdue = openDefects.filter((d) => {
    const opened = new Date(d.openedAt).getTime();
    return Number.isFinite(opened) && now - opened > SLA_MS;
  }).length;

  // Quality Score: usar lógica do summary (pode ser ajustado)
  let qualityScore = 100;
  if (slaOverdue > 0) qualityScore -= slaOverdue * 10;
  // Penalidade extra se MTTR médio > 48h
  if (mttrAvg != null && mttrAvg > 48) qualityScore -= 5;
  qualityScore = Math.max(0, Math.min(qualityScore, 100));

  return {
    companyName: clientSettings?.company_name || clientSettings?.name || slug,
    qualityScore,
    totalDefects,
    openDefects: openDefects.length,
    closedDefects: closedDefects.length,
    mttrAvg,
    slaOverdue,
  };
}

// Lista de defeitos flat para exportação
export async function getCompanyDefects(slug: string, period: string = "30d") {
  // Reutiliza a mesma lógica do summary
  const summary = await getCompanyQualitySummary(slug, period);
  // Manual + Qase
  const manualReleases = await readManualReleaseStore();
  const manualDefects = manualReleases.map((r: any) => {
    const status = normalizeDefectStatus(r.status);
    const openedAt = resolveOpenedAt((r as any).openedAt ?? r.createdAt);
    const closedAt = resolveClosedAt(status, r.closedAt ?? null, r.updatedAt ?? null);
    return {
      id: r.slug ?? r.id ?? "",
      title: r.name ?? r.title ?? "Defeito manual",
      status,
      openedAt,
      closedAt,
      mttrMs: calcMTTR(openedAt, closedAt),
      origin: "manual",
      runSlug: r.runId ? String(r.runId) : undefined,
      severity: r.severity ?? null,
    };
  });
  const clientSettings = await getClientQaseSettings(slug);
  const token = clientSettings?.token || process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";
  const projectCodesSet = new Set<string>();
  const settingsCodes = clientSettings?.projectCodes ?? [];
  settingsCodes.forEach((code) => {
    const normalized = typeof code === "string" ? code.trim().toUpperCase() : "";
    if (normalized) projectCodesSet.add(normalized);
  });
  if (!projectCodesSet.size && clientSettings?.projectCode) {
    const normalized = clientSettings.projectCode.trim().toUpperCase();
    if (normalized) projectCodesSet.add(normalized);
  }
  const projectCodes = Array.from(projectCodesSet);
  let qaseDefects: any[] = [];
  for (const code of projectCodes) {
    const defects = await fetch(`https://api.qase.io/v1/defect/${code}?limit=1000`, {
      headers: { Token: token, Accept: "application/json" },
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((json) => Array.isArray(json?.result?.entities) ? json.result.entities : [])
      .catch(() => []);
    qaseDefects.push(
      ...defects.map((d: any) => {
        const status = normalizeDefectStatus(d.status ?? "open");
        const openedAt = resolveOpenedAt(d.created_at ?? d.updated_at);
        const closedAt = resolveClosedAt(status, d.closed_at ?? null, d.updated_at ?? null);
        return {
          id: d.id ?? d.defect_id ?? "",
          title: d.title ?? d.name ?? "Defeito Qase",
          status,
          openedAt,
          closedAt,
          mttrMs: calcMTTR(openedAt, closedAt),
          origin: "qase",
          runSlug: d.run_id ? String(d.run_id) : undefined,
          severity: d.severity ?? d.severity_name ?? null,
        };
      })
    );
  }
  // Unify
  const all = [...manualDefects, ...qaseDefects].filter((d) => d.openedAt);
  // Flat payload para export
  return all.map((d) => ({
    id: d.id,
    title: d.title,
    origin: d.origin,
    status: d.status,
    openedAt: d.openedAt,
    closedAt: d.closedAt,
    mttrHours: d.mttrMs != null ? Math.round((d.mttrMs / 360000) ) / 10 : "",
    run: d.runSlug || "",
    severity: d.severity || "",
  }));
}
import { ReleaseEntry } from "@/release/data";

export type Stats = { pass: number; fail: number; blocked: number; notRun: number };

export type ReleaseWithStats = ReleaseEntry & {
  createdAtValue: number;
  stats: Stats | null;
  passRate: number | null;
  gate: QualityGateResult;
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
  const gate = evaluateQualityGate(stats);
  return {
    ...release,
    stats,
    createdAtValue: getCreatedAtValue(release),
    passRate,
    gate,
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
