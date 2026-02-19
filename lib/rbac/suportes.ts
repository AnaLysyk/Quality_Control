import type { AuthUser } from "@/lib/jwtAuth";
import type { SuporteRecord } from "@/lib/ticketsStore";

export function isSuporteAdmin(user: AuthUser | null) {
  if (!user) return false;
  const role = (user.role ?? "").toLowerCase();
  return user.isGlobalAdmin === true || role === "admin" || role === "global_admin";
}

export function isItDev(user: AuthUser | null) {
  if (!user) return false;
  if (isSuporteAdmin(user)) return true;
  const role = (user.role ?? "").toLowerCase();
  return role === "it_dev" || role === "itdev" || role === "developer" || role === "dev";
}

function hasCompanyAccess(user: AuthUser, suporte: SuporteRecord) {
  if (user.companyId && suporte.companyId) {
    return user.companyId === suporte.companyId;
  }
  if (suporte.companySlug && Array.isArray(user.companySlugs) && user.companySlugs.length) {
    return user.companySlugs.includes(suporte.companySlug);
  }
  if (!suporte.companyId && !suporte.companySlug) return true;
  return false;
}

export function canViewSuporte(user: AuthUser | null, suporte: SuporteRecord) {
  if (!user) return false;
  if (isItDev(user)) return true;
  if (suporte.createdBy === user.id) return true;
  const role = (user.role ?? "").toLowerCase();
  if (role === "company" && hasCompanyAccess(user, suporte)) return true;
  return false;
}

export function canCommentSuporte(user: AuthUser | null, suporte: SuporteRecord) {
  return canViewSuporte(user, suporte);
}
