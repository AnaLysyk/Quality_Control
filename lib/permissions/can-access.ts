import type { SystemPermission, SystemRouteDefinition } from "@/lib/navigation/navigation.types";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import type { UserAccessContext } from "./get-user-access-context";

export type AccessPermission = SystemPermission | `${string}.${string}`;

function parsePermission(permission: AccessPermission): SystemPermission | null {
  if (typeof permission !== "string") return permission;

  const separatorIndex = permission.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === permission.length - 1) return null;
  return {
    moduleId: permission.slice(0, separatorIndex),
    action: permission.slice(separatorIndex + 1),
  };
}

function resolveAcceptedActions(action: string) {
  if (action === "view") return ["view", "view_own", "view_company", "view_all"];
  return [action];
}

export function canAccess(
  context: UserAccessContext | null | undefined,
  permission: AccessPermission,
) {
  if (!context) return false;

  const parsed = parsePermission(permission);
  if (!parsed) return false;

  return resolveAcceptedActions(parsed.action).some((action) =>
    hasPermissionAccess(context.permissions, parsed.moduleId, action),
  );
}

export function canAccessRoute(
  context: UserAccessContext | null | undefined,
  route: Pick<SystemRouteDefinition, "requiredPermission">,
) {
  if (!context) return false;
  if (!route.requiredPermission) return true;
  return canAccess(context, route.requiredPermission);
}
