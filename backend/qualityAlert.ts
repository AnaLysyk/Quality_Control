import "server-only";

import { shouldUsePostgresPersistence } from "@/database/persistenceMode";
import { canUsePersistentJsonStore, readPersistentJson, writePersistentJson } from "@/database/persistentJsonStore";

const USE_POSTGRES = shouldUsePostgresPersistence();
async function getPrisma() {
  const { prisma } = await import("@/database/prismaClient");
  return prisma;
}

const USE_MEMORY_ALERTS =
  process.env.QUALITY_ALERTS_IN_MEMORY === "true" ||
  process.env.NODE_ENV === "test";

const ALERTS_KEY = "qc:quality_alerts:v1";
const USE_PERSISTENT_STORE = !USE_MEMORY_ALERTS && !USE_POSTGRES && canUsePersistentJsonStore();
const ALERT_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

let memoryAlerts: QualityAlert[] = [];

const ALERT_TYPES = [
  "quality_score",
  "sla",
  "mttr",
  "release_failed",
  "gate_failed",
  "override",
  "mttr_exceeded",
  "run_failed",
] as const;

export type QualityAlertType = typeof ALERT_TYPES[number];

export type QualityAlert = {
  companySlug: string;
  type: QualityAlertType;
  severity: "critical" | "warning";
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
};

export type QualityAlertInput = Omit<QualityAlert, "timestamp"> & {
  timestamp?: string;
};

type SummaryInput = {
  qualityScore: number;
  slaOverdue: number;
  mttrAvg: number | null;
};

type ReleaseAlertInput = {
  status?: string | null;
  title?: string | null;
  version?: string | null;
  slug?: string | null;
};

async function ensureAlertsStore(): Promise<boolean> {
  return false;
}

function findLatestAlert(alerts: QualityAlert[], companySlug: string, type: QualityAlertType) {
  let latest: QualityAlert | null = null;
  let latestTime = 0;
  for (const alert of alerts) {
    if (alert.companySlug !== companySlug || alert.type !== type) continue;
    const time = Date.parse(alert.timestamp);
    if (!Number.isFinite(time)) continue;
    if (!latest || time > latestTime) {
      latest = alert;
      latestTime = time;
    }
  }
  return latest;
}

function isFailedStatus(value?: string | null) {
  const normalized = (value ?? "").toString().toLowerCase();
  return normalized === "failed" || normalized === "fail" || normalized === "falha";
}

function pgRowToAlert(r: { id: string; companySlug: string; type: string; severity: string; message: string; metadata: unknown; timestamp: Date }): QualityAlert {
  return {
    companySlug: r.companySlug,
    type: r.type as QualityAlertType,
    severity: r.severity as "critical" | "warning",
    message: r.message,
    metadata: (r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)) ? r.metadata as Record<string, unknown> : undefined,
    timestamp: r.timestamp.toISOString(),
  };
}

export async function readAlertsStore(): Promise<QualityAlert[]> {
  if (typeof process !== "object" || process.env.NEXT_RUNTIME === "edge") {
    if (USE_MEMORY_ALERTS) return memoryAlerts;
    throw new Error("File system access not supported in this environment");
  }

  if (USE_MEMORY_ALERTS) return memoryAlerts;

  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.qualityAlert.findMany({ orderBy: { timestamp: "desc" } });
    return rows.map(pgRowToAlert);
  }

  if (USE_PERSISTENT_STORE) {
    const persisted = await readPersistentJson<QualityAlert[]>(ALERTS_KEY, []);
    return Array.isArray(persisted) ? persisted : [];
  }

  const ok = await ensureAlertsStore();
  if (!ok) return memoryAlerts;
  return memoryAlerts;
}

export async function writeAlertsStore(alerts: QualityAlert[]): Promise<void> {
  if (USE_MEMORY_ALERTS) {
    memoryAlerts = alerts as QualityAlert[];
    return;
  }

  if (USE_POSTGRES) {
    // Replace is handled incrementally via sendQualityAlert — this path is only called from tests
    // For safety, upsert all by (companySlug, type, timestamp)
    const prisma = await getPrisma();
    await prisma.qualityAlert.deleteMany({});
    for (const alert of alerts) {
      await prisma.qualityAlert.create({
        data: {
          companySlug: alert.companySlug,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          metadata: alert.metadata ? (alert.metadata as import("@prisma/client").Prisma.InputJsonValue) : undefined,
          timestamp: new Date(alert.timestamp),
        },
      });
    }
    return;
  }

  if (USE_PERSISTENT_STORE) {
    const ok = await writePersistentJson(ALERTS_KEY, alerts);
    if (!ok) memoryAlerts = alerts as QualityAlert[];
    return;
  }

  // Memory fallback
  memoryAlerts = alerts as QualityAlert[];
}

async function safeFetch(input: RequestInfo, init?: RequestInit) {
  if (typeof fetch !== "function") {
    throw new Error("fetch is not available in this runtime");
  }
  return fetch(input, init);
}

function isRecentDuplicateAlert(
  now: string,
  lastTimestamp: string | Date,
  currentSeverity: QualityAlert["severity"],
  lastSeverity: QualityAlert["severity"] | string,
) {
  return (
    new Date(now).getTime() - new Date(lastTimestamp).getTime() < ALERT_DEDUP_WINDOW_MS &&
    lastSeverity === currentSeverity
  );
}

function resolveWebhookUrl(metadata?: Record<string, unknown>) {
  return typeof metadata?.webhookUrl === "string" ? metadata.webhookUrl : null;
}

async function postQualityAlertWebhook(
  webhookUrl: string | null,
  alert: QualityAlert,
) {
  if (!webhookUrl) return;

  try {
    await safeFetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alert),
    });
  } catch {
    // Best-effort only.
  }
}

async function sendPostgresQualityAlert(alert: QualityAlert) {
  const prisma = await getPrisma();
  const last = await prisma.qualityAlert.findFirst({
    where: { companySlug: alert.companySlug, type: alert.type },
    orderBy: { timestamp: "desc" },
  });

  if (
    last &&
    isRecentDuplicateAlert(alert.timestamp, last.timestamp, alert.severity, last.severity)
  ) {
    return false;
  }

  await prisma.qualityAlert.create({
    data: {
      companySlug: alert.companySlug,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      metadata: alert.metadata
        ? (alert.metadata as import("@prisma/client").Prisma.InputJsonValue)
        : undefined,
      timestamp: new Date(alert.timestamp),
    },
  });
  await postQualityAlertWebhook(resolveWebhookUrl(alert.metadata), alert);
  return true;
}

export async function sendQualityAlert({
  companySlug,
  type,
  severity,
  message,
  metadata,
  timestamp,
}: QualityAlertInput): Promise<boolean> {
  const now = timestamp ?? new Date().toISOString();
  if (!ALERT_TYPES.includes(type)) {
    throw new Error(`Tipo de alerta invalido: ${type}`);
  }

  const alert: QualityAlert = { companySlug, type, severity, message, metadata, timestamp: now };

  if (USE_POSTGRES && !USE_MEMORY_ALERTS) {
    return sendPostgresQualityAlert(alert);
  }

  const alerts = await readAlertsStore();
  const last = findLatestAlert(alerts, companySlug, type);
  if (last && isRecentDuplicateAlert(now, last.timestamp, severity, last.severity)) {
    return false;
  }

  alerts.push(alert);
  await writeAlertsStore(alerts);
  await postQualityAlertWebhook(resolveWebhookUrl(metadata), alert);
  return true;
}

export async function ensureSummaryAlerts(params: {
  companySlug: string;
  summary: SummaryInput;
  releases?: ReleaseAlertInput[];
}) {
  const { companySlug, summary, releases } = params;
  const alerts: QualityAlertInput[] = [];

  if (summary.qualityScore < 70) {
    alerts.push({
      companySlug,
      type: "quality_score",
      severity: "critical",
      message: `Quality Score critico: ${summary.qualityScore}`,
      metadata: { score: summary.qualityScore },
    });
  }
  if (summary.slaOverdue > 0) {
    alerts.push({
      companySlug,
      type: "sla",
      severity: "critical",
      message: `Defeitos fora do SLA: ${summary.slaOverdue}`,
      metadata: { slaOverdue: summary.slaOverdue },
    });
  }
  if (summary.mttrAvg != null && summary.mttrAvg > 48) {
    alerts.push({
      companySlug,
      type: "mttr",
      severity: "critical",
      message: `MTTR alto: ${summary.mttrAvg} dias`,
      metadata: { mttr: summary.mttrAvg },
    });
  }

  const failedRelease = releases?.find((release) => isFailedStatus(release.status));
  if (failedRelease) {
    const releaseLabel = failedRelease.title || failedRelease.version || failedRelease.slug || "Release";
    alerts.push({
      companySlug,
      type: "release_failed",
      severity: "critical",
      message: `Release falhou: ${releaseLabel}`,
      metadata: { version: releaseLabel },
    });
  }

  const results: boolean[] = [];
  for (const alert of alerts) {
    results.push(await sendQualityAlert(alert));
  }
  return results;
}

