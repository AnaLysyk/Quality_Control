import { cookies } from "next/headers";
import { listLocalCompanies, listLocalLinksForUser, normalizeLocalRole } from "@/lib/auth/localStore";
import { SYSTEM_ROLES } from "@/lib/auth/roles";

export type Role = "leader_tc" | "empresa" | "testing_company_user";

type AuthUser = {
  id: string;
  isGlobalAdmin: boolean;
};

export async function resolveDefectRole(authUser: AuthUser | null | undefined, clientSlug?: string | null): Promise<Role> {
  if (!authUser) return "testing_company_user";

  if (authUser.isGlobalAdmin) return "leader_tc";

  const [links, companies] = await Promise.all([
    listLocalLinksForUser(authUser.id),
    listLocalCompanies(),
  ]);

  if (!links.length) return "testing_company_user";

  const companyById = new Map(companies.map((company) => [company.id, company]));
  const hasCompanyAdminLink = links.some((link) => normalizeLocalRole(link.role ?? null) === SYSTEM_ROLES.EMPRESA);
  if (clientSlug) {
    const hasClient = links.some((link) => companyById.get(link.companyId)?.slug === clientSlug);
    if (!hasClient) return "testing_company_user";
  }

  if (hasCompanyAdminLink) return "empresa";
  if (links.length === 1) return "empresa";
  return "testing_company_user";
}

// Usuario final tambem pode criar defeitos manuais (sem editar/deletar).
export const canCreateManualDefect = (role: Role) => role === "leader_tc" || role === "empresa" || role === "testing_company_user";
export const canEditManualDefect = (role: Role) => role === "leader_tc" || role === "empresa";
export const canLinkRun = (role: Role) => role === "leader_tc" || role === "empresa";
export const canDeleteManualDefect = (role: Role) => role === "leader_tc";

export async function getMockRole(): Promise<Role | null> {
  const store = await cookies();
  const raw = store.get("mock_role")?.value?.toLowerCase();
  if (raw === "leader_tc" || raw === "empresa" || raw === "testing_company_user") return raw as Role;
  return null;
}
