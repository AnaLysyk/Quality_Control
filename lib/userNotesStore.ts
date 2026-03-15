import "server-only";

import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { getRedis, isRedisConfigured } from "@/lib/redis";

const USE_POSTGRES = process.env.AUTH_STORE === "postgres";
async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

export const NOTE_COLOR_KEYS = [
  "amber",
  "sky",
  "emerald",
  "rose",
  "violet",
  "orange",
] as const;

export const NOTE_STATUS_VALUES = ["Rascunho", "Em andamento", "Concluido", "Arquivado"] as const;
export const NOTE_PRIORITY_VALUES = ["Baixa", "Media", "Alta", "Urgente"] as const;

export type NoteColor = (typeof NOTE_COLOR_KEYS)[number];
export type NoteStatus = (typeof NOTE_STATUS_VALUES)[number];
export type NotePriority = (typeof NOTE_PRIORITY_VALUES)[number];

export type UserNote = {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  status: NoteStatus;
  priority: NotePriority;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type NotesStore = Record<string, UserNote[]>;

const STORE_PATH = path.join(process.cwd(), "data", "user-notes.json");
const STORE_KEY_PREFIX = "qc:user_notes:v1";
const USE_REDIS = process.env.NOTES_STORE === "redis" || isRedisConfigured();
const USE_MEMORY =
  process.env.NOTES_IN_MEMORY === "true" ||
  (!USE_REDIS && process.env.VERCEL === "1");

// In-memory fallback store (non-persistent)
let memoryStore: NotesStore = {};
let warnedFsFailure = false;

async function ensureStoreFile(): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.access(STORE_PATH);
    return true;
  } catch {
    try {
      await fs.writeFile(STORE_PATH, JSON.stringify({}), "utf8");
      return true;
    } catch (err) {
        if (!warnedFsFailure) {
        warnedFsFailure = true;
        console.warn(
          "[userNotesStore] Falha ao acessar filesystem; usando memoria.",
          err instanceof Error ? err.message : String(err),
        );
      }
      return false;
    }
  }
}

async function readStoreFile(): Promise<NotesStore> {
  const ok = await ensureStoreFile();
  if (!ok) return memoryStore;
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as NotesStore) : {};
    } catch (_err) {
      const msg = _err instanceof Error ? _err.message : String(_err);
    console.warn("[userNotesStore] Falha ao ler arquivo, usando memoria:", msg);
    return memoryStore;
  }
}

async function writeStoreFile(next: NotesStore) {
  const ok = await ensureStoreFile();
  if (!ok) {
    memoryStore = next;
    return;
  }
  try {
    await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
    } catch (_err) {
      const msg = _err instanceof Error ? _err.message : String(_err);
    console.warn("[userNotesStore] Falha ao escrever arquivo, usando memoria:", msg);
    memoryStore = next;
  }
}

async function readStoreRedis(userId?: string): Promise<NotesStore | UserNote[] | null> {
  const redis = getRedis();
  if (!userId) {
    // Not used in current code, keep for completeness
    return {};
  }
  try {
    const key = `${STORE_KEY_PREFIX}:${userId}`;
    const raw = await redis.get<string>(key);
    if (!raw) return [];
    return JSON.parse(raw) as UserNote[];
    } catch (_err) {
      const msg = _err instanceof Error ? _err.message : String(_err);
    console.warn("[userNotesStore] Redis read failed, falling back to memory:", msg);
    return null;
  }
}

async function writeStoreRedis(userId: string, items: UserNote[]) {
  const redis = getRedis();
  const key = `${STORE_KEY_PREFIX}:${userId}`;
  try {
    await redis.set(key, JSON.stringify(items));
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[userNotesStore] Redis write failed, falling back to memory:", msg);
    return false;
  }
}

function sanitizeText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function normalizeColor(value: unknown): NoteColor {
  if (typeof value === "string" && NOTE_COLOR_KEYS.includes(value as NoteColor)) {
    return value as NoteColor;
  }
  return "amber";
}

function normalizeStatus(value: unknown): NoteStatus {
  if (typeof value === "string" && NOTE_STATUS_VALUES.includes(value as NoteStatus)) {
    return value as NoteStatus;
  }
  return "Rascunho";
}

function normalizePriority(value: unknown): NotePriority {
  if (typeof value === "string" && NOTE_PRIORITY_VALUES.includes(value as NotePriority)) {
    return value as NotePriority;
  }
  return "Media";
}

function sanitizeTag(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/,+/g, "")
    .slice(0, 24);
}

function normalizeTags(value: unknown) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n]/) : [];
  const tags = source.map((item) => sanitizeTag(item)).filter(Boolean);
  return Array.from(new Set(tags)).slice(0, 12);
}

function normalizeNote(note: Partial<UserNote> | null | undefined): UserNote {
  return {
    id: typeof note?.id === "string" && note.id.trim() ? note.id : randomUUID(),
    title: typeof note?.title === "string" && note.title.trim() ? note.title.trim().slice(0, 120) : "Sem titulo",
    content: typeof note?.content === "string" ? note.content.trim().slice(0, 12000) : "",
    color: normalizeColor(note?.color),
    status: normalizeStatus(note?.status),
    priority: normalizePriority(note?.priority),
    tags: normalizeTags(note?.tags),
    createdAt: typeof note?.createdAt === "string" && note.createdAt ? note.createdAt : new Date().toISOString(),
    updatedAt: typeof note?.updatedAt === "string" && note.updatedAt ? note.updatedAt : new Date().toISOString(),
  };
}

function pgToUserNote(r: { id: string; title: string; content: string; color: string; status: string; priority: string; tags: string[]; createdAt: Date; updatedAt: Date }): UserNote {
  return normalizeNote({ id: r.id, title: r.title, content: r.content, color: r.color as NoteColor, status: r.status as NoteStatus, priority: r.priority as NotePriority, tags: r.tags, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() });
}

export async function listUserNotes(userId: string) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.userNote.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
    return rows.map(pgToUserNote);
  }
  // Prefer Redis if configured
  if (USE_REDIS) {
    const fromRedis = await readStoreRedis(userId);
    if (Array.isArray(fromRedis)) {
      return fromRedis.map((note) => normalizeNote(note)).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    }
    // fallthrough to file/memory
  }

  if (USE_MEMORY) {
    const items = Array.isArray(memoryStore[userId]) ? memoryStore[userId] : [];
    return items.map((note) => normalizeNote(note)).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  // Try file store
  try {
    const store = await readStoreFile();
    const items = Array.isArray(store[userId]) ? store[userId] : [];
    return items.map((note) => normalizeNote(note)).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  } catch {
    const items = Array.isArray(memoryStore[userId]) ? memoryStore[userId] : [];
    return items.map((note) => normalizeNote(note)).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
}

export async function createUserNote(
  userId: string,
  input: { title?: unknown; content?: unknown; color?: unknown; status?: unknown; priority?: unknown; tags?: unknown },
) {
  const rawTitle = sanitizeText(input.title, 120);
  const rawContent = sanitizeText(input.content, 12000);
  if (!rawTitle && !rawContent) return null;
  const title = rawTitle || "Sem titulo";
  const content = rawContent;
  const color = normalizeColor(input.color);
  const status = normalizeStatus(input.status);
  const priority = normalizePriority(input.priority);
  const tags = normalizeTags(input.tags);
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const r = await prisma.userNote.create({ data: { userId, title, content, color, status, priority, tags } });
    return pgToUserNote(r);
  }
  if (!title && !content) {
    return null;
  }

  const now = new Date().toISOString();
  const note: UserNote = {
    id: randomUUID(),
    title,
    content,
    color,
    status,
    priority,
    tags,
    createdAt: now,
    updatedAt: now,
  };

  // Try Redis
  if (USE_REDIS) {
    const itemsFromRedis = (await readStoreRedis(userId)) ?? [];
    if (Array.isArray(itemsFromRedis)) {
      itemsFromRedis.unshift(note);
      const ok = await writeStoreRedis(userId, itemsFromRedis);
      if (ok) return note;
      // if redis failed, fallthrough to file/write
    }
  }

  if (USE_MEMORY) {
    const items = Array.isArray(memoryStore[userId]) ? memoryStore[userId] : [];
    items.unshift(note);
    memoryStore[userId] = items;
    return note;
  }

  // Try file store
  try {
    const store = await readStoreFile();
    const items = Array.isArray(store[userId]) ? store[userId] : [];
    items.unshift(note);
    store[userId] = items;
    await writeStoreFile(store);
    return note;
  } catch {
    // fallback to in-memory
    const items = Array.isArray(memoryStore[userId]) ? memoryStore[userId] : [];
    items.unshift(note);
    memoryStore[userId] = items;
    return note;
  }
}

export async function updateUserNote(
  userId: string,
  id: string,
  patch: { title?: unknown; content?: unknown; color?: unknown; status?: unknown; priority?: unknown; tags?: unknown },
) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const current = await prisma.userNote.findFirst({ where: { id, userId } });
    if (!current) return null;
    const norm = pgToUserNote(current);
    const title = sanitizeText(patch.title, 120) || norm.title;
    const content = typeof patch.content === "string" ? sanitizeText(patch.content, 12000) : norm.content;
    const color = normalizeColor(patch.color ?? norm.color);
    const status = patch.status === undefined ? norm.status : normalizeStatus(patch.status);
    const priority = patch.priority === undefined ? norm.priority : normalizePriority(patch.priority);
    const tags = patch.tags === undefined ? norm.tags : normalizeTags(patch.tags);
    const r = await prisma.userNote.update({ where: { id }, data: { title, content, color, status, priority, tags } });
    return pgToUserNote(r);
  }
  // Redis path
  if (USE_REDIS) {
    const itemsFromRedis = (await readStoreRedis(userId)) ?? [];
    if (Array.isArray(itemsFromRedis)) {
      const index = itemsFromRedis.findIndex((note) => note.id === id);
      if (index === -1) return null;
      const current = normalizeNote(itemsFromRedis[index]);
      const title = sanitizeText(patch.title, 120) || current.title;
      const content = typeof patch.content === "string" ? sanitizeText(patch.content, 12000) : current.content;
      const color = normalizeColor(patch.color ?? current.color);
      const status = patch.status === undefined ? current.status : normalizeStatus(patch.status);
      const priority = patch.priority === undefined ? current.priority : normalizePriority(patch.priority);
      const tags = patch.tags === undefined ? current.tags : normalizeTags(patch.tags);
      const updated: UserNote = { ...current, title, content, color, status, priority, tags, updatedAt: new Date().toISOString() };
      itemsFromRedis[index] = updated;
      const ok = await writeStoreRedis(userId, itemsFromRedis);
      if (ok) return updated;
      // fallthrough to file/memory
    }
  }

  if (USE_MEMORY) {
    const items = Array.isArray(memoryStore[userId]) ? memoryStore[userId] : [];
    const index = items.findIndex((note) => note.id === id);
    if (index === -1) return null;
    const current = normalizeNote(items[index]);
    const title = sanitizeText(patch.title, 120) || current.title;
    const content = typeof patch.content === "string" ? sanitizeText(patch.content, 12000) : current.content;
    const color = normalizeColor(patch.color ?? current.color);
    const status = patch.status === undefined ? current.status : normalizeStatus(patch.status);
    const priority = patch.priority === undefined ? current.priority : normalizePriority(patch.priority);
    const tags = patch.tags === undefined ? current.tags : normalizeTags(patch.tags);
    const updated: UserNote = { ...current, title, content, color, status, priority, tags, updatedAt: new Date().toISOString() };
    items[index] = updated;
    memoryStore[userId] = items;
    return updated;
  }

  // File / memory path
  try {
    const store = await readStoreFile();
    const items = Array.isArray(store[userId]) ? store[userId] : [];
    const index = items.findIndex((note) => note.id === id);
    if (index === -1) return null;
    const current = normalizeNote(items[index]);
    const title = sanitizeText(patch.title, 120) || current.title;
    const content = typeof patch.content === "string" ? sanitizeText(patch.content, 12000) : current.content;
    const color = normalizeColor(patch.color ?? current.color);
    const status = patch.status === undefined ? current.status : normalizeStatus(patch.status);
    const priority = patch.priority === undefined ? current.priority : normalizePriority(patch.priority);
    const tags = patch.tags === undefined ? current.tags : normalizeTags(patch.tags);
    const updated: UserNote = { ...current, title, content, color, status, priority, tags, updatedAt: new Date().toISOString() };
    items[index] = updated;
    store[userId] = items;
    await writeStoreFile(store);
    return updated;
  } catch {
    const items = Array.isArray(memoryStore[userId]) ? memoryStore[userId] : [];
    const index = items.findIndex((note) => note.id === id);
    if (index === -1) return null;
    const current = normalizeNote(items[index]);
    const title = sanitizeText(patch.title, 120) || current.title;
    const content = typeof patch.content === "string" ? sanitizeText(patch.content, 12000) : current.content;
    const color = normalizeColor(patch.color ?? current.color);
    const status = patch.status === undefined ? current.status : normalizeStatus(patch.status);
    const priority = patch.priority === undefined ? current.priority : normalizePriority(patch.priority);
    const tags = patch.tags === undefined ? current.tags : normalizeTags(patch.tags);
    const updated: UserNote = { ...current, title, content, color, status, priority, tags, updatedAt: new Date().toISOString() };
    items[index] = updated;
    memoryStore[userId] = items;
    return updated;
  }
}

export async function deleteUserNote(userId: string, id: string) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const existing = await prisma.userNote.findFirst({ where: { id, userId } });
    if (!existing) return false;
    await prisma.userNote.delete({ where: { id } });
    return true;
  }
  // Redis
  if (USE_REDIS) {
    const itemsFromRedis = (await readStoreRedis(userId)) ?? [];
    if (Array.isArray(itemsFromRedis)) {
      const next = itemsFromRedis.filter((note) => note.id !== id);
      if (next.length === itemsFromRedis.length) return false;
      const ok = await writeStoreRedis(userId, next);
      if (ok) return true;
      // fallthrough
    }
  }

  if (USE_MEMORY) {
    const items = Array.isArray(memoryStore[userId]) ? memoryStore[userId] : [];
    const next = items.filter((note) => note.id !== id);
    if (next.length === items.length) return false;
    memoryStore[userId] = next;
    return true;
  }

  try {
    const store = await readStoreFile();
    const items = Array.isArray(store[userId]) ? store[userId] : [];
    const next = items.filter((note) => note.id !== id);
    if (next.length === items.length) return false;
    store[userId] = next;
    await writeStoreFile(store);
    return true;
  } catch {
    const items = Array.isArray(memoryStore[userId]) ? memoryStore[userId] : [];
    const next = items.filter((note) => note.id !== id);
    if (next.length === items.length) return false;
    memoryStore[userId] = next;
    return true;
  }
}
