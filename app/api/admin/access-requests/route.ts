import { NextRequest, NextResponse } from "next/server";

import { extractAdminNotes, listSupportRequests } from "@/data/supportRequestsStore";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const items = await listSupportRequests();
  const mapped = items.map((item) => ({
    id: item.id,
    email: item.email,
    message: item.message,
    status: item.status,
    created_at: item.created_at,
    admin_notes: extractAdminNotes(item.message),
  }));

  return NextResponse.json({ items: mapped }, { status: 200 });
}

