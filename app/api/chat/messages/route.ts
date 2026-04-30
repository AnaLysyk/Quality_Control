import { NextRequest, NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { getLocalUserById } from "@/lib/auth/localStore";
import { listChatContacts } from "@/lib/chatContacts";
import {
  appendChatMessage,
  listChatInboxSummaries,
  listChatThreadMessages,
} from "@/lib/chatStore";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";

export const runtime = "nodejs";
export const revalidate = 0;

function readPeerId(url: URL) {
  return (url.searchParams.get("peerId") ?? url.searchParams.get("peer_id") ?? "").trim();
}

export async function GET(req: NextRequest) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const peerId = readPeerId(url);
  if (!peerId) {
    const threads = await listChatInboxSummaries(access.userId);
    return NextResponse.json({ threads }, { headers: NO_STORE_HEADERS });
  }

  if (peerId === access.userId) {
    return NextResponse.json({ error: "Escolha outro usuário para conversar" }, { status: 400 });
  }

  const [contacts, peerUser] = await Promise.all([
    listChatContacts(access),
    getLocalUserById(peerId),
  ]);
  const peerContact = contacts.find((item) => item.id === peerId) ?? null;
  if (!peerUser || !peerContact) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
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
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const peerId = typeof body?.peerId === "string" ? body.peerId.trim() : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!peerId) {
    return NextResponse.json({ error: "peerId obrigatório" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "Mensagem obrigatória" }, { status: 400 });
  }
  if (peerId === access.userId) {
    return NextResponse.json({ error: "Escolha outro usuário para conversar" }, { status: 400 });
  }

  const [sender, contacts, peerUser] = await Promise.all([
    getLocalUserById(access.userId),
    listChatContacts(access),
    getLocalUserById(peerId),
  ]);

  const peerContact = contacts.find((item) => item.id === peerId) ?? null;
  if (!sender || !peerUser || !peerContact) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
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
  });

  return NextResponse.json(
    {
      ok: true,
      message,
    },
    { headers: NO_STORE_HEADERS },
  );
}
