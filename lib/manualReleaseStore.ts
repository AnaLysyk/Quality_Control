
// Este módulo só deve ser importado em server components ou rotas de API Next.js
import "server-only";

import path from "node:path";
import fs from "node:fs/promises";
import type { Release } from "@/types/release";
import { getJsonStoreDir } from "@/data/jsonStorePath";
import { getRedis, isRedisConfigured } from "@/lib/redis";


/**
 * Representa um caso manual vinculado a uma release.
 * - id: identificador único
 * - title: título do caso
 * - link: link externo (opcional)
 * - status: status do caso
 * - bug: id/slug do bug vinculado (opcional)
 * - fromApi: se veio de integração externa
 */
export type ManualCaseItem = {
  id: string;
  title?: string;
  link?: string;
  status?: string;
  bug?: string | null;
  fromApi?: boolean;
};


// Estado global para hot reload/dev
type StoreState<T> = {
  initialized: boolean;
  data: T;
};


type GlobalStores = {
  __qcManualStores?: Record<string, StoreState<unknown>>;
};


// Estratégia de armazenamento:
// - E2E/teste: arquivo temporário
// - Produção: Redis (se disponível) ou arquivo JSON
// - Dev: pode usar memória (hot reload)
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


// Recupera ou inicializa o store global em memória (dev/hot reload)
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


// Clona objeto de forma segura (compatível com Node antigo)
function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}


// Garante que o arquivo existe, criando se necessário
async function ensureFile(filePath: string, initial: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, initial, "utf8");
  }
}


// Lê arquivo JSON, retorna fallback se erro
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


// Escreve arquivo JSON (cria se necessário)
async function writeJsonFile<T>(filePath: string, value: T, initial: string) {
  await ensureFile(filePath, initial);
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}


// Lê valor JSON do Redis
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


// Escreve valor JSON no Redis
async function writeRedisJson<T>(key: string, value: T) {
  const redis = getRedis();
  await redis.set(key, JSON.stringify(value));
}


/**
 * Lê todas as releases manuais do store (Redis, arquivo ou memória).
 * @returns Lista de Release
 */
export async function readManualReleases(): Promise<Release[]> {
  if (!USE_MEMORY_STORE) {
    if (USE_REDIS) {
      const cached = await readRedisJson<Release[]>(REDIS_RELEASES_KEY);
      if (cached) return Array.isArray(cached) ? cached.filter(Boolean) : [];
      // Se não houver cache, carrega do arquivo e popula Redis
      const seeded = await readJsonFile<Release[]>(RELEASES_PATH, [], "[]");
      const normalized = Array.isArray(seeded) ? seeded.filter(Boolean) : [];
      await writeRedisJson(REDIS_RELEASES_KEY, normalized);
      return normalized;
    }
    // Fallback: arquivo JSON
    const data = await readJsonFile<Release[]>(RELEASES_PATH, [], "[]");
    return Array.isArray(data) ? data.filter(Boolean) : [];
  }

  // Dev/hot reload: memória global
  const store = getGlobalStore<Release[]>("manualReleases", []);
  if (!store.initialized) {
    const seeded = await readJsonFile<Release[]>(RELEASES_PATH, [], "[]");
    store.data = Array.isArray(seeded) ? seeded.filter(Boolean) : [];
    store.initialized = true;
  }
  return clone(store.data);
}


/**
 * Persiste a lista de releases manuais (Redis, arquivo ou memória).
 * @param releases Lista de Release
 */
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


/**
 * Lê todos os casos manuais vinculados a releases (Redis, arquivo ou memória).
 * @returns Mapa releaseId -> lista de ManualCaseItem
 */
export async function readManualReleaseCases(): Promise<Record<string, ManualCaseItem[]>> {
  if (!USE_MEMORY_STORE) {
    if (USE_REDIS) {
      const cached = await readRedisJson<Record<string, ManualCaseItem[]>>(REDIS_CASES_KEY);
      if (cached) return cached && typeof cached === "object" ? cached : {};
      // Se não houver cache, carrega do arquivo e popula Redis
      const seeded = await readJsonFile<Record<string, ManualCaseItem[]>>(CASES_PATH, {}, "{}");
      const normalized = seeded && typeof seeded === "object" ? seeded : {};
      await writeRedisJson(REDIS_CASES_KEY, normalized);
      return normalized;
    }
    // Fallback: arquivo JSON
    const data = await readJsonFile<Record<string, ManualCaseItem[]>>(CASES_PATH, {}, "{}");
    return data && typeof data === "object" ? data : {};
  }

  // Dev/hot reload: memória global
  const store = getGlobalStore<Record<string, ManualCaseItem[]>>("manualReleaseCases", {});
  if (!store.initialized) {
    const seeded = await readJsonFile<Record<string, ManualCaseItem[]>>(CASES_PATH, {}, "{}");
    store.data = seeded && typeof seeded === "object" ? seeded : {};
    store.initialized = true;
  }
  return clone(store.data);
}


/**
 * Persiste o mapa de casos manuais por release (Redis, arquivo ou memória).
 * @param storeValue Mapa releaseId -> lista de ManualCaseItem
 */
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
