import type { AuthUser } from "@/lib/jwtAuth";

export function isCompanyUser(user: AuthUser | null) {
  if (!user) return false;
  const role = (user.role ?? "").toLowerCase();
  if (role === "company" || role === "empresa" || role === "client") return true;
  const companyRole = (user.companyRole ?? "").toLowerCase();
  if (companyRole === "company_admin") return true;
  if (role === "user") {
    if (user.companyId) return true;
    if (Array.isArray(user.companySlugs) && user.companySlugs.length > 0) return true;
  }
  return false;
}
