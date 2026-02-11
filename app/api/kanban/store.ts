import "server-only";

import path from "node:path";
import fs from "node:fs/promises";
import { type Card } from "./types";

type KanbanStore = {
  lastId: number;
  items: Card[];
};

const STORE_PATH = path.join(process.cwd(), "data", "kanban.json");
const EMPTY_STORE: KanbanStore = { lastId: 0, items: [] };

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

export async function writeKanbanStore(store: KanbanStore): Promise<void> {
  const payload: KanbanStore = {
    lastId: Number.isFinite(Number(store.lastId)) ? Number(store.lastId) : 0,
    items: Array.isArray(store.items) ? store.items : [],
  };
  await ensureFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export function getNextId(store: KanbanStore): number {
  const maxExisting = store.items.reduce((max, item) => (typeof item.id === "number" && item.id > max ? item.id : max), 0);
  const base = Math.max(store.lastId ?? 0, maxExisting);
  store.lastId = base + 1;
  return store.lastId;
}
