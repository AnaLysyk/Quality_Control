import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export const runtime = "nodejs";

function upsertAdminNotes(message: string, notes: string | null) {
  const lines = message.split("\n").filter((line) => !line.startsWith("ADMIN_NOTES:"));
  if (notes && notes.trim()) {
    lines.push(`ADMIN_NOTES: ${notes.trim()}`);
  }
  return lines.join("\n");
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : null;
  const adminNotes = typeof body?.admin_notes === "string" ? body.admin_notes : null;

  const existing = await prisma.supportRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
  }

  const updatedMessage = upsertAdminNotes(existing.message, adminNotes);

  const updated = await prisma.supportRequest.update({
    where: { id },
    data: {
      ...(email ? { email } : {}),
      message: updatedMessage,
    },
  });

  return NextResponse.json({ ok: true, id: updated.id }, { status: 200 });
}
