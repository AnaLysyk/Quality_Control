
import "server-only";

import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";

export type ChatPresenceStatus = "online" | "busy" | "offline";

type ChatPresenceEntry = {
  userId: string;
  lastSeenAt: string;
  path?: string | null;
};

export type ChatScheduleEntry = {
  id: string;
  title: string;
  type: "meeting" | "run_delivery" | "follow_up";
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
const DATA_DIR = process.env.QC_RUNTIME_DATA_DIR || path.join(process.cwd(), "data");
const PRESENCE_PATH = path.join(DATA_DIR, "chat-presence-store.json");
const SCHEDULES_PATH = path.join(DATA_DIR, "chat-schedules-store.json");

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(filePath: string, value: T) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export async function touchChatPresence(input: { userId: string; path?: string | null }) {
  const store = await readJson<Record<string, ChatPresenceEntry>>(PRESENCE_PATH, {});
  const now = new Date().toISOString();

  store[input.userId] = {
    userId: input.userId,
    lastSeenAt: now,
    path: input.path ?? null,
  };

  await writeJson(PRESENCE_PATH, store);
  return store[input.userId];
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
  const schedules = await readJson<ChatScheduleEntry[]>(SCHEDULES_PATH, []);
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
    meet: input.meet ?? false,
    createdById: input.createdById,
    createdAt: new Date().toISOString(),
  };

  schedules.push(schedule);
  await writeJson(SCHEDULES_PATH, schedules);

  return schedule;
}

async function listActiveSchedules(now = new Date()) {
  const schedules = await readJson<ChatScheduleEntry[]>(SCHEDULES_PATH, []);
  const currentTime = now.getTime();

  return schedules.filter((schedule) => {
    const start = new Date(schedule.startAt).getTime();
    const end = new Date(schedule.endAt).getTime();

    return Number.isFinite(start) && Number.isFinite(end) && start <= currentTime && currentTime <= end;
  });
}

export async function resolveChatPresenceForUsers(userIds: string[]) {
  const uniqueIds = unique(userIds);
  const [presence, activeSchedules] = await Promise.all([
    readJson<Record<string, ChatPresenceEntry>>(PRESENCE_PATH, {}),
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
        label: "Em agendamento",
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
