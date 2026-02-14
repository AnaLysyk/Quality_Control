
// Este módulo só deve ser importado em server components ou rotas de API Next.js
import "server-only";


// Dependências Node.js e utilitários do projeto
import path from "node:path";
import fs from "node:fs/promises";
import { getJsonStoreDir } from "@/data/jsonStorePath";
import { getRedis, isRedisConfigured } from "@/lib/redis";


/**
 * Representa um país cadastrado por empresa.
 * id: string único (companyId:slug)
 * slug: identificador amigável (url-safe)
 * createdAt: ISO string
 * createdBy/createdByEmail: opcional, para auditoria
 */
export type CountryRecord = {
  id: string;
  name: string;
  slug: string;
  companyId: string;
  createdAt: string;
  createdBy?: string | null;
  createdByEmail?: string | null;
};


/**
 * Erro customizado para operações do CountryStore.
 * code: tipo de erro (duplicidade, falha de escrita)
 * status: HTTP status sugerido
 */
export class CountryStoreError extends Error {
  constructor(
    public readonly code: "DUPLICATE_COUNTRY" | "WRITE_FAILED",
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CountryStoreError";
  }
}


// Estratégia de armazenamento:
// - E2E/teste: arquivo temporário
// - Produção: Redis (se disponível) ou arquivo JSON
// - Dev: pode usar memória (hot reload)
const USE_E2E_STORAGE =
  process.env.PLAYWRIGHT_MOCK === "true" ||
  process.env.E2E_USE_JSON === "1" ||
  process.env.E2E_USE_JSON === "true" ||
  process.env.NODE_ENV === "test";

const STORE_DIR = USE_E2E_STORAGE ? path.join(process.cwd(), ".tmp", "e2e") : getJsonStoreDir();
const STORE_PATH = path.join(STORE_DIR, "company-countries.json");

const USE_MEMORY_STORE = process.env.COUNTRY_STORE_IN_MEMORY === "true";
const USE_REDIS = !USE_E2E_STORAGE && isRedisConfigured();
const REDIS_KEY = "qc:companyCountries";


// Estrutura do store: companyId -> lista de países
type CountryStoreShape = Record<string, CountryRecord[]>;


// Estado global para hot reload/dev
type StoreState<T> = {
  initialized: boolean;
  data: T;
};


type GlobalStores = {
  __qcCountryStore?: StoreState<CountryStoreShape>;
};


// Recupera ou inicializa o store global em memória (dev/hot reload)
function getGlobalStore(): StoreState<CountryStoreShape> {
  const globalStores = globalThis as GlobalStores;
  const existing = globalStores.__qcCountryStore;
  if (existing) return existing;
  const created: StoreState<CountryStoreShape> = {
    initialized: false,
    data: {},
  };
  globalStores.__qcCountryStore = created;
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
 * Lê o store de países (fonte: Redis, arquivo ou memória).
 * Sempre retorna objeto (companyId -> lista de países).
 */
async function readStore(): Promise<CountryStoreShape> {
  if (!USE_MEMORY_STORE) {
    if (USE_REDIS) {
      const cached = await readRedisJson<CountryStoreShape>(REDIS_KEY);
      if (cached && typeof cached === "object") {
        return cached;
      }
      // Se não houver cache, carrega do arquivo e popula Redis
      const seeded = await readJsonFile<CountryStoreShape>(STORE_PATH, {}, "{}");
      const normalized = seeded && typeof seeded === "object" ? seeded : {};
      await writeRedisJson(REDIS_KEY, normalized);
      return normalized;
    }
    // Fallback: arquivo JSON
    const data = await readJsonFile<CountryStoreShape>(STORE_PATH, {}, "{}");
    return data && typeof data === "object" ? data : {};
  }

  // Dev/hot reload: memória global
  const store = getGlobalStore();
  if (!store.initialized) {
    const seeded = await readJsonFile<CountryStoreShape>(STORE_PATH, {}, "{}");
    store.data = seeded && typeof seeded === "object" ? seeded : {};
    store.initialized = true;
  }
  return clone(store.data);
}


/**
 * Persiste o store de países (Redis, arquivo ou memória).
 */
async function writeStore(value: CountryStoreShape) {
  const payload = value && typeof value === "object" ? value : {};
  if (!USE_MEMORY_STORE) {
    if (USE_REDIS) {
      await writeRedisJson(REDIS_KEY, payload);
      return;
    }
    await writeJsonFile(STORE_PATH, payload, "{}");
    return;
  }
  const store = getGlobalStore();
  store.data = clone(payload);
  store.initialized = true;
}


// Normaliza nome (remove espaços duplicados)
function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}


// Gera slug url-safe a partir do nome
function slugifyName(name: string) {
  const normalized = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.slice(0, 64) || "country";
}


/**
 * Lista todos os países cadastrados para uma empresa.
 * @param companyId ID da empresa
 * @returns Lista ordenada de CountryRecord
 */
export async function listCountries(companyId: string): Promise<CountryRecord[]> {
  if (!companyId) return [];
  const store = await readStore();
  const items = Array.isArray(store[companyId]) ? store[companyId] : [];
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}


/**
 * Cria um novo país para uma empresa, validando duplicidade e persistindo no store.
 * @param input Dados obrigatórios: companyId, name, createdBy, createdByEmail
 * @throws CountryStoreError se duplicado ou erro de escrita
 * @returns CountryRecord criado
 */
export async function createCountry(input: {
  companyId: string;
  name: string;
  createdBy?: string | null;
  createdByEmail?: string | null;
}): Promise<CountryRecord> {
  const companyId = input.companyId.trim();
  if (!companyId) {
    throw new CountryStoreError("WRITE_FAILED", "companyId obrigatorio", 400);
  }
  const normalizedName = normalizeName(input.name ?? "");
  if (!normalizedName) {
    throw new CountryStoreError("WRITE_FAILED", "Nome obrigatorio", 400);
  }
  const slug = slugifyName(normalizedName);
  const id = `${companyId}:${slug}`;

  // Busca store e verifica duplicidade
  const store = await readStore();
  const list = Array.isArray(store[companyId]) ? [...store[companyId]] : [];
  const exists = list.some((country) => country.id === id || country.slug === slug);
  if (exists) {
    throw new CountryStoreError("DUPLICATE_COUNTRY", "Pais ja existe", 409);
  }

  // Monta novo registro
  const record: CountryRecord = {
    id,
    name: normalizedName,
    slug,
    companyId,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy ?? null,
    createdByEmail: input.createdByEmail ?? null,
  };

  // Atualiza lista e persiste
  list.push(record);
  list.sort((a, b) => a.name.localeCompare(b.name));
  store[companyId] = list;

  try {
    await writeStore(store);
  } catch (error) {
    throw new CountryStoreError("WRITE_FAILED", "Falha ao salvar pais", 500);
  }

  return record;
}
