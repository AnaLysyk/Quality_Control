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

  const body = (await req.json().catch(() => null)) as { comment?: string; admin_notes?: string } | null;
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";
  const adminNotes = typeof body?.admin_notes === "string" ? body.admin_notes.trim() : "";

  const { id } = await context.params;
  if (shouldUseJsonStore()) {
    const existing = await getAccessRequestById(id);
    if (!existing) {
      return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }
    console.debug(`[ACCESS-REQUESTS][ACCEPT] admin=${admin?.email ?? "-"} id=${id} comment=${Boolean(comment)} adminNotes=${Boolean(adminNotes)}`);
    const nextMessage = adminNotes ? applyAdminNotes(existing.message, adminNotes) : existing.message;
    const updated = await updateAccessRequest(id, { status: "closed", message: nextMessage });
    if (comment) {
      await createAccessRequestComment({
        requestId: id,
        authorRole: "admin",
        authorName: admin.email || "Admin",
        authorEmail: admin.email || null,
        authorId: admin.id || null,
        body: comment,
      });
    }
    // grava um log auxiliar em disco para diagnostico E2E local
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const debugPath = path.join(process.cwd(), "data", "access-requests-debug.log");
      const line = `${new Date().toISOString()} ACCEPT id=${id} admin=${admin?.email ?? "-"} status=${updated?.status ?? "closed"}\n`;
      await fs.appendFile(debugPath, line, "utf8");
    } catch (e) {
      // ignore write errors
    }
    return NextResponse.json({
      ok: true,
      item: {
        id: updated?.id ?? id,
        status: updated?.status ?? "closed",
      },
    });
  }

  const existing = await prisma.supportRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
  }
  console.debug(`[ACCESS-REQUESTS][ACCEPT] admin=${admin?.email ?? "-"} id=${id} comment=${Boolean(comment)} adminNotes=${Boolean(adminNotes)}`);

  const updated = await prisma.supportRequest.update({
    where: { id },
    data: { status: "closed", message: adminNotes ? applyAdminNotes(existing.message, adminNotes) : existing.message },
  });

  if (comment) {
    await createAccessRequestComment({
      requestId: id,
      authorRole: "admin",
      authorName: admin.email || "Admin",
      authorEmail: admin.email || null,
      authorId: admin.id || null,
      body: comment,
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
