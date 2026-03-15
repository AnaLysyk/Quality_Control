import type { AuthUser } from "@/lib/jwtAuth";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import type { SuporteRecord } from "@/lib/ticketsStore";

export function isSuporteAdmin(user: AuthUser | null) {
  if (!user) return false;
  const role = (user.role ?? "").toLowerCase();
  return user.isGlobalAdmin === true || role === "admin" || role === "global_admin";
}

export function isItDev(user: AuthUser | null) {
  if (!user) return false;
  const role = (user.role ?? "").toLowerCase();
  const permissionRole = (user.permissionRole ?? "").toLowerCase();
  const companyRole = (user.companyRole ?? "").toLowerCase();
  return (
    role === "it_dev" ||
    role === "itdev" ||
    role === "developer" ||
    role === "dev" ||
    permissionRole === "dev" ||
    companyRole === "it_dev"
  );
}

export function canViewSuporte(user: AuthUser | null, suporte: SuporteRecord) {
  if (!user) return false;
  const canView = hasPermissionAccess(user.permissions, "support", "view") || hasPermissionAccess(user.permissions, "tickets", "view");
  if (!canView) return false;
  if (isItDev(user)) return true;
  return suporte.createdBy === user.id;
}

export function canCommentSuporte(user: AuthUser | null, suporte: SuporteRecord) {
  const canComment = hasPermissionAccess(user?.permissions, "support", "comment") || hasPermissionAccess(user?.permissions, "tickets", "comment");
  return canViewSuporte(user, suporte) && canComment;
}
