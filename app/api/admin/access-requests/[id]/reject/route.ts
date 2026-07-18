import { NextResponse } from "next/server";
import { prisma } from "@/database/prismaClient";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { requireAccessRequestReviewerWithStatus } from "@/backend/rbac/requireAccessRequestReviewer";
import { canReviewerAccessQueue, resolveAccessRequestQueue } from "@/backend/requestReviewAccess";
import { parseAccessRequestMessage } from "@/backend/accessRequestMessage";
import { notifyAccessRequestRejected } from "@/backend/notificationService";
import { resolveReviewQueue } from "@/backend/requestRouting";
import { shouldUseJsonStore } from "@/backend/storeMode";
import { getAccessRequestById, updateAccessRequest } from "@/data/accessRequestsStore";
import { createAccessRequestComment } from "@/data/accessRequestCommentsStore";
import { extractPasswordResetRequestId } from "@/backend/passwordResetAccessQueue";
import { reviewPasswordResetRequest } from "@/backend/passwordResetReview";
import { getAccessRequestV2ById } from "@/backend/accessRequestsV2/repository";
import { transitionAccessRequest } from "@/backend/accessRequestsV2/service";

function applyAdminNotes(message: string, notes: string | null) {
  if (!notes || !notes.trim()) return message;
  const lines = message.split("\n").filter((line) => !line.startsWith("ADMIN_NOTES:"));
  lines.push(`ADMIN_NOTES: ${notes.trim()}`);
  return lines.join("\n");
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireAccessRequestReviewerWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autenticado" : "Sem permissão" }, { status });
  }

  const body = (await req.json().catch(() => null)) as { reason?: string | null; comment?: string | null } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";

  const { id } = await context.params;
  const passwordResetRequestId = extractPasswordResetRequestId(id);

  if (passwordResetRequestId) {
    const result = await reviewPasswordResetRequest(
      passwordResetRequestId,
      "REJECTED",
      { id: admin.id || admin.email || "access-requests" },
      reason || comment || "Recusado pela central de solicitacoes",
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      item: {
        id,
        status:
          result.item?.status === "APPROVED"
            ? "closed"
            : result.item?.status === "REJECTED"
              ? "rejected"
              : result.item?.status === "NEEDS_REVISION"
                ? "in_progress"
                : "open",
        requestId: passwordResetRequestId,
      },
    });
  }

  const v2Request = await getAccessRequestV2ById(id);
  if (v2Request?.accessKey) {
    const result = await transitionAccessRequest(
      id,
      "reject",
      {
        id: admin.id || admin.email,
        email: admin.email,
        role: admin.role,
        globalRole: admin.globalRole,
        companyRole: admin.role,
        permissionRole: admin.role,
        isGlobalAdmin: Boolean(admin.isGlobalAdmin),
        companyId: admin.companyId,
        companySlug: admin.companySlug,
      },
      { comment: reason || comment },
    );
    if (result === "reject-comment-required") {
      return NextResponse.json({ error: "Informe o motivo da rejeicao" }, { status: 400 });
    }
    if (result === "invalid-transition") {
      return NextResponse.json({ error: "Solicitacao finalizada" }, { status: 409 });
    }
    if (typeof result === "string") {
      return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    }
    if (!result) {
      return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item: { id: result.id, status: "rejected" } });
  }

  if (shouldUseJsonStore()) {
    const existing = await getAccessRequestById(id);
    if (!existing) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
    }
    if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
      return NextResponse.json({ error: "Sem permissão para esta solicitação" }, { status: 403 });
    }
    const updatedMessage = applyAdminNotes(existing.message, reason || null);
    const updated = await updateAccessRequest(id, { status: "rejected", message: updatedMessage });
    await createAccessRequestComment({
      requestId: id,
      authorRole: "leader_tc",
      authorName: admin.email || "Admin",
      authorEmail: admin.email || null,
      authorId: admin.id || null,
      body: [reason || comment || "Solicitação recusada.", "Fale com um responsável para revisar o acesso solicitado."]
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
      clientId: parsedNotif.clientId,
    }).catch(() => null);

    addAuditLogSafe({
      action: "access_request.rejected",
      entityType: "access_request",
      entityId: id,
      entityLabel: existing.email ?? null,
      actorUserId: admin.id ?? null,
      actorEmail: admin.email ?? null,
      metadata: { reason: reason || comment || null },
    });

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
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
    }
    if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
      return NextResponse.json({ error: "Sem permissão para esta solicitação" }, { status: 403 });
    }

    const updated = await prisma.supportRequest.update({
      where: { id },
      data: {
        status: "rejected",
        message: applyAdminNotes(existing.message, reason || null),
      },
    });

    await createAccessRequestComment({
      requestId: id,
      authorRole: "leader_tc",
      authorName: admin.email || "Admin",
      authorEmail: admin.email || null,
      authorId: admin.id || null,
      body: [reason || comment || "Solicitação recusada.", "Fale com um responsável para revisar o acesso solicitado."]
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
      clientId: parsedNotif2.clientId,
    }).catch(() => null);

    addAuditLogSafe({
      action: "access_request.rejected",
      entityType: "access_request",
      entityId: id,
      entityLabel: existing.email ?? null,
      actorUserId: admin.id ?? null,
      actorEmail: admin.email ?? null,
      metadata: { reason: reason || comment || null },
    });

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
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
    }
    if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
      return NextResponse.json({ error: "Sem permissão para esta solicitação" }, { status: 403 });
    }
    const updated = await updateAccessRequest(id, { status: "rejected", message: applyAdminNotes(existing.message, reason || null) });
    await createAccessRequestComment({
      requestId: id,
      authorRole: "leader_tc",
      authorName: admin.email || "Admin",
      authorEmail: admin.email || null,
      authorId: admin.id || null,
      body: [reason || comment || "Solicitação recusada.", "Fale com um responsável para revisar o acesso solicitado."]
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
      clientId: parsedNotif3.clientId,
    }).catch(() => null);

    addAuditLogSafe({
      action: "access_request.rejected",
      entityType: "access_request",
      entityId: id,
      entityLabel: existing.email ?? null,
      actorUserId: admin.id ?? null,
      actorEmail: admin.email ?? null,
      metadata: { reason: reason || comment || null },
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: updated?.id ?? id,
        status: updated?.status ?? "rejected",
      },
    });
  }
}

