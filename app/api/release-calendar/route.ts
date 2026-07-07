import { NextRequest, NextResponse } from "next/server";

import {
  getReleaseCalendarModel,
  type ReleaseCalendarAudienceProfile,
  type ReleaseCalendarContext,
  type ReleaseCalendarCriticality,
  type ReleaseCalendarEvent,
  type ReleaseCalendarEventType,
} from "@/data/releaseCalendarModel";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";
import { getAccessContext } from "@/lib/auth/session";
import { hasPermissionAccess, resolveEffectivePermissionMatrix } from "@/lib/permissionMatrix";
import { authenticateRequest } from "@/lib/jwtAuth";
import { createNotificationEvent, type NotificationEventRecipient } from "@/lib/notificationEventsStore";
import { listReleaseCalendarEvents, updateReleaseCalendarEvent, updateReleaseCalendarEventStatus, upsertReleaseCalendarEvent, type ReleaseCalendarEventInput } from "@/lib/releaseCalendarStore";

export const runtime = "nodejs";
export const revalidate = 0;

const VALID_STATUSES = ["pending", "ready", "planned", "at_risk", "blocked", "done", "delivered", "cancelled"] as const;
const VALID_CRITICALITIES = ["critical", "high", "normal", "low"] as const;
const VALID_CONTEXTS = ["company", "project", "user", "tc", "support", "release", "delivery"] as const;
const VALID_EVENT_TYPES = [
  "delivery",
  "meeting",
  "discovery",
  "scope_cut",
  "dev_freeze",
  "qa_window",
  "bug_bash",
  "uat",
  "release_candidate",
  "release",
  "post_release",
] as const;
const VALID_AUDIENCE_PROFILES = [
  "all",
  "empresa",
  "company_user",
  "testing_company_user",
  "leader_tc",
  "technical_support",
  "release_actor",
  "brain",
] as const;
const VALID_SCOPES = ["mine", "company", "all"] as const;
const GLOBAL_AGENDA_ROLES = new Set(["leader_tc", "technical_support"]);

type ReleaseStatus = (typeof VALID_STATUSES)[number];
type AgendaScope = (typeof VALID_SCOPES)[number];
type AccessContextValue = NonNullable<Awaited<ReturnType<typeof getAccessContext>>>;

async function requireReleaseCalendarAccess(req: NextRequest, action: "view" | "create" | "edit" | "status") {
  const access = await getAccessContext(req);
  if (!access) {
    return {
      access: null,
      response: NextResponse.json({ error: "Nao autorizado" }, { status: 401, headers: NO_STORE_HEADERS }),
    };
  }

  const permissions = resolveEffectivePermissionMatrix({
    role: access.role,
    companyRole: access.companyRole,
    globalRole: access.globalRole,
    isGlobalAdmin: access.isGlobalAdmin,
  });
  const allowed = access.isGlobalAdmin || hasPermissionAccess(permissions, "release_calendar", action);
  if (!allowed) {
    return {
      access,
      response: NextResponse.json({ error: "Sem permissao para acessar a agenda." }, { status: 403, headers: NO_STORE_HEADERS }),
    };
  }

  return { access, response: null };
}

function normalizeStatus(value: unknown): ReleaseStatus | null {
  return typeof value === "string" && VALID_STATUSES.includes(value as ReleaseStatus) ? (value as ReleaseStatus) : null;
}

function normalizeCriticality(value: unknown): ReleaseCalendarCriticality | null {
  return typeof value === "string" && VALID_CRITICALITIES.includes(value as ReleaseCalendarCriticality) ? (value as ReleaseCalendarCriticality) : null;
}

function normalizeContext(value: unknown): ReleaseCalendarContext | null {
  return typeof value === "string" && VALID_CONTEXTS.includes(value as ReleaseCalendarContext) ? (value as ReleaseCalendarContext) : null;
}

function normalizeAudienceProfile(value: unknown): ReleaseCalendarAudienceProfile | null {
  return typeof value === "string" && VALID_AUDIENCE_PROFILES.includes(value as ReleaseCalendarAudienceProfile)
    ? (value as ReleaseCalendarAudienceProfile)
    : null;
}

function normalizeEventType(value: unknown): ReleaseCalendarEventType | undefined {
  return typeof value === "string" && VALID_EVENT_TYPES.includes(value as ReleaseCalendarEventType)
    ? (value as ReleaseCalendarEventType)
    : undefined;
}

function normalizeScope(value: unknown): AgendaScope {
  return typeof value === "string" && VALID_SCOPES.includes(value as AgendaScope) ? (value as AgendaScope) : "all";
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function optionalText(value: unknown, max = 800) {
  if (typeof value !== "string") return undefined;
  const text = value.trim().slice(0, max);
  return text || undefined;
}

function optionalStringList(value: unknown, maxItems = 16) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\n|,/g)
      : [];
  const items = source
    .map((item) => optionalText(item, 240))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
  return items.length ? items : undefined;
}

function actorName(user: { name?: string | null; email?: string | null; id: string }) {
  return user.name ?? user.email ?? user.id;
}

function canViewGlobalAgenda(access: AccessContextValue) {
  return access.isGlobalAdmin || GLOBAL_AGENDA_ROLES.has(normalizeText(access.role));
}

function eventBelongsToUser(event: ReleaseCalendarEvent, access: AccessContextValue) {
  const candidates = new Set(
    [access.userId, access.email, access.user]
      .map(normalizeText)
      .filter(Boolean),
  );

  if (!candidates.size) return false;
  if (candidates.has(normalizeText(event.ownerId))) return true;
  if (candidates.has(normalizeText(event.ownerName))) return true;

  return event.participantNames.some((participant) => candidates.has(normalizeText(participant)));
}

function filterEventsByAccess(input: {
  events: ReleaseCalendarEvent[];
  access: AccessContextValue;
  scope: AgendaScope;
  requestedCompanySlug?: string | null;
}) {
  const canSeeEveryCompany = canViewGlobalAgenda(input.access);
  const allowedCompanySlugs = new Set(input.access.companySlugs.map((slug) => slug.toLowerCase()));
  const requestedCompanySlug = normalizeText(input.requestedCompanySlug);

  return input.events.filter((event) => {
    const eventCompanySlug = normalizeText(event.companySlug);

    if (requestedCompanySlug && eventCompanySlug !== requestedCompanySlug) return false;

    if (input.scope === "mine") {
      return eventBelongsToUser(event, input.access);
    }

    if (canSeeEveryCompany) return true;

    if (!eventCompanySlug) return false;
    return allowedCompanySlugs.has(eventCompanySlug);
  });
}

function buildCalendarSummary(events: ReleaseCalendarEvent[]) {
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
    pending: events.filter((event) => event.status === "pending").length,
    planned: events.filter((event) => event.status === "planned" || event.status === "ready").length,
    atRisk: events.filter((event) => event.status === "at_risk").length,
    blocked: events.filter((event) => event.status === "blocked").length,
    done: events.filter((event) => event.status === "done" || event.status === "delivered").length,
    cancelled: events.filter((event) => event.status === "cancelled").length,
    critical: events.filter((event) => event.criticality === "critical").length,
    releases: new Set(events.map((event) => event.releaseId)).size,
    qaWindows: events.filter((event) => event.type === "qa_window").length,
    meetings: events.filter((event) => event.type === "meeting").length,
    deliveries: events.filter((event) => event.type === "delivery" || event.context === "delivery").length,
    companies: companies.size,
    projects: projects.size,
    users: users.size,
    contexts: contexts.size,
    leaderVisible: events.filter((event) => event.audienceProfiles.includes("leader_tc")).length,
    supportVisible: events.filter((event) => event.audienceProfiles.includes("technical_support")).length,
  };
}

function buildRecipients(user: { name?: string | null; email?: string | null; id: string }, event: ReleaseCalendarEvent): NotificationEventRecipient[] {
  const profileRecipients = event.audienceProfiles
    .filter((profileKind) => profileKind !== "brain")
    .map((profileKind) => ({
      recipientId: `${profileKind}:${event.companySlug ?? event.projectSlug ?? event.releaseId}`,
      recipientName: profileKind,
      profileKind,
      channels: ["in_app", "brain"] as NotificationEventRecipient["channels"],
    }));

  return [
    {
      recipientId: user.id,
      recipientName: actorName(user),
      profileKind: "release_actor",
      channels: ["in_app", "brain"],
    },
    ...profileRecipients,
    {
      recipientId: "brain",
      recipientName: "Brain",
      profileKind: "brain",
      channels: ["brain"],
    },
  ];
}

async function recordCalendarNotification(input: {
  workflowId: "release-calendar-critical" | "release-calendar-risk" | "release-calendar-blocked" | "release-calendar-updated";
  event: ReleaseCalendarEvent;
  user: { name?: string | null; email?: string | null; id: string };
  title: string;
  description: string;
}) {
  return createNotificationEvent({
    workflowId: input.workflowId,
    title: input.title,
    description: input.description,
    companyId: input.event.companyId,
    companySlug: input.event.companySlug,
    companyName: input.event.companyName,
    projectId: input.event.projectId,
    projectSlug: input.event.projectSlug,
    actorId: input.user.id,
    actorName: actorName(input.user),
    sourceType: "release_calendar",
    sourceId: input.event.id,
    payload: {
      releaseId: input.event.releaseId,
      releaseName: input.event.releaseName,
      calendarEventType: input.event.type,
      calendarStatus: input.event.status,
      calendarCriticality: input.event.criticality,
      calendarContext: input.event.context,
      calendarAudienceProfiles: input.event.audienceProfiles,
      calendarParticipants: input.event.participantNames,
      startAt: input.event.startAt,
      endAt: input.event.endAt,
    },
    recipients: buildRecipients(input.user, input.event),
  });
}

function isMeetSchedule(body: Record<string, unknown>) {
  return body.meet === true || body.meetingType === "meet" || body.location === "Google Meet";
}

function buildMeetDescription(body: Record<string, unknown>, baseDescription: unknown) {
  const description = typeof baseDescription === "string" ? baseDescription.trim() : "";
  if (!isMeetSchedule(body)) return description;
  const meetLine = "Reunião via Google Meet. Link do Meet deve ser gerado/associado pelo calendário.";
  return description.includes("Google Meet") ? description : [description, meetLine].filter(Boolean).join("\n");
}

function getNotificationTitle(event: ReleaseCalendarEvent, body: Record<string, unknown>) {
  if (event.type === "meeting" && isMeetSchedule(body)) return `Reunião Meet agendada: ${event.title}`;
  if (event.type === "meeting") return `Agendamento interno criado: ${event.title}`;
  return `Entrega agendada: ${event.title}`;
}

function buildEventMutationInput(
  body: Record<string, unknown>,
  options: {
    includeDescription?: boolean;
    defaultNotificationRules?: string[];
    defaultBrianRules?: string[];
  } = {},
): Partial<ReleaseCalendarEventInput> {
  const input: Partial<ReleaseCalendarEventInput> = {};

  const textFields = [
    "id",
    "title",
    "markerLabel",
    "companyId",
    "companySlug",
    "companyName",
    "projectId",
    "projectSlug",
    "releaseId",
    "releaseName",
    "startAt",
    "endAt",
    "ownerId",
    "ownerName",
  ] as const;

  textFields.forEach((field) => {
    const value = optionalText(body[field], field === "id" ? 120 : 240);
    if (value) input[field] = value;
  });

  const type = normalizeEventType(body.type);
  if (type) input.type = type;

  const status = normalizeStatus(body.status);
  if (status) input.status = status;

  const criticality = normalizeCriticality(body.criticality);
  if (criticality) input.criticality = criticality;

  const context = normalizeContext(body.context);
  if (context) input.context = context;

  const audienceProfiles = optionalStringList(body.audienceProfiles, 8)
    ?.map((profile) => normalizeAudienceProfile(profile))
    .filter((profile): profile is ReleaseCalendarAudienceProfile => Boolean(profile));
  if (audienceProfiles?.length) input.audienceProfiles = Array.from(new Set(audienceProfiles));

  const participantNames = optionalStringList(body.participantNames, 16);
  if (participantNames) input.participantNames = participantNames;

  const checklist = optionalStringList(body.checklist, 12);
  if (checklist) input.checklist = checklist;

  input.notificationRules = optionalStringList(body.notificationRules, 12) ?? options.defaultNotificationRules;
  input.brianRules = optionalStringList(body.brianRules, 12) ?? options.defaultBrianRules;

  if (options.includeDescription || "description" in body || isMeetSchedule(body)) {
    input.description = buildMeetDescription(body, body.description);
  }

  return input;
}

export async function GET(req: NextRequest) {
  const { access, response } = await requireReleaseCalendarAccess(req, "view");
  if (response || !access) return response;

  const url = new URL(req.url);
  const companySlug = url.searchParams.get("companySlug")?.trim() || null;
  const projectSlug = url.searchParams.get("projectSlug")?.trim() || null;
  const releaseId = url.searchParams.get("releaseId")?.trim() || null;
  const ownerName = url.searchParams.get("ownerName")?.trim() || null;
  const status = normalizeStatus(url.searchParams.get("status")?.trim() || null);
  const criticality = normalizeCriticality(url.searchParams.get("criticality")?.trim() || null);
  const context = normalizeContext(url.searchParams.get("context")?.trim() || null);
  const audienceProfile = normalizeAudienceProfile(url.searchParams.get("audienceProfile")?.trim() || null);
  const scope = normalizeScope(url.searchParams.get("scope")?.trim() || null);

  const events = await listReleaseCalendarEvents({
    companySlug: null,
    projectSlug,
    releaseId,
    ownerName,
    status,
    criticality,
    context,
    audienceProfile,
  });
  const scopedEvents = filterEventsByAccess({ events, access, scope, requestedCompanySlug: companySlug });

  return NextResponse.json(
    { ...getReleaseCalendarModel(), events: scopedEvents, calendarSummary: buildCalendarSummary(scopedEvents) },
    { headers: NO_STORE_HEADERS },
  );
}

export async function POST(req: NextRequest) {
  const { response } = await requireReleaseCalendarAccess(req, "create");
  if (response) return response;

  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Informe os dados do agendamento." }, { status: 400, headers: NO_STORE_HEADERS });

  const title = optionalText(body.title, 240);
  if (!title) return NextResponse.json({ error: "Informe o titulo do agendamento." }, { status: 400, headers: NO_STORE_HEADERS });

  const eventInput = buildEventMutationInput(body, {
    includeDescription: true,
    defaultNotificationRules: ["Notificar participantes", "Lembrar 5 minutos antes"],
    defaultBrianRules: ["Registrar contexto no Brain", "Relacionar participantes e decisao"],
  });

  const event = await upsertReleaseCalendarEvent({
    ...eventInput,
    title,
    ownerId: eventInput.ownerId ?? user.id,
    ownerName: eventInput.ownerName ?? actorName(user),
  });

  const notification = await recordCalendarNotification({
    workflowId: event.status === "blocked" ? "release-calendar-blocked" : event.criticality === "critical" ? "release-calendar-critical" : "release-calendar-updated",
    event,
    user,
    title: getNotificationTitle(event, body),
    description: `${event.title} foi registrado na agenda com status ${event.status}.`,
  });

  return NextResponse.json({ event, notification }, { status: 201, headers: NO_STORE_HEADERS });
}

export async function PATCH(req: NextRequest) {
  const { response } = await requireReleaseCalendarAccess(req, "edit");
  if (response) return response;

  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const status = normalizeStatus(body?.status);

  if (!id) {
    return NextResponse.json({ error: "Informe o id do agendamento." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const eventPatch = buildEventMutationInput(body ?? {});
  const hasFieldMutation = Object.keys(eventPatch).some((key) => {
    const patchKey = key as keyof typeof eventPatch;
    return key !== "id" && key !== "status" && eventPatch[patchKey] !== undefined;
  });

  const event = hasFieldMutation
    ? await updateReleaseCalendarEvent(id, {
        ...eventPatch,
        status: status ?? undefined,
      })
    : status
      ? await updateReleaseCalendarEventStatus(id, status)
      : null;

  if (!event) {
    return NextResponse.json({ error: "Evento de agenda nao encontrado." }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const notification = await recordCalendarNotification({
    workflowId: event.status === "blocked" ? "release-calendar-blocked" : event.status === "at_risk" ? "release-calendar-risk" : "release-calendar-updated",
    event,
    user,
    title: `Agenda atualizada: ${event.title}`,
    description: `${event.title} mudou para ${event.status}. Data: ${event.startAt}.`,
  });

  return NextResponse.json({ event, notification }, { status: 200, headers: NO_STORE_HEADERS });
}
