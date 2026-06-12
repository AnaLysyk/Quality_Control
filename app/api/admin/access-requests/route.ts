import { NextRequest, NextResponse } from "next/server";

import { listAllRequests } from "@/data/requestsStore";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";
import { mapPasswordResetRequestToAccessQueueItem } from "@/lib/passwordResetAccessQueue";
import { requireAccessRequestReviewerWithStatus } from "@/lib/rbac/requireAccessRequestReviewer";
import { listAccessRequestsV2 } from "@/lib/accessRequestsV2/repository";
import { mapV2ToLegacySupportRow } from "@/lib/accessRequestsV2/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { admin, status } = await requireAccessRequestReviewerWithStatus(req);
  if (!admin) {
    return NextResponse.json(
      { error: status === 401 ? "Nao autenticado" : "Sem permissao" },
      { status, headers: NO_STORE_HEADERS },
    );
  }

  const [accessRequests, passwordResetRequests] = await Promise.all([
    listAccessRequestsV2(),
    listAllRequests({ type: "PASSWORD_RESET", sort: "createdAt_desc" }).catch(() => []),
  ]);

  const items = [
    ...accessRequests.map(mapV2ToLegacySupportRow),
    ...passwordResetRequests.map(mapPasswordResetRequestToAccessQueueItem),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return NextResponse.json({ items }, { headers: NO_STORE_HEADERS });
}
