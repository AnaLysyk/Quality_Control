import type { AuthUser } from "@/lib/jwtAuth";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import type { TicketRecord } from "@/lib/ticketsStore";

export function isTicketAdmin(user: AuthUser | null) {
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

export function canViewTicket(user: AuthUser | null, ticket: TicketRecord) {
  if (!user) return false;
  if (
    !hasPermissionAccess(user.permissions, "tickets", "view") &&
    !hasPermissionAccess(user.permissions, "support", "view")
  ) {
    return false;
  }
  if (isItDev(user)) return true;
  return ticket.createdBy === user.id;
}

export function canCommentTicket(user: AuthUser | null, ticket: TicketRecord) {
  return (
    canViewTicket(user, ticket) &&
    (hasPermissionAccess(user?.permissions, "tickets", "comment") ||
      hasPermissionAccess(user?.permissions, "support", "comment"))
  );
}

export function canEditTicketContent(user: AuthUser | null, ticket: TicketRecord) {
  if (!user) return false;
  if (!hasPermissionAccess(user.permissions, "tickets", "edit")) return false;
  if (isItDev(user)) return true;
  return ticket.createdBy === user.id;
}

export function canAssignTicket(user: AuthUser | null, ticket?: TicketRecord) {
  if (!user) return false;
  if (
    !hasPermissionAccess(user.permissions, "tickets", "assign") &&
    !hasPermissionAccess(user.permissions, "support", "assign")
  ) {
    return false;
  }
  if (!ticket) return false;
  if (isItDev(user)) return true;
  return ticket.createdBy === user.id;
}

export function canMoveTicket(user: AuthUser | null, ticket?: TicketRecord) {
  if (!user) return false;
  if (
    !hasPermissionAccess(user.permissions, "tickets", "status") &&
    !hasPermissionAccess(user.permissions, "support", "status")
  ) {
    return false;
  }
  if (!ticket) return false;
  if (isItDev(user)) return true;
  return ticket.createdBy === user.id;
}
