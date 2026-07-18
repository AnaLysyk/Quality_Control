import { SYSTEM_ROLES, type SystemRole } from "@/backend/auth/roles";
import { NAV_CATALOG, type NavModuleDef } from "@/backend/navigation/navigationCatalog";
import { buildNavigationForUser } from "@/backend/navigation/navigationPermissions";
import { resolveRoleDefaults } from "@/backend/permissions/roleDefaults";

const CLIENT_MODULES = new Set(["home", "quality", "support", "brain", "documents"]);

function buildClientNavigation(role: SystemRole) {
  return buildNavigationForUser(
    NAV_CATALOG.filter((module) => CLIENT_MODULES.has(module.id)),
    role,
    resolveRoleDefaults(role),
  );
}

function buildRoleNavigation(role: SystemRole) {
  return buildNavigationForUser(NAV_CATALOG, role, resolveRoleDefaults(role));
}

function moduleIds(modules: NavModuleDef[]) {
  return modules.map((module) => module.id);
}

function itemIds(modules: NavModuleDef[]) {
  return modules.flatMap((module) => module.items.map((item) => item.id));
}

describe("navigation permission filtering", () => {
  it("hides QA and privileged support links from company users without permissions", () => {
    const modules = buildClientNavigation(SYSTEM_ROLES.COMPANY_USER);
    const items = itemIds(modules);

    expect(moduleIds(modules)).not.toContain("quality");
    expect(items).not.toContain("support-chamados");
    expect(items).toEqual(
      expect.arrayContaining([
        "support-create",
        "support-kanban",
        "support-meus-chamados",
        "brain-graph",
        "brain-ask",
      ]),
    );
  });

  it("shows manual QA links to company admins with QA read permissions", () => {
    const modules = buildClientNavigation(SYSTEM_ROLES.EMPRESA);
    const items = itemIds(modules);

    expect(moduleIds(modules)).toContain("quality");
    expect(items).toEqual(
      expect.arrayContaining(["quality-cases", "quality-plans", "quality-runs", "quality-defects"]),
    );
    expect(items).not.toContain("support-chamados");
  });

  it("uses permission matrix to expose user permissions without create-user shortcuts for support users", () => {
    const items = itemIds(buildRoleNavigation(SYSTEM_ROLES.TECHNICAL_SUPPORT));

    expect(items).toContain("management-users");
    expect(items).not.toContain("users-create-company-user");
    expect(items).not.toContain("users-create-leader-tc");
  });
});

