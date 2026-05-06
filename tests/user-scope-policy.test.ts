import {
  canCreateCompanyUsersByScope,
  canViewCompanyUsersByScope,
  normalizeScopeRoleKey,
  resolveUserScopePolicy,
} from "../lib/userScopePolicy";

describe("user scope policy", () => {
  it("keeps company scope isolated without replacing permission matrix", () => {
    const policy = resolveUserScopePolicy("company");

    expect(policy.roleKey).toBe("empresa");
    expect(policy.companyAccessScope).toBe("own_company");
    expect(policy.usesPermissionMatrix).toBe(true);
    expect(canViewCompanyUsersByScope(policy)).toBe(true);
    expect(canCreateCompanyUsersByScope(policy)).toBe(true);
    expect(policy.canLinkAcrossCompanies).toBe(false);
  });

  it("normalizes legacy role aliases into scoped profiles", () => {
    expect(normalizeScopeRoleKey("company_admin")).toBe("empresa");
    expect(normalizeScopeRoleKey("it_dev")).toBe("technical_support");
    expect(normalizeScopeRoleKey("lider_tc")).toBe("leader_tc");
    expect(normalizeScopeRoleKey("support_tech")).toBe("technical_support");
  });

  it("allows user TC to manage users only inside linked companies", () => {
    const policy = resolveUserScopePolicy("user");

    expect(policy.roleKey).toBe("testing_company_user");
    expect(policy.companyAccessScope).toBe("linked_companies");
    expect(canViewCompanyUsersByScope(policy)).toBe(true);
    expect(canCreateCompanyUsersByScope(policy)).toBe(true);
    expect(policy.canLinkAcrossCompanies).toBe(false);
  });

  it("keeps technical support global for maintenance without creation rights", () => {
    const policy = resolveUserScopePolicy("technical_support");

    expect(policy.roleKey).toBe("technical_support");
    expect(policy.companyAccessScope).toBe("all_companies");
    expect(canViewCompanyUsersByScope(policy)).toBe(false);
    expect(canCreateCompanyUsersByScope(policy)).toBe(false);
    expect(policy.canLinkAcrossCompanies).toBe(false);
  });

  it("keeps leader TC global for institutional administration", () => {
    const policy = resolveUserScopePolicy("leader_tc");

    expect(policy.roleKey).toBe("leader_tc");
    expect(policy.companyAccessScope).toBe("all_companies");
    expect(canViewCompanyUsersByScope(policy)).toBe(true);
    expect(canCreateCompanyUsersByScope(policy)).toBe(true);
    expect(policy.canLinkAcrossCompanies).toBe(true);
  });

  it("keeps technical support global for maintenance without creation rights", () => {
    const policy = resolveUserScopePolicy("technical_support");

    expect(policy.roleKey).toBe("technical_support");
    expect(policy.companyAccessScope).toBe("all_companies");
    expect(canViewCompanyUsersByScope(policy)).toBe(false);
    expect(canCreateCompanyUsersByScope(policy)).toBe(false);
    expect(policy.canLinkAcrossCompanies).toBe(false);
  });

  it("keeps leader TC global for institutional administration", () => {
    const policy = resolveUserScopePolicy("leader_tc");

    expect(policy.roleKey).toBe("leader_tc");
    expect(policy.companyAccessScope).toBe("all_companies");
    expect(canViewCompanyUsersByScope(policy)).toBe(true);
    expect(canCreateCompanyUsersByScope(policy)).toBe(true);
    expect(policy.canLinkAcrossCompanies).toBe(true);
  });
});
