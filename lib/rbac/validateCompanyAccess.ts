import type { AuthUser } from "@/lib/jwtAuth";
import { listLocalLinksForUser } from "@/lib/auth/localStore";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";

export async function assertCompanyAccess(user: AuthUser | null, companyId?: string | null) {
  if (!user || !companyId) throw new Error("MISSING_COMPANY_ID");

  const role = normalizeLegacyRole(user.role);

  // Global profiles can select companies only in modules that separately grant that capability.
  if (role === SYSTEM_ROLES.LEADER_TC || role === SYSTEM_ROLES.TECHNICAL_SUPPORT) return;

  // Company-scoped profiles only access their own tenant.
  if ((role === SYSTEM_ROLES.EMPRESA || role === SYSTEM_ROLES.COMPANY_USER) && user.companyId === companyId) return;

  // TC users access only linked companies.
  if (role === SYSTEM_ROLES.TESTING_COMPANY_USER) {
    if (user.companyId === companyId) return;
    const links = await listLocalLinksForUser(user.id);
    if (links.some((link) => link.companyId === companyId)) return;
  }

  throw new Error("FORBIDDEN_COMPANY_ACCESS");
}

export function requireCompanyIdPresent(companyId?: string | null) {
  if (!companyId) throw new Error("MISSING_COMPANY_ID");
}
