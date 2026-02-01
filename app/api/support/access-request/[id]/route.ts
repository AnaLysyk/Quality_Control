import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/jwtAuth";

function normalizeRole(role?: string | null) {
  return (role ?? "").trim().toLowerCase();
}

function isAdmin(user: { isGlobalAdmin: boolean; role?: string | null }) {
  if (user.isGlobalAdmin) return true;
  const role = normalizeRole(user.role);
  return role === "admin" || role === "global_admin";
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await authenticateRequest(req);
  if (!authUser) return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });

  if (!isAdmin(authUser)) {
    return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const status = (body?.status as string | undefined)?.toLowerCase();
  const adminNotes = (body?.admin_notes as string | undefined) || null;

  if (!status || !["open", "in_progress", "closed"].includes(status)) {
    return NextResponse.json({ message: "Status invalido" }, { status: 400 });
  }

  const existing = await prisma.supportRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "Solicitacao nao encontrada" }, { status: 404 });
  }

  const updatedMessage = adminNotes
    ? `${existing.message}\n\nADMIN_NOTES:${adminNotes}`
    : existing.message;

  await prisma.supportRequest.update({
    where: { id },
    data: {
      status,
      message: updatedMessage,
    },
  });

  return NextResponse.json({ ok: true });
}
