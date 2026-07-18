import { NextResponse } from "next/server";

import { deleteAccessRequest, getAccessRequestById, updateAccessRequest } from "@/data/accessRequestsStore";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import {
  composeAccessRequestMessage,
  normalizeAccessType,
  parseAccessRequestMessage,
} from "@/backend/accessRequestMessage";
import { hashPasswordSha256 } from "@/backend/passwordHash";
import { prisma } from "@/database/prismaClient";
import { requireAccessRequestReviewerWithStatus } from "@/backend/rbac/requireAccessRequestReviewer";
import { canReviewerAccessQueue, isGlobalReviewer, resolveAccessRequestQueue } from "@/backend/requestReviewAccess";
import { appendAccessRequestRemovalHistory } from "@/backend/accessRequestRemovalHistory";
import {
  normalizeRequestProfileType,
  resolveReviewQueue,
  toInternalAccessType,
} from "@/backend/requestRouting";
import { shouldUseJsonStore } from "@/backend/storeMode";
import { getAccessRequestV2ById } from "@/backend/accessRequestsV2/repository";
import { updateAccessRequestDetailsForReviewer } from "@/backend/accessRequestsV2/service";

type AccessRequestBody = {
  email?: string;
  name?: string;
  full_name?: string | null;
  user?: string | null;
  phone?: string | null;
  role?: string;
  company?: string;
  client_id?: string | null;
  access_type?: string;
  title?: string;
  description?: string;
  notes?: string;
  admin_notes?: string | null;
  password?: string | null;
};

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireAccessRequestReviewerWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autenticado" : "Sem permissão" }, { status });
  }

  const body = (await req.json().catch(() => null)) as AccessRequestBody | null;
  if (!body) {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : null;
  const username = typeof body.user === "string" ? body.user.trim().toLowerCase() : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() : null;
  const role = typeof body.role === "string" ? body.role.trim() : "";
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const clientId = typeof body.client_id === "string" && body.client_id.trim() ? body.client_id.trim() : null;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const profileType =
    normalizeRequestProfileType(body.access_type) ??
    normalizeRequestProfileType(body.role) ??
    "testing_company_user";
  const accessType = normalizeAccessType(body.access_type) ?? toInternalAccessType(profileType);
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const adminNotes = typeof body.admin_notes === "string" ? body.admin_notes.trim() : null;
  const password = typeof body.password === "string" ? body.password.trim() : "";
  const passwordHash = password ? hashPasswordSha256(password) : null;

  const { id } = await context.params;
  const v2Request = await getAccessRequestV2ById(id);
  if (v2Request?.accessKey) {
    const result = await updateAccessRequestDetailsForReviewer(
      id,
      body as Record<string, unknown>,
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
    );
    if (result === "forbidden") {
      return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    }
    if (result === "final") {
      return NextResponse.json({ error: "Solicitacao finalizada" }, { status: 409 });
    }
    if (result === "duplicate-user") {
      return NextResponse.json({ error: "Usuario ja cadastrado" }, { status: 409 });
    }
    if (result === "invalid-profile" || result === "company-missing") {
      return NextResponse.json({ error: "Perfil ou empresa invalida" }, { status: 400 });
    }
    if (!result) {
      return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item: result });
  }

  if (shouldUseJsonStore()) {
    const existing = await getAccessRequestById(id);
    if (!existing) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
    }
    if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
      return NextResponse.json({ error: "Sem permissão para esta solicitação" }, { status: 403 });
    }
    if (!isGlobalReviewer(admin) && resolveReviewQueue(profileType) === "global_only") {
      return NextResponse.json({ error: "Somente Global pode encaminhar solicitações tecnicas" }, { status: 403 });
    }

    const parsed = parseAccessRequestMessage(existing.message, existing.email);

    const message = composeAccessRequestMessage({
      email: email || parsed.email || existing.email,
      name: fullName || parsed.fullName || name || parsed.name,
      fullName: fullName || parsed.fullName || name || parsed.name,
      username: username ?? parsed.username,
      phone: phone || parsed.phone,
      passwordHash: passwordHash ?? parsed.passwordHash,
      role: role || parsed.jobRole,
      company: company || parsed.company || "(não informado)",
      clientId: clientId ?? parsed.clientId,
      accessType,
      profileType,
      title: title || parsed.title,
      description: description || parsed.description,
      notes: notes || parsed.notes,
      adminNotes,
      companyProfile: parsed.companyProfile,
      originalRequest: parsed.originalRequest,
      adjustmentRound: parsed.adjustmentRound,
      adjustmentRequestedFields: parsed.adjustmentRequestedFields,
      adjustmentHistory: parsed.adjustmentHistory,
      lastAdjustmentAt: parsed.lastAdjustmentAt,
      lastAdjustmentDiff: parsed.lastAdjustmentDiff,
    });

    const updated = await updateAccessRequest(id, {
      email: email || existing.email,
      message,
    });

    if (!updated) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      item: {
        id: updated.id,
        email: updated.email,
        message: updated.message,
        status: updated.status,
        created_at: updated.created_at,
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
    if (!isGlobalReviewer(admin) && resolveReviewQueue(profileType) === "global_only") {
      return NextResponse.json({ error: "Somente Global pode encaminhar solicitações tecnicas" }, { status: 403 });
    }

    const parsed = parseAccessRequestMessage(existing.message, existing.email);

    const message = composeAccessRequestMessage({
      email: email || parsed.email || existing.email,
      name: fullName || parsed.fullName || name || parsed.name,
      fullName: fullName || parsed.fullName || name || parsed.name,
      username: username ?? parsed.username,
      phone: phone || parsed.phone,
      passwordHash: passwordHash ?? parsed.passwordHash,
      role: role || parsed.jobRole,
      company: company || parsed.company || "(não informado)",
      clientId: clientId ?? parsed.clientId,
      accessType,
      profileType,
      title: title || parsed.title,
      description: description || parsed.description,
      notes: notes || parsed.notes,
      adminNotes,
      companyProfile: parsed.companyProfile,
      originalRequest: parsed.originalRequest,
      adjustmentRound: parsed.adjustmentRound,
      adjustmentRequestedFields: parsed.adjustmentRequestedFields,
      adjustmentHistory: parsed.adjustmentHistory,
      lastAdjustmentAt: parsed.lastAdjustmentAt,
      lastAdjustmentDiff: parsed.lastAdjustmentDiff,
    });

    const updated = await prisma.supportRequest.update({
      where: { id },
      data: {
        email: email || existing.email,
        message,
      },
    });

    return NextResponse.json({
      item: {
        id: updated.id,
        email: updated.email,
        message: updated.message,
        status: updated.status,
        created_at: updated.created_at.toISOString(),
      },
    });
  } catch (error) {
    console.error("[ACCESS-REQUESTS][PATCH][PRISMA_FALLBACK]", error);
    const existing = await getAccessRequestById(id);
    if (!existing) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
    }
    if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
      return NextResponse.json({ error: "Sem permissão para esta solicitação" }, { status: 403 });
    }
    if (!isGlobalReviewer(admin) && resolveReviewQueue(profileType) === "global_only") {
      return NextResponse.json({ error: "Somente Global pode encaminhar solicitações tecnicas" }, { status: 403 });
    }

    const parsed = parseAccessRequestMessage(existing.message, existing.email);
    const message = composeAccessRequestMessage({
      email: email || parsed.email || existing.email,
      name: fullName || parsed.fullName || name || parsed.name,
      fullName: fullName || parsed.fullName || name || parsed.name,
      username: username ?? parsed.username,
      phone: phone || parsed.phone,
      passwordHash: passwordHash ?? parsed.passwordHash,
      role: role || parsed.jobRole,
      company: company || parsed.company || "(não informado)",
      clientId: clientId ?? parsed.clientId,
      accessType,
      profileType,
      title: title || parsed.title,
      description: description || parsed.description,
      notes: notes || parsed.notes,
      adminNotes,
      companyProfile: parsed.companyProfile,
      originalRequest: parsed.originalRequest,
      adjustmentRound: parsed.adjustmentRound,
      adjustmentRequestedFields: parsed.adjustmentRequestedFields,
      adjustmentHistory: parsed.adjustmentHistory,
      lastAdjustmentAt: parsed.lastAdjustmentAt,
      lastAdjustmentDiff: parsed.lastAdjustmentDiff,
    });

    const updated = await updateAccessRequest(id, {
      email: email || existing.email,
      message,
    });

    return NextResponse.json({
      item: {
        id: updated?.id ?? id,
        email: updated?.email ?? existing.email,
        message: updated?.message ?? message,
        status: updated?.status ?? existing.status,
        created_at: updated?.created_at ?? existing.created_at,
      },
    });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireAccessRequestReviewerWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autenticado" : "Sem permissão" }, { status });
  }

  const { id } = await context.params;
  const v2Request = await getAccessRequestV2ById(id);

  if (v2Request) {
    const normalizedRole = normalizeRequestProfileType(v2Request.requestedRole) ?? "testing_company_user";

    await appendAccessRequestRemovalHistory({
      requestId: v2Request.id,
      requesterEmail: v2Request.requesterEmail,
      requesterName: v2Request.requesterName ?? null,
      requestStatus: v2Request.status,
      requestType: v2Request.requestType,
      requestedRole: v2Request.requestedRole ?? normalizedRole,
      requestedCompanyId: v2Request.requestedCompanyId ?? null,
      requestedCompanySlug: v2Request.requestedCompanySlug ?? null,
      removedByUserId: admin.id ?? null,
      removedByEmail: admin.email ?? null,
      source: "admin_access_requests",
    });

    addAuditLogSafe({
      action: "access_request.deleted",
      entityType: "access_request",
      entityId: v2Request.id,
      entityLabel: `${v2Request.requesterName ?? "Solicitante"} (${v2Request.requesterEmail})`,
      actorUserId: admin.id ?? null,
      actorEmail: admin.email ?? null,
      metadata: {
        source: "admin_access_requests",
        status: v2Request.status,
        requestType: v2Request.requestType,
        requestedRole: v2Request.requestedRole ?? null,
        requesterEmail: v2Request.requesterEmail,
        requestedCompanyId: v2Request.requestedCompanyId ?? null,
        requestedCompanySlug: v2Request.requestedCompanySlug ?? null,
      },
    });

    if (!shouldUseJsonStore()) {
      const removed = await prisma.accessRequest.deleteMany({ where: { id } });
      return NextResponse.json({ ok: removed.count > 0 });
    }

    const removed = await deleteAccessRequest(id);
    return NextResponse.json({ ok: removed });
  }

  if (shouldUseJsonStore()) {
    const existing = await getAccessRequestById(id);
    if (!existing) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
    }

    await appendAccessRequestRemovalHistory({
      requestId: existing.id,
      requesterEmail: existing.email,
      requestStatus: existing.status,
      removedByUserId: admin.id ?? null,
      removedByEmail: admin.email ?? null,
      source: "admin_access_requests_legacy",
    });

    addAuditLogSafe({
      action: "access_request.deleted",
      entityType: "access_request",
      entityId: existing.id,
      entityLabel: existing.email,
      actorUserId: admin.id ?? null,
      actorEmail: admin.email ?? null,
      metadata: {
        source: "admin_access_requests_legacy",
        status: existing.status,
        requesterEmail: existing.email,
      },
    });

    const removed = await deleteAccessRequest(id);
    return NextResponse.json({ ok: removed });
  }

  const existing = await prisma.supportRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
  }

  await appendAccessRequestRemovalHistory({
    requestId: existing.id,
    requesterEmail: existing.email,
    requestStatus: existing.status,
    removedByUserId: admin.id ?? null,
    removedByEmail: admin.email ?? null,
    source: "admin_access_requests_support_request",
  });

  addAuditLogSafe({
    action: "access_request.deleted",
    entityType: "access_request",
    entityId: existing.id,
    entityLabel: existing.email,
    actorUserId: admin.id ?? null,
    actorEmail: admin.email ?? null,
    metadata: {
      source: "admin_access_requests_support_request",
      status: existing.status,
      requesterEmail: existing.email,
    },
  });

  const removed = await prisma.supportRequest.deleteMany({ where: { id } });
  return NextResponse.json({ ok: removed.count > 0 });
}

