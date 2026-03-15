import "server-only";

import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { getRedis, isRedisConfigured } from "@/lib/redis";
import { LEGACY_SUPORTE_STATUS_MAP, normalizeKanbanStatus, type SuporteStatus } from "@/lib/suportesStatus";
import { getJsonStoreDir } from "@/data/jsonStorePath";

const USE_POSTGRES = process.env.AUTH_STORE === "postgres";
async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

export type SuportePriority = "low" | "medium" | "high";
export type SuporteType = "bug" | "melhoria" | "tarefa";

export type SuporteRecord = {
  id: string;
  code: string;
  title: string;
  description: string;
  status: SuporteStatus;
  type: SuporteType;
  priority: SuportePriority;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName?: string | null;
  createdByEmail?: string | null;
  companySlug?: string | null;
  companyId?: string | null;
  assignedToUserId?: string | null;
  updatedBy?: string | null;
  timeline?: SuporteStatusHistory[];
};

// Backwards-compatible type aliases
export type TicketRecord = SuporteRecord;
export type TicketPriority = SuportePriority;
export type TicketType = SuporteType;

type SuportesStore = {
  counter: number;
  items: SuporteRecord[];
};

type SuporteStatusHistory = {
  from: SuporteStatus;
  to: SuporteStatus;
  changedById: string;
  at: string;
};

type ExportPayload = {
  format: "suportes-export";
  version: number;
  exportedAt: string;
  counter: number;
  items: SuporteRecord[];
};

type ImportMode = "merge" | "replace" | "upsert";

type ImportPayload = {
  format?: string;
  version?: number;
  exportedAt?: string;
  counter?: number;
  items?: unknown;
};

const DEFAULT_DATA_DIR = getJsonStoreDir();
const DATA_DIR = process.env.TICKETS_DATA_DIR || DEFAULT_DATA_DIR;
const STORE_PATH = path.join(DATA_DIR, "support-suportes.json");
const VERSION_DIR = path.join(DATA_DIR, "versions");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const LOCK_PATH = `${STORE_PATH}.lock`;
const STORE_KEY = "qc:support_suportes:v1";
const STORE_COUNTER_KEY = "qc:support_suportes:counter:v1";
const FORCE_FILE = process.env.TICKETS_STORE === "file";
const FORCE_REDIS = process.env.TICKETS_STORE === "redis";
const REDIS_AVAILABLE = isRedisConfigured();
const USE_REDIS = !FORCE_FILE && REDIS_AVAILABLE;
const SHOULD_FLUSH_ON_WRITE = Boolean(
  process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY ||
    process.env.SERVERLESS ||
    process.env.TICKETS_FLUSH_ON_WRITE === "true" ||
    process.env.NODE_ENV !== "production",
);
const USE_MEMORY = process.env.TICKETS_IN_MEMORY === "true";

const FLUSH_INTERVAL_MS = Math.max(1000, Number(process.env.TICKETS_FLUSH_INTERVAL_MS ?? 5000));
const LOCK_TIMEOUT_MS = Math.max(1000, Number(process.env.TICKETS_LOCK_TIMEOUT_MS ?? 10000));
const LOCK_RETRY_MS = Math.max(50, Number(process.env.TICKETS_LOCK_RETRY_MS ?? 120));
const MAX_VERSIONS = Math.max(1, Number(process.env.TICKETS_MAX_VERSIONS ?? 20));
const BACKUP_INTERVAL_MS = Math.max(5000, Number(process.env.TICKETS_BACKUP_INTERVAL_MS ?? 60000));
const MAX_BACKUPS = Math.max(1, Number(process.env.TICKETS_MAX_BACKUPS ?? 30));

let memoryStore: SuportesStore = { items: [], counter: 0 };
let warnedFsFailure = false;
let cacheStore: SuportesStore | null = null;
let dirty = false;
let initPromise: Promise<void> | null = null;
let flushTimer: NodeJS.Timeout | null = null;
let backupTimer: NodeJS.Timeout | null = null;
let versionCounter = 0;
let flushingPromise: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let warnedRedisFailure = false;
let forceMemory = false;

if (FORCE_REDIS && !REDIS_AVAILABLE) {
  console.warn("[TICKETS] TICKETS_STORE=redis sem credenciais; usando filesystem.");
}

function usingMemory() {
  return USE_MEMORY || forceMemory;
}

async function ensureStore(): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.access(STORE_PATH);
    return true;
  } catch {
    try {
      await fs.writeFile(STORE_PATH, JSON.stringify({ items: [], counter: 0 }, null, 2), "utf8");
      return true;
    } catch {
      if (!warnedFsFailure) {
        warnedFsFailure = true;
        console.warn("[TICKETS] Falha ao acessar filesystem; usando fallback em memoria.");
      }
      forceMemory = true;
      return false;
    }
  }
}

function normalizeStore(raw: unknown): SuportesStore {
  if (Array.isArray(raw)) {
    return { items: raw.filter(Boolean) as SuporteRecord[], counter: 0 };
  }
  if (!raw || typeof raw !== "object") {
    return { items: [], counter: 0 };
  }
  const record = raw as { items?: unknown; counter?: unknown };
  const items = Array.isArray(record.items) ? (record.items.filter(Boolean) as SuporteRecord[]) : [];
  const counter = Number(record.counter ?? 0);
  return { items, counter: Number.isFinite(counter) ? counter : 0 };
}

function sanitizeText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function normalizeStatus(value?: string | null): SuporteStatus | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const mapped = normalized in LEGACY_SUPORTE_STATUS_MAP ? LEGACY_SUPORTE_STATUS_MAP[normalized] : normalized;
  return normalizeKanbanStatus(mapped);
}

function normalizePriority(value?: unknown): SuportePriority {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "urgent") return "high";
  if (raw === "low" || raw === "medium" || raw === "high") return raw;
  return "medium";
}

function normalizeType(value?: unknown): SuporteType {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "bug" || raw === "melhoria" || raw === "tarefa") return raw;
  return "tarefa";
}
function normalizeCode(value?: unknown): string {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (raw && raw.startsWith("SP-")) return raw;
  return "";
}

function parseCodeNumber(code?: string): number {
  if (!code || typeof code !== "string") return 0;
  const match = code.match(/^SP-(\d{4,})$/i);
  if (!match) return 0;
  const num = Number.parseInt(match[1], 10);
  return Number.isFinite(num) ? num : 0;
}

function formatCode(counter: number): string {
  return `SP-${String(counter).padStart(6, "0")}`;
}

function normalizeTags(value?: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const tag = entry.trim();
    if (!tag) continue;
    unique.add(tag.slice(0, 40));
  }
  return Array.from(unique);
}

function normalizeRecord(raw: any): SuporteRecord {
  const status = normalizeStatus(raw.status) ?? "backlog";
  const type = normalizeType(raw.type);
  const code = normalizeCode(raw.code);
  return {
    ...raw,
    status,
    code,
    type,
    priority: normalizePriority(raw.priority),
    tags: normalizeTags(raw.tags),
    companyId: raw.companyId ?? null,
    assignedToUserId: raw.assignedToUserId ?? null,
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
  };
}

async function syncLegacyCodes(store: SuportesStore): Promise<SuportesStore> {
  let counter = Number.isFinite(store.counter) ? store.counter : 0;
  let maxCode = 0;
  store.items.forEach((item) => {
    const parsed = parseCodeNumber(item.code ?? "");
    if (parsed > maxCode) maxCode = parsed;
  });
  counter = Math.max(counter, maxCode);

  let updated = false;
  const items = store.items.map((item) => {
    const normalized = normalizeRecord(item);
    if (!normalized.code) {
      counter += 1;
      normalized.code = formatCode(counter);
      updated = true;
    }
    return normalized;
  });

  if (updated || store.counter !== counter) {
    const next = { items, counter };
    await writeStore(next);
    return next;
  }

  return { items, counter };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryAcquireLock() {
  try {
    return await fs.open(LOCK_PATH, "wx");
  } catch {
    return null;
  }
}

async function withFileLock<T>(fn: () => Promise<T>) {
  if (USE_REDIS || usingMemory()) return fn();
  const start = Date.now();
  while (true) {
    const handle = await tryAcquireLock();
    if (handle) {
      try {
        return await fn();
      } finally {
        await handle.close().catch(() => null);
        await fs.unlink(LOCK_PATH).catch(() => null);
      }
    }
    if (Date.now() - start > LOCK_TIMEOUT_MS) {
      throw new Error("TICKETS_LOCK_TIMEOUT");
    }
    await sleep(LOCK_RETRY_MS);
  }
}

async function loadStoreFromDisk(): Promise<SuportesStore> {
  const ok = await ensureStore();
  if (!ok) return memoryStore;
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return normalizeStore(JSON.parse(raw));
  } catch {
    return memoryStore;
  }
}

async function loadVersionCounter() {
  try {
    const files = await fs.readdir(VERSION_DIR);
    const nums = files
      .map((file) => file.match(/support-tickets\.v(\d+)\.json$/i))
      .filter(Boolean)
      .map((match) => Number(match?.[1] ?? 0))
      .filter((value) => Number.isFinite(value));
    versionCounter = nums.length ? Math.max(...nums) : 0;
  } catch {
    versionCounter = 0;
  }
}

function startFlushLoop() {
  if (flushTimer || USE_REDIS || usingMemory()) return;
  flushTimer = setInterval(() => {
    flushNow().catch(() => null);
  }, FLUSH_INTERVAL_MS);
  flushTimer?.unref?.();
}

function startBackupLoop() {
  if (backupTimer || USE_REDIS || usingMemory()) return;
  backupTimer = setInterval(() => {
    createBackup().catch(() => null);
  }, BACKUP_INTERVAL_MS);
  backupTimer?.unref?.();
}

async function initStore() {
  if (USE_REDIS || usingMemory()) return;
  if (cacheStore) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await fs.mkdir(VERSION_DIR, { recursive: true });
      await fs.mkdir(BACKUP_DIR, { recursive: true });
      cacheStore = await loadStoreFromDisk();
      await loadVersionCounter();
      startFlushLoop();
      startBackupLoop();
    } catch (err) {
      if (!warnedFsFailure) {
        warnedFsFailure = true;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[TICKETS] Falha ao preparar storage; usando memoria.", msg);
      }
      forceMemory = true;
      cacheStore = null;
    }
  })();
  return initPromise;
}

async function readStore(): Promise<SuportesStore> {
  if (USE_REDIS) {
    try {
      const redis = getRedis();
      const raw = await redis.get<string>(STORE_KEY);
      if (!raw) return { items: [], counter: 0 };
      try {
        return normalizeStore(JSON.parse(raw));
      } catch {
        return { items: [], counter: 0 };
      }
    } catch (err) {
      if (!warnedRedisFailure) {
        warnedRedisFailure = true;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[TICKETS] Redis indisponivel; usando fallback em memoria.", msg);
      }
      return memoryStore;
    }
  }
  if (usingMemory()) {
    return memoryStore;
  }
  await initStore();
  if (!cacheStore) {
    cacheStore = await loadStoreFromDisk();
  }
  return cacheStore;
}

async function writeStore(next: SuportesStore) {
  const payload: SuportesStore = { counter: next.counter ?? 0, items: next.items ?? [] };
  if (USE_REDIS) {
    try {
      const redis = getRedis();
      await redis.set(STORE_KEY, JSON.stringify(payload));
      await redis.set(STORE_COUNTER_KEY, String(payload.counter));
      return;
    } catch (err) {
      if (!warnedRedisFailure) {
        warnedRedisFailure = true;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[TICKETS] Redis indisponivel; gravando em memoria.", msg);
      }
      memoryStore = payload;
      return;
    }
  }
  if (usingMemory()) {
    memoryStore = payload;
    return;
  }
  await initStore();
  cacheStore = payload;
  dirty = true;
  if (SHOULD_FLUSH_ON_WRITE) {
    // Ensure flushes are serialized to avoid concurrent file-lock attempts
    await enqueueWrite(async () => {
      try {
        await flushNow();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[TICKETS] Falha ao persistir imediatamente:", msg);
      }
    });
  }
}

// Simple in-process queue to serialize write/flush operations
function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(() => fn());
  // propagate completion and ensure queue continues
  writeQueue = next.then(() => undefined, () => undefined);
  return next;
}

function buildVersionName(counter: number) {
  return `support-suportes.v${String(counter).padStart(6, "0")}.json`;
}

async function writeVersionSnapshot() {
  if (!cacheStore) return;
  versionCounter += 1;
  const filename = buildVersionName(versionCounter);
  const filePath = path.join(VERSION_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(cacheStore, null, 2), "utf8");
  await rotateVersions();
}

async function rotateVersions() {
  const files = (await fs.readdir(VERSION_DIR)).filter((file) => file.endsWith(".json")).sort();
  if (files.length <= MAX_VERSIONS) return;
  const remove = files.slice(0, files.length - MAX_VERSIONS);
  for (const file of remove) {
    await fs.unlink(path.join(VERSION_DIR, file)).catch(() => null);
  }
}

function buildBackupName() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return `support-suportes.bak-${stamp}.json`;
}

async function rotateBackups() {
  const files = (await fs.readdir(BACKUP_DIR)).filter((file) => file.endsWith(".json")).sort();
  if (files.length <= MAX_BACKUPS) return;
  const remove = files.slice(0, files.length - MAX_BACKUPS);
  for (const file of remove) {
    await fs.unlink(path.join(BACKUP_DIR, file)).catch(() => null);
  }
}

export async function createBackup() {
  if (USE_REDIS || usingMemory()) return;
  await initStore();
  if (!cacheStore) return;
  await withFileLock(async () => {
    const filePath = path.join(BACKUP_DIR, buildBackupName());
    await fs.writeFile(filePath, JSON.stringify(cacheStore, null, 2), "utf8");
    await rotateBackups();
  });
}

export async function flushNow() {
  if (USE_REDIS || usingMemory()) return;
  if (!dirty) return;
  if (flushingPromise) return flushingPromise;
  flushingPromise = withFileLock(async () => {
    if (!cacheStore) return;
    await writeVersionSnapshot();
    const tmp = `${STORE_PATH}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(cacheStore, null, 2), "utf8");
    await fs.rename(tmp, STORE_PATH);
    dirty = false;
  }).finally(() => {
    flushingPromise = null;
  });
  return flushingPromise;
}

export async function listVersions() {
  if (USE_REDIS || usingMemory()) return [];
  await initStore();
  const files = (await fs.readdir(VERSION_DIR)).filter((file) => file.endsWith(".json")).sort();
  return files;
}

export async function restoreVersion(name: string) {
  if (USE_REDIS || usingMemory()) {
    throw new Error("TICKETS_RESTORE_UNSUPPORTED");
  }
  await initStore();
  await withFileLock(async () => {
    const filePath = path.join(VERSION_DIR, name);
    const raw = await fs.readFile(filePath, "utf8");
    cacheStore = normalizeStore(JSON.parse(raw));
    dirty = true;
  });
  await flushNow();
  return cacheStore;
}

export async function exportSuportes(filter?: (item: SuporteRecord) => boolean): Promise<ExportPayload> {
  const store = await syncLegacyCodes(await readStore());
  const items = filter ? store.items.filter(filter) : store.items;
  return {
    format: "suportes-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    counter: store.counter,
    items,
  };
}

// Backwards-compatible export alias
export const exportTickets = exportSuportes;

function pgTicketToRecord(ticket: { id: string; code: string; title: string; description: string; status: string; type: string; priority: string; tags: string[]; createdAt: Date; updatedAt: Date; createdBy: string; createdByName?: string | null; createdByEmail?: string | null; companySlug?: string | null; companyId?: string | null; assignedToUserId?: string | null; updatedBy?: string | null; events?: { type: string; payload: unknown; actorUserId?: string | null; createdAt: Date }[] }): SuporteRecord {
  const timeline = (ticket.events ?? [])
    .filter((e) => e.type === "STATUS_CHANGED")
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .map((e) => { const p = (e.payload ?? {}) as Record<string, unknown>; return { from: (p.from as SuporteStatus) ?? "backlog", to: (p.to as SuporteStatus) ?? "backlog", changedById: e.actorUserId ?? "", at: e.createdAt.toISOString() }; });
  return normalizeRecord({ id: ticket.id, code: ticket.code, title: ticket.title, description: ticket.description, status: ticket.status, type: ticket.type, priority: ticket.priority, tags: ticket.tags, createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString(), createdBy: ticket.createdBy, createdByName: ticket.createdByName ?? null, createdByEmail: ticket.createdByEmail ?? null, companySlug: ticket.companySlug ?? null, companyId: ticket.companyId ?? null, assignedToUserId: ticket.assignedToUserId ?? null, updatedBy: ticket.updatedBy ?? null, timeline });
}

function validateImportItem(item: SuporteRecord) {
  if (!item.id || !item.title || !item.createdBy || !item.companyId) {
    throw new Error("SUPORTES_IMPORT_INVALID_ITEM");
  }
}

export async function importSuportes(payload: ImportPayload, mode: ImportMode) {
  if (USE_REDIS || usingMemory()) {
    throw new Error("SUPORTES_IMPORT_UNSUPPORTED");
  }
  if (!payload || payload.format !== "suportes-export") {
    throw new Error("SUPORTES_IMPORT_INVALID_FORMAT");
  }
  if (!Array.isArray(payload.items)) {
    throw new Error("SUPORTES_IMPORT_INVALID_ITEMS");
  }
  await initStore();
  await createBackup();
  await withFileLock(async () => {
    const nextItems = payload.items as SuporteRecord[];
    nextItems.forEach(validateImportItem);

    if (!cacheStore) {
      cacheStore = { items: [], counter: 0 };
    }

    if (mode === "replace") {
      cacheStore.items = nextItems;
    } else if (mode === "merge") {
      const existingIds = new Set(cacheStore.items.map((item) => item.id));
      for (const item of nextItems) {
        if (!existingIds.has(item.id)) {
          cacheStore.items.push(item);
        }
      }
    } else {
      const map = new Map(cacheStore.items.map((item) => [item.id, item]));
      for (const item of nextItems) {
        map.set(item.id, item);
      }
      cacheStore.items = Array.from(map.values());
    }

    let maxCode = 0;
    cacheStore.items.forEach((item) => {
      const parsed = parseCodeNumber(item.code ?? "");
      if (parsed > maxCode) maxCode = parsed;
    });
    cacheStore.counter = Math.max(cacheStore.counter ?? 0, maxCode, payload.counter ?? 0);
    dirty = true;
  });
  await flushNow();
  return cacheStore;
}


export async function listSuportesForUser(userId: string) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.ticket.findMany({ where: { createdBy: userId }, orderBy: { createdAt: "desc" }, include: { events: true } });
    return rows.map(pgTicketToRecord);
  }
  const store = await syncLegacyCodes(await readStore());
  return store.items
    .filter((item) => item.createdBy === userId)
    .map((item) => normalizeRecord(item))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}


export async function listAllSuportes() {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.ticket.findMany({ orderBy: { createdAt: "desc" }, include: { events: true } });
    return rows.map(pgTicketToRecord);
  }
  const store = await syncLegacyCodes(await readStore());
  return [...store.items].map((item) => normalizeRecord(item)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}


export async function getSuporteById(id: string) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const row = await prisma.ticket.findUnique({ where: { id }, include: { events: true } });
    return row ? pgTicketToRecord(row) : null;
  }
  const store = await syncLegacyCodes(await readStore());
  const item = store.items.find((suporte) => suporte.id === id);
  return item ? normalizeRecord({ ...item }) : null;
}


export async function createSuporte(input: {
  title?: unknown;
  description?: unknown;
  type?: unknown;
  priority?: unknown;
  tags?: unknown;
  createdBy: string;
  createdByName?: string | null;
  createdByEmail?: string | null;
  companySlug?: string | null;
  companyId?: string | null;
  assignedToUserId?: string | null;
}) {
  const title = sanitizeText(input.title, 120);
  const description = sanitizeText(input.description, 2000);
  const type = normalizeType(input.type);
  if (!title && !description) {
    console.error('[createSuporte] Título e descrição recebidos:', { title: input.title, description: input.description });
    return null;
  }
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const count = await prisma.ticket.count();
    const nextCounter = count + 1;
    const code = formatCode(nextCounter);
    const row = await prisma.ticket.create({
      data: { code, title: title || "Novo suporte", description, status: "backlog", type, priority: normalizePriority(input.priority), tags: normalizeTags(input.tags), createdBy: input.createdBy || "anonymous", createdByName: input.createdByName ?? null, createdByEmail: input.createdByEmail ?? null, companySlug: input.companySlug ?? null, companyId: input.companyId ?? null, assignedToUserId: input.assignedToUserId ?? null },
      include: { events: true },
    });
    return pgTicketToRecord(row);
  }
  const now = new Date().toISOString();
  const store = await readStore();
  let nextCounter = (store.counter ?? 0) + 1;
  if (USE_REDIS) {
    try {
      const redis = getRedis();
      const incr = await redis.incr(STORE_COUNTER_KEY);
      if (Number.isFinite(incr)) {
        nextCounter = incr;
      }
    } catch {
      // fallback to local counter
    }
  }
  store.counter = nextCounter;
  const code = formatCode(nextCounter);
  const suporte: SuporteRecord = {
    id: randomUUID(),
    code,
    title: title || "Novo suporte",
    description,
    status: "backlog",
    type,
    priority: normalizePriority(input.priority),
    tags: normalizeTags(input.tags),
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy || "anonymous",
    createdByName: input.createdByName ?? null,
    createdByEmail: input.createdByEmail ?? null,
    companySlug: input.companySlug ?? null,
    companyId: input.companyId ?? null,
    assignedToUserId: input.assignedToUserId ?? null,
    timeline: [],
  };

  store.items.unshift(suporte);
  await writeStore(store);
  return normalizeRecord(suporte);
}


export async function updateSuporteForUser(
  userId: string,
  id: string,
  patch: { title?: unknown; description?: unknown },
) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const current = await prisma.ticket.findFirst({ where: { id, createdBy: userId } });
    if (!current) return null;
    const title = sanitizeText(patch.title, 120) || current.title;
    const description = typeof patch.description === "string" ? sanitizeText(patch.description, 2000) : current.description;
    const row = await prisma.ticket.update({ where: { id }, data: { title, description, updatedBy: userId }, include: { events: true } });
    return pgTicketToRecord(row);
  }
  const store = await readStore();
  const idx = store.items.findIndex((item) => item.id === id && item.createdBy === userId);
  if (idx === -1) return null;
  const current = store.items[idx];
  const title = sanitizeText(patch.title, 120) || current.title;
  const description =
    typeof patch.description === "string" ? sanitizeText(patch.description, 2000) : current.description;
  const updated: SuporteRecord = {
    ...current,
    title,
    description,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };
  store.items[idx] = updated;
  await writeStore(store);
  return normalizeRecord(updated);
}


export async function deleteSuporteForUser(userId: string, id: string) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const result = await prisma.ticket.deleteMany({ where: { id, createdBy: userId } });
    return result.count > 0;
  }
  const store = await readStore();
  const before = store.items.length;
  store.items = store.items.filter((item) => !(item.id === id && item.createdBy === userId));
  if (store.items.length === before) return false;
  await writeStore(store);
  return true;
}


export async function updateSuporteStatus(id: string, status: string, actorId: string) {
  const nextStatus = normalizeStatus(status);
  if (!nextStatus) return null;
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const current = await prisma.ticket.findUnique({ where: { id } });
    if (!current) return null;
    if (current.status === nextStatus) {
      const row = await prisma.ticket.findUnique({ where: { id }, include: { events: true } });
      return row ? pgTicketToRecord(row) : null;
    }
    const row = await prisma.ticket.update({ where: { id }, data: { status: nextStatus, updatedBy: actorId }, include: { events: true } });
    await prisma.ticketEvent.create({ data: { ticketId: id, type: "STATUS_CHANGED", payload: { from: current.status, to: nextStatus }, actorUserId: actorId } });
    return pgTicketToRecord({ ...row, events: [...row.events, { type: "STATUS_CHANGED", payload: { from: current.status, to: nextStatus }, actorUserId: actorId, createdAt: new Date() }] });
  }
  const store = await readStore();
  const idx = store.items.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  const current = store.items[idx];
  const timeline = Array.isArray(current.timeline) ? current.timeline : [];
  if (current.status === nextStatus) {
    return normalizeRecord({ ...current, timeline });
  }
  const updated: SuporteRecord = {
    ...current,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
    timeline: [
      ...timeline,
      { from: current.status, to: nextStatus, changedById: actorId, at: new Date().toISOString() },
    ],
  };
  store.items[idx] = updated;
  await writeStore(store);
  return normalizeRecord(updated);
}


export async function listSuporteTimeline(id: string) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const events = await prisma.ticketEvent.findMany({ where: { ticketId: id }, orderBy: { createdAt: "asc" } });
    return events.map((e) => { const p = (e.payload ?? {}) as Record<string, unknown>; return { from: p.from as SuporteStatus, to: p.to as SuporteStatus, changedById: e.actorUserId ?? "", at: e.createdAt.toISOString() }; });
  }
  const store = await readStore();
  const item = store.items.find((suporte) => suporte.id === id);
  if (!item) return null;
  const timeline = Array.isArray(item.timeline) ? item.timeline : [];
  return timeline;
}


export async function updateSuporte(
  id: string,
  patch: {
    title?: unknown;
    description?: unknown;
    type?: unknown;
    priority?: unknown;
    tags?: unknown;
    assignedToUserId?: unknown;
    updatedBy: string;
  },
) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const current = await prisma.ticket.findUnique({ where: { id } });
    if (!current) return null;
    const title = sanitizeText(patch.title, 120) || current.title;
    const description = typeof patch.description === "string" ? sanitizeText(patch.description, 2000) : current.description;
    const type = patch.type === undefined ? current.type : normalizeType(patch.type);
    const priority = patch.priority === undefined ? current.priority : normalizePriority(patch.priority);
    const tags = patch.tags === undefined ? current.tags : normalizeTags(patch.tags);
    const assignedToUserId = patch.assignedToUserId === undefined ? current.assignedToUserId : typeof patch.assignedToUserId === "string" ? patch.assignedToUserId.trim() || null : null;
    const row = await prisma.ticket.update({ where: { id }, data: { title, description, type, priority, tags, assignedToUserId, updatedBy: patch.updatedBy }, include: { events: true } });
    return pgTicketToRecord(row);
  }
  const store = await readStore();
  const idx = store.items.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  const current = store.items[idx];
  const title = sanitizeText(patch.title, 120) || current.title;
  const description =
    typeof patch.description === "string" ? sanitizeText(patch.description, 2000) : current.description;
  const type =
    patch.type === undefined
      ? current.type ?? "tarefa"
      : normalizeType(patch.type);
  const priority =
    patch.priority === undefined ? current.priority : normalizePriority(patch.priority);
  const tags = patch.tags === undefined ? current.tags : normalizeTags(patch.tags);
  const assignedToUserId =
    patch.assignedToUserId === undefined
      ? current.assignedToUserId ?? null
      : typeof patch.assignedToUserId === "string"
        ? patch.assignedToUserId.trim() || null
        : null;
  const updated: SuporteRecord = {
    ...current,
    title,
    description,
    type,
    priority,
    tags,
    assignedToUserId,
    updatedAt: new Date().toISOString(),
    updatedBy: patch.updatedBy,
  };
  store.items[idx] = updated;
  await writeStore(store);
  return normalizeRecord(updated);
}


export async function touchSuporte(id: string, updatedBy?: string | null) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const row = await prisma.ticket.update({ where: { id }, data: { updatedBy: updatedBy ?? undefined }, include: { events: true } });
    return pgTicketToRecord(row);
  }
  const store = await readStore();
  const idx = store.items.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  const current = store.items[idx];
  const updated: SuporteRecord = {
    ...current,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy ?? current.updatedBy ?? null,
  };
  store.items[idx] = updated;
  await writeStore(store);
  return normalizeRecord(updated);
}

// Backwards-compatible aliases (legacy "Ticket" API)
export const getTicketById = getSuporteById;
export const touchTicket = touchSuporte;
export const updateTicket = updateSuporte;
export const updateTicketStatus = updateSuporteStatus;
export const listTicketTimeline = listSuporteTimeline;
export const listAllTickets = listAllSuportes;
export const listTicketsForUser = listSuportesForUser;
export const createTicket = createSuporte;
export const importTickets = importSuportes;
export const deleteTicketForUser = deleteSuporteForUser;
export const updateTicketForUser = updateSuporteForUser;
