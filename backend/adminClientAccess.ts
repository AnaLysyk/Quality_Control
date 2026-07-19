import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/backend/auth/roles";

export type AdminClientAccessLike = {
  isGlobalAdmin?: boolean | null;
  is_global_admin?: boolean | null;
  permissionRole?: string | null;
  role?: string | null;
  companyRole?: string | null;
  globalRole?: string | null;
};

function collectRoles(user?: AdminClientAccessLike | null): SystemRole[] {
  return [
    user?.permissionRole,
    user?.role,
    user?.companyRole,
    user?.globalRole,
  ]
    .map((value) => normalizeLegacyRole(value))
    .filter((value): value is SystemRole => value !== null);
}

export function hasAdminClientToolAccess(user?: AdminClientAccessLike | null) {
  if (!user) return false;
  if (user.isGlobalAdmin === true || user.is_global_admin === true) return true;

  const roles = collectRoles(user);
  return roles.includes(SYSTEM_ROLES.LEADER_TC) || roles.includes(SYSTEM_ROLES.TECHNICAL_SUPPORT);
}

