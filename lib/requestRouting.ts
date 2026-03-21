import type { AccessType } from "@/lib/accessRequestMessage";

export type RequestProfileType =
  | "testing_company_user"
  | "company_user"
  | "testing_company_lead"
  | "technical_support";

export type RequestProfileTypeLabel =
  | "Usuario Testing Company"
  | "Usuario Empresa"
  | "Lider TC"
  | "Suporte Tecnico";

export type ReviewQueue = "admin_and_global" | "global_only";

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function toRequestProfileTypeLabel(profileType: RequestProfileType): RequestProfileTypeLabel {
  if (profileType === "testing_company_user") return "Usuario Testing Company";
  if (profileType === "company_user") return "Usuario Empresa";
  if (profileType === "testing_company_lead") return "Lider TC";
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
    normalized === "testing_company_user"
  ) {
    return "testing_company_user";
  }

  if (
    normalized === "empresa" ||
    normalized === "usuario empresa" ||
    normalized === "usuario da empresa" ||
    normalized === "company user" ||
    normalized === "company_user" ||
    normalized === "company"
  ) {
    return "company_user";
  }

  if (
    normalized === "admin" ||
    normalized === "admin do sistema" ||
    normalized === "usuario lider tc" ||
    normalized === "lider tc" ||
    normalized === "testing_company_lead" ||
    normalized === "tc_lead"
  ) {
    return "testing_company_lead";
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
  if (profileType === "testing_company_lead") return "admin";
  if (profileType === "company_user") return "company";
  if (profileType === "technical_support") return "global";
  return "user";
}

export function requestProfileTypeNeedsCompany(profileType: RequestProfileType) {
  return profileType === "testing_company_user";
}

export const requiresCompanyForProfileType = requestProfileTypeNeedsCompany;

export function resolveReviewQueue(profileType: RequestProfileType): ReviewQueue {
  return profileType === "technical_support" ? "global_only" : "admin_and_global";
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
  const role = normalizeText(input.role ?? "");
  const globalRole = normalizeText(input.globalRole ?? "");
  if (role === "it_dev" || role === "itdev" || role === "developer" || role === "dev") {
    return "technical_support" as const;
  }
  if (input.isGlobalAdmin === true || globalRole === "global_admin" || role === "admin") {
    return "testing_company_lead" as const;
  }
  if (role === "company" || role === "company_admin" || role === "client_admin") {
    return "company_user" as const;
  }
  return "testing_company_user" as const;
}
