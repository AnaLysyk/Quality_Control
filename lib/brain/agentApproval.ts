import "server-only";

import type { Prisma } from "@prisma/client";

import { brainPrisma } from "@/lib/brain/brainPrisma";

export type BrainAgentOperationRisk = "low" | "medium" | "high" | "critical";

export type BrainAgentOperationProposalInput = {
  requestedBy: string;
  companyId?: string | null;
  companySlug?: string | null;
  projectId?: string | null;
  title: string;
  summary: string;
  operationType: string;
  target: string;
  payload?: Record<string, unknown>;
  reason?: string | null;
  riskLevel?: BrainAgentOperationRisk;
};

export type BrainAgentApprovalAction = "approve" | "reject" | "review" | "archive";

function nowIso() {
  return new Date().toISOString();
}

function toJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeText(value: string, fallback: string) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export async function createBrainAgentOperationProposal(input: BrainAgentOperationProposalInput) {
  const title = normalizeText(input.title, "Ação operacional sugerida pelo Brain");
  const summary = normalizeText(input.summary, "O Brain sugeriu uma ação que pode alterar dados operacionais.");
  const operationType = normalizeText(input.operationType, "operation.mutation");
  const target = normalizeText(input.target, "operation.database");
  const riskLevel = input.riskLevel ?? "medium";

  const payload = {
    kind: "brain_agent_operation_proposal",
    operationType,
    target,
    reason: input.reason ?? null,
    requestedBy: input.requestedBy,
    requestedAt: nowIso(),
    companyId: input.companyId ?? null,
    companySlug: input.companySlug ?? null,
    projectId: input.projectId ?? null,
    riskLevel,
    proposedPayload: input.payload ?? {},
    approval: {
      required: true,
      status: "pending",
      acceptedBy: null,
      acceptedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      note: null,
    },
  };

  const suggestion = await brainPrisma.brainSuggestion.create({
    data: {
      companySlug: input.companySlug ?? null,
      projectId: input.projectId ?? null,
      targetNodeId: "brain-agent-operation",
      type: "agent_operation_approval",
      title,
      description: summary,
      confidence: 0.8,
      status: "suggested",
      createdBy: input.requestedBy,
      riskLevel,
      requiresReview: true,
      metadata: toJson(payload),
    },
  });

  const item = await brainPrisma.brainInboxItem.create({
    data: {
      kind: "agent_operation_approval",
      companySlug: input.companySlug ?? null,
      status: "pending",
      title,
      summary,
      payload: toJson(payload),
      suggestionId: suggestion.id,
    },
    include: { suggestion: true },
  });

  await brainPrisma.brainAuditLog.create({
    data: {
      action: "AGENT_OPERATION_PROPOSED",
      entityType: "BrainAgentOperation",
      entityId: item.id,
      userId: input.requestedBy,
      reason: input.reason ?? "brain.agent.proposal",
      after: toJson(payload),
    },
  });

  return item;
}

export async function reviewBrainAgentOperationProposal(input: {
  id: string;
  action: BrainAgentApprovalAction;
  reviewedBy: string;
  note?: string | null;
}) {
  const item = await brainPrisma.brainInboxItem.findUnique({
    where: { id: input.id },
    include: { suggestion: true },
  });

  if (!item) {
    throw new Error("Proposta de ação do Brain não encontrada.");
  }

  if (item.kind !== "agent_operation_approval") {
    throw new Error("Item informado não é uma proposta de ação operacional do Brain.");
  }

  const currentPayload = readRecord(item.payload);
  const currentApproval = readRecord(currentPayload.approval);
  const reviewedAt = nowIso();

  const statusByAction: Record<BrainAgentApprovalAction, string> = {
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
    acceptedBy: input.action === "approve" ? input.reviewedBy : currentApproval.acceptedBy ?? null,
    acceptedAt: input.action === "approve" ? reviewedAt : currentApproval.acceptedAt ?? null,
    rejectedBy: input.action === "reject" ? input.reviewedBy : currentApproval.rejectedBy ?? null,
    rejectedAt: input.action === "reject" ? reviewedAt : currentApproval.rejectedAt ?? null,
    reviewedBy: input.reviewedBy,
    reviewedAt,
    note: input.note?.trim() || null,
  };

  const payload = {
    ...currentPayload,
    approval,
  };

  const updated = await brainPrisma.brainInboxItem.update({
    where: { id: input.id },
    data: {
      status: nextStatus,
      reviewedBy: input.reviewedBy,
      reviewedAt: new Date(),
      payload: toJson(payload),
    },
    include: { suggestion: true },
  });

  if (item.suggestionId) {
    const suggestionStatus: Record<string, string> = {
      approved: "accepted",
      rejected: "rejected",
      needs_review: "suggested",
      archived: "archived",
    };

    await brainPrisma.brainSuggestion.update({
      where: { id: item.suggestionId },
      data: {
        status: suggestionStatus[nextStatus] ?? "suggested",
        metadata: toJson(payload),
      },
    });
  }

  await brainPrisma.brainAuditLog.create({
    data: {
      action: input.action === "approve" ? "AGENT_OPERATION_ACCEPTED" : input.action === "reject" ? "AGENT_OPERATION_REJECTED" : "AGENT_OPERATION_REVIEWED",
      entityType: "BrainAgentOperation",
      entityId: input.id,
      userId: input.reviewedBy,
      reason: input.note?.trim() || `brain.agent.${input.action}`,
      before: item.payload as Prisma.InputJsonValue,
      after: toJson(payload),
    },
  });

  return updated;
}

export async function assertBrainAgentOperationAccepted(input: {
  approvalId: string;
  operationType?: string;
  target?: string;
}) {
  const item = await brainPrisma.brainInboxItem.findUnique({
    where: { id: input.approvalId },
    include: { suggestion: true },
  });

  if (!item) {
    throw new Error("Ação operacional bloqueada: aceite do Brain não encontrado.");
  }

  if (item.kind !== "agent_operation_approval" || item.status !== "approved") {
    throw new Error("Ação operacional bloqueada: proposta do Brain ainda não foi aprovada.");
  }

  const payload = readRecord(item.payload);
  const approval = readRecord(payload.approval);

  if (!approval.acceptedBy || !approval.acceptedAt) {
    throw new Error("Ação operacional bloqueada: aceite não possui usuário/data auditados.");
  }

  if (input.operationType && payload.operationType !== input.operationType) {
    throw new Error("Ação operacional bloqueada: tipo de operação diferente do aceite aprovado.");
  }

  if (input.target && payload.target !== input.target) {
    throw new Error("Ação operacional bloqueada: alvo diferente do aceite aprovado.");
  }

  return {
    approvalId: item.id,
    acceptedBy: String(approval.acceptedBy),
    acceptedAt: String(approval.acceptedAt),
    payload,
  };
}
