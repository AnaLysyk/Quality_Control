import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { listAccessRequests } from "@/data/accessRequestsStore";
import { extractAdminNotes } from "@/lib/accessRequestMessage";

export const runtime = "nodejs";

const MAX_ITEMS = 1000;

type AdminListItem = {
  id: string;
  email: string;
  message: string;
  status: string;
  created_at: unknown;
};

type SupportRequestRow = {
  id: string;
  email: string;
  message: string;
  status: string;
  created_at: Date;
};

function toAdminListResponse(items: ReadonlyArray<AdminListItem>) {
  return items.slice(0, MAX_ITEMS).map((item: AdminListItem) => ({
    id: item.id,
    email: item.email,
    message: item.message,
    status: item.status,
    created_at: String(item.created_at),
    admin_notes: extractAdminNotes(item.message),
  }));
}

function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return noStoreJson({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  if (shouldUseJsonStore()) {
    const items = await listAccessRequests();
    const mapped = toAdminListResponse(items);
    console.debug(`[ACCESS-REQUESTS][GET] admin=${admin?.email ?? "-"} jsonStore=true items=${mapped.length}`);
    return noStoreJson({ items: mapped, degraded: false }, { status: 200 });
  }

  try {
    const items = await prisma.supportRequest.findMany({
      orderBy: { created_at: "desc" },
      take: MAX_ITEMS,
    });

    const mapped = items.map((item: SupportRequestRow) => ({
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at.toISOString(),
      admin_notes: extractAdminNotes(item.message),
    }));

    console.debug(`[ACCESS-REQUESTS][GET] admin=${admin?.email ?? "-"} jsonStore=false items=${mapped.length}`);
    return noStoreJson({ items: mapped, degraded: false }, { status: 200 });
  } catch (error) {
    console.error("Falha ao listar access-requests (fallback JSON):", error);
    const items = await listAccessRequests();
    const mapped = toAdminListResponse(items);
    return noStoreJson({ items: mapped, degraded: true }, { status: 200 });
  }
}
