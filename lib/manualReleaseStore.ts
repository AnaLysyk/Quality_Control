import "server-only";

import path from "node:path";
import fs from "node:fs/promises";
import type { Release } from "@/types/release";
import { getJsonStoreDir } from "@/data/jsonStorePath";
import { getRedis, isRedisConfigured } from "@/lib/redis";

export type ManualCaseItem = {
  id: string;
  title?: string;
  link?: string;
  status?: string;
  bug?: string | null;
  fromApi?: boolean;
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
const RELEASES_PATH = path.join(STORE_DIR, "releases-manual.json");
const CASES_PATH = path.join(STORE_DIR, "releases-manual-cases.json");

const USE_MEMORY_STORE = process.env.MANUAL_RELEASES_IN_MEMORY === "true";
const USE_REDIS = !USE_E2E_STORAGE && isRedisConfigured();
const REDIS_RELEASES_KEY = "qc:manualReleases";
const REDIS_CASES_KEY = "qc:manualReleaseCases";

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

export async function readManualReleases(): Promise<Release[]> {
  if (!USE_MEMORY_STORE) {
    if (USE_REDIS) {
      const cached = await readRedisJson<Release[]>(REDIS_RELEASES_KEY);
      if (cached) return Array.isArray(cached) ? cached.filter(Boolean) : [];
      const seeded = await readJsonFile<Release[]>(RELEASES_PATH, [], "[]");
      const normalized = Array.isArray(seeded) ? seeded.filter(Boolean) : [];
      await writeRedisJson(REDIS_RELEASES_KEY, normalized);
      return normalized;
    }
    const data = await readJsonFile<Release[]>(RELEASES_PATH, [], "[]");
    return Array.isArray(data) ? data.filter(Boolean) : [];
  }

  const store = getGlobalStore<Release[]>("manualReleases", []);
  if (!store.initialized) {
    const seeded = await readJsonFile<Release[]>(RELEASES_PATH, [], "[]");
    store.data = Array.isArray(seeded) ? seeded.filter(Boolean) : [];
    store.initialized = true;
  }
  return clone(store.data);
}

export async function writeManualReleases(releases: Release[]) {
  const next = Array.isArray(releases) ? releases.filter(Boolean) : [];
  if (!USE_MEMORY_STORE) {
    if (USE_REDIS) {
      await writeRedisJson(REDIS_RELEASES_KEY, next);
      return;
    }
    await writeJsonFile(RELEASES_PATH, next, "[]");
    return;
  }

  const store = getGlobalStore<Release[]>("manualReleases", []);
  store.data = clone(next);
  store.initialized = true;
}

export async function readManualReleaseCases(): Promise<Record<string, ManualCaseItem[]>> {
  if (!USE_MEMORY_STORE) {
    if (USE_REDIS) {
      const cached = await readRedisJson<Record<string, ManualCaseItem[]>>(REDIS_CASES_KEY);
      if (cached) return cached && typeof cached === "object" ? cached : {};
      const seeded = await readJsonFile<Record<string, ManualCaseItem[]>>(CASES_PATH, {}, "{}");
      const normalized = seeded && typeof seeded === "object" ? seeded : {};
      await writeRedisJson(REDIS_CASES_KEY, normalized);
      return normalized;
    }
    const data = await readJsonFile<Record<string, ManualCaseItem[]>>(CASES_PATH, {}, "{}");
    return data && typeof data === "object" ? data : {};
  }

  const store = getGlobalStore<Record<string, ManualCaseItem[]>>("manualReleaseCases", {});
  if (!store.initialized) {
    const seeded = await readJsonFile<Record<string, ManualCaseItem[]>>(CASES_PATH, {}, "{}");
    store.data = seeded && typeof seeded === "object" ? seeded : {};
    store.initialized = true;
  }
  return clone(store.data);
}

export async function writeManualReleaseCases(storeValue: Record<string, ManualCaseItem[]>) {
  const next = storeValue && typeof storeValue === "object" ? storeValue : {};
  if (!USE_MEMORY_STORE) {
    if (USE_REDIS) {
      await writeRedisJson(REDIS_CASES_KEY, next);
      return;
    }
    await writeJsonFile(CASES_PATH, next, "{}");
    return;
  }

  const store = getGlobalStore<Record<string, ManualCaseItem[]>>("manualReleaseCases", {});
  store.data = clone(next);
  store.initialized = true;
}
