import type { AccessContext } from "@/lib/auth/session";
import { canEditCompanyWiki, canReadCompanyWiki } from "@/lib/companyWikiAccess";

function makeAccess(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    userId: "user-1",
    email: "user@example.com",
    user: "user",
    userOrigin: null,
    isGlobalAdmin: false,
    role: "testing_company_user",
    globalRole: null,
    companyRole: "testing_company_user",
    capabilities: [],
    companyId: "company-1",
    companySlug: "griaule",
    companySlugs: ["griaule"],
    ...overrides,
  };
}

describe("company wiki access", () => {
  it("permite leitura quando o usuario tem escopo na empresa", () => {
    expect(canReadCompanyWiki(makeAccess(), "griaule")).toBe(true);
  });

  it("permite edicao para admin da empresa mesmo sem userOrigin client_company", () => {
    const access = makeAccess({
      userOrigin: "testing_company",
      role: "empresa",
      companyRole: "empresa",
    });

    expect(canEditCompanyWiki(access, "griaule")).toBe(true);
  });

  it("permite edicao para usuario da empresa vinculado", () => {
    const access = makeAccess({
      role: "company_user",
      companyRole: "company_user",
    });

    expect(canEditCompanyWiki(access, "griaule")).toBe(true);
  });

  it("bloqueia edicao fora do escopo da empresa", () => {
    const access = makeAccess({
      role: "empresa",
      companyRole: "empresa",
      companySlug: "outra-empresa",
      companySlugs: ["outra-empresa"],
    });

    expect(canEditCompanyWiki(access, "griaule")).toBe(false);
  });
});
