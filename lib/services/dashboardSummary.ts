// Serviço de exportação e resumo de release: utilitários, tipos e geração de CSV/PDF
import "server-only";

/**
 * Empresa reduzida para exportação de release.
 */

/**
 * Resumo de métricas e estatísticas de uma release exportada.
 */

/**
 * Contexto base para exportação de release.
 */

/**
 * Contexto completo para exportação de release (inclui resumo).
 */

/**
 * Erro customizado para exportação de release.
 */

/**
 * Normaliza string para comparação (trim + lower).
 */

/**
 * Verifica se release corresponde ao slug/id informado.
 */

/**
 * Verifica se a release pertence à empresa informada.
 */

/**
 * Garante array seguro (sem falsy values).
 */

/**
 * Garante objeto de stats válido.
 */

/**
 * Formata string de data para ISO ou retorna original.
 */

/**
 * Calcula o resumo de métricas e estatísticas da release.
 */

/**
 * Carrega contexto base de exportação de release (valida empresa e slug).
 */

/**
 * Carrega contexto completo de exportação de release (inclui resumo).
 */

/**
 * Converte array de valores em linha CSV, escapando corretamente.
 */

/**
 * Formata número como percentual.
 */

/**
 * Gera CSV detalhado da release exportada.
 */

/**
 * Quebra texto em múltiplas linhas para caber no PDF.
 */

/**
 * Gera PDF detalhado da release exportada.
 */

/**
 * Sanitiza string para uso seguro em nomes de arquivo.
 */

import "server-only";

import { getCompanyQualitySummary, getCompanyDefects } from "@/lib/quality";
import { getReleasesByCompany } from "@/release/data";
import { ensureSummaryAlerts, readAlertsStore } from "@/lib/qualityAlert";
import { calculateQualityScore } from "@/lib/qualityScore";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SLA_HOURS = 48;

export type DashboardPeriodKey = "7d" | "30d" | "90d" | "all";

const PERIOD_MAP: Record<DashboardPeriodKey, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

export type DashboardSummaryResult = {
  score: number;
  quality_score: number;
  mttr: { value: number | null; trend: "up" | "down" | "flat" };
  defects: { open: number; overSla: number };
  releases: Array<{ version: string; status: string }>;
  alerts: Array<{ id?: string; companySlug?: string; timestamp: string; [key: string]: unknown }>;
};

export function resolveDashboardPeriod(raw: string | null | undefined): DashboardPeriodKey {
  const normalized = (raw ?? "30d").toLowerCase();
  if (normalized === "7d" || normalized === "90d" || normalized === "all") {
    return normalized;
  }
  return "30d";
}

export function periodToDays(key: DashboardPeriodKey): number | null {
  return PERIOD_MAP[key];
}

function resolveCutoff(periodDays: number | null) {
  if (periodDays == null) return null;
  return Date.now() - periodDays * DAY_MS;
}

function filterAlertsByPeriod<T extends { timestamp?: string }>(alerts: T[], periodDays: number | null) {
  if (periodDays == null) {
    return alerts;
  }
  const cutoff = resolveCutoff(periodDays);
  if (cutoff == null) return alerts;
  return alerts.filter((alert) => {
    if (!alert.timestamp) return false;
    const ts = Date.parse(alert.timestamp);
    return Number.isFinite(ts) && ts >= cutoff;
  });
}

function resolveSlaMs(slaHours?: number | null) {
  const hours = slaHours && slaHours > 0 ? slaHours : DEFAULT_SLA_HOURS;
  return hours * 60 * 60 * 1000;
}

export async function buildDashboardSummary(input: {
  companySlug: string;
  periodKey: DashboardPeriodKey;
  slaHours?: number | null;
}): Promise<DashboardSummaryResult> {
  const periodDays = periodToDays(input.periodKey);
  const slaMs = resolveSlaMs(input.slaHours ?? null);

  const [summary, defects] = await Promise.all([
    getCompanyQualitySummary(input.companySlug, {
      periodDays,
      slaHours: input.slaHours ?? null,
    }),
    getCompanyDefects(input.companySlug, {
      periodDays,
    }),
  ]);

  const openDefects = defects.filter((defect) => (defect.status ?? "").toLowerCase() !== "done");
  const overSla = openDefects.filter((defect) => {
    if (!defect.openedAt) return false;
    const opened = Date.parse(defect.openedAt);
    return Number.isFinite(opened) && Date.now() - opened > slaMs;
  }).length;

  const releases = await getReleasesByCompany(input.companySlug, { periodDays });
  const impacted = releases.map((release) => ({
    version: release.title ?? release.slug ?? release.name ?? "release",
    status: release.status ?? "unknown",
  }));

  try {
    await ensureSummaryAlerts({ companySlug: input.companySlug, summary, releases: impacted });
  } catch (error) {
    console.error("[dashboardSummary] ensureSummaryAlerts failed", error);
  }

  const allAlerts = await readAlertsStore();
  const alerts = filterAlertsByPeriod(
    allAlerts.filter((alert) => alert.companySlug === input.companySlug),
    periodDays,
  )
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 10);

  const totalDefects = Math.max(summary.totalDefects, 1);
  const failRate = summary.openDefects > 0 ? Math.round((summary.openDefects / totalDefects) * 100) : 0;

  const qualityScore = calculateQualityScore({
    gate_status: summary.qualityScore >= 90 ? "approved" : summary.qualityScore >= 70 ? "warning" : "failed",
    mttr_hours: summary.mttrAvg ?? null,
    open_defects: summary.openDefects ?? null,
    fail_rate: failRate,
  });

  return {
    score: summary.qualityScore,
    quality_score: qualityScore,
    mttr: { value: summary.mttrAvg, trend: "flat" },
    defects: { open: summary.openDefects, overSla },
    releases: impacted,
    alerts,
  };
}
