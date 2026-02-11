import "server-only";

import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { getRedis, isRedisConfigured } from "@/lib/redis";

export const NOTE_COLOR_KEYS = [
  "amber",
  "sky",
  "emerald",
  "rose",
  "violet",
  "orange",
] as const;

export type NoteColor = (typeof NOTE_COLOR_KEYS)[number];

export type UserNote = {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
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
        console.warn("[userNotesStore] Falha ao acessar filesystem; usando memoria.");
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
    // @ts-expect-error - redis client typing may be dynamic in different runtimes
    const raw = await redis.get<string>(key);
    if (!raw) return [];
    return JSON.parse(raw) as UserNote[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[userNotesStore] Redis read failed, falling back to memory:", msg);
    return null;
  }
}

async function writeStoreRedis(userId: string, items: UserNote[]) {
  const redis = getRedis();
  const key = `${STORE_KEY_PREFIX}:${userId}`;
  try {
    // @ts-expect-error - redis client typing may be dynamic in different runtimes
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

export async function listUserNotes(userId: string) {
  // Prefer Redis if configured
  if (USE_REDIS) {
    const fromRedis = await readStoreRedis(userId);
    if (Array.isArray(fromRedis)) {
      return fromRedis.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    }
    // fallthrough to file/memory
  }

  if (USE_MEMORY) {
    const items = Array.isArray(memoryStore[userId]) ? memoryStore[userId] : [];
    return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  // Try file store
  try {
    const store = await readStoreFile();
    const items = Array.isArray(store[userId]) ? store[userId] : [];
    return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  } catch {
    const items = Array.isArray(memoryStore[userId]) ? memoryStore[userId] : [];
    return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
}

export async function createUserNote(
  userId: string,
  input: { title?: unknown; content?: unknown; color?: unknown },
) {
  const rawTitle = sanitizeText(input.title, 120);
  const rawContent = sanitizeText(input.content, 4000);
  if (!rawTitle && !rawContent) return null;
  const title = rawTitle || "Sem titulo";
  const content = rawContent;
  const color = normalizeColor(input.color);
  if (!title && !content) {
    return null;
  }

  const now = new Date().toISOString();
  const note: UserNote = {
    id: randomUUID(),
    title,
    content,
    color,
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
  } catch (err) {
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
  patch: { title?: unknown; content?: unknown; color?: unknown },
) {
  // Redis path
  if (USE_REDIS) {
    const itemsFromRedis = (await readStoreRedis(userId)) ?? [];
    if (Array.isArray(itemsFromRedis)) {
      const index = itemsFromRedis.findIndex((note) => note.id === id);
      if (index === -1) return null;
      const current = itemsFromRedis[index];
      const title = sanitizeText(patch.title, 120) || current.title;
      const content = typeof patch.content === "string" ? sanitizeText(patch.content, 4000) : current.content;
      const color = normalizeColor(patch.color ?? current.color);
      const updated: UserNote = { ...current, title, content, color, updatedAt: new Date().toISOString() };
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
    const current = items[index];
    const title = sanitizeText(patch.title, 120) || current.title;
    const content = typeof patch.content === "string" ? sanitizeText(patch.content, 4000) : current.content;
    const color = normalizeColor(patch.color ?? current.color);
    const updated: UserNote = { ...current, title, content, color, updatedAt: new Date().toISOString() };
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
    const current = items[index];
    const title = sanitizeText(patch.title, 120) || current.title;
    const content = typeof patch.content === "string" ? sanitizeText(patch.content, 4000) : current.content;
    const color = normalizeColor(patch.color ?? current.color);
    const updated: UserNote = { ...current, title, content, color, updatedAt: new Date().toISOString() };
    items[index] = updated;
    store[userId] = items;
    await writeStoreFile(store);
    return updated;
  } catch (err) {
    const items = Array.isArray(memoryStore[userId]) ? memoryStore[userId] : [];
    const index = items.findIndex((note) => note.id === id);
    if (index === -1) return null;
    const current = items[index];
    const title = sanitizeText(patch.title, 120) || current.title;
    const content = typeof patch.content === "string" ? sanitizeText(patch.content, 4000) : current.content;
    const color = normalizeColor(patch.color ?? current.color);
    const updated: UserNote = { ...current, title, content, color, updatedAt: new Date().toISOString() };
    items[index] = updated;
    memoryStore[userId] = items;
    return updated;
  }
}

export async function deleteUserNote(userId: string, id: string) {
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
  } catch (err) {
    const items = Array.isArray(memoryStore[userId]) ? memoryStore[userId] : [];
    const next = items.filter((note) => note.id !== id);
    if (next.length === items.length) return false;
    memoryStore[userId] = next;
    return true;
  }
}
