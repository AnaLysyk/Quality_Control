import {
  LONG_COMPANY_ROUTE_MODE,
  SHORT_COMPANY_ROUTE_MODE,
  buildCompanyPathForAccess,
  resolveCompanyRouteMode,
  rewriteShortCompanyPathname,
  shortenCompanyPathname,
  shouldUseShortCompanyRoutes,
} from "@/backend/companyRoutes";

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

  it("nao trata planos-de-teste como slug de empresa", () => {
    // Regressão: /planos-de-teste (página standalone) estava sendo
    // reescrita para /empresas/planos-de-teste/home, tratando o nome da
    // rota como se fosse um slug de empresa, porque não estava em
    // RESERVED_APP_ROOTS.
    expect(rewriteShortCompanyPathname("/planos-de-teste")).toBeNull();
  });

  it("nao trata usuarios/vinculos como slug de empresa", () => {
    // Regressão: /usuarios/vinculos (gestão de vínculos) estava sendo
    // reescrita para /empresas/vinculos/home, tratando "vinculos" como se
    // fosse um slug de empresa, porque "usuarios" não estava em
    // RESERVED_APP_ROOTS — isso fazia a guarda de tela em
    // app/usuarios/vinculos/layout.tsx nunca ser alcançada, já que o proxy
    // reescrevia a requisição antes de chegar lá.
    expect(rewriteShortCompanyPathname("/usuarios/vinculos")).toBeNull();
  });
});

