import "server-only";

import { mapQaseToKanban, type RawQaseEntity } from "@/utils/qaseMapper";
import { KanbanData } from "@/types/kanban";
import { createQaseClient, type QaseClient, QaseError } from "@/backend/qaseSdk";
import { getClientQaseSettings } from "@/backend/qaseConfig";

const FALLBACK_PROJECT = process.env.QASE_DEFAULT_PROJECT || process.env.QASE_PROJECT || "";
const FALLBACK_TOKEN = process.env.QASE_API_TOKEN || process.env.QASE_TOKEN || "";
const loggedPayload: Set<string> = new Set();
const QASE_RESULTS_PAGE_SIZE = 100;

type RunStatsRaw = {
  statuses?: Record<string, unknown>;
  passed?: unknown;
  failed?: unknown;
  blocked?: unknown;
  untested?: unknown;
  not_run?: unknown;
};

type RunEntity = {
  stats?: RunStatsRaw;
  [key: string]: unknown;
};

function toNumber(value: unknown) {
  const num = Number(value ?? 0);
  if (Number.isFinite(num)) return num;
  const parsed = Number.parseInt((value as string) ?? "", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRunStats(stats: RunStatsRaw) {
  const statuses = stats?.statuses ?? {};

  const pass = toNumber(stats?.passed ?? (statuses as Record<string, unknown>)?.passed);
  const fail = toNumber(stats?.failed ?? (statuses as Record<string, unknown>)?.failed);
  const blocked = toNumber(stats?.blocked ?? (statuses as Record<string, unknown>)?.blocked);
  const notRun = toNumber(
    stats?.untested ??
      (statuses as Record<string, unknown>)?.untested ??
      (stats as Record<string, unknown>)?.not_run
  );

  const total = pass + fail + blocked + notRun;
  const hasData = total > 0;

  return { pass, fail, blocked, notRun, total, hasData };
}

type RunStatsResult = {
  pass: number;
  fail: number;
  blocked: number;
  notRun: number;
  total: number;
  hasData: boolean;
  status?: number;
  missing?: boolean;
};

type QaseRuntimeContext = {
  client: QaseClient;
  projectCode: string;
  projectCodes: string[];
  slugKey: string;
  hasToken: boolean;
};

function normalizeProjectCode(value: string | null | undefined) {
  const trimmed = value?.trim().toUpperCase();
  return trimmed || "";
}

function normalizeProjectCodes(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => normalizeProjectCode(value)).filter(Boolean)));
}

function resolveProjectCode(input: {
  projectArg?: string;
  configuredProject?: string;
  configuredProjects?: string[];
}) {
  const projectCodes = normalizeProjectCodes([
    input.configuredProject,
    ...(input.configuredProjects ?? []),
    FALLBACK_PROJECT,
  ]);
  const requestedProject = normalizeProjectCode(input.projectArg);

  if (requestedProject) {
    const canonicalProject = projectCodes.find((code) => code === requestedProject);
    return {
      projectCode: canonicalProject ?? requestedProject,
      projectCodes,
    };
  }

  return {
    projectCode: normalizeProjectCode(input.configuredProject) || projectCodes[0] || "",
    projectCodes,
  };
}

function toOptionalString<T>(value: unknown, fallback: T): string | T {
  if (typeof value === "string") return value;
  return value != null ? String(value) : fallback;
}

function normalizeQaseEntity(raw: unknown): RawQaseEntity {
  if (typeof raw === "number" || (typeof raw === "string" && raw.trim())) {
    const caseId = Number(raw);
    return Number.isFinite(caseId) ? { case_id: caseId } : {};
  }

  const obj = (raw ?? {}) as Record<string, unknown>;
  const caseObj = (obj.case ?? obj.test_case ?? obj.testcase ?? null) as Record<string, unknown> | null;

  const caseIdRaw = obj.case_id ?? obj.caseId ?? caseObj?.id ?? caseObj?.case_id;
  const case_id = typeof caseIdRaw === "number" ? caseIdRaw : Number(caseIdRaw);

  const statusRaw = obj.status ?? obj.state ?? obj.status_text ?? obj.result;
  const status = toOptionalString(statusRaw, undefined);

  const titleRaw = obj.title ?? obj.case_title ?? caseObj?.title ?? caseObj?.name;
  const title = toOptionalString(titleRaw, undefined);

  const bugRaw = obj.bug ?? obj.defect ?? obj.defect_id;
  const bug = toOptionalString(bugRaw, null);

  return {
    case_id: Number.isFinite(case_id) ? case_id : undefined,
    status,
    title,
    bug,
  };
}

function extractQaseEntities(payload: unknown): unknown[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const root = payload as Record<string, unknown>;
  const result = (root.result ?? root.data ?? root.payload ?? null) as Record<string, unknown> | null;

  const candidates: unknown[] = [];
  const pushAll = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      candidates.push(...value);
      return;
    }
    if (typeof value === "object") {
      const rec = value as Record<string, unknown>;
      if (Array.isArray(rec.entities)) candidates.push(...rec.entities);
      if (Array.isArray(rec.items)) candidates.push(...rec.items);
      if (Array.isArray(rec.cases)) candidates.push(...rec.cases);
      if (Array.isArray(rec.results)) candidates.push(...rec.results);
      if (Array.isArray(rec.data)) candidates.push(...rec.data);
    }
  };

  pushAll(root.entities);
  pushAll(root.items);
  pushAll(root.cases);
  pushAll(root.results);
  pushAll(root.data);
  pushAll(result);
  pushAll(result?.entities);
  pushAll(result?.items);
  pushAll(result?.cases);
  pushAll(result?.results);
  pushAll(result?.data);

  return candidates.filter(Boolean);
}

async function buildQaseContext(projectArg: string | undefined, slug?: string): Promise<QaseRuntimeContext> {
  const normalizedSlug = slug?.trim().toLowerCase() ?? "";
  const settings = normalizedSlug ? await getClientQaseSettings(normalizedSlug) : null;

  const token = settings?.token ?? FALLBACK_TOKEN;
  const { projectCode, projectCodes } = resolveProjectCode({
    projectArg,
    configuredProject: settings?.projectCode,
    configuredProjects: settings?.projectCodes,
  });
  const slugKey = settings?.slug ?? (normalizedSlug || "global");

  const client = createQaseClient({
    token,
    baseUrl: settings?.baseUrl,
    defaultFetchOptions: { cache: "no-store" },
  });

  return {
    client,
    projectCode,
    projectCodes,
    slugKey,
    hasToken: Boolean(token),
  };
}

function resolveQaseErrorReason(status: number) {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status >= 500) return "server_error";
  return "unknown";
}

function buildLogUrl(client: QaseClient, path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(client.getUrl(path));
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

export async function getQaseRunStats(project: string, runId: number, slug?: string): Promise<RunStatsResult> {
  const normalizedEmpty = normalizeRunStats({});
  const ctx = await buildQaseContext(project, slug);
  const logBase = `[QASE][RUN]`;
  const effectiveProject = ctx.projectCode;
  const url = buildLogUrl(ctx.client, `/run/${effectiveProject}/${runId}`);
  console.log(`${logBase}[FETCH]`, { slug: ctx.slugKey, project: effectiveProject, runId, url });

  if (!ctx.hasToken) {
    console.warn(`${logBase}[ERROR]`, {
      slug: ctx.slugKey,
      status: "no_token",
      fallback: "EMPTY_STATS",
    });
    return { ...normalizedEmpty, missing: true, status: 0 };
  }

  if (!effectiveProject) {
    console.warn(`${logBase}[ERROR]`, {
      slug: ctx.slugKey,
      status: "missing_project",
      fallback: "EMPTY_STATS",
    });
    return { ...normalizedEmpty, missing: true, status: 0 };
  }

  try {
    const { data, status } = await ctx.client.getWithStatus<{ result?: RunEntity }>(
      `/run/${effectiveProject}/${runId}`
    );
    console.log(`${logBase}[RESPONSE]`, { slug: ctx.slugKey, status });

    const run = data.result;

    if (!loggedPayload.has(ctx.slugKey)) {
      console.log(`${logBase}[PAYLOAD]`, { slug: ctx.slugKey, payload: data });
      console.log(`${logBase}[PAYLOAD][STATS]`, { slug: ctx.slugKey, stats: run?.stats });
      loggedPayload.add(ctx.slugKey);
    }

    const normalized = normalizeRunStats((run?.stats as RunStatsRaw) ?? {});
    return { ...normalized, status };
  } catch (err) {
    const status = err instanceof QaseError ? err.status : 0;
    const reason = resolveQaseErrorReason(status);
    console.warn(`${logBase}[ERROR]`, {
      slug: ctx.slugKey,
      status,
      reason,
      fallback: "EMPTY_STATS",
    });
    return { ...normalizedEmpty, missing: true, status };
  }
}

async function fetchAllQaseResults(ctx: QaseRuntimeContext, runId: number): Promise<RawQaseEntity[]> {
  const logBase = "[KANBAN][CASES]";

  if (!ctx.hasToken) {
    console.warn(logBase, {
      slug: ctx.slugKey,
      status: "no_token",
      reason: "missing_token",
      fallback: "EMPTY_CASES",
    });
    return [];
  }

  if (!ctx.projectCode) {
    console.warn(logBase, {
      slug: ctx.slugKey,
      status: "missing_project",
      fallback: "EMPTY_CASES",
    });
    return [];
  }

  const pageSize = QASE_RESULTS_PAGE_SIZE;
  const all: RawQaseEntity[] = [];

  let offset = 0;
  while (true) {
    const params = { run: String(runId), limit: pageSize, offset };
    const url = buildLogUrl(ctx.client, `/result/${ctx.projectCode}`, params);
    console.log(`${logBase}[RESULTS][FETCH]`, { slug: ctx.slugKey, project: ctx.projectCode, runId, url });

    try {
      const { data, status } = await ctx.client.getWithStatus<{ result?: { entities?: unknown[] } }>(
        `/result/${ctx.projectCode}`,
        { params },
      );
      console.log(`${logBase}[RESULTS][RESPONSE]`, { slug: ctx.slugKey, status });

      const entities = extractQaseEntities(data);
      if (!entities.length) break;
      all.push(...entities.map(normalizeQaseEntity));
      if (entities.length < pageSize) break;
      offset += pageSize;
    } catch (err) {
      const status = err instanceof QaseError ? err.status : 0;
      console.warn(`${logBase}[RESULTS][ERROR]`, { slug: ctx.slugKey, status, query: "run" });
      return [];
    }
  }

  if (!all.length) {
    console.warn(`${logBase} No data available for runId=${runId}`);
  }

  return all;
}

export async function getQaseRunResults(project: string, runId: number, slug?: string) {
  const ctx = await buildQaseContext(project, slug);
  return fetchAllQaseResults(ctx, runId);
}

export async function getQaseRunCases(project: string, runId: number, slug?: string): Promise<RawQaseEntity[]> {
  const ctx = await buildQaseContext(project, slug);
  const logBase = "[KANBAN][CASES]";

  if (!ctx.hasToken) {
    console.warn(logBase, {
      slug: ctx.slugKey,
      status: "no_token",
      reason: "missing_token",
      fallback: "EMPTY_CASES",
    });
    return [];
  }

  if (!ctx.projectCode) {
    console.warn(logBase, {
      slug: ctx.slugKey,
      status: "missing_project",
      fallback: "EMPTY_CASES",
    });
    return [];
  }

  try {
    const params = { include: "cases" };
    const url = buildLogUrl(ctx.client, `/run/${ctx.projectCode}/${runId}`, params);
    console.log(`${logBase}[RUN][FETCH]`, { slug: ctx.slugKey, project: ctx.projectCode, runId, url });

    const { data, status } = await ctx.client.getWithStatus<{ result?: { entities?: unknown[] } }>(
      `/run/${ctx.projectCode}/${runId}`,
      { params },
    );
    console.log(`${logBase}[RUN][RESPONSE]`, { slug: ctx.slugKey, status });

    const runCases = extractQaseEntities(data).map(normalizeQaseEntity).filter((item) => item.case_id);
    if (runCases.length) return runCases;
  } catch (err) {
    const status = err instanceof QaseError ? err.status : 0;
    if (status !== 400 && status !== 404) {
      console.warn(`${logBase}[RUN][ERROR]`, { slug: ctx.slugKey, status });
      return [];
    }
  }

  console.warn(`${logBase} cases include unavailable for runId=${runId} - trying /result?run=`);
  return fetchAllQaseResults(ctx, runId);
}

export async function getQaseRunKanban(project: string, runId: number, slug?: string): Promise<KanbanData> {
  const raw = await getQaseRunCases(project, runId, slug);
  return mapQaseToKanban(raw);
}

export async function getRunDetails(project: string, runId: number, slug?: string) {
  return getQaseRunStats(project, runId, slug);
}

