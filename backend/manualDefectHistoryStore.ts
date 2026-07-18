import "server-only";

import crypto from "node:crypto";
import { shouldUsePostgresPersistence } from "@/database/persistenceMode";
import { getRedis, isRedisConfigured } from "@/backend/redis";
import { prisma } from "@/database/prismaClient";

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

const USE_MEMORY_STORE = process.env.MANUAL_DEFECT_HISTORY_IN_MEMORY === "true";
const USE_REDIS = isRedisConfigured();
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
      const normalized: Record<string, DefectHistoryEvent[]> = {};
      await writeRedisJson(REDIS_HISTORY_KEY, normalized);
      return normalized;
    }
    const store = getGlobalStore<Record<string, DefectHistoryEvent[]>>("manualDefectHistory", {});
    if (!store.initialized) {
      store.data = {};
      store.initialized = true;
    }
    return clone(store.data);
  }

  const store = getGlobalStore<Record<string, DefectHistoryEvent[]>>("manualDefectHistory", {});
  if (!store.initialized) {
    store.data = {};
    store.initialized = true;
  }
  return clone(store.data);
}

async function writeStore(next: Record<string, DefectHistoryEvent[]>) {
  const payload = next && typeof next === "object" ? next : {};
  if (!USE_MEMORY_STORE && USE_REDIS) {
    await writeRedisJson(REDIS_HISTORY_KEY, payload);
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

