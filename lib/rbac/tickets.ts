import type { AuthUser } from "@/lib/jwtAuth";
import type { TicketRecord } from "@/lib/ticketsStore";

export function isTicketAdmin(user: AuthUser | null) {
  if (!user) return false;
  const role = (user.role ?? "").toLowerCase();
  return user.isGlobalAdmin === true || role === "admin" || role === "global_admin";
}

export function isItDev(user: AuthUser | null) {
  if (!user) return false;
  if (isTicketAdmin(user)) return true;
  const role = (user.role ?? "").toLowerCase();
  return role === "it_dev" || role === "itdev" || role === "developer" || role === "dev";
}

function hasCompanyAccess(user: AuthUser, ticket: TicketRecord) {
  if (user.companyId && ticket.companyId) {
    return user.companyId === ticket.companyId;
  }
  if (ticket.companySlug && Array.isArray(user.companySlugs) && user.companySlugs.length) {
    return user.companySlugs.includes(ticket.companySlug);
  }
  if (!ticket.companyId && !ticket.companySlug) return true;
  return false;
}

export function canViewTicket(user: AuthUser | null, ticket: TicketRecord) {
  if (!user) return false;
  if (isItDev(user)) return true;
  if (ticket.createdBy === user.id) return true;
  const role = (user.role ?? "").toLowerCase();
  if (role === "company" && hasCompanyAccess(user, ticket)) return true;
  return false;
}

export function canCommentTicket(user: AuthUser | null, ticket: TicketRecord) {
  return canViewTicket(user, ticket);
}

export function canEditTicketContent(user: AuthUser | null, ticket: TicketRecord) {
  if (!user) return false;
  if (isItDev(user)) return true;
  return ticket.createdBy === user.id;
}

export function canAssignTicket(user: AuthUser | null, ticket?: TicketRecord) {
  if (!user) return false;
  if (!isItDev(user)) return false;
  if (!ticket) return true;
  return true;
}

export function canMoveTicket(user: AuthUser | null, ticket?: TicketRecord) {
  if (!user) return false;
  if (!isItDev(user)) return false;
  if (!ticket) return true;
  return true;
}
