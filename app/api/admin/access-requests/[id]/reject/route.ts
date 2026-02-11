import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { getAccessRequestById, updateAccessRequest } from "@/data/accessRequestsStore";
import { createAccessRequestComment } from "@/data/accessRequestCommentsStore";

function applyAdminNotes(message: string, notes: string | null) {
  if (!notes || !notes.trim()) return message;
  const lines = message.split("\n").filter((line) => !line.startsWith("ADMIN_NOTES:"));
  lines.push(`ADMIN_NOTES: ${notes.trim()}`);
  return lines.join("\n");
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const body = (await req.json().catch(() => null)) as { reason?: string | null; comment?: string | null } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";

  const { id } = await context.params;
  if (shouldUseJsonStore()) {
    const existing = await getAccessRequestById(id);
    if (!existing) {
      return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }
    const updatedMessage = applyAdminNotes(existing.message, reason || null);
    const updated = await updateAccessRequest(id, { status: "rejected", message: updatedMessage });
    if (comment || reason) {
      await createAccessRequestComment({
        requestId: id,
        authorRole: "admin",
        authorName: admin.email || "Admin",
        authorEmail: admin.email || null,
        authorId: admin.id || null,
        body: comment || reason,
      });
    }
    return NextResponse.json({
      ok: true,
      item: {
        id: updated?.id ?? id,
        status: updated?.status ?? "rejected",
      },
    });
  }

  const existing = await prisma.supportRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
  }

  const updated = await prisma.supportRequest.update({
    where: { id },
    data: {
      status: "rejected",
      message: applyAdminNotes(existing.message, reason || null),
    },
  });

  if (comment || reason) {
    await createAccessRequestComment({
      requestId: id,
      authorRole: "admin",
      authorName: admin.email || "Admin",
      authorEmail: admin.email || null,
      authorId: admin.id || null,
      body: comment || reason,
    });
  }

  return NextResponse.json({
    ok: true,
    item: {
      id: updated.id,
      status: updated.status,
    },
  });
}
