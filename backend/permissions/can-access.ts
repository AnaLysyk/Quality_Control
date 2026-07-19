import type { SystemPermission, SystemRouteDefinition } from "@/backend/navigation/navigation.types";
import { hasPermissionAccess } from "@/backend/permissionMatrix";
import type { UserAccessContext } from "./get-user-access-context";
import { getRouteScreenPermission } from "@/backend/navigation/screenPermissions";

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

export function canAccess(context: UserAccessContext | null | undefined, permission: AccessPermission) {
  if (!context) return false;

  const parsed = parsePermission(permission);
  if (!parsed) return false;

  return resolveAcceptedActions(parsed.action).some((action) =>
    hasPermissionAccess(context.permissions, parsed.moduleId, action),
  );
}

export function canAccessRoute(
  context: UserAccessContext | null | undefined,
  route: Pick<SystemRouteDefinition, "requiredPermission"> & Partial<Pick<SystemRouteDefinition, "id">>,
) {
  if (!context) return false;

  if (route.requiredPermission && !canAccess(context, route.requiredPermission)) {
    return false;
  }

  if (typeof route.id === "string" && route.id.trim()) {
    return canAccess(context, getRouteScreenPermission({ id: route.id }));
  }

  return true;
}

