import "server-only";

import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs/promises";

export type SupportRequestStatus = "open" | "in_progress" | "closed" | "rejected";

export type SupportRequestRecord = {
  id: string;
  email: string;
  message: string;
  status: SupportRequestStatus;
  created_at: string;
  updated_at?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  user_id?: string | null;
};

type StoreShape = {
  items: SupportRequestRecord[];
};

const STORE_PATH = path.join(process.cwd(), "data", "support-requests.json");

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    const initial: StoreShape = { items: [] };
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<StoreShape> {
  await ensureStore();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreShape> | null;
    const items = Array.isArray(parsed?.items) ? (parsed?.items as SupportRequestRecord[]) : [];
    return { items };
  } catch {
    return { items: [] };
  }
}

async function writeStore(next: StoreShape) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
}

export function extractAdminNotes(message: string): string | null {
  const line = message.split("\n").find((l) => l.startsWith("ADMIN_NOTES:"));
  if (!line) return null;
  const notes = line.slice("ADMIN_NOTES:".length).trim();
  return notes || null;
}

export async function listSupportRequests() {
  const store = await readStore();
  return [...store.items].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getSupportRequestById(id: string) {
  const store = await readStore();
  return store.items.find((item) => item.id === id) ?? null;
}

export async function createSupportRequest(input: {
  email: string;
  message: string;
  status?: SupportRequestStatus;
  ip_address?: string | null;
  user_agent?: string | null;
  user_id?: string | null;
}) {
  const now = new Date().toISOString();
  const record: SupportRequestRecord = {
    id: randomUUID(),
    email: input.email.trim().toLowerCase(),
    message: input.message,
    status: input.status ?? "open",
    created_at: now,
    updated_at: now,
    ip_address: input.ip_address ?? null,
    user_agent: input.user_agent ?? null,
    user_id: input.user_id ?? null,
  };

  const store = await readStore();
  store.items.push(record);
  await writeStore(store);
  return record;
}

export async function updateSupportRequest(
  id: string,
  patch: Partial<Pick<SupportRequestRecord, "email" | "message" | "status">>,
) {
  const store = await readStore();
  const idx = store.items.findIndex((item) => item.id === id);
  if (idx === -1) return null;

  const current = store.items[idx];
  const next: SupportRequestRecord = {
    ...current,
    ...(typeof patch.email === "string" ? { email: patch.email.trim().toLowerCase() } : {}),
    ...(typeof patch.message === "string" ? { message: patch.message } : {}),
    ...(typeof patch.status === "string" ? { status: patch.status as SupportRequestStatus } : {}),
    updated_at: new Date().toISOString(),
  };
  store.items[idx] = next;
  await writeStore(store);
  return next;
}

