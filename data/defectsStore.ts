import "server-only";

import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs/promises";

export type DefectRecord = {
  id: string;
  title: string;
  description: string | null;
  companyId: string;
  releaseManualId: string | null;
  status: string | null;
  createdAt: string;
};

type StoreShape = {
  items: DefectRecord[];
};

const STORE_PATH = path.join(process.cwd(), "data", "defects.json");

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    const initial: StoreShape = { items: [] };
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<StoreShape> {
  await ensureStore();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreShape> | null;
    const items = Array.isArray(parsed?.items) ? (parsed?.items as DefectRecord[]) : [];
    return { items };
  } catch {
    return { items: [] };
  }
}

async function writeStore(next: StoreShape) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
}

function sanitizeText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export async function listDefects(params: { companyId: string; releaseManualId?: string | null }) {
  const store = await readStore();
  const companyId = params.companyId;
  const releaseManualId = params.releaseManualId ?? null;
  return store.items
    .filter((item) => item.companyId === companyId && (!releaseManualId || item.releaseManualId === releaseManualId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createDefect(input: {
  title: unknown;
  description?: unknown;
  companyId: unknown;
  releaseManualId?: unknown;
}) {
  const title = sanitizeText(input.title, 200);
  const companyId = sanitizeText(input.companyId, 128);
  if (!title || !companyId) return null;

  const now = new Date().toISOString();
  const record: DefectRecord = {
    id: randomUUID(),
    title,
    description: sanitizeText(input.description, 4000),
    companyId,
    releaseManualId: sanitizeText(input.releaseManualId, 128),
    status: "open",
    createdAt: now,
  };

  const store = await readStore();
  store.items.push(record);
  await writeStore(store);
  return record;
}

