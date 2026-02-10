import "server-only";

import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type AccessRequestStatus = "open" | "closed" | "rejected" | "in_progress";

export type AccessRequestRecord = {
  id: string;
  email: string;
  message: string;
  status: AccessRequestStatus;
  created_at: string;
  updated_at?: string | null;
  user_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
};

type StorePayload = { items: AccessRequestRecord[] };

const STORE_PATH = path.join(process.cwd(), "data", "access-requests.json");

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    const initial: StorePayload = { items: [] };
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<StorePayload> {
  await ensureStore();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as StorePayload;
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return { items };
  } catch {
    return { items: [] };
  }
}

async function writeStore(next: StorePayload) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
}

export async function listAccessRequests() {
  const store = await readStore();
  return [...store.items].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getAccessRequestById(id: string) {
  const store = await readStore();
  return store.items.find((item) => item.id === id) ?? null;
}

export async function createAccessRequest(input: {
  email: string;
  message: string;
  status?: AccessRequestStatus;
  user_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
}) {
  const now = new Date().toISOString();
  const record: AccessRequestRecord = {
    id: randomUUID(),
    email: input.email,
    message: input.message,
    status: input.status ?? "open",
    created_at: now,
    updated_at: now,
    user_id: input.user_id ?? null,
    ip_address: input.ip_address ?? null,
    user_agent: input.user_agent ?? null,
  };
  const store = await readStore();
  store.items.unshift(record);
  await writeStore(store);
  return record;
}

export async function updateAccessRequest(
  id: string,
  patch: Partial<Pick<AccessRequestRecord, "email" | "message" | "status">>,
) {
  const store = await readStore();
  const index = store.items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const current = store.items[index];
  const updated: AccessRequestRecord = {
    ...current,
    email: typeof patch.email === "string" ? patch.email : current.email,
    message: typeof patch.message === "string" ? patch.message : current.message,
    status: (patch.status as AccessRequestStatus) ?? current.status,
    updated_at: new Date().toISOString(),
  };
  store.items[index] = updated;
  await writeStore(store);
  return updated;
}

