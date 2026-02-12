import "server-only";

import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { assertRedisConfigured, getRedis, isRedisConfigured } from "@/lib/redis";
import { getJsonStoreDir } from "@/data/jsonStorePath";

export type TicketReactionType = "like";

export type TicketReactionRecord = {
  id: string;
  ticketId: string;
  commentId: string;
  userId: string;
  type: TicketReactionType;
  createdAt: string;
};

type ReactionsStore = {
  items: TicketReactionRecord[];
};

const STORE_PATH = path.join(getJsonStoreDir(), "ticket-reactions.json");
const STORE_KEY = "qc:ticket_reactions:v1";
const REQUIRE_REDIS =
  process.env.TICKET_REACTIONS_STORE === "redis" ||
  process.env.TICKET_REACTIONS_REQUIRE_REDIS === "true" ||
  Boolean(process.env.VERCEL);
const USE_REDIS = REQUIRE_REDIS || isRedisConfigured();
const USE_MEMORY = !REQUIRE_REDIS && process.env.TICKET_REACTIONS_IN_MEMORY === "true";
let memoryStore: ReactionsStore = { items: [] };
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
        console.warn("[TICKET_REACTIONS] Falha ao acessar filesystem; usando fallback em memoria.");
      }
      return false;
    }
  }
}

async function readStore(): Promise<ReactionsStore> {
  if (USE_REDIS) {
    assertRedisConfigured("Ticket reactions");
    const redis = getRedis();
    try {
      const raw = await redis.get<string>(STORE_KEY);
      if (!raw) return { items: [] };
      const parsed = JSON.parse(raw) as ReactionsStore;
      return Array.isArray(parsed?.items) ? parsed : { items: [] };
    } catch (err) {
      if (REQUIRE_REDIS) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`[TICKET_REACTIONS] Redis indisponivel: ${msg}`);
      }
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
    const parsed = JSON.parse(raw) as ReactionsStore;
    return Array.isArray(parsed?.items) ? parsed : { items: [] };
  } catch {
    return memoryStore;
  }
}

async function writeStore(next: ReactionsStore) {
  if (USE_REDIS) {
    assertRedisConfigured("Ticket reactions");
    const redis = getRedis();
    try {
      await redis.set(STORE_KEY, JSON.stringify(next));
      return;
    } catch (err) {
      if (REQUIRE_REDIS) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`[TICKET_REACTIONS] Redis indisponivel: ${msg}`);
      }
      return;
    }
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

export async function listReactionsByTicket(ticketId: string) {
  const store = await readStore();
  return store.items.filter((item) => item.ticketId === ticketId);
}

export async function listReactionsByComment(commentId: string) {
  const store = await readStore();
  return store.items.filter((item) => item.commentId === commentId);
}

export async function addReaction(input: {
  ticketId: string;
  commentId: string;
  userId: string;
  type: TicketReactionType;
}) {
  const store = await readStore();
  const exists = store.items.find(
    (item) => item.commentId === input.commentId && item.userId === input.userId && item.type === input.type,
  );
  if (exists) return { reaction: exists, created: false };
  const reaction: TicketReactionRecord = {
    id: randomUUID(),
    ticketId: input.ticketId,
    commentId: input.commentId,
    userId: input.userId,
    type: input.type,
    createdAt: new Date().toISOString(),
  };
  store.items.unshift(reaction);
  await writeStore(store);
  return { reaction, created: true };
}

export async function removeReaction(input: {
  commentId: string;
  userId: string;
  type: TicketReactionType;
}) {
  const store = await readStore();
  const before = store.items.length;
  store.items = store.items.filter(
    (item) => !(item.commentId === input.commentId && item.userId === input.userId && item.type === input.type),
  );
  if (store.items.length === before) return false;
  await writeStore(store);
  return true;
}
