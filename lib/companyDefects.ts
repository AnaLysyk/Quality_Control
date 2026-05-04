import "server-only";

import { readManualReleaseStore } from "@/data/manualData";
import { normalizeDefectStatus, resolveClosedAt, resolveOpenedAt, type DefectStatus } from "@/lib/defectNormalization";
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";
import type { DefectHistoryEvent } from "@/lib/manualDefectHistoryStore";
import { calcMTTR } from "@/lib/mttr";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { getAllReleases } from "@/release/data";

const QASE_BASE_URL = (process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
const PROJECTS_FALLBACK = (process.env.NEXT_PUBLIC_QASE_PROJECTS || process.env.QASE_PROJECTS || "SFQ,PRINT,BOOKING,CDS,GMT")
  .split(",")
  .map((project) => project.trim())
  .filter(Boolean);
const INTEGRATED_DEFECTS_TTL_MS = 30_000;
const ACCESSIBLE_QASE_PROJECTS_TTL_MS = 30_000;

type IntegratedDefectsCacheEntry = {
  expiresAt: number;
  result: IntegratedDefectLookupResult;
};

type CompanyDefectsGlobalState = typeof globalThis & {
  __qcIntegratedDefectsCache?: Map<string, IntegratedDefectsCacheEntry>;
  __qcAccessibleQaseProjectsCache?: Map<string, { expiresAt: number; items: AccessibleQaseProject[] }>;
};

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
  priority?: string | null;
  environments?: string[] | null;
  clientSlug?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
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
  priority: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  openedAt: string | null;
  closedAt: string | null;
  externalUrl: string | null;
  mttrMs: number | null;
  applicationName: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  environments: string[];
};

export type IntegratedProjectAccessStatus = {
  projectCode: string;
  accessible: boolean;
  reason: "ok" | "unauthorized" | "error";
  message: string | null;
  defectsCount: number;
};

type IntegratedDefectLookupResult = {
  items: CompanyDefectRecord[];
  warning?: string;
  projects: IntegratedProjectAccessStatus[];
};

type AccessibleQaseProject = {
  code: string;
  title: string | null;
};

function getIntegratedDefectsCache() {
  const globalState = globalThis as CompanyDefectsGlobalState;
  if (!globalState.__qcIntegratedDefectsCache) {
    globalState.__qcIntegratedDefectsCache = new Map<string, IntegratedDefectsCacheEntry>();
  }
  return globalState.__qcIntegratedDefectsCache;
}

function getAccessibleProjectsCache() {
  const globalState = globalThis as CompanyDefectsGlobalState;
  if (!globalState.__qcAccessibleQaseProjectsCache) {
    globalState.__qcAccessibleQaseProjectsCache = new Map();
  }
  return globalState.__qcAccessibleQaseProjectsCache;
}

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

function describeProjectAccessFailure(projectCode: string, status: number, payloadMessage?: string | null) {
  const message = normalizeString(payloadMessage);
  const normalizedMessage = (message ?? "").toLowerCase();

  if (status === 401 || status === 403) {
    return {
      reason: "unauthorized" as const,
      message: `Sem autorizacao para listar defeitos do projeto ${projectCode} no Qase.`,
    };
  }

  if (status === 404 && normalizedMessage.includes("/v1/v1/defect")) {
    return {
      reason: "error" as const,
      message: `A URL base do Qase esta configurada com /v1 duplicado; o projeto ${projectCode} nao pode ser consultado.`,
    };
  }

  if (status === 404) {
    return {
      reason: "error" as const,
      message: `O projeto ${projectCode} nao foi encontrado na integracao Qase configurada.`,
    };
  }

  return {
    reason: "error" as const,
    message: message ?? `Projeto ${projectCode} indisponivel no Qase (${status}).`,
  };
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

async function fetchAccessibleQaseProjects(baseUrl: string, token: string): Promise<AccessibleQaseProject[]> {
  const cacheKey = `${baseUrl}:${token}`;
  const cache = getAccessibleProjectsCache();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const limit = 100;
  let offset = 0;
  const all = new Map<string, AccessibleQaseProject>();

  while (true) {
    const response = await fetch(`${baseUrl}/v1/project?limit=${limit}&offset=${offset}`, {
      headers: { Token: token, Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      break;
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    const entities = (asRecord(asRecord(payload)?.result)?.entities as unknown[]) || [];
    if (!entities.length) break;

    for (const entity of entities) {
      const record = asRecord(entity);
      const code = normalizeString(record?.code);
      if (!code) continue;
      all.set(code, {
        code,
        title: normalizeString(record?.title),
      });
    }

    if (entities.length < limit) break;
    offset += limit;
  }

  const items = Array.from(all.values());
  cache.set(cacheKey, {
    expiresAt: Date.now() + ACCESSIBLE_QASE_PROJECTS_TTL_MS,
    items,
  });
  return items;
}

async function resolveQaseProjectCode(baseUrl: string, token: string, projectCode: string) {
  const normalizedProject = normalizeProjectCode(projectCode);
  if (!normalizedProject) return null;

  const accessibleProjects = await fetchAccessibleQaseProjects(baseUrl, token);
  const accessibleProjectMap = new Map(
    accessibleProjects
      .map((project) => {
        const normalized = normalizeProjectCode(project.code);
        return normalized ? [normalized, project.code] : null;
      })
      .filter((entry): entry is [string, string] => Boolean(entry)),
  );

  return accessibleProjectMap.get(normalizedProject) ?? projectCode;
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
        priority: null,
        createdAt,
        updatedAt,
        openedAt,
        closedAt,
        externalUrl: defectUrl,
        mttrMs: calcMTTR(openedAt, closedAt),
        applicationName: projectCode,
        createdByUserId: null,
        createdByName: null,
        assignedToUserId: null,
        assignedToName: null,
        environments: [],
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
  if (!projectCode || !token) {
    return {
      projectCode,
      accessible: false,
      reason: "error" as const,
      message: "Projeto Qase invalido",
      items: [] as CompanyDefectRecord[],
    };
  }

  const limit = 100;
  let offset = 0;
  const all: CompanyDefectRecord[] = [];

  try {
    while (true) {
      const response = await fetch(`${baseUrl}/v1/defect/${encodeURIComponent(projectCode)}?limit=${limit}&offset=${offset}`, {
        headers: { Token: token, Accept: "application/json" },
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        const payloadMessage =
          normalizeString(asRecord(payload)?.message) ??
          normalizeString(asRecord(asRecord(payload)?.status)?.message) ??
          normalizeString(asRecord(asRecord(payload)?.error)?.message);
        const failure = describeProjectAccessFailure(projectCode, response.status, payloadMessage);
        return {
          projectCode,
          accessible: false,
          reason: failure.reason,
          message: failure.message,
          items: [] as CompanyDefectRecord[],
        };
      }

      const entities = (asRecord(asRecord(payload)?.result)?.entities as unknown[]) || [];
      if (!entities.length) break;

      all.push(...normalizeIntegratedDefects(entities, projectCode, releaseRunsByKey));

      if (entities.length < limit) break;
      offset += limit;
    }
  } catch (error) {
    return {
      projectCode,
      accessible: false,
      reason: "error" as const,
      message: error instanceof Error ? error.message : `Projeto ${projectCode} indisponivel`,
      items: [] as CompanyDefectRecord[],
    };
  }

  return {
    projectCode,
    accessible: true,
    reason: "ok" as const,
    message: null,
    items: all,
  };
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
        priority: normalizeString(record.priority),
        createdAt,
        updatedAt,
        openedAt,
        closedAt,
        externalUrl: null,
        mttrMs: calcMTTR(openedAt, closedAt),
        applicationName: normalizeString(record.app) ?? normalizeProjectCode(record.qaseProject ?? record.app),
        createdByUserId: normalizeString(record.createdByUserId),
        createdByName: normalizeString(record.createdByName),
        assignedToUserId: normalizeString(record.assignedToUserId),
        assignedToName: normalizeString(record.assignedToName),
        environments: Array.isArray(record.environments)
          ? record.environments
              .map((environment) => normalizeString(environment))
              .filter((environment): environment is string => Boolean(environment))
          : [],
      };
    });

  return sortByMostRecent(items.filter((item): item is CompanyDefectRecord => item !== null));
}

export async function getCompanyIntegratedDefects(
  companySlug: string,
  options?: { project?: string | null; forceRefresh?: boolean },
): Promise<IntegratedDefectLookupResult> {
  const requestedProject = normalizeProjectCode(options?.project);
  const cacheKey = `${companySlug}:${requestedProject ?? "__all__"}`;
  const cache = getIntegratedDefectsCache();
  const cached = cache.get(cacheKey);
  if (!options?.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const qaseSettings = await getClientQaseSettings(companySlug);
  const token = qaseSettings?.token;

  if (!token) {
    const result = { items: [], warning: "QASE_API_TOKEN ausente", projects: [] as IntegratedProjectAccessStatus[] };
    cache.set(cacheKey, { expiresAt: Date.now() + INTEGRATED_DEFECTS_TTL_MS, result });
    return result;
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
    const result = { items: [], warning: "Nenhum projeto Qase configurado", projects: [] as IntegratedProjectAccessStatus[] };
    cache.set(cacheKey, { expiresAt: Date.now() + INTEGRATED_DEFECTS_TTL_MS, result });
    return result;
  }

  const releaseRunsByKey = await buildReleaseRunLookup(projects);
  const resolvedProjects = await Promise.all(projects.map((projectCode) => resolveQaseProjectCode(baseUrl, token, projectCode)));
  const projectResults = await Promise.all(
    resolvedProjects.map((projectCode) => fetchIntegratedProjectDefects(baseUrl, projectCode ?? "", token, releaseRunsByKey)),
  );
  const blockedProjects = projectResults.filter((project) => !project.accessible);
  const unauthorizedCount = blockedProjects.filter((project) => project.reason === "unauthorized").length;
  const errorCount = blockedProjects.length - unauthorizedCount;
  const warning = blockedProjects.length
    ? `${blockedProjects.length} projeto(s) Qase indisponivel(is): ${unauthorizedCount} sem autorizacao e ${errorCount} com falha tecnica.`
    : undefined;
  const result = {
    items: sortByMostRecent(projectResults.flatMap((project) => project.items)),
    warning,
    projects: projectResults.map((project) => ({
      projectCode: project.projectCode,
      accessible: project.accessible,
      reason: project.reason,
      message: project.message,
      defectsCount: project.items.length,
    })),
  };
  cache.set(cacheKey, { expiresAt: Date.now() + INTEGRATED_DEFECTS_TTL_MS, result });
  return result;
}

export async function getCompanyDefects(
  companySlug: string,
  options?: { project?: string | null; forceRefresh?: boolean },
): Promise<{ items: CompanyDefectRecord[]; warning?: string; integratedProjects: IntegratedProjectAccessStatus[] }> {
  const [manualDefects, integrated] = await Promise.all([
    getCompanyManualDefects(companySlug),
    getCompanyIntegratedDefects(companySlug, options),
  ]);

  return {
    items: sortByMostRecent([...manualDefects, ...integrated.items]),
    warning: integrated.warning,
    integratedProjects: integrated.projects,
  };
}

export async function getIntegratedDefectQaseHistory(
  companySlug: string,
  defect: { projectCode?: string | null; id?: string | number | null; status?: string | null; title?: string | null },
): Promise<{ events: DefectHistoryEvent[]; notice: string | null }> {
  const defectId = normalizeNumericId(defect.id);
  const configuredProject = normalizeProjectCode(defect.projectCode);
  if (!defectId || !configuredProject) {
    return { events: [], notice: null };
  }

  const qaseSettings = await getClientQaseSettings(companySlug);
  const token = qaseSettings?.token;
  if (!token) {
    return { events: [], notice: null };
  }

  const baseUrl = (qaseSettings?.baseUrl || QASE_BASE_URL).replace(/\/+$/, "");
  const resolvedProjectCode = await resolveQaseProjectCode(baseUrl, token, configuredProject);
  if (!resolvedProjectCode) {
    return { events: [], notice: null };
  }

  try {
    const response = await fetch(`${baseUrl}/v1/defect/${encodeURIComponent(resolvedProjectCode)}/${defectId}`, {
      headers: { Token: token, Accept: "application/json" },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      return { events: [], notice: null };
    }

    const result = asRecord(asRecord(payload)?.result);
    const createdAt =
      normalizeString(result?.created_at) ||
      normalizeString(result?.created) ||
      null;
    const updatedAt =
      normalizeString(result?.updated_at) ||
      normalizeString(result?.updated) ||
      null;
    const resolvedAt =
      normalizeString(result?.resolved_at) ||
      null;
    const rawStatus = normalizeString(result?.status) || normalizeString(defect.status) || "open";
    const normalizedStatus = normalizeDefectStatus(rawStatus);
    const title = normalizeString(result?.title) || normalizeString(defect.title) || `Defeito ${defectId}`;

    const events: DefectHistoryEvent[] = [];

    if (createdAt) {
      events.push({
        id: `qase-created-${resolvedProjectCode}-${defectId}`,
        defectSlug: `qase-${resolvedProjectCode.toLowerCase()}-${defectId}`,
        action: "created",
        createdAt,
        actorId: null,
        actorName: "Qase",
        note: title,
      });
    }

    if (updatedAt && updatedAt !== createdAt) {
      events.push({
        id: `qase-updated-${resolvedProjectCode}-${defectId}`,
        defectSlug: `qase-${resolvedProjectCode.toLowerCase()}-${defectId}`,
        action: "updated",
        createdAt: updatedAt,
        actorId: null,
        actorName: "Qase",
        note: "Ultima atualizacao refletida pela integracao Qase.",
      });
    }

    if (resolvedAt && normalizedStatus !== "open") {
      events.push({
        id: `qase-status-${resolvedProjectCode}-${defectId}`,
        defectSlug: `qase-${resolvedProjectCode.toLowerCase()}-${defectId}`,
        action: "status_changed",
        createdAt: resolvedAt,
        actorId: null,
        actorName: "Qase",
        fromStatus: "open",
        toStatus: normalizedStatus,
        note: "Status refletido a partir do Qase.",
      });
    }

    return {
      events: events.sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1)),
      notice:
        "O Qase nao expoe um historico detalhado de comentarios e mudancas nessa API. A linha do tempo mescla os marcos disponiveis do Qase com os eventos internos da plataforma.",
    };
  } catch {
    return { events: [], notice: null };
  }
}
