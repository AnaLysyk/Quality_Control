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

function readTextFromPayload(payload: Record<string, unknown>, keys: string[], max = 255) {
  for (const key of keys) {
    const value = asText(payload[key], max);
    if (value) return value;
  }

  return "";
}

function readRecordFromPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function buildCompanyDetailsForEmail(payload: Record<string, unknown>) {
  const companyDetails = readRecordFromPayload(payload.companyDetails);

  const details: Record<string, unknown> = {
    ...companyDetails,

    companyName:
      readTextFromPayload(companyDetails, ["companyName", "company_name", "razaoSocial", "razao_social"], 255) ||
      readTextFromPayload(payload, ["companyName", "company_name", "razaoSocial", "razao_social", "company_name"], 255),

    fantasyName:
      readTextFromPayload(companyDetails, ["fantasyName", "nomeFantasia", "nome_fantasia"], 255) ||
      readTextFromPayload(payload, ["fantasyName", "nomeFantasia", "nome_fantasia"], 255),

    cnpj:
      readTextFromPayload(companyDetails, ["cnpj", "companyTaxId", "company_tax_id"], 40) ||
      readTextFromPayload(payload, ["cnpj", "companyTaxId", "company_tax_id"], 40),

    cep:
      readTextFromPayload(companyDetails, ["cep", "companyCep", "company_cep"], 40) ||
      readTextFromPayload(payload, ["cep", "companyCep", "company_cep"], 40),

    address:
      readTextFromPayload(companyDetails, ["address", "endereco", "companyAddress", "company_address"], 255) ||
      readTextFromPayload(payload, ["address", "endereco", "companyAddress", "company_address"], 255),

    number:
      readTextFromPayload(companyDetails, ["number", "numero", "companyNumber", "company_number"], 40) ||
      readTextFromPayload(payload, ["number", "numero", "companyNumber", "company_number"], 40),

    complement:
      readTextFromPayload(companyDetails, ["complement", "complemento"], 255) ||
      readTextFromPayload(payload, ["complement", "complemento"], 255),

    district:
      readTextFromPayload(companyDetails, ["district", "bairro"], 120) ||
      readTextFromPayload(payload, ["district", "bairro"], 120),

    city:
      readTextFromPayload(companyDetails, ["city", "cidade", "municipio"], 120) ||
      readTextFromPayload(payload, ["city", "cidade", "municipio"], 120),

    state:
      readTextFromPayload(companyDetails, ["state", "uf"], 40) ||
      readTextFromPayload(payload, ["state", "uf"], 40),

    phone:
      readTextFromPayload(companyDetails, ["phone", "companyPhone", "phoneCompany", "company_phone"], 80) ||
      readTextFromPayload(payload, ["companyPhone", "phoneCompany", "company_phone"], 80),

    email:
      readTextFromPayload(companyDetails, ["email", "companyEmail", "emailCompany", "company_email"], 255) ||
      readTextFromPayload(payload, ["companyEmail", "emailCompany", "company_email"], 255),

    website:
      readTextFromPayload(companyDetails, ["website", "site", "companyWebsite", "company_website"], 255) ||
      readTextFromPayload(payload, ["website", "site", "companyWebsite", "company_website"], 255),

    linkedin:
      readTextFromPayload(companyDetails, ["linkedin", "linkedIn", "companyLinkedin", "companyLinkedIn"], 255) ||
      readTextFromPayload(payload, ["linkedin", "linkedIn", "companyLinkedin", "companyLinkedIn"], 255),
  };

  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => {
      if (value === null || value === undefined || value === "") return false;
      if (typeof value === "object") return false;
      return true;
    }),
  );
}


function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}


function asEmail(value: unknown) {
  return asText(value, 255).toLowerCase();
}

function pickFirstText(payload: Record<string, unknown>, keys: string[], max = 255) {
  for (const key of keys) {
    const value = asText(payload[key], max);
    if (value) return value;
  }

  return "";
}

function buildSafeAccessRequestDetails(payload: Record<string, unknown>) {
  const blocked = new Set([
    "password",
    "senha",
    "userPassword",
    "accessPassword",
    "requestPassword",
    "requestedPassword",
    "confirmPassword",
    "passwordConfirmation",
    "captcha",
    "token",
    "accessKey",
  ]);

  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => {
      if (blocked.has(key)) return false;
      if (value === null || value === undefined || value === "") return false;
      if (typeof value === "object") return false;
      return true;
    }),
  );
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

function shouldBlockDuplicateAccessRequests() {
  return String(process.env.ACCESS_REQUEST_BLOCK_DUPLICATES || "false").toLowerCase() === "true";
}

function normalizeDuplicateValue(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function isActiveDuplicateStatus(status: AccessRequestV2Status) {
  return status === "pending" || status === "under_review" || status === "needs_more_info";
}

export async function createAccessRequestFromPayload(payload: Record<string, unknown>, req: Request, authUser: AuthUser | null) {
  const requesterEmail = asEmail(payload.requesterEmail) || asEmail(payload.email);
  const requesterName = asText(payload.requesterName) || asText(payload.full_name) || asText(payload.name);
  const requestedCompanySlug = asText(payload.requestedCompanySlug, 120) || asText(payload.company, 120) || undefined;
  const requestedCompanyId = asText(payload.requestedCompanyId, 120) || asText(payload.client_id, 120) || undefined;
  const reason = asText(payload.reason, 2000) || asText(payload.description, 2000) || asText(payload.notes, 2000) || undefined;
  const requestedPassword = readTextFromPayload(payload, [
    "password",
    "senha",
    "plainPassword",
    "userPassword",
    "accessPassword",
    "requestPassword",
    "requestedPassword",
  ], 255);
  const requestedPasswordHash = requestedPassword ? hashPasswordSha256(requestedPassword) : undefined;
  const companyDetailsPayload = asRecord(payload.companyDetails);
  const requestedUser =
    asText(payload.user, 120) ||
    asText(payload.requestedUser, 120) ||
    asText(payload.targetUserId, 120) ||
    undefined;
  const phone = asText(payload.phone, 80) || undefined;
  const title = asText(payload.title, 255) || undefined;
  const companyLabel = requestedCompanySlug || requestedCompanyId || undefined;

  if (!requesterEmail) {
    return { status: 400 as const, body: { message: "E-mail é obrigatório" } };
  }

  if (shouldBlockDuplicateAccessRequests()) {
    const normalizedEmail = normalizeDuplicateValue(requesterEmail);
    const normalizedUser = normalizeDuplicateValue(requestedUser);

    const duplicate = (await listAccessRequestsV2()).find((item) => {
      if (!isActiveDuplicateStatus(item.status)) return false;

      const sameEmail = normalizeDuplicateValue(item.requesterEmail) === normalizedEmail;
      const sameUser =
        normalizedUser.length > 0 &&
        normalizeDuplicateValue(item.targetUserId) === normalizedUser;

      return sameEmail || sameUser;
    });

    if (duplicate) {
      const duplicatedByEmail = normalizeDuplicateValue(duplicate.requesterEmail) === normalizedEmail;
      const duplicatedByUser =
        normalizedUser.length > 0 &&
        normalizeDuplicateValue(duplicate.targetUserId) === normalizedUser;

      const duplicatedFields = [
        duplicatedByEmail ? "e-mail" : null,
        duplicatedByUser ? "usuário" : null,
      ].filter(Boolean).join(" e ");

      return {
        status: 409 as const,
        body: {
          ok: false,
          code: "DUPLICATE_ACCESS_REQUEST",
          message: `Já existe uma solicitação de acesso aberta ou em análise para este ${duplicatedFields}. Consulte a solicitação existente antes de criar uma nova.`,
          item: {
            id: duplicate.id,
            accessKey: duplicate.accessKey ?? null,
            status: duplicate.status,
            requesterEmail: duplicate.requesterEmail,
            targetUserId: duplicate.targetUserId ?? null,
          },
        },
      };
    }
  }

  const created = await createAccessRequestV2({
    requesterUserId: authUser?.id,
    requesterEmail,
    requesterName: requesterName || undefined,
    requestType: resolveRequestTypeFromPayload(payload),
    requestedRole: resolveRequestedRoleFromPayload(payload),
    requestedCompanySlug,
    requestedCompanyId,
    targetUserId: requestedUser,
    reason,
    priority: resolvePriorityFromPayload(payload),
  });

  const companyEmailDetails = {
    ...companyDetailsPayload,
    companyName:
      pickFirstText(companyDetailsPayload, ["companyName", "company_name", "razaoSocial", "razao_social", "company"], 255) ||
      pickFirstText(payload, ["companyName", "company_name", "razaoSocial", "razao_social", "company"], 255),
    fantasyName:
      pickFirstText(companyDetailsPayload, ["fantasyName", "nomeFantasia", "nome_fantasia"], 255) ||
      pickFirstText(payload, ["fantasyName", "nomeFantasia", "nome_fantasia"], 255),
    cnpj:
      pickFirstText(companyDetailsPayload, ["cnpj", "companyTaxId", "company_tax_id", "companyCnpj", "company_cnpj"], 40) ||
      pickFirstText(payload, ["cnpj", "companyTaxId", "company_tax_id", "companyCnpj", "company_cnpj"], 40),
    cep:
      pickFirstText(companyDetailsPayload, ["cep", "companyCep", "company_cep"], 40) ||
      pickFirstText(payload, ["cep", "companyCep", "company_cep"], 40),
    address:
      pickFirstText(companyDetailsPayload, ["address", "endereco", "companyAddress", "company_address"], 255) ||
      pickFirstText(payload, ["address", "endereco", "companyAddress", "company_address"], 255),
    number:
      pickFirstText(companyDetailsPayload, ["number", "numero", "companyNumber", "company_number"], 40) ||
      pickFirstText(payload, ["number", "numero", "companyNumber", "company_number"], 40),
    complement:
      pickFirstText(companyDetailsPayload, ["complement", "complemento"], 255) ||
      pickFirstText(payload, ["complement", "complemento"], 255),
    district:
      pickFirstText(companyDetailsPayload, ["district", "bairro"], 120) ||
      pickFirstText(payload, ["district", "bairro"], 120),
    city:
      pickFirstText(companyDetailsPayload, ["city", "cidade", "municipio"], 120) ||
      pickFirstText(payload, ["city", "cidade", "municipio"], 120),
    state:
      pickFirstText(companyDetailsPayload, ["state", "uf"], 40) ||
      pickFirstText(payload, ["state", "uf"], 40),
    phone:
      pickFirstText(companyDetailsPayload, ["phone", "companyPhone", "phoneCompany", "company_phone"], 80) ||
      pickFirstText(payload, ["companyPhone", "phoneCompany", "company_phone"], 80),
    email:
      pickFirstText(companyDetailsPayload, ["email", "companyEmail", "emailCompany", "company_email"], 255) ||
      pickFirstText(payload, ["companyEmail", "emailCompany", "company_email"], 255),
    website:
      pickFirstText(companyDetailsPayload, ["website", "site", "companyWebsite", "company_website"], 255) ||
      pickFirstText(payload, ["website", "site", "companyWebsite", "company_website"], 255),
    linkedin:
      pickFirstText(companyDetailsPayload, ["linkedin", "linkedIn", "companyLinkedin", "companyLinkedIn"], 255) ||
      pickFirstText(payload, ["linkedin", "linkedIn", "companyLinkedin", "companyLinkedIn"], 255),
    situation:
      pickFirstText(companyDetailsPayload, ["situation", "situacao", "descricao_situacao_cadastral"], 120) ||
      pickFirstText(payload, ["situation", "situacao", "descricao_situacao_cadastral"], 120),
    openingDate:
      pickFirstText(companyDetailsPayload, ["openingDate", "dataAbertura", "data_inicio_atividade"], 80) ||
      pickFirstText(payload, ["openingDate", "dataAbertura", "data_inicio_atividade"], 80),
    legalNature:
      pickFirstText(companyDetailsPayload, ["legalNature", "naturezaJuridica", "natureza_juridica"], 255) ||
      pickFirstText(payload, ["legalNature", "naturezaJuridica", "natureza_juridica"], 255),
    mainActivity:
      pickFirstText(companyDetailsPayload, ["mainActivity", "atividadePrincipal", "cnae_fiscal_descricao"], 255) ||
      pickFirstText(payload, ["mainActivity", "atividadePrincipal", "cnae_fiscal_descricao"], 255),
    size:
      pickFirstText(companyDetailsPayload, ["size", "porte"], 80) ||
      pickFirstText(payload, ["size", "porte"], 80),
    shareCapital:
      pickFirstText(companyDetailsPayload, ["shareCapital", "capitalSocial", "capital_social"], 80) ||
      pickFirstText(payload, ["shareCapital", "capitalSocial", "capital_social"], 80),
  };

  const passwordForReceivedEmail = readTextFromPayload(payload, [
    "password",
    "senha",
    "plainPassword",
    "userPassword",
    "accessPassword",
    "requestPassword",
    "requestedPassword",
  ], 255);

  const companyDetailsForReceivedEmail = buildCompanyDetailsForEmail(payload);

  console.log("[ACCESS-REQUESTS][V2][EMAIL][PAYLOAD]", {
    hasPassword: Boolean(passwordForReceivedEmail),
    companyDetailKeys: Object.keys(companyDetailsForReceivedEmail),
  });

  void emailService.sendAccessRequestReceivedEmail(requesterEmail, {
    name: requesterName || null,
    accessKey: created.accessKey ?? created.id,
    email: requesterEmail,
    phone,
    password: passwordForReceivedEmail || requestedPassword || null,
    companyDetails: companyDetailsForReceivedEmail,
    profileType: created.requestType,
    role: created.requestedRole ?? null,
    title: title ?? null,
    description: reason ?? null,
    company: companyLabel ?? null,
  }).then((sent) => {
    console.log("[ACCESS-REQUESTS][V2][EMAIL][RECEIVED]", sent ? "sent" : "not_sent", requesterEmail);
  }).catch((error) => {
    console.warn("[ACCESS-REQUESTS][V2][EMAIL][RECEIVED] failed:", error);
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
  const passwordFromRequest = Boolean(request.requestedPasswordHash);
  const fallbackPassword = randomBytes(10).toString("hex");
  const passwordHash = request.requestedPasswordHash ?? hashPasswordSha256(fallbackPassword);

  const targetUser =
    existingUser ??
    (await createLocalUser({
      name: request.requesterName || request.requesterEmail,
      full_name: request.requesterName || request.requesterEmail,
      email: request.requesterEmail,
      password_hash: passwordHash,
      role: request.requestedRole,
      status: "invited",
      active: true,
      user_origin: "testing_company",
    }));

  await updateLocalUser(targetUser.id, {
    role: request.requestedRole,
    status: "active",
    active: true,
    password_hash: passwordHash,
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

  return {
    userId: targetUser.id,
    login: targetUser.email ?? request.requesterEmail,
    tempPassword: passwordFromRequest ? null : fallbackPassword,
    passwordFromRequest,
  };
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
  let approvalCredentials: { userId: string; tempPassword: string | null; login: string; passwordFromRequest: boolean } | null = null;
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
        passwordFromRequest: approvalCredentials.passwordFromRequest,
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
