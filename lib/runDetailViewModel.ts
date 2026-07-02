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
type RunStats = { pass: number; fail: number; blocked: number; notRun: number };
type ResolvedReleaseData = {
  source: "MANUAL" | "API";
  releaseData: AnyRelease;
  manualRelease: Release | null;
};

const EMPTY_RUN_STATS: RunStats = { pass: 0, fail: 0, blocked: 0, notRun: 0 };

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

async function findManualRelease(normalizedSlug: string) {
  try {
    const manualReleases = await readManualReleaseStore();
    return manualReleases.find((release) => release.slug === normalizedSlug) ?? null;
  } catch {
    return null;
  }
}

function buildQaseFallbackRelease(slug: string, normalizedSlug: string): ReleaseEntry | null {
  const parsed = parseQaseRunSlug(slug);
  if (!parsed) return null;

  return {
    slug: normalizedSlug,
    title: `Run ${parsed.runId}`,
    summary: "ExecuÃ§Ã£o integrada via Qase.",
    runId: parsed.runId,
    project: parsed.projectCode.toLowerCase(),
    app: parsed.projectCode.toLowerCase(),
    qaseProject: parsed.projectCode,
  };
}

async function resolveReleaseData(
  slug: string,
  normalizedSlug: string,
): Promise<ResolvedReleaseData | null> {
  const manualRelease = await findManualRelease(normalizedSlug);
  if (manualRelease) {
    return { source: "MANUAL", releaseData: manualRelease as AnyRelease, manualRelease };
  }

  const apiRelease = (await getReleaseBySlug(normalizedSlug)) ?? buildQaseFallbackRelease(slug, normalizedSlug);
  return apiRelease
    ? { source: "API", releaseData: apiRelease as AnyRelease, manualRelease: null }
    : null;
}

function hasRunStats(stats: RunStats) {
  return stats.pass + stats.fail + stats.blocked + stats.notRun > 0;
}

function getInitialRunStats(source: "MANUAL" | "API", manualRelease: Release | null) {
  return source === "MANUAL" ? manualRelease?.stats ?? EMPTY_RUN_STATS : EMPTY_RUN_STATS;
}

async function hydrateApiRunStats(input: {
  companySlug?: string;
  normalizedSlug: string;
  projectCode: string;
  runId: number;
  runIdValid: boolean;
  source: "MANUAL" | "API";
  stats: RunStats;
}) {
  if (input.source !== "API" || !input.runIdValid) {
    return { stats: input.stats, hasData: hasRunStats(input.stats) };
  }

  try {
    const qaseSlugKey = input.companySlug ?? input.normalizedSlug;
    const run = await getRunDetails(input.projectCode, input.runId, qaseSlugKey);
    return run
      ? {
          stats: { pass: run.pass, fail: run.fail, blocked: run.blocked, notRun: run.notRun },
          hasData: run.hasData,
        }
      : { stats: input.stats, hasData: hasRunStats(input.stats) };
  } catch {
    return { stats: input.stats, hasData: hasRunStats(input.stats) };
  }
}

function buildApiPersistEndpoint(input: {
  companySlug?: string;
  projectCode: string;
  runId: number;
  runIdValid: boolean;
  source: "MANUAL" | "API";
}) {
  if (input.source !== "API" || !input.runIdValid) return undefined;

  const query = new URLSearchParams({
    project: input.projectCode,
    runId: String(input.runId),
  });
  if (input.companySlug) query.set("slug", input.companySlug);
  return `/api/kanban?${query.toString()}`;
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
  const resolvedRelease = await resolveReleaseData(slug, normalizedSlug);

  if (!resolvedRelease) return null;

  const { source, releaseData, manualRelease } = resolvedRelease;

  const projectKey = (
    releaseData.app || (releaseData as ReleaseEntry).project || "smart"
  ).toLowerCase();
  const projectCode =
    (releaseData as ReleaseEntry).qaseProject ??
    (projectKey === "smart" ? "SFQ" : projectKey.toUpperCase());
  const appMeta = getAppMeta(projectKey, projectCode);
  const appColorClass = getAppColorClass(projectKey);

  let stats = getInitialRunStats(source, manualRelease);

  const runId = Number((releaseData as ReleaseEntry).runId);
  const runIdValid = Number.isFinite(runId);

  const hydratedRun = await hydrateApiRunStats({
    companySlug,
    normalizedSlug,
    projectCode,
    runId,
    runIdValid,
    source,
    stats,
  });
  stats = hydratedRun.stats;
  const hasData = hydratedRun.hasData;

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
  const apiPersistEndpoint = buildApiPersistEndpoint({
    companySlug,
    projectCode,
    runId,
    runIdValid,
    source,
  });

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

