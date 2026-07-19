import "server-only";

import { getRedis } from "@/backend/redis";
import { getNotificationOperationModel, type NotificationChannel } from "@/data/notificationOperationModel";
import { notificationWorkflowExtensions } from "@/data/notificationWorkflowExtensions";

export type NotificationPreferenceTarget = "company" | "profile" | "user";
export type NotificationPreferenceDecision = "enabled" | "disabled";
export type NotificationDeliveryDecision = "delivered" | "suppressed_by_company" | "suppressed_by_profile" | "suppressed_by_user" | "mandatory_override";

export type NotificationPreference = {
  id: string;
  target: NotificationPreferenceTarget;
  targetId: string;
  workflowId: string;
  channel: NotificationChannel;
  decision: NotificationPreferenceDecision;
  updatedAt: string;
  updatedBy: string | null;
};

type NotificationPreferencesStore = {
  preferences: NotificationPreference[];
};

const STORE_KEY = "qc:notification_preferences:v1";
let memoryStore: NotificationPreferencesStore = emptyStore();

function emptyStore(): NotificationPreferencesStore {
  return { preferences: [] };
}

function preferenceId(target: NotificationPreferenceTarget, targetId: string, workflowId: string, channel: NotificationChannel) {
  return [target, targetId, workflowId, channel].join("::");
}

function sanitizeText(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isChannel(value: string): value is NotificationChannel {
  return ["in_app", "email", "push", "chat", "brain"].includes(value);
}

function normalizePreference(input: Partial<NotificationPreference> | null | undefined): NotificationPreference | null {
  const target = input?.target === "company" || input?.target === "profile" || input?.target === "user" ? input.target : null;
  const targetId = sanitizeText(input?.targetId);
  const workflowId = sanitizeText(input?.workflowId);
  const channel = sanitizeText(input?.channel);
  if (!target || !targetId || !workflowId || !isChannel(channel)) return null;
  return {
    id: preferenceId(target, targetId, workflowId, channel),
    target,
    targetId,
    workflowId,
    channel,
    decision: input?.decision === "disabled" ? "disabled" : "enabled",
    updatedAt: sanitizeText(input?.updatedAt, 80) || new Date().toISOString(),
    updatedBy: sanitizeText(input?.updatedBy) || null,
  };
}

function normalizeStore(store: Partial<NotificationPreferencesStore> | null | undefined): NotificationPreferencesStore {
  if (!store || typeof store !== "object" || !Array.isArray(store.preferences)) return emptyStore();
  return {
    preferences: store.preferences
      .map((item) => normalizePreference(item))
      .filter((item): item is NotificationPreference => Boolean(item)),
  };
}

async function readStore(): Promise<NotificationPreferencesStore> {
  try {
    const redis = getRedis();
    const raw = await redis.get<string>(STORE_KEY);
    if (!raw) return memoryStore;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferencesStore> | null;
    memoryStore = normalizeStore(parsed);
    return memoryStore;
  } catch {
    return memoryStore;
  }
}

async function writeStore(store: NotificationPreferencesStore) {
  memoryStore = normalizeStore(store);
  try {
    const redis = getRedis();
    await redis.set(STORE_KEY, JSON.stringify(memoryStore));
  } catch {
    // fallback em memoria para ambiente local sem Redis
  }
}

export async function listNotificationPreferences() {
  const store = await readStore();
  return store.preferences.sort((left, right) => left.id.localeCompare(right.id));
}

export async function upsertNotificationPreference(input: {
  target: NotificationPreferenceTarget;
  targetId: string;
  workflowId: string;
  channel: NotificationChannel;
  decision: NotificationPreferenceDecision;
  updatedBy?: string | null;
}) {
  const preference = normalizePreference({ ...input, updatedAt: new Date().toISOString(), updatedBy: input.updatedBy ?? null });
  if (!preference) throw new Error("Preferencia de notificacao invalida");
  const store = await readStore();
  store.preferences = [preference, ...store.preferences.filter((item) => item.id !== preference.id)];
  await writeStore(store);
  return preference;
}

export async function resolveNotificationDeliveryDecision(input: {
  workflowId: string;
  channel: NotificationChannel;
  companyId?: string | null;
  companySlug?: string | null;
  profileKind?: string | null;
  userId?: string | null;
}): Promise<{ decision: NotificationDeliveryDecision; reason: string }> {
  const model = getNotificationOperationModel();
  const workflows = [...model.workflows, ...notificationWorkflowExtensions];
  const workflow = workflows.find((item) => item.id === input.workflowId || item.eventType === input.workflowId);
  if (!workflow) return { decision: "delivered", reason: "Workflow nao configurado; entrega liberada por padrao." };
  if (workflow.mandatory) return { decision: "mandatory_override", reason: "Evento obrigatorio: preferencias nao bloqueiam recebimento." };

  const store = await readStore();
  const checks: Array<{ target: NotificationPreferenceTarget; targetId: string | null | undefined; blocked: NotificationDeliveryDecision }> = [
    { target: "company", targetId: input.companyId ?? input.companySlug, blocked: "suppressed_by_company" },
    { target: "profile", targetId: input.profileKind, blocked: "suppressed_by_profile" },
    { target: "user", targetId: input.userId, blocked: "suppressed_by_user" },
  ];

  for (const check of checks) {
    if (!check.targetId) continue;
    const preference = store.preferences.find(
      (item) => item.target === check.target && item.targetId === check.targetId && item.workflowId === workflow.id && item.channel === input.channel,
    );
    if (preference?.decision === "disabled") {
      return { decision: check.blocked, reason: `${check.target} desativou ${input.channel} para ${workflow.label}.` };
    }
  }

  return { decision: "delivered", reason: "Nenhuma preferencia bloqueou a entrega." };
}

export async function getNotificationPreferenceSummary() {
  const store = await readStore();
  const disabled = store.preferences.filter((item) => item.decision === "disabled");
  return {
    total: store.preferences.length,
    disabled: disabled.length,
    enabled: store.preferences.length - disabled.length,
    company: store.preferences.filter((item) => item.target === "company").length,
    profile: store.preferences.filter((item) => item.target === "profile").length,
    user: store.preferences.filter((item) => item.target === "user").length,
  };
}

