import type { SystemRole } from "@/lib/auth/roles";
import { hasPermissionAccess, type PermissionMatrix } from "@/lib/permissionMatrix";
import type { NavItemDef, NavModuleDef, NavPermissionRequirement } from "./navigationCatalog";

const NAV_PERMISSION_REQUIREMENTS: Record<string, NavPermissionRequirement> = {
  home: { moduleId: "dashboard", action: "view" },
  "companies-listing": { moduleId: "applications", action: "view" },
  "companies-search": { moduleId: "applications", action: "view" },
  "companies-create": { moduleId: "applications", action: "create" },
  "ops-dashboard": { moduleId: "dashboard", action: "view" },
  "ops-metrics": { moduleId: "dashboard", action: "view" },
  "ops-search": { moduleId: "applications", action: "view" },
  "quality-cases": { moduleId: "test_repository", action: "read" },
  "quality-plans": { moduleId: "test_plan", action: "read" },
  "quality-runs": { moduleId: "test_run", action: "read" },
  "quality-defects": { moduleId: "defect_tracking", action: "read" },
  "auto-playwright": { moduleId: "playwright", action: "read" },
  "auto-ui-studio": { moduleId: "playwright", action: "read" },
  "auto-execucoes": { moduleId: "playwright", action: "read" },
  "auto-fluxos": { moduleId: "playwright", action: "read" },
  "auto-casos": { moduleId: "playwright", action: "read" },
  "auto-scripts": { moduleId: "playwright", action: "read" },
  "auto-tools": { moduleId: "playwright", action: "read" },
  "auto-api-lab": { moduleId: "playwright", action: "read" },
  "auto-base64": { moduleId: "playwright", action: "read" },
  "auto-arquivos": { moduleId: "playwright", action: "read" },
  "auto-logs": { moduleId: "playwright", action: "read" },
  "requests-list": { moduleId: "access_requests", action: "view" },
  "requests-search": { moduleId: "access_requests", action: "view" },
  "support-create": { moduleId: "support", action: "create" },
  "support-kanban": { moduleId: "support", action: "view" },
  "support-chamados": { moduleId: "tickets", action: "view" },
  "support-meus-chamados": { moduleId: "tickets", action: "view_own" },
  "brain-graph": { moduleId: "ai", action: "view" },
  "brain-ask": { moduleId: "ai", action: "use" },
  "docs-central": { moduleId: "notes", action: "view" },
  "docs-repository": { moduleId: "notes", action: "view" },
  "users-create-leader-tc": { moduleId: "users", action: "create" },
  "users-create-support": { moduleId: "users", action: "create" },
  "users-create-user-tc": { moduleId: "users", action: "create" },
  "users-create-company-user": { moduleId: "users", action: "create" },
  "users-list": { moduleId: "users", action: "view" },
  "users-list-empresas": { moduleId: "applications", action: "view" },
  "admin-permissions": { moduleId: "permissions", action: "view" },
  "admin-audit-logs": { moduleId: "audit", action: "view" },
};

function getPermissionRequirement(item: NavItemDef | NavModuleDef) {
  return item.requiredPermission ?? NAV_PERMISSION_REQUIREMENTS[item.id];
}

export function canSeeNavItem(
  item: NavItemDef | NavModuleDef,
  userRole: SystemRole | null,
  permissions?: PermissionMatrix | null,
): boolean {
  if (!userRole) return false;

  const allowedRoles = item.allowedRoles;
  if (allowedRoles && !allowedRoles.includes(userRole)) return false;

  const requiredPermission = getPermissionRequirement(item);
  if (!requiredPermission) return true;

  return hasPermissionAccess(permissions, requiredPermission.moduleId, requiredPermission.action);
}

export function filterNavModule(
  mod: NavModuleDef,
  userRole: SystemRole | null,
  permissions?: PermissionMatrix | null,
): NavModuleDef | null {
  if (!canSeeNavItem(mod, userRole, permissions)) return null;

  const visibleItems = mod.items.filter((item) => canSeeNavItem(item, userRole, permissions));
  if (visibleItems.length === 0 && !mod.href) return null;

  return { ...mod, items: visibleItems };
}

export function buildNavigationForUser(
  catalog: NavModuleDef[],
  userRole: SystemRole | null,
  permissions?: PermissionMatrix | null,
): NavModuleDef[] {
  return catalog
    .map((mod) => filterNavModule(mod, userRole, permissions))
    .filter((mod): mod is NavModuleDef => mod !== null);
}
