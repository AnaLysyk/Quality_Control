import { NextResponse } from "next/server";

import { createAccessRequestComment } from "@/data/accessRequestCommentsStore";
import { getAccessRequestById, updateAccessRequest } from "@/data/accessRequestsStore";
import {
  composeAccessRequestMessage,
  parseAccessRequestMessage,
  type AccessRequestAdjustmentField,
  type AccessRequestAdjustmentRound,
} from "@/lib/accessRequestMessage";
import { prisma } from "@/lib/prismaClient";
import { requireAccessRequestReviewerWithStatus } from "@/lib/rbac/requireAccessRequestReviewer";
import { canReviewerAccessQueue, resolveAccessRequestQueue } from "@/lib/requestReviewAccess";
import { shouldUseJsonStore } from "@/lib/storeMode";

type AdjustmentBody = {
  comment?: string | null;
  fields?: AccessRequestAdjustmentField[];
};

function isFinalStatus(status: string | null | undefined) {
  return status === "closed" || status === "rejected";
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireAccessRequestReviewerWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autenticado" : "Sem permissão" }, { status });
  }

  const body = (await req.json().catch(() => null)) as AdjustmentBody | null;
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";
  const fields = Array.isArray(body?.fields)
    ? body?.fields.filter((field): field is AccessRequestAdjustmentField => typeof field === "string" && field.trim().length > 0)
    : [];
  if (!comment) {
    return NextResponse.json({ error: "Informe a mensagem de ajuste para o solicitante" }, { status: 400 });
  }
  if (!fields.length) {
    return NextResponse.json({ error: "Selecione ao menos um campo para ajuste" }, { status: 400 });
  }

  const { id } = await context.params;

  if (shouldUseJsonStore()) {
    const existing = await getAccessRequestById(id);
    if (!existing) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
    }
    if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
      return NextResponse.json({ error: "Sem permissão para esta solicitação" }, { status: 403 });
    }
    if (isFinalStatus(existing.status)) {
      return NextResponse.json({ error: "Solicitação finalizada não aceita ajustes" }, { status: 409 });
    }

    const parsed = parseAccessRequestMessage(existing.message, existing.email);
    const round = (parsed.adjustmentRound || 0) + 1;
    const historyEntry: AccessRequestAdjustmentRound = {
      round,
      requestedAt: new Date().toISOString(),
      requestedFields: fields,
      requestMessage: comment,
      requesterReturnedAt: null,
      requesterDiff: [],
    };
    const message = composeAccessRequestMessage({
      email: parsed.email || existing.email,
      name: parsed.name,
      fullName: parsed.fullName,
      username: parsed.username,
      phone: parsed.phone,
      passwordHash: parsed.passwordHash,
      role: parsed.jobRole,
      company: parsed.company,
      clientId: parsed.clientId,
      accessType: parsed.accessType,
      profileType: parsed.profileType,
      title: parsed.title,
      description: parsed.description,
      notes: parsed.notes,
      companyProfile: parsed.companyProfile,
      originalRequest: parsed.originalRequest,
      adjustmentRound: round,
      adjustmentRequestedFields: fields,
      adjustmentHistory: [...parsed.adjustmentHistory, historyEntry],
      lastAdjustmentAt: parsed.lastAdjustmentAt,
      lastAdjustmentDiff: parsed.lastAdjustmentDiff,
    });

    const updated = await updateAccessRequest(id, { status: "in_progress", message });
    await createAccessRequestComment({
      requestId: id,
      authorRole: "leader_tc",
      authorName: admin.email || "Admin",
      authorEmail: admin.email || null,
      authorId: admin.id || null,
      body: comment,
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: updated?.id ?? id,
        status: updated?.status ?? "in_progress",
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
    if (isFinalStatus(existing.status)) {
      return NextResponse.json({ error: "Solicitação finalizada não aceita ajustes" }, { status: 409 });
    }

    const parsed = parseAccessRequestMessage(existing.message, existing.email);
    const round = (parsed.adjustmentRound || 0) + 1;
    const historyEntry: AccessRequestAdjustmentRound = {
      round,
      requestedAt: new Date().toISOString(),
      requestedFields: fields,
      requestMessage: comment,
      requesterReturnedAt: null,
      requesterDiff: [],
    };
    const message = composeAccessRequestMessage({
      email: parsed.email || existing.email,
      name: parsed.name,
      fullName: parsed.fullName,
      username: parsed.username,
      phone: parsed.phone,
      passwordHash: parsed.passwordHash,
      role: parsed.jobRole,
      company: parsed.company,
      clientId: parsed.clientId,
      accessType: parsed.accessType,
      profileType: parsed.profileType,
      title: parsed.title,
      description: parsed.description,
      notes: parsed.notes,
      companyProfile: parsed.companyProfile,
      originalRequest: parsed.originalRequest,
      adjustmentRound: round,
      adjustmentRequestedFields: fields,
      adjustmentHistory: [...parsed.adjustmentHistory, historyEntry],
      lastAdjustmentAt: parsed.lastAdjustmentAt,
      lastAdjustmentDiff: parsed.lastAdjustmentDiff,
    });

    const updated = await prisma.supportRequest.update({
      where: { id },
      data: { status: "in_progress", message },
    });

    await createAccessRequestComment({
      requestId: id,
      authorRole: "leader_tc",
      authorName: admin.email || "Admin",
      authorEmail: admin.email || null,
      authorId: admin.id || null,
      body: comment,
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: updated.id,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error("[ACCESS-REQUESTS][REQUEST-ADJUSTMENT][PRISMA_FALLBACK]", error);
    const existing = await getAccessRequestById(id);
    if (!existing) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
    }
    if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
      return NextResponse.json({ error: "Sem permissão para esta solicitação" }, { status: 403 });
    }
    if (isFinalStatus(existing.status)) {
      return NextResponse.json({ error: "Solicitação finalizada não aceita ajustes" }, { status: 409 });
    }

    const parsed = parseAccessRequestMessage(existing.message, existing.email);
    const round = (parsed.adjustmentRound || 0) + 1;
    const historyEntry: AccessRequestAdjustmentRound = {
      round,
      requestedAt: new Date().toISOString(),
      requestedFields: fields,
      requestMessage: comment,
      requesterReturnedAt: null,
      requesterDiff: [],
    };
    const message = composeAccessRequestMessage({
      email: parsed.email || existing.email,
      name: parsed.name,
      fullName: parsed.fullName,
      username: parsed.username,
      phone: parsed.phone,
      passwordHash: parsed.passwordHash,
      role: parsed.jobRole,
      company: parsed.company,
      clientId: parsed.clientId,
      accessType: parsed.accessType,
      profileType: parsed.profileType,
      title: parsed.title,
      description: parsed.description,
      notes: parsed.notes,
      companyProfile: parsed.companyProfile,
      originalRequest: parsed.originalRequest,
      adjustmentRound: round,
      adjustmentRequestedFields: fields,
      adjustmentHistory: [...parsed.adjustmentHistory, historyEntry],
      lastAdjustmentAt: parsed.lastAdjustmentAt,
      lastAdjustmentDiff: parsed.lastAdjustmentDiff,
    });

    const updated = await updateAccessRequest(id, { status: "in_progress", message });
    await createAccessRequestComment({
      requestId: id,
      authorRole: "leader_tc",
      authorName: admin.email || "Admin",
      authorEmail: admin.email || null,
      authorId: admin.id || null,
      body: comment,
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: updated?.id ?? id,
        status: updated?.status ?? "in_progress",
      },
    });
  }
}
