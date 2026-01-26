import { writeAlertsStore } from "../../lib/qualityAlert";

export async function seedQualityAlert(alert: { companySlug?: string; type?: string; severity?: string; message?: string; metadata?: any }) {
  await writeAlertsStore([
    {
      companySlug: alert.companySlug || "griaule",
      type: alert.type || "sla",
      severity: alert.severity || "critical",
      message: alert.message || "Defeitos fora do SLA: 1",
      metadata: alert.metadata || { slaOverdue: 1 },
      timestamp: new Date().toISOString(),
    },
  ]);
}
