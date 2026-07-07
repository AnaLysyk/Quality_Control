import { NextRequest, NextResponse } from "next/server";

import { getLocalUserById } from "@/lib/auth/localStore";
import { listChatContacts } from "@/lib/chatContacts";
import {
  appendChatMessage,
  listChatInboxSummaries,
  listChatThreadMessages,
  type ChatAttachment,
} from "@/lib/chatStore";
import { recordConversationBrainSignal } from "@/lib/conversationBrainFeed";
import { resolveOperationalContext } from "@/lib/context/operationalContext";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";
import { fixMojibake, fixMojibakeDeep } from "@/lib/text/fixMojibake";

export const runtime = "nodejs";
export const revalidate = 0;

const CHAT_MESSAGES_CACHE_TTL_MS = 8_000;

type ChatMessagesCacheEntry = {
  expiresAt: number;
  payload: unknown;
};

type ChatMessagesGlobalState = typeof globalThis & {
  __qcChatMessagesCache?: Map<string, ChatMessagesCacheEntry>;
};

function getChatMessagesCache() {
  const state = globalThis as ChatMessagesGlobalState;
  if (!state.__qcChatMessagesCache) {
    state.__qcChatMessagesCache = new Map();
  }
  return state.__qcChatMessagesCache;
}

function readChatMessagesCache<T>(key: string): T | null {
  const cached = getChatMessagesCache().get(key);
  if (!cached || cached.expiresAt <= Date.now()) return null;
  return cached.payload as T;
}

function writeChatMessagesCache(key: string, payload: unknown) {
  getChatMessagesCache().set(key, {
    payload,
    expiresAt: Date.now() + CHAT_MESSAGES_CACHE_TTL_MS,
  });
}

function clearChatMessagesCache() {
  getChatMessagesCache().clear();
}

function readPeerId(url: URL) {
  return (url.searchParams.get("peerId") ?? url.searchParams.get("peer_id") ?? "").trim();
}

function readCompanySlug(url: URL) {
  return (url.searchParams.get("companySlug") ?? url.searchParams.get("company") ?? "").trim() || null;
}

function readOptionalString(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const peerId = readPeerId(url);
  const companySlug = readCompanySlug(url);
  const contextResult = await resolveOperationalContext(req, {
    moduleId: "chat",
    action: "view",
    companySlug,
  });
  if (!contextResult.ok) return contextResult.response;
  const access = contextResult.context.access;
  const cacheKey = `${access.userId}:${companySlug ?? "all"}:${peerId || "threads"}`;
  const cached = readChatMessagesCache<Record<string, unknown>>(cacheKey);
  if (cached) {
    return NextResponse.json(fixMojibakeDeep(cached), {
      headers: { ...NO_STORE_HEADERS, "x-qc-cache": "hit" },
    });
  }

  if (!peerId) {
    const threads = await listChatInboxSummaries(access.userId);
    const payload = fixMojibakeDeep({ threads });
    writeChatMessagesCache(cacheKey, payload);
    return NextResponse.json(payload, { headers: { ...NO_STORE_HEADERS, "x-qc-cache": "miss" } });
  }

  if (peerId === access.userId) {
    return NextResponse.json({ error: "Escolha outro usuário para conversar" }, { status: 400 });
  }

  const [contacts, peerUser] = await Promise.all([
    listChatContacts(access, "", { companySlug }),
    getLocalUserById(peerId),
  ]);
  const peerContact = contacts.find((item) => item.id === peerId) ?? null;
  if (!peerUser || !peerContact) {
    return NextResponse.json({ error: "Usuário não encontrado neste contexto de empresa" }, { status: 404 });
  }

  const messages = await listChatThreadMessages(access.userId, peerId);
  const payload = fixMojibakeDeep({
    peer: peerContact,
    messages,
  });
  writeChatMessagesCache(cacheKey, payload);
  return NextResponse.json(payload, { headers: { ...NO_STORE_HEADERS, "x-qc-cache": "miss" } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const peerId = readOptionalString(payload, "peerId") ?? "";
  const text = fixMojibake(readOptionalString(payload, "text") ?? "");
  const attachments = fixMojibakeDeep(
    Array.isArray(payload.attachments) ? (payload.attachments as ChatAttachment[]) : [],
  );
  const companySlug = readOptionalString(payload, "companySlug") ?? null;
  const companyId = readOptionalString(payload, "companyId");
  const projectId = readOptionalString(payload, "projectId");
  const projectSlug = readOptionalString(payload, "projectSlug");
  const forceBrainCandidate = payload.remember === true || payload.feedBrain === true;

  const contextResult = await resolveOperationalContext(req, {
    moduleId: "chat",
    action: "use",
    companyId,
    companySlug,
    projectSlug,
  });
  if (!contextResult.ok) return contextResult.response;
  const access = contextResult.context.access;
  const activeCompanySlug = companySlug ?? contextResult.context.companySlug;

  if (!peerId) {
    return NextResponse.json({ error: "peerId obrigatório" }, { status: 400 });
  }
  if (!text && attachments.length === 0) {
    return NextResponse.json({ error: "Mensagem ou anexo obrigatório" }, { status: 400 });
  }
  if (peerId === access.userId) {
    return NextResponse.json({ error: "Escolha outro usuário para conversar" }, { status: 400 });
  }

  const [sender, contacts, peerUser] = await Promise.all([
    getLocalUserById(access.userId),
    listChatContacts(access, "", { companySlug: activeCompanySlug }),
    getLocalUserById(peerId),
  ]);

  const peerContact = contacts.find((item) => item.id === peerId) ?? null;
  if (!sender || !peerUser || !peerContact) {
    return NextResponse.json({ error: "Usuário não encontrado neste contexto de empresa" }, { status: 404 });
  }

  const message = await appendChatMessage({
    sender: {
      id: sender.id,
      name:
        (typeof sender.full_name === "string" && sender.full_name.trim()) ||
        (typeof sender.name === "string" && sender.name.trim()) ||
        sender.email,
      handle: sender.user ?? sender.email,
      avatarUrl: sender.avatar_url ?? null,
    },
    recipient: {
      id: peerContact.id,
      name: peerContact.name,
      handle: peerContact.user,
      avatarUrl: peerContact.avatar_url,
    },
    text,
    attachments,
  });

  clearChatMessagesCache();

  const accessRecord = access as unknown as Record<string, unknown>;
  const companyName = firstNonEmpty(
    readOptionalString(payload, "companyName"),
    peerContact.company_name,
    Array.isArray(peerContact.company_names) ? peerContact.company_names[0] : null,
  );

  const brainSignal = await recordConversationBrainSignal({
    messageId: message.id,
    threadKey: message.threadKey,
    text: message.text,
    actorId: sender.id,
    actorName: message.senderName,
    peerId: peerContact.id,
    peerName: peerContact.name,
    companyId: firstNonEmpty(companyId, readOptionalString(accessRecord, "companyId")),
    companySlug: firstNonEmpty(activeCompanySlug, readOptionalString(accessRecord, "companySlug")),
    companyName,
    projectId,
    projectSlug,
    profileKind: peerContact.profile_kind ?? peerContact.permission_role ?? null,
    forceCandidate: forceBrainCandidate,
  });

  return NextResponse.json(
    {
      ok: true,
      message: fixMojibakeDeep(message),
      brainSignal: fixMojibakeDeep(brainSignal),
    },
    { headers: NO_STORE_HEADERS },
  );
}
