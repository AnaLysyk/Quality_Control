import { cookies } from "next/headers";
import { listLocalCompanies, listLocalLinksForUser, normalizeLocalRole } from "@/lib/auth/localStore";

export type Role = "admin" | "company" | "user";

type AuthUser = {
  id: string;
  isGlobalAdmin: boolean;
};

export async function resolveDefectRole(authUser: AuthUser | null | undefined, clientSlug?: string | null): Promise<Role> {
  if (!authUser) return "user";

  if (authUser.isGlobalAdmin) return "admin";

  const [links, companies] = await Promise.all([
    listLocalLinksForUser(authUser.id),
    listLocalCompanies(),
  ]);

  if (!links.length) return "user";

  const companyById = new Map(companies.map((company) => [company.id, company]));
  const hasCompanyAdminLink = links.some((link) => normalizeLocalRole(link.role ?? null) === "company_admin");
  if (clientSlug) {
    const hasClient = links.some((link) => companyById.get(link.companyId)?.slug === clientSlug);
    if (!hasClient) return "user";
  }

  if (hasCompanyAdminLink) return "company";
  if (links.length === 1) return "company";
  return "user";
}

// Usuario final tambem pode criar defeitos manuais (sem editar/deletar).
export const canCreateManualDefect = (role: Role) => role === "admin" || role === "company" || role === "user";
export const canEditManualDefect = (role: Role) => role === "admin" || role === "company";
export const canLinkRun = (role: Role) => role === "admin" || role === "company";
export const canDeleteManualDefect = (role: Role) => role === "admin";

export async function getMockRole(): Promise<Role | null> {
  const store = await cookies();
  const raw = store.get("mock_role")?.value?.toLowerCase();
  if (raw === "admin" || raw === "company" || raw === "user") return raw as Role;
  return null;
}
