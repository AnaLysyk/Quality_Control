import "server-only";

import { randomUUID } from "crypto";
import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";
import { getRedis, isRedisConfigured } from "@/lib/redis";

const USE_POSTGRES = shouldUsePostgresPersistence();
async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

export type AccessRequestComment = {
  id: string;
  requestId: string;
  authorRole: "admin" | "requester" | "leader_tc";
  authorName: string;
  authorEmail?: string | null;
  authorId?: string | null;
  body: string;
  createdAt: string;
};

type StorePayload = { items: AccessRequestComment[] };

const STORE_KEY = "qc:access_request_comments:v1";
const USE_REDIS = isRedisConfigured();
let warnedRedisFailure = false;
let memoryStore: StorePayload = { items: [] };

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
      console.warn("[accessRequestCommentsStore] Redis read failed, fallback memory:", msg);
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
      console.warn("[accessRequestCommentsStore] Redis write failed, fallback memory:", msg);
    }
    return false;
  }
}

async function readStore(): Promise<StorePayload> {
  if (USE_REDIS) {
    const redisStore = await readRedisStore();
    if (redisStore) return redisStore;
  }
  return memoryStore;
}

async function writeStore(next: StorePayload) {
  if (USE_REDIS) {
    const ok = await writeRedisStore(next);
    if (ok) return;
  }
  memoryStore = next;
}

export async function listAccessRequestComments(requestId: string) {
  if (!requestId) return [];
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.accessRequestComment.findMany({
      where: { requestId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({ id: r.id, requestId: r.requestId, authorRole: r.authorRole as "admin" | "requester" | "leader_tc", authorName: r.authorName, authorEmail: r.authorEmail ?? null, authorId: r.authorId ?? null, body: r.body, createdAt: r.createdAt.toISOString() }));
  }
  const store = await readStore();
  return store.items
    .filter((item) => item.requestId === requestId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createAccessRequestComment(input: {
  requestId: string;
  authorRole: "admin" | "requester" | "leader_tc";
  authorName: string;
  authorEmail?: string | null;
  authorId?: string | null;
  body: string;
}) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const r = await prisma.accessRequestComment.create({
      data: { requestId: input.requestId, authorRole: input.authorRole, authorName: input.authorName.trim() || "Usuario", authorEmail: input.authorEmail ?? null, authorId: input.authorId ?? null, body: input.body.trim() },
    });
    return { id: r.id, requestId: r.requestId, authorRole: r.authorRole as "admin" | "requester" | "leader_tc", authorName: r.authorName, authorEmail: r.authorEmail ?? null, authorId: r.authorId ?? null, body: r.body, createdAt: r.createdAt.toISOString() };
  }
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
