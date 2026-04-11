import { hasPermissionAccess, type PermissionMatrix } from "@/lib/permissionMatrix";
import { resolveRoleDefaults, type Role } from "@/lib/permissions/roleDefaults";
import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";

type SupportAccessUser = {
  role?: string | null;
  permissionRole?: string | null;
  companyRole?: string | null;
  isGlobalAdmin?: boolean;
  permissions?: PermissionMatrix | null;
} | null | undefined;

function toRoleKey(value?: string | null): Role | null {
  return normalizeLegacyRole(value);
}

function resolveRoleKey(user: SupportAccessUser) {
  return toRoleKey(user?.permissionRole) ?? toRoleKey(user?.role) ?? toRoleKey(user?.companyRole);
}

function hasCanonicalRole(user: SupportAccessUser, role: SystemRole) {
  return resolveRoleKey(user) === role;
}

function hasRoleDefaultAccess(
  user: SupportAccessUser,
  moduleId: "tickets" | "support",
  action: string,
) {
  const roleKey = resolveRoleKey(user);
  if (!roleKey) return false;
  const roleDefaults = resolveRoleDefaults(roleKey);
  return Array.isArray(roleDefaults[moduleId]) && roleDefaults[moduleId].includes(action);
}

export function hasSupportAccess(
  user: SupportAccessUser,
  moduleId: "tickets" | "support",
  action: string,
) {
  if (!user) return false;
  return hasPermissionAccess(user.permissions, moduleId, action) || hasRoleDefaultAccess(user, moduleId, action);
}

export function canViewSupportBoard(user: SupportAccessUser) {
  return hasSupportAccess(user, "tickets", "view") || hasSupportAccess(user, "support", "view");
}

export function canCreateSupportTickets(user: SupportAccessUser) {
  return hasSupportAccess(user, "tickets", "create") || hasSupportAccess(user, "support", "create");
}

export function canCommentSupportTickets(user: SupportAccessUser) {
  return hasSupportAccess(user, "tickets", "comment") || hasSupportAccess(user, "support", "comment");
}

export function isTechnicalSupportUser(user: SupportAccessUser) {
  return hasCanonicalRole(user, SYSTEM_ROLES.TECHNICAL_SUPPORT);
}

export function isSupportDeveloperUser(user: SupportAccessUser) {
  return hasCanonicalRole(user, SYSTEM_ROLES.TECHNICAL_SUPPORT);
}

export function isSupportAdminUser(user: SupportAccessUser) {
  return Boolean(user?.isGlobalAdmin) || hasCanonicalRole(user, SYSTEM_ROLES.LEADER_TC);
}

export function isSupportOperatorUser(user: SupportAccessUser) {
  return isTechnicalSupportUser(user);
}

export function canAccessGlobalSupportScope(user: SupportAccessUser) {
  if (!canViewSupportBoard(user)) return false;
  return isSupportOperatorUser(user);
}

export function canManageSupportWorkflow(user: SupportAccessUser) {
  if (!isSupportOperatorUser(user)) return false;
  return (
    hasSupportAccess(user, "tickets", "assign") ||
    hasSupportAccess(user, "tickets", "status") ||
    hasSupportAccess(user, "support", "assign") ||
    hasSupportAccess(user, "support", "status")
  );
}
