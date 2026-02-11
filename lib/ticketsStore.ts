import "server-only";

import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { getRedis, isRedisConfigured } from "@/lib/redis";
import { LEGACY_TICKET_STATUS_MAP, normalizeKanbanStatus, type TicketStatus } from "@/lib/ticketsStatus";

export type TicketPriority = "low" | "medium" | "high";
export type TicketType = "bug" | "melhoria" | "tarefa";

export type TicketRecord = {
  id: string;
  code: string;
  title: string;
  description: string;
  status: TicketStatus;
  type: TicketType;
  priority: TicketPriority;
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
  timeline?: TicketStatusHistory[];
};

type TicketsStore = {
  counter: number;
  items: TicketRecord[];
};

type TicketStatusHistory = {
  from: TicketStatus;
  to: TicketStatus;
  changedById: string;
  at: string;
};

type ExportPayload = {
  format: "tickets-export";
  version: number;
  exportedAt: string;
  counter: number;
  items: TicketRecord[];
};

type ImportMode = "merge" | "replace" | "upsert";

type ImportPayload = {
  format?: string;
  version?: number;
  exportedAt?: string;
  counter?: number;
  items?: unknown;
};

const STORE_PATH = path.join(process.cwd(), "data", "support-tickets.json");
const VERSION_DIR = path.join(process.cwd(), "data", "versions");
const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
const LOCK_PATH = `${STORE_PATH}.lock`;
const STORE_KEY = "qc:support_tickets:v1";
const STORE_COUNTER_KEY = "qc:support_tickets:counter:v1";
const USE_REDIS = process.env.TICKETS_STORE === "redis" || isRedisConfigured();
const USE_MEMORY =
  process.env.TICKETS_IN_MEMORY === "true" ||
  (!USE_REDIS && process.env.VERCEL === "1");

const FLUSH_INTERVAL_MS = Math.max(1000, Number(process.env.TICKETS_FLUSH_INTERVAL_MS ?? 5000));
const LOCK_TIMEOUT_MS = Math.max(1000, Number(process.env.TICKETS_LOCK_TIMEOUT_MS ?? 10000));
const LOCK_RETRY_MS = Math.max(50, Number(process.env.TICKETS_LOCK_RETRY_MS ?? 120));
const MAX_VERSIONS = Math.max(1, Number(process.env.TICKETS_MAX_VERSIONS ?? 20));
const BACKUP_INTERVAL_MS = Math.max(5000, Number(process.env.TICKETS_BACKUP_INTERVAL_MS ?? 60000));
const MAX_BACKUPS = Math.max(1, Number(process.env.TICKETS_MAX_BACKUPS ?? 30));

let memoryStore: TicketsStore = { items: [], counter: 0 };
let warnedFsFailure = false;
let cacheStore: TicketsStore | null = null;
let dirty = false;
let initPromise: Promise<void> | null = null;
let flushTimer: NodeJS.Timeout | null = null;
let backupTimer: NodeJS.Timeout | null = null;
let versionCounter = 0;
let flushingPromise: Promise<void> | null = null;
let warnedRedisFailure = false;

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
      return false;
    }
  }
}

function normalizeStore(raw: unknown): TicketsStore {
  if (Array.isArray(raw)) {
    return { items: raw.filter(Boolean) as TicketRecord[], counter: 0 };
  }
  if (!raw || typeof raw !== "object") {
    return { items: [], counter: 0 };
  }
  const record = raw as { items?: unknown; counter?: unknown };
  const items = Array.isArray(record.items) ? (record.items.filter(Boolean) as TicketRecord[]) : [];
  const counter = Number(record.counter ?? 0);
  return { items, counter: Number.isFinite(counter) ? counter : 0 };
}

function sanitizeText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function normalizeStatus(value?: string | null): TicketStatus | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const mapped = normalized in LEGACY_TICKET_STATUS_MAP ? LEGACY_TICKET_STATUS_MAP[normalized] : normalized;
  return normalizeKanbanStatus(mapped);
}

function normalizePriority(value?: unknown): TicketPriority {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "urgent") return "high";
  if (raw === "low" || raw === "medium" || raw === "high") return raw;
  return "medium";
}

function normalizeType(value?: unknown): TicketType {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "bug" || raw === "melhoria" || raw === "tarefa") return raw;
  return "tarefa";
}

function normalizeCode(value?: unknown): string {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (raw && raw.startsWith("CH-")) return raw;
  return "";
}

function parseCodeNumber(code: string): number {
  const match = code.match(/^CH-(\d{4,})$/i);
  if (!match) return 0;
  const num = Number.parseInt(match[1], 10);
  return Number.isFinite(num) ? num : 0;
}

function formatCode(counter: number) {
  return `CH-${String(counter).padStart(6, "0")}`;
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

function normalizeRecord(raw: TicketRecord): TicketRecord {
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

async function syncLegacyCodes(store: TicketsStore): Promise<TicketsStore> {
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
  if (USE_REDIS || USE_MEMORY) return fn();
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

async function loadStoreFromDisk(): Promise<TicketsStore> {
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
  if (flushTimer || USE_REDIS || USE_MEMORY) return;
  flushTimer = setInterval(() => {
    flushNow().catch(() => null);
  }, FLUSH_INTERVAL_MS);
  flushTimer?.unref?.();
}

function startBackupLoop() {
  if (backupTimer || USE_REDIS || USE_MEMORY) return;
  backupTimer = setInterval(() => {
    createBackup().catch(() => null);
  }, BACKUP_INTERVAL_MS);
  backupTimer?.unref?.();
}

async function initStore() {
  if (USE_REDIS || USE_MEMORY) return;
  if (cacheStore) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await fs.mkdir(VERSION_DIR, { recursive: true });
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    cacheStore = await loadStoreFromDisk();
    await loadVersionCounter();
    startFlushLoop();
    startBackupLoop();
  })();
  return initPromise;
}

async function readStore(): Promise<TicketsStore> {
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
  if (USE_MEMORY) {
    return memoryStore;
  }
  await initStore();
  if (!cacheStore) {
    cacheStore = await loadStoreFromDisk();
  }
  return cacheStore;
}

async function writeStore(next: TicketsStore) {
  const payload: TicketsStore = { counter: next.counter ?? 0, items: next.items ?? [] };
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
  if (USE_MEMORY) {
    memoryStore = payload;
    return;
  }
  await initStore();
  cacheStore = payload;
  dirty = true;
}

function buildVersionName(counter: number) {
  return `support-tickets.v${String(counter).padStart(6, "0")}.json`;
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
  return `support-tickets.bak-${stamp}.json`;
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
  if (USE_REDIS || USE_MEMORY) return;
  await initStore();
  if (!cacheStore) return;
  await withFileLock(async () => {
    const filePath = path.join(BACKUP_DIR, buildBackupName());
    await fs.writeFile(filePath, JSON.stringify(cacheStore, null, 2), "utf8");
    await rotateBackups();
  });
}

export async function flushNow() {
  if (USE_REDIS || USE_MEMORY) return;
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
  if (USE_REDIS || USE_MEMORY) return [];
  await initStore();
  const files = (await fs.readdir(VERSION_DIR)).filter((file) => file.endsWith(".json")).sort();
  return files;
}

export async function restoreVersion(name: string) {
  if (USE_REDIS || USE_MEMORY) {
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

export async function exportTickets(filter?: (item: TicketRecord) => boolean): Promise<ExportPayload> {
  const store = await syncLegacyCodes(await readStore());
  const items = filter ? store.items.filter(filter) : store.items;
  return {
    format: "tickets-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    counter: store.counter,
    items,
  };
}

function validateImportItem(item: TicketRecord) {
  if (!item.id || !item.title || !item.createdBy || !item.companyId) {
    throw new Error("TICKETS_IMPORT_INVALID_ITEM");
  }
}

export async function importTickets(payload: ImportPayload, mode: ImportMode) {
  if (USE_REDIS || USE_MEMORY) {
    throw new Error("TICKETS_IMPORT_UNSUPPORTED");
  }
  if (!payload || payload.format !== "tickets-export") {
    throw new Error("TICKETS_IMPORT_INVALID_FORMAT");
  }
  if (!Array.isArray(payload.items)) {
    throw new Error("TICKETS_IMPORT_INVALID_ITEMS");
  }
  await initStore();
  await createBackup();
  await withFileLock(async () => {
    const nextItems = payload.items as TicketRecord[];
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

export async function listTicketsForUser(userId: string) {
  const store = await syncLegacyCodes(await readStore());
  return store.items
    .filter((item) => item.createdBy === userId)
    .map((item) => normalizeRecord(item))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function listAllTickets() {
  const store = await syncLegacyCodes(await readStore());
  return [...store.items].map((item) => normalizeRecord(item)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getTicketById(id: string) {
  const store = await syncLegacyCodes(await readStore());
  const item = store.items.find((ticket) => ticket.id === id);
  return item ? normalizeRecord({ ...item }) : null;
}

export async function createTicket(input: {
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
  if (!title && !description) return null;

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
  const ticket: TicketRecord = {
    id: randomUUID(),
    code,
    title: title || "Novo chamado",
    description,
    status: "backlog",
    type,
    priority: normalizePriority(input.priority),
    tags: normalizeTags(input.tags),
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
    createdByName: input.createdByName ?? null,
    createdByEmail: input.createdByEmail ?? null,
    companySlug: input.companySlug ?? null,
    companyId: input.companyId ?? null,
    assignedToUserId: input.assignedToUserId ?? null,
    timeline: [],
  };

  store.items.unshift(ticket);
  await writeStore(store);
  return normalizeRecord(ticket);
}

export async function updateTicketForUser(
  userId: string,
  id: string,
  patch: { title?: unknown; description?: unknown },
) {
  const store = await readStore();
  const idx = store.items.findIndex((item) => item.id === id && item.createdBy === userId);
  if (idx === -1) return null;
  const current = store.items[idx];
  const title = sanitizeText(patch.title, 120) || current.title;
  const description =
    typeof patch.description === "string" ? sanitizeText(patch.description, 2000) : current.description;
  const updated: TicketRecord = {
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

export async function deleteTicketForUser(userId: string, id: string) {
  const store = await readStore();
  const before = store.items.length;
  store.items = store.items.filter((item) => !(item.id === id && item.createdBy === userId));
  if (store.items.length === before) return false;
  await writeStore(store);
  return true;
}

export async function updateTicketStatus(id: string, status: string, actorId: string) {
  const nextStatus = normalizeStatus(status);
  if (!nextStatus) return null;
  const store = await readStore();
  const idx = store.items.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  const current = store.items[idx];
  const timeline = Array.isArray(current.timeline) ? current.timeline : [];
  if (current.status === nextStatus) {
    return normalizeRecord({ ...current, timeline });
  }
  const updated: TicketRecord = {
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

export async function listTicketTimeline(id: string) {
  const store = await readStore();
  const item = store.items.find((ticket) => ticket.id === id);
  if (!item) return null;
  const timeline = Array.isArray(item.timeline) ? item.timeline : [];
  return timeline;
}

export async function updateTicket(
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
  const updated: TicketRecord = {
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

export async function touchTicket(id: string, updatedBy?: string | null) {
  const store = await readStore();
  const idx = store.items.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  const current = store.items[idx];
  const updated: TicketRecord = {
    ...current,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy ?? current.updatedBy ?? null,
  };
  store.items[idx] = updated;
  await writeStore(store);
  return normalizeRecord(updated);
}
