import "server-only";

import { randomUUID } from "crypto";
import { createNotificationEvent, type NotificationEventSourceType } from "@/lib/notificationEventsStore";
import { buildNotificationOperationalMetadata } from "@/lib/notificationOperationalMetadata";
import { shouldUsePostgresPersistence } from "@/database/persistenceMode";
import { getRedis, isRedisConfigured } from "@/lib/redis";

const USE_POSTGRES = shouldUsePostgresPersistence();
async function getPrisma() {
  const { prisma } = await import("@/database/prismaClient");
  return prisma;
}

export type NotificationStatus = "unread" | "closed";
export type NotificationType =
  | "RUN_CREATED"
  | "TEST_FAILED"
  | "ACCESS_REQUEST_CREATED"
  | "ACCESS_REQUEST_ACCEPTED"
  | "ACCESS_REQUEST_REJECTED"
  | "ACCESS_REQUEST_ADJUSTMENT_REQUESTED"
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
  | "DOC_PUBLISHED"
  | "USER_ACCESS_UPDATED"
  | "USER_ACCESS_RESTORED"
  | "RELATIONSHIP_ASSIGNED"
  | "RELATIONSHIP_REMOVED";

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

type NotificationInput = {
  type: NotificationType;
  title: string;
  description?: string | null;
  status?: NotificationStatus;
  link?: string | null;
  companySlug?: string | null;
  companyName?: string | null;
  projectSlug?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  requestId?: string | null;
  ticketId?: string | null;
  dedupeKey?: string | null;
  sourceType?: NotificationEventSourceType;
  sourceId?: string | null;
  payload?: Record<string, unknown>;
};

type NotificationsStore = Record<string, UserNotification[]>;

const STORE_KEY = "qc:user_notifications:v1";
const USE_REDIS =
  process.env.NOTIFICATIONS_STORE === "redis" || isRedisConfigured();
const USE_MEMORY = process.env.NOTIFICATIONS_IN_MEMORY === "true";
let memoryStore: NotificationsStore = {};

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
  return memoryStore;
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
  memoryStore = next;
}

function sanitizeText(value: unknown, max: number, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed.slice(0, max) : fallback;
}

function notificationWorkflowId(type: NotificationType) {
  if (type === "RUN_CREATED") return "run-created";
  if (type === "TEST_FAILED") return "test-failed";
  if (type === "DEFECT_ASSIGNED") return "defect-assigned";
  if (type === "DEFECT_STATUS_CHANGED" || type === "DEFECT_COMMENT_ADDED") return "defect-updated";
  if (type === "TICKET_CREATED") return "ticket-created";
  if (type === "TICKET_COMMENT_ADDED") return "ticket-comment";
  if (type === "TICKET_STATUS_CHANGED" || type === "TICKET_REACTION_ADDED" || type === "TICKET_ASSIGNED") return "ticket-updated";
  if (type === "DOC_PUBLISHED") return "doc-published";
  if (type === "ACCESS_REQUEST_CREATED") return "access-request-created";
  if (type === "ACCESS_REQUEST_COMMENT" || type === "ACCESS_REQUEST_ADJUSTMENT_REQUESTED") return "access-request-updated";
  if (type === "ACCESS_REQUEST_ACCEPTED" || type === "ACCESS_REQUEST_REJECTED") return "access-request-decision";
  if (type === "USER_ACCESS_UPDATED" || type === "USER_ACCESS_RESTORED") return "access-updated";
  if (type === "RELATIONSHIP_ASSIGNED" || type === "RELATIONSHIP_REMOVED") return "relationship-updated";
  if (type.startsWith("PASSWORD_RESET")) return "password-reset";
  if (type === "PROFILE_DELETION_REQUEST" || type === "PROFILE_DELETION_PENDING") return "profile-deletion-request";
  if (type === "PROFILE_DELETION_APPROVED" || type === "PROFILE_DELETION_REJECTED") return "profile-deletion-decision";
  return type;
}

function defaultSourceType(type: NotificationType): NotificationEventSourceType {
  if (type === "RUN_CREATED" || type === "TEST_FAILED" || type.startsWith("DEFECT_")) return "qa_operation";
  if (type.startsWith("TICKET_")) return "qa_operation";
  return "manual";
}

function notificationSourceId(input: NotificationInput) {
  return input.sourceId ?? input.requestId ?? input.ticketId ?? input.dedupeKey ?? null;
}

function notificationPayload(input: NotificationInput) {
  const operationalMetadata = buildNotificationOperationalMetadata({
    type: input.type,
    title: input.title,
    description: input.description ?? null,
    link: input.link ?? null,
    companySlug: input.companySlug ?? null,
    projectSlug: input.projectSlug ?? null,
    requestId: input.requestId ?? null,
    ticketId: input.ticketId ?? null,
    dedupeKey: input.dedupeKey ?? null,
    sourceId: input.sourceId ?? null,
  });

  return {
    ...(input.payload ?? {}),
    ...operationalMetadata,
    notificationType: input.type,
    link: input.link ?? null,
    requestId: input.requestId ?? null,
    ticketId: input.ticketId ?? null,
    dedupeKey: input.dedupeKey ?? null,
    companySlug: input.companySlug ?? null,
    projectSlug: input.projectSlug ?? null,
  };
}

async function shouldDeliverInAppNotification(userId: string, input: NotificationInput) {
  const result = await createNotificationEvent({
    workflowId: notificationWorkflowId(input.type),
    title: input.title,
    description: input.description ?? "",
    companySlug: input.companySlug ?? null,
    companyName: input.companyName ?? null,
    projectSlug: input.projectSlug ?? null,
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? null,
    sourceType: input.sourceType ?? defaultSourceType(input.type),
    sourceId: notificationSourceId(input),
    payload: notificationPayload(input),
    recipients: [
      {
        recipientId: userId,
        recipientName: null,
        profileKind: null,
        channels: ["in_app"],
      },
      {
        recipientId: "brain",
        recipientName: "Brain",
        profileKind: "brain",
        channels: ["brain"],
      },
    ],
  });

  const delivery = result.deliveries.find((item) => item.recipientId === userId && item.channel === "in_app");
  return delivery?.status !== "suppressed";
}

function appendNotification(
  store: NotificationsStore,
  userId: string,
  input: NotificationInput,
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
  input: NotificationInput,
) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    if (input.dedupeKey) {
      const existing = await prisma.userNotification.findFirst({ where: { userId, dedupeKey: input.dedupeKey } });
      if (existing) return pgToRecord(existing);
    }
    const shouldDeliver = await shouldDeliverInAppNotification(userId, input);
    if (!shouldDeliver) return null;
    const r = await prisma.userNotification.create({ data: { userId, type: input.type, title: sanitizeText(input.title, 120, "Notificacao"), description: sanitizeText(input.description ?? "", 400), status: input.status ?? "unread", link: input.link ?? null, companySlug: input.companySlug ?? null, requestId: input.requestId ?? null, ticketId: input.ticketId ?? null, dedupeKey: input.dedupeKey ?? null } });
    return pgToRecord(r);
  }

  const store = await readStore();
  const items = Array.isArray(store[userId]) ? store[userId] : [];
  if (input.dedupeKey) {
    const existing = items.find((item) => item.dedupeKey === input.dedupeKey);
    if (existing) return existing;
  }

  const shouldDeliver = await shouldDeliverInAppNotification(userId, input);
  if (!shouldDeliver) return null;

  const { item, created } = appendNotification(store, userId, input);
  if (created) {
    await writeStore(store);
  }
  return item;
}

export async function createNotificationsForUsers(
  userIds: string[],
  input: NotificationInput,
) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const created: UserNotification[] = [];
  for (const userId of unique) {
    const notification = await createUserNotification(userId, input);
    if (notification) created.push(notification);
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
    await prisma.userNotification.updateMany({ where: { userId, dedupeKey }, data: { status: "closed" } });
    return;
  }
  const store = await readStore();
  const items = Array.isArray(store[userId]) ? store[userId] : [];
  let changed = false;
  store[userId] = items.map((item) => {
    if (item.dedupeKey === dedupeKey && item.status !== "closed") {
      changed = true;
      return { ...item, status: "closed", updatedAt: new Date().toISOString() };
    }
    return item;
  });
  if (changed) await writeStore(store);
}


export async function closeAllNotifications(userId: string) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const result = await prisma.userNotification.updateMany({
      where: { userId, status: { not: "closed" } },
      data: { status: "closed" },
    });
    return result.count;
  }

  const store = await readStore();
  const items = Array.isArray(store[userId]) ? store[userId] : [];
  const now = new Date().toISOString();
  let changed = 0;

  store[userId] = items.map((item) => {
    if (item.status === "closed") return item;
    changed += 1;
    return { ...item, status: "closed", updatedAt: now };
  });

  if (changed) await writeStore(store);
  return changed;
}

export async function closeNotificationsByTicketId(userId: string, ticketId: string) {
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const result = await prisma.userNotification.updateMany({
      where: { userId, ticketId, status: { not: "closed" } },
      data: { status: "closed" },
    });
    return result.count;
  }

  const store = await readStore();
  const items = Array.isArray(store[userId]) ? store[userId] : [];
  const now = new Date().toISOString();
  let changed = 0;

  store[userId] = items.map((item) => {
    if (item.ticketId !== ticketId || item.status === "closed") return item;
    changed += 1;
    return { ...item, status: "closed", updatedAt: now };
  });

  if (changed) await writeStore(store);
  return changed;
}

