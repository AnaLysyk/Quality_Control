import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/lib/automations/access";

describe("resolveAutomationAccess", () => {
  it("libera configuração para líder TC", () => {
    const access = resolveAutomationAccess({ role: "leader_tc", companySlugs: ["griaule", "acme"] }, 2);

    expect(access.canOpen).toBe(true);
    expect(access.canConfigure).toBe(true);
    expect(access.canManageFlows).toBe(true);
    expect(access.canViewTechnicalLogs).toBe(true);
    expect(access.hasGlobalCompanyVisibility).toBe(true);
    expect(access.scopeLabel).toBe("Todas as empresas");
  });

  it("mantém usuário TC na mesma tela, porém sem configuração global", () => {
    const access = resolveAutomationAccess({ role: "user", companySlugs: ["griaule"] }, 1);

    expect(access.canOpen).toBe(true);
    expect(access.canConfigure).toBe(false);
    expect(access.canManageFlows).toBe(false);
    expect(access.canViewTechnicalLogs).toBe(false);
    expect(access.hasGlobalCompanyVisibility).toBe(false);
    expect(access.scopeLabel).toContain("1 empresa vinculada");
  });

  it("libera empresa apenas no próprio escopo", () => {
    const access = resolveAutomationAccess({
      role: "empresa",
      companyRole: "empresa",
      clientSlug: "griaule",
      email: "griaule@griaule.com",
      name: "Griaule",
    });

    expect(access.canOpen).toBe(true);
    expect(access.canConfigure).toBe(false);
    expect(access.canManageFlows).toBe(true);
    expect(access.canViewTechnicalLogs).toBe(false);
    expect(access.hasGlobalCompanyVisibility).toBe(false);
    expect(access.profileLabel).toBe("Empresa");
    expect(access.visibilityLabel).toBe("Operação da empresa");
  });

  it("mantém usuário da empresa com a mesma visão da empresa", () => {
    const access = resolveAutomationAccess({
      role: "company_user",
      companyRole: "company_user",
      clientSlug: "griaule",
      companySlugs: ["griaule"],
    });

    expect(access.canOpen).toBe(true);
    expect(access.canConfigure).toBe(false);
    expect(access.canManageFlows).toBe(true);
    expect(access.canViewTechnicalLogs).toBe(false);
    expect(access.hasGlobalCompanyVisibility).toBe(false);
    expect(access.profileLabel).toBe("Usuário da empresa");
    expect(access.scopeLabel).toContain("empresa");
  });
});

describe("resolveAutomationAllowedCompanySlugs", () => {
  it("combina slugs sem duplicar", () => {
    const slugs = resolveAutomationAllowedCompanySlugs({
      companySlug: "griaule",
      companySlugs: ["griaule", "acme"],
      clientSlug: "griaule",
      clientSlugs: ["acme", "beta"],
    });

    expect(slugs).toEqual(["griaule", "acme", "beta"]);
  });
});
