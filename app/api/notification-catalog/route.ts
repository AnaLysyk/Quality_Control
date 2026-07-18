import { NextResponse } from "next/server";

import { getExtendedNotificationOperationModel } from "@/backend/notificationWorkflowCatalog";
import { NO_STORE_HEADERS } from "@/backend/http/noStore";
import { resolveOperationalContext } from "@/backend/context/operationalContext";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const contextResult = await resolveOperationalContext(request, {
    moduleId: "notifications",
    action: "view",
  });
  if (!contextResult.ok) return contextResult.response;

  const model = getExtendedNotificationOperationModel();
  return NextResponse.json({ workflows: model.workflows, summary: model.summary }, { headers: NO_STORE_HEADERS });
}
