export type UserOrigin = "testing_company" | "client_company";
export type UserScope = "shared" | "company_only";

export type CompanyScopedUserState = {
  created_by_company_id?: string | null;
  home_company_id?: string | null;
  user_origin?: string | null;
  user_scope?: string | null;
  allow_multi_company_link?: boolean | null;
};

type ScopeLockedError = Error & { code?: string };

function readTrimmed(value?: string | null) {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}

export function normalizeUserOrigin(value?: string | null): UserOrigin {
  return (value ?? "").trim().toLowerCase() === "client_company"
    ? "client_company"
    : "testing_company";
}

export function normalizeUserScope(value?: string | null): UserScope {
  return (value ?? "").trim().toLowerCase() === "company_only"
    ? "company_only"
    : "shared";
}

export function resolveAllowMultiCompanyLink(
  value?: boolean | null,
  scope?: string | null,
) {
  if (typeof value === "boolean") return value;
  return normalizeUserScope(scope) !== "company_only";
}

export function buildCompanyScopedUserState(companyId: string): {
  created_by_company_id: string;
  home_company_id: string;
  user_origin: "client_company";
  user_scope: "company_only";
  allow_multi_company_link: false;
} {
  const normalizedCompanyId = readTrimmed(companyId);
  if (!normalizedCompanyId) {
    throw new Error("companyId obrigatorio para criar usuario com escopo fechado");
  }

  return {
    created_by_company_id: normalizedCompanyId,
    home_company_id: normalizedCompanyId,
    user_origin: "client_company",
    user_scope: "company_only",
    allow_multi_company_link: false,
  };
}

export function resolveUserOriginLabel(value?: string | null) {
  return normalizeUserOrigin(value) === "client_company" ? "Da empresa" : "Interno TC";
}

export function isUserScopeLockedError(error: unknown): error is ScopeLockedError {
  return !!error && typeof error === "object" && (error as { code?: string }).code === "USER_SCOPE_LOCKED";
}

export function getUserScopeLockedMessage() {
  return "Usuario com escopo fechado nao pode ser vinculado a outra empresa.";
}

export function assertUserCanLinkToCompany(
  user: CompanyScopedUserState | null | undefined,
  targetCompanyId: string,
) {
  const normalizedTargetCompanyId = readTrimmed(targetCompanyId);
  if (!user || !normalizedTargetCompanyId) return;

  const scope = normalizeUserScope(user.user_scope);
  const allowMultiCompanyLink = resolveAllowMultiCompanyLink(
    user.allow_multi_company_link,
    user.user_scope,
  );
  const lockedCompanyId =
    readTrimmed(user.home_company_id) ?? readTrimmed(user.created_by_company_id);

  if ((scope !== "company_only" && allowMultiCompanyLink) || !lockedCompanyId) {
    return;
  }

  if (lockedCompanyId !== normalizedTargetCompanyId) {
    const error = new Error(getUserScopeLockedMessage()) as ScopeLockedError;
    error.code = "USER_SCOPE_LOCKED";
    throw error;
  }
}
