
import type { AuthUser } from "@/lib/jwtAuth";
import type { TicketRecord } from "@/lib/ticketsStore";

/**
 * Verifica se o usuário é admin de tickets (admin global ou papel admin).
 */
export function isTicketAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  const role = (user.role ?? "").toLowerCase();
  return user.isGlobalAdmin === true || role === "admin" || role === "global_admin";
}

/**
 * Verifica se o usuário é desenvolvedor ou admin de tickets.
 */
export function isItDev(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isTicketAdmin(user)) return true;
  const role = (user.role ?? "").toLowerCase();
  return role === "it_dev" || role === "itdev" || role === "developer" || role === "dev";
}

/**
 * Verifica se o usuário tem acesso à empresa do ticket.
 */
function hasCompanyAccess(user: AuthUser, ticket: TicketRecord): boolean {
  if (user.companyId && ticket.companyId) {
    return user.companyId === ticket.companyId;
  }
  if (ticket.companySlug && Array.isArray(user.companySlugs) && user.companySlugs.length) {
    return user.companySlugs.includes(ticket.companySlug);
  }
  if (!ticket.companyId && !ticket.companySlug) return true;
  return false;
}

/**
 * Verifica se o usuário pode visualizar o ticket.
 */
export function canViewTicket(user: AuthUser | null, ticket: TicketRecord): boolean {
  if (!user) return false;
  if (isItDev(user)) return true;
  if (ticket.createdBy === user.id) return true;
  const role = (user.role ?? "").toLowerCase();
  if (role === "company" && hasCompanyAccess(user, ticket)) return true;
  return false;
}

/**
 * Verifica se o usuário pode comentar no ticket.
 */
export function canCommentTicket(user: AuthUser | null, ticket: TicketRecord): boolean {
  return canViewTicket(user, ticket);
}

/**
 * Verifica se o usuário pode editar o conteúdo do ticket.
 */
export function canEditTicketContent(user: AuthUser | null, ticket: TicketRecord): boolean {
  if (!user) return false;
  if (isItDev(user)) return true;
  return ticket.createdBy === user.id;
}

/**
 * Verifica se o usuário pode atribuir o ticket.
 */
export function canAssignTicket(user: AuthUser | null, ticket?: TicketRecord): boolean {
  if (!user) return false;
  if (!isItDev(user)) return false;
  if (!ticket) return true;
  return true;
}

/**
 * Verifica se o usuário pode mover o ticket.
 */
export function canMoveTicket(user: AuthUser | null, ticket?: TicketRecord): boolean {
  if (!user) return false;
  if (!isItDev(user)) return false;
  if (!ticket) return true;
  return true;
}
