import { SYSTEM_ROLES } from "@/backend/auth/roles";
import { resolveRoleDefaults } from "@/backend/permissions/roleDefaults";
import { computeNavigationModules } from "@/hooks/navigation/useNavigationItems";

// Cobre a regra confirmada com o usuário: dentro de uma empresa, o usuário
// precisa estar vinculado a pelo menos um projeto pra ver o módulo de
// qualidade (casos, planos, execuções, defeitos) — sem projeto ativo, o
// módulo fica sem itens visíveis e desaparece do menu. Essa é a camada de
// contexto (computeNavigationModules), diferente do RBAC por papel puro
// coberto em navigation-permissions.test.ts.
function buildModulesForCompanyUser(activeProjectSlug: string | null) {
  const role = SYSTEM_ROLES.COMPANY_USER;
  return computeNavigationModules({
    isClientProfile: true,
    effectiveRole: role,
    roleForFiltering: role,
    permissions: resolveRoleDefaults(role),
    accessContext: null,
    companySlug: "empresa-a",
    activeProjectSlug,
    companyRouteInput: {
      isGlobalAdmin: false,
      permissionRole: role,
      role,
      companyRole: role,
      userOrigin: null,
      clientSlug: "empresa-a",
    },
  });
}

function moduleIds(modules: ReturnType<typeof buildModulesForCompanyUser>) {
  return modules.map((module) => module.id);
}

function qualityItemIds(modules: ReturnType<typeof buildModulesForCompanyUser>): string[] {
  const qualityModule = modules.find((module) => module.id === "quality");
  if (!qualityModule) return [];

  return qualityModule.items.flatMap((item) => [
    item.id,
    ...(item.children ?? []).map((child) => child.id),
  ]);
}

describe("computeNavigationModules - escopo por projeto vinculado", () => {
  it("esconde o módulo quality quando a empresa não tem projeto ativo vinculado", () => {
    const modules = buildModulesForCompanyUser(null);

    expect(moduleIds(modules)).not.toContain("quality");
  });

  it("mostra o módulo quality com todos os itens de teste quando há projeto ativo vinculado", () => {
    const modules = buildModulesForCompanyUser("projeto-x");

    expect(moduleIds(modules)).toContain("quality");
    expect(qualityItemIds(modules)).toEqual(
      expect.arrayContaining(["quality-cases", "quality-plans", "quality-runs", "quality-defects"]),
    );
  });
});
