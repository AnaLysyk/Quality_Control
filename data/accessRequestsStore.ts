import "server-only";

import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getRedis, isRedisConfigured } from "@/lib/redis";
import { getJsonStorePath } from "./jsonStorePath";

const USE_POSTGRES = process.env.AUTH_STORE === "postgres";
async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

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

const STORE_PATH = getJsonStorePath("access-requests.json");
const STORE_KEY = "qc:access_requests:v1";
const USE_REDIS = isRedisConfigured();
let warnedRedisFailure = false;

async function ensureFileStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    const initial: StorePayload = { items: [] };
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readFileStore(): Promise<StorePayload> {
  await ensureFileStore();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as StorePayload;
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return { items };
  } catch {
    return { items: [] };
  }
}

async function writeFileStore(next: StorePayload) {
  await ensureFileStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
}

async function readRedisStore(): Promise<StorePayload | null> {
  try {
    const redis = getRedis();
    const raw = await redis.get<string>(STORE_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw) as StorePayload;
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return { items };
  } catch (err) {
    if (!warnedRedisFailure) {
      warnedRedisFailure = true;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[accessRequestsStore] Redis read failed, fallback file:", msg);
    }
    return null;
  }
}

async function writeRedisStore(next: StorePayload): Promise<boolean> {
  try {
    const redis = getRedis();
    await redis.set(STORE_KEY, JSON.stringify(next));
    return true;
  } catch (err) {
    if (!warnedRedisFailure) {
      warnedRedisFailure = true;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[accessRequestsStore] Redis write failed, fallback file:", msg);
    }
    return false;
  }
}

async function readStore(): Promise<StorePayload> {
  if (USE_REDIS) {
    const redisStore = await readRedisStore();
    if (redisStore) return redisStore;
  }
  return readFileStore();
}

async function writeStore(next: StorePayload) {
  if (USE_REDIS) {
    const ok = await writeRedisStore(next);
    if (ok) return;
  }
  await writeFileStore(next);
}

export async function listAccessRequests() {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.accessRequest.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((r) => ({ id: r.id, email: r.email, message: r.description ?? r.notes ?? "", status: r.status as AccessRequestStatus, created_at: r.createdAt.toISOString(), updated_at: r.updatedAt.toISOString(), user_id: r.userId ?? null, ip_address: r.ip_address ?? null, user_agent: r.user_agent ?? null }));
  }
  const store = await readStore();
  return [...store.items].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getAccessRequestById(id: string) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const r = await prisma.accessRequest.findUnique({ where: { id } });
    if (!r) return null;
    return { id: r.id, email: r.email, message: r.description ?? r.notes ?? "", status: r.status as AccessRequestStatus, created_at: r.createdAt.toISOString(), updated_at: r.updatedAt.toISOString(), user_id: r.userId ?? null, ip_address: r.ip_address ?? null, user_agent: r.user_agent ?? null };
  }
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
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const r = await prisma.accessRequest.create({
      data: { email: input.email, description: input.message, status: input.status ?? "open", userId: input.user_id ?? null, ip_address: input.ip_address ?? null, user_agent: input.user_agent ?? null },
    });
    return { id: r.id, email: r.email, message: r.description ?? "", status: r.status as AccessRequestStatus, created_at: r.createdAt.toISOString(), updated_at: r.updatedAt.toISOString(), user_id: r.userId ?? null, ip_address: r.ip_address ?? null, user_agent: r.user_agent ?? null };
  }
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
  patch: Partial<Pick<AccessRequestRecord, "email" | "message" | "status" | "user_id">>,
) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const r = await prisma.accessRequest.update({
      where: { id },
      data: {
        ...(patch.email ? { email: patch.email } : {}),
        ...(patch.message ? { description: patch.message } : {}),
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.user_id !== undefined ? { userId: patch.user_id ?? null } : {}),
      },
    });
    return { id: r.id, email: r.email, message: r.description ?? "", status: r.status as AccessRequestStatus, created_at: r.createdAt.toISOString(), updated_at: r.updatedAt.toISOString(), user_id: r.userId ?? null, ip_address: r.ip_address ?? null, user_agent: r.user_agent ?? null };
  }
  const store = await readStore();
  const index = store.items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const current = store.items[index];
  const updated: AccessRequestRecord = {
    ...current,
    email: typeof patch.email === "string" ? patch.email : current.email,
    message: typeof patch.message === "string" ? patch.message : current.message,
    status: (patch.status as AccessRequestStatus) ?? current.status,
    user_id: patch.user_id !== undefined ? (patch.user_id as string | null) : current.user_id,
    updated_at: new Date().toISOString(),
  };
  store.items[index] = updated;
  await writeStore(store);
  return updated;
}
