import { NextRequest, NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { listChatContacts } from "@/lib/chatContacts";

export const runtime = "nodejs";
export const revalidate = 0;

const CHAT_CONTACTS_CACHE_HEADERS = {
  "Cache-Control": "private, max-age=60, stale-while-revalidate=30",
  "x-qc-cache-mode": "client-short",
};

export async function GET(req: NextRequest) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? "";
  const items = await listChatContacts(access, search);

  return NextResponse.json({ items }, { headers: CHAT_CONTACTS_CACHE_HEADERS });
}
