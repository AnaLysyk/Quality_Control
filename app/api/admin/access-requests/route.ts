import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { listAccessRequests } from "@/data/accessRequestsStore";
import { extractAdminNotes } from "@/lib/accessRequestMessage";

export const runtime = "nodejs";

type SupportRequestRow = {
  id: string;
  email: string;
  message: string;
  status: string;
  created_at: Date;
};

export async function GET(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  if (shouldUseJsonStore()) {
    const items = await listAccessRequests();
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

  try {
    const items = (await prisma.supportRequest.findMany({
      orderBy: { created_at: "desc" },
    })) as SupportRequestRow[];

    const mapped = items.map((item) => ({
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at.toISOString(),
      admin_notes: extractAdminNotes(item.message),
    }));

    return NextResponse.json({ items: mapped }, { status: 200 });
  } catch (error) {
    console.error("Falha ao listar access-requests (fallback JSON):", error);
    const items = await listAccessRequests();
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
}
