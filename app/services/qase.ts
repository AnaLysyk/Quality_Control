// app/services/qase.ts

import { mapQaseToKanban, type RawQaseEntity } from "@/utils/qaseMapper";
import { KanbanData } from "@/types/kanban";

const API_BASE = "https://api.qase.io/v1";
const QASE_TOKEN =
  process.env.QASE_TOKEN ||
  process.env.NEXT_PUBLIC_QASE_TOKEN ||
  process.env.NEXT_PUBLIC_QASE_API_TOKEN;

const headers = {
  Accept: "application/json",
  Token: QASE_TOKEN ?? "",
};

// throttle de payload por slug para não poluir logs
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
  const url = `${API_BASE}/run/${project}/${runId}`;
  console.log(`${logBase}[FETCH]`, { slug: slugKey, project, runId, url });

  if (!QASE_TOKEN) {
    console.warn(`${logBase}[ERROR]`, {
      slug: slugKey,
      status: "no_token",
      fallback: "EMPTY_STATS",
    });
    return { ...normalizedEmpty, missing: true, status: 0 };
  }

  const res = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const reason =
      res.status === 401 || res.status === 403
        ? "unauthorized"
        : res.status === 404
          ? "not_found"
          : res.status >= 500
            ? "server_error"
            : "unknown";
    console.warn(`${logBase}[ERROR]`, {
      slug: slugKey,
      status: res.status,
      reason,
      fallback: "EMPTY_STATS",
    });
    return { ...normalizedEmpty, missing: true, status: res.status };
  }

  console.log(`${logBase}[RESPONSE]`, { slug: slugKey, status: res.status });

  const json = (await res.json()) as { result?: RunEntity };
  const run = json.result;

  if (!loggedPayload.has(slugKey)) {
    console.log(`${logBase}[PAYLOAD]`, { slug: slugKey, payload: json });
    console.log(`${logBase}[PAYLOAD][STATS]`, { slug: slugKey, stats: run?.stats });
    loggedPayload.add(slugKey);
  }

  const normalized = normalizeRunStats((run?.stats as RunStatsRaw) ?? {});
  return { ...normalized, status: res.status };
}

// Busca todos os resultados de uma run com paginação ilimitada (limite 250).
async function fetchAllQaseResults(project: string, runId: number, slug?: string): Promise<RawQaseEntity[]> {
  const logBase = "[KANBAN][CASES]";
  const slugKey = slug || "unknown";

  if (!QASE_TOKEN) {
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
    const url = `${API_BASE}/result/${project}?run_id=${runId}&limit=${pageSize}&offset=${offset}`;
    console.log(`${logBase}[FALLBACK][FETCH]`, { slug: slugKey, project, runId, url });
    const res = await fetch(url, {
      headers,
      cache: "no-store",
    });
    console.log(`${logBase}[FALLBACK][RESPONSE]`, { slug: slugKey, status: res.status });

    if (res.status === 404) {
      break;
    }

    if (res.status >= 400 && res.status < 500) {
      console.warn(`${logBase}[FALLBACK][ERROR]`, { slug: slugKey, status: res.status });
      return [];
    }

    if (!res.ok) {
      console.warn(`${logBase}[FALLBACK][ERROR]`, { slug: slugKey, status: res.status });
      return [];
    }

    const json = (await res.json()) as { result?: { entities?: unknown[] } };
    const entities = (json.result?.entities ?? []) as RawQaseEntity[];
    if (!entities.length) break;

    all.push(...entities);
    offset += pageSize;
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

  if (!QASE_TOKEN) {
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
    const url = `${API_BASE}/run/${project}/${runId}/cases?page=${page}&limit=${pageSize}`;
    console.log(`${logBase}[FETCH]`, { slug: slugKey, project, runId, url });
    const res = await fetch(url, {
      headers,
      cache: "no-store",
    });

    console.log(`${logBase}[RESPONSE]`, { slug: slugKey, status: res.status });

    if (res.status === 404) {
      console.warn(`${logBase} 404 for runId=${runId} — trying /result`);
      const fallback = await fetchAllQaseResults(project, runId, slug);
      if (!fallback.length) {
        console.warn(`${logBase} No data available for runId=${runId}`);
      }
      return fallback;
    }

    if (!res.ok) {
      console.warn(`${logBase}[ERROR]`, { slug: slugKey, status: res.status });
      return [];
    }

    const json = (await res.json()) as { result?: { entities?: unknown[] } };
    const entities = (json.result?.entities ?? []) as RawQaseEntity[];
    allCases.push(...entities);

    if (entities.length < pageSize) {
      hasMore = false;
    } else {
      page += 1;
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
