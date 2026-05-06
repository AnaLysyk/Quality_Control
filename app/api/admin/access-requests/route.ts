import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { requireAccessRequestReviewerWithStatus } from "@/lib/rbac/requireAccessRequestReviewer";
import { canReviewerAccessQueue, resolveAccessRequestQueue } from "@/lib/requestReviewAccess";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { listAccessRequests } from "@/data/accessRequestsStore";
import { listAllRequests } from "@/data/requestsStore";
import { extractAdminNotes } from "@/lib/accessRequestMessage";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";
import { mapPasswordResetRequestToAccessQueueItem } from "@/lib/passwordResetAccessQueue";

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

type MappedAccessRequestRow = {
  id: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
  admin_notes: string | null;
};

type AccessRequestReviewer = NonNullable<Awaited<ReturnType<typeof requireAccessRequestReviewerWithStatus>>["admin"]>;

async function listPasswordResetQueueItems(admin: AccessRequestReviewer): Promise<MappedAccessRequestRow[]> {
  const requests = await listAllRequests({ type: "PASSWORD_RESET", sort: "createdAt_desc" });
  return requests
    .map(mapPasswordResetRequestToAccessQueueItem)
    .filter((item) => canViewAccessRequestQueue(admin, resolveAccessRequestQueue(item.message, item.email)));
}

function sortMappedItems(items: MappedAccessRequestRow[]) {
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function GET(req: NextRequest) {
  const { admin, status } = await requireAccessRequestReviewerWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autenticado" : "Sem permissão" }, { status, headers: NO_STORE_HEADERS });
  }

  if (shouldUseJsonStore()) {
    const items = (await listAccessRequests()).filter((item) => {
      const queue = resolveAccessRequestQueue(item.message, item.email);
      // global reviewers see items according to queue rules, non-global reviewers see only their own
      if (admin?.isGlobalReviewer) return canReviewerAccessQueue(admin, queue);
      return String(item.email ?? "").toLowerCase() === String(admin?.email ?? "").toLowerCase();
    });
    const mapped = items.map((item) => ({
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at,
      admin_notes: extractAdminNotes(item.message),
    }));
    const passwordResetItems = await listPasswordResetQueueItems(admin).catch((error) => {
      console.error("Falha ao listar resets de senha na fila access-requests:", error);
      return [];
    });
    const merged = sortMappedItems([...mapped, ...passwordResetItems]);
    console.debug(`[ACCESS-REQUESTS][GET] admin=${admin?.email ?? "-"} jsonStore=true items=${merged.length}`);
    return NextResponse.json({ items: merged }, { status: 200, headers: NO_STORE_HEADERS });
  }

  try {
    const rows = (await prisma.supportRequest.findMany({ orderBy: { created_at: "desc" } })) as SupportRequestRow[];
    const items = rows.filter((item) => {
      const queue = resolveAccessRequestQueue(item.message, item.email);
      if (admin?.isGlobalReviewer) return canReviewerAccessQueue(admin, queue);
      return String(item.email ?? "").toLowerCase() === String(admin?.email ?? "").toLowerCase();
    });

    const mapped = items.map((item) => ({
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at.toISOString(),
      admin_notes: extractAdminNotes(item.message),
    }));

    const passwordResetItems = await listPasswordResetQueueItems(admin).catch((error) => {
      console.error("Falha ao listar resets de senha na fila access-requests:", error);
      return [];
    });
    const merged = sortMappedItems([...mapped, ...passwordResetItems]);
    console.debug(`[ACCESS-REQUESTS][GET] admin=${admin?.email ?? "-"} jsonStore=false items=${merged.length}`);
    return NextResponse.json({ items: merged }, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("Falha ao listar access-requests (fallback JSON):", error);
    const items = (await listAccessRequests()).filter((item) =>
      canViewAccessRequestQueue(admin, resolveAccessRequestQueue(item.message, item.email)),
    );
    const mapped = items.map((item) => ({
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at,
      admin_notes: extractAdminNotes(item.message),
    }));
    const passwordResetItems = await listPasswordResetQueueItems(admin).catch((resetError) => {
      console.error("Falha ao listar resets de senha na fila access-requests:", resetError);
      return [];
    });
    return NextResponse.json({ items: sortMappedItems([...mapped, ...passwordResetItems]) }, { status: 200, headers: NO_STORE_HEADERS });
  }
}
