import { NextRequest, NextResponse } from "next/server";

import { getAccessContext } from "@/backend/auth/session";
import { getConversationBrainFeedSummary, listConversationBrainSignals } from "@/backend/conversationBrainFeed";
import { getUnifiedConversationModel } from "@/data/unifiedConversationModel";
import { NO_STORE_HEADERS } from "@/backend/http/noStore";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.trim() || null;
  const limit = Number(url.searchParams.get("limit") ?? 80);
  const companySlug = url.searchParams.get("companySlug")?.trim() || null;
  const companyId = url.searchParams.get("companyId")?.trim() || null;
  const projectSlug = url.searchParams.get("projectSlug")?.trim() || null;
  const projectId = url.searchParams.get("projectId")?.trim() || null;

  const [signals, summary] = await Promise.all([
    listConversationBrainSignals({
      status: status === "approved" || status === "ignored" || status === "candidate" ? status : null,
      limit: Number.isFinite(limit) ? limit : 80,
      companySlug,
      companyId,
      projectSlug,
      projectId,
    }),
    getConversationBrainFeedSummary(),
  ]);

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      summary,
      signals,
      model: getUnifiedConversationModel(),
    },
    { headers: NO_STORE_HEADERS },
  );
}

