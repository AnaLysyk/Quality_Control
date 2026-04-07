import "server-only";

import { readManualReleaseStore } from "@/data/manualData";
import { normalizeDefectStatus, resolveClosedAt, resolveOpenedAt, type DefectStatus } from "@/lib/defectNormalization";
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";
import { calcMTTR } from "@/lib/mttr";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { getAllReleases } from "@/release/data";

const QASE_BASE_URL = (process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
const PROJECTS_FALLBACK = (process.env.NEXT_PUBLIC_QASE_PROJECTS || process.env.QASE_PROJECTS || "SFQ,PRINT,BOOKING,CDS,GMT")
  .split(",")
  .map((project) => project.trim())
  .filter(Boolean);

type ManualReleaseRecord = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  title?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  closedAt?: string | null;
  runId?: string | number | null;
  runSlug?: string | null;
  runName?: string | null;
  observations?: string | null;
  qaseProject?: string | null;
  app?: string | null;
  severity?: string | null;
  clientSlug?: string | null;
};

type ReleaseRunLookup = {
  slug: string;
  title: string | null;
};

export type CompanyDefectRecord = {
  id: string;
  slug: string;
  title: string;
  name: string;
  status: string;
  normalizedStatus: DefectStatus;
  origin: "manual" | "qase";
  sourceType: "manual" | "qase";
  projectCode: string | null;
  runId: number | null;
  runSlug: string | null;
  runName: string | null;
  description: string | null;
  severity: string | number | null;
  createdAt: string | null;
  updatedAt: string | null;
  openedAt: string | null;
  closedAt: string | null;
  externalUrl: string | null;
  mttrMs: number | null;
};

type IntegratedDefectLookupResult = {
  items: CompanyDefectRecord[];
  warning?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeProjectCode(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeNumericId(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function sortByMostRecent(items: CompanyDefectRecord[]) {
  return [...items].sort((left, right) => {
    const leftTime = Math.max(toTimestamp(left.updatedAt), toTimestamp(left.createdAt));
    const rightTime = Math.max(toTimestamp(right.updatedAt), toTimestamp(right.createdAt));
    return rightTime - leftTime;
  });
}

async function buildReleaseRunLookup(projectCodes: string[]) {
  const normalizedProjects = new Set(
    projectCodes
      .map((projectCode) => normalizeProjectCode(projectCode))
      .filter((projectCode): projectCode is string => Boolean(projectCode)),
  );

  const releases = await getAllReleases();
  const lookup = new Map<string, ReleaseRunLookup>();

  for (const release of releases) {
    const projectCode = normalizeProjectCode(release.qaseProject ?? release.project ?? release.app);
    const runId = normalizeNumericId(release.runId);
    if (!projectCode || !runId) continue;
    if (normalizedProjects.size > 0 && !normalizedProjects.has(projectCode)) continue;

    const key = `${projectCode}:${runId}`;
    if (lookup.has(key)) continue;

    lookup.set(key, {
      slug: release.slug,
      title: normalizeString(release.title),
    });
  }

  return lookup;
}

function normalizeIntegratedDefects(
  entities: unknown[],
  projectCode: string,
  releaseRunsByKey: Map<string, ReleaseRunLookup>,
): CompanyDefectRecord[] {
  const items: Array<CompanyDefectRecord | null> = entities.map((entity) => {
      const record = asRecord(entity) ?? {};
      const id = normalizeNumericId(record.id ?? record.defect_id);
      if (!id) return null;

      const title =
        normalizeString(record.title) ||
        normalizeString(record.name) ||
        `Defect ${id}`;
      const runId = normalizeNumericId(record.run_id ?? record.run);
      const runLookup = runId ? releaseRunsByKey.get(`${projectCode}:${runId}`) ?? null : null;
      const createdAt =
        normalizeString(record.created_at) ||
        normalizeString(record.createdAt) ||
        normalizeString(record.created) ||
        null;
      const updatedAt =
        normalizeString(record.updated_at) ||
        normalizeString(record.updatedAt) ||
        normalizeString(record.updated) ||
        null;
      const rawStatus = normalizeString(record.status) || "open";
      const normalizedStatus = normalizeDefectStatus(rawStatus);
      const openedAt = resolveOpenedAt(createdAt);
      const closedAt = resolveClosedAt(normalizedStatus, record.closed_at ?? record.closedAt, normalizedStatus === "done" ? updatedAt : null);
      const defectUrl =
        normalizeString(record.url) ||
        normalizeString(record.link) ||
        normalizeString(record.web_url) ||
        null;

      return {
        id: String(id),
        slug: normalizeString(record.slug) || `qase-${projectCode.toLowerCase()}-${id}`,
        title,
        name: title,
        status: rawStatus,
        normalizedStatus,
        origin: "qase",
        sourceType: "qase",
        projectCode,
        runId,
        runSlug: runLookup?.slug ?? (runId ? `qase-${projectCode.toLowerCase()}-${runId}` : null),
        runName: runLookup?.title ?? (runId ? `Run ${runId}` : null),
        description: normalizeString(record.description),
        severity:
          (typeof record.severity === "string" || typeof record.severity === "number")
            ? record.severity
            : normalizeString(record.severity_name),
        createdAt,
        updatedAt,
        openedAt,
        closedAt,
        externalUrl: defectUrl,
        mttrMs: calcMTTR(openedAt, closedAt),
      };
    });

  return items.filter((item): item is CompanyDefectRecord => item !== null);
}

async function fetchIntegratedProjectDefects(
  baseUrl: string,
  projectCode: string,
  token: string,
  releaseRunsByKey: Map<string, ReleaseRunLookup>,
) {
  if (!projectCode || !token) return [];

  const limit = 100;
  let offset = 0;
  const all: CompanyDefectRecord[] = [];

  while (true) {
    const response = await fetch(`${baseUrl}/v1/defect/${encodeURIComponent(projectCode)}?limit=${limit}&offset=${offset}`, {
      headers: { Token: token, Accept: "application/json" },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) break;

    const entities = (asRecord(asRecord(payload)?.result)?.entities as unknown[]) || [];
    if (!entities.length) break;

    all.push(...normalizeIntegratedDefects(entities, projectCode, releaseRunsByKey));

    if (entities.length < limit) break;
    offset += limit;
  }

  return all;
}

export async function getCompanyManualDefects(companySlug: string): Promise<CompanyDefectRecord[]> {
  const releases = await readManualReleaseStore();

  const items: Array<CompanyDefectRecord | null> = releases.map((release) => {
      const record = release as ManualReleaseRecord;
      if (resolveManualReleaseKind(release) !== "defect") return null;
      if ((record.clientSlug ?? null) !== companySlug) return null;

      const title = record.name ?? record.title ?? record.slug ?? record.id ?? "Defeito manual";
      const rawStatus = record.status ?? "open";
      const normalizedStatus = normalizeDefectStatus(rawStatus);
      const createdAt = normalizeString(record.createdAt) || new Date().toISOString();
      const updatedAt = normalizeString(record.updatedAt);
      const openedAt = resolveOpenedAt(createdAt);
      const closedAt = resolveClosedAt(normalizedStatus, record.closedAt ?? null, updatedAt);

      return {
        id: String(record.slug ?? record.id ?? title),
        slug: String(record.slug ?? record.id ?? title),
        title,
        name: title,
        status: rawStatus,
        normalizedStatus,
        origin: "manual",
        sourceType: "manual",
        projectCode: normalizeProjectCode(record.qaseProject ?? record.app),
        runId: normalizeNumericId(record.runId),
        runSlug: normalizeString(record.runSlug),
        runName: normalizeString(record.runName),
        description: normalizeString(record.observations),
        severity: record.severity ?? null,
        createdAt,
        updatedAt,
        openedAt,
        closedAt,
        externalUrl: null,
        mttrMs: calcMTTR(openedAt, closedAt),
      };
    });

  return sortByMostRecent(items.filter((item): item is CompanyDefectRecord => item !== null));
}

export async function getCompanyIntegratedDefects(
  companySlug: string,
  options?: { project?: string | null },
): Promise<IntegratedDefectLookupResult> {
  const requestedProject = normalizeProjectCode(options?.project);
  const qaseSettings = await getClientQaseSettings(companySlug);
  const token = qaseSettings?.token;

  if (!token) {
    return { items: [], warning: "QASE_API_TOKEN ausente" };
  }

  const baseUrl = (qaseSettings?.baseUrl || QASE_BASE_URL).replace(/\/+$/, "");
  const configuredProjects = Array.from(
    new Set(
      [
        ...(Array.isArray(qaseSettings?.projectCodes) ? qaseSettings.projectCodes : []),
        qaseSettings?.projectCode,
      ]
        .map((projectCode) => normalizeProjectCode(projectCode))
        .filter((projectCode): projectCode is string => Boolean(projectCode)),
    ),
  );
  const fallbackProjects = PROJECTS_FALLBACK
    .map((projectCode) => normalizeProjectCode(projectCode))
    .filter((projectCode): projectCode is string => Boolean(projectCode));
  const projects = requestedProject ? [requestedProject] : configuredProjects.length ? configuredProjects : fallbackProjects;

  if (!projects.length) {
    return { items: [], warning: "Nenhum projeto Qase configurado" };
  }

  const releaseRunsByKey = await buildReleaseRunLookup(projects);
  const lists = await Promise.all(
    projects.map((projectCode) => fetchIntegratedProjectDefects(baseUrl, projectCode, token, releaseRunsByKey)),
  );

  return { items: sortByMostRecent(lists.flat()) };
}

export async function getCompanyDefects(
  companySlug: string,
  options?: { project?: string | null },
): Promise<{ items: CompanyDefectRecord[]; warning?: string }> {
  const [manualDefects, integrated] = await Promise.all([
    getCompanyManualDefects(companySlug),
    getCompanyIntegratedDefects(companySlug, options),
  ]);

  return {
    items: sortByMostRecent([...manualDefects, ...integrated.items]),
    warning: integrated.warning,
  };
}
