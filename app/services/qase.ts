// app/services/qase.ts

import "server-only";

import { mapQaseToKanban, type RawQaseEntity } from "@/utils/qaseMapper";
import { KanbanData } from "@/types/kanban";
import { createQaseClient, QaseError } from "@/lib/qaseSdk";

const qaseClient = createQaseClient({
  defaultFetchOptions: { cache: "no-store" },
});

// throttle de payload por slug para não poluir logs
const loggedPayload: Set<string> = new Set();

function buildLogUrl(path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(qaseClient.getUrl(path));
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

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

function toNumber(value: unknown): number {
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
    stats?.untested ?? (statuses as Record<string, unknown>)?.untested ?? (stats as Record<string, unknown>)?.not_run
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

export async function getQaseRunStats(project: string, runId: number, slug?: string): Promise<RunStatsResult> {
  const normalizedEmpty = normalizeRunStats({});
  const slugKey = slug || "unknown";

  const logBase = `[QASE][RUN]`;
  const url = buildLogUrl(`/run/${project}/${runId}`);
  console.log(`${logBase}[FETCH]`, { slug: slugKey, project, runId, url });

  if (!qaseClient.hasToken) {
    console.warn(`${logBase}[ERROR]`, {
      slug: slugKey,
      status: "no_token",
      fallback: "EMPTY_STATS",
    });
    return { ...normalizedEmpty, missing: true, status: 0 };
  }

  try {
    const { data, status } = await qaseClient.getWithStatus<{ result?: RunEntity }>(
      `/run/${project}/${runId}`
    );
    console.log(`${logBase}[RESPONSE]`, { slug: slugKey, status });

    const run = data.result;

    if (!loggedPayload.has(slugKey)) {
      console.log(`${logBase}[PAYLOAD]`, { slug: slugKey, payload: data });
      console.log(`${logBase}[PAYLOAD][STATS]`, { slug: slugKey, stats: run?.stats });
      loggedPayload.add(slugKey);
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
      slug: slugKey,
      status,
      reason,
      fallback: "EMPTY_STATS",
    });
    return { ...normalizedEmpty, missing: true, status };
  }
}

// Busca todos os resultados de uma run com paginação ilimitada (limite 250).
async function fetchAllQaseResults(project: string, runId: number, slug?: string): Promise<RawQaseEntity[]> {
  const logBase = "[KANBAN][CASES]";
  const slugKey = slug || "unknown";

  if (!qaseClient.hasToken) {
    console.warn(logBase, {
      slug: slugKey,
      status: "no_token",
      reason: "missing_token",
      fallback: "EMPTY_CASES",
    });
    return [];
  }

  const pageSize = 250;
  let offset = 0;
  const all: RawQaseEntity[] = [];

  while (true) {
    const params = { run_id: runId, limit: pageSize, offset };
    const url = buildLogUrl(`/result/${project}`, params);
    console.log(`${logBase}[FALLBACK][FETCH]`, { slug: slugKey, project, runId, url });

    try {
      const { data, status } = await qaseClient.getWithStatus<{ result?: { entities?: unknown[] } }>(
        `/result/${project}`,
        { params }
      );
      console.log(`${logBase}[FALLBACK][RESPONSE]`, { slug: slugKey, status });

      const entities = (data.result?.entities ?? []) as RawQaseEntity[];
      if (!entities.length) break;

      all.push(...entities);
      offset += pageSize;
    } catch (err) {
      if (err instanceof QaseError && err.status === 404) {
        break;
      }
      const status = err instanceof QaseError ? err.status : 0;
      console.warn(`${logBase}[FALLBACK][ERROR]`, { slug: slugKey, status });
      return [];
    }
  }

  if (!all.length) {
    console.warn(`${logBase} No data available for runId=${runId}`);
  }

  return all;
}

export async function getQaseRunResults(project: string, runId: number, slug?: string) {
  try {
    return await fetchAllQaseResults(project, runId, slug);
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function getQaseRunCases(project: string, runId: number, slug?: string): Promise<RawQaseEntity[]> {
  const logBase = "[KANBAN][CASES]";
  const slugKey = slug || "unknown";

  if (!qaseClient.hasToken) {
    console.warn(logBase, {
      slug: slugKey,
      status: "no_token",
      reason: "missing_token",
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
    const url = buildLogUrl(`/run/${project}/${runId}/cases`, params);
    console.log(`${logBase}[FETCH]`, { slug: slugKey, project, runId, url });

    try {
      const { data, status } = await qaseClient.getWithStatus<{ result?: { entities?: unknown[] } }>(
        `/run/${project}/${runId}/cases`,
        { params }
      );
      console.log(`${logBase}[RESPONSE]`, { slug: slugKey, status });

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
        const fallback = await fetchAllQaseResults(project, runId, slug);
        if (!fallback.length) {
          console.warn(`${logBase} No data available for runId=${runId}`);
        }
        return fallback;
      }

      const status = err instanceof QaseError ? err.status : 0;
      console.warn(`${logBase}[ERROR]`, { slug: slugKey, status });
      return [];
    }
  }

  return allCases;
}

export async function getQaseRunKanban(
  project: string,
  runId: number,
  slug?: string
): Promise<KanbanData> {
  const raw = await getQaseRunCases(project, runId, slug);
  return mapQaseToKanban(raw);
}

// Alias para obter detalhes completos da run (usado no template)
export async function getRunDetails(project: string, runId: number, slug?: string) {
  return getQaseRunStats(project, runId, slug);
}
