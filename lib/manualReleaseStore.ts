import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Release } from "@/types/release";
import { shouldUsePostgresPersistence } from "@/database/persistenceMode";
import { getRedis, isRedisConfigured } from "@/lib/redis";
import { shouldUseJsonStore } from "@/lib/storeMode";

const USE_POSTGRES = shouldUsePostgresPersistence();
const USE_JSON_STORE = shouldUseJsonStore();
async function getPrisma() {
  const { prisma } = await import("@/database/prismaClient");
  return prisma;
}

const DEFECT_META_PREFIX = "__qc_defect_meta__:";
const RUN_META_PREFIX = "__qc_run_meta__:";

function parseReleaseSummary(summary?: string | null) {
  const raw = typeof summary === "string" ? summary.trim() : "";
  if (!raw) return { summary: undefined, severity: null, priority: null };
  if (!raw.startsWith(DEFECT_META_PREFIX)) {
    return { summary: raw, severity: null, priority: null };
  }
  try {
    const parsed = JSON.parse(raw.slice(DEFECT_META_PREFIX.length)) as {
      summary?: unknown;
      severity?: unknown;
      priority?: unknown;
    };
    return {
      summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : undefined,
      severity: typeof parsed.severity === "string" && parsed.severity.trim() ? parsed.severity.trim() : null,
      priority: typeof parsed.priority === "string" && parsed.priority.trim() ? parsed.priority.trim() : null,
    };
  } catch {
    return { summary: undefined, severity: null, priority: null };
  }
}

function parseReleaseCategory(category?: string | null): {
  category?: string;
  testPlanId: string | null;
  testPlanName: string | null;
  testPlanSource: "manual" | "qase" | null;
  testPlanProjectCode: string | null;
} {
  const raw = typeof category === "string" ? category.trim() : "";
  if (!raw) {
    return {
      category: undefined,
      testPlanId: null,
      testPlanName: null,
      testPlanSource: null,
      testPlanProjectCode: null,
    };
  }
  if (!raw.startsWith(RUN_META_PREFIX)) {
    return {
      category: raw,
      testPlanId: null,
      testPlanName: null,
      testPlanSource: null,
      testPlanProjectCode: null,
    };
  }
  try {
    const parsed = JSON.parse(raw.slice(RUN_META_PREFIX.length)) as {
      category?: unknown;
      testPlanId?: unknown;
      testPlanName?: unknown;
      testPlanSource?: unknown;
      testPlanProjectCode?: unknown;
    };
    return {
      category:
        typeof parsed.category === "string" && parsed.category.trim() ? parsed.category.trim() : undefined,
      testPlanId:
        typeof parsed.testPlanId === "string" && parsed.testPlanId.trim() ? parsed.testPlanId.trim() : null,
      testPlanName:
        typeof parsed.testPlanName === "string" && parsed.testPlanName.trim()
          ? parsed.testPlanName.trim()
          : null,
      testPlanSource:
        parsed.testPlanSource === "manual" || parsed.testPlanSource === "qase"
          ? parsed.testPlanSource
          : null,
      testPlanProjectCode:
        typeof parsed.testPlanProjectCode === "string" && parsed.testPlanProjectCode.trim()
          ? parsed.testPlanProjectCode.trim()
          : null,
    };
  } catch {
    return {
      category: undefined,
      testPlanId: null,
      testPlanName: null,
      testPlanSource: null,
      testPlanProjectCode: null,
    };
  }
}

function encodeReleaseSummary(release: Release) {
  if ((release.kind ?? "run") !== "defect") {
    return typeof release.summary === "string" && release.summary.trim() ? release.summary.trim() : null;
  }
  const payload = {
    summary: typeof release.summary === "string" && release.summary.trim() ? release.summary.trim() : undefined,
    severity: typeof release.severity === "string" && release.severity.trim() ? release.severity.trim() : undefined,
    priority: typeof release.priority === "string" && release.priority.trim() ? release.priority.trim() : undefined,
  };
  if (!payload.summary && !payload.severity && !payload.priority) return null;
  return `${DEFECT_META_PREFIX}${JSON.stringify(payload)}`;
}

function encodeReleaseCategory(release: Release) {
  if ((release.kind ?? "run") !== "run") {
    return typeof release.category === "string" && release.category.trim() ? release.category.trim() : null;
  }

  const payload = {
    category: typeof release.category === "string" && release.category.trim() ? release.category.trim() : undefined,
    testPlanId:
      typeof release.testPlanId === "string" && release.testPlanId.trim() ? release.testPlanId.trim() : undefined,
    testPlanName:
      typeof release.testPlanName === "string" && release.testPlanName.trim()
        ? release.testPlanName.trim()
        : undefined,
    testPlanSource: release.testPlanSource === "manual" || release.testPlanSource === "qase" ? release.testPlanSource : undefined,
    testPlanProjectCode:
      typeof release.testPlanProjectCode === "string" && release.testPlanProjectCode.trim()
        ? release.testPlanProjectCode.trim()
        : undefined,
  };

  if (
    !payload.category &&
    !payload.testPlanId &&
    !payload.testPlanName &&
    !payload.testPlanSource &&
    !payload.testPlanProjectCode
  ) {
    return null;
  }

  return `${RUN_META_PREFIX}${JSON.stringify(payload)}`;
}

function pgToRelease(r: { id: string; slug: string; title: string; summary?: string | null; app?: string | null; qaseProject?: string | null; category?: string | null; kind?: string | null; runSlug?: string | null; runName?: string | null; companySlug?: string | null; environments: string[]; source: string; status: string; runId?: number | null; statsPass: number; statsFail: number; statsBlocked: number; statsNotRun: number; observations?: string | null; createdByUserId?: string | null; createdByName?: string | null; assignedToUserId?: string | null; assignedToName?: string | null; closedAt?: Date | null; createdAt: Date; updatedAt: Date }): Release {
  const parsedSummary = parseReleaseSummary(r.summary);
  const parsedCategory = parseReleaseCategory(r.category);
  return { id: r.id, slug: r.slug, name: r.title, summary: parsedSummary.summary, app: r.app ?? "", qaseProject: r.qaseProject ?? undefined, category: parsedCategory.category, kind: (r.kind as "run" | "defect") ?? "run", runSlug: r.runSlug ?? undefined, runName: r.runName ?? undefined, testPlanId: parsedCategory.testPlanId, testPlanName: parsedCategory.testPlanName, testPlanSource: parsedCategory.testPlanSource, testPlanProjectCode: parsedCategory.testPlanProjectCode, clientSlug: r.companySlug ?? null, environments: r.environments ?? [], source: r.source as "MANUAL" | "API", status: r.status as Release["status"], runId: r.runId ?? undefined, stats: { pass: r.statsPass, fail: r.statsFail, blocked: r.statsBlocked, notRun: r.statsNotRun }, observations: r.observations ?? undefined, severity: parsedSummary.severity, priority: parsedSummary.priority, createdByUserId: r.createdByUserId ?? null, createdByName: r.createdByName ?? null, assignedToUserId: r.assignedToUserId ?? null, assignedToName: r.assignedToName ?? null, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), closedAt: r.closedAt?.toISOString() ?? null };
}

export type ManualCaseItem = {
  id: string;
  title?: string;
  link?: string;
  status?: string;
  bug?: string | null;
  fromApi?: boolean;
  origin?: string | null;
  type?: "manual" | "automated" | "hybrid" | string | null;
  projectCode?: string | null;
  suiteId?: string | null;
  suiteName?: string | null;
  description?: string | null;
  preconditions?: string | null;
  postconditions?: string | null;
  stepsText?: string | null;
  expectedText?: string | null;
  priority?: string | null;
  severity?: string | null;
  tags?: string[];
  responsibleName?: string | null;
  defectsCount?: number;
  evidencesCount?: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  statusUpdatedAt?: string | null;
  retestCount?: number;
};

type StoreState<T> = {
  initialized: boolean;
  data: T;
};

type GlobalStores = {
  __qcManualStores?: Record<string, StoreState<unknown>>;
};

const USE_MEMORY_STORE = process.env.MANUAL_RELEASES_IN_MEMORY === "true";
const USE_REDIS = isRedisConfigured();
const REDIS_RELEASES_KEY = "qc:manualReleases";
const REDIS_CASES_KEY = "qc:manualReleaseCases";
const STORE_BASE_DIR =
  process.env.LOCAL_AUTH_DATA_DIR ||
  (USE_JSON_STORE ? path.join(process.cwd(), ".tmp", "e2e") : path.join(process.cwd(), "data"));
const JSON_RELEASES_PATH = path.join(STORE_BASE_DIR, "manual-releases.json");
const JSON_RELEASE_CASES_PATH = path.join(STORE_BASE_DIR, "manual-release-cases.json");

function getGlobalStore<T>(key: string, fallback: T): StoreState<T> {
  const globalStores = (globalThis as GlobalStores).__qcManualStores ?? {};
  const existing = globalStores[key];
  if (existing) {
    (globalThis as GlobalStores).__qcManualStores = globalStores;
    return existing as StoreState<T>;
  }
  const created: StoreState<T> = { initialized: false, data: fallback };
  globalStores[key] = created as StoreState<unknown>;
  (globalThis as GlobalStores).__qcManualStores = globalStores;
  return created;
}

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

async function readRedisJson<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedis();
    const raw = await redis.get<string>(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeRedisJson<T>(key: string, value: T) {
  const redis = getRedis();
  await redis.set(key, JSON.stringify(value));
}

async function readJsonStore<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonStore<T>(filePath: string, value: T) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function readManualReleases(): Promise<Release[]> {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.release.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(pgToRelease);
  }

  if (USE_JSON_STORE) {
    const releases = await readJsonStore<Release[]>(JSON_RELEASES_PATH, []);
    return Array.isArray(releases) ? releases.filter(Boolean) : [];
  }

  if (!USE_MEMORY_STORE && USE_REDIS) {
    const cached = await readRedisJson<Release[]>(REDIS_RELEASES_KEY);
    if (cached) return Array.isArray(cached) ? cached.filter(Boolean) : [];
    const normalized: Release[] = [];
    await writeRedisJson(REDIS_RELEASES_KEY, normalized);
    return normalized;
  }

  const store = getGlobalStore<Release[]>("manualReleases", []);
  if (!store.initialized) {
    store.data = [];
    store.initialized = true;
  }
  return clone(store.data);
}

export async function writeManualReleases(releases: Release[]) {
  const next = Array.isArray(releases) ? releases.filter(Boolean) : [];
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const existingSlugs = (await prisma.release.findMany({ select: { slug: true } })).map((r) => r.slug);
    const incomingSlugs = next.map((r) => r.slug);
    const toDelete = existingSlugs.filter((s) => !incomingSlugs.includes(s));
    if (toDelete.length) await prisma.release.deleteMany({ where: { slug: { in: toDelete } } });
    for (const r of next) {
      await prisma.release.upsert({ where: { slug: r.slug }, create: { id: r.id, slug: r.slug, title: r.name, summary: encodeReleaseSummary(r), app: r.app ?? null, qaseProject: r.qaseProject ?? null, category: encodeReleaseCategory(r), kind: r.kind ?? "run", runSlug: r.runSlug ?? null, runName: r.runName ?? null, companySlug: r.clientSlug ?? null, environments: r.environments ?? [], source: r.source, status: r.status, runId: r.runId ?? null, statsPass: r.stats?.pass ?? 0, statsFail: r.stats?.fail ?? 0, statsBlocked: r.stats?.blocked ?? 0, statsNotRun: r.stats?.notRun ?? 0, observations: r.observations ?? null, createdByUserId: r.createdByUserId ?? null, createdByName: r.createdByName ?? null, assignedToUserId: r.assignedToUserId ?? null, assignedToName: r.assignedToName ?? null, closedAt: r.closedAt ? new Date(r.closedAt) : null }, update: { title: r.name, summary: encodeReleaseSummary(r), app: r.app ?? null, qaseProject: r.qaseProject ?? null, category: encodeReleaseCategory(r), kind: r.kind ?? "run", runSlug: r.runSlug ?? null, runName: r.runName ?? null, companySlug: r.clientSlug ?? null, environments: r.environments ?? [], source: r.source, status: r.status, runId: r.runId ?? null, statsPass: r.stats?.pass ?? 0, statsFail: r.stats?.fail ?? 0, statsBlocked: r.stats?.blocked ?? 0, statsNotRun: r.stats?.notRun ?? 0, observations: r.observations ?? null, createdByUserId: r.createdByUserId ?? null, createdByName: r.createdByName ?? null, assignedToUserId: r.assignedToUserId ?? null, assignedToName: r.assignedToName ?? null, closedAt: r.closedAt ? new Date(r.closedAt) : null } });
    }
    return;
  }

  if (USE_JSON_STORE) {
    await writeJsonStore(JSON_RELEASES_PATH, next);
    return;
  }

  if (!USE_MEMORY_STORE && USE_REDIS) {
    await writeRedisJson(REDIS_RELEASES_KEY, next);
    return;
  }

  const store = getGlobalStore<Release[]>("manualReleases", []);
  store.data = clone(next);
  store.initialized = true;
}

export async function readManualReleaseCases(): Promise<Record<string, ManualCaseItem[]>> {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = (await prisma.releaseCase.findMany()) as Array<{
      id: string;
      releaseId: string;
      title: string | null;
      link: string | null;
      status: string;
      bug: string | null;
      fromApi: boolean;
      metadata?: unknown;
    }>;
    const result: Record<string, ManualCaseItem[]> = {};
    for (const r of rows) {
      if (!result[r.releaseId]) result[r.releaseId] = [];
      const metadata =
        r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
          ? (r.metadata as Record<string, unknown>)
          : {};
      result[r.releaseId].push({
        id: r.id,
        title: r.title ?? undefined,
        link: r.link ?? undefined,
        status: r.status,
        bug: r.bug ?? null,
        fromApi: r.fromApi,
        origin: typeof metadata.origin === "string" ? metadata.origin : null,
        type: typeof metadata.type === "string" ? metadata.type : null,
        projectCode: typeof metadata.projectCode === "string" ? metadata.projectCode : null,
        suiteId: typeof metadata.suiteId === "string" ? metadata.suiteId : null,
        suiteName: typeof metadata.suiteName === "string" ? metadata.suiteName : null,
        description: typeof metadata.description === "string" ? metadata.description : null,
        preconditions: typeof metadata.preconditions === "string" ? metadata.preconditions : null,
        postconditions: typeof metadata.postconditions === "string" ? metadata.postconditions : null,
        stepsText: typeof metadata.stepsText === "string" ? metadata.stepsText : null,
        expectedText: typeof metadata.expectedText === "string" ? metadata.expectedText : null,
        priority: typeof metadata.priority === "string" ? metadata.priority : null,
        severity: typeof metadata.severity === "string" ? metadata.severity : null,
        tags: Array.isArray(metadata.tags) ? metadata.tags.filter((tag): tag is string => typeof tag === "string") : [],
        responsibleName: typeof metadata.responsibleName === "string" ? metadata.responsibleName : null,
        defectsCount: Number(metadata.defectsCount ?? 0) || 0,
        evidencesCount: Number(metadata.evidencesCount ?? 0) || 0,
        startedAt: typeof metadata.startedAt === "string" ? metadata.startedAt : null,
        finishedAt: typeof metadata.finishedAt === "string" ? metadata.finishedAt : null,
        statusUpdatedAt: typeof metadata.statusUpdatedAt === "string" ? metadata.statusUpdatedAt : null,
        retestCount: Number(metadata.retestCount ?? 0) || 0,
      });
    }
    return result;
  }

  if (USE_JSON_STORE) {
    const storeValue = await readJsonStore<Record<string, ManualCaseItem[]>>(JSON_RELEASE_CASES_PATH, {});
    return storeValue && typeof storeValue === "object" ? storeValue : {};
  }

  if (!USE_MEMORY_STORE && USE_REDIS) {
    const cached = await readRedisJson<Record<string, ManualCaseItem[]>>(REDIS_CASES_KEY);
    if (cached) return cached && typeof cached === "object" ? cached : {};
    const normalized: Record<string, ManualCaseItem[]> = {};
    await writeRedisJson(REDIS_CASES_KEY, normalized);
    return normalized;
  }

  const store = getGlobalStore<Record<string, ManualCaseItem[]>>("manualReleaseCases", {});
  if (!store.initialized) {
    store.data = {};
    store.initialized = true;
  }
  return clone(store.data);
}

export async function writeManualReleaseCases(storeValue: Record<string, ManualCaseItem[]>) {
  const next = storeValue && typeof storeValue === "object" ? storeValue : {};
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    for (const [releaseId, cases] of Object.entries(next)) {
      await prisma.releaseCase.deleteMany({ where: { releaseId } });
      if (cases && cases.length) {
        await prisma.releaseCase.createMany({
          data: cases.map((c) => ({
            id: c.id,
            releaseId,
            title: c.title ?? null,
            link: c.link ?? null,
            status: c.status ?? "NOT_RUN",
            bug: c.bug ?? null,
            fromApi: c.fromApi ?? false,
            metadata: {
              origin: c.origin ?? null,
              type: c.type ?? null,
              projectCode: c.projectCode ?? null,
              suiteId: c.suiteId ?? null,
              suiteName: c.suiteName ?? null,
              description: c.description ?? null,
              preconditions: c.preconditions ?? null,
              postconditions: c.postconditions ?? null,
              stepsText: c.stepsText ?? null,
              expectedText: c.expectedText ?? null,
              priority: c.priority ?? null,
              severity: c.severity ?? null,
              tags: c.tags ?? [],
              responsibleName: c.responsibleName ?? null,
              defectsCount: c.defectsCount ?? 0,
              evidencesCount: c.evidencesCount ?? 0,
              startedAt: c.startedAt ?? null,
              finishedAt: c.finishedAt ?? null,
              statusUpdatedAt: c.statusUpdatedAt ?? null,
              retestCount: c.retestCount ?? 0,
            },
          })),
        });
      }
    }
    return;
  }

  if (USE_JSON_STORE) {
    await writeJsonStore(JSON_RELEASE_CASES_PATH, next);
    return;
  }

  if (!USE_MEMORY_STORE && USE_REDIS) {
    await writeRedisJson(REDIS_CASES_KEY, next);
    return;
  }

  const store = getGlobalStore<Record<string, ManualCaseItem[]>>("manualReleaseCases", {});
  store.data = clone(next);
  store.initialized = true;
}
