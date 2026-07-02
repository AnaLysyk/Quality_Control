import type { SystemRole } from "@/lib/auth/roles";
import type { PermissionMatrix } from "@/lib/permissionMatrix";
import { canAccess } from "@/lib/permissions/can-access";
import {
  getUserAccessContext,
  type UserAccessContext,
} from "@/lib/permissions/get-user-access-context";
import { getVisibleRouteIds } from "./get-visible-routes";
import { SYSTEM_ROUTE_BY_ID } from "./route-map";
import type { NavItemDef, NavModuleDef } from "./navigationCatalog";

function buildNavigationAccessContext(
  userRole: SystemRole | null,
  permissions?: PermissionMatrix | null,
) {
  if (!userRole) return null;
  return getUserAccessContext({
    id: "navigation-user",
    role: userRole,
    permissionRole: userRole,
    permissions: permissions ?? undefined,
    isGlobalAdmin: false,
  });
}

function canSeeNavigationDefinition(
  item: NavItemDef | NavModuleDef,
  userRole: SystemRole | null,
  context: UserAccessContext | null,
  visibleRouteIds: Set<string>,
) {
  if (!userRole || !context) return false;

  const allowedRoles = item.allowedRoles;
  if (allowedRoles && !allowedRoles.includes(userRole)) return false;

  if (item.routeId) return visibleRouteIds.has(item.routeId);
  if (item.requiredPermission) return canAccess(context, item.requiredPermission);
  return true;
}

export function canSeeNavItem(
  item: NavItemDef | NavModuleDef,
  userRole: SystemRole | null,
  permissions?: PermissionMatrix | null,
): boolean {
  const context = buildNavigationAccessContext(userRole, permissions);
  const visibleRouteIds = getVisibleRouteIds(context);
  return canSeeNavigationDefinition(item, userRole, context, visibleRouteIds);
}

export function filterNavModule(
  mod: NavModuleDef,
  userRole: SystemRole | null,
  permissions?: PermissionMatrix | null,
  accessContext?: UserAccessContext | null,
): NavModuleDef | null {
  const context = accessContext ?? buildNavigationAccessContext(userRole, permissions);
  const visibleRouteIds = getVisibleRouteIds(context);
  if (!canSeeNavigationDefinition(mod, userRole, context, visibleRouteIds)) return null;

  const visibleItems = mod.items.filter((item) =>
    canSeeNavigationDefinition(item, userRole, context, visibleRouteIds),
  );
  if (visibleItems.length === 0 && !mod.href) return null;

  return { ...mod, items: visibleItems };
}

export function buildNavigationForUser(
  catalog: NavModuleDef[],
  userRole: SystemRole | null,
  permissions?: PermissionMatrix | null,
  accessContext?: UserAccessContext | null,
): NavModuleDef[] {
  const context = accessContext ?? buildNavigationAccessContext(userRole, permissions);
  const visibleRouteIds = getVisibleRouteIds(context);

  return catalog
    .map((mod) => {
      if (!canSeeNavigationDefinition(mod, userRole, context, visibleRouteIds)) return null;

      const visibleItems = mod.items.filter((item) =>
        canSeeNavigationDefinition(item, userRole, context, visibleRouteIds),
      );
      if (visibleItems.length === 0 && !mod.href) return null;
      return { ...mod, items: visibleItems };
    })
    .filter((mod): mod is NavModuleDef => mod !== null);
}

export function getNavigationRoute(item: NavItemDef | NavModuleDef) {
  return item.routeId ? SYSTEM_ROUTE_BY_ID.get(item.routeId) ?? null : null;
}

