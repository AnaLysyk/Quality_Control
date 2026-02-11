import "server-only";

import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { getRedis, isRedisConfigured } from "@/lib/redis";

export type NotificationStatus = "unread" | "closed";
export type NotificationType =
  | "RUN_CREATED"
  | "TEST_FAILED"
  | "ACCESS_REQUEST_COMMENT"
  | "PASSWORD_RESET_REQUEST"
  | "PASSWORD_RESET_PENDING"
  | "PASSWORD_RESET_APPROVED"
  | "PASSWORD_RESET_REJECTED"
  | "TICKET_CREATED"
  | "TICKET_STATUS_CHANGED"
  | "TICKET_COMMENT_ADDED"
  | "TICKET_REACTION_ADDED"
  | "TICKET_ASSIGNED";

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
const USE_MEMORY =
  process.env.NOTIFICATIONS_IN_MEMORY === "true" ||
  (!USE_REDIS && process.env.VERCEL === "1");
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

export async function listUserNotifications(userId: string) {
  const store = await readStore();
  const items = Array.isArray(store[userId]) ? store[userId] : [];
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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
  const store = await readStore();
  const created: UserNotification[] = [];
  const unique = Array.from(new Set(userIds.filter(Boolean)));
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
