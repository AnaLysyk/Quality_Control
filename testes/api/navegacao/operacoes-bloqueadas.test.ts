import { SYSTEM_ROLES, type SystemRole } from "@/backend/auth/roles";
import { NAV_CATALOG, type NavModuleDef } from "@/backend/navigation/navigationCatalog";
import { SYSTEM_ROUTES } from "@/backend/navigation/route-map";
import { buildNavigationForUser } from "@/backend/navigation/navigationPermissions";
import { canAccessRoute } from "@/backend/permissions/can-access";
import { getUserAccessContext } from "@/backend/permissions/get-user-access-context";
import { resolveRoleDefaults } from "@/backend/permissions/roleDefaults";

const ROLES: SystemRole[] = [
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
  SYSTEM_ROLES.TESTING_COMPANY_USER,
  SYSTEM_ROLES.EMPRESA,
  SYSTEM_ROLES.COMPANY_USER,
];

function buildRoleNavigation(role: SystemRole) {
  return buildNavigationForUser(NAV_CATALOG, role, resolveRoleDefaults(role));
}

function buildContext(role: SystemRole) {
  return getUserAccessContext({
    id: `test-${role}`,
    role,
    permissionRole: role,
    permissions: resolveRoleDefaults(role),
  });
}

function moduleIds(modules: NavModuleDef[]) {
  return modules.map((module) => module.id);
}

describe("bloqueio do modulo operacional", () => {
  it("nao mostra operations para perfis fixos", () => {
    for (const role of ROLES) {
      expect(moduleIds(buildRoleNavigation(role))).not.toContain("operations");
    }
  });

  it("bloqueia rotas operacionais para perfis fixos", () => {
    const routes = SYSTEM_ROUTES.filter((route) => route.id.startsWith("operacao."));
    expect(routes.length).toBeGreaterThan(0);

    for (const role of ROLES) {
      const context = buildContext(role);
      expect(routes.every((route) => !canAccessRoute(context, route))).toBe(true);
    }
  });
});

