import { NextRequest, NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { listChatContacts } from "@/lib/chatContacts";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? "";
  const items = await listChatContacts(access, search);

  return NextResponse.json({ items }, { headers: NO_STORE_HEADERS });
}
