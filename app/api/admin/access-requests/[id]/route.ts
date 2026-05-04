import { NextResponse } from "next/server";

import { getAccessRequestById, updateAccessRequest } from "@/data/accessRequestsStore";
import {
  composeAccessRequestMessage,
  normalizeAccessType,
  parseAccessRequestMessage,
} from "@/lib/accessRequestMessage";
import { prisma } from "@/lib/prismaClient";
import { requireAccessRequestReviewerWithStatus } from "@/lib/rbac/requireAccessRequestReviewer";
import { canReviewerAccessQueue, isGlobalReviewer, resolveAccessRequestQueue } from "@/lib/requestReviewAccess";
import {
  normalizeRequestProfileType,
  resolveReviewQueue,
  toInternalAccessType,
} from "@/lib/requestRouting";
import { shouldUseJsonStore } from "@/lib/storeMode";

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

  const { id } = await context.params;
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
      passwordHash: parsed.passwordHash,
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
      passwordHash: parsed.passwordHash,
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
      passwordHash: parsed.passwordHash,
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
