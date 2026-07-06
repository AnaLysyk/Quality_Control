import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prismaClient";

export type ChatPresenceStatus = "online" | "busy" | "offline";
export type ChatScheduleType = "meeting" | "internal_appointment" | "task" | "run_delivery" | "follow_up";

type ChatPresenceEntry = {
  userId: string;
  lastSeenAt: string;
  path?: string | null;
};

export type ChatScheduleEntry = {
  id: string;
  title: string;
  type: ChatScheduleType;
  startAt: string;
  endAt: string;
  userIds: string[];
  companyName?: string | null;
  projectName?: string | null;
  notes?: string | null;
  meet?: boolean;
  createdById: string;
  createdAt: string;
};

export type ChatPresenceSnapshot = {
  userId: string;
  status: ChatPresenceStatus;
  label: string;
  lastSeenAt: string | null;
  busyUntil: string | null;
  busyTitle: string | null;
};

const ONLINE_TTL_MS = 90_000;

const CHAT_PRESENCE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS chat_presence (
    user_id TEXT PRIMARY KEY,
    last_seen_at TIMESTAMPTZ NOT NULL,
    path TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const CHAT_SCHEDULE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS chat_schedules (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    user_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    company_name TEXT NULL,
    project_name TEXT NULL,
    notes TEXT NULL,
    meet BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

let dbReady: Promise<void> | null = null;

function unique(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function normalizeDate(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

async function ensureChatPresenceTables() {
  dbReady ??= (async () => {
    await prisma.$executeRawUnsafe(CHAT_PRESENCE_TABLE_SQL);
    await prisma.$executeRawUnsafe(CHAT_SCHEDULE_TABLE_SQL);
  })();

  return dbReady;
}

export async function touchChatPresence(input: { userId: string; path?: string | null }) {
  await ensureChatPresenceTables();

  const now = new Date();
  const rows = await prisma.$queryRaw<Array<{ user_id: string; last_seen_at: Date; path: string | null }>>`
    INSERT INTO chat_presence (user_id, last_seen_at, path, updated_at)
    VALUES (${input.userId}, ${now}, ${input.path ?? null}, ${now})
    ON CONFLICT (user_id)
    DO UPDATE SET
      last_seen_at = EXCLUDED.last_seen_at,
      path = EXCLUDED.path,
      updated_at = EXCLUDED.updated_at
    RETURNING user_id, last_seen_at, path
  `;

  const row = rows[0];
  return {
    userId: row?.user_id ?? input.userId,
    lastSeenAt: normalizeDate(row?.last_seen_at) ?? now.toISOString(),
    path: row?.path ?? input.path ?? null,
  } satisfies ChatPresenceEntry;
}

export async function registerChatSchedule(input: {
  title: string;
  type?: ChatScheduleEntry["type"];
  startAt: string;
  endAt: string;
  userIds: string[];
  companyName?: string | null;
  projectName?: string | null;
  notes?: string | null;
  meet?: boolean;
  createdById: string;
}) {
  await ensureChatPresenceTables();

  const schedule: ChatScheduleEntry = {
    id: randomUUID(),
    title: input.title.trim() || "Agendamento",
    type: input.type ?? "meeting",
    startAt: input.startAt,
    endAt: input.endAt,
    userIds: unique(input.userIds),
    companyName: input.companyName ?? null,
    projectName: input.projectName ?? null,
    notes: input.notes ?? null,
    meet: input.type === "meeting" ? input.meet ?? false : false,
    createdById: input.createdById,
    createdAt: new Date().toISOString(),
  };

  await prisma.$executeRaw`
    INSERT INTO chat_schedules (
      id,
      title,
      type,
      start_at,
      end_at,
      user_ids,
      company_name,
      project_name,
      notes,
      meet,
      created_by_id,
      created_at
    )
    VALUES (
      ${schedule.id},
      ${schedule.title},
      ${schedule.type},
      ${new Date(schedule.startAt)},
      ${new Date(schedule.endAt)},
      ${schedule.userIds},
      ${schedule.companyName},
      ${schedule.projectName},
      ${schedule.notes},
      ${schedule.meet},
      ${schedule.createdById},
      ${new Date(schedule.createdAt)}
    )
  `;

  return schedule;
}

async function listActiveSchedules(now = new Date()) {
  await ensureChatPresenceTables();

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    type: ChatScheduleEntry["type"];
    start_at: Date;
    end_at: Date;
    user_ids: string[];
    company_name: string | null;
    project_name: string | null;
    notes: string | null;
    meet: boolean;
    created_by_id: string;
    created_at: Date;
  }>>`
    SELECT
      id,
      title,
      type,
      start_at,
      end_at,
      user_ids,
      company_name,
      project_name,
      notes,
      meet,
      created_by_id,
      created_at
    FROM chat_schedules
    WHERE start_at <= ${now} AND end_at >= ${now}
    ORDER BY start_at ASC
  `;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    startAt: normalizeDate(row.start_at) ?? now.toISOString(),
    endAt: normalizeDate(row.end_at) ?? now.toISOString(),
    userIds: Array.isArray(row.user_ids) ? row.user_ids : [],
    companyName: row.company_name,
    projectName: row.project_name,
    notes: row.notes,
    meet: row.meet,
    createdById: row.created_by_id,
    createdAt: normalizeDate(row.created_at) ?? now.toISOString(),
  } satisfies ChatScheduleEntry));
}

async function listPresenceByUserIds(userIds: string[]) {
  await ensureChatPresenceTables();
  const ids = unique(userIds);
  if (!ids.length) return {} as Record<string, ChatPresenceEntry>;

  const rows = await prisma.$queryRaw<Array<{ user_id: string; last_seen_at: Date; path: string | null }>>`
    SELECT user_id, last_seen_at, path
    FROM chat_presence
    WHERE user_id = ANY(${ids})
  `;

  return rows.reduce<Record<string, ChatPresenceEntry>>((acc, row) => {
    acc[row.user_id] = {
      userId: row.user_id,
      lastSeenAt: normalizeDate(row.last_seen_at) ?? new Date(0).toISOString(),
      path: row.path,
    };
    return acc;
  }, {});
}

export async function resolveChatPresenceForUsers(userIds: string[]) {
  const uniqueIds = unique(userIds);
  const [presence, activeSchedules] = await Promise.all([
    listPresenceByUserIds(uniqueIds),
    listActiveSchedules(),
  ]);

  const now = Date.now();
  const result: Record<string, ChatPresenceSnapshot> = {};

  for (const userId of uniqueIds) {
    const busySchedule = activeSchedules.find((schedule) => schedule.userIds.includes(userId));

    if (busySchedule) {
      result[userId] = {
        userId,
        status: "busy",
        label: busySchedule.type === "task" ? "Em tarefa" : busySchedule.meet ? "Em Meet" : "Em agendamento",
        lastSeenAt: presence[userId]?.lastSeenAt ?? null,
        busyUntil: busySchedule.endAt,
        busyTitle: busySchedule.title,
      };
      continue;
    }

    const lastSeenAt = presence[userId]?.lastSeenAt ?? null;
    const lastSeenTime = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
    const online = Number.isFinite(lastSeenTime) && now - lastSeenTime <= ONLINE_TTL_MS;

    result[userId] = {
      userId,
      status: online ? "online" : "offline",
      label: online ? "Disponível" : "Offline",
      lastSeenAt,
      busyUntil: null,
      busyTitle: null,
    };
  }

  return result;
}

export async function enrichChatContactsPresence<T extends { id: string; active?: boolean }>(contacts: T[]) {
  const presence = await resolveChatPresenceForUsers(contacts.map((contact) => contact.id));

  return contacts.map((contact) => {
    const snapshot = presence[contact.id];

    if (contact.active === false) {
      return {
        ...contact,
        presence_status: "offline" as ChatPresenceStatus,
        presence_label: "Usuário inativo",
        presence_last_seen_at: snapshot?.lastSeenAt ?? null,
        presence_busy_until: null,
        presence_busy_title: null,
      };
    }

    return {
      ...contact,
      presence_status: snapshot?.status ?? "offline",
      presence_label: snapshot?.label ?? "Offline",
      presence_last_seen_at: snapshot?.lastSeenAt ?? null,
      presence_busy_until: snapshot?.busyUntil ?? null,
      presence_busy_title: snapshot?.busyTitle ?? null,
    };
  });
}
