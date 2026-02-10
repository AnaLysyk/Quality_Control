import "server-only";

import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type RequestUser = {
  id: string;
  name?: string;
  email?: string;
  companyId?: string;
  companyName?: string;
};

export type RequestType = "EMAIL_CHANGE" | "COMPANY_CHANGE" | "PASSWORD_RESET";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

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

const STORE_PATH = path.join(process.cwd(), "data", "requests-store.json");
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

let cache: RequestRecord[] | null = null;

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    const initial: StorePayload = { items: DEFAULT_ITEMS };
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

async function loadCache() {
  if (cache) return cache;
  const store = await readStore();
  cache = store.items;
  return cache;
}

async function persist(next: RequestRecord[]) {
  cache = next;
  await writeStore({ items: next });
}

export async function listUserRequests(userId: string, filters?: { status?: RequestStatus; type?: RequestType }) {
  const items = await loadCache();
  return items.filter(
    (req) =>
      req.userId === userId &&
      (!filters?.status || req.status === filters.status) &&
      (!filters?.type || req.type === filters.type),
  );
}

export async function listAllRequests(filters?: {
  status?: RequestStatus;
  type?: RequestType;
  companyId?: string;
  sort?: "createdAt_desc" | "createdAt_asc";
}) {
  const items = await loadCache();
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
  const items = await loadCache();
  return items.find((req) => req.id === id) ?? null;
}

export async function addRequest(user: RequestUser, type: RequestType, payload: Record<string, unknown>) {
  const items = await loadCache();
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
  const items = await loadCache();
  const idx = items.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const req = items[idx];
  if (req.status !== "PENDING") return req;
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
