import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalDeveloperWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { canReviewerAccessQueue, resolveAccessRequestQueue } from "@/lib/requestReviewAccess";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { listAccessRequests } from "@/data/accessRequestsStore";
import { extractAdminNotes } from "@/lib/accessRequestMessage";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SupportRequestRow = {
  id: string;
  email: string;
  message: string;
  status: string;
  created_at: Date;
};

export async function GET(req: NextRequest) {
  const { admin, status } = await requireGlobalDeveloperWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status, headers: NO_STORE_HEADERS });
  }

  if (shouldUseJsonStore()) {
    const items = (await listAccessRequests()).filter((item) =>
      canReviewerAccessQueue(admin, resolveAccessRequestQueue(item.message, item.email)),
    );
    const mapped = items.map((item) => ({
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at,
      admin_notes: extractAdminNotes(item.message),
    }));
    console.debug(`[ACCESS-REQUESTS][GET] admin=${admin?.email ?? "-"} jsonStore=true items=${mapped.length}`);
    return NextResponse.json({ items: mapped }, { status: 200, headers: NO_STORE_HEADERS });
  }

  try {
    const items = ((await prisma.supportRequest.findMany({
      orderBy: { created_at: "desc" },
    })) as SupportRequestRow[]).filter((item) =>
      canReviewerAccessQueue(admin, resolveAccessRequestQueue(item.message, item.email)),
    );

    const mapped = items.map((item) => ({
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at.toISOString(),
      admin_notes: extractAdminNotes(item.message),
    }));

    console.debug(`[ACCESS-REQUESTS][GET] admin=${admin?.email ?? "-"} jsonStore=false items=${mapped.length}`);
    return NextResponse.json({ items: mapped }, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("Falha ao listar access-requests (fallback JSON):", error);
    const items = (await listAccessRequests()).filter((item) =>
      canReviewerAccessQueue(admin, resolveAccessRequestQueue(item.message, item.email)),
    );
    const mapped = items.map((item) => ({
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at,
      admin_notes: extractAdminNotes(item.message),
    }));
    return NextResponse.json({ items: mapped }, { status: 200, headers: NO_STORE_HEADERS });
  }
}
