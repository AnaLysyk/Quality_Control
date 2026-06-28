import { NextResponse } from "next/server";

import { addAuditLogSafe } from "@/data/auditLogRepository";
import { getAccessRequestById } from "@/data/accessRequestsStore";
import {
  createAccessRequestComment,
  listAccessRequestComments,
} from "@/data/accessRequestCommentsStore";
import { getAccessRequestV2ById } from "@/lib/accessRequestsV2/repository";
import type { AccessRequestV2 } from "@/lib/accessRequestsV2/domain";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";
import { notifyAccessRequestComment } from "@/lib/notificationService";
import { extractPasswordResetRequestId } from "@/lib/passwordResetAccessQueue";
import { prisma } from "@/lib/prismaClient";
import { requireAccessRequestReviewerWithStatus } from "@/lib/rbac/requireAccessRequestReviewer";
import {
  canReviewerAccessQueue,
  resolveAccessRequestQueue,
} from "@/lib/requestReviewAccess";
import { shouldUseJsonStore } from "@/lib/storeMode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function sanitizeBody(value: unknown, max = 2000) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

async function getRequestForReview(
  id: string,
): Promise<{ email: string; message: string; status: string } | null> {
  if (shouldUseJsonStore()) {
    const existing = await getAccessRequestById(id);
    return existing
      ? { email: existing.email, message: existing.message, status: existing.status }
      : null;
  }

  try {
    const existing = await prisma.supportRequest.findUnique({ where: { id } });
    return existing
      ? { email: existing.email, message: existing.message, status: existing.status }
      : null;
  } catch (error) {
    console.error("Erro ao validar support_request, fallback JSON:", error);
    const existing = await getAccessRequestById(id);
    return existing
      ? { email: existing.email, message: existing.message, status: existing.status }
      : null;
  }
}

function isFinalV2Status(status: string | null | undefined) {
  return (
    status === "approved" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "expired"
  );
}

function canAccessV2Request(
  admin: {
    role?: string | null;
    companyId?: string | null;
    companySlug?: string | null;
    isGlobalAdmin?: boolean;
  },
  request: AccessRequestV2,
) {
  const adminRole = normalizeLegacyRole(admin.role);
  if (
    admin.isGlobalAdmin === true ||
    adminRole === SYSTEM_ROLES.LEADER_TC ||
    adminRole === SYSTEM_ROLES.TECHNICAL_SUPPORT
  ) {
    return true;
  }

  const companyId = admin.companyId ?? null;
  if (companyId && request.requestedCompanyId === companyId) return true;

  const companySlug = (admin.companySlug ?? "").trim().toLowerCase();
  if (!companySlug) return false;

  return (request.requestedCompanySlug ?? "").trim().toLowerCase() === companySlug;
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireAccessRequestReviewerWithStatus(req);
  if (!admin) {
    return NextResponse.json(
      { error: status === 401 ? "Nao autenticado" : "Sem permissao" },
      { status, headers: NO_STORE_HEADERS },
    );
  }

  const { id } = await context.params;
  if (extractPasswordResetRequestId(id)) {
    return NextResponse.json({ items: [] }, { status: 200, headers: NO_STORE_HEADERS });
  }

  const v2Request = await getAccessRequestV2ById(id);
  if (v2Request?.accessKey) {
    if (!canAccessV2Request(admin, v2Request)) {
      return NextResponse.json(
        { error: "Sem permissao para esta solicitacao" },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }

    const comments = await listAccessRequestComments(id).catch((error) => {
      console.error("Falha ao carregar comentarios V2 (access-requests):", error);
      return [];
    });
    return NextResponse.json({ items: comments }, { status: 200, headers: NO_STORE_HEADERS });
  }

  const request = await getRequestForReview(id);
  if (!request) {
    return NextResponse.json(
      { error: "Solicitacao nao encontrada." },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }
  if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(request.message, request.email))) {
    return NextResponse.json(
      { error: "Sem permissao para esta solicitacao" },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  const comments = await listAccessRequestComments(id).catch((error) => {
    console.error("Falha ao carregar comentarios (access-requests):", error);
    return [];
  });
  return NextResponse.json({ items: comments }, { status: 200, headers: NO_STORE_HEADERS });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireAccessRequestReviewerWithStatus(req);
  if (!admin) {
    return NextResponse.json(
      { error: status === 401 ? "Nao autenticado" : "Sem permissao" },
      { status },
    );
  }

  const { id } = await context.params;
  if (extractPasswordResetRequestId(id)) {
    return NextResponse.json(
      { error: "Comentarios nao sao suportados para reset de senha nesta fila." },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { body?: string; comment?: string }
    | null;
  const comment = sanitizeBody(body?.comment ?? body?.body ?? "");
  if (!comment) {
    return NextResponse.json({ error: "Comentario obrigatorio." }, { status: 400 });
  }

  const v2Request = await getAccessRequestV2ById(id);
  if (v2Request?.accessKey) {
    if (!canAccessV2Request(admin, v2Request)) {
      return NextResponse.json(
        { error: "Sem permissao para esta solicitacao" },
        { status: 403 },
      );
    }

    if (isFinalV2Status(v2Request.status)) {
      return NextResponse.json(
        { error: "Esta solicitacao ja foi finalizada e nao aceita novos comentarios." },
        { status: 409 },
      );
    }

    const record = await createAccessRequestComment({
      requestId: id,
      authorRole: "leader_tc",
      authorName: admin.email || "Admin",
      authorEmail: admin.email || null,
      authorId: admin.id || null,
      body: comment,
    });

    notifyAccessRequestComment({
      requestId: id,
      commentId: record.id,
      authorName: admin.email || "Admin",
      body: comment,
      reviewQueue: "admin_and_global",
      companySlug: v2Request.requestedCompanySlug ?? null,
      clientId: v2Request.requestedCompanyId ?? null,
    }).catch((err) => console.error("Falha ao notificar comentario V2:", err));

    addAuditLogSafe({
      action: "access_request.commented",
      entityType: "access_request",
      entityId: id,
      entityLabel: v2Request.requesterEmail ?? null,
      actorUserId: admin.id ?? null,
      actorEmail: admin.email ?? null,
      metadata: { commentId: record.id },
    });

    return NextResponse.json({ item: record }, { status: 200 });
  }

  const request = await getRequestForReview(id);
  if (!request) {
    return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404 });
  }
  if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(request.message, request.email))) {
    return NextResponse.json(
      { error: "Sem permissao para esta solicitacao" },
      { status: 403 },
    );
  }
  if (request.status === "rejected" || request.status === "closed") {
    return NextResponse.json(
      { error: "Esta solicitacao ja foi finalizada e nao aceita novos comentarios." },
      { status: 409 },
    );
  }

  const record = await createAccessRequestComment({
    requestId: id,
    authorRole: "leader_tc",
    authorName: admin.email || "Admin",
    authorEmail: admin.email || null,
    authorId: admin.id || null,
    body: comment,
  });

  notifyAccessRequestComment({
    requestId: id,
    commentId: record.id,
    authorName: admin.email || "Admin",
    body: comment,
    reviewQueue: resolveAccessRequestQueue(request.message, request.email),
  }).catch((err) => console.error("Falha ao notificar comentario:", err));

  addAuditLogSafe({
    action: "access_request.commented",
    entityType: "access_request",
    entityId: id,
    entityLabel: request.email ?? null,
    actorUserId: admin.id ?? null,
    actorEmail: admin.email ?? null,
    metadata: { commentId: record.id },
  });

  return NextResponse.json({ item: record }, { status: 200 });
}
