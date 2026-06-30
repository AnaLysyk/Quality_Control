import { NextRequest, NextResponse } from "next/server";

import { getNotificationOperationModel } from "@/data/notificationOperationModel";
import { getNotificationEventsSummary, listNotificationEvents } from "@/lib/notificationEventsStore";
import { getNotificationPreferenceSummary, listNotificationPreferences, upsertNotificationPreference } from "@/lib/notificationPreferencesStore";
import { authenticateRequest } from "@/lib/jwtAuth";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companySlug = url.searchParams.get("companySlug")?.trim() || null;
  const projectSlug = url.searchParams.get("projectSlug")?.trim() || null;
  const sourceType = url.searchParams.get("sourceType")?.trim() || null;
  const limit = Number(url.searchParams.get("limit") ?? 50);

  const [preferences, preferenceSummary, notificationEvents, notificationEventsSummary] = await Promise.all([
    listNotificationPreferences(),
    getNotificationPreferenceSummary(),
    listNotificationEvents({
      companySlug,
      projectSlug,
      sourceType: sourceType === "release_calendar" || sourceType === "chat" || sourceType === "qa_operation" || sourceType === "manual" ? sourceType : null,
      limit: Number.isFinite(limit) ? limit : 50,
    }),
    getNotificationEventsSummary(),
  ]);

  return NextResponse.json(
    {
      ...getNotificationOperationModel(),
      preferences,
      preferenceSummary,
      notificationEvents,
      notificationEventsSummary,
    },
    { headers: NO_STORE_HEADERS },
  );
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const preference = await upsertNotificationPreference({
    target: body?.target,
    targetId: body?.targetId,
    workflowId: body?.workflowId,
    channel: body?.channel,
    decision: body?.decision,
    updatedBy: user.id,
  });

  return NextResponse.json({ preference }, { status: 201, headers: NO_STORE_HEADERS });
}
