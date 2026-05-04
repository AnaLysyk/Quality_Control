import "server-only";

import { getReleaseBySlug, type ReleaseEntry } from "@/release/data";
import { readManualReleaseStore } from "@/release/manualData";
import { getRunDetails } from "@/integrations/qase";
import { slugifyRelease } from "@/lib/slugifyRelease";
import { getAppMeta, getAppColorClass } from "@/lib/appMeta";
import { evaluateQualityGate, type QualityGateResult } from "@/lib/quality";
import { readQualityGateHistory, type QualityGateHistoryEntry } from "@/lib/qualityGateHistory";
import { calculateQualityScore } from "@/lib/qualityScore";
import { getReleaseTimeline, type TimelineEvent } from "@/lib/releaseTimeline";
import { formatRunText, formatRunTitle } from "@/lib/runPresentation";
import type { Release } from "@/types/release";

type AnyRelease = (Release & { name?: string }) | (ReleaseEntry & { name?: string });

function parseQaseRunSlug(value: string): { projectCode: string; runId: number } | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^qase-([a-z0-9_-]+)-(\d+)$/i);
  if (!match) return null;
  const projectCode = match[1].trim().toUpperCase();
  const runId = Number(match[2]);
  if (!projectCode || !Number.isFinite(runId)) return null;
  return { projectCode, runId };
}

export type RunDetailViewModel = {
  slug: string;
  companySlug: string;
  source: "MANUAL" | "API";
  releaseData: AnyRelease;

  projectKey: string;
  projectCode: string;
  appMeta: { label: string; color: string };
  appColorClass: string;

  stats: { pass: number; fail: number; blocked: number; notRun: number };
  total: number;
  hasData: boolean;

  gate: QualityGateResult;
  qualityScore: number;
  history: QualityGateHistoryEntry[];
  timeline: TimelineEvent[];

  displayTitle: string;
  displaySummary: string;

  runId: number | null;
  editable: boolean;
  canPersistApiLinks: boolean;
  apiPersistEndpoint: string | undefined;

  csvExportUrl: string;
  pdfExportUrl: string;
};

export async function getRunDetailViewModel(
  slug: string,
  companySlug?: string,
): Promise<RunDetailViewModel | null> {
  const normalizedSlug = slugifyRelease(slug);
  let manualRelease: Release | null = null;
  let apiRelease: ReleaseEntry | null = null;

  try {
    const manualReleases = await readManualReleaseStore();
    manualRelease = manualReleases.find((r) => r.slug === normalizedSlug) ?? null;
  } catch {
    manualRelease = null;
  }

  if (!manualRelease) {
    apiRelease = (await getReleaseBySlug(normalizedSlug)) ?? null;
  }

  const source: "MANUAL" | "API" = manualRelease ? "MANUAL" : "API";
  let releaseData: AnyRelease | null =
    (manualRelease as AnyRelease) || (apiRelease as AnyRelease);

  if (!releaseData) {
    const parsed = parseQaseRunSlug(slug);
    if (parsed) {
      apiRelease = {
        slug: normalizedSlug,
        title: `Run ${parsed.runId}`,
        summary: "Execução integrada via Qase.",
        runId: parsed.runId,
        project: parsed.projectCode.toLowerCase(),
        app: parsed.projectCode.toLowerCase(),
        qaseProject: parsed.projectCode,
      };
      releaseData = apiRelease as AnyRelease;
    }
  }

  if (!releaseData) return null;

  const projectKey = (
    releaseData.app || (releaseData as ReleaseEntry).project || "smart"
  ).toLowerCase();
  const projectCode =
    (releaseData as ReleaseEntry).qaseProject ??
    (projectKey === "smart" ? "SFQ" : projectKey.toUpperCase());
  const appMeta = getAppMeta(projectKey, projectCode);
  const appColorClass = getAppColorClass(projectKey);

  let stats =
    source === "MANUAL"
      ? manualRelease?.stats ?? { pass: 0, fail: 0, blocked: 0, notRun: 0 }
      : { pass: 0, fail: 0, blocked: 0, notRun: 0 };
  let hasData = stats.pass + stats.fail + stats.blocked + stats.notRun > 0;

  const runId = Number((releaseData as ReleaseEntry).runId);
  const runIdValid = Number.isFinite(runId);

  if (source === "API" && runIdValid) {
    const qaseSlugKey = companySlug ?? normalizedSlug;
    try {
      const run = await getRunDetails(projectCode, runId, qaseSlugKey);
      if (run) {
        stats = { pass: run.pass, fail: run.fail, blocked: run.blocked, notRun: run.notRun };
        hasData = run.hasData;
      }
    } catch {
      /* ignore */
    }
  }

  const editable = source === "MANUAL";
  const total = stats.pass + stats.fail + stats.blocked + stats.notRun;
  const gate = evaluateQualityGate(total > 0 ? stats : null);
  const effectiveCompanySlug = companySlug || "demo";
  const history = await readQualityGateHistory(effectiveCompanySlug, releaseData.slug);
  const latestGate = history[0] ?? null;
  const timeline = await getReleaseTimeline(effectiveCompanySlug, releaseData.slug);
  const inferredFailRate = total > 0 ? Math.round((stats.fail / total) * 100) : 0;
  const qualityScore = calculateQualityScore({
    gate_status: latestGate?.gate_status ?? gate.status,
    mttr_hours: latestGate?.mttr_hours ?? null,
    open_defects: latestGate?.open_defects ?? null,
    fail_rate: latestGate?.fail_rate ?? inferredFailRate,
  });

  const canPersistApiLinks = source === "API" && Boolean(companySlug);
  const apiPersistEndpoint =
    source === "API" && runIdValid
      ? `/api/kanban?project=${encodeURIComponent(projectCode)}&runId=${encodeURIComponent(
          String(runId ?? 0),
        )}${companySlug ? `&slug=${encodeURIComponent(companySlug)}` : ""}`
      : undefined;

  const displayTitle = formatRunTitle(
    (releaseData as { name?: string }).name ??
      (releaseData as ReleaseEntry).title ??
      releaseData.slug ??
      "Run",
    "Run",
  );
  const displaySummary = formatRunText((releaseData as ReleaseEntry).summary);

  const encodedCompany = encodeURIComponent(effectiveCompanySlug);
  const encodedSlug = encodeURIComponent(releaseData.slug);

  return {
    slug: normalizedSlug,
    companySlug: effectiveCompanySlug,
    source,
    releaseData,
    projectKey,
    projectCode,
    appMeta,
    appColorClass,
    stats,
    total,
    hasData,
    gate,
    qualityScore,
    history,
    timeline,
    displayTitle,
    displaySummary,
    runId: runIdValid ? runId : null,
    editable,
    canPersistApiLinks,
    apiPersistEndpoint,
    csvExportUrl: `/api/empresas/${encodedCompany}/releases/${encodedSlug}/export?format=csv`,
    pdfExportUrl: `/api/empresas/${encodedCompany}/releases/${encodedSlug}/export?format=pdf`,
  };
}
