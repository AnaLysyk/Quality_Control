import fs from "fs";
import path from "path";

const ALERTS_STORE = path.join(process.cwd(), "data", "quality_alerts.json");
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
  metadata?: any;
  timestamp: string;
};

export async function readAlertsStore(): Promise<any[]> {
  try {
    const raw = await fs.promises.readFile(ALERTS_STORE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function writeAlertsStore(alerts: any[]) {
  await fs.promises.mkdir(path.dirname(ALERTS_STORE), { recursive: true });
  await fs.promises.writeFile(ALERTS_STORE, JSON.stringify(alerts, null, 2), "utf8");
}

export async function sendQualityAlert({ companySlug, type, severity, message, metadata }: QualityAlert) {
  const now = new Date().toISOString();
  const alerts = await readAlertsStore();
  const last = alerts.find((a) => a.companySlug === companySlug && a.type === type);
  // Anti-spam: 24h
  if (last && new Date(now).getTime() - new Date(last.timestamp).getTime() < 24 * 60 * 60 * 1000 && last.severity === severity) {
    return false;
  }
  // Registrar
  const alert: QualityAlert = { companySlug, type, severity, message, metadata, timestamp: now };
  alerts.push(alert);
  await writeAlertsStore(alerts);
  // Webhook (mock)
  const webhookUrl = metadata?.webhookUrl;
  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alert),
    }).catch(() => {});
  }
  return true;
}
