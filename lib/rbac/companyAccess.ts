import type { AuthUser } from "@/lib/jwtAuth";

export function isCompanyUser(user: AuthUser | null) {
  if (!user) return false;
  const role = (user.role ?? "").toLowerCase();
  if (role === "company" || role === "empresa" || role === "client") return true;
  const companyRole = (user.companyRole ?? "").toLowerCase();
  return companyRole === "company_admin";
}
