import type { AuthUser } from "@/lib/jwtAuth";
import { resolveNormalizedCompanySlugs } from "@/lib/auth/normalizeAuthenticatedUser";
import { SYSTEM_ROLES } from "@/lib/auth/roles";

export function isCompanyUser(user: AuthUser | null) {
  if (!user) return false;
  const role = (user.role ?? "").toLowerCase();
  if (role === SYSTEM_ROLES.EMPRESA) return true;
  const companyRole = (user.companyRole ?? "").toLowerCase();
  if (companyRole === SYSTEM_ROLES.EMPRESA) return true;
  if (role === SYSTEM_ROLES.COMPANY_USER || role === SYSTEM_ROLES.TESTING_COMPANY_USER) {
    if (user.companyId) return true;
    if (resolveNormalizedCompanySlugs(user).length > 0) return true;
  }
  return false;
}
