import "server-only";

import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs/promises";

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

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify({}), "utf8");
  }
}

async function readStore(): Promise<NotesStore> {
  await ensureStore();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as NotesStore) : {};
  } catch {
    return {};
  }
}

async function writeStore(next: NotesStore) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
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
  const store = await readStore();
  const items = Array.isArray(store[userId]) ? store[userId] : [];
  return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
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

  const store = await readStore();
  const items = Array.isArray(store[userId]) ? store[userId] : [];
  items.unshift(note);
  store[userId] = items;
  await writeStore(store);
  return note;
}

export async function updateUserNote(
  userId: string,
  id: string,
  patch: { title?: unknown; content?: unknown; color?: unknown },
) {
  const store = await readStore();
  const items = Array.isArray(store[userId]) ? store[userId] : [];
  const index = items.findIndex((note) => note.id === id);
  if (index === -1) return null;

  const current = items[index];
  const title = sanitizeText(patch.title, 120) || current.title;
  const content =
    typeof patch.content === "string" ? sanitizeText(patch.content, 4000) : current.content;
  const color = normalizeColor(patch.color ?? current.color);

  const updated: UserNote = {
    ...current,
    title,
    content,
    color,
    updatedAt: new Date().toISOString(),
  };
  items[index] = updated;
  store[userId] = items;
  await writeStore(store);
  return updated;
}

export async function deleteUserNote(userId: string, id: string) {
  const store = await readStore();
  const items = Array.isArray(store[userId]) ? store[userId] : [];
  const next = items.filter((note) => note.id !== id);
  if (next.length === items.length) return false;
  store[userId] = next;
  await writeStore(store);
  return true;
}
