import { NextRequest, NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { getLocalUserById } from "@/lib/auth/localStore";
import { listChatContacts } from "@/lib/chatContacts";
import {
  appendChatMessage,
  listChatInboxSummaries,
  listChatThreadMessages,
  type ChatAttachment,
} from "@/lib/chatStore";
import { recordConversationBrainSignal } from "@/lib/conversationBrainFeed";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";

export const runtime = "nodejs";
export const revalidate = 0;

function readPeerId(url: URL) {
  return (url.searchParams.get("peerId") ?? url.searchParams.get("peer_id") ?? "").trim();
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
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const peerId = readPeerId(url);
  if (!peerId) {
    const threads = await listChatInboxSummaries(access.userId);
    return NextResponse.json({ threads }, { headers: NO_STORE_HEADERS });
  }

  if (peerId === access.userId) {
    return NextResponse.json({ error: "Escolha outro usuario para conversar" }, { status: 400 });
  }

  const [contacts, peerUser] = await Promise.all([
    listChatContacts(access),
    getLocalUserById(peerId),
  ]);
  const peerContact = contacts.find((item) => item.id === peerId) ?? null;
  if (!peerUser || !peerContact) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  const messages = await listChatThreadMessages(access.userId, peerId);
  return NextResponse.json(
    {
      peer: peerContact,
      messages,
    },
    { headers: NO_STORE_HEADERS },
  );
}

export async function POST(req: NextRequest) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const peerId = readOptionalString(payload, "peerId") ?? "";
  const text = readOptionalString(payload, "text") ?? "";
  const attachments = Array.isArray(payload.attachments) ? (payload.attachments as ChatAttachment[]) : [];
  const projectId = readOptionalString(payload, "projectId");
  const projectSlug = readOptionalString(payload, "projectSlug");
  const forceBrainCandidate = payload.remember === true || payload.feedBrain === true;

  if (!peerId) {
    return NextResponse.json({ error: "peerId obrigatorio" }, { status: 400 });
  }
  if (!text && attachments.length === 0) {
    return NextResponse.json({ error: "Mensagem ou anexo obrigatorio" }, { status: 400 });
  }
  if (peerId === access.userId) {
    return NextResponse.json({ error: "Escolha outro usuario para conversar" }, { status: 400 });
  }

  const [sender, contacts, peerUser] = await Promise.all([
    getLocalUserById(access.userId),
    listChatContacts(access),
    getLocalUserById(peerId),
  ]);

  const peerContact = contacts.find((item) => item.id === peerId) ?? null;
  if (!sender || !peerUser || !peerContact) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
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
    companyId: firstNonEmpty(readOptionalString(payload, "companyId"), readOptionalString(accessRecord, "companyId")),
    companySlug: firstNonEmpty(readOptionalString(payload, "companySlug"), readOptionalString(accessRecord, "companySlug")),
    companyName,
    projectId,
    projectSlug,
    profileKind: peerContact.profile_kind ?? peerContact.permission_role ?? null,
    forceCandidate: forceBrainCandidate,
  });

  return NextResponse.json(
    {
      ok: true,
      message,
      brainSignal,
    },
    { headers: NO_STORE_HEADERS },
  );
}

