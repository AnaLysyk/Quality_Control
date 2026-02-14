
import { getMockRole, resolveDefectRole, type Role } from "@/lib/rbac/defects";


/**
 * Usuário autenticado mínimo para RBAC de execuções.
 */
type AuthUser = {
  id: string;
  isGlobalAdmin: boolean;
};


/**
 * Resolve o papel do usuário para RBAC de execuções (runs).
 * Usa a mesma lógica de defeitos.
 */
export async function resolveRunRole(authUser: AuthUser | null, clientSlug?: string | null): Promise<Role> {
  try {
    return await resolveDefectRole(authUser, clientSlug);
  } catch {
    return "user";
  }
}


/**
 * Permissões de ações em execuções por papel.
 */
// Só admin e empresa podem criar execuções
export const canCreateRun = (role: Role) => role === "admin" || role === "company";
// Admin, empresa e usuário podem editar execuções
export const canEditRun = (role: Role) => role === "admin" || role === "company" || role === "user";
// Só admin pode deletar execuções
export const canDeleteRun = (role: Role) => role === "admin";
// Só admin e empresa podem vincular defeitos
export const canLinkDefect = (role: Role) => role === "admin" || role === "company";
// Mock para testes
export const getRunMockRole = getMockRole;
