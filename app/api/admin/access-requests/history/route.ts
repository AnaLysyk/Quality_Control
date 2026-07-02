import { NextResponse } from "next/server";

import { listAccessRequestRemovalHistory } from "@/lib/accessRequestRemovalHistory";
import { requireAccessRequestReviewerWithStatus } from "@/lib/rbac/requireAccessRequestReviewer";

export async function GET(req: Request) {
  const { admin, status } = await requireAccessRequestReviewerWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autenticado" : "Sem permissão" }, { status });
  }

  const items = await listAccessRequestRemovalHistory();
  return NextResponse.json({ items });
}

