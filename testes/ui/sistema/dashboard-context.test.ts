import { resolveDashboardContext } from "@/lib/dashboard/context";

describe("resolveDashboardContext", () => {
  it("locks company scope for company users", () => {
    const context = resolveDashboardContext({
      user: {
        id: "u1",
        role: "empresa",
        companySlug: "griaule",
      },
      companies: [{ slug: "griaule", name: "Griaule" }, { slug: "acme", name: "Acme" }],
    });

    expect(context.scope).toBe("company");
    expect(context.companySelectorMode).toBe("locked");
    expect(context.selectedCompanySlugs).toEqual(["griaule"]);
    expect(context.contextLabel).toContain("Griaule");
  });

  it("treats all allowed companies as the internal all selection", () => {
    const context = resolveDashboardContext({
      user: {
        id: "u2",
        role: "leader_tc",
        companySlugs: ["griaule", "acme"],
      },
      companies: [{ slug: "griaule", name: "Griaule" }, { slug: "acme", name: "Acme" }],
    });

    expect(context.scope).toBe("internal");
    expect(context.canSelectAllCompanies).toBe(true);
    expect(context.selectedCompanySlugs).toEqual(["griaule", "acme"]);
    expect(context.contextLabel).toContain("Todas as empresas permitidas");
  });

  it("keeps restricted internal users inside their permitted companies", () => {
    const context = resolveDashboardContext({
      user: {
        id: "u3",
        role: "testing_company_user",
        companySlugs: ["griaule", "testing-company"],
      },
      companies: [
        { slug: "griaule", name: "Griaule" },
        { slug: "testing-company", name: "Testing Company" },
        { slug: "outra", name: "Outra" },
      ],
      selectedCompanySlugs: ["outra", "griaule"],
    });

    expect(context.scope).toBe("internal");
    expect(context.allowedCompanySlugs).toEqual(["griaule", "testing-company"]);
    expect(context.selectedCompanySlugs).toEqual(["griaule"]);
  });
});

