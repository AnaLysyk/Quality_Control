import "server-only";

import { randomUUID } from "crypto";

import { getRedis } from "@/lib/redis";
import { releaseCalendarTemplates, type ReleaseCalendarEvent, type ReleaseCalendarEventType, type ReleaseCalendarStatus } from "@/data/releaseCalendarModel";

export type ReleaseCalendarEventInput = Partial<Omit<ReleaseCalendarEvent, "id">> & {
  id?: string;
  title: string;
  type: ReleaseCalendarEventType;
  releaseId: string;
  releaseName: string;
  startAt: string;
  endAt: string;
};

type ReleaseCalendarStore = {
  events: ReleaseCalendarEvent[];
};

const STORE_KEY = "qc:release_calendar:v1";

function emptyStore(): ReleaseCalendarStore {
  return { events: [] };
}

function sanitizeText(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function nullableText(value: unknown, max = 240) {
  const text = sanitizeText(value, max);
  return text || null;
}

function sanitizeList(value: unknown, maxItems = 12) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeText(item, 240))
    .filter(Boolean)
    .slice(0, maxItems);
}

function isEventType(value: string): value is ReleaseCalendarEventType {
  return ["discovery", "scope_cut", "dev_freeze", "qa_window", "bug_bash", "uat", "release_candidate", "release", "post_release"].includes(value);
}

function isStatus(value: string): value is ReleaseCalendarStatus {
  return ["planned", "at_risk", "blocked", "done", "cancelled"].includes(value);
}

function normalizeEvent(input: Partial<ReleaseCalendarEvent> | null | undefined): ReleaseCalendarEvent | null {
  const title = sanitizeText(input?.title);
  const type = sanitizeText(input?.type);
  const releaseId = sanitizeText(input?.releaseId);
  const releaseName = sanitizeText(input?.releaseName);
  const startAt = sanitizeText(input?.startAt, 80);
  const endAt = sanitizeText(input?.endAt, 80);
  if (!title || !isEventType(type) || !releaseId || !releaseName || !startAt || !endAt) return null;

  const status = sanitizeText(input?.status);
  const criticality = sanitizeText(input?.criticality);
  return {
    id: sanitizeText(input?.id, 120) || randomUUID(),
    title,
    type,
    status: isStatus(status) ? status : "planned",
    criticality: criticality === "critical" || criticality === "high" || criticality === "low" ? criticality : "normal",
    companyId: nullableText(input?.companyId),
    companySlug: nullableText(input?.companySlug),
    companyName: nullableText(input?.companyName),
    projectId: nullableText(input?.projectId),
    projectSlug: nullableText(input?.projectSlug),
    releaseId,
    releaseName,
    startAt,
    endAt,
    ownerId: nullableText(input?.ownerId),
    ownerName: nullableText(input?.ownerName),
    description: sanitizeText(input?.description, 800),
    checklist: sanitizeList(input?.checklist),
    notificationRules: sanitizeList(input?.notificationRules),
    brianRules: sanitizeList(input?.brianRules),
  };
}

async function readStore(): Promise<ReleaseCalendarStore> {
  try {
    const redis = getRedis();
    const raw = await redis.get<string>(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<ReleaseCalendarStore> | null;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.events)) return emptyStore();
    return {
      events: parsed.events
        .map((event) => normalizeEvent(event))
        .filter((event): event is ReleaseCalendarEvent => Boolean(event)),
    };
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: ReleaseCalendarStore) {
  const redis = getRedis();
  await redis.set(STORE_KEY, JSON.stringify(store));
}

export async function listReleaseCalendarEvents(options: {
  companySlug?: string | null;
  projectSlug?: string | null;
  releaseId?: string | null;
  status?: ReleaseCalendarStatus | null;
} = {}) {
  const store = await readStore();
  const source = store.events.length ? store.events : releaseCalendarTemplates;
  return source
    .filter((event) => {
      if (options.companySlug && event.companySlug !== options.companySlug) return false;
      if (options.projectSlug && event.projectSlug !== options.projectSlug) return false;
      if (options.releaseId && event.releaseId !== options.releaseId) return false;
      if (options.status && event.status !== options.status) return false;
      return true;
    })
    .sort((left, right) => left.startAt.localeCompare(right.startAt));
}

export async function upsertReleaseCalendarEvent(input: ReleaseCalendarEventInput) {
  const event = normalizeEvent(input as Partial<ReleaseCalendarEvent>);
  if (!event) throw new Error("Evento de calendario invalido");
  const store = await readStore();
  store.events = [event, ...store.events.filter((item) => item.id !== event.id)];
  await writeStore(store);
  return event;
}

export async function updateReleaseCalendarEventStatus(id: string, status: ReleaseCalendarStatus) {
  const store = await readStore();
  const idx = store.events.findIndex((event) => event.id === id);
  if (idx === -1) return null;
  const next = { ...store.events[idx], status };
  store.events[idx] = next;
  await writeStore(store);
  return next;
}

export async function getReleaseCalendarSummary() {
  const events = await listReleaseCalendarEvents();
  return {
    total: events.length,
    planned: events.filter((event) => event.status === "planned").length,
    atRisk: events.filter((event) => event.status === "at_risk").length,
    blocked: events.filter((event) => event.status === "blocked").length,
    done: events.filter((event) => event.status === "done").length,
    critical: events.filter((event) => event.criticality === "critical").length,
    releases: new Set(events.map((event) => event.releaseId)).size,
    qaWindows: events.filter((event) => event.type === "qa_window").length,
  };
}
