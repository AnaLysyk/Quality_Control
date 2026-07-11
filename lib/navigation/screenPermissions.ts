import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { SYSTEM_ROUTES } from "@/lib/navigation/route-map";
import type { SystemRouteDefinition } from "@/lib/navigation/navigation.types";
import { PERMISSION_MODULES, type PermissionModule } from "@/lib/permissionCatalog";
import type { PermissionMatrix } from "@/lib/permissionMatrix";

export const SCREEN_PERMISSION_PREFIX = "screen:";
export const SCREEN_PERMISSION_ACTION = "view";
export const RELATIONSHIP_PERMISSION_MODULE_ID = "relationships";

const DISABLED_SCREEN_STATUSES = new Set(["disabled", "oculto", "quebrado"]);

const RELATIONSHIP_PERMISSION_MODULE: PermissionModule = {
  id: RELATIONSHIP_PERMISSION_MODULE_ID,
  label: "Gestão de vínculos",
  description: "Controla a visualização e as ações da tela de vínculos entre empresas, projetos, Líderes TC e Usuários TC.",
  category: "Usuários e administração",
  actions: ["view", "create", "edit", "delete"],
};

export function getScreenPermissionModuleId(routeId: string) {
  return `${SCREEN_PERMISSION_PREFIX}${routeId.replace(/[^a-zA-Z0-9_.:-]/g, "_")}`;
}

export function isScreenPermissionModuleId(moduleId: string) {
  return moduleId.startsWith(SCREEN_PERMISSION_PREFIX);
}

export function getRouteScreenPermission(route: Pick<SystemRouteDefinition, "id">) {
  return {
    moduleId: getScreenPermissionModuleId(route.id),
    action: SCREEN_PERMISSION_ACTION,
  };
}

export function getScreenPermissionModules(routes: readonly SystemRouteDefinition[] = SYSTEM_ROUTES): PermissionModule[] {
  return routes.map((route) => ({
    id: getScreenPermissionModuleId(route.id),
    label: `Tela: ${route.label}`,
    description: `${route.path} · ${route.description}`,
    category: "Telas do sistema",
    actions: [SCREEN_PERMISSION_ACTION],
  }));
}

export function getPermissionModulesWithScreens(baseModules: readonly PermissionModule[] = PERMISSION_MODULES) {
  const modules = [...baseModules, RELATIONSHIP_PERMISSION_MODULE, ...getScreenPermissionModules()];
  const seen = new Set<string>();

  return modules.filter((module) => {
    if (seen.has(module.id)) return false;
    seen.add(module.id);
    return true;
  });
}

function getRelationshipDefaultsForRole(role: ReturnType<typeof normalizeLegacyRole>): string[] {
  if (role === SYSTEM_ROLES.LEADER_TC) return ["view", "create", "edit", "delete"];
  if (role === SYSTEM_ROLES.EMPRESA) return ["view", "edit", "delete"];
  if (role === SYSTEM_ROLES.TECHNICAL_SUPPORT) return ["view"];
  return [];
}

export function getScreenPermissionDefaultsForRole(role?: string | null): PermissionMatrix {
  const normalizedRole = normalizeLegacyRole(role);
  if (!normalizedRole) return {};

  const screenDefaults = Object.fromEntries(
    SYSTEM_ROUTES
      .filter((route) => !DISABLED_SCREEN_STATUSES.has(route.status))
      .filter((route) => (route.expectedProfiles as readonly string[]).includes(normalizedRole))
      .map((route) => [getScreenPermissionModuleId(route.id), [SCREEN_PERMISSION_ACTION]]),
  ) as PermissionMatrix;

  const relationshipDefaults = getRelationshipDefaultsForRole(normalizedRole);
  if (relationshipDefaults.length === 0) return screenDefaults;

  return {
    ...screenDefaults,
    [RELATIONSHIP_PERMISSION_MODULE_ID]: relationshipDefaults,
  };
}
