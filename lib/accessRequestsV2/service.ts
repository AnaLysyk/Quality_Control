import { randomBytes, randomUUID } from "crypto";

import { createAccessRequestComment } from "@/data/accessRequestCommentsStore";
import { addAuditLogSafe, listAuditLogs } from "@/data/auditLogRepository";
import { createLocalUser, findLocalCompanyBySlug, findLocalUserByEmailOrId, upsertLocalLink, updateLocalUser } from "@/lib/auth/localStore";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { emailService } from "@/lib/email";
import type { AuthUser } from "@/lib/jwtAuth";
import { shouldUseJsonStore } from "@/lib/storeMode";
import {
  canApproveRequestedRole,
  canReviewAccessRequests,
  canViewAccessRequest,
  type AccessRequestV2,
  type AccessRequestV2Priority,
  type AccessRequestV2Status,
  type AccessRequestV2Type,
  getEffectiveUserRole,
  normalizeAccessRequestV2Priority,
  normalizeAccessRequestV2Status,
  normalizeAccessRequestV2Type,
} from "./domain";
import { createAccessRequestV2, getAccessRequestV2ById, listAccessRequestsV2, updateAccessRequestV2 } from "./repository";

function asText(value: unknown, max = 255) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function asEmail(value: unknown) {
  return asText(value, 255).toLowerCase();
}

function resolveRequestTypeFromPayload(payload: Record<string, unknown>) {
  return (
    normalizeAccessRequestV2Type(asText(payload.requestType, 80)) ??
    normalizeAccessRequestV2Type(asText(payload.profile_type, 80)) ??
    normalizeAccessRequestV2Type(asText(payload.access_type, 80)) ??
    "profile_change"
  );
}

function resolveRequestedRoleFromPayload(payload: Record<string, unknown>) {
  return (
    asText(payload.requestedRole, 80) ||
    asText(payload.profile_type, 80) ||
    asText(payload.role, 80) ||
    undefined
  );
}

function resolvePriorityFromPayload(payload: Record<string, unknown>): AccessRequestV2Priority {
  return normalizeAccessRequestV2Priority(asText(payload.priority, 20));
}

function mapStatusToLegacy(status: AccessRequestV2Status) {
  if (status === "pending") return "PENDING";
  if (status === "under_review") return "NEEDS_REVISION";
  if (status === "approved") return "APPROVED";
  if (status === "rejected") return "REJECTED";
  return "PENDING";
}

export async function createAccessRequestFromPayload(payload: Record<string, unknown>, req: Request, authUser: AuthUser | null) {
  const requesterEmail = asEmail(payload.requesterEmail) || asEmail(payload.email);
  const requesterName = asText(payload.requesterName) || asText(payload.full_name) || asText(payload.name);
  const requestedCompanySlug = asText(payload.requestedCompanySlug, 120) || asText(payload.company, 120) || undefined;
  const requestedCompanyId = asText(payload.requestedCompanyId, 120) || asText(payload.client_id, 120) || undefined;
  const reason = asText(payload.reason, 2000) || asText(payload.description, 2000) || asText(payload.notes, 2000) || undefined;

  if (!requesterEmail) {
    return { status: 400 as const, body: { message: "E-mail é obrigatório" } };
  }

  const created = await createAccessRequestV2({
    requesterUserId: authUser?.id,
    requesterEmail,
    requesterName: requesterName || undefined,
    requestType: resolveRequestTypeFromPayload(payload),
    requestedRole: resolveRequestedRoleFromPayload(payload),
    requestedCompanySlug,
    requestedCompanyId,
    targetUserId: asText(payload.targetUserId, 120) || undefined,
    reason,
    priority: resolvePriorityFromPayload(payload),
  });

  addAuditLogSafe({
    actorUserId: authUser?.id ?? null,
    actorEmail: authUser?.email ?? requesterEmail,
    action: "access_request.created",
    entityType: "access_request",
    entityId: created.id,
    entityLabel: `${created.requesterName ?? "Solicitante"} (${created.requesterEmail})`,
    metadata: {
      requestType: created.requestType,
      requestedRole: created.requestedRole ?? null,
      requestedCompanySlug: created.requestedCompanySlug ?? null,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    },
  });

  return { status: 201 as const, body: { item: created } };
}

export async function listAccessRequestsForUser(
  user: AuthUser,
  filters?: { status?: string | null; requestType?: string | null },
) {
  const status = normalizeAccessRequestV2Status(filters?.status ?? null) ?? undefined;
  const requestType = normalizeAccessRequestV2Type(filters?.requestType ?? null) ?? undefined;
  const canReview = canReviewAccessRequests(user);

  const items = await listAccessRequestsV2({
    requesterUserId: canReview ? undefined : user.id,
    status,
    requestType,
  });

  return {
    items,
    scope: canReview ? "all" : "own",
    canReview,
  };
}

export async function getAccessRequestForUser(id: string, user: AuthUser) {
  const request = await getAccessRequestV2ById(id);
  if (!request) return null;
  if (!canViewAccessRequest(user, request)) return "forbidden" as const;
  return request;
}

export async function patchAccessRequestForReviewer(
  id: string,
  patch: { status?: string | null; priority?: string | null; reviewComment?: string | null },
  reviewer: AuthUser,
) {
  if (!canReviewAccessRequests(reviewer)) return "forbidden" as const;

  const current = await getAccessRequestV2ById(id);
  if (!current) return null;

  const nextStatus = normalizeAccessRequestV2Status(patch.status ?? null) ?? current.status;
  const nextPriority = normalizeAccessRequestV2Priority(patch.priority ?? null) ?? current.priority;
  const reviewComment = asText(patch.reviewComment, 2000) || undefined;

  if (nextStatus === "rejected" && !reviewComment) {
    return "reject-comment-required" as const;
  }

  const updated = await updateAccessRequestV2(id, {
    status: nextStatus,
    priority: nextPriority,
    reviewComment,
    reviewedBy: reviewer.id,
    reviewedAt: new Date().toISOString(),
  });

  if (!updated) return null;

  addAuditLogSafe({
    actorUserId: reviewer.id,
    actorEmail: reviewer.email,
    action: nextStatus === "approved" ? "access_request.accepted" : nextStatus === "rejected" ? "access_request.rejected" : "access_request.updated",
    entityType: "access_request",
    entityId: updated.id,
    entityLabel: `${updated.requesterName ?? "Solicitante"} (${updated.requesterEmail})`,
    metadata: { nextStatus, nextPriority, reviewComment: reviewComment ?? null },
  });

  return updated;
}

async function applyApprovalEffects(request: AccessRequestV2, reviewer: AuthUser) {
  if (!request.requestedRole || !canApproveRequestedRole(reviewer, request.requestedRole)) {
    return "scope-denied" as const;
  }

  if (request.requesterUserId && request.requesterUserId === reviewer.id) {
    return "self-approval" as const;
  }

  const targetIdentifier = request.targetUserId || request.requesterUserId || request.requesterEmail;
  if (!targetIdentifier) return "target-missing" as const;

  const existingUser = await findLocalUserByEmailOrId(targetIdentifier);
  // Gera sempre senha temporária ao aprovar, para enviar por e-mail
  const tempPassword = randomBytes(10).toString("hex");
  const tempPasswordHash = hashPasswordSha256(tempPassword);

  const targetUser =
    existingUser ??
    (await createLocalUser({
      name: request.requesterName || request.requesterEmail,
      full_name: request.requesterName || request.requesterEmail,
      email: request.requesterEmail,
      password_hash: tempPasswordHash,
      role: request.requestedRole,
      status: "invited",
      active: true,
      user_origin: "testing_company",
    }));

  await updateLocalUser(targetUser.id, {
    role: request.requestedRole,
    status: "active",
    active: true,
    password_hash: tempPasswordHash,
  });

  if (request.requestedCompanySlug) {
    const company = await findLocalCompanyBySlug(request.requestedCompanySlug);
    if (company) {
      await upsertLocalLink({
        userId: targetUser.id,
        companyId: company.id,
        role: request.requestedRole,
      });
    }
  }

  addAuditLogSafe({
    actorUserId: reviewer.id,
    actorEmail: reviewer.email,
    action: "user.role.changed",
    entityType: "user",
    entityId: targetUser.id,
    entityLabel: targetUser.email,
    metadata: {
      source: "access_request_approval",
      requestId: request.id,
      requestedRole: request.requestedRole,
      requestedCompanySlug: request.requestedCompanySlug ?? null,
      forceRefreshMe: true,
    },
  });

  return { userId: targetUser.id, tempPassword, login: targetUser.email ?? request.requesterEmail };
}

export async function transitionAccessRequest(
  id: string,
  action: "start-review" | "approve" | "reject" | "request-info",
  reviewer: AuthUser,
  options?: { comment?: string | null; adjustmentFields?: string[] },
) {
  const request = await getAccessRequestV2ById(id);
  if (!request) return null;
  if (!canReviewAccessRequests(reviewer)) return "forbidden" as const;

  const comment = asText(options?.comment, 2000) || undefined;

  if (action === "reject" && !comment) return "reject-comment-required" as const;

  let nextStatus: AccessRequestV2Status = request.status;
  if (action === "start-review") nextStatus = "under_review";
  if (action === "approve") nextStatus = "approved";
  if (action === "reject") nextStatus = "rejected";
  if (action === "request-info") nextStatus = "needs_more_info";

  // Para approve: valida e captura credenciais em uma única chamada
  let approvalCredentials: { userId: string; tempPassword: string; login: string } | null = null;
  if (action === "approve") {
    const result = await applyApprovalEffects(request, reviewer);
    if (result === "self-approval") return result;
    if (result === "scope-denied") return result;
    if (result === "target-missing") return null;
    if (typeof result === "object") {
      approvalCredentials = result;
    }
  }

  const updated = await updateAccessRequestV2(id, {
    ...(action === "request-info" && options?.adjustmentFields ? { adjustmentFields: options.adjustmentFields } : {}),
    status: nextStatus,
    reviewedBy: reviewer.id,
    reviewedAt: new Date().toISOString(),
    reviewComment: comment,
  });
  if (!updated) return null;

  if (comment) {
    await createAccessRequestComment({
      requestId: id,
      authorRole: getEffectiveUserRole(reviewer) === "leader_tc" ? "leader_tc" : "admin",
      authorName: reviewer.email,
      authorEmail: reviewer.email,
      authorId: reviewer.id,
      body: comment,
    });
  }

  addAuditLogSafe({
    actorUserId: reviewer.id,
    actorEmail: reviewer.email,
    action: nextStatus === "approved" ? "access_request.accepted" : nextStatus === "rejected" ? "access_request.rejected" : "access_request.updated",
    entityType: "access_request",
    entityId: updated.id,
    entityLabel: `${updated.requesterName ?? "Solicitante"} (${updated.requesterEmail})`,
    metadata: { action, nextStatus, comment: comment ?? null },
  });

  // Enviar e-mails conforme ação
  const recipientEmail = request.requesterEmail;
  const recipientName = request.requesterName || null;

  if (action === "approve" && approvalCredentials) {
    emailService
      .sendAccessApprovedEmail(recipientEmail, {
        name: recipientName,
        login: approvalCredentials.login,
        tempPassword: approvalCredentials.tempPassword,
        profileType: request.requestedRole,
        companySlug: request.requestedCompanySlug,
      })
      .catch((err: unknown) => console.error("[email] sendAccessApprovedEmail falhou:", err));
  } else if (action === "reject") {
    emailService
      .sendAccessRejectedEmail(recipientEmail, {
        name: recipientName,
        comment,
        accessKey: request.accessKey,
      })
      .catch((err: unknown) => console.error("[email] sendAccessRejectedEmail falhou:", err));
  } else if (action === "request-info" && request.accessKey) {
    emailService
      .sendAccessAdjustmentEmail(recipientEmail, {
        name: recipientName,
        adjustmentFields: options?.adjustmentFields,
        comment,
        accessKey: request.accessKey,
      })
      .catch((err: unknown) => console.error("[email] sendAccessAdjustmentEmail falhou:", err));
  }

  return updated;
}

export async function getAccessRequestAudit(id: string, user: AuthUser) {
  const request = await getAccessRequestV2ById(id);
  if (!request) return null;
  if (!canViewAccessRequest(user, request)) return "forbidden" as const;

  if (shouldUseJsonStore()) {
    return [
      {
        id: `access-request-v2-${request.id}`,
        created_at: request.reviewedAt ?? request.updatedAt,
        actor_user_id: request.reviewedBy ?? request.requesterUserId ?? null,
        actor_email: user.email,
        action:
          request.status === "approved"
            ? "access_request.accepted"
            : request.status === "rejected"
              ? "access_request.rejected"
              : "access_request.updated",
        entity_type: "access_request",
        entity_id: request.id,
        entity_label: `${request.requesterName ?? "Solicitante"} (${request.requesterEmail})`,
        metadata: { status: request.status, requestType: request.requestType },
      },
    ];
  }

  const logs = await listAuditLogs({ entityType: "access_request", query: id, limit: 200 });
  return logs.filter((log) => log.entity_id === id || String(log.metadata ?? "").includes(id));
}

export function mapV2ToLegacyAdminRequest(request: AccessRequestV2) {
  return {
    id: request.id,
    userId: request.requesterUserId,
    userName: request.requesterName ?? request.requesterEmail,
    userEmail: request.requesterEmail,
    companyName: request.requestedCompanySlug ?? "",
    type: request.requestType.toUpperCase(),
    status: mapStatusToLegacy(request.status),
    payload: {
      profileType: request.requestedRole ?? null,
      requestType: request.requestType,
      reason: request.reason ?? null,
      priority: request.priority,
    },
    createdAt: request.createdAt,
    reviewNote: request.reviewComment,
  };
}
