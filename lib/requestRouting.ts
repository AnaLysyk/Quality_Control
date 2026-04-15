import type { AccessType } from "@/lib/accessRequestMessage";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";

export type RequestProfileType =
  | "empresa"
  | "testing_company_user"
  | "company_user"
  | "leader_tc"
  | "technical_support";

export type RequestProfileTypeLabel =
  | "Empresa"
  | "Usuario TC"
  | "Usuario da empresa"
  | "Lider TC"
  | "Suporte Tecnico";

export type ReviewQueue = "admin_and_global" | "global_only";

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function toRequestProfileTypeLabel(profileType: RequestProfileType): RequestProfileTypeLabel {
  if (profileType === "empresa") return "Empresa";
  if (profileType === "testing_company_user") return "Usuario TC";
  if (profileType === "company_user") return "Usuario da empresa";
  if (profileType === "leader_tc") return "Lider TC";
  return "Suporte Tecnico";
}

export function normalizeRequestProfileType(value: string | null | undefined): RequestProfileType | null {
  if (!value) return null;
  const normalized = normalizeText(value);

  if (
    normalized === "usuario" ||
    normalized === "usuario testing company" ||
    normalized === "testing company user" ||
    normalized === "tc_user" ||
    normalized === "tc user" ||
    normalized === "testing_company_user"
  ) {
    return "testing_company_user";
  }

  if (
    normalized === "empresa" ||
    normalized === "company" ||
    normalized === "company_admin" ||
    normalized === "client_admin"
  ) {
    return "empresa";
  }

  if (
    normalized === "usuario empresa" ||
    normalized === "usuario da empresa" ||
    normalized === "empresa_user" ||
    normalized === "company user" ||
    normalized === "company_user" ||
    normalized === "client_user"
  ) {
    return "company_user";
  }

  if (
    normalized === "admin" ||
    normalized === "admin do sistema" ||
    normalized === "usuario lider tc" ||
    normalized === "lider tc" ||
    normalized === "leader_tc" ||
    normalized === "testing_company_lead" ||
    normalized === "tc_lead"
  ) {
    return "leader_tc";
  }

  if (
    normalized === "global" ||
    normalized === "suporte tecnico" ||
    normalized === "suporte tÃ©cnico" ||
    normalized === "technical support" ||
    normalized === "technical_support"
  ) {
    return "technical_support";
  }

  return null;
}

export function toInternalAccessType(profileType: RequestProfileType): AccessType {
  return profileType;
}

export function requestProfileTypeNeedsCompany(profileType: RequestProfileType) {
  // This helper means "requires selecting an existing company". Company/company_user requests can carry company profile data.
  return profileType === "testing_company_user";
}

export const requiresCompanyForProfileType = requestProfileTypeNeedsCompany;

export function resolveReviewQueue(profileType: RequestProfileType): ReviewQueue {
  void profileType;
  return "admin_and_global";
}

export function canAdminReviewQueue(queue: ReviewQueue) {
  return queue === "admin_and_global";
}

export function isGlobalOnlyQueue(queue: ReviewQueue) {
  return queue === "global_only";
}

export function resolveRequestQueueMessage(queue: ReviewQueue) {
  if (queue === "global_only") return "Solicitacao enviada. A equipe Global sera notificada.";
  return "Solicitacao enviada. Admin e Global serao notificados.";
}

export function deriveProfileTypeFromAccount(input: {
  role?: string | null;
  globalRole?: string | null;
  isGlobalAdmin?: boolean;
}) {
  const role = normalizeLegacyRole(input.role);
  const globalRole = normalizeLegacyRole(input.globalRole);
  if (role === SYSTEM_ROLES.TECHNICAL_SUPPORT) return "technical_support" as const;
  if (input.isGlobalAdmin === true || globalRole === SYSTEM_ROLES.LEADER_TC || role === SYSTEM_ROLES.LEADER_TC) {
    return "leader_tc" as const;
  }
  if (role === SYSTEM_ROLES.EMPRESA) return "empresa" as const;
  if (role === SYSTEM_ROLES.COMPANY_USER) {
    return "company_user" as const;
  }
  return "testing_company_user" as const;
}
