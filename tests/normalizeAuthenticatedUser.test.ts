import { normalizeAuthenticatedUser, resolveCompanyAccess } from "@/lib/auth/normalizeAuthenticatedUser";
import { SYSTEM_ROLES } from "@/lib/auth/roles";
import { resolveCompanyRouteAccessInput } from "@/lib/companyRoutes";

describe("normalizeAuthenticatedUser", () => {
  it("normaliza clientSlugs, roles e permissions vindos em formatos antigos", () => {
    const normalized = normalizeAuthenticatedUser({
      id: "user-1",
      clientSlugs: ["Griaule", "ACME", "griaule", ""],
      role: "global_admin",
      permissions: {
        Reports: ["VIEW", "Edit"],
        profile: ["READ"],
      },
    } as Parameters<typeof normalizeAuthenticatedUser>[0]);

    expect(normalized.companySlugs).toEqual(["griaule", "acme"]);
    expect(normalized.primaryCompanySlug).toBe("griaule");
    expect(normalized.defaultCompanySlug).toBeNull();
    expect(normalized.roles).toContain(SYSTEM_ROLES.LEADER_TC);
    expect(normalized.permissions).toEqual(expect.arrayContaining(["reports", "view", "edit", "profile", "read"]));
  });

  it("normaliza um clientSlug unico e empresas retornadas pela API", () => {
    const normalized = normalizeAuthenticatedUser(
      {
        id: "user-2",
        clientSlug: "Griaule",
        defaultClientSlug: "GRIAULE",
        company: { slug: "Griaule", name: "Griaule SA" },
      } as Parameters<typeof normalizeAuthenticatedUser>[0],
      [
        {
          id: "company-1",
          name: "Griaule",
          slug: "GRIAULE",
          role: "empresa",
        },
      ],
    );

    expect(normalized.companySlugs).toEqual(["griaule"]);
    expect(normalized.companies).toEqual([
      {
        id: "company-1",
        name: "Griaule",
        slug: "griaule",
      },
    ]);
    expect(normalized.defaultCompanySlug).toBe("griaule");
    expect(normalized.primaryCompanySlug).toBe("griaule");
    expect(normalized.companyCount).toBe(1);
  });

  it("extrai empresas aninhadas e lida com payload vazio", () => {
    const nested = normalizeAuthenticatedUser(
      {
        id: "user-3",
        organizations: [{ tenant: { slug: "Beta", name: "Beta" } }],
      } as Parameters<typeof normalizeAuthenticatedUser>[0],
    );

    expect(nested.companySlugs).toEqual(["beta"]);
    expect(nested.companies).toEqual([
      {
        slug: "beta",
        name: "Beta",
      },
    ]);

    const empty = normalizeAuthenticatedUser(null);
    expect(empty.companySlugs).toEqual([]);
    expect(empty.primaryCompanySlug).toBeNull();
    expect(empty.companyCount).toBe(0);
  });

  it("normaliza payload legado com companySlug unico", () => {
    const normalized = normalizeAuthenticatedUser({
      id: "user-legacy-company-slug",
      companySlug: "Griaule",
    } as Parameters<typeof normalizeAuthenticatedUser>[0]);

    expect(normalized.companySlugs).toEqual(["griaule"]);
    expect(normalized.primaryCompanySlug).toBe("griaule");
    expect(normalized.defaultCompanySlug).toBeNull();
  });
});

describe("resolveCompanyRouteAccessInput", () => {
  it("resolve o input de rota a partir do usuario normalizado", () => {
    const input = resolveCompanyRouteAccessInput({
      user: {
        id: "user-route-1",
        companySlug: "GRIAULE",
        role: "company_user",
        user_origin: "client_company",
      },
    });

    expect(input.clientSlug).toBe("griaule");
    expect(input.defaultClientSlug).toBeNull();
    expect(input.companyCount).toBe(1);
    expect(input.userOrigin).toBe("client_company");
  });
});

describe("resolveCompanyAccess", () => {
  it("retorna loading enquanto a autenticacao ainda nao terminou", () => {
    const access = resolveCompanyAccess({
      user: null,
      companies: [],
      slug: "griaule",
      loading: true,
      error: null,
    });

    expect(access.status).toBe("loading");
    expect(access.normalizedUser).toBeNull();
  });

  it("permite acesso quando a rota bate com o slug normalizado", () => {
    const access = resolveCompanyAccess({
      user: {
        id: "user-4",
        clientSlug: "GRIAULE",
      } as Parameters<typeof normalizeAuthenticatedUser>[0],
      companies: [],
      slug: "griaule",
      loading: false,
      error: null,
    });

    expect(access.status).toBe("allowed");
    expect(access.normalizedUser?.companySlugs).toEqual(["griaule"]);
  });

  it("permite acesso para usuario privilegiado mesmo sem match direto", () => {
    const access = resolveCompanyAccess({
      user: {
        id: "user-5",
        role: "global_admin",
      } as Parameters<typeof normalizeAuthenticatedUser>[0],
      companies: [],
      slug: "empresa-desconhecida",
      loading: false,
      error: null,
    });

    expect(access.status).toBe("allowed");
  });

  it("permite acesso para suporte tecnico sem vinculo direto", () => {
    const access = resolveCompanyAccess({
      user: {
        id: "user-5b",
        permissionRole: "technical_support",
      } as Parameters<typeof normalizeAuthenticatedUser>[0],
      companies: [],
      slug: "griaule",
      loading: false,
      error: null,
    });

    expect(access.status).toBe("allowed");
  });

  it("retorna denied quando o usuario nao tem vinculo com a empresa", () => {
    const access = resolveCompanyAccess({
      user: {
        id: "user-6",
        clientSlug: "outra-empresa",
      } as Parameters<typeof normalizeAuthenticatedUser>[0],
      companies: [],
      slug: "griaule",
      loading: false,
      error: null,
    });

    expect(access.status).toBe("denied");
    expect(access.fallbackSlug).toBe("outra-empresa");
  });

  it("retorna erro tratado quando a sessao falha", () => {
    const access = resolveCompanyAccess({
      user: null,
      companies: [],
      slug: "griaule",
      loading: false,
      error: "Tempo esgotado ao validar a sessao",
    });

    expect(access.status).toBe("error");
    expect(access.errorMessage).toContain("Tempo esgotado");
  });

  it("retorna unauthenticated quando nao existe usuario", () => {
    const access = resolveCompanyAccess({
      user: null,
      companies: [],
      slug: "griaule",
      loading: false,
      error: null,
    });

    expect(access.status).toBe("unauthenticated");
  });

  it("retorna not_found quando a rota nao informa slug", () => {
    const access = resolveCompanyAccess({
      user: {
        id: "user-7",
        companySlug: "griaule",
      } as Parameters<typeof normalizeAuthenticatedUser>[0],
      companies: [],
      slug: null,
      loading: false,
      error: null,
    });

    expect(access.status).toBe("not_found");
    expect(access.fallbackSlug).toBe("griaule");
  });
});
