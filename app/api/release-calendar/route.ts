import { NextRequest, NextResponse } from "next/server";

import {
  getReleaseCalendarModel,
  type ReleaseCalendarAudienceProfile,
  type ReleaseCalendarContext,
  type ReleaseCalendarCriticality,
  type ReleaseCalendarEvent,
} from "@/data/releaseCalendarModel";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";
import { authenticateRequest } from "@/lib/jwtAuth";
import { createNotificationEvent, type NotificationEventRecipient } from "@/lib/notificationEventsStore";
import { getReleaseCalendarSummary, listReleaseCalendarEvents, updateReleaseCalendarEventStatus, upsertReleaseCalendarEvent } from "@/lib/releaseCalendarStore";

export const runtime = "nodejs";
export const revalidate = 0;

const VALID_STATUSES = ["planned", "at_risk", "blocked", "done", "cancelled"] as const;
const VALID_CRITICALITIES = ["critical", "high", "normal", "low"] as const;
const VALID_CONTEXTS = ["company", "project", "user", "tc", "support", "release", "delivery"] as const;
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

type ReleaseStatus = (typeof VALID_STATUSES)[number];

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

function actorName(user: { name?: string | null; email?: string | null; id: string }) {
  return user.name ?? user.email ?? user.id;
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
  workflowId: "release-calendar-critical" | "release-calendar-risk" | "release-calendar-blocked";
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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companySlug = url.searchParams.get("companySlug")?.trim() || null;
  const projectSlug = url.searchParams.get("projectSlug")?.trim() || null;
  const releaseId = url.searchParams.get("releaseId")?.trim() || null;
  const ownerName = url.searchParams.get("ownerName")?.trim() || null;
  const status = normalizeStatus(url.searchParams.get("status")?.trim() || null);
  const criticality = normalizeCriticality(url.searchParams.get("criticality")?.trim() || null);
  const context = normalizeContext(url.searchParams.get("context")?.trim() || null);
  const audienceProfile = normalizeAudienceProfile(url.searchParams.get("audienceProfile")?.trim() || null);

  const [events, summary] = await Promise.all([
    listReleaseCalendarEvents({ companySlug, projectSlug, releaseId, ownerName, status, criticality, context, audienceProfile }),
    getReleaseCalendarSummary(),
  ]);

  return NextResponse.json(
    { ...getReleaseCalendarModel(), events, calendarSummary: summary },
    { headers: NO_STORE_HEADERS },
  );
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const event = await upsertReleaseCalendarEvent({
    ...body,
    ownerId: body?.ownerId ?? user.id,
    ownerName: body?.ownerName ?? actorName(user),
  });

  const notification = event.criticality === "critical"
    ? await recordCalendarNotification({
        workflowId: "release-calendar-critical",
        event,
        user,
        title: `Evento critico criado: ${event.title}`,
        description: `Evento critico da release ${event.releaseName} foi cadastrado na agenda para ${event.audienceProfiles.join(", ")}.`,
      })
    : null;

  return NextResponse.json({ event, notification }, { status: 201, headers: NO_STORE_HEADERS });
}

export async function PATCH(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const status = normalizeStatus(body?.status);

  if (!id || !status) {
    return NextResponse.json({ error: "Informe id e status valido." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const event = await updateReleaseCalendarEventStatus(id, status);
  if (!event) {
    return NextResponse.json({ error: "Evento de agenda nao encontrado." }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const notification = status === "blocked"
    ? await recordCalendarNotification({
        workflowId: "release-calendar-blocked",
        event,
        user,
        title: `Release bloqueada: ${event.title}`,
        description: `Evento da release ${event.releaseName} mudou para bloqueado.`,
      })
    : status === "at_risk"
      ? await recordCalendarNotification({
          workflowId: "release-calendar-risk",
          event,
          user,
          title: `Release em risco: ${event.title}`,
          description: `Evento da release ${event.releaseName} mudou para em risco.`,
        })
      : null;

  return NextResponse.json({ event, notification }, { status: 200, headers: NO_STORE_HEADERS });
}
