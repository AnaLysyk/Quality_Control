import type { AuthUser } from "@/lib/jwtAuth";
import {
  canAccessGlobalSupportScope,
  canCommentSupportTickets,
  canManageSupportWorkflow,
  canViewSupportBoard,
  isSupportAdminUser,
  isSupportDeveloperUser,
} from "@/lib/supportAccess";
import type { TicketRecord } from "@/lib/ticketsStore";

export function isTicketAdmin(user: AuthUser | null) {
  return isSupportAdminUser(user);
}

export function isItDev(user: AuthUser | null) {
  return isSupportDeveloperUser(user);
}

export function canManageAllTickets(user: AuthUser | null) {
  if (!user) return false;
  return canManageSupportWorkflow(user);
}

export function canAccessGlobalTicketWorkspace(user: AuthUser | null) {
  return canAccessGlobalSupportScope(user);
}

export function hasTicketEnteredSupportFlow(ticket: TicketRecord | null | undefined) {
  if (!ticket) return false;
  return ticket.status !== "backlog" || Boolean(ticket.assignedToUserId);
}

export function canViewTicket(user: AuthUser | null, ticket: TicketRecord) {
  if (!user) return false;
  if (!canViewSupportBoard(user)) return false;
  if (canAccessGlobalTicketWorkspace(user)) return true;
  return ticket.createdBy === user.id;
}

export function canCommentTicket(user: AuthUser | null, ticket: TicketRecord) {
  return canViewTicket(user, ticket) && canCommentSupportTickets(user);
}

export function canEditTicketContent(user: AuthUser | null, _ticket: TicketRecord) {
  if (!user) return false;
  void _ticket;
  return canManageSupportWorkflow(user);
}

export function canAssignTicket(user: AuthUser | null, ticket?: TicketRecord) {
  if (!user) return false;
  if (!ticket) return false;
  return canAccessGlobalTicketWorkspace(user) && canManageSupportWorkflow(user);
}

export function canMoveTicket(user: AuthUser | null, ticket?: TicketRecord) {
  if (!user) return false;
  if (!ticket) return false;
  return canAccessGlobalTicketWorkspace(user) && canManageSupportWorkflow(user);
}
