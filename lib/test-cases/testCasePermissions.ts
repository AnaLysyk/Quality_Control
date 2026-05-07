import type { AuthUser } from "@/lib/jwtAuth";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
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
    roles.includes(SYSTEM_ROLES.LEADER_TC) ||
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

export function filterTestCasesByPermission(records: TestCaseRecord[], user: AuthUser) {
  if (canUseGlobalTestCaseScope(user)) return records;
  const allowedCompanies = resolveAllowedTestCaseCompanies(user);
  return records.filter((record) => {
    const companyId = record.testCase.companyId?.toLowerCase();
    return Boolean(companyId && allowedCompanies.includes(companyId));
  });
}

export function canCreateTestCaseForCompany(user: AuthUser, companyId: string | null | undefined) {
  if (canUseGlobalTestCaseScope(user)) return true;
  const normalizedCompanyId = companyId?.trim().toLowerCase();
  if (!normalizedCompanyId) return false;
  return resolveAllowedTestCaseCompanies(user).includes(normalizedCompanyId);
}
