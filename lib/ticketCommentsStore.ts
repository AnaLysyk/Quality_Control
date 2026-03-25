import "server-only";

import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { getRedis, isRedisConfigured } from "@/lib/redis";
import { getJsonStoreDir } from "@/data/jsonStorePath";

const USE_POSTGRES = process.env.AUTH_STORE === "postgres";
async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

export type TicketCommentRecord = {
  id: string;
  ticketId: string;
  authorUserId: string;
  authorName?: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

type CommentsStore = {
  items: TicketCommentRecord[];
};

const STORE_PATH = path.join(getJsonStoreDir(), "ticket-comments.json");
const STORE_KEY = "qc:ticket_comments:v1";
const USE_REDIS = process.env.TICKET_COMMENTS_STORE === "redis" || isRedisConfigured();
const USE_MEMORY = process.env.TICKET_COMMENTS_IN_MEMORY === "true";
let memoryStore: CommentsStore = { items: [] };
let warnedFsFailure = false;

async function ensureStore(): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.access(STORE_PATH);
    return true;
  } catch {
    try {
      await fs.writeFile(STORE_PATH, JSON.stringify({ items: [] }, null, 2), "utf8");
      return true;
    } catch {
      if (!warnedFsFailure) {
        warnedFsFailure = true;
        console.warn("[TICKET_COMMENTS] Falha ao acessar filesystem; usando fallback em memoria.");
      }
      return false;
    }
  }
}

async function readStore(): Promise<CommentsStore> {
  if (USE_REDIS) {
    const redis = getRedis();
    const raw = await redis.get<string>(STORE_KEY);
    if (!raw) return { items: [] };
    try {
      const parsed = JSON.parse(raw) as CommentsStore;
      return Array.isArray(parsed?.items) ? parsed : { items: [] };
    } catch {
      return { items: [] };
    }
  }
  if (USE_MEMORY) {
    return memoryStore;
  }
  const ok = await ensureStore();
  if (!ok) return memoryStore;
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as CommentsStore;
    return Array.isArray(parsed?.items) ? parsed : { items: [] };
  } catch {
    return memoryStore;
  }
}

async function writeStore(next: CommentsStore) {
  if (USE_REDIS) {
    const redis = getRedis();
    await redis.set(STORE_KEY, JSON.stringify(next));
    return;
  }
  if (USE_MEMORY) {
    memoryStore = next;
    return;
  }
  const ok = await ensureStore();
  if (!ok) {
    memoryStore = next;
    return;
  }
  try {
    await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
  } catch {
    memoryStore = next;
  }
}

function sanitizeBody(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function pgToRecord(r: { id: string; ticketId: string; authorUserId: string; authorName?: string | null; body: string; createdAt: Date; updatedAt?: Date | null; deletedAt?: Date | null }): TicketCommentRecord {
  const created = r.createdAt ? r.createdAt.toISOString() : new Date().toISOString();
  const updated = r.updatedAt ? r.updatedAt.toISOString() : created;
  return { id: r.id, ticketId: r.ticketId, authorUserId: r.authorUserId, authorName: r.authorName ?? null, body: r.body, createdAt: created, updatedAt: updated, deletedAt: r.deletedAt?.toISOString() ?? null };
}

export async function listTicketComments(ticketId: string, opts?: { limit?: number; offset?: number }) {
  const limit = Math.max(1, Math.min(200, Number(opts?.limit ?? 100)));
  const offset = Math.max(0, Number(opts?.offset ?? 0));
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.ticketComment.findMany({ where: { ticketId }, orderBy: { createdAt: "desc" }, take: limit, skip: offset });
    return rows.map(pgToRecord);
  }
  const store = await readStore();
  const items = store.items
    .filter((item) => item.ticketId === ticketId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return items.slice(offset, offset + limit);
}

export async function createTicketComment(input: {
  ticketId: string;
  authorUserId: string;
  authorName?: string | null;
  body?: unknown;
}) {
  const body = sanitizeBody(input.body, 2000);
  if (!body) return null;
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const r = await prisma.ticketComment.create({ data: { ticketId: input.ticketId, authorUserId: input.authorUserId, authorName: input.authorName ?? null, body } });
    return pgToRecord(r);
  }
  const now = new Date().toISOString();
  const comment: TicketCommentRecord = {
    id: randomUUID(),
    ticketId: input.ticketId,
    authorUserId: input.authorUserId,
    authorName: input.authorName ?? null,
    body,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const store = await readStore();
  store.items.unshift(comment);
  await writeStore(store);
  return comment;
}

export async function updateTicketComment(
  commentId: string,
  body: unknown,
  actorUserId: string,
  opts?: { allowWhenDeleted?: boolean },
) {
  const nextBody = sanitizeBody(body, 2000);
  if (!nextBody) return null;
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const current = await prisma.ticketComment.findUnique({ where: { id: commentId } });
    if (!current) return null;
    if (current.deletedAt && !opts?.allowWhenDeleted) return null;
    const r = await prisma.ticketComment.update({ where: { id: commentId }, data: { body: nextBody } });
    return pgToRecord(r);
  }
  const store = await readStore();
  const idx = store.items.findIndex((item) => item.id === commentId);
  if (idx === -1) return null;
  const current = store.items[idx];
  if (current.deletedAt && !opts?.allowWhenDeleted) return null;
  const updated: TicketCommentRecord = {
    ...current,
    body: nextBody,
    updatedAt: new Date().toISOString(),
  };
  store.items[idx] = updated;
  await writeStore(store);
  return updated;
}

export async function softDeleteTicketComment(commentId: string, _actorUserId: string) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const current = await prisma.ticketComment.findUnique({ where: { id: commentId } });
    if (!current) return null;
    if (current.deletedAt) return pgToRecord(current);
    const r = await prisma.ticketComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    return pgToRecord(r);
  }
  const store = await readStore();
  void _actorUserId;
  const idx = store.items.findIndex((item) => item.id === commentId);
  if (idx === -1) return null;
  const current = store.items[idx];
  if (current.deletedAt) return current;
  const updated: TicketCommentRecord = {
    ...current,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.items[idx] = updated;
  await writeStore(store);
  return updated;
}

export async function findTicketCommentById(commentId: string) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const r = await prisma.ticketComment.findUnique({ where: { id: commentId } });
    return r ? pgToRecord(r) : null;
  }
  const store = await readStore();
  const item = store.items.find((comment) => comment.id === commentId);
  return item ? { ...item } : null;
}
