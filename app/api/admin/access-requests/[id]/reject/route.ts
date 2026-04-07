import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalDeveloperWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { canReviewerAccessQueue, resolveAccessRequestQueue } from "@/lib/requestReviewAccess";
import { parseAccessRequestMessage } from "@/lib/accessRequestMessage";
import { notifyAccessRequestRejected } from "@/lib/notificationService";
import { resolveReviewQueue } from "@/lib/requestRouting";
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
  const { admin, status } = await requireGlobalDeveloperWithStatus(req);
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
    if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
      return NextResponse.json({ error: "Sem permissao para esta solicitacao" }, { status: 403 });
    }
    console.debug(`[ACCESS-REQUESTS][REJECT] admin=${admin?.email ?? "-"} id=${id} comment=${Boolean(comment)} reason=${Boolean(reason)}`);
    const updatedMessage = applyAdminNotes(existing.message, reason || null);
    const updated = await updateAccessRequest(id, { status: "rejected", message: updatedMessage });
    await createAccessRequestComment({
      requestId: id,
      authorRole: "admin",
      authorName: admin.email || "Admin",
      authorEmail: admin.email || null,
      authorId: admin.id || null,
      body: [reason || comment || "Solicitacao recusada.", "Fale com um responsavel para revisar o acesso solicitado."]
        .filter(Boolean)
        .join("\n"),
    });

    const parsedNotif = parseAccessRequestMessage(existing.message, existing.email);
    await notifyAccessRequestRejected({
      requestId: id,
      requesterName: parsedNotif.fullName || parsedNotif.name || existing.email,
      rejectorName: admin.email || "Admin",
      profileType: parsedNotif.profileType,
      reviewQueue: resolveReviewQueue(parsedNotif.profileType),
      reason: reason || comment || null,
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      item: {
        id: updated?.id ?? id,
        status: updated?.status ?? "rejected",
      },
    });
  }

  try {
    const existing = await prisma.supportRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }
    if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
      return NextResponse.json({ error: "Sem permissao para esta solicitacao" }, { status: 403 });
    }
    console.debug(`[ACCESS-REQUESTS][REJECT] admin=${admin?.email ?? "-"} id=${id} comment=${Boolean(comment)} reason=${Boolean(reason)}`);

    const updated = await prisma.supportRequest.update({
      where: { id },
      data: {
        status: "rejected",
        message: applyAdminNotes(existing.message, reason || null),
      },
    });

    await createAccessRequestComment({
      requestId: id,
      authorRole: "admin",
      authorName: admin.email || "Admin",
      authorEmail: admin.email || null,
      authorId: admin.id || null,
      body: [reason || comment || "Solicitacao recusada.", "Fale com um responsavel para revisar o acesso solicitado."]
        .filter(Boolean)
        .join("\n"),
    });

    const parsedNotif2 = parseAccessRequestMessage(existing.message, existing.email);
    await notifyAccessRequestRejected({
      requestId: id,
      requesterName: parsedNotif2.fullName || parsedNotif2.name || existing.email,
      rejectorName: admin.email || "Admin",
      profileType: parsedNotif2.profileType,
      reviewQueue: resolveReviewQueue(parsedNotif2.profileType),
      reason: reason || comment || null,
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      item: {
        id: updated.id,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error("[ACCESS-REQUESTS][REJECT][PRISMA_FALLBACK]", error);
    const existing = await getAccessRequestById(id);
    if (!existing) {
      return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }
    if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
      return NextResponse.json({ error: "Sem permissao para esta solicitacao" }, { status: 403 });
    }
    const updated = await updateAccessRequest(id, { status: "rejected", message: applyAdminNotes(existing.message, reason || null) });
    await createAccessRequestComment({
      requestId: id,
      authorRole: "admin",
      authorName: admin.email || "Admin",
      authorEmail: admin.email || null,
      authorId: admin.id || null,
      body: [reason || comment || "Solicitacao recusada.", "Fale com um responsavel para revisar o acesso solicitado."]
        .filter(Boolean)
        .join("\n"),
    });

    const parsedNotif3 = parseAccessRequestMessage(existing.message, existing.email);
    await notifyAccessRequestRejected({
      requestId: id,
      requesterName: parsedNotif3.fullName || parsedNotif3.name || existing.email,
      rejectorName: admin.email || "Admin",
      profileType: parsedNotif3.profileType,
      reviewQueue: resolveReviewQueue(parsedNotif3.profileType),
      reason: reason || comment || null,
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      item: {
        id: updated?.id ?? id,
        status: updated?.status ?? "rejected",
      },
    });
  }
}
