import "server-only";

import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";
import { getRedis, isRedisConfigured } from "@/lib/redis";

const USE_POSTGRES = shouldUsePostgresPersistence();
async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

export type NotificationStatus = "unread" | "closed";
export type NotificationType =
  | "RUN_CREATED"
  | "TEST_FAILED"
  | "ACCESS_REQUEST_CREATED"
  | "ACCESS_REQUEST_ACCEPTED"
  | "ACCESS_REQUEST_REJECTED"
  | "ACCESS_REQUEST_COMMENT"
  | "PASSWORD_RESET_REQUEST"
  | "PASSWORD_RESET_PENDING"
  | "PASSWORD_RESET_APPROVED"
  | "PASSWORD_RESET_REJECTED"
  | "PROFILE_DELETION_REQUEST"
  | "PROFILE_DELETION_PENDING"
  | "PROFILE_DELETION_APPROVED"
  | "PROFILE_DELETION_REJECTED"
  | "TICKET_CREATED"
  | "TICKET_STATUS_CHANGED"
  | "TICKET_COMMENT_ADDED"
  | "TICKET_REACTION_ADDED"
  | "TICKET_ASSIGNED"
  | "DEFECT_STATUS_CHANGED"
  | "DEFECT_COMMENT_ADDED"
  | "DEFECT_ASSIGNED"
  | "USER_ACCESS_UPDATED"
  | "USER_ACCESS_RESTORED";

export type UserNotification = {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  status: NotificationStatus;
  createdAt: string;
  updatedAt: string;
  link?: string | null;
  companySlug?: string | null;
  requestId?: string | null;
  ticketId?: string | null;
  dedupeKey?: string | null;
};

type NotificationsStore = Record<string, UserNotification[]>;

const STORE_PATH = path.join(process.cwd(), "data", "user-notifications.json");
const STORE_KEY = "qc:user_notifications:v1";
const USE_REDIS =
  process.env.NOTIFICATIONS_STORE === "redis" || isRedisConfigured();
const USE_MEMORY = process.env.NOTIFICATIONS_IN_MEMORY === "true";
let memoryStore: NotificationsStore = {};
let warnedFsFailure = false;

async function ensureStore(): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.access(STORE_PATH);
    return true;
  } catch {
    try {
      await fs.writeFile(STORE_PATH, JSON.stringify({}), "utf8");
      return true;
    } catch {
      if (!warnedFsFailure) {
        warnedFsFailure = true;
        console.warn("[NOTIFICATIONS] Falha ao acessar filesystem; usando fallback em memoria.");
      }
      return false;
    }
  }
}

async function readStore(): Promise<NotificationsStore> {
  if (USE_REDIS) {
    const redis = getRedis();
    const raw = await redis.get<string>(STORE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as NotificationsStore) : {};
    } catch {
      return {};
    }
  }
  if (USE_MEMORY) {
    return memoryStore;
  }
  const ok = await ensureStore();
  if (!ok) return memoryStore;
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as NotificationsStore) : {};
  } catch {
    return memoryStore;
  }
}

async function writeStore(next: NotificationsStore) {
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

function sanitizeText(value: unknown, max: number, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed.slice(0, max) : fallback;
}

function appendNotification(
  store: NotificationsStore,
  userId: string,
  input: {
    type: NotificationType;
    title: string;
    description?: string | null;
    status?: NotificationStatus;
    link?: string | null;
    companySlug?: string | null;
    requestId?: string | null;
    ticketId?: string | null;
    dedupeKey?: string | null;
  },
) {
  const items = Array.isArray(store[userId]) ? store[userId] : [];
  if (input.dedupeKey) {
    const existing = items.find((item) => item.dedupeKey === input.dedupeKey);
    if (existing) return { item: existing, created: false };
  }

  const now = new Date().toISOString();
  const notification: UserNotification = {
    id: randomUUID(),
    type: input.type,
    title: sanitizeText(input.title, 120, "Notificacao"),
    description: sanitizeText(input.description ?? "", 400),
    status: input.status ?? "unread",
    createdAt: now,
    updatedAt: now,
    link: input.link ?? null,
    companySlug: input.companySlug ?? null,
    requestId: input.requestId ?? null,
    ticketId: input.ticketId ?? null,
    dedupeKey: input.dedupeKey ?? null,
  };

  items.unshift(notification);
  store[userId] = items;
  return { item: notification, created: true };
}

function pgToRecord(r: { id: string; type: string; title: string; description: string; status: string; link?: string | null; companySlug?: string | null; requestId?: string | null; ticketId?: string | null; dedupeKey?: string | null; createdAt: Date; updatedAt: Date }): UserNotification {
  return { id: r.id, type: r.type as NotificationType, title: r.title, description: r.description, status: r.status as NotificationStatus, link: r.link ?? null, companySlug: r.companySlug ?? null, requestId: r.requestId ?? null, ticketId: r.ticketId ?? null, dedupeKey: r.dedupeKey ?? null, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
}

export async function listUserNotifications(userId: string) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.userNotification.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return rows.map(pgToRecord);
  }
  const store = await readStore();
  const items = Array.isArray(store[userId]) ? store[userId] : [];
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function countUnreadUserNotifications(userId: string) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    return prisma.userNotification.count({
      where: { userId, status: { not: "closed" } },
    });
  }
  const store = await readStore();
  const items = Array.isArray(store[userId]) ? store[userId] : [];
  return items.filter((item) => item.status !== "closed").length;
}

export async function createUserNotification(
  userId: string,
  input: {
    type: NotificationType;
    title: string;
    description?: string | null;
    status?: NotificationStatus;
    link?: string | null;
    companySlug?: string | null;
    requestId?: string | null;
    ticketId?: string | null;
    dedupeKey?: string | null;
  },
) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    if (input.dedupeKey) {
      const existing = await prisma.userNotification.findFirst({ where: { userId, dedupeKey: input.dedupeKey } });
      if (existing) return pgToRecord(existing);
    }
    const r = await prisma.userNotification.create({ data: { userId, type: input.type, title: sanitizeText(input.title, 120, "Notificacao"), description: sanitizeText(input.description ?? "", 400), status: input.status ?? "unread", link: input.link ?? null, companySlug: input.companySlug ?? null, requestId: input.requestId ?? null, ticketId: input.ticketId ?? null, dedupeKey: input.dedupeKey ?? null } });
    return pgToRecord(r);
  }
  const store = await readStore();
  const { item, created } = appendNotification(store, userId, input);
  if (created) {
    await writeStore(store);
  }
  return item;
}

export async function createNotificationsForUsers(
  userIds: string[],
  input: {
    type: NotificationType;
    title: string;
    description?: string | null;
    status?: NotificationStatus;
    link?: string | null;
    companySlug?: string | null;
    requestId?: string | null;
    ticketId?: string | null;
    dedupeKey?: string | null;
  },
) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (USE_POSTGRES) {
    const created: UserNotification[] = [];
    for (const userId of unique) {
      const n = await createUserNotification(userId, input);
      created.push(n);
    }
    return created;
  }
  const store = await readStore();
  const created: UserNotification[] = [];
  for (const userId of unique) {
    const { item, created: wasCreated } = appendNotification(store, userId, input);
    if (wasCreated) created.push(item);
  }
  if (created.length) {
    await writeStore(store);
  }
  return created;
}

export async function updateNotificationStatus(
  userId: string,
  id: string,
  status: NotificationStatus,
) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const r = await prisma.userNotification.update({ where: { id }, data: { status } });
    return pgToRecord(r);
  }
  const store = await readStore();
  const items = Array.isArray(store[userId]) ? store[userId] : [];
  const idx = items.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  const current = items[idx];
  const next: UserNotification = {
    ...current,
    status,
    updatedAt: new Date().toISOString(),
  };
  items[idx] = next;
  store[userId] = items;
  await writeStore(store);
  return next;
}

export async function closeNotificationsByDedupeKey(userId: string, dedupeKey: string) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const result = await prisma.userNotification.updateMany({ where: { userId, dedupeKey, status: "unread" }, data: { status: "closed" } });
    return result.count > 0;
  }
  const store = await readStore();
  const items = (Array.isArray(store[userId]) ? store[userId] : []) as UserNotification[];
  let changed = false;
  const nextItems = items.map<UserNotification>((item) => {
    if (item.dedupeKey === dedupeKey && item.status !== "closed") {
      changed = true;
      return { ...item, status: "closed", updatedAt: new Date().toISOString() };
    }
    return item;
  });
  if (changed) {
    const nextStore: NotificationsStore = { ...store, [userId]: nextItems };
    await writeStore(nextStore);
  }
  return changed;
}

export async function closeNotificationsByTicketId(userId: string, ticketId: string) {
  if (!ticketId) return false;
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const result = await prisma.userNotification.updateMany({ where: { userId, ticketId, status: "unread" }, data: { status: "closed" } });
    return result.count > 0;
  }
  const store = await readStore();
  const items = (Array.isArray(store[userId]) ? store[userId] : []) as UserNotification[];
  let changed = false;
  const nextItems = items.map<UserNotification>((item) => {
    if (item.ticketId === ticketId && item.status !== "closed") {
      changed = true;
      return { ...item, status: "closed", updatedAt: new Date().toISOString() };
    }
    return item;
  });
  if (changed) {
    const nextStore: NotificationsStore = { ...store, [userId]: nextItems };
    await writeStore(nextStore);
  }
  return changed;
}

export async function closeAllNotifications(userId: string) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const result = await prisma.userNotification.updateMany({ where: { userId, status: "unread" }, data: { status: "closed" } });
    return result.count > 0;
  }
  const store = await readStore();
  const items = (Array.isArray(store[userId]) ? store[userId] : []) as UserNotification[];
  let changed = false;
  const nextItems = items.map<UserNotification>((item) => {
    if (item.status !== "closed") {
      changed = true;
      return { ...item, status: "closed", updatedAt: new Date().toISOString() };
    }
    return item;
  });
  if (changed) {
    const nextStore: NotificationsStore = { ...store, [userId]: nextItems };
    await writeStore(nextStore);
  }
  return changed;
}
