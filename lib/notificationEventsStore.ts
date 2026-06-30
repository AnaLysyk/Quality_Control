import "server-only";

import { randomUUID } from "crypto";

import { getNotificationOperationModel, type NotificationChannel, type NotificationCriticality } from "@/data/notificationOperationModel";
import { getRedis } from "@/lib/redis";
import { resolveNotificationDeliveryDecision, type NotificationDeliveryDecision } from "@/lib/notificationPreferencesStore";

export type NotificationEventSourceType = "release_calendar" | "chat" | "qa_operation" | "manual";
export type NotificationDeliveryRecordStatus = "delivered" | "suppressed" | "failed";

export type NotificationEventRecord = {
  id: string;
  eventType: string;
  workflowId: string;
  title: string;
  description: string;
  category: string;
  criticality: NotificationCriticality;
  mandatory: boolean;
  companyId: string | null;
  companySlug: string | null;
  companyName: string | null;
  projectId: string | null;
  projectSlug: string | null;
  actorId: string | null;
  actorName: string | null;
  sourceType: NotificationEventSourceType;
  sourceId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type NotificationDeliveryRecord = {
  id: string;
  eventId: string;
  channel: NotificationChannel;
  recipientId: string;
  recipientName: string | null;
  profileKind: string | null;
  status: NotificationDeliveryRecordStatus;
  decision: NotificationDeliveryDecision;
  decisionReason: string;
  createdAt: string;
};

export type NotificationEventRecipient = {
  recipientId: string;
  recipientName?: string | null;
  profileKind?: string | null;
  channels?: NotificationChannel[];
};

type NotificationEventsStore = {
  events: NotificationEventRecord[];
  deliveries: NotificationDeliveryRecord[];
};

const STORE_KEY = "qc:notification_events:v1";
const MAX_EVENTS = 500;
const MAX_DELIVERIES = 1500;

function emptyStore(): NotificationEventsStore {
  return { events: [], deliveries: [] };
}

function sanitizeText(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function nullableText(value: unknown, max = 240) {
  const text = sanitizeText(value, max);
  return text || null;
}

function sanitizePayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function findWorkflow(workflowIdOrEventType: string) {
  const model = getNotificationOperationModel();
  return model.workflows.find((item) => item.id === workflowIdOrEventType || item.eventType === workflowIdOrEventType) ?? null;
}

function normalizeEvent(input: Partial<NotificationEventRecord> | null | undefined): NotificationEventRecord | null {
  const eventType = sanitizeText(input?.eventType, 120);
  const workflowId = sanitizeText(input?.workflowId, 120);
  const title = sanitizeText(input?.title, 160);
  if (!eventType || !workflowId || !title) return null;
  const criticality = sanitizeText(input?.criticality, 40);
  return {
    id: sanitizeText(input?.id, 120) || randomUUID(),
    eventType,
    workflowId,
    title,
    description: sanitizeText(input?.description, 800),
    category: sanitizeText(input?.category, 80) || "project",
    criticality: criticality === "critical" || criticality === "high" || criticality === "low" ? criticality : "normal",
    mandatory: Boolean(input?.mandatory),
    companyId: nullableText(input?.companyId),
    companySlug: nullableText(input?.companySlug),
    companyName: nullableText(input?.companyName),
    projectId: nullableText(input?.projectId),
    projectSlug: nullableText(input?.projectSlug),
    actorId: nullableText(input?.actorId),
    actorName: nullableText(input?.actorName),
    sourceType: input?.sourceType === "chat" || input?.sourceType === "qa_operation" || input?.sourceType === "manual" ? input.sourceType : "release_calendar",
    sourceId: nullableText(input?.sourceId),
    payload: sanitizePayload(input?.payload),
    createdAt: sanitizeText(input?.createdAt, 80) || new Date().toISOString(),
  };
}

function normalizeDelivery(input: Partial<NotificationDeliveryRecord> | null | undefined): NotificationDeliveryRecord | null {
  const eventId = sanitizeText(input?.eventId, 120);
  const channel = sanitizeText(input?.channel, 40) as NotificationChannel;
  const recipientId = sanitizeText(input?.recipientId, 120);
  if (!eventId || !["in_app", "email", "push", "chat", "brain"].includes(channel) || !recipientId) return null;
  const decision = sanitizeText(input?.decision, 80) as NotificationDeliveryDecision;
  return {
    id: sanitizeText(input?.id, 120) || randomUUID(),
    eventId,
    channel,
    recipientId,
    recipientName: nullableText(input?.recipientName),
    profileKind: nullableText(input?.profileKind),
    status: input?.status === "suppressed" || input?.status === "failed" ? input.status : "delivered",
    decision: decision || "delivered",
    decisionReason: sanitizeText(input?.decisionReason, 500),
    createdAt: sanitizeText(input?.createdAt, 80) || new Date().toISOString(),
  };
}

async function readStore(): Promise<NotificationEventsStore> {
  try {
    const redis = getRedis();
    const raw = await redis.get<string>(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<NotificationEventsStore> | null;
    if (!parsed || typeof parsed !== "object") return emptyStore();
    return {
      events: Array.isArray(parsed.events) ? parsed.events.map((item) => normalizeEvent(item)).filter((item): item is NotificationEventRecord => Boolean(item)) : [],
      deliveries: Array.isArray(parsed.deliveries) ? parsed.deliveries.map((item) => normalizeDelivery(item)).filter((item): item is NotificationDeliveryRecord => Boolean(item)) : [],
    };
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: NotificationEventsStore) {
  const redis = getRedis();
  await redis.set(STORE_KEY, JSON.stringify({
    events: store.events.slice(0, MAX_EVENTS),
    deliveries: store.deliveries.slice(0, MAX_DELIVERIES),
  }));
}

export async function createNotificationEvent(input: {
  workflowId: string;
  title?: string | null;
  description?: string | null;
  companyId?: string | null;
  companySlug?: string | null;
  companyName?: string | null;
  projectId?: string | null;
  projectSlug?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  sourceType: NotificationEventSourceType;
  sourceId?: string | null;
  payload?: Record<string, unknown>;
  recipients?: NotificationEventRecipient[];
}) {
  const workflow = findWorkflow(input.workflowId);
  const now = new Date().toISOString();
  const event = normalizeEvent({
    id: randomUUID(),
    eventType: workflow?.eventType ?? input.workflowId,
    workflowId: workflow?.id ?? input.workflowId,
    title: input.title || workflow?.label || input.workflowId,
    description: input.description || workflow?.description || "Evento operacional gerado.",
    category: workflow?.category ?? "project",
    criticality: workflow?.criticality ?? "normal",
    mandatory: workflow?.mandatory ?? false,
    companyId: input.companyId ?? null,
    companySlug: input.companySlug ?? null,
    companyName: input.companyName ?? null,
    projectId: input.projectId ?? null,
    projectSlug: input.projectSlug ?? null,
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? null,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    payload: input.payload ?? {},
    createdAt: now,
  });
  if (!event) throw new Error("Evento de notificacao invalido");

  const recipients = input.recipients?.length ? input.recipients : [];
  const deliveries: NotificationDeliveryRecord[] = [];
  for (const recipient of recipients) {
    const recipientId = sanitizeText(recipient.recipientId, 120);
    if (!recipientId) continue;
    const channels = recipient.channels?.length ? recipient.channels : workflow?.defaultChannels ?? ["in_app", "brain"];
    for (const channel of channels) {
      const decision = recipientId === "brain"
        ? { decision: "delivered" as NotificationDeliveryDecision, reason: "Brain recebe contexto operacional do evento." }
        : await resolveNotificationDeliveryDecision({
            workflowId: event.workflowId,
            channel,
            companyId: event.companyId,
            companySlug: event.companySlug,
            profileKind: recipient.profileKind ?? null,
            userId: recipientId,
          });
      const delivery = normalizeDelivery({
        id: randomUUID(),
        eventId: event.id,
        channel,
        recipientId,
        recipientName: recipient.recipientName ?? null,
        profileKind: recipient.profileKind ?? null,
        status: decision.decision.startsWith("suppressed") ? "suppressed" : "delivered",
        decision: decision.decision,
        decisionReason: decision.reason,
        createdAt: now,
      });
      if (delivery) deliveries.push(delivery);
    }
  }

  const store = await readStore();
  store.events = [event, ...store.events].slice(0, MAX_EVENTS);
  store.deliveries = [...deliveries, ...store.deliveries].slice(0, MAX_DELIVERIES);
  await writeStore(store);
  return { event, deliveries };
}

export async function listNotificationEvents(options: {
  companySlug?: string | null;
  projectSlug?: string | null;
  sourceType?: NotificationEventSourceType | null;
  limit?: number | null;
} = {}) {
  const store = await readStore();
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
  const events = store.events.filter((event) => {
    if (options.companySlug && event.companySlug !== options.companySlug) return false;
    if (options.projectSlug && event.projectSlug !== options.projectSlug) return false;
    if (options.sourceType && event.sourceType !== options.sourceType) return false;
    return true;
  }).slice(0, limit);
  const eventIds = new Set(events.map((event) => event.id));
  return {
    events,
    deliveries: store.deliveries.filter((delivery) => eventIds.has(delivery.eventId)),
  };
}

export async function getNotificationEventsSummary() {
  const store = await readStore();
  const delivered = store.deliveries.filter((item) => item.status === "delivered").length;
  const suppressed = store.deliveries.filter((item) => item.status === "suppressed").length;
  return {
    events: store.events.length,
    deliveries: store.deliveries.length,
    delivered,
    suppressed,
    critical: store.events.filter((item) => item.criticality === "critical").length,
    releaseCalendar: store.events.filter((item) => item.sourceType === "release_calendar").length,
  };
}
