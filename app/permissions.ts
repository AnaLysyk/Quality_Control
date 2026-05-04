import { SYSTEM_ROLES } from "@/lib/auth/roles";

type RoleKey = "leader_tc" | "empresa" | "testing_company_user";
type ResourceKey = "defect" | "run";
type PermissionResourceMap = Record<ResourceKey, string[]>;

export const permissions: Record<RoleKey, PermissionResourceMap> = {
  [SYSTEM_ROLES.LEADER_TC]: {
    defect: ["create", "edit", "delete", "linkRun"],
    run: ["create", "linkDefect"],
  },
  [SYSTEM_ROLES.EMPRESA]: {
    defect: ["create", "edit", "linkRun"],
    run: ["linkDefect"],
  },
  [SYSTEM_ROLES.TESTING_COMPANY_USER]: {
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
