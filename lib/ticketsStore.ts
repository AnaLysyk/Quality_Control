import "server-only";

import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { getRedis, isRedisConfigured } from "@/lib/redis";

export type TicketStatus = "open" | "in_progress" | "closed";

export type TicketRecord = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName?: string | null;
  createdByEmail?: string | null;
  companySlug?: string | null;
  updatedBy?: string | null;
};

type TicketsStore = {
  items: TicketRecord[];
};

const STORE_PATH = path.join(process.cwd(), "data", "support-tickets.json");
const STORE_KEY = "qc:support_tickets:v1";
const USE_REDIS = process.env.TICKETS_STORE === "redis" || isRedisConfigured();
const USE_MEMORY =
  process.env.TICKETS_IN_MEMORY === "true" ||
  (!USE_REDIS && process.env.VERCEL === "1");
let memoryStore: TicketsStore = { items: [] };
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
    } catch (err) {
      if (!warnedFsFailure) {
        warnedFsFailure = true;
        console.warn("[TICKETS] Falha ao acessar filesystem; usando fallback em memoria.");
      }
      return false;
    }
  }
}

async function readStore(): Promise<TicketsStore> {
  if (USE_REDIS) {
    const redis = getRedis();
    const raw = await redis.get<string>(STORE_KEY);
    if (!raw) return { items: [] };
    try {
      const parsed = JSON.parse(raw) as TicketsStore;
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
    const parsed = JSON.parse(raw) as TicketsStore;
    return Array.isArray(parsed?.items) ? parsed : { items: [] };
  } catch {
    return memoryStore;
  }
}

async function writeStore(next: TicketsStore) {
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

function sanitizeText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function normalizeStatus(value?: string | null): TicketStatus | null {
  if (value === "open" || value === "in_progress" || value === "closed") return value;
  return null;
}

export async function listTicketsForUser(userId: string) {
  const store = await readStore();
  return store.items
    .filter((item) => item.createdBy === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function listAllTickets() {
  const store = await readStore();
  return [...store.items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function createTicket(input: {
  title?: unknown;
  description?: unknown;
  createdBy: string;
  createdByName?: string | null;
  createdByEmail?: string | null;
  companySlug?: string | null;
}) {
  const title = sanitizeText(input.title, 120);
  const description = sanitizeText(input.description, 2000);
  if (!title && !description) return null;

  const now = new Date().toISOString();
  const ticket: TicketRecord = {
    id: randomUUID(),
    title: title || "Novo chamado",
    description,
    status: "open",
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
    createdByName: input.createdByName ?? null,
    createdByEmail: input.createdByEmail ?? null,
    companySlug: input.companySlug ?? null,
  };

  const store = await readStore();
  store.items.unshift(ticket);
  await writeStore(store);
  return ticket;
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
  return updated;
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
  const updated: TicketRecord = {
    ...current,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  };
  store.items[idx] = updated;
  await writeStore(store);
  return updated;
}
