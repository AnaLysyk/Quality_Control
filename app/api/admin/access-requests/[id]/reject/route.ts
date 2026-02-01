import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export const runtime = "nodejs";

function appendAdminNotes(message: string, notes: string | null) {
  if (!notes || !notes.trim()) return message;
  const lines = message.split("\n").filter((line) => !line.startsWith("ADMIN_NOTES:"));
  lines.push(`ADMIN_NOTES: ${notes.trim()}`);
  return lines.join("\n");
}

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const id = context.params.id;
  const body = await req.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason : null;

  const existing = await prisma.supportRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
  }

  const updatedMessage = appendAdminNotes(existing.message, reason);

  await prisma.supportRequest.update({
    where: { id },
    data: { status: "rejected", message: updatedMessage },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
