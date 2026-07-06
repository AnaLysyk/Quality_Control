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

const OPERATIONS_ROUTE_PERMISSIONS: Record<string, { moduleId: string; action: string }> = {
  "operacao.inicio": { moduleId: "operations", action: "view" },
  "operacao.dashboard": { moduleId: "operations", action: "dashboard" },
  "operacao.metricas": { moduleId: "operations", action: "metrics" },
  "operacao.busca": { moduleId: "operations", action: "search" },
};

const MANAGEMENT_ROUTE_PERMISSIONS: Record<string, { moduleId: string; action: string }> = {
  "gestao.perfil": { moduleId: "permissions", action: "view" },
  "gestao.usuarios": { moduleId: "users", action: "view" },
  "permissoes.perfil": { moduleId: "permissions", action: "view" },
  "permissoes.matriz": { moduleId: "permissions", action: "view" },
};

const MENU_ROUTE_PERMISSIONS: Record<string, { moduleId: string; action: string }> = {
  ...OPERATIONS_ROUTE_PERMISSIONS,
  ...MANAGEMENT_ROUTE_PERMISSIONS,
  "brain.grafo": { moduleId: "brain", action: "graph" },
  "brain.admin": { moduleId: "brain", action: "admin" },
  "brain.mapa-sistema": { moduleId: "brain", action: "admin" },
  "assistente.perguntar": { moduleId: "brain", action: "ask" },
  "chat.principal": { moduleId: "chat", action: "view" },
  "chat.buscar": { moduleId: "chat", action: "view" },
  "chat.conversas": { moduleId: "chat", action: "view" },
};

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

  if (item.routeId) {
    const menuPermission = MENU_ROUTE_PERMISSIONS[item.routeId];
    if (menuPermission) return canAccess(context, menuPermission);

    if (visibleRouteIds.has(item.routeId)) return true;
    if (item.routeId === "visao-geral.admin") {
      return canAccess(context, { moduleId: "dashboard", action: "view" });
    }
    return false;
  }

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
