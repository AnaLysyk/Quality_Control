import "server-only";

import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getRedis, isRedisConfigured } from "@/lib/redis";
import { getJsonStorePath } from "./jsonStorePath";

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

const STORE_PATH = getJsonStorePath("access-request-comments.json");
const STORE_KEY = "qc:access_request_comments:v1";
const USE_REDIS = isRedisConfigured();
let warnedRedisFailure = false;

async function ensureFileStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    const initial: StorePayload = { items: [] };
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readFileStore(): Promise<StorePayload> {
  await ensureFileStore();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as StorePayload;
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return { items };
  } catch {
    return { items: [] };
  }
}

async function writeFileStore(next: StorePayload) {
  await ensureFileStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
}

async function readRedisStore(): Promise<StorePayload | null> {
  try {
    const redis = getRedis();
    const raw = await redis.get<string>(STORE_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw) as StorePayload;
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return { items };
  } catch (err) {
    if (!warnedRedisFailure) {
      warnedRedisFailure = true;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[accessRequestCommentsStore] Redis read failed, fallback file:", msg);
    }
    return null;
  }
}

async function writeRedisStore(next: StorePayload): Promise<boolean> {
  try {
    const redis = getRedis();
    await redis.set(STORE_KEY, JSON.stringify(next));
    return true;
  } catch (err) {
    if (!warnedRedisFailure) {
      warnedRedisFailure = true;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[accessRequestCommentsStore] Redis write failed, fallback file:", msg);
    }
    return false;
  }
}

async function readStore(): Promise<StorePayload> {
  if (USE_REDIS) {
    const redisStore = await readRedisStore();
    if (redisStore) return redisStore;
  }
  return readFileStore();
}

async function writeStore(next: StorePayload) {
  if (USE_REDIS) {
    const ok = await writeRedisStore(next);
    if (ok) return;
  }
  await writeFileStore(next);
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
