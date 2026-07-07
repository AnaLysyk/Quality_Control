import { NextRequest, NextResponse } from "next/server";

import { listChatContacts } from "@/lib/chatContacts";
import { resolveOperationalContext } from "@/lib/context/operationalContext";

export const runtime = "nodejs";
export const revalidate = 0;

const CHAT_CONTACTS_CACHE_HEADERS = {
  "Cache-Control": "private, max-age=60, stale-while-revalidate=30",
  "x-qc-cache-mode": "client-short",
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? "";
  const companySlug = url.searchParams.get("companySlug") ?? url.searchParams.get("company") ?? null;
  const projectSlug = url.searchParams.get("projectSlug") ?? url.searchParams.get("project") ?? null;
  const contextResult = await resolveOperationalContext(req, {
    moduleId: "chat",
    action: "view",
    companySlug,
    projectSlug,
  });
  if (!contextResult.ok) return contextResult.response;

  const items = await listChatContacts(contextResult.context.access, search, {
    companySlug: contextResult.context.selectedCompanySlug,
  });

  return NextResponse.json({ items }, { headers: CHAT_CONTACTS_CACHE_HEADERS });
}
