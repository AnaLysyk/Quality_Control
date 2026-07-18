import type { AuthUser } from "@/backend/jwtAuth";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/backend/auth/roles";
import { listLocalLinksForUser } from "@/backend/auth/localStore";

export async function assertCompanyAccess(user: AuthUser | null, companyId?: string | null) {
  if (!user || !companyId) throw new Error("MISSING_COMPANY_ID");

  const role = normalizeLegacyRole(user.role);

  // Apenas administrador real e suporte técnico têm alcance global. Líder TC
  // precisa de um ProjectTeamAssignment ativo na empresa solicitada.
  if (user.isGlobalAdmin || role === SYSTEM_ROLES.TECHNICAL_SUPPORT || user.projectScope === "unrestricted") return;

  if (role === SYSTEM_ROLES.LEADER_TC) {
    if (user.assignments?.some((assignment) => assignment.status === "active" && assignment.companyId === companyId)) return;
    throw new Error("FORBIDDEN_COMPANY_ACCESS");
  }

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
