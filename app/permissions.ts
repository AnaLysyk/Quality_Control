type RoleKey = "admin" | "company" | "user";
type ResourceKey = "defect" | "run";
type PermissionResourceMap = Record<ResourceKey, string[]>;

export const permissions: Record<RoleKey, PermissionResourceMap> = {
  admin: {
    defect: ["create", "edit", "delete", "linkRun"],
    run: ["create", "linkDefect"],
  },
  company: {
    defect: ["create", "edit", "linkRun"],
    run: ["linkDefect"],
  },
  user: {
    defect: ["create", "linkRun"],
    run: [],
  },
};

export function can(userRole: string, resource: string, action: string) {
  if (!Object.prototype.hasOwnProperty.call(permissions, userRole)) {
    return false;
  }
  const roleKey = userRole as RoleKey;
  const resourceKey = resource as ResourceKey;
  const allowed = permissions[roleKey]?.[resourceKey];
  return Array.isArray(allowed) ? allowed.includes(action) : false;
}
