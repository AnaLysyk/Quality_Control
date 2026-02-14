import fs from "fs";
import path from "path";
const USE_MEMORY_ALERTS =
  process.env.QUALITY_ALERTS_IN_MEMORY === "true" ||
  process.env.NODE_ENV === "test" ||
  process.env.VERCEL === "1";

const ALERTS_STORE = path.join(process.cwd(), "data", "quality_alerts.json");
let memoryAlerts: QualityAlert[] = [];
let warnedFsFailure = false;
const ALERT_TYPES = [
  "quality_score",
  "sla",
  "mttr",
  "release_failed",
  "gate_failed",
  "low_pass_rate",
  "trend_drop",
  "override",
  "mttr_exceeded",
  "run_failed",
] as const;

export type QualityAlertType = typeof ALERT_TYPES[number];

export type QualityAlert = {
  companySlug: string;
  type: QualityAlertType;
  severity: "info" | "warning" | "critical";
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
  try {
    await fs.promises.mkdir(path.dirname(ALERTS_STORE), { recursive: true });
    await fs.promises.access(ALERTS_STORE);
    return true;
  } catch {
    try {
      await fs.promises.writeFile(ALERTS_STORE, "[]", "utf8");
      return true;
    } catch {
      if (!warnedFsFailure) {
        warnedFsFailure = true;
        console.warn("[QUALITY_ALERTS] Falha ao acessar filesystem; usando fallback em memoria.");
      }
      return false;
    }
  }
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

/**
 * Lê o store de alertas de qualidade do filesystem ou memória.
 * @returns Lista de alertas
 */
export async function readAlertsStore(): Promise<QualityAlert[]> {
  // Impede execução em edge/build/ambiente sem fs
  if (typeof process !== "object" || process.env.NEXT_RUNTIME === "edge") {
    if (USE_MEMORY_ALERTS) return memoryAlerts;
    throw new Error("File system access not supported in this environment");
  }
  if (USE_MEMORY_ALERTS) return memoryAlerts;
  const ok = await ensureAlertsStore();
  if (!ok) return memoryAlerts;
  try {
    const raw = await fs.promises.readFile(ALERTS_STORE, "utf8");
    const parsed = JSON.parse(raw) as QualityAlert[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return memoryAlerts;
  }
}

/**
 * Persiste a lista de alertas de qualidade no filesystem ou memória.
 * @param alerts Lista de alertas
 */
export async function writeAlertsStore(alerts: QualityAlert[]): Promise<void> {
  if (USE_MEMORY_ALERTS) {
    memoryAlerts = alerts as QualityAlert[];
    return;
  }
  const ok = await ensureAlertsStore();
  if (!ok) {
    memoryAlerts = alerts as QualityAlert[];
    return;
  }
  try {
    await fs.promises.writeFile(ALERTS_STORE, JSON.stringify(alerts, null, 2), "utf8");
  } catch {
    memoryAlerts = alerts as QualityAlert[];
  }
}

async function safeFetch(input: RequestInfo, init?: RequestInit) {
  if (typeof fetch !== "function") {
    throw new Error("fetch is not available in this runtime");
  }
  return fetch(input, init);
}

/**
 * Envia e registra um alerta de qualidade, com anti-spam e webhook opcional.
 * @param input Dados do alerta
 * @returns true se alerta foi registrado
 */
export async function sendQualityAlert({ companySlug, type, severity, message, metadata, timestamp }: QualityAlertInput): Promise<boolean> {
  const now = timestamp ?? new Date().toISOString();
  if (!ALERT_TYPES.includes(type)) {
    throw new Error(`Tipo de alerta invalido: ${type}`);
  }
  const alerts = await readAlertsStore();
  const last = findLatestAlert(alerts, companySlug, type);
  // Anti-spam: 24h
  if (last && new Date(now).getTime() - new Date(last.timestamp).getTime() < 24 * 60 * 60 * 1000 && last.severity === severity) {
    return false;
  }
  // Registrar
  const alert: QualityAlert = { companySlug, type, severity, message, metadata, timestamp: now };
  alerts.push(alert);
  await writeAlertsStore(alerts);
  // Webhook (mock) — only attempt if a URL is provided and fetch is available
  const webhookUrl = metadata && typeof metadata.webhookUrl === "string" ? metadata.webhookUrl : null;
  if (webhookUrl) {
    try {
      await safeFetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alert),
      });
    } catch {
      // Best-effort: do not fail the alert if webhook cannot be called in this environment
    }
  }
  return true;
}

/**
 * Garante que alertas críticos de summary (score, SLA, MTTR, release) sejam enviados.
 * @param params Parâmetros de summary e releases
 * @returns Array de booleanos indicando alertas enviados
 */
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
