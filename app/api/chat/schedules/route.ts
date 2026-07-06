import { NextRequest, NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { registerChatSchedule, type ChatScheduleEntry } from "@/lib/chatPresenceStore";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";
import { upsertReleaseCalendarEvent } from "@/lib/releaseCalendarStore";

export const runtime = "nodejs";
export const revalidate = 0;

const CHAT_SCHEDULE_TYPES = ["meeting", "internal_appointment", "task", "run_delivery", "follow_up"] as const;

type ChatScheduleType = (typeof CHAT_SCHEDULE_TYPES)[number];

function readString(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return Array.isArray(value) ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean) : [];
}

function normalizeType(value: string): ChatScheduleType {
  return CHAT_SCHEDULE_TYPES.includes(value as ChatScheduleType) ? (value as ChatScheduleType) : "meeting";
}

function actorLabel(access: NonNullable<Awaited<ReturnType<typeof getAccessContext>>>) {
  return access.email || access.user || access.userId;
}

function isMeetSchedule(type: ChatScheduleType, payload: Record<string, unknown>) {
  return type === "meeting" && payload.meet === true;
}

function calendarCopy(type: ChatScheduleType, meet: boolean) {
  if (type === "task") {
    return {
      eventType: "delivery" as const,
      markerLabel: "Tarefa",
      releaseName: "Tarefa criada pelo chat",
      checklist: ["Responsavel confirmado", "Prazo registrado", "Atualizar status da tarefa"],
      notificationRules: ["Notificar responsavel", "Exibir em Meus agendamentos", "Exibir na agenda da empresa quando houver empresa"],
      brianRules: ["Relacionar tarefa com a conversa", "Guardar responsavel, prazo e contexto"],
    };
  }

  if (meet) {
    return {
      eventType: "meeting" as const,
      markerLabel: "Meet",
      releaseName: "Ligacao Google Meet criada pelo chat",
      checklist: ["Confirmar participantes", "Gerar ou abrir link do Meet", "Registrar decisao da ligacao"],
      notificationRules: ["Notificar as duas partes", "Exibir em Meus agendamentos", "Exibir nos agendamentos gerais da empresa"],
      brianRules: ["Relacionar Meet com a conversa", "Guardar pauta, participantes e decisao"],
    };
  }

  return {
    eventType: "meeting" as const,
    markerLabel: "Agenda",
    releaseName: "Agendamento interno criado pelo chat",
    checklist: ["Confirmar horario", "Confirmar participante", "Atualizar status depois do compromisso"],
    notificationRules: ["Notificar participante", "Exibir em Meus agendamentos", "Exibir na agenda da empresa quando houver empresa"],
    brianRules: ["Relacionar agendamento com a conversa", "Guardar contexto interno sem abrir Meet"],
  };
}

async function mirrorChatScheduleToInternalAgenda(input: {
  schedule: ChatScheduleEntry;
  access: NonNullable<Awaited<ReturnType<typeof getAccessContext>>>;
  payload: Record<string, unknown>;
}) {
  const meet = input.schedule.meet === true;
  const copy = calendarCopy(input.schedule.type, meet);
  const participantNames = Array.from(
    new Set([
      actorLabel(input.access),
      ...readStringArray(input.payload, "participantNames"),
      ...readStringArray(input.payload, "participantLabels"),
      ...input.schedule.userIds.filter((userId) => userId !== input.access.userId),
    ].filter(Boolean)),
  );
  const notes = input.schedule.notes?.trim();
  const meetLine = meet ? "Google Meet: sim. Link deve ser gerado/associado pelo calendario." : "Google Meet: nao. Fluxo permanece interno no sistema.";

  return upsertReleaseCalendarEvent({
    id: `chat-${input.schedule.id}`,
    title: input.schedule.title,
    type: copy.eventType,
    status: "planned",
    criticality: input.schedule.type === "task" ? "normal" : "low",
    context: input.schedule.companyName ? "company" : "user",
    markerLabel: copy.markerLabel,
    audienceProfiles: ["all", "leader_tc", "technical_support", "testing_company_user", "brain"],
    companyId: null,
    companySlug: null,
    companyName: input.schedule.companyName ?? null,
    projectId: null,
    projectSlug: input.schedule.projectName ?? null,
    releaseId: `chat-${input.schedule.id}`,
    releaseName: copy.releaseName,
    startAt: input.schedule.startAt,
    endAt: input.schedule.endAt,
    ownerId: input.access.userId,
    ownerName: actorLabel(input.access),
    participantNames,
    description: [notes, meetLine, `Origem: Chat/Conversas (${input.schedule.id}).`].filter(Boolean).join("\n"),
    checklist: copy.checklist,
    notificationRules: copy.notificationRules,
    brianRules: copy.brianRules,
  });
}

export async function POST(req: NextRequest) {
  const access = await getAccessContext(req);

  if (!access) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const title = readString(payload, "title");
  const startAt = readString(payload, "startAt");
  const endAt = readString(payload, "endAt");

  if (!title || !startAt || !endAt) {
    return NextResponse.json({ error: "Titulo, inicio e fim sao obrigatorios" }, { status: 400 });
  }

  const type = normalizeType(readString(payload, "type"));
  const meet = isMeetSchedule(type, payload);
  const userIds = Array.from(new Set([access.userId, ...readStringArray(payload, "userIds")].filter(Boolean)));

  const schedule = await registerChatSchedule({
    title,
    type,
    startAt,
    endAt,
    userIds,
    companyName: readString(payload, "companyName") || null,
    projectName: readString(payload, "projectName") || null,
    notes: readString(payload, "notes") || null,
    meet,
    createdById: access.userId,
  });

  const agendaEvent = await mirrorChatScheduleToInternalAgenda({ schedule, access, payload });

  return NextResponse.json({ ok: true, schedule, agendaEvent }, { headers: NO_STORE_HEADERS });
}
