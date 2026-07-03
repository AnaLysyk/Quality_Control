
import { NextRequest, NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { clearTyping, getTypingForUser, touchTyping } from "@/lib/chatTypingStore";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const access = await getAccessContext(req);

  if (!access) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const peerId = new URL(req.url).searchParams.get("peerId")?.trim();

  if (!peerId) {
    return NextResponse.json({ typing: null }, { headers: NO_STORE_HEADERS });
  }

  return NextResponse.json(
    { typing: getTypingForUser({ viewerUserId: access.userId, peerId }) },
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
  const peerId = typeof payload.peerId === "string" ? payload.peerId.trim() : "";
  const active = payload.active === true;

  if (!peerId) {
    return NextResponse.json({ error: "peerId obrigatorio" }, { status: 400 });
  }

  if (active) {
    touchTyping({
      fromUserId: access.userId,
      toUserId: peerId,
      fromName: access.email || access.userId || "Usuário",
    });
  } else {
    clearTyping({
      fromUserId: access.userId,
      toUserId: peerId,
    });
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
