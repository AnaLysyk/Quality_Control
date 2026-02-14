
import { cookies } from "next/headers";
import { listLocalCompanies, listLocalLinksForUser, normalizeLocalRole } from "@/lib/auth/localStore";


/**
 * Papéis possíveis para RBAC de defeitos.
 */
export type Role = "admin" | "company" | "user";


/**
 * Usuário autenticado mínimo para RBAC de defeitos.
 */
type AuthUser = {
  id: string;
  isGlobalAdmin: boolean;
};

/**
 * Resolve o papel do usuário para RBAC de defeitos.
 * - Admin global sempre é "admin".
 * - Se não autenticado, retorna "user".
 * - Se tem vínculo de admin de empresa, retorna "company".
 * - Se só tem um vínculo, também retorna "company".
 * - Se clientSlug for passado, só retorna "company" se o vínculo for com esse cliente.
 * - Caso contrário, retorna "user".
 */
export async function resolveDefectRole(
  authUser: AuthUser | null | undefined,
  clientSlug?: string | null
): Promise<Role> {
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


/**
 * Permissões de ações manuais de defeitos por papel.
 */
// Usuário final também pode criar defeitos manuais (sem editar/deletar)
export const canCreateManualDefect = (role: Role) => role === "admin" || role === "company" || role === "user";
// Só admin e empresa podem editar
export const canEditManualDefect = (role: Role) => role === "admin" || role === "company";
// Só admin e empresa podem vincular execução
export const canLinkRun = (role: Role) => role === "admin" || role === "company";
// Só admin pode deletar
export const canDeleteManualDefect = (role: Role) => role === "admin";


/**
 * Obtém papel simulado (mock) via cookie, para testes.
 */
export async function getMockRole(): Promise<Role | null> {
  const store = await cookies();
  const raw = store.get("mock_role")?.value?.toLowerCase();
  if (raw === "admin" || raw === "company" || raw === "user") return raw as Role;
  return null;
}
