import { SYSTEM_ROLES } from "@/lib/auth/roles";
import { NAV_CATALOG, type NavModuleDef } from "@/lib/navigation/navigationCatalog";
import { buildNavigationForUser } from "@/lib/navigation/navigationPermissions";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";

function buildSupportNavigation() {
  return buildNavigationForUser(
    NAV_CATALOG,
    SYSTEM_ROLES.TECHNICAL_SUPPORT,
    resolveRoleDefaults(SYSTEM_ROLES.TECHNICAL_SUPPORT),
  );
}

function moduleIds(modules: NavModuleDef[]) {
  return modules.map((module) => module.id);
}

function itemIds(modules: NavModuleDef[]) {
  return modules.flatMap((module) => module.items.map((item) => item.id));
}

describe("perfil suporte - navegacao base", () => {
  it("exibe os modulos principais do suporte tecnico", () => {
    const modules = buildSupportNavigation();

    expect(moduleIds(modules)).toEqual(
      expect.arrayContaining([
        "home",
        "companies",
        "operations",
        "quality",
        "automation",
        "requests",
        "support",
        "chat",
        "brain",
        "documents",
        "management",
        "logs",
      ]),
    );
  });

  it("exibe atalhos operacionais permitidos para suporte tecnico", () => {
    const items = itemIds(buildSupportNavigation());

    expect(items).toEqual(
      expect.arrayContaining([
        "companies-listing",
        "companies-search",
        "companies-create",
        "requests-list",
        "requests-search",
        "support-create",
        "support-kanban",
        "support-chamados",
        "auto-playwright",
        "auto-ui-studio",
        "brain-graph",
        "brain-ask",
        "management-profile",
        "management-users",
      ]),
    );
  });

  it("nao exibe atalhos de criacao de perfis privilegiados", () => {
    const items = itemIds(buildSupportNavigation());

    expect(items).not.toContain("users-create-leader-tc");
    expect(items).not.toContain("users-create-support");
    expect(items).not.toContain("users-create-user-tc");
    expect(items).not.toContain("users-create-company-user");
    expect(items).not.toContain("support-meus-chamados");
  });
});

