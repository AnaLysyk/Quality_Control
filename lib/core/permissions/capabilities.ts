import type { CompanyRole, Capability, GlobalRole, Permission, UserRole } from "./permissions.types";
import { SYSTEM_ROLES } from "@/lib/auth/roles";

const rolePermissions: Record<UserRole, Permission[]> = {
  [SYSTEM_ROLES.TESTING_COMPANY_USER]: ["read_dashboard", "manage_tests"],
  [SYSTEM_ROLES.COMPANY_USER]: ["read_dashboard", "manage_tests"],
  [SYSTEM_ROLES.EMPRESA]: ["read_dashboard", "manage_tests", "manage_releases"],
  [SYSTEM_ROLES.LEADER_TC]: ["read_dashboard", "manage_users", "manage_companies", "manage_releases", "manage_tests", "view_admin"],
  [SYSTEM_ROLES.TECHNICAL_SUPPORT]: [
    "read_dashboard",
    "manage_users",
    "manage_companies",
    "manage_releases",
    "manage_tests",
    "view_admin",
    "manage_settings",
  ],
};

const roleCapabilities: Record<CompanyRole, Capability[]> = {
  [SYSTEM_ROLES.EMPRESA]: [
    "company:read",
    "company:write",
    "user:read",
    "user:write",
    "metrics:read",
    "metrics:write",
    "release:read",
    "release:write",
    "run:read",
    "run:write",
    "defect:read",
    "defect:write",
  ],
  [SYSTEM_ROLES.LEADER_TC]: [
    "company:read",
    "company:write",
    "user:read",
    "user:write",
    "metrics:read",
    "metrics:write",
    "release:read",
    "release:write",
    "run:read",
    "run:write",
    "defect:read",
    "defect:write",
  ],
  [SYSTEM_ROLES.TECHNICAL_SUPPORT]: [
    "company:read",
    "metrics:read",
    "release:read",
    "run:read",
    "defect:read",
  ],
  [SYSTEM_ROLES.COMPANY_USER]: [
    "company:read",
    "metrics:read",
    "release:read",
    "run:read",
    "defect:read",
  ],
  [SYSTEM_ROLES.TESTING_COMPANY_USER]: [
    "company:read",
    "metrics:read",
    "release:read",
    "run:read",
    "defect:read",
  ],
};

export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  return rolePermissions[userRole]?.includes(permission) ?? false;
}

export function requirePermission(userRole: UserRole, permission: Permission): void {
  if (!hasPermission(userRole, permission)) {
    throw new Error(`Permission denied: ${permission} for role ${userRole}`);
  }
}

export function getUserRoleFromSession(session: unknown): UserRole {
  const role = (session as { role?: unknown } | null)?.role;
  if (role === SYSTEM_ROLES.LEADER_TC || role === SYSTEM_ROLES.TECHNICAL_SUPPORT) return role;
  if (role === SYSTEM_ROLES.EMPRESA) return role;
  if (role === SYSTEM_ROLES.COMPANY_USER) return role;
  return SYSTEM_ROLES.TESTING_COMPANY_USER;
}

export function resolveCapabilities(input: {
  globalRole?: GlobalRole | null;
  companyRole?: CompanyRole | null;
  membershipCapabilities?: string[] | null;
}): Capability[] {
  if (input.globalRole === "global_admin") return ["*"];
  if (Array.isArray(input.membershipCapabilities) && input.membershipCapabilities.length) {
    return input.membershipCapabilities as Capability[];
  }
  const role = input.companyRole ?? SYSTEM_ROLES.TESTING_COMPANY_USER;
  return roleCapabilities[role] ?? roleCapabilities[SYSTEM_ROLES.TESTING_COMPANY_USER];
}
