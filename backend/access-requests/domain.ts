import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/backend/auth/roles";
import type { AuthUser } from "@/backend/jwtAuth";
import { hasPermissionAccess } from "@/backend/permissionMatrix";
import { resolveRoleDefaults } from "@/backend/permissions/roleDefaults";

export const ACCESS_REQUEST_V2_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "cancelled",
  "expired",
  "needs_more_info",
] as const;

export type AccessRequestV2Status = (typeof ACCESS_REQUEST_V2_STATUSES)[number];

export const ACCESS_REQUEST_PROFILE_TYPES = [
  SYSTEM_ROLES.EMPRESA,
  SYSTEM_ROLES.COMPANY_USER,
  SYSTEM_ROLES.TESTING_COMPANY_USER,
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
] as const;

export type AccessRequestProfileType = (typeof ACCESS_REQUEST_PROFILE_TYPES)[number];

export const ACCESS_REQUEST_PROFILE_LABELS: Record<AccessRequestProfileType, string> = {
  [SYSTEM_ROLES.EMPRESA]: "Empresa",
  [SYSTEM_ROLES.COMPANY_USER]: "Usuario da empresa",
  [SYSTEM_ROLES.TESTING_COMPANY_USER]: "Usuario TC",
  [SYSTEM_ROLES.LEADER_TC]: "Lider TC",
  [SYSTEM_ROLES.TECHNICAL_SUPPORT]: "Administrador",
};

export const ACCESS_REQUEST_ADJUSTMENT_FIELDS = [
  "profileType",
  "company",
  "companyName",
  "companyTaxId",
  "companyZip",
  "companyAddress",
  "companyPhone",
  "companyWebsite",
  "companyLinkedin",
  "companyDescription",
  "companyNotes",
  "fullName",
  "username",
  "email",
  "phone",
  "jobRole",
  "title",
  "description",
  "notes",
  "password",
] as const;

export type AccessRequestAdjustmentField = (typeof ACCESS_REQUEST_ADJUSTMENT_FIELDS)[number];

export const ACCESS_REQUEST_ADJUSTMENT_FIELD_LABELS: Record<AccessRequestAdjustmentField, string> = {
  profileType: "Tipo de perfil",
  company: "Empresa",
  companyName: "Razao social",
  companyTaxId: "CNPJ",
  companyZip: "CEP",
  companyAddress: "Endereco",
  companyPhone: "Telefone da empresa",
  companyWebsite: "Website",
  companyLinkedin: "LinkedIn",
  companyDescription: "Descricao da empresa",
  companyNotes: "Observacoes da empresa",
  fullName: "Nome completo",
  username: "Usuario/login",
  email: "E-mail",
  phone: "Telefone",
  jobRole: "Cargo",
  title: "Titulo",
  description: "Descrição",
  notes: "Observacoes",
  password: "Senha",
};

export const ACCESS_REQUEST_REJECTION_REASONS = [
  { value: "invalid_data", label: "Dados inválidos ou inconsistentes" },
  { value: "duplicate_request", label: "Solicitação duplicada" },
  { value: "profile_not_allowed", label: "Perfil solicitado não autorizado" },
  { value: "company_not_found", label: "Empresa não encontrada ou não elegível" },
  { value: "insufficient_information", label: "Informações insuficientes" },
  { value: "other", label: "Outro motivo" },
] as const;

export type AccessRequestCompanyDetails = {
  companyName?: string;
  fantasyName?: string;
  cnpj?: string;
  cep?: string;
  address?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  website?: string;
  linkedin?: string;
  description?: string;
  notes?: string;
  situation?: string;
  openingDate?: string;
  legalNature?: string;
  mainActivity?: string;
  size?: string;
  shareCapital?: string;
};

export type AccessRequestVisualProfile = {
  avatarKind?: "emoji" | "gif" | "default" | "image";
  avatarValue?: string;
  avatarLabel?: string;
};

export type AccessRequestReviewSummary = {
  internalNotes?: string;
  visualStatus?: "draft" | "ready" | "needs_adjustment" | "rejected" | "approved";
  lastReviewedAt?: string;
  lastReviewedBy?: string;
  changedCount?: number;
  pendingFieldCount?: number;
  requiredFieldsOk?: boolean;
  passwordDefined?: boolean;
  companyDefined?: boolean;
};

export type AccessRequestV2Details = {
  username?: string;
  phone?: string;
  jobRole?: string;
  title?: string;
  description?: string;
  notes?: string;
  company?: AccessRequestCompanyDetails;
  visualProfile?: AccessRequestVisualProfile;
  reviewSummary?: AccessRequestReviewSummary;
};

export type AccessRequestAdjustmentEntry = {
  field: AccessRequestAdjustmentField;
  label: string;
  previous: string;
  next: string;
};

export type AccessRequestAdjustmentRound = {
  round: number;
  requestedAt: string;
  requestedFields: AccessRequestAdjustmentField[];
  requestMessage?: string;
  fieldComments?: Partial<Record<AccessRequestAdjustmentField, string>>;
  requesterReturnedAt?: string;
  requesterDiff?: AccessRequestAdjustmentEntry[];
};

export const ACCESS_REQUEST_V2_TYPES = [
  "company_access",
  "company_user",
  "testing_company_user",
  "leader_tc",
  "technical_support",
  "company_creation",
  "profile_change",
  "permission_change",
  "company_link",
] as const;

export type AccessRequestV2Type = (typeof ACCESS_REQUEST_V2_TYPES)[number];

export type AccessRequestV2Priority = "low" | "medium" | "high" | "critical";

export type AccessRequestV2 = {
  id: string;
  /** Chave pública de acesso segúro — enviada por e-mail, usada sem autenticação */
  accessKey?: string;
  /** Data/hora de expiração do código de consulta enviado por e-mail */
  accessKeyExpiresAt?: string;
  requesterUserId?: string;
  requesterEmail: string;
  requesterName?: string;
  requestType: AccessRequestV2Type;
  requestedRole?: string;
  requestedCompanySlug?: string;
  requestedCompanyId?: string;
  targetUserId?: string;
  /**
   * Hash da senha escolhida pelo usuário no formulário público.
   * Nunca armazenar senha em texto puro.
   */
  requestedPasswordHash?: string;
  status: AccessRequestV2Status;
  reason?: string;
  priority: AccessRequestV2Priority;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  /** Campos que precisam de ajuste (preenchido em needs_more_info) */
  adjustmentFields?: AccessRequestAdjustmentField[];
  details?: AccessRequestV2Details;
  adjustmentHistory?: AccessRequestAdjustmentRound[];
  lastAdjustmentAt?: string;
  lastAdjustmentDiff?: AccessRequestAdjustmentEntry[];
  createdAt: string;
  updatedAt: string;
};

export type AccessRequestReviewRecord = {
  requestId: string;
  previousStatus: AccessRequestV2Status;
  nextStatus: AccessRequestV2Status;
  reviewerUserId: string;
  comment?: string;
  createdAt: string;
};

export type AccessRequestAuditEvent = {
  action: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  at: string;
  metadata?: Record<string, unknown>;
};

export function normalizeAccessRequestV2Status(input?: string | null): AccessRequestV2Status | null {
  const value = (input ?? "").trim().toLowerCase();
  if (ACCESS_REQUEST_V2_STATUSES.includes(value as AccessRequestV2Status)) return value as AccessRequestV2Status;

  if (value === "open") return "pending";
  if (value === "in_progress") return "under_review";
  if (value === "closed") return "approved";
  return null;
}

export function isAccessRequestFinalStatus(status: AccessRequestV2Status) {
  return status === "approved" || status === "rejected" || status === "cancelled" || status === "expired";
}

export function canTransitionAccessRequest(
  current: AccessRequestV2Status,
  next: AccessRequestV2Status,
) {
  if (current === next) return true;
  if (isAccessRequestFinalStatus(current)) return false;

  const allowed: Record<AccessRequestV2Status, AccessRequestV2Status[]> = {
    pending: ["under_review", "needs_more_info", "approved", "rejected", "cancelled", "expired"],
    under_review: ["needs_more_info", "approved", "rejected", "cancelled", "expired"],
    needs_more_info: ["under_review", "rejected", "cancelled", "expired"],
    approved: [],
    rejected: [],
    cancelled: [],
    expired: [],
  };

  return allowed[current].includes(next);
}

export function normalizeAccessRequestProfileType(
  input?: string | null,
): AccessRequestProfileType | null {
  const normalized = normalizeLegacyRole(input);
  return normalized && ACCESS_REQUEST_PROFILE_TYPES.includes(normalized as AccessRequestProfileType)
    ? (normalized as AccessRequestProfileType)
    : null;
}

export function accessRequestProfileNeedsCompany(profileType: AccessRequestProfileType) {
  return profileType === SYSTEM_ROLES.COMPANY_USER;
}

export function accessRequestProfileUsesAutomaticCompany(profileType: AccessRequestProfileType) {
  return profileType === SYSTEM_ROLES.TESTING_COMPANY_USER;
}

export function accessRequestProfileLabel(profileType: AccessRequestProfileType) {
  return ACCESS_REQUEST_PROFILE_LABELS[profileType];
}

export function normalizeAccessRequestAdjustmentFields(input: unknown) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input.filter(
        (value): value is AccessRequestAdjustmentField =>
          typeof value === "string" &&
          ACCESS_REQUEST_ADJUSTMENT_FIELDS.includes(value as AccessRequestAdjustmentField),
      ),
    ),
  );
}

export function normalizeAccessRequestV2Type(input?: string | null): AccessRequestV2Type | null {
  const value = (input ?? "").trim().toLowerCase();
  if (ACCESS_REQUEST_V2_TYPES.includes(value as AccessRequestV2Type)) return value as AccessRequestV2Type;

  if (value === "empresa" || value === "company") return "company_access";
  if (value === "company") return "company_access";
  if (value === "email_change" || value === "company_change") return "profile_change";
  if (value === "password_reset") return "permission_change";
  if (value === "profile_deletion") return "profile_change";
  return null;
}

export function normalizeAccessRequestV2Priority(input?: string | null): AccessRequestV2Priority {
  const value = (input ?? "").trim().toLowerCase();
  if (value === "low" || value === "medium" || value === "high" || value === "critical") return value;
  return "medium";
}

export function getEffectiveUserRole(user: Pick<AuthUser, "role" | "permissionRole" | "companyRole" | "isGlobalAdmin"> | null | undefined): SystemRole | null {
  if (!user) return null;
  if (user.isGlobalAdmin) return SYSTEM_ROLES.LEADER_TC;
  return (
    normalizeLegacyRole(user.permissionRole) ??
    normalizeLegacyRole(user.role) ??
    normalizeLegacyRole(user.companyRole) ??
    null
  );
}

export function canReviewAccessRequests(user: Pick<AuthUser, "role" | "permissionRole" | "companyRole" | "isGlobalAdmin"> | null | undefined) {
  const role = getEffectiveUserRole(user);
  return role === SYSTEM_ROLES.LEADER_TC || hasPermissionAccess(resolveRoleDefaults(role), "access_requests", "view");
}

export function canApproveRequestedRole(
  reviewer: Pick<AuthUser, "role" | "permissionRole" | "companyRole" | "isGlobalAdmin"> | null | undefined,
  requestedRole?: string | null,
) {
  const reviewerRole = getEffectiveUserRole(reviewer);
  const normalizedRequestedRole = normalizeLegacyRole(requestedRole ?? null);

  if (!reviewerRole || !normalizedRequestedRole) return false;
  if (reviewerRole === SYSTEM_ROLES.LEADER_TC) return true;

  if (reviewerRole === SYSTEM_ROLES.TECHNICAL_SUPPORT) {
    return normalizedRequestedRole !== SYSTEM_ROLES.LEADER_TC;
  }

  if (reviewerRole === SYSTEM_ROLES.EMPRESA) {
    return normalizedRequestedRole === SYSTEM_ROLES.COMPANY_USER;
  }

  return false;
}

export function canViewAccessRequest(
  user: Pick<AuthUser, "id" | "email" | "role" | "permissionRole" | "companyRole" | "isGlobalAdmin"> | null | undefined,
  request: Pick<AccessRequestV2, "requesterUserId" | "requesterEmail">,
) {
  if (!user?.id) return false;
  if (canReviewAccessRequests(user)) return true;

  const requesterEmail = (request.requesterEmail ?? "").trim().toLowerCase();
  const userEmail = (user.email ?? "").trim().toLowerCase();
  if (request.requesterUserId && request.requesterUserId === user.id) return true;
  if (requesterEmail && userEmail && requesterEmail === userEmail) return true;
  return false;
}

