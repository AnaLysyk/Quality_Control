import type { SystemRole } from "@/lib/auth/roles";
import type { NavItemDef, NavModuleDef } from "./navigationCatalog";

export function canSeeNavItem(
  item: NavItemDef | NavModuleDef,
  userRole: SystemRole | null,
): boolean {
  if (!userRole) return false;

  const allowedRoles = item.allowedRoles;
  if (!allowedRoles) return true; // visible to all authenticated users

  return allowedRoles.includes(userRole);
}

export function filterNavModule(
  mod: NavModuleDef,
  userRole: SystemRole | null,
): NavModuleDef | null {
  if (!canSeeNavItem(mod, userRole)) return null;

  const visibleItems = mod.items.filter((item) => canSeeNavItem(item, userRole));
  if (visibleItems.length === 0) return null;

  return { ...mod, items: visibleItems };
}

export function buildNavigationForUser(
  catalog: NavModuleDef[],
  userRole: SystemRole | null,
): NavModuleDef[] {
  return catalog
    .map((mod) => filterNavModule(mod, userRole))
    .filter((mod): mod is NavModuleDef => mod !== null);
}
