import "server-only";

import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { getRedis, isRedisConfigured } from "@/lib/redis";

export type TicketEventType =
  | "CREATED"
  | "STATUS_CHANGED"
  | "COMMENT_ADDED"
  | "COMMENT_UPDATED"
  | "COMMENT_DELETED"
  | "REACTION_ADDED"
  | "ASSIGNED"
  | "UPDATED";

export type TicketEventRecord = {
  id: string;
  ticketId: string;
  type: TicketEventType;
  payload: Record<string, unknown> | null;
  actorUserId?: string | null;
  createdAt: string;
};

type EventsStore = {
  items: TicketEventRecord[];
};

const STORE_PATH = path.join(process.cwd(), "data", "ticket-events.json");
const STORE_KEY = "qc:ticket_events:v1";
const USE_REDIS = process.env.TICKET_EVENTS_STORE === "redis" || isRedisConfigured();
const USE_MEMORY =
  process.env.TICKET_EVENTS_IN_MEMORY === "true" ||
  (!USE_REDIS && process.env.VERCEL === "1");
let memoryStore: EventsStore = { items: [] };
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
        console.warn("[TICKET_EVENTS] Falha ao acessar filesystem; usando fallback em memoria.");
      }
      return false;
    }
  }
}

async function readStore(): Promise<EventsStore> {
  if (USE_REDIS) {
    const redis = getRedis();
    const raw = await redis.get<string>(STORE_KEY);
    if (!raw) return { items: [] };
    try {
      const parsed = JSON.parse(raw) as EventsStore;
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
    const parsed = JSON.parse(raw) as EventsStore;
    return Array.isArray(parsed?.items) ? parsed : { items: [] };
  } catch {
    return memoryStore;
  }
}

async function writeStore(next: EventsStore) {
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

export async function listTicketEvents(ticketId: string, opts?: { limit?: number; offset?: number }) {
  const store = await readStore();
  const limit = Math.max(1, Math.min(200, Number(opts?.limit ?? 50)));
  const offset = Math.max(0, Number(opts?.offset ?? 0));
  const items = store.items
    .filter((item) => item.ticketId === ticketId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return items.slice(offset, offset + limit);
}

export async function appendTicketEvent(input: {
  ticketId: string;
  type: TicketEventType;
  payload?: Record<string, unknown> | null;
  actorUserId?: string | null;
  createdAt?: string;
}) {
  if (!input.ticketId) return null;
  const store = await readStore();
  const event: TicketEventRecord = {
    id: randomUUID(),
    ticketId: input.ticketId,
    type: input.type,
    payload: input.payload ?? null,
    actorUserId: input.actorUserId ?? null,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  store.items.unshift(event);
  await writeStore(store);
  return event;
}
