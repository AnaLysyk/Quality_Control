import "server-only";

import { randomUUID } from "crypto";

import { getRedis } from "@/backend/redis";

export type ChatPersonSnapshot = {
  id: string;
  name: string;
  handle?: string | null;
  avatarUrl?: string | null;
};

export type ChatContextScope = {
  companyId?: string | null;
  companySlug?: string | null;
  projectId?: string | null;
  projectSlug?: string | null;
};

export type ChatAttachment = {
  id: string;
  kind: "file" | "link" | "note" | "system";
  label: string;
  url: string | null;
  mimeType: string | null;
  sizeLabel: string | null;
  sourceLabel: string | null;
};

export type ChatMessage = {
  id: string;
  threadKey: string;
  senderId: string;
  senderName: string;
  senderHandle: string | null;
  senderAvatarUrl: string | null;
  recipientId: string;
  recipientName: string;
  recipientHandle: string | null;
  recipientAvatarUrl: string | null;
  text: string;
  attachments?: ChatAttachment[];
  createdAt: string;
  companyId?: string | null;
  companySlug?: string | null;
  projectId?: string | null;
  projectSlug?: string | null;
};

type ChatThread = ChatContextScope & {
  key: string;
  participantIds: [string, string];
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

type ChatStore = {
  threads: Record<string, ChatThread>;
};

export type ChatThreadSummary = ChatContextScope & {
  key: string;
  peerId: string;
  peerName: string;
  peerHandle: string | null;
  peerAvatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string;
  lastSenderName: string;
  messageCount: number;
};

const STORE_KEY = "qc:chat_threads:v1";
const MAX_MESSAGES_PER_THREAD = 150;

function emptyStore(): ChatStore {
  return { threads: {} };
}

function normalizeScopeValue(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

function normalizeScope(input?: ChatContextScope | null): Required<ChatContextScope> {
  return {
    companyId: normalizeScopeValue(input?.companyId),
    companySlug: normalizeScopeValue(input?.companySlug),
    projectId: normalizeScopeValue(input?.projectId),
    projectSlug: normalizeScopeValue(input?.projectSlug),
  };
}

function scopeMatches(candidate: ChatContextScope | null | undefined, filter?: ChatContextScope | null) {
  const normalizedFilter = normalizeScope(filter);
  if (!normalizedFilter.companyId && !normalizedFilter.companySlug && !normalizedFilter.projectId && !normalizedFilter.projectSlug) return true;

  const normalizedCandidate = normalizeScope(candidate);
  if (normalizedFilter.companyId && normalizedCandidate.companyId !== normalizedFilter.companyId) return false;
  if (normalizedFilter.companySlug && normalizedCandidate.companySlug !== normalizedFilter.companySlug) return false;
  if (normalizedFilter.projectId && normalizedCandidate.projectId !== normalizedFilter.projectId) return false;
  if (normalizedFilter.projectSlug && normalizedCandidate.projectSlug !== normalizedFilter.projectSlug) return false;
  return true;
}

function scopeKey(scope?: ChatContextScope | null) {
  const normalized = normalizeScope(scope);
  const parts = [
    normalized.companySlug ? `cs:${normalized.companySlug}` : normalized.companyId ? `ci:${normalized.companyId}` : "c:all",
    normalized.projectSlug ? `ps:${normalized.projectSlug}` : normalized.projectId ? `pi:${normalized.projectId}` : "p:all",
  ];
  return parts.join("::");
}

function sanitizeText(value: unknown, max = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function sanitizeAttachment(input: Partial<ChatAttachment> | null | undefined): ChatAttachment | null {
  const kind =
    input?.kind === "file" || input?.kind === "link" || input?.kind === "note" || input?.kind === "system"
      ? input.kind
      : null;
  const label = typeof input?.label === "string" ? input.label.trim().slice(0, 180) : "";
  if (!kind || !label) return null;

  return {
    id: typeof input?.id === "string" && input.id.trim() ? input.id.trim() : randomUUID(),
    kind,
    label,
    url: typeof input?.url === "string" && input.url.trim() ? input.url.trim().slice(0, 1200) : null,
    mimeType: typeof input?.mimeType === "string" && input.mimeType.trim() ? input.mimeType.trim().slice(0, 120) : null,
    sizeLabel: typeof input?.sizeLabel === "string" && input.sizeLabel.trim() ? input.sizeLabel.trim().slice(0, 80) : null,
    sourceLabel: typeof input?.sourceLabel === "string" && input.sourceLabel.trim() ? input.sourceLabel.trim().slice(0, 120) : null,
  };
}

function sanitizeAttachments(input: unknown, max = 8) {
  if (!Array.isArray(input)) return [];
  return input
    .map((attachment) => sanitizeAttachment(attachment))
    .filter((attachment): attachment is ChatAttachment => Boolean(attachment))
    .slice(0, max);
}

function normalizeSnapshot(input: ChatPersonSnapshot | null | undefined): Required<ChatPersonSnapshot> {
  return {
    id: typeof input?.id === "string" ? input.id.trim() : "",
    name: typeof input?.name === "string" && input.name.trim() ? input.name.trim() : "Usuario",
    handle: typeof input?.handle === "string" && input.handle.trim() ? input.handle.trim() : null,
    avatarUrl: typeof input?.avatarUrl === "string" && input.avatarUrl.trim() ? input.avatarUrl.trim() : null,
  };
}

function threadKeyFor(a: string, b: string, scope?: ChatContextScope | null) {
  const participants = [a.trim(), b.trim()].filter(Boolean).sort((left, right) => left.localeCompare(right)).join("::");
  const key = scopeKey(scope);
  return key === "c:all::p:all" ? participants : `${participants}::${key}`;
}

function normalizeMessage(input: Partial<ChatMessage> | null | undefined): ChatMessage | null {
  const senderId = typeof input?.senderId === "string" ? input.senderId.trim() : "";
  const recipientId = typeof input?.recipientId === "string" ? input.recipientId.trim() : "";
  const text = sanitizeText(input?.text, 4000);
  const attachments = sanitizeAttachments(input?.attachments);
  if (!senderId || !recipientId || (!text && attachments.length === 0)) return null;

  return {
    id: typeof input?.id === "string" && input.id.trim() ? input.id.trim() : randomUUID(),
    threadKey:
      typeof input?.threadKey === "string" && input.threadKey.trim()
        ? input.threadKey.trim()
        : threadKeyFor(senderId, recipientId, input),
    senderId,
    senderName: typeof input?.senderName === "string" && input.senderName.trim() ? input.senderName.trim() : "Usuario",
    senderHandle: typeof input?.senderHandle === "string" && input.senderHandle.trim() ? input.senderHandle.trim() : null,
    senderAvatarUrl: typeof input?.senderAvatarUrl === "string" && input.senderAvatarUrl.trim() ? input.senderAvatarUrl.trim() : null,
    recipientId,
    recipientName:
      typeof input?.recipientName === "string" && input.recipientName.trim() ? input.recipientName.trim() : "Usuario",
    recipientHandle:
      typeof input?.recipientHandle === "string" && input.recipientHandle.trim() ? input.recipientHandle.trim() : null,
    recipientAvatarUrl:
      typeof input?.recipientAvatarUrl === "string" && input.recipientAvatarUrl.trim() ? input.recipientAvatarUrl.trim() : null,
    text,
    attachments: attachments.length > 0 ? attachments : [],
    createdAt: typeof input?.createdAt === "string" && input.createdAt.trim() ? input.createdAt.trim() : new Date().toISOString(),
    ...normalizeScope(input),
  };
}

function normalizeThread(input: Partial<ChatThread> | null | undefined): ChatThread | null {
  const key = typeof input?.key === "string" ? input.key.trim() : "";
  const participantIds = Array.isArray(input?.participantIds)
    ? input.participantIds
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim())
        .slice(0, 2)
    : [];
  if (!key || participantIds.length !== 2) return null;

  const scope = normalizeScope(input);
  const messages = Array.isArray(input?.messages)
    ? input.messages
        .map((message) => normalizeMessage({ ...message, ...scope }))
        .filter((message): message is ChatMessage => Boolean(message))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    : [];

  const createdAt =
    typeof input?.createdAt === "string" && input.createdAt.trim()
      ? input.createdAt.trim()
      : messages[0]?.createdAt ?? new Date().toISOString();
  const updatedAt =
    typeof input?.updatedAt === "string" && input.updatedAt.trim()
      ? input.updatedAt.trim()
      : messages[messages.length - 1]?.createdAt ?? createdAt;

  return {
    key,
    participantIds: [participantIds[0], participantIds[1]],
    createdAt,
    updatedAt,
    messages,
    ...scope,
  };
}

async function readStore(): Promise<ChatStore> {
  try {
    const redis = getRedis();
    const raw = await redis.get<string>(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<ChatStore> | null;
    if (!parsed || typeof parsed !== "object") return emptyStore();

    const threads: Record<string, ChatThread> = {};
    const sourceThreads = parsed.threads && typeof parsed.threads === "object" ? parsed.threads : {};
    for (const [key, value] of Object.entries(sourceThreads)) {
      const thread = normalizeThread({ ...(value as Partial<ChatThread>), key });
      if (thread) threads[key] = thread;
    }
    return { threads };
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: ChatStore) {
  const redis = getRedis();
  await redis.set(STORE_KEY, JSON.stringify(store));
}

function buildMessagePreview(message: Pick<ChatMessage, "text" | "attachments">) {
  const text = sanitizeText(message.text, 220);
  if (text) return text;

  const attachments = sanitizeAttachments(message.attachments);
  if (attachments.length === 0) return "Nova mensagem";
  if (attachments.length === 1) return `Anexo: ${attachments[0].label}`;
  return `${attachments.length} anexos compartilhados`;
}

function buildSummaryForUser(userId: string, thread: ChatThread): ChatThreadSummary | null {
  if (!thread.participantIds.includes(userId)) return null;
  const lastMessage = thread.messages[thread.messages.length - 1];
  if (!lastMessage) return null;

  const peerId = thread.participantIds.find((participantId) => participantId !== userId) ?? thread.participantIds[0] ?? userId;
  const peerName = lastMessage.senderId === peerId ? lastMessage.senderName : lastMessage.recipientName;
  const peerHandle = lastMessage.senderId === peerId ? lastMessage.senderHandle : lastMessage.recipientHandle;
  const peerAvatarUrl = lastMessage.senderId === peerId ? lastMessage.senderAvatarUrl : lastMessage.recipientAvatarUrl;

  return {
    key: thread.key,
    peerId,
    peerName,
    peerHandle,
    peerAvatarUrl,
    lastMessage: buildMessagePreview(lastMessage),
    lastMessageAt: lastMessage.createdAt,
    lastSenderId: lastMessage.senderId,
    lastSenderName: lastMessage.senderName,
    messageCount: thread.messages.length,
    companyId: thread.companyId,
    companySlug: thread.companySlug,
    projectId: thread.projectId,
    projectSlug: thread.projectSlug,
  };
}

export function makeChatThreadKey(userAId: string, userBId: string, scope?: ChatContextScope | null) {
  return threadKeyFor(userAId, userBId, scope);
}

export async function listChatThreadMessages(userId: string, peerId: string, scope?: ChatContextScope | null) {
  const store = await readStore();
  const thread = store.threads[threadKeyFor(userId, peerId, scope)] ?? null;
  if (!thread) return [];
  if (!scopeMatches(thread, scope)) return [];
  return [...thread.messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function listChatInboxSummaries(userId: string, scope?: ChatContextScope | null) {
  const store = await readStore();
  return Object.values(store.threads)
    .filter((thread) => scopeMatches(thread, scope))
    .map((thread) => buildSummaryForUser(userId, thread))
    .filter((thread): thread is ChatThreadSummary => Boolean(thread))
    .sort((left, right) => (left.lastMessageAt < right.lastMessageAt ? 1 : -1));
}

export async function appendChatMessage(input: {
  sender: ChatPersonSnapshot;
  recipient: ChatPersonSnapshot;
  text: string;
  attachments?: ChatAttachment[];
} & ChatContextScope) {
  const sender = normalizeSnapshot(input.sender);
  const recipient = normalizeSnapshot(input.recipient);
  const text = sanitizeText(input.text);
  const attachments = sanitizeAttachments(input.attachments);
  const scope = normalizeScope(input);
  if (!sender.id || !recipient.id || (!text && attachments.length === 0)) {
    throw new Error("Mensagem invalida");
  }

  const now = new Date().toISOString();
  const store = await readStore();
  const key = threadKeyFor(sender.id, recipient.id, scope);
  const current = store.threads[key] ?? {
    key,
    participantIds: [sender.id, recipient.id],
    createdAt: now,
    updatedAt: now,
    messages: [],
    ...scope,
  };

  const message: ChatMessage = {
    id: randomUUID(),
    threadKey: key,
    senderId: sender.id,
    senderName: sender.name,
    senderHandle: sender.handle,
    senderAvatarUrl: sender.avatarUrl,
    recipientId: recipient.id,
    recipientName: recipient.name,
    recipientHandle: recipient.handle,
    recipientAvatarUrl: recipient.avatarUrl,
    text,
    attachments,
    createdAt: now,
    ...scope,
  };

  current.messages.push(message);
  if (current.messages.length > MAX_MESSAGES_PER_THREAD) {
    current.messages = current.messages.slice(-MAX_MESSAGES_PER_THREAD);
  }
  current.updatedAt = now;
  store.threads[key] = current;
  await writeStore(store);
  return message;
}

export async function clearChatStore() {
  const redis = getRedis();
  await redis.del(STORE_KEY);
}
