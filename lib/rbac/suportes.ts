import type { AuthUser } from "@/lib/jwtAuth";
import {
  canAccessGlobalSupportScope,
  canCommentSupportTickets,
  canViewSupportBoard,
  isSupportAdminUser,
  isSupportDeveloperUser,
} from "@/lib/supportAccess";
import type { SuporteRecord } from "@/lib/ticketsStore";

export function isSuporteAdmin(user: AuthUser | null) {
  return isSupportAdminUser(user);
}

export function isItDev(user: AuthUser | null) {
  return isSupportDeveloperUser(user);
}

export function canViewSuporte(user: AuthUser | null, suporte: SuporteRecord) {
  if (!user) return false;
  if (!canViewSupportBoard(user)) return false;
  if (canAccessGlobalSupportScope(user)) return true;
  return suporte.createdBy === user.id;
}

export function canCommentSuporte(user: AuthUser | null, suporte: SuporteRecord) {
  return canViewSuporte(user, suporte) && canCommentSupportTickets(user);
}
