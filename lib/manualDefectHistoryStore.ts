
// Este módulo só deve ser importado em server components ou rotas de API Next.js
import "server-only";

import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { getJsonStoreDir } from "@/data/jsonStorePath";
import { getRedis, isRedisConfigured } from "@/lib/redis";


/**
 * Tipos de ações possíveis no histórico de defeitos.
 */
export type DefectHistoryAction =
  | "created"
  | "status_changed"
  | "run_linked"
  | "run_unlinked"
  | "deleted"
  | "updated";


/**
 * Evento registrado no histórico de um defeito.
 * - id: identificador único
 * - defectSlug: slug do defeito
 * - action: tipo de ação
 * - createdAt: data/hora ISO
 * - actorId/actorName: usuário responsável (opcional)
 * - fromStatus/toStatus: status anterior/novo (opcional)
 * - fromRunSlug/toRunSlug: run anterior/nova (opcional)
 * - note: observação (opcional)
 */
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
const HISTORY_PATH = path.join(STORE_DIR, "defects-history.json");

const USE_MEMORY_STORE = process.env.MANUAL_DEFECT_HISTORY_IN_MEMORY === "true";
const USE_REDIS = !USE_E2E_STORAGE && isRedisConfigured();
const REDIS_HISTORY_KEY = "qc:defectsHistory";


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
 * Lê o store de histórico de defeitos (fonte: Redis, arquivo ou memória).
 * Sempre retorna objeto (defectSlug -> lista de eventos).
 */
async function readStore(): Promise<Record<string, DefectHistoryEvent[]>> {
  if (!USE_MEMORY_STORE) {
    if (USE_REDIS) {
      const cached = await readRedisJson<Record<string, DefectHistoryEvent[]>>(REDIS_HISTORY_KEY);
      if (cached) return cached && typeof cached === "object" ? cached : {};
      // Se não houver cache, carrega do arquivo e popula Redis
      const seeded = await readJsonFile<Record<string, DefectHistoryEvent[]>>(HISTORY_PATH, {}, "{}");
      const normalized = seeded && typeof seeded === "object" ? seeded : {};
      await writeRedisJson(REDIS_HISTORY_KEY, normalized);
      return normalized;
    }
    // Fallback: arquivo JSON
    const data = await readJsonFile<Record<string, DefectHistoryEvent[]>>(HISTORY_PATH, {}, "{}");
    return data && typeof data === "object" ? data : {};
  }

  // Dev/hot reload: memória global
  const store = getGlobalStore<Record<string, DefectHistoryEvent[]>>("manualDefectHistory", {});
  if (!store.initialized) {
    const seeded = await readJsonFile<Record<string, DefectHistoryEvent[]>>(HISTORY_PATH, {}, "{}");
    store.data = seeded && typeof seeded === "object" ? seeded : {};
    store.initialized = true;
  }
  return clone(store.data);
}


/**
 * Persiste o store de histórico de defeitos (Redis, arquivo ou memória).
 */
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


/**
 * Lista o histórico de eventos de um defeito, ordenado do mais recente para o mais antigo.
 * @param defectSlug Slug do defeito
 * @returns Lista de eventos
 */
export async function listDefectHistory(defectSlug: string): Promise<DefectHistoryEvent[]> {
  if (!defectSlug) return [];
  const store = await readStore();
  const items = Array.isArray(store[defectSlug]) ? store[defectSlug] : [];
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}


/**
 * Adiciona um evento ao histórico de um defeito.
 * @param defectSlug Slug do defeito
 * @param input Dados do evento (exceto id, defectSlug, createdAt)
 * @returns Evento criado
 */
export async function appendDefectHistory(
  defectSlug: string,
  input: Omit<DefectHistoryEvent, "id" | "defectSlug" | "createdAt"> & { createdAt?: string },
) {
  if (!defectSlug) return null;
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
