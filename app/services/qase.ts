import "server-only";

import { mapQaseToKanban, type RawQaseEntity } from "@/utils/qaseMapper";
import { KanbanData } from "@/types/kanban";
import { createQaseClient, type QaseClient, QaseError } from "@/lib/qaseSdk";
import { getClientQaseSettings } from "@/lib/qaseConfig";

const FALLBACK_PROJECT = process.env.QASE_DEFAULT_PROJECT || process.env.QASE_PROJECT || "";
const FALLBACK_TOKEN = process.env.QASE_API_TOKEN || process.env.QASE_TOKEN || "";
const loggedPayload: Set<string> = new Set();

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
  const parsed = parseInt((value as string) ?? "", 10);
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
  slugKey: string;
  hasToken: boolean;
};

async function buildQaseContext(projectArg: string | undefined, slug?: string): Promise<QaseRuntimeContext> {
  const normalizedSlug = slug?.trim().toLowerCase() ?? "";
  const settings = normalizedSlug ? await getClientQaseSettings(normalizedSlug) : null;

  const token = settings?.token ?? FALLBACK_TOKEN;
  const projectCode = projectArg || settings?.projectCode || FALLBACK_PROJECT || "";
  const slugKey = settings?.slug ?? (normalizedSlug || "global");

  const client = createQaseClient({
    token,
    defaultFetchOptions: { cache: "no-store" },
  });

  return {
    client,
    projectCode,
    slugKey,
    hasToken: Boolean(token),
  };
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
    const reason =
      status === 401 || status === 403
        ? "unauthorized"
        : status === 404
          ? "not_found"
          : status >= 500
            ? "server_error"
            : "unknown";
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

  const pageSize = 250;
  let offset = 0;
  const all: RawQaseEntity[] = [];

  while (true) {
    const params = { run_id: runId, limit: pageSize, offset };
    const url = buildLogUrl(ctx.client, `/result/${ctx.projectCode}`, params);
    console.log(`${logBase}[FALLBACK][FETCH]`, { slug: ctx.slugKey, project: ctx.projectCode, runId, url });

    try {
      const { data, status } = await ctx.client.getWithStatus<{ result?: { entities?: unknown[] } }>(
        `/result/${ctx.projectCode}`,
        { params }
      );
      console.log(`${logBase}[FALLBACK][RESPONSE]`, { slug: ctx.slugKey, status });

      const entities = (data.result?.entities ?? []) as RawQaseEntity[];
      if (!entities.length) break;

      all.push(...entities);
      offset += pageSize;
    } catch (err) {
      if (err instanceof QaseError && err.status === 404) {
        break;
      }
      const status = err instanceof QaseError ? err.status : 0;
      console.warn(`${logBase}[FALLBACK][ERROR]`, { slug: ctx.slugKey, status });
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

  const pageSize = 200;
  let page = 1;
  const allCases: RawQaseEntity[] = [];
  let hasMore = true;

  while (hasMore) {
    const params = { page, limit: pageSize };
    const url = buildLogUrl(ctx.client, `/run/${ctx.projectCode}/${runId}/cases`, params);
    console.log(`${logBase}[FETCH]`, { slug: ctx.slugKey, project: ctx.projectCode, runId, url });

    try {
      const { data, status } = await ctx.client.getWithStatus<{ result?: { entities?: unknown[] } }>(
        `/run/${ctx.projectCode}/${runId}/cases`,
        { params }
      );
      console.log(`${logBase}[RESPONSE]`, { slug: ctx.slugKey, status });

      const entities = (data.result?.entities ?? []) as RawQaseEntity[];
      allCases.push(...entities);

      if (entities.length < pageSize) {
        hasMore = false;
      } else {
        page += 1;
      }
    } catch (err) {
      if (err instanceof QaseError && err.status === 404) {
        console.warn(`${logBase} 404 for runId=${runId} - trying /result`);
        const fallback = await fetchAllQaseResults(ctx, runId);
        if (!fallback.length) {
          console.warn(`${logBase} No data available for runId=${runId}`);
        }
        return fallback;
      }

      const status = err instanceof QaseError ? err.status : 0;
      console.warn(`${logBase}[ERROR]`, { slug: ctx.slugKey, status });
      return [];
    }
  }

  return allCases;
}

export async function getQaseRunKanban(project: string, runId: number, slug?: string): Promise<KanbanData> {
  const raw = await getQaseRunCases(project, runId, slug);
  return mapQaseToKanban(raw);
}

export async function getRunDetails(project: string, runId: number, slug?: string) {
  return getQaseRunStats(project, runId, slug);
}
