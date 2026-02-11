import "server-only";

import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { getRedis, isRedisConfigured } from "@/lib/redis";
import { LEGACY_TICKET_STATUS_MAP, type TicketStatus } from "@/lib/ticketsStatus";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type TicketRecord = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName?: string | null;
  createdByEmail?: string | null;
  companySlug?: string | null;
  companyId?: string | null;
  assignedToUserId?: string | null;
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
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized in LEGACY_TICKET_STATUS_MAP) return LEGACY_TICKET_STATUS_MAP[normalized];
  if (
    normalized === "backlog" ||
    normalized === "refining" ||
    normalized === "ticket" ||
    normalized === "in_progress" ||
    normalized === "in_review" ||
    normalized === "ready_deploy" ||
    normalized === "done"
  ) {
    return normalized as TicketStatus;
  }
  return null;
}

function normalizePriority(value?: unknown): TicketPriority {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "urgent") return raw;
  return "medium";
}

function normalizeTags(value?: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const tag = entry.trim();
    if (!tag) continue;
    unique.add(tag.slice(0, 40));
  }
  return Array.from(unique);
}

function normalizeRecord(raw: TicketRecord): TicketRecord {
  const status = normalizeStatus(raw.status) ?? "backlog";
  return {
    ...raw,
    status,
    priority: normalizePriority(raw.priority),
    tags: normalizeTags(raw.tags),
    companyId: raw.companyId ?? null,
    assignedToUserId: raw.assignedToUserId ?? null,
  };
}

export async function listTicketsForUser(userId: string) {
  const store = await readStore();
  return store.items
    .filter((item) => item.createdBy === userId)
    .map((item) => normalizeRecord(item))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function listAllTickets() {
  const store = await readStore();
  return [...store.items].map((item) => normalizeRecord(item)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getTicketById(id: string) {
  const store = await readStore();
  const item = store.items.find((ticket) => ticket.id === id);
  return item ? normalizeRecord({ ...item }) : null;
}

export async function createTicket(input: {
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  tags?: unknown;
  createdBy: string;
  createdByName?: string | null;
  createdByEmail?: string | null;
  companySlug?: string | null;
  companyId?: string | null;
  assignedToUserId?: string | null;
}) {
  const title = sanitizeText(input.title, 120);
  const description = sanitizeText(input.description, 2000);
  if (!title && !description) return null;

  const now = new Date().toISOString();
  const ticket: TicketRecord = {
    id: randomUUID(),
    title: title || "Novo chamado",
    description,
    status: "backlog",
    priority: normalizePriority(input.priority),
    tags: normalizeTags(input.tags),
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
    createdByName: input.createdByName ?? null,
    createdByEmail: input.createdByEmail ?? null,
    companySlug: input.companySlug ?? null,
    companyId: input.companyId ?? null,
    assignedToUserId: input.assignedToUserId ?? null,
  };

  const store = await readStore();
  store.items.unshift(ticket);
  await writeStore(store);
  return normalizeRecord(ticket);
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
  return normalizeRecord(updated);
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
  return normalizeRecord(updated);
}

export async function updateTicket(
  id: string,
  patch: {
    title?: unknown;
    description?: unknown;
    priority?: unknown;
    tags?: unknown;
    assignedToUserId?: unknown;
    updatedBy: string;
  },
) {
  const store = await readStore();
  const idx = store.items.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  const current = store.items[idx];
  const title = sanitizeText(patch.title, 120) || current.title;
  const description =
    typeof patch.description === "string" ? sanitizeText(patch.description, 2000) : current.description;
  const priority =
    patch.priority === undefined ? current.priority : normalizePriority(patch.priority);
  const tags = patch.tags === undefined ? current.tags : normalizeTags(patch.tags);
  const assignedToUserId =
    patch.assignedToUserId === undefined
      ? current.assignedToUserId ?? null
      : typeof patch.assignedToUserId === "string"
        ? patch.assignedToUserId.trim() || null
        : null;
  const updated: TicketRecord = {
    ...current,
    title,
    description,
    priority,
    tags,
    assignedToUserId,
    updatedAt: new Date().toISOString(),
    updatedBy: patch.updatedBy,
  };
  store.items[idx] = updated;
  await writeStore(store);
  return normalizeRecord(updated);
}

export async function touchTicket(id: string, updatedBy?: string | null) {
  const store = await readStore();
  const idx = store.items.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  const current = store.items[idx];
  const updated: TicketRecord = {
    ...current,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy ?? current.updatedBy ?? null,
  };
  store.items[idx] = updated;
  await writeStore(store);
  return normalizeRecord(updated);
}
