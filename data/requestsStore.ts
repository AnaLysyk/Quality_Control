import "server-only";

import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";
import { getRedis, isRedisConfigured } from "@/lib/redis";
import { getJsonStorePath } from "./jsonStorePath";

const USE_POSTGRES = shouldUsePostgresPersistence();
async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

export type RequestUser = {
  id: string;
  name?: string;
  email?: string;
  companyId?: string;
  companyName?: string;
};

export type RequestType = "EMAIL_CHANGE" | "COMPANY_CHANGE" | "PASSWORD_RESET" | "PROFILE_DELETION";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVISION";
export type RequestSort = "createdAt_desc" | "createdAt_asc";

export type RequestRecord = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  companyId: string;
  companyName: string;
  type: RequestType;
  payload: Record<string, unknown>;
  status: RequestStatus;
  createdAt: string;
  reviewedBy?: string;
  reviewNote?: string;
  reviewedAt?: string;
};

type StorePayload = { items: RequestRecord[] };

const STORE_PATH = getJsonStorePath("requests-store.json");
const STORE_KEY = "qc:requests_store:v1";
const USE_REDIS = isRedisConfigured();
let warnedRedisFailure = false;
const DEFAULT_ITEMS: RequestRecord[] = [
  {
    id: "req_sample_email",
    userId: "usr_001",
    userName: "Usuario",
    userEmail: "user@example.com",
    companyId: "cmp_001",
    companyName: "Testing Company",
    type: "EMAIL_CHANGE",
    payload: { newEmail: "novo.email@example.com" },
    status: "PENDING",
    createdAt: new Date().toISOString(),
  },
];

async function ensureFileStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    const initial: StorePayload = { items: DEFAULT_ITEMS };
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
    if (!raw) return { items: DEFAULT_ITEMS };
    const parsed = JSON.parse(raw) as StorePayload;
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return { items };
  } catch (err) {
    if (!warnedRedisFailure) {
      warnedRedisFailure = true;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[requestsStore] Redis read failed, fallback file:", msg);
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
      console.warn("[requestsStore] Redis write failed, fallback file:", msg);
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

async function loadItems() {
  const store = await readStore();
  return store.items;
}

async function persist(next: RequestRecord[]) {
  await writeStore({ items: next });
}

function pgRowToRecord(r: { id: string; userId: string; userName: string; userEmail: string; companyId: string; companyName: string; type: string; payload: unknown; status: string; createdAt: Date; reviewedBy?: string | null; reviewNote?: string | null; reviewedAt?: Date | null }): RequestRecord {
  return { id: r.id, userId: r.userId, userName: r.userName, userEmail: r.userEmail, companyId: r.companyId, companyName: r.companyName, type: r.type as RequestType, payload: (r.payload ?? {}) as Record<string, unknown>, status: r.status as RequestStatus, createdAt: r.createdAt.toISOString(), reviewedBy: r.reviewedBy ?? undefined, reviewNote: r.reviewNote ?? undefined, reviewedAt: r.reviewedAt?.toISOString() ?? undefined };
}

export async function listUserRequests(
  userId: string,
  filters?: { status?: RequestStatus; type?: RequestType; sort?: RequestSort },
) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.request.findMany({
      where: {
        userId,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.type ? { type: filters.type } : {}),
      },
      orderBy: { createdAt: filters?.sort === "createdAt_asc" ? "asc" : "desc" },
    });
    return rows.map(pgRowToRecord);
  }
  const items = await loadItems();
  const results = items.filter(
    (req) =>
      req.userId === userId &&
      (!filters?.status || req.status === filters.status) &&
      (!filters?.type || req.type === filters.type),
  );
  if (filters?.sort === "createdAt_asc") {
    results.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } else {
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return results;
}

export async function listAllRequests(filters?: {
  status?: RequestStatus;
  type?: RequestType;
  companyId?: string;
  sort?: RequestSort;
}) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.request.findMany({
      where: { ...(filters?.status ? { status: filters.status } : {}), ...(filters?.type ? { type: filters.type } : {}), ...(filters?.companyId ? { companyId: filters.companyId } : {}) },
      orderBy: { createdAt: filters?.sort === "createdAt_asc" ? "asc" : "desc" },
    });
    return rows.map(pgRowToRecord);
  }
  const items = await loadItems();
  let results = [...items];
  if (filters?.status) results = results.filter((r) => r.status === filters.status);
  if (filters?.type) results = results.filter((r) => r.type === filters.type);
  if (filters?.companyId) results = results.filter((r) => r.companyId === filters.companyId);
  if (filters?.sort === "createdAt_asc") {
    results.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } else {
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return results;
}

export async function getRequestById(id: string) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const r = await prisma.request.findUnique({ where: { id } });
    return r ? pgRowToRecord(r) : null;
  }
  const items = await loadItems();
  return items.find((req) => req.id === id) ?? null;
}

export async function addRequest(user: RequestUser, type: RequestType, payload: Record<string, unknown>) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const duplicate = await prisma.request.findFirst({ where: { userId: user.id, type, status: "PENDING" } });
    if (duplicate) {
      const err = new Error("Duplicated pending request") as Error & { code?: string };
      err.code = "DUPLICATE";
      throw err;
    }
    const r = await prisma.request.create({
      data: { userId: user.id, userName: user.name ?? user.email ?? "Usuario", userEmail: user.email ?? "", companyId: user.companyId ?? "", companyName: user.companyName ?? "", type, payload: JSON.parse(JSON.stringify(payload)), status: "PENDING" },
    });
    return pgRowToRecord(r);
  }
  const items = await loadItems();
  const duplicate = items.find((r) => r.userId === user.id && r.type === type && r.status === "PENDING");
  if (duplicate) {
    const err = new Error("Duplicated pending request") as Error & { code?: string };
    err.code = "DUPLICATE";
    throw err;
  }

  const safeEmail = user.email ?? "";
  const safeName = user.name ?? safeEmail ?? "Usuario";
  const safeCompanyId = user.companyId ?? "";
  const safeCompanyName = user.companyName ?? "";

  const record: RequestRecord = {
    id: randomUUID(),
    userId: user.id,
    userName: safeName,
    userEmail: safeEmail,
    companyId: safeCompanyId,
    companyName: safeCompanyName,
    type,
    payload,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  const next = [...items, record];
  await persist(next);
  return record;
}

export async function updateRequestStatus(
  id: string,
  status: Exclude<RequestStatus, "PENDING">,
  reviewer: { id: string },
  reviewNote?: string,
) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const current = await prisma.request.findUnique({ where: { id } });
    if (!current || (current.status !== "PENDING" && current.status !== "NEEDS_REVISION")) return current ? pgRowToRecord(current) : null;
    const r = await prisma.request.update({ where: { id }, data: { status, reviewedBy: reviewer.id, reviewNote: reviewNote ?? null, reviewedAt: new Date() } });
    return pgRowToRecord(r);
  }
  const items = await loadItems();
  const idx = items.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const req = items[idx];
  if (req.status !== "PENDING" && req.status !== "NEEDS_REVISION") return req;
  const updated: RequestRecord = {
    ...req,
    status,
    reviewedBy: reviewer.id,
    reviewNote,
    reviewedAt: new Date().toISOString(),
  };
  const next = [...items];
  next[idx] = updated;
  await persist(next);
  return updated;
}

export async function resubmitRequest(id: string, payload: Record<string, unknown>) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const current = await prisma.request.findUnique({ where: { id } });
    if (!current || current.status !== "NEEDS_REVISION") return current ? pgRowToRecord(current) : null;
    const merged = { ...((current.payload ?? {}) as Record<string, unknown>), ...payload };
    const r = await prisma.request.update({
      where: { id },
      data: { status: "PENDING", payload: JSON.parse(JSON.stringify(merged)), reviewedBy: null, reviewNote: null, reviewedAt: null },
    });
    return pgRowToRecord(r);
  }
  const items = await loadItems();
  const idx = items.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const req = items[idx];
  if (req.status !== "NEEDS_REVISION") return req;
  const updated: RequestRecord = {
    ...req,
    status: "PENDING",
    payload: { ...req.payload, ...payload },
    reviewedBy: undefined,
    reviewNote: undefined,
    reviewedAt: undefined,
  };
  const next = [...items];
  next[idx] = updated;
  await persist(next);
  return updated;
}
