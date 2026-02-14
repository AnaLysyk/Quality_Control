import "server-only";

import path from "node:path";
import fs from "node:fs/promises";
import { type Card } from "./types";

type LockState = {
  promise: Promise<void>;
};

type KanbanStore = {
  lastId: number;
  items: Card[];
};

const STORE_PATH = path.join(process.cwd(), "data", "kanban.json");
const STORE_TMP_PATH = `${STORE_PATH}.tmp`;
const STORE_BACKUP_PATH = `${STORE_PATH}.bak`;
const EMPTY_STORE: KanbanStore = { lastId: 0, items: [] };

const LOCK_SYMBOL = Symbol.for("kanbanStoreLock");
const globalLock = globalThis as typeof globalThis & { [LOCK_SYMBOL]?: LockState };

function getLock(): LockState {
  if (!globalLock[LOCK_SYMBOL]) {
    globalLock[LOCK_SYMBOL] = { promise: Promise.resolve() };
  }
  return globalLock[LOCK_SYMBOL]!;
}

async function runExclusive<T>(operation: () => Promise<T>): Promise<T> {
  const lock = getLock();
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = lock.promise;
  lock.promise = lock.promise.then(() => next);
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function ensureFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(EMPTY_STORE, null, 2), "utf8");
  }
}

function normalizeStore(raw: unknown): KanbanStore {
  if (!raw || typeof raw !== "object") return { ...EMPTY_STORE };
  const record = raw as Partial<KanbanStore>;
  const items = Array.isArray(record.items) ? (record.items as Card[]) : [];
  const lastId = Number.isFinite(Number(record.lastId)) ? Number(record.lastId) : 0;
  return { lastId, items };
}

export async function readKanbanStore(): Promise<KanbanStore> {
  try {
    await ensureFile();
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return normalizeStore(JSON.parse(raw));
  } catch {
    return { ...EMPTY_STORE };
  }
}

async function persistStore(payload: KanbanStore) {
  await ensureFile();
  const serialized = JSON.stringify(payload, null, 2);
  try {
    await fs.copyFile(STORE_PATH, STORE_BACKUP_PATH);
  } catch {
    // ignore backup copy errors when file is missing
  }
  await fs.writeFile(STORE_TMP_PATH, serialized, "utf8");
  await fs.rename(STORE_TMP_PATH, STORE_PATH);
}

export async function writeKanbanStore(store: KanbanStore): Promise<void> {
  const payload: KanbanStore = {
    lastId: Number.isFinite(Number(store.lastId)) ? Number(store.lastId) : 0,
    items: Array.isArray(store.items) ? store.items : [],
  };
  await runExclusive(async () => {
    await persistStore(payload);
  });
}

export function getNextId(store: KanbanStore): number {
  const maxExisting = store.items.reduce((max, item) => (typeof item.id === "number" && item.id > max ? item.id : max), 0);
  const base = Math.max(store.lastId ?? 0, maxExisting);
  store.lastId = base + 1;
  return store.lastId;
}

export async function mutateKanbanStore(mutator: (store: KanbanStore) => void | Promise<void>): Promise<KanbanStore> {
  return runExclusive(async () => {
    const current = await readKanbanStore();
    const working: KanbanStore = {
      lastId: current.lastId,
      items: [...current.items],
    };
    await mutator(working);
    const payload: KanbanStore = {
      lastId: Number.isFinite(Number(working.lastId)) ? Number(working.lastId) : 0,
      items: Array.isArray(working.items) ? working.items : [],
    };
    await persistStore(payload);
    return payload;
  });
}
