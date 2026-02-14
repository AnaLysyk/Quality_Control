
import type { AuthUser } from "@/lib/jwtAuth";

/**
 * Verifica se o usuário tem perfil de empresa (company, empresa, client, company_admin ou user vinculado a empresa).
 * Retorna true se o usuário for considerado um "usuário de empresa" para fins de RBAC.
 */
export function isCompanyUser(user: AuthUser | null): boolean {
  if (!user) return false;
  // Normaliza o papel principal
  const role = (user.role ?? "").toLowerCase();
  if (role === "company" || role === "empresa" || role === "client") return true;
  // Verifica papel específico de admin de empresa
  const companyRole = (user.companyRole ?? "").toLowerCase();
  if (companyRole === "company_admin") return true;
  // Usuário comum, mas vinculado a empresa
  if (role === "user") {
    if (user.companyId) return true;
    if (Array.isArray(user.companySlugs) && user.companySlugs.length > 0) return true;
  }
  return false;
}
