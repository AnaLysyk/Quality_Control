import type { AuthUser } from "@/backend/jwtAuth";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/backend/auth/roles";
import type { TestCaseRecord } from "./types";

function resolveRoles(user: AuthUser) {
  return [user.permissionRole, user.globalRole, user.role, user.companyRole]
    .map((role) => normalizeLegacyRole(role))
    .filter(Boolean);
}

export function canUseGlobalTestCaseScope(user: AuthUser) {
  const roles = resolveRoles(user);
  return (
    user.isGlobalAdmin ||
    user.projectScope === "unrestricted" ||
    roles.includes(SYSTEM_ROLES.TECHNICAL_SUPPORT)
  );
}

export function resolveAllowedTestCaseCompanies(user: AuthUser) {
  return Array.from(
    new Set(
      [user.companySlug, ...(Array.isArray(user.companySlugs) ? user.companySlugs : [])]
        .filter((slug): slug is string => typeof slug === "string" && slug.length > 0)
        .map((slug) => slug.toLowerCase()),
    ),
  );
}

// null = sem restrição de projeto (empresa/technical_support/admin global);
// array = usuário (company_user ou testing_company_user) restrito a esses projectIds.
export function resolveAllowedProjectIds(user: AuthUser): string[] | null {
  if (canUseGlobalTestCaseScope(user)) return null;
  if (resolveRoles(user).includes(SYSTEM_ROLES.LEADER_TC)) {
    return Array.isArray(user.allowedProjectIds) ? user.allowedProjectIds : [];
  }
  return Array.isArray(user.allowedProjectIds) && user.allowedProjectIds.length > 0
    ? user.allowedProjectIds
    : null;
}

function matchesProjectScope(user: AuthUser, projectId?: string | null) {
  const allowedProjectIds = resolveAllowedProjectIds(user);
  if (!allowedProjectIds) return true;
  return Boolean(projectId && allowedProjectIds.includes(projectId));
}

export function filterTestCasesByPermission(records: TestCaseRecord[], user: AuthUser) {
  const allowedCompanies = canUseGlobalTestCaseScope(user) ? null : resolveAllowedTestCaseCompanies(user);
  return records.filter((record) => {
    const companySlug = record.testCase.companyId?.toLowerCase();
    if (allowedCompanies && !(companySlug && allowedCompanies.includes(companySlug))) return false;
    return matchesProjectScope(user, record.testCase.projectId);
  });
}

export function canCreateTestCaseForCompany(
  user: AuthUser,
  companySlug: string | null | undefined,
  projectId?: string | null,
) {
  if (!canUseGlobalTestCaseScope(user)) {
    const normalizedCompanySlug = companySlug?.trim().toLowerCase();
    if (!normalizedCompanySlug) return false;
    if (!resolveAllowedTestCaseCompanies(user).includes(normalizedCompanySlug)) return false;
  }
  return matchesProjectScope(user, projectId);
}

export function canAccessTestCaseRecord(user: AuthUser, record: TestCaseRecord) {
  if (!canUseGlobalTestCaseScope(user)) {
    const companySlug = record.testCase.companyId?.toLowerCase();
    if (!companySlug || !resolveAllowedTestCaseCompanies(user).includes(companySlug)) return false;
  }
  return matchesProjectScope(user, record.testCase.projectId);
}
