
import { NextRequest, NextResponse } from "next/server";

import { getAccessContext } from "@/backend/auth/session";
import { touchChatPresence } from "@/backend/chatPresenceStore";
import { NO_STORE_HEADERS } from "@/backend/http/noStore";

export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const access = await getAccessContext(req);

  if (!access) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const presence = await touchChatPresence({
    userId: access.userId,
    path: url.searchParams.get("path"),
  });

  return NextResponse.json({ ok: true, presence }, { headers: NO_STORE_HEADERS });
}
