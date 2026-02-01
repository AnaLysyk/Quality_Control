import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export const runtime = "nodejs";

function extractAdminNotes(message: string): string | null {
  const line = message.split("\n").find((l) => l.startsWith("ADMIN_NOTES:"));
  if (!line) return null;
  const notes = line.slice("ADMIN_NOTES:".length).trim();
  return notes || null;
}

export async function GET(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const items = await prisma.supportRequest.findMany({
    orderBy: { created_at: "desc" },
  });

  const mapped = items.map((item) => ({
    id: item.id,
    email: item.email,
    message: item.message,
    status: item.status,
    created_at: item.created_at.toISOString(),
    admin_notes: extractAdminNotes(item.message),
  }));

  return NextResponse.json({ items: mapped }, { status: 200 });
}
