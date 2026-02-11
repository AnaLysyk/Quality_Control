import "server-only";

import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type AccessRequestComment = {
  id: string;
  requestId: string;
  authorRole: "admin" | "requester";
  authorName: string;
  authorEmail?: string | null;
  authorId?: string | null;
  body: string;
  createdAt: string;
};

type StorePayload = { items: AccessRequestComment[] };

const STORE_PATH = path.join(process.cwd(), "data", "access-request-comments.json");

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    const initial: StorePayload = { items: [] };
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<StorePayload> {
  await ensureStore();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as StorePayload;
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return { items };
  } catch {
    return { items: [] };
  }
}

async function writeStore(next: StorePayload) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
}

export async function listAccessRequestComments(requestId: string) {
  if (!requestId) return [];
  const store = await readStore();
  return store.items
    .filter((item) => item.requestId === requestId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createAccessRequestComment(input: {
  requestId: string;
  authorRole: "admin" | "requester";
  authorName: string;
  authorEmail?: string | null;
  authorId?: string | null;
  body: string;
}) {
  const now = new Date().toISOString();
  const record: AccessRequestComment = {
    id: randomUUID(),
    requestId: input.requestId,
    authorRole: input.authorRole,
    authorName: input.authorName.trim() || "Usuario",
    authorEmail: input.authorEmail ?? null,
    authorId: input.authorId ?? null,
    body: input.body.trim(),
    createdAt: now,
  };
  const store = await readStore();
  store.items.push(record);
  await writeStore(store);
  return record;
}
