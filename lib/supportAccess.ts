import { hasPermissionAccess, type PermissionMatrix } from "@/lib/permissionMatrix";
import { ROLE_DEFAULTS, type Role } from "@/lib/permissions/roleDefaults";

type SupportAccessUser = {
  role?: string | null;
  permissionRole?: string | null;
  companyRole?: string | null;
  isGlobalAdmin?: boolean;
  permissions?: PermissionMatrix | null;
} | null | undefined;

function normalizeRole(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function toRoleKey(value?: string | null): Role | null {
  const normalized = normalizeRole(value);
  if (!normalized) return null;

  if (normalized === "admin" || normalized === "global_admin") return "admin";
  if (normalized === "dev" || normalized === "it_dev" || normalized === "itdev" || normalized === "developer") return "dev";
  if (
    normalized === "company" ||
    normalized === "company_admin" ||
    normalized === "client_admin" ||
    normalized === "client_owner" ||
    normalized === "client_manager"
  ) {
    return "company";
  }
  if (normalized === "support") return "support";
  if (
    normalized === "technical_support" ||
    normalized === "tech_support" ||
    normalized === "support_tech"
  ) {
    return "technical_support";
  }
  if (normalized === "leader_tc" || normalized === "lider_tc" || normalized === "tc_leader") return "leader_tc";
  if (
    normalized === "user" ||
    normalized === "viewer" ||
    normalized === "company_user" ||
    normalized === "testing_company_user"
  ) {
    return "user";
  }

  return null;
}

function resolveRoleKey(user: SupportAccessUser) {
  return toRoleKey(user?.permissionRole) ?? toRoleKey(user?.role) ?? toRoleKey(user?.companyRole);
}

function hasRoleDefaultAccess(
  user: SupportAccessUser,
  moduleId: "tickets" | "support",
  action: string,
) {
  const roleKey = resolveRoleKey(user);
  if (!roleKey) return false;
  return Array.isArray(ROLE_DEFAULTS[roleKey]?.[moduleId]) && ROLE_DEFAULTS[roleKey][moduleId].includes(action);
}

function matchesAnyRole(
  user: SupportAccessUser,
  values: string[],
) {
  const allowed = new Set(values.map((value) => normalizeRole(value)));
  return (
    allowed.has(normalizeRole(user?.role)) ||
    allowed.has(normalizeRole(user?.permissionRole)) ||
    allowed.has(normalizeRole(user?.companyRole))
  );
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
  return matchesAnyRole(user, [
    "technical_support",
    "support",
    "tech_support",
    "support_tech",
  ]);
}

export function isSupportDeveloperUser(user: SupportAccessUser) {
  return matchesAnyRole(user, [
    "it_dev",
    "itdev",
    "developer",
    "dev",
  ]);
}

export function isSupportAdminUser(user: SupportAccessUser) {
  return Boolean(user?.isGlobalAdmin) || matchesAnyRole(user, [
    "admin",
    "global_admin",
  ]);
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
