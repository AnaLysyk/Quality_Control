import { SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import { NAV_CATALOG, type NavModuleDef } from "@/lib/navigation/navigationCatalog";
import { buildNavigationForUser } from "@/lib/navigation/navigationPermissions";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";

function buildRoleNavigation(role: SystemRole) {
  return buildNavigationForUser(NAV_CATALOG, role, resolveRoleDefaults(role));
}

function moduleIds(modules: NavModuleDef[]) {
  return modules.map((module) => module.id);
}

describe("bloqueio do modulo operacional", () => {
  it("nao mostra operations para perfis fixos", () => {
    const roles: SystemRole[] = [
      SYSTEM_ROLES.LEADER_TC,
      SYSTEM_ROLES.TECHNICAL_SUPPORT,
      SYSTEM_ROLES.TESTING_COMPANY_USER,
      SYSTEM_ROLES.EMPRESA,
      SYSTEM_ROLES.COMPANY_USER,
    ];

    for (const role of roles) {
      expect(moduleIds(buildRoleNavigation(role))).not.toContain("operations");
    }
  });
});
