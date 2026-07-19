import { NextResponse } from "next/server";

import { createAccessRequestComment } from "@/data/access-requests/commentsStore";
import { getAccessRequestById, updateAccessRequest } from "@/data/access-requests/store";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import {
  composeAccessRequestMessage,
  parseAccessRequestMessage,
  type AccessRequestAdjustmentField,
  type AccessRequestAdjustmentRound,
} from "@/backend/access-requests/message";
import { notifyAccessRequestAdjustmentRequested } from "@/backend/notificationService";
import { prisma } from "@/database/prismaClient";
import { requireAccessRequestReviewerWithStatus } from "@/backend/rbac/requireAccessRequestReviewer";
import type { AdminSession } from "@/backend/rbac/requireGlobalAdmin";
import { canReviewerAccessQueue, resolveAccessRequestQueue } from "@/backend/access-requests/reviewAccess";
import { resolveReviewQueue } from "@/backend/access-requests/routing";
import { shouldUseJsonStore } from "@/backend/storeMode";
import { getAccessRequestV2ById } from "@/backend/access-requests/repository";
import { transitionAccessRequest } from "@/backend/access-requests/service";

type AdjustmentBody = {
  comment?: string | null;
  fields?: AccessRequestAdjustmentField[];
  fieldComments?: Record<string, string>;
};

function isFinalStatus(status: string | null | undefined) {
  return status === "closed" || status === "rejected";
}

function sanitizeFieldComments(
  fields: AccessRequestAdjustmentField[],
  value: unknown,
): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  return fields.reduce<Record<string, string>>((acc, field) => {
    const comment = source[field];
    if (typeof comment !== "string") return acc;
    const trimmed = comment.trim();
    if (trimmed) acc[field] = trimmed.slice(0, 1000);
    return acc;
  }, {});
}

async function notifyAndAuditAdjustment(input: {
  id: string;
  email: string;
  message: string;
  admin: { id?: string | null; email?: string | null };
  comment: string;
  fields: AccessRequestAdjustmentField[];
  fieldComments: Record<string, string>;
}) {
  const parsed = parseAccessRequestMessage(input.message, input.email);
  await notifyAccessRequestAdjustmentRequested({
    requestId: input.id,
    requesterName: parsed.fullName || parsed.name || input.email,
    reviewerName: input.admin.email || "Admin",
    profileType: parsed.profileType,
    reviewQueue: resolveReviewQueue(parsed.profileType),
    fields: input.fields,
    clientId: parsed.clientId,
  }).catch((error) => {
    console.error("[ACCESS_REQUEST_NOTIFICATION][legacy-adjustment]", error);
  });

  addAuditLogSafe({
    action: "access_request.updated",
    entityType: "access_request",
    entityId: input.id,
    entityLabel: input.email ?? null,
    actorUserId: input.admin.id ?? null,
    actorEmail: input.admin.email ?? null,
    metadata: {
      event: "adjustment_requested",
      fields: input.fields,
      comment: input.comment,
      fieldComments: input.fieldComments,
    },
  });
}

function checkAdjustmentEligibility(
  admin: AdminSession,
  existing: { message: string; email: string; status: string | null },
) {
  if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
    return NextResponse.json({ error: "Sem permissão para esta solicitação" }, { status: 403 });
  }
  if (isFinalStatus(existing.status)) {
    return NextResponse.json({ error: "Solicitação finalizada não aceita ajustes" }, { status: 409 });
  }
  return null;
}

function buildAdjustmentMessage(
  existing: { message: string; email: string },
  fields: AccessRequestAdjustmentField[],
  comment: string,
  fieldComments: Record<string, string>,
) {
  const parsed = parseAccessRequestMessage(existing.message, existing.email);
  const round = (parsed.adjustmentRound || 0) + 1;
  const historyEntry: AccessRequestAdjustmentRound = {
    round,
    requestedAt: new Date().toISOString(),
    requestedFields: fields,
    requestMessage: comment,
    fieldComments,
    requesterReturnedAt: null,
    requesterDiff: [],
  };
  return composeAccessRequestMessage({
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
}

async function finalizeAdjustment(input: {
  id: string;
  email: string;
  message: string;
  admin: { id?: string | null; email?: string | null };
  comment: string;
  fields: AccessRequestAdjustmentField[];
  fieldComments: Record<string, string>;
}) {
  await createAccessRequestComment({
    requestId: input.id,
    authorRole: "leader_tc",
    authorName: input.admin.email || "Admin",
    authorEmail: input.admin.email || null,
    authorId: input.admin.id || null,
    body: input.comment,
  });
  await notifyAndAuditAdjustment(input);
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
  const fieldComments = sanitizeFieldComments(fields, body?.fieldComments);

  const { id } = await context.params;

  const v2Request = await getAccessRequestV2ById(id);
  if (v2Request?.accessKey) {
    const result = await transitionAccessRequest(
      id,
      "request-info",
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
      {
        comment,
        adjustmentFields: fields,
        fieldComments,
      },
    );
    if (result === "adjustment-details-required") {
      return NextResponse.json({ error: "Informe comentario e campos para ajuste" }, { status: 400 });
    }
    if (result === "invalid-transition") {
      return NextResponse.json({ error: "Solicitacao finalizada nao aceita ajustes" }, { status: 409 });
    }
    if (typeof result === "string") {
      return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    }
    if (!result) {
      return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item: { id: result.id, status: "in_progress" } });
  }

  if (shouldUseJsonStore()) {
    const existing = await getAccessRequestById(id);
    if (!existing) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
    }
    const eligibilityError = checkAdjustmentEligibility(admin, existing);
    if (eligibilityError) return eligibilityError;

    const message = buildAdjustmentMessage(existing, fields, comment, fieldComments);
    const updated = await updateAccessRequest(id, { status: "in_progress", message });
    await finalizeAdjustment({ id, email: existing.email, message, admin, comment, fields, fieldComments });

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
    const eligibilityError = checkAdjustmentEligibility(admin, existing);
    if (eligibilityError) return eligibilityError;

    const message = buildAdjustmentMessage(existing, fields, comment, fieldComments);
    const updated = await prisma.supportRequest.update({
      where: { id },
      data: { status: "in_progress", message },
    });
    await finalizeAdjustment({ id, email: existing.email, message, admin, comment, fields, fieldComments });

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
    const eligibilityError = checkAdjustmentEligibility(admin, existing);
    if (eligibilityError) return eligibilityError;

    const message = buildAdjustmentMessage(existing, fields, comment, fieldComments);
    const updated = await updateAccessRequest(id, { status: "in_progress", message });
    await finalizeAdjustment({ id, email: existing.email, message, admin, comment, fields, fieldComments });

    return NextResponse.json({
      ok: true,
      item: {
        id: updated?.id ?? id,
        status: updated?.status ?? "in_progress",
      },
    });
  }
}
