import type { CompanyRole, Capability, GlobalRole, Permission, UserRole } from "./permissions.types";

const rolePermissions: Record<UserRole, Permission[]> = {
  user: ["read_dashboard", "manage_tests"],
  admin: ["read_dashboard", "manage_users", "manage_companies", "manage_releases", "manage_tests", "view_admin"],
  "super-admin": [
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
  company_admin: [
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
  it_dev: [
    "company:read",
    "metrics:read",
    "release:read",
    "run:read",
    "defect:read",
  ],
  user: [
    "company:read",
    "metrics:read",
    "release:read",
    "run:read",
    "defect:read",
  ],
  viewer: [
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
  if (role === "admin" || role === "super-admin") return role;
  return "user";
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
  const role = input.companyRole ?? "viewer";
  return roleCapabilities[role] ?? roleCapabilities.viewer;
}
