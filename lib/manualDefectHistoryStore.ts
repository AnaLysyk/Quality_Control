import "server-only";

import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { getJsonStoreDir } from "@/data/jsonStorePath";
import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";
import { getRedis, isRedisConfigured } from "@/lib/redis";
import { prisma } from "@/lib/prismaClient";

const USE_POSTGRES = shouldUsePostgresPersistence();

export type DefectHistoryAction =
  | "created"
  | "status_changed"
  | "run_linked"
  | "run_unlinked"
  | "assignee_changed"
  | "comment_added"
  | "deleted"
  | "updated";

export type DefectHistoryEvent = {
  id: string;
  defectSlug: string;
  action: DefectHistoryAction;
  createdAt: string;
  actorId?: string | null;
  actorName?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  fromRunSlug?: string | null;
  toRunSlug?: string | null;
  note?: string | null;
};

type StoreState<T> = {
  initialized: boolean;
  data: T;
};

type GlobalStores = {
  __qcManualStores?: Record<string, StoreState<unknown>>;
};

const USE_E2E_STORAGE =
  process.env.PLAYWRIGHT_MOCK === "true" ||
  process.env.E2E_USE_JSON === "1" ||
  process.env.E2E_USE_JSON === "true" ||
  process.env.NODE_ENV === "test";
const STORE_DIR = USE_E2E_STORAGE
  ? path.join(process.cwd(), ".tmp", "e2e")
  : getJsonStoreDir();
const HISTORY_PATH = path.join(STORE_DIR, "defects-history.json");

const USE_MEMORY_STORE = process.env.MANUAL_DEFECT_HISTORY_IN_MEMORY === "true";
const USE_REDIS = !USE_E2E_STORAGE && isRedisConfigured();
const REDIS_HISTORY_KEY = "qc:defectsHistory";

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

async function ensureFile(filePath: string, initial: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, initial, "utf8");
  }
}

async function readJsonFile<T>(filePath: string, fallback: T, initial: string): Promise<T> {
  try {
    await ensureFile(filePath, initial);
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

async function writeJsonFile<T>(filePath: string, value: T, initial: string) {
  await ensureFile(filePath, initial);
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
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

async function readStore(): Promise<Record<string, DefectHistoryEvent[]>> {
  if (!USE_MEMORY_STORE) {
    if (USE_REDIS) {
      const cached = await readRedisJson<Record<string, DefectHistoryEvent[]>>(REDIS_HISTORY_KEY);
      if (cached) return cached && typeof cached === "object" ? cached : {};
      const seeded = await readJsonFile<Record<string, DefectHistoryEvent[]>>(HISTORY_PATH, {}, "{}");
      const normalized = seeded && typeof seeded === "object" ? seeded : {};
      await writeRedisJson(REDIS_HISTORY_KEY, normalized);
      return normalized;
    }
    const data = await readJsonFile<Record<string, DefectHistoryEvent[]>>(HISTORY_PATH, {}, "{}");
    return data && typeof data === "object" ? data : {};
  }

  const store = getGlobalStore<Record<string, DefectHistoryEvent[]>>("manualDefectHistory", {});
  if (!store.initialized) {
    const seeded = await readJsonFile<Record<string, DefectHistoryEvent[]>>(HISTORY_PATH, {}, "{}");
    store.data = seeded && typeof seeded === "object" ? seeded : {};
    store.initialized = true;
  }
  return clone(store.data);
}

async function writeStore(next: Record<string, DefectHistoryEvent[]>) {
  const payload = next && typeof next === "object" ? next : {};
  if (!USE_MEMORY_STORE) {
    if (USE_REDIS) {
      await writeRedisJson(REDIS_HISTORY_KEY, payload);
      return;
    }
    await writeJsonFile(HISTORY_PATH, payload, "{}");
    return;
  }

  const store = getGlobalStore<Record<string, DefectHistoryEvent[]>>("manualDefectHistory", {});
  store.data = clone(payload);
  store.initialized = true;
}

export async function listDefectHistory(defectSlug: string): Promise<DefectHistoryEvent[]> {
  if (!defectSlug) return [];
  if (USE_POSTGRES) {
    const rows = await prisma.defectHistoryEvent.findMany({
      where: { defectSlug },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      ...row,
      action: row.action as DefectHistoryAction,
      createdAt: row.createdAt.toISOString(),
    }));
  }
  const store = await readStore();
  const items = Array.isArray(store[defectSlug]) ? store[defectSlug] : [];
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function listDefectHistories(defectSlugs: string[]): Promise<Record<string, DefectHistoryEvent[]>> {
  const normalizedSlugs = Array.from(new Set(defectSlugs.filter(Boolean)));
  if (!normalizedSlugs.length) return {};

  if (USE_POSTGRES) {
    const rows = await prisma.defectHistoryEvent.findMany({
      where: { defectSlug: { in: normalizedSlugs } },
      orderBy: [{ defectSlug: "asc" }, { createdAt: "desc" }],
    });
    const grouped = new Map<string, DefectHistoryEvent[]>();
    for (const row of rows) {
      const list = grouped.get(row.defectSlug) ?? [];
      list.push({
        ...row,
        action: row.action as DefectHistoryAction,
        createdAt: row.createdAt.toISOString(),
      });
      grouped.set(row.defectSlug, list);
    }
    return Object.fromEntries(normalizedSlugs.map((slug) => [slug, grouped.get(slug) ?? []]));
  }

  const store = await readStore();
  return Object.fromEntries(
    normalizedSlugs.map((slug) => {
      const items = Array.isArray(store[slug]) ? store[slug] : [];
      return [slug, items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))];
    }),
  );
}

export async function appendDefectHistory(
  defectSlug: string,
  input: Omit<DefectHistoryEvent, "id" | "defectSlug" | "createdAt"> & { createdAt?: string },
) {
  if (!defectSlug) return null;
  if (USE_POSTGRES) {
    const row = await prisma.defectHistoryEvent.create({
      data: {
        id: crypto.randomUUID(),
        defectSlug,
        action: input.action,
        createdAt: input.createdAt ? new Date(input.createdAt) : new Date(),
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        fromRunSlug: input.fromRunSlug ?? null,
        toRunSlug: input.toRunSlug ?? null,
        note: input.note ?? null,
      },
    });
    return { ...row, action: row.action as DefectHistoryAction, createdAt: row.createdAt.toISOString() };
  }
  const store = await readStore();
  const list = Array.isArray(store[defectSlug]) ? store[defectSlug] : [];
  const event: DefectHistoryEvent = {
    id: crypto.randomUUID(),
    defectSlug,
    action: input.action,
    createdAt: input.createdAt ?? new Date().toISOString(),
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? null,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    fromRunSlug: input.fromRunSlug ?? null,
    toRunSlug: input.toRunSlug ?? null,
    note: input.note ?? null,
  };
  list.unshift(event);
  store[defectSlug] = list;
  await writeStore(store);
  return event;
}
