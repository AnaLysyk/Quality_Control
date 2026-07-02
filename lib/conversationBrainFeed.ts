import "server-only";

import { randomUUID } from "crypto";

import { getRedis } from "@/lib/redis";

export type ConversationBrainSignalStatus = "candidate" | "approved" | "ignored";

export type ConversationBrainSignal = {
  id: string;
  messageId: string;
  threadKey: string;
  text: string;
  summary: string;
  status: ConversationBrainSignalStatus;
  reason: string;
  createdAt: string;
  actorId: string;
  actorName: string;
  peerId: string;
  peerName: string;
  companyId: string | null;
  companySlug: string | null;
  companyName: string | null;
  projectId: string | null;
  projectSlug: string | null;
  profileKind: string | null;
  sourceType: "chat_message";
};

type ConversationBrainFeedStore = {
  signals: ConversationBrainSignal[];
};

const STORE_KEY = "qc:conversation_brain_feed:v1";
const MAX_SIGNALS = 500;
const MEMORY_KEYWORDS = [
  "combinado",
  "decidido",
  "regra",
  "lembrar",
  "lembra",
  "importante",
  "pendencia",
  "bloqueio",
  "bug",
  "defeito",
  "caso de teste",
  "plano",
  "run",
  "automacao",
  "automação",
  "reprovar",
  "aprovar",
];

function emptyStore(): ConversationBrainFeedStore {
  return { signals: [] };
}

function sanitizeText(value: unknown, max = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function normalizeNullable(value: unknown, max = 160) {
  const text = sanitizeText(value, max);
  return text || null;
}

function buildSummary(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "Mensagem sem texto";
  return compact.length > 220 ? `${compact.slice(0, 217)}...` : compact;
}

function isMemoryCandidate(text: string) {
  const normalized = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (normalized.length >= 180) return true;
  return MEMORY_KEYWORDS.some((keyword) => normalized.includes(keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
}

async function readStore(): Promise<ConversationBrainFeedStore> {
  try {
    const redis = getRedis();
    const raw = await redis.get<string>(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<ConversationBrainFeedStore> | null;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.signals)) return emptyStore();
    return {
      signals: parsed.signals
        .map((item) => normalizeSignal(item))
        .filter((item): item is ConversationBrainSignal => Boolean(item))
        .slice(-MAX_SIGNALS),
    };
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: ConversationBrainFeedStore) {
  const redis = getRedis();
  await redis.set(STORE_KEY, JSON.stringify({ signals: store.signals.slice(-MAX_SIGNALS) }));
}

function normalizeSignal(input: Partial<ConversationBrainSignal> | null | undefined): ConversationBrainSignal | null {
  const messageId = sanitizeText(input?.messageId, 120);
  const threadKey = sanitizeText(input?.threadKey, 240);
  const text = sanitizeText(input?.text);
  const actorId = sanitizeText(input?.actorId, 120);
  const peerId = sanitizeText(input?.peerId, 120);
  if (!messageId || !threadKey || !actorId || !peerId) return null;

  const status = input?.status === "approved" || input?.status === "ignored" ? input.status : "candidate";
  return {
    id: sanitizeText(input?.id, 120) || randomUUID(),
    messageId,
    threadKey,
    text,
    summary: sanitizeText(input?.summary, 260) || buildSummary(text),
    status,
    reason: sanitizeText(input?.reason, 220) || "Mensagem relevante para memoria do Brain.",
    createdAt: sanitizeText(input?.createdAt, 80) || new Date().toISOString(),
    actorId,
    actorName: sanitizeText(input?.actorName, 180) || "Usuario",
    peerId,
    peerName: sanitizeText(input?.peerName, 180) || "Usuario",
    companyId: normalizeNullable(input?.companyId),
    companySlug: normalizeNullable(input?.companySlug),
    companyName: normalizeNullable(input?.companyName),
    projectId: normalizeNullable(input?.projectId),
    projectSlug: normalizeNullable(input?.projectSlug),
    profileKind: normalizeNullable(input?.profileKind),
    sourceType: "chat_message",
  };
}

export async function recordConversationBrainSignal(input: {
  messageId: string;
  threadKey: string;
  text: string;
  actorId: string;
  actorName: string;
  peerId: string;
  peerName: string;
  companyId?: string | null;
  companySlug?: string | null;
  companyName?: string | null;
  projectId?: string | null;
  projectSlug?: string | null;
  profileKind?: string | null;
  forceCandidate?: boolean;
}) {
  const text = sanitizeText(input.text);
  if (!input.forceCandidate && !isMemoryCandidate(text)) return null;

  const signal = normalizeSignal({
    id: randomUUID(),
    messageId: input.messageId,
    threadKey: input.threadKey,
    text,
    summary: buildSummary(text),
    status: "candidate",
    reason: input.forceCandidate ? "Registrado manualmente como candidato de memoria." : "Mensagem possui sinal de decisao, regra, bug, plano, run ou pendencia.",
    createdAt: new Date().toISOString(),
    actorId: input.actorId,
    actorName: input.actorName,
    peerId: input.peerId,
    peerName: input.peerName,
    companyId: input.companyId ?? null,
    companySlug: input.companySlug ?? null,
    companyName: input.companyName ?? null,
    projectId: input.projectId ?? null,
    projectSlug: input.projectSlug ?? null,
    profileKind: input.profileKind ?? null,
    sourceType: "chat_message",
  });
  if (!signal) return null;

  const store = await readStore();
  store.signals = [signal, ...store.signals.filter((item) => item.messageId !== signal.messageId)].slice(0, MAX_SIGNALS);
  await writeStore(store);
  return signal;
}

export async function listConversationBrainSignals(options: {
  companySlug?: string | null;
  companyId?: string | null;
  projectSlug?: string | null;
  projectId?: string | null;
  status?: ConversationBrainSignalStatus | null;
  limit?: number;
} = {}) {
  const store = await readStore();
  const limit = Math.min(Math.max(options.limit ?? 80, 1), 200);
  return store.signals
    .filter((signal) => {
      if (options.status && signal.status !== options.status) return false;
      if (options.companySlug && signal.companySlug !== options.companySlug) return false;
      if (options.companyId && signal.companyId !== options.companyId) return false;
      if (options.projectSlug && signal.projectSlug !== options.projectSlug) return false;
      if (options.projectId && signal.projectId !== options.projectId) return false;
      return true;
    })
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1))
    .slice(0, limit);
}

export async function getConversationBrainFeedSummary() {
  const store = await readStore();
  const byStatus = store.signals.reduce<Record<string, number>>((acc, signal) => {
    acc[signal.status] = (acc[signal.status] ?? 0) + 1;
    return acc;
  }, {});
  const companies = new Set(store.signals.map((signal) => signal.companySlug ?? signal.companyId ?? signal.companyName).filter(Boolean));
  const projects = new Set(store.signals.map((signal) => signal.projectSlug ?? signal.projectId).filter(Boolean));
  return {
    total: store.signals.length,
    candidates: byStatus.candidate ?? 0,
    approved: byStatus.approved ?? 0,
    ignored: byStatus.ignored ?? 0,
    companies: companies.size,
    projects: projects.size,
  };
}

