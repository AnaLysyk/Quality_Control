import {
  LONG_COMPANY_ROUTE_MODE,
  SHORT_COMPANY_ROUTE_MODE,
  buildCompanyPathForAccess,
  parseCompanyRoutePathname,
  resolveCompanyRouteMode,
  rewriteShortCompanyPathname,
  shortenCompanyPathname,
  shouldUseShortCompanyRoutes,
} from "@/lib/companyRoutes";

describe("companyRoutes", () => {
  it("usa rota curta para conta institucional da empresa", () => {
    const input = {
      role: "company",
      companyRole: "company_admin",
      userOrigin: "client_company",
      clientSlug: "griaule",
    };

    expect(shouldUseShortCompanyRoutes(input)).toBe(true);
    expect(resolveCompanyRouteMode(input)).toBe(SHORT_COMPANY_ROUTE_MODE);
    expect(buildCompanyPathForAccess("griaule", "chamados", input)).toBe("/griaule/chamados");
  });

  it("usa rota curta para usuario direto da empresa", () => {
    const input = {
      role: "user",
      permissionRole: "user",
      companyRole: "user",
      userOrigin: "client_company",
      clientSlug: "griaule",
      companyCount: 1,
    };

    expect(shouldUseShortCompanyRoutes(input)).toBe(true);
    expect(resolveCompanyRouteMode(input)).toBe(SHORT_COMPANY_ROUTE_MODE);
    expect(buildCompanyPathForAccess("griaule", "metrics", input)).toBe("/griaule/metrics");
  });

  it("usa rota curta de suporte tecnico mesmo com vinculo de empresa", () => {
    const input = {
      role: "company_user",
      permissionRole: "technical_support",
      companyRole: "company_user",
      userOrigin: "client_company",
      clientSlug: "griaule",
      companyCount: 1,
    };

    expect(shouldUseShortCompanyRoutes(input)).toBe(true);
    expect(resolveCompanyRouteMode(input)).toBe(SHORT_COMPANY_ROUTE_MODE);
    expect(buildCompanyPathForAccess("griaule", "home", input)).toBe("/suporte/griaule/dashboard");
    expect(parseCompanyRoutePathname("/suporte/griaule/dashboard")).toEqual({
      kind: "technical_support",
      targetSlug: "griaule",
      route: "dashboard",
      prefixSlug: "suporte",
    });
  });

  it("mantem rota longa para perfis internos", () => {
    const input = {
      role: "user",
      permissionRole: "leader_tc",
      companyRole: "user",
      userOrigin: "testing_company",
      clientSlug: "griaule",
      companyCount: 1,
    };

    expect(shouldUseShortCompanyRoutes(input)).toBe(false);
    expect(resolveCompanyRouteMode(input)).toBe(LONG_COMPANY_ROUTE_MODE);
    expect(buildCompanyPathForAccess("griaule", "chamados", input)).toBe("/empresas/griaule/chamados");
  });

  it("converte rota publica curta para a rota interna e vice-versa", () => {
    expect(rewriteShortCompanyPathname("/griaule/chamados")).toBe("/empresas/griaule/chamados");
    expect(shortenCompanyPathname("/empresas/griaule/chamados")).toBe("/griaule/chamados");
    expect(rewriteShortCompanyPathname("/admin/dashboard")).toBeNull();
  });

  it("nao trata automacoes como slug de empresa", () => {
    expect(rewriteShortCompanyPathname("/automacoes")).toBeNull();
  });

  it("nao trata operacao como slug de empresa", () => {
    expect(rewriteShortCompanyPathname("/operacao")).toBeNull();
    expect(rewriteShortCompanyPathname("/operacoes")).toBeNull();
  });
});
