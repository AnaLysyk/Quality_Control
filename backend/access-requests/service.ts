import { randomBytes } from "crypto";
import { createAccessRequestComment, listAccessRequestComments } from "@/data/access-requests/commentsStore";
import { addAuditLogSafe, listAuditLogs } from "@/data/auditLogRepository";
import {
  createLocalCompany,
  createLocalUser,
  findLocalCompanyById,
  findLocalCompanyBySlug,
  findLocalUserByEmailOrId,
  listLocalLinksForUser,
  listLocalCompanies,
  removeLocalLink,
  upsertLocalLink,
  updateLocalUser,
} from "@/backend/auth/localStore";
import { hashPassword } from "@/backend/passwordHash";
import { createAccessRequestLookupCodeExpiresAt, isAccessRequestLookupCodeExpired } from "@/backend/access-requests/accessKeyExpiration";
import { emailService } from "@/backend/email";
import type { AuthUser } from "@/backend/jwtAuth";
import { shouldUseJsonStore } from "@/backend/storeMode";
import { composeAccessRequestMessage } from "@/backend/access-requests/message";
import { normalizeAccessRequestLookup } from "@/backend/access-requests/lookup";
import { resolveReviewQueue, toInternalAccessType } from "@/backend/access-requests/routing";
import {
  notifyAccessRequestAccepted,
  notifyAccessRequestAdjustmentRequested,
  notifyAccessRequestCreated,
  notifyAccessRequestRejected,
} from "@/backend/notificationService";
import {
  resolveEditableProfileUserState,
  toStoredEditableUserRole,
} from "@/backend/editableProfileRoles";
import {
  canApproveRequestedRole,
  canReviewAccessRequests,
  canViewAccessRequest,
  canTransitionAccessRequest,
  ACCESS_REQUEST_ADJUSTMENT_FIELD_LABELS,
  accessRequestProfileNeedsCompany,
  accessRequestProfileUsesAutomaticCompany,
  isAccessRequestFinalStatus,
  normalizeAccessRequestAdjustmentFields,
  normalizeAccessRequestProfileType,
  type AccessRequestAdjustmentEntry,
  type AccessRequestAdjustmentField,
  type AccessRequestV2,
  type AccessRequestV2Priority,
  type AccessRequestV2Status,
  type AccessRequestVisualProfile,
  type AccessRequestReviewSummary,
  getEffectiveUserRole,
  normalizeAccessRequestV2Priority,
  normalizeAccessRequestV2Status,
  normalizeAccessRequestV2Type,
} from "./domain";
import { createAccessRequestV2, getAccessRequestV2ById, getAccessRequestV2ByKey, listAccessRequestsV2, updateAccessRequestV2 } from "./repository";

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

function createPublicAccessRequestKey() {
  return randomBytes(20).toString("hex");
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

    description:
      readTextFromPayload(companyDetails, ["description", "companyDescription", "company_description"], 1000) ||
      readTextFromPayload(payload, ["companyDescription", "company_description"], 1000),

    notes:
      readTextFromPayload(companyDetails, ["notes", "companyNotes", "company_notes"], 1000) ||
      readTextFromPayload(payload, ["companyNotes", "company_notes"], 1000),
  };

  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => {
      if (value === null || value === undefined || value === "") return false;
      if (typeof value === "object") return false;
      return true;
    }),
  );
}

function buildRequestDetails(payload: Record<string, unknown>) {
  const company = buildCompanyDetailsForEmail(payload);
  return {
    username:
      readTextFromPayload(payload, ["user", "username", "requestedUser"], 120) || undefined,
    phone: readTextFromPayload(payload, ["phone", "telefone"], 80) || undefined,
    jobRole: readTextFromPayload(payload, ["role", "jobRole", "cargo"], 255) || undefined,
    title: readTextFromPayload(payload, ["title", "titulo"], 255) || undefined,
    description:
      readTextFromPayload(payload, ["description", "reason", "descricao"], 2000) || undefined,
    notes: readTextFromPayload(payload, ["notes", "observacoes"], 2000) || undefined,
    company: Object.keys(company).length ? company : undefined,
  };
}

function normalizeVisualProfileFromPayload(
  payload: Record<string, unknown>,
  current?: AccessRequestVisualProfile,
): AccessRequestVisualProfile | undefined {
  const avatarKind = readTextFromPayload(payload, ["avatarKind", "profileAvatarKind"], 20);
  const avatarValue = readTextFromPayload(payload, ["avatarValue", "profileEmoji", "profileAvatarValue"], 255);
  const avatarLabel = readTextFromPayload(payload, ["avatarLabel", "profileAvatarLabel"], 120);

  if (!avatarKind && !avatarValue && !avatarLabel) return current;

  const safeKind =
    avatarKind === "gif" || avatarKind === "emoji" || avatarKind === "default" || avatarKind === "image"
      ? avatarKind
      : avatarValue
        ? avatarValue.startsWith("data:image/")
          ? "image"
          : "emoji"
        : "default";

  return {
    avatarKind: safeKind,
    avatarValue: avatarValue || current?.avatarValue || "",
    avatarLabel: avatarLabel || current?.avatarLabel || "Perfil sem foto",
  };
}

function normalizeReviewSummaryFromPayload(input: {
  payload: Record<string, unknown>;
  current?: AccessRequestReviewSummary;
  reviewer?: AuthUser;
  changedCount?: number;
  pendingFieldCount?: number;
  requiredFieldsOk?: boolean;
  passwordDefined?: boolean;
  companyDefined?: boolean;
}): AccessRequestReviewSummary | undefined {
  const internalNotes = readTextFromPayload(input.payload, ["internalNotes", "internal_notes", "reviewInternalNotes"], 4000);
  const visualStatus = readTextFromPayload(input.payload, ["visualStatus", "reviewVisualStatus"], 40);

  if (!internalNotes && !visualStatus && !input.current) return undefined;

  const safeStatus =
    visualStatus === "ready" ||
    visualStatus === "needs_adjustment" ||
    visualStatus === "rejected" ||
    visualStatus === "approved" ||
    visualStatus === "draft"
      ? visualStatus
      : input.current?.visualStatus ?? "draft";

  return {
    ...(input.current ?? {}),
    ...(internalNotes ? { internalNotes } : {}),
    visualStatus: safeStatus,
    lastReviewedAt: new Date().toISOString(),
    lastReviewedBy: input.reviewer?.email ?? input.reviewer?.id ?? input.current?.lastReviewedBy,
    changedCount: input.changedCount ?? input.current?.changedCount ?? 0,
    pendingFieldCount: input.pendingFieldCount ?? input.current?.pendingFieldCount ?? 0,
    requiredFieldsOk: input.requiredFieldsOk ?? input.current?.requiredFieldsOk ?? false,
    passwordDefined: input.passwordDefined ?? input.current?.passwordDefined ?? false,
    companyDefined: input.companyDefined ?? input.current?.companyDefined ?? false,
  };
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

function shouldBlockDuplicateAccessRequests() {
  return String(process.env.ACCESS_REQUEST_BLOCK_DUPLICATES || "false").toLowerCase() === "true";
}

function normalizeDuplicateValue(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

async function isIdentityTokenTakenByAnotherUser(
  token: string | null | undefined,
  owner: { userId?: string | null; email?: string | null },
) {
  const normalized = normalizeDuplicateValue(token);
  if (!normalized) return false;

  const existing = await findLocalUserByEmailOrId(normalized);
  if (!existing) return false;

  const ownerId = normalizeDuplicateValue(owner.userId);
  const ownerEmail = normalizeDuplicateValue(owner.email);
  if (ownerId && normalizeDuplicateValue(existing.id) === ownerId) return false;
  if (ownerEmail && normalizeDuplicateValue(existing.email) === ownerEmail) return false;

  return true;
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
  const requestedPasswordHash = requestedPassword ? hashPassword(requestedPassword) : undefined;
  const requestedUser =
    asText(payload.user, 120) ||
    asText(payload.requestedUser, 120) ||
    asText(payload.targetUserId, 120) ||
    undefined;
  const phone = asText(payload.phone, 80) || undefined;
  const title = asText(payload.title, 255) || undefined;
  const companyLabel = requestedCompanySlug || requestedCompanyId || undefined;
  const requestedRole = normalizeAccessRequestProfileType(resolveRequestedRoleFromPayload(payload));
  const details = buildRequestDetails(payload);

  if (requestedPassword) {
    (details as Record<string, unknown>).requestedPasswordForApprovalEmail = requestedPassword;
  }

  if (!requesterEmail) {
    return { status: 400 as const, body: { message: "E-mail é obrigatório" } };
  }
  if (!requestedRole) {
    return { status: 400 as const, body: { message: "Perfil solicitado invalido" } };
  }
  if (!requesterName || !phone || !title || !reason || !requestedPasswordHash) {
    return { status: 400 as const, body: { message: "Preencha todos os campos obrigatorios" } };
  }
  if (accessRequestProfileNeedsCompany(requestedRole) && !requestedCompanyId) {
    return { status: 400 as const, body: { message: "Selecione uma empresa cadastrada" } };
  }
  if (requestedRole === "empresa" && !details.company?.companyName) {
    return { status: 400 as const, body: { message: "Informe os dados da empresa" } };
  }
  if (requestedUser && (await isIdentityTokenTakenByAnotherUser(requestedUser, { userId: authUser?.id, email: requesterEmail }))) {
    return {
      status: 409 as const,
      body: {
        ok: false,
        code: "DUPLICATE_USER",
        message: "Usuario ja cadastrado",
      },
    };
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
    requestedRole,
    requestedCompanySlug:
      accessRequestProfileUsesAutomaticCompany(requestedRole) ? undefined : requestedCompanySlug,
    requestedCompanyId:
      accessRequestProfileUsesAutomaticCompany(requestedRole) ? undefined : requestedCompanyId,
    targetUserId: requestedUser,
    requestedPasswordHash,
    reason,
    priority: resolvePriorityFromPayload(payload),
    details,
  });

  const companyDetailsForReceivedEmail = buildCompanyDetailsForEmail(payload);

  await waitForAccessRequestEmail(
    emailService.sendAccessRequestReceivedEmail(requesterEmail, {
      name: requesterName || null,
      accessKey: created.accessKey ?? created.id,
      email: requesterEmail,
      username: requestedUser || null,
      phone,
      passwordDefined: Boolean(requestedPasswordHash),
      companyDetails: companyDetailsForReceivedEmail,
      profileType: created.requestedRole,
      title: title ?? null,
      description: reason ?? null,
      companyName: companyLabel ?? null,
    }),
    "received",
  );

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

  const createdNotificationProfile =
    normalizeAccessRequestProfileType(created.requestedRole) ?? requestedRole;

  await notifyAccessRequestCreated({
    requestId: created.id,
    requesterName: created.requesterName ?? requesterName ?? created.requesterEmail,
    profileType: createdNotificationProfile,
    reviewQueue: resolveReviewQueue(createdNotificationProfile),
    companySlug: created.requestedCompanySlug ?? null,
    clientId: created.requestedCompanyId ?? null,
  }).catch((error) => {
    console.error("[ACCESS_REQUEST_NOTIFICATION][created]", error);
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

export async function updateAccessRequestDetailsForReviewer(
  id: string,
  payload: Record<string, unknown>,
  reviewer: AuthUser,
) {
  if (!canReviewAccessRequests(reviewer)) return "forbidden" as const;
  const request = await getAccessRequestV2ById(id);
  if (!request) return null;
  if (!canReviewerActOnRequest(reviewer, request)) return "forbidden" as const;
  if (isAccessRequestFinalStatus(request.status)) return "final" as const;

  const profile =
    normalizeAccessRequestProfileType(readTextFromPayload(payload, ["access_type", "profile_type"])) ??
    normalizeAccessRequestProfileType(request.requestedRole);
  if (!profile) return "invalid-profile" as const;

  const details = {
    ...(request.details ?? {}),
    username:
      readTextFromPayload(payload, ["user", "username"], 120) ||
      request.details?.username,
    phone: readTextFromPayload(payload, ["phone"], 80) || request.details?.phone,
    jobRole: readTextFromPayload(payload, ["role", "jobRole"], 255) || request.details?.jobRole,
    title: readTextFromPayload(payload, ["title"], 255) || request.details?.title,
    description:
      readTextFromPayload(payload, ["description"], 2000) ||
      request.details?.description,
    notes: readTextFromPayload(payload, ["notes"], 2000) || request.details?.notes,
    company: request.details?.company,
  };
  if (
    details.username &&
    (await isIdentityTokenTakenByAnotherUser(details.username, {
      userId: request.requesterUserId,
      email: request.requesterEmail,
    }))
  ) {
    return "duplicate-user" as const;
  }

  const companyId =
    readTextFromPayload(payload, ["client_id", "requestedCompanyId"], 120) ||
    request.requestedCompanyId;
  const companySlug =
    readTextFromPayload(payload, ["company", "requestedCompanySlug"], 255) ||
    request.requestedCompanySlug;

  const nextVisualProfile = normalizeVisualProfileFromPayload(payload, request.details?.visualProfile);
  const nextReviewSummary = normalizeReviewSummaryFromPayload({
    payload,
    current: request.details?.reviewSummary,
    reviewer,
    changedCount: request.lastAdjustmentDiff?.length ?? 0,
    pendingFieldCount: request.adjustmentFields?.length ?? 0,
    requiredFieldsOk: Boolean(
      request.requesterEmail &&
      request.requesterName &&
      (details.username || request.details?.username) &&
      (details.phone || request.details?.phone) &&
      (details.jobRole || request.details?.jobRole),
    ),
    passwordDefined: Boolean(request.requestedPasswordHash),
    companyDefined: Boolean(companyId || request.requestedCompanyId || request.requestedCompanySlug),
  });

  const persistedDetails = {
    ...details,
    ...(nextVisualProfile ? { visualProfile: nextVisualProfile } : {}),
    ...(nextReviewSummary ? { reviewSummary: nextReviewSummary } : {}),
  };

  if (accessRequestProfileNeedsCompany(profile)) {
    const company = await findCompanyByIdSlugOrName(companyId, companySlug);
    if (!company) return "company-missing" as const;
  }

  const password = readTextFromPayload(payload, ["password"], 255);
  return updateAccessRequestV2(id, {
    requesterName:
      readTextFromPayload(payload, ["full_name", "name"], 255) ||
      request.requesterName,
    requesterEmail:
      asEmail(payload.email) ||
      request.requesterEmail,
    requestedRole: profile,
    requestedCompanyId:
      accessRequestProfileUsesAutomaticCompany(profile) ? undefined : companyId,
    requestedCompanySlug:
      accessRequestProfileUsesAutomaticCompany(profile) ? undefined : companySlug,
    requestedPasswordHash: password ? hashPassword(password) : request.requestedPasswordHash,
    reason: details.description ?? request.reason,
    details: persistedDetails,
  });
}

function normalizeCompanyIdentity(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function findCompanyByIdSlugOrName(id?: string, slugOrName?: string) {
  if (id) {
    const byId = await findLocalCompanyById(id);
    if (byId) return byId;
  }
  if (slugOrName) {
    const bySlug = await findLocalCompanyBySlug(slugOrName);
    if (bySlug) return bySlug;
  }
  const target = normalizeCompanyIdentity(slugOrName);
  if (!target) return null;
  const companies = await listLocalCompanies();
  return (
    companies.find(
      (company) =>
        normalizeCompanyIdentity(company.slug) === target ||
        normalizeCompanyIdentity(company.name ?? company.company_name) === target,
    ) ?? null
  );
}

async function resolveApprovalCompany(request: AccessRequestV2) {
  const profile = normalizeAccessRequestProfileType(request.requestedRole);
  if (!profile) return { error: "invalid-profile" as const };

  if (accessRequestProfileUsesAutomaticCompany(profile)) {
    const companies = await listLocalCompanies();
    const company =
      companies.find((item) => {
        const identity = normalizeCompanyIdentity(item.slug || item.name || item.company_name);
        return identity === "testing-company" || identity === "testing-company-e2e";
      }) ?? null;
    return company
      ? { company, profile }
      : { error: "testing-company-missing" as const };
  }

  if (accessRequestProfileNeedsCompany(profile)) {
    const company = await findCompanyByIdSlugOrName(
      request.requestedCompanyId,
      request.requestedCompanySlug,
    );
    return company ? { company, profile } : { error: "company-missing" as const };
  }

  if (profile === "empresa") {
    const companyName = request.details?.company?.companyName?.trim();
    if (!companyName) return { error: "company-name-missing" as const };

    const existing = await findCompanyByIdSlugOrName(
      request.requestedCompanyId,
      request.requestedCompanySlug || companyName,
    );
    if (existing) return { company: existing, profile };

    const details = request.details?.company;
    const company = await createLocalCompany({
      name: companyName,
      company_name: companyName,
      tax_id: details?.cnpj ?? null,
      cep: details?.cep ?? null,
      address: details?.address ?? null,
      phone: details?.phone ?? request.details?.phone ?? null,
      website: details?.website ?? null,
      linkedin_url: details?.linkedin ?? null,
      short_description: details?.description ?? null,
      description: details?.description ?? null,
      notes: details?.notes ?? null,
      active: true,
      status: "active",
    });
    return { company, profile };
  }

  return { company: null, profile };
}

async function applyApprovalEffects(request: AccessRequestV2, reviewer: AuthUser) {
  if (!request.requestedRole || !canApproveRequestedRole(reviewer, request.requestedRole)) {
    return "scope-denied" as const;
  }

  if (request.requesterUserId && request.requesterUserId === reviewer.id) {
    return "self-approval" as const;
  }

  if (!request.requestedPasswordHash) return "missing-password" as const;

  const companyResult = await resolveApprovalCompany(request);
  if ("error" in companyResult) return companyResult.error;

  const targetIdentifier = request.requesterEmail;
  if (!targetIdentifier) return "target-missing" as const;

  const existingUser = await findLocalUserByEmailOrId(targetIdentifier);
  const profile = companyResult.profile;
  const company = companyResult.company;
  const isLeader = profile === "leader_tc";
  const username = request.details?.username || request.requesterEmail.split("@")[0];
  const storedRole = toStoredEditableUserRole(profile);
  const profileState = resolveEditableProfileUserState(profile, company?.id ?? null);

  if (
    await isIdentityTokenTakenByAnotherUser(username, {
      userId: existingUser?.id ?? request.requesterUserId,
      email: request.requesterEmail,
    })
  ) {
    return "duplicate-user" as const;
  }

  const targetUser =
    existingUser ??
    (await createLocalUser({
      name: request.requesterName || request.requesterEmail,
      full_name: request.requesterName || request.requesterEmail,
      email: request.requesterEmail,
      user: username,
      password_hash: request.requestedPasswordHash,
      role: storedRole,
      globalRole: isLeader ? "global_admin" : null,
      is_global_admin: isLeader,
      status: "invited",
      active: true,
      phone: request.details?.phone ?? null,
      job_title: request.details?.jobRole ?? null,
      ...profileState,
      default_company_slug: company?.slug ?? null,
    }));

  const existingLinks = await listLocalLinksForUser(targetUser.id);
  await Promise.all(
    existingLinks
      .filter((link) => !company || link.companyId !== company.id)
      .map((link) => removeLocalLink(targetUser.id, link.companyId)),
  );

  await updateLocalUser(targetUser.id, {
    name: request.requesterName || request.requesterEmail,
    full_name: request.requesterName || request.requesterEmail,
    email: request.requesterEmail,
    user: username,
    role: storedRole,
    globalRole: isLeader ? "global_admin" : null,
    is_global_admin: isLeader,
    status: "active",
    active: true,
    phone: request.details?.phone ?? null,
    job_title: request.details?.jobRole ?? null,
    ...profileState,
    default_company_slug: company?.slug ?? null,
    password_hash: request.requestedPasswordHash,
  });

  if (company) {
    await upsertLocalLink({
      userId: targetUser.id,
      companyId: company.id,
      role: storedRole,
    });
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
      requestedRole: profile,
      requestedCompanySlug: company?.slug ?? null,
      forceRefreshMe: true,
    },
  });

  const requestedPasswordForApprovalEmail =
    (request.details as { requestedPasswordForApprovalEmail?: string | null } | null)
      ?.requestedPasswordForApprovalEmail ?? null;

  return {
    userId: targetUser.id,
    login: username,
    tempPassword: requestedPasswordForApprovalEmail,
    passwordFromRequest: true,
    companySlug: company?.slug ?? null,
    companyName: company?.name ?? company?.company_name ?? company?.slug ?? null,
  };
}

function normalizeScopeValue(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function canReviewerActOnRequest(reviewer: AuthUser, request: AccessRequestV2) {
  const role = getEffectiveUserRole(reviewer);
  if (
    reviewer.isGlobalAdmin === true ||
    role === "leader_tc" ||
    role === "technical_support"
  ) {
    return true;
  }

  if (role !== "empresa") return false;

  const reviewerCompanyId = normalizeScopeValue(reviewer.companyId);
  const requestCompanyId = normalizeScopeValue(request.requestedCompanyId);
  if (reviewerCompanyId && requestCompanyId && reviewerCompanyId === requestCompanyId) {
    return true;
  }

  const reviewerSlugs = [
    reviewer.companySlug,
    ...(Array.isArray(reviewer.companySlugs) ? reviewer.companySlugs : []),
  ].map(normalizeScopeValue).filter(Boolean);
  const requestCompanySlug = normalizeScopeValue(request.requestedCompanySlug);

  return Boolean(requestCompanySlug && reviewerSlugs.includes(requestCompanySlug));
}

export async function transitionAccessRequest(
  id: string,
  action: "start-review" | "approve" | "reject" | "request-info",
  reviewer: AuthUser,
  options?: {
    comment?: string | null;
    adjustmentFields?: string[];
    fieldComments?: Record<string, string>;
  },
) {
  const request = await getAccessRequestV2ById(id);
  if (!request) return null;
  if (!canReviewAccessRequests(reviewer)) return "forbidden" as const;
  if (!canReviewerActOnRequest(reviewer, request)) return "scope-denied" as const;

  const comment = asText(options?.comment, 2000) || undefined;

  if (action === "reject" && !comment) return "reject-comment-required" as const;
  const adjustmentFields = normalizeAccessRequestAdjustmentFields(options?.adjustmentFields);
  if (action === "request-info" && (!comment || adjustmentFields.length === 0)) {
    return "adjustment-details-required" as const;
  }

  let nextStatus: AccessRequestV2Status = request.status;
  if (action === "start-review") nextStatus = "under_review";
  if (action === "approve") nextStatus = "approved";
  if (action === "reject") nextStatus = "rejected";
  if (action === "request-info") nextStatus = "needs_more_info";
  if (!canTransitionAccessRequest(request.status, nextStatus)) {
    return "invalid-transition" as const;
  }

  // Para approve: valida e captura credenciais em uma única chamada
  let approvalCredentials: {
    userId: string;
    tempPassword: string | null;
    login: string;
    passwordFromRequest: boolean;
    companySlug: string | null;
    companyName: string | null;
  } | null = null;
  if (action === "approve") {
    const result = await applyApprovalEffects(request, reviewer);
    if (result === "self-approval") return result;
    if (result === "scope-denied") return result;
    if (result === "target-missing") return null;
    if (
      result === "missing-password" ||
      result === "testing-company-missing" ||
      result === "company-missing" ||
      result === "company-name-missing" ||
      result === "invalid-profile" ||
      result === "duplicate-user"
    ) {
      return result;
    }
    if (typeof result === "object") {
      approvalCredentials = result;
    }
  }

  const now = new Date().toISOString();
  const fieldComments = Object.fromEntries(
    adjustmentFields
      .map((field) => [field, asText(options?.fieldComments?.[field], 1000)])
      .filter((entry) => entry[1]),
  );
  const nextHistory =
    action === "request-info"
      ? [
          ...(request.adjustmentHistory ?? []),
          {
            round: (request.adjustmentHistory?.length ?? 0) + 1,
            requestedAt: now,
            requestedFields: adjustmentFields,
            requestMessage: comment,
            fieldComments,
          },
        ]
      : request.adjustmentHistory;

  const updated = await updateAccessRequestV2(id, {
    ...(action === "request-info" ? { adjustmentFields, adjustmentHistory: nextHistory, accessKeyExpiresAt: createAccessRequestLookupCodeExpiresAt() } : {}),
    ...(action === "approve" || action === "reject" ? { adjustmentFields: [] } : {}),
    ...(action === "approve" && approvalCredentials
      ? {
          details: {
            ...(request.details ?? {}),
            username: approvalCredentials.login,
          },
        }
      : {}),
    status: nextStatus,
    reviewedBy: reviewer.id,
    reviewedAt: now,
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

  const notificationProfile =
    normalizeAccessRequestProfileType(updated.requestedRole) ??
    normalizeAccessRequestProfileType(request.requestedRole);

  if (notificationProfile && action === "approve") {
    await notifyAccessRequestAccepted({
      requestId: updated.id,
      requesterName: updated.requesterName ?? updated.requesterEmail,
      approverName: reviewer.email || "Admin",
      profileType: notificationProfile,
      reviewQueue: resolveReviewQueue(notificationProfile),
      companySlug: updated.requestedCompanySlug ?? null,
      clientId: updated.requestedCompanyId ?? null,
    }).catch((error) => {
      console.error("[ACCESS_REQUEST_NOTIFICATION][accepted]", error);
    });
  } else if (notificationProfile && action === "reject") {
    await notifyAccessRequestRejected({
      requestId: updated.id,
      requesterName: updated.requesterName ?? updated.requesterEmail,
      rejectorName: reviewer.email || "Admin",
      profileType: notificationProfile,
      reviewQueue: resolveReviewQueue(notificationProfile),
      reason: comment ?? null,
      companySlug: updated.requestedCompanySlug ?? null,
      clientId: updated.requestedCompanyId ?? null,
    }).catch((error) => {
      console.error("[ACCESS_REQUEST_NOTIFICATION][rejected]", error);
    });
  } else if (notificationProfile && action === "request-info") {
    await notifyAccessRequestAdjustmentRequested({
      requestId: updated.id,
      requesterName: updated.requesterName ?? updated.requesterEmail,
      reviewerName: reviewer.email || "Admin",
      profileType: notificationProfile,
      reviewQueue: resolveReviewQueue(notificationProfile),
      fields: adjustmentFields.map((field) => ACCESS_REQUEST_ADJUSTMENT_FIELD_LABELS[field] ?? field),
      companySlug: updated.requestedCompanySlug ?? null,
      clientId: updated.requestedCompanyId ?? null,
    }).catch((error) => {
      console.error("[ACCESS_REQUEST_NOTIFICATION][adjustment]", error);
    });
  }

  // Enviar e-mails conforme ação
  const recipientEmail = request.requesterEmail;
  const recipientName = request.requesterName || null;

  if (action === "approve" && approvalCredentials) {
    await waitForAccessRequestEmail(
      emailService.sendAccessApprovedEmail(recipientEmail, {
        name: recipientName,
        login: approvalCredentials.login,
        tempPassword: approvalCredentials.tempPassword,
        passwordFromRequest: approvalCredentials.passwordFromRequest,
        profileType: request.requestedRole,
        companySlug: approvalCredentials.companySlug,
        companyName: approvalCredentials.companyName,
      }),
      "approved",
    );
  } else if (action === "reject") {
    await waitForAccessRequestEmail(
      emailService.sendAccessRejectedEmail(recipientEmail, {
        name: recipientName,
        comment,
        accessKey: request.accessKey,
      }),
      "rejected",
    );
  } else if (action === "request-info" && request.accessKey) {
    await waitForAccessRequestEmail(
      emailService.sendAccessAdjustmentEmail(recipientEmail, {
        name: recipientName,
        adjustmentFields: adjustmentFields.map(
          (field) => ACCESS_REQUEST_ADJUSTMENT_FIELD_LABELS[field],
        ),
        comment,
        accessKey: request.accessKey,
      }),
      "adjustment",
    );
  }

  return updated;
}

async function waitForAccessRequestEmail(task: Promise<unknown>, label: string) {
  const timeoutMs = Number(process.env.ACCESS_REQUEST_EMAIL_TIMEOUT_MS ?? 5000);
  let timedOut = false;
  const guardedTask = task.catch((error) => {
    console.error(`[ACCESS_REQUEST_EMAIL][${label}]`, error);
  });
  await Promise.race([
    guardedTask,
    new Promise<void>((resolve) => {
      setTimeout(() => {
        timedOut = true;
        resolve();
      }, timeoutMs);
    }),
  ]);
  if (timedOut) {
    console.warn(`[ACCESS_REQUEST_EMAIL][${label}] timeout apos ${timeoutMs}ms; envio segue em background.`);
  }
}

function publicFieldValue(request: AccessRequestV2, field: AccessRequestAdjustmentField) {
  const company = request.details?.company;
  const values: Record<AccessRequestAdjustmentField, string> = {
    profileType: request.requestedRole ?? "",
    company: request.requestedCompanySlug ?? "",
    companyName: company?.companyName ?? "",
    companyTaxId: company?.cnpj ?? "",
    companyZip: company?.cep ?? "",
    companyAddress: company?.address ?? "",
    companyPhone: company?.phone ?? "",
    companyWebsite: company?.website ?? "",
    companyLinkedin: company?.linkedin ?? "",
    companyDescription: company?.description ?? "",
    companyNotes: company?.notes ?? "",
    fullName: request.requesterName ?? "",
    username: request.details?.username ?? "",
    email: request.requesterEmail,
    phone: request.details?.phone ?? "",
    jobRole: request.details?.jobRole ?? "",
    title: request.details?.title ?? "",
    description: request.details?.description ?? request.reason ?? "",
    notes: request.details?.notes ?? "",
    password: request.requestedPasswordHash ? "Definida" : "Nao definida",
  };
  return values[field];
}

function readPublicAdjustmentValue(
  payload: Record<string, unknown>,
  field: AccessRequestAdjustmentField,
) {
  const aliases: Record<AccessRequestAdjustmentField, string[]> = {
    profileType: ["profileType", "profile_type", "requestedRole"],
    company: ["company", "companyName", "requestedCompanySlug"],
    companyName: ["companyName", "company_name"],
    companyTaxId: ["companyTaxId", "company_tax_id", "cnpj"],
    companyZip: ["companyZip", "company_zip", "cep"],
    companyAddress: ["companyAddress", "company_address", "address"],
    companyPhone: ["companyPhone", "company_phone"],
    companyWebsite: ["companyWebsite", "company_website", "website"],
    companyLinkedin: ["companyLinkedin", "company_linkedin", "linkedin"],
    companyDescription: ["companyDescription", "company_description"],
    companyNotes: ["companyNotes", "company_notes"],
    fullName: ["fullName", "full_name", "name"],
    username: ["username", "user"],
    email: ["email", "requesterEmail"],
    phone: ["phone"],
    jobRole: ["jobRole", "role"],
    title: ["title"],
    description: ["description", "reason"],
    notes: ["notes"],
    password: ["password"],
  };
  return readTextFromPayload(payload, aliases[field], field === "description" || field === "notes" ? 2000 : 255);
}

export async function updateAccessRequestByKey(
  accessKey: string,
  payload: Record<string, unknown>,
) {
  const request = await getAccessRequestV2ByKey(accessKey);
  if (!request) return null;
  if (isAccessRequestLookupCodeExpired(request.accessKeyExpiresAt)) return null;
  if (request.status !== "needs_more_info") return "not-adjustable" as const;

  const allowedFields = normalizeAccessRequestAdjustmentFields(request.adjustmentFields);
  if (!allowedFields.length) return "no-adjustment-fields" as const;

  const details = {
    ...(request.details ?? {}),
    company: { ...(request.details?.company ?? {}) },
  };
  const patch: Parameters<typeof updateAccessRequestV2>[1] = {};
  const diff: AccessRequestAdjustmentEntry[] = [];

  for (const field of allowedFields) {
    const nextRaw = readPublicAdjustmentValue(payload, field);
    if (!nextRaw) return { error: "required-field" as const, field };

    const previous = publicFieldValue(request, field);
    let next = nextRaw;

    if (field === "password") {
      if (nextRaw.length < 8) return { error: "invalid-password" as const, field };
      patch.requestedPasswordHash = hashPassword(nextRaw);
      next = "Definida";
    } else if (field === "fullName") {
      patch.requesterName = nextRaw;
    } else if (field === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextRaw)) {
        return { error: "invalid-email" as const, field };
      }
      patch.requesterEmail = nextRaw.toLowerCase();
      next = nextRaw.toLowerCase();
    } else if (field === "profileType") {
      const profile = normalizeAccessRequestProfileType(nextRaw);
      if (!profile) return { error: "invalid-profile" as const, field };
      patch.requestedRole = profile;
      next = profile;
    } else if (field === "company") {
      const companyId = asText(payload.companyId, 120) || asText(payload.client_id, 120);
      const company = await findCompanyByIdSlugOrName(companyId, nextRaw);
      if (!company) return { error: "invalid-company" as const, field };
      patch.requestedCompanyId = company.id;
      patch.requestedCompanySlug = company.name ?? company.company_name ?? company.slug;
      next = patch.requestedCompanySlug ?? nextRaw;
    } else if (field === "username") {
      const nextUsername = nextRaw.toLowerCase();
      if (
        await isIdentityTokenTakenByAnotherUser(nextUsername, {
          userId: request.requesterUserId,
          email: request.requesterEmail,
        })
      ) {
        return { error: "duplicate-user" as const, field };
      }
      details.username = nextUsername;
      next = nextUsername;
    } else if (field === "phone") {
      details.phone = nextRaw;
    } else if (field === "jobRole") {
      details.jobRole = nextRaw;
    } else if (field === "title") {
      details.title = nextRaw;
    } else if (field === "description") {
      details.description = nextRaw;
      patch.reason = nextRaw;
    } else if (field === "notes") {
      details.notes = nextRaw;
    } else if (field === "companyName") {
      details.company.companyName = nextRaw;
    } else if (field === "companyTaxId") {
      details.company.cnpj = nextRaw;
    } else if (field === "companyZip") {
      details.company.cep = nextRaw;
    } else if (field === "companyAddress") {
      details.company.address = nextRaw;
    } else if (field === "companyPhone") {
      details.company.phone = nextRaw;
    } else if (field === "companyWebsite") {
      details.company.website = nextRaw;
    } else if (field === "companyLinkedin") {
      details.company.linkedin = nextRaw;
    } else if (field === "companyDescription") {
      details.company.description = nextRaw;
    } else if (field === "companyNotes") {
      details.company.notes = nextRaw;
    }

    if (previous !== next) {
      diff.push({
        field,
        label: ACCESS_REQUEST_ADJUSTMENT_FIELD_LABELS[field],
        previous: previous || "Nao informado",
        next: next || "Nao informado",
      });
    }
  }

  const now = new Date().toISOString();
  const nextProfile =
    normalizeAccessRequestProfileType(patch.requestedRole ?? request.requestedRole) ??
    normalizeAccessRequestProfileType(request.requestedRole);
  const nextCompanyId =
    patch.requestedCompanyId ?? request.requestedCompanyId;
  const nextCompanyName = details.company.companyName?.trim();

  if (nextProfile && accessRequestProfileNeedsCompany(nextProfile) && !nextCompanyId) {
    return { error: "invalid-company" as const, field: "company" as const };
  }
  if (nextProfile === "empresa" && !nextCompanyName) {
    return { error: "required-field" as const, field: "companyName" as const };
  }
  if (
    nextProfile &&
    (accessRequestProfileUsesAutomaticCompany(nextProfile) ||
      nextProfile === "leader_tc" ||
      nextProfile === "technical_support")
  ) {
    patch.requestedCompanyId = null;
    patch.requestedCompanySlug = null;
  }

  const history = [...(request.adjustmentHistory ?? [])];
  const currentRound = history.at(-1);
  if (currentRound) {
    history[history.length - 1] = {
      ...currentRound,
      requesterReturnedAt: now,
      requesterDiff: diff,
    };
  }

  const updated = await updateAccessRequestV2(request.id, {
    ...patch,
    details,
    status: "under_review",
    adjustmentFields: [],
    adjustmentHistory: history,
    lastAdjustmentAt: now,
    lastAdjustmentDiff: diff,
    reviewComment: "Correcao reenviada pelo solicitante.",
  });

  await createAccessRequestComment({
    requestId: request.id,
    authorRole: "requester",
    authorName: updated?.requesterName ?? request.requesterName ?? request.requesterEmail,
    authorEmail: updated?.requesterEmail ?? request.requesterEmail,
    body: diff.length
      ? `Correcao reenviada:\n${diff.map((entry) => `- ${entry.label}`).join("\n")}`
      : "Correcao reenviada sem alteracao de valor.",
  });

  return updated;
}

export async function addPublicAccessRequestComment(input: {
  accessKey: string;
  name: string;
  email: string;
  comment: string;
}) {
  const request = await getAccessRequestV2ByKey(input.accessKey);
  if (!request) return null;
  if (isAccessRequestLookupCodeExpired(request.accessKeyExpiresAt)) return null;
  if (isAccessRequestFinalStatus(request.status)) return "final" as const;
  if (
    normalizeDuplicateValue(request.requesterEmail) !== normalizeDuplicateValue(input.email) ||
    normalizeDuplicateValue(request.requesterName) !== normalizeDuplicateValue(input.name)
  ) {
    return "forbidden" as const;
  }
  return createAccessRequestComment({
    requestId: request.id,
    authorRole: "requester",
    authorName: request.requesterName ?? input.name,
    authorEmail: request.requesterEmail,
    body: asText(input.comment, 2000),
  });
}

export async function getPublicAccessRequestByKey(accessKey: string) {
  const request = await getAccessRequestV2ByKey(accessKey);
  if (!request) return null;

  if (isAccessRequestLookupCodeExpired(request.accessKeyExpiresAt)) {
    if (canTransitionAccessRequest(request.status, "expired")) {
      await updateAccessRequestV2(request.id, {
        status: "expired",
        reviewComment: "Código de consulta expirado.",
        adjustmentFields: [],
      });
    }
    return null;
  }

  const comments = await listAccessRequestComments(request.id);
  return { request, comments };
}

export async function cancelAccessRequestByKey(accessKey: string) {
  const request = await getAccessRequestV2ByKey(accessKey);
  if (!request) return null;
  if (isAccessRequestLookupCodeExpired(request.accessKeyExpiresAt)) return null;
  if (!canTransitionAccessRequest(request.status, "cancelled")) {
    return "invalid-transition" as const;
  }

  const updated = await updateAccessRequestV2(request.id, {
    status: "cancelled",
    reviewComment: "Solicitação cancelada pelo solicitante.",
    adjustmentFields: [],
  });
  if (!updated) return null;

  await createAccessRequestComment({
    requestId: request.id,
    authorRole: "requester",
    authorName: request.requesterName ?? request.requesterEmail,
    authorEmail: request.requesterEmail,
    body: "Solicitação cancelada pelo solicitante.",
  });

  addAuditLogSafe({
    actorEmail: request.requesterEmail,
    action: "access_request.updated",
    entityType: "access_request",
    entityId: request.id,
    entityLabel: request.requesterEmail,
    metadata: { event: "cancelled_by_requester" },
  });

  return updated;
}

export async function resendAccessRequestCode(input: { name: string; email: string }) {
  const name = normalizeAccessRequestLookup(input.name);
  const email = normalizeAccessRequestLookup(input.email);
  if (!name || !email) return false;

  const request = (await listAccessRequestsV2()).find(
    (item) =>
      Boolean(item.accessKey) &&
      normalizeAccessRequestLookup(item.requesterName) === name &&
      normalizeAccessRequestLookup(item.requesterEmail) === email,
  );
  if (!request?.accessKey) return false;

  const nextAccessKey = createPublicAccessRequestKey();
  const nextAccessKeyExpiresAt = createAccessRequestLookupCodeExpiresAt();
  const wasExpired = isAccessRequestLookupCodeExpired(request.accessKeyExpiresAt) || request.status === "expired";
  const updated = await updateAccessRequestV2(request.id, {
    accessKey: nextAccessKey,
    accessKeyExpiresAt: nextAccessKeyExpiresAt,
    ...(request.status === "expired"
      ? {
          status: "under_review" as const,
          reviewComment: "Novo código de consulta enviado ao solicitante.",
          adjustmentFields: [],
        }
      : {}),
  });
  if (!updated?.accessKey) return false;
  const activeRequest = updated;

  const sent = await emailService.sendAccessRequestReceivedEmail(activeRequest.requesterEmail, {
    name: activeRequest.requesterName,
    accessKey: activeRequest.accessKey ?? nextAccessKey,
    email: activeRequest.requesterEmail,
    username: (activeRequest as { username?: string | null; targetUserId?: string | null }).username ?? (activeRequest as { targetUserId?: string | null }).targetUserId ?? null,
    phone: activeRequest.details?.phone,
    passwordDefined: Boolean(activeRequest.requestedPasswordHash),
    profileType: activeRequest.requestedRole,
    companyName: activeRequest.requestedCompanySlug ?? activeRequest.details?.company?.companyName,
    title: activeRequest.details?.title,
    description: activeRequest.details?.description ?? activeRequest.reason,
    status: activeRequest.status,
    companyDetails: activeRequest.details?.company,
  });

  if (!sent) {
    await updateAccessRequestV2(request.id, {
      accessKey: request.accessKey,
      accessKeyExpiresAt: request.accessKeyExpiresAt,
      status: request.status,
      reviewComment: request.reviewComment,
      adjustmentFields: request.adjustmentFields,
    });
    return false;
  }

  if (sent) {
    addAuditLogSafe({
      actorEmail: request.requesterEmail,
      action: "access_request.updated",
      entityType: "access_request",
      entityId: request.id,
      entityLabel: request.requesterEmail,
      metadata: { event: "code_resent", status: activeRequest.status, previousCodeExpired: wasExpired },
    });
  }

  return sent;
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

export function mapV2ToLegacySupportRow(request: AccessRequestV2) {
  const profile =
    normalizeAccessRequestProfileType(request.requestedRole) ?? "testing_company_user";
  const company = request.details?.company;
  const message = composeAccessRequestMessage({
    email: request.requesterEmail,
    name: request.requesterName ?? request.requesterEmail,
    fullName: request.requesterName ?? request.requesterEmail,
    username: request.details?.username ?? null,
    phone: request.details?.phone ?? "",
    passwordHash: request.requestedPasswordHash ?? null,
    role: request.details?.jobRole ?? "",
    company:
      request.requestedCompanySlug ??
      company?.companyName ??
      "(nao informado)",
    clientId: request.requestedCompanyId ?? null,
    accessType: toInternalAccessType(profile),
    profileType: profile,
    title: request.details?.title ?? "",
    description: request.details?.description ?? request.reason ?? "",
    notes: request.details?.notes ?? "",
    companyProfile: company
      ? {
          companyName: company.companyName ?? "",
          companyTaxId: company.cnpj ?? "",
          companyZip: company.cep ?? "",
          companyAddress: company.address ?? "",
          companyPhone: company.phone ?? "",
          companyWebsite: company.website ?? "",
          companyLinkedin: company.linkedin ?? "",
          companyDescription: company.description ?? "",
          companyNotes: company.notes ?? "",
        }
      : null,
    adjustmentRound: request.adjustmentHistory?.length ?? 0,
    adjustmentRequestedFields: request.adjustmentFields ?? [],
    adjustmentHistory: (request.adjustmentHistory ?? []).map((round) => ({
      round: round.round,
      requestedAt: round.requestedAt,
      requestedFields: round.requestedFields,
      requestMessage: round.requestMessage ?? null,
      requesterReturnedAt: round.requesterReturnedAt ?? null,
      requesterDiff: round.requesterDiff ?? [],
    })),
    lastAdjustmentAt: request.lastAdjustmentAt ?? null,
    lastAdjustmentDiff: request.lastAdjustmentDiff ?? [],
    adminNotes: request.reviewComment ?? null,
    visualProfile: request.details?.visualProfile ?? null,
    reviewSummary: request.details?.reviewSummary ?? null,
  });

  const status =
    request.status === "approved"
      ? "closed"
      : request.status === "rejected" ||
          request.status === "cancelled" ||
          request.status === "expired"
        ? "rejected"
        : request.status === "under_review" || request.status === "needs_more_info"
          ? "in_progress"
          : "open";

  return {
    id: request.id,
    accessKey: request.accessKey ?? null,
    access_key: request.accessKey ?? null,
    email: request.requesterEmail,
    message,
    status,
    created_at: request.createdAt,
    admin_notes: request.reviewComment ?? null,
  };
}
