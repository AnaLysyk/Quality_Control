import { canAccessRoute } from "@/backend/permissions/can-access";
import type { UserAccessContext } from "@/backend/permissions/get-user-access-context";
import { SYSTEM_ROUTES } from "./route-map";
import type { SystemRouteDefinition } from "./navigation.types";

export function getVisibleRoutes(
  context: UserAccessContext | null | undefined,
  routes: readonly SystemRouteDefinition[] = SYSTEM_ROUTES,
) {
  if (!context) return [];
  return routes.filter((routeDefinition) => canAccessRoute(context, routeDefinition));
}

export function getVisibleRouteIds(
  context: UserAccessContext | null | undefined,
  routes: readonly SystemRouteDefinition[] = SYSTEM_ROUTES,
) {
  return new Set(getVisibleRoutes(context, routes).map((routeDefinition) => routeDefinition.id));
}

