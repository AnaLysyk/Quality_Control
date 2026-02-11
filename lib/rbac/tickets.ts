import type { AuthUser } from "@/lib/jwtAuth";
import type { TicketRecord } from "@/lib/ticketsStore";

export function isTicketAdmin(user: AuthUser | null) {
  if (!user) return false;
  const role = (user.role ?? "").toLowerCase();
  return user.isGlobalAdmin === true || role === "admin" || role === "global_admin";
}

export function isItDev(user: AuthUser | null) {
  if (!user) return false;
  const role = (user.role ?? "").toLowerCase();
  return role === "it_dev" || role === "itdev" || role === "developer" || role === "dev";
}

export function canViewTicket(user: AuthUser | null, ticket: TicketRecord) {
  if (!user) return false;
  if (isTicketAdmin(user) || isItDev(user)) return true;
  return ticket.createdBy === user.id;
}

export function canCommentTicket(user: AuthUser | null, ticket: TicketRecord) {
  return canViewTicket(user, ticket);
}

export function canEditTicketContent(user: AuthUser | null, ticket: TicketRecord) {
  if (!user) return false;
  if (isTicketAdmin(user)) return true;
  return ticket.createdBy === user.id;
}

export function canAssignTicket(user: AuthUser | null) {
  return isTicketAdmin(user) || isItDev(user);
}

export function canMoveTicket(user: AuthUser | null) {
  return isTicketAdmin(user) || isItDev(user);
}
