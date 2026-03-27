import {
  assertUserCanLinkToCompany,
  buildCompanyScopedUserState,
  getUserScopeLockedMessage,
  normalizeUserOrigin,
  normalizeUserScope,
  resolveAllowMultiCompanyLink,
  resolveUserOriginLabel,
} from "../lib/companyUserScope";

describe("company user scope", () => {
  it("builds closed scope metadata for company-created users", () => {
    expect(buildCompanyScopedUserState("cmp_123")).toEqual({
      created_by_company_id: "cmp_123",
      home_company_id: "cmp_123",
      user_origin: "client_company",
      user_scope: "company_only",
      allow_multi_company_link: false,
    });
  });

  it("blocks linking a company_only user to another company", () => {
    expect(() =>
      assertUserCanLinkToCompany(
        {
          home_company_id: "cmp_home",
          user_scope: "company_only",
          allow_multi_company_link: false,
        },
        "cmp_other",
      ),
    ).toThrow(getUserScopeLockedMessage());
  });

  it("keeps testing company users shareable by default", () => {
    expect(normalizeUserOrigin(undefined)).toBe("testing_company");
    expect(normalizeUserScope(undefined)).toBe("shared");
    expect(resolveAllowMultiCompanyLink(undefined, undefined)).toBe(true);
    expect(resolveUserOriginLabel("testing_company")).toBe("Interno TC");
    expect(() =>
      assertUserCanLinkToCompany(
        {
          home_company_id: null,
          user_scope: "shared",
          allow_multi_company_link: true,
        },
        "cmp_any",
      ),
    ).not.toThrow();
  });
});
