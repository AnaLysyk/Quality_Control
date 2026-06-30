import { NextRequest, NextResponse } from "next/server";

import { getNotificationOperationModel } from "@/data/notificationOperationModel";
import { getNotificationPreferenceSummary, listNotificationPreferences, upsertNotificationPreference } from "@/lib/notificationPreferencesStore";
import { authenticateRequest } from "@/lib/jwtAuth";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  const [preferences, preferenceSummary] = await Promise.all([
    listNotificationPreferences(),
    getNotificationPreferenceSummary(),
  ]);

  return NextResponse.json(
    {
      ...getNotificationOperationModel(),
      preferences,
      preferenceSummary,
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
