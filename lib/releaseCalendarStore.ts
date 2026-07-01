import "server-only";

import { randomUUID } from "crypto";

import {
  releaseCalendarTemplates,
  type ReleaseCalendarAudienceProfile,
  type ReleaseCalendarContext,
  type ReleaseCalendarCriticality,
  type ReleaseCalendarEvent,
  type ReleaseCalendarEventType,
  type ReleaseCalendarStatus,
} from "@/data/releaseCalendarModel";

import { getRedis } from "@/lib/redis";

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

const VALID_EVENT_TYPES: ReleaseCalendarEventType[] = [
  "discovery",
  "scope_cut",
  "dev_freeze",
  "qa_window",
  "bug_bash",
  "uat",
  "release_candidate",
  "release",
  "post_release",
];

const VALID_STATUSES: ReleaseCalendarStatus[] = ["planned", "at_risk", "blocked", "done", "cancelled"];
const VALID_CRITICALITIES: ReleaseCalendarCriticality[] = ["critical", "high", "normal", "low"];
const VALID_CONTEXTS: ReleaseCalendarContext[] = ["company", "project", "user", "tc", "support", "release", "delivery"];
const VALID_AUDIENCE_PROFILES: ReleaseCalendarAudienceProfile[] = [
  "all",
  "empresa",
  "company_user",
  "testing_company_user",
  "leader_tc",
  "technical_support",
  "release_actor",
  "brain",
];

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
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\n|,/g)
      : [];

  return source
    .map((item) => sanitizeText(item, 240))
    .filter(Boolean)
    .slice(0, maxItems);
}

function isEventType(value: string): value is ReleaseCalendarEventType {
  return VALID_EVENT_TYPES.includes(value as ReleaseCalendarEventType);
}

function isStatus(value: string): value is ReleaseCalendarStatus {
  return VALID_STATUSES.includes(value as ReleaseCalendarStatus);
}

function isCriticality(value: string): value is ReleaseCalendarCriticality {
  return VALID_CRITICALITIES.includes(value as ReleaseCalendarCriticality);
}

function isContext(value: string): value is ReleaseCalendarContext {
  return VALID_CONTEXTS.includes(value as ReleaseCalendarContext);
}

function isAudienceProfile(value: string): value is ReleaseCalendarAudienceProfile {
  return VALID_AUDIENCE_PROFILES.includes(value as ReleaseCalendarAudienceProfile);
}

function normalizeAudienceProfiles(value: unknown): ReleaseCalendarAudienceProfile[] {
  const profiles = sanitizeList(value, 8)
    .map((item) => item.toLowerCase())
    .filter(isAudienceProfile);

  return profiles.length ? Array.from(new Set(profiles)) : ["leader_tc", "technical_support", "release_actor"];
}

function inferContext(input: Partial<ReleaseCalendarEvent>): ReleaseCalendarContext {
  if (sanitizeText(input.context) && isContext(sanitizeText(input.context))) return sanitizeText(input.context) as ReleaseCalendarContext;
  if (nullableText(input.ownerId) || nullableText(input.ownerName) || sanitizeList(input.participantNames).length) return "user";
  if (nullableText(input.projectId) || nullableText(input.projectSlug)) return "project";
  if (nullableText(input.companyId) || nullableText(input.companySlug) || nullableText(input.companyName)) return "company";
  return input.type === "release" ? "delivery" : "release";
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
  const context = inferContext(input ?? {});
  const markerLabel = sanitizeText(input?.markerLabel, 48) || title;
  return {
    id: sanitizeText(input?.id, 120) || randomUUID(),
    title,
    type,
    status: isStatus(status) ? status : "planned",
    criticality: isCriticality(criticality) ? criticality : "normal",
    context,
    markerLabel,
    audienceProfiles: normalizeAudienceProfiles(input?.audienceProfiles),
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
    participantNames: sanitizeList(input?.participantNames, 16),
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

function textMatches(value: string | null | undefined, needle: string) {
  if (!needle) return true;
  return (value ?? "").toLowerCase().includes(needle.toLowerCase());
}

function audienceMatches(event: ReleaseCalendarEvent, audienceProfile?: ReleaseCalendarAudienceProfile | null) {
  if (!audienceProfile) return true;
  return event.audienceProfiles.includes("all") || event.audienceProfiles.includes(audienceProfile);
}

export async function listReleaseCalendarEvents(options: {
  companySlug?: string | null;
  projectSlug?: string | null;
  releaseId?: string | null;
  status?: ReleaseCalendarStatus | null;
  criticality?: ReleaseCalendarCriticality | null;
  context?: ReleaseCalendarContext | null;
  audienceProfile?: ReleaseCalendarAudienceProfile | null;
  ownerName?: string | null;
} = {}) {
  const store = await readStore();
  const source = store.events.length ? store.events : releaseCalendarTemplates;
  const ownerNeedle = sanitizeText(options.ownerName);

  return source
    .filter((event) => {
      if (options.companySlug && event.companySlug !== options.companySlug) return false;
      if (options.projectSlug && event.projectSlug !== options.projectSlug) return false;
      if (options.releaseId && event.releaseId !== options.releaseId) return false;
      if (options.status && event.status !== options.status) return false;
      if (options.criticality && event.criticality !== options.criticality) return false;
      if (options.context && event.context !== options.context) return false;
      if (!audienceMatches(event, options.audienceProfile)) return false;
      if (
        ownerNeedle &&
        !textMatches(event.ownerName, ownerNeedle) &&
        !event.participantNames.some((participant) => textMatches(participant, ownerNeedle))
      ) {
        return false;
      }
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
  const companies = new Set(events.map((event) => event.companySlug ?? event.companyName).filter(Boolean));
  const projects = new Set(events.map((event) => event.projectSlug).filter(Boolean));
  const users = new Set(
    events
      .flatMap((event) => [event.ownerName, ...event.participantNames])
      .map((value) => value?.trim())
      .filter(Boolean),
  );
  const contexts = new Set(events.map((event) => event.context).filter(Boolean));

  return {
    total: events.length,
    planned: events.filter((event) => event.status === "planned").length,
    atRisk: events.filter((event) => event.status === "at_risk").length,
    blocked: events.filter((event) => event.status === "blocked").length,
    done: events.filter((event) => event.status === "done").length,
    critical: events.filter((event) => event.criticality === "critical").length,
    releases: new Set(events.map((event) => event.releaseId)).size,
    qaWindows: events.filter((event) => event.type === "qa_window").length,
    companies: companies.size,
    projects: projects.size,
    users: users.size,
    contexts: contexts.size,
    leaderVisible: events.filter((event) => audienceMatches(event, "leader_tc")).length,
    supportVisible: events.filter((event) => audienceMatches(event, "technical_support")).length,
  };
}
