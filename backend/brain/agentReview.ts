import "server-only";

import type { Prisma } from "@prisma/client";

import { brainPrisma } from "@/backend/brain/brainPrisma";

export type BrainAgentReviewAction = "approve" | "reject" | "review" | "archive";

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function clean(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function nowIso() {
  return new Date().toISOString();
}

export async function createBrainAgentReview(input: {
  requestedBy: string;
  companySlug?: string | null;
  companyId?: string | null;
  projectId?: string | null;
  title?: string;
  summary?: string;
  operationType?: string;
  target?: string;
  reason?: string | null;
  riskLevel?: "low" | "medium" | "high" | "critical";
  proposedPayload?: Record<string, unknown>;
}) {
  const payload = {
    kind: "brain_agent_review",
    requestedBy: input.requestedBy,
    requestedAt: nowIso(),
    companySlug: input.companySlug ?? null,
    companyId: input.companyId ?? null,
    projectId: input.projectId ?? null,
    operationType: clean(input.operationType, "operation.change"),
    target: clean(input.target, "operation"),
    reason: input.reason ?? null,
    riskLevel: input.riskLevel ?? "medium",
    proposedPayload: input.proposedPayload ?? {},
    approval: {
      required: true,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      acceptedBy: null,
      acceptedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      note: null,
    },
  };

  const item = await brainPrisma.brainInboxItem.create({
    data: {
      kind: "agent_operation_approval",
      companySlug: input.companySlug ?? null,
      status: "pending",
      title: clean(input.title, "Aceite necessário para ação do Brain"),
      summary: clean(input.summary, "O Brain recomendou uma ação que precisa de aceite antes de alterar dados operacionais."),
      payload: asJson(payload),
    },
  });

  await brainPrisma.brainAuditLog.create({
    data: {
      action: "BRAIN_AGENT_REVIEW_CREATED",
      entityType: "BrainAgentReview",
      entityId: item.id,
      userId: input.requestedBy,
      reason: input.reason ?? "brain.agent.review.created",
      after: asJson(payload),
    },
  });

  return item;
}

export async function reviewBrainAgentReview(input: {
  id: string;
  action: BrainAgentReviewAction;
  reviewedBy: string;
  note?: string | null;
}) {
  const item = await brainPrisma.brainInboxItem.findUnique({ where: { id: input.id } });

  if (!item || item.kind !== "agent_operation_approval") {
    throw new Error("Aceite do agente Brain não encontrado.");
  }

  const currentPayload = record(item.payload);
  const currentApproval = record(currentPayload.approval);
  const reviewedAt = nowIso();

  const statusByAction: Record<BrainAgentReviewAction, string> = {
    approve: "approved",
    reject: "rejected",
    review: "needs_review",
    archive: "archived",
  };

  const nextStatus = statusByAction[input.action];
  const approval = {
    ...currentApproval,
    required: true,
    status: nextStatus,
    reviewedBy: input.reviewedBy,
    reviewedAt,
    acceptedBy: input.action === "approve" ? input.reviewedBy : currentApproval.acceptedBy ?? null,
    acceptedAt: input.action === "approve" ? reviewedAt : currentApproval.acceptedAt ?? null,
    rejectedBy: input.action === "reject" ? input.reviewedBy : currentApproval.rejectedBy ?? null,
    rejectedAt: input.action === "reject" ? reviewedAt : currentApproval.rejectedAt ?? null,
    note: input.note?.trim() || null,
  };

  const nextPayload = {
    ...currentPayload,
    approval,
  };

  const updated = await brainPrisma.brainInboxItem.update({
    where: { id: input.id },
    data: {
      status: nextStatus,
      reviewedBy: input.reviewedBy,
      reviewedAt: new Date(),
      payload: asJson(nextPayload),
    },
  });

  await brainPrisma.brainAuditLog.create({
    data: {
      action: input.action === "approve" ? "BRAIN_AGENT_REVIEW_ACCEPTED" : input.action === "reject" ? "BRAIN_AGENT_REVIEW_REJECTED" : "BRAIN_AGENT_REVIEW_UPDATED",
      entityType: "BrainAgentReview",
      entityId: input.id,
      userId: input.reviewedBy,
      reason: input.note?.trim() || `brain.agent.review.${input.action}`,
      before: item.payload as Prisma.InputJsonValue,
      after: asJson(nextPayload),
    },
  });

  return updated;
}

export async function requireBrainAgentApproval(input: {
  approvalId: string;
  operationType?: string;
  target?: string;
}) {
  const item = await brainPrisma.brainInboxItem.findUnique({ where: { id: input.approvalId } });

  if (!item || item.kind !== "agent_operation_approval") {
    throw new Error("Alteração bloqueada: aceite do agente Brain não encontrado.");
  }

  if (item.status !== "approved") {
    throw new Error("Alteração bloqueada: aceite do agente Brain ainda não foi aprovado.");
  }

  const payload = record(item.payload);
  const approval = record(payload.approval);

  if (!approval.acceptedBy || !approval.acceptedAt) {
    throw new Error("Alteração bloqueada: aceite sem usuário/data auditados.");
  }

  if (input.operationType && payload.operationType !== input.operationType) {
    throw new Error("Alteração bloqueada: tipo da ação não confere com o aceite aprovado.");
  }

  if (input.target && payload.target !== input.target) {
    throw new Error("Alteração bloqueada: alvo da ação não confere com o aceite aprovado.");
  }

  return {
    approvalId: item.id,
    acceptedBy: String(approval.acceptedBy),
    acceptedAt: String(approval.acceptedAt),
    payload,
  };
}
