import { NextResponse } from "next/server";

import { getExtendedNotificationOperationModel } from "@/backend/notificationWorkflowCatalog";
import { NO_STORE_HEADERS } from "@/backend/http/noStore";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  const model = getExtendedNotificationOperationModel();
  return NextResponse.json({ workflows: model.workflows, summary: model.summary }, { headers: NO_STORE_HEADERS });
}

