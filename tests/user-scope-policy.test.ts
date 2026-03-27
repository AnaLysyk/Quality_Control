import {
  canCreateCompanyUsersByScope,
  canViewCompanyUsersByScope,
  normalizeScopeRoleKey,
  resolveUserScopePolicy,
} from "../lib/userScopePolicy";

describe("user scope policy", () => {
  it("keeps company scope isolated without replacing permission matrix", () => {
    const policy = resolveUserScopePolicy("company");

    expect(policy.roleKey).toBe("company");
    expect(policy.companyAccessScope).toBe("own_company");
    expect(policy.usesPermissionMatrix).toBe(true);
    expect(canViewCompanyUsersByScope(policy)).toBe(true);
    expect(canCreateCompanyUsersByScope(policy)).toBe(true);
    expect(policy.canLinkAcrossCompanies).toBe(false);
  });

  it("normalizes legacy role aliases into scoped profiles", () => {
    expect(normalizeScopeRoleKey("company_admin")).toBe("company");
    expect(normalizeScopeRoleKey("it_dev")).toBe("dev");
    expect(normalizeScopeRoleKey("lider_tc")).toBe("leader_tc");
    expect(normalizeScopeRoleKey("support_tech")).toBe("technical_support");
  });

  it("does not grant company-user management to plain users", () => {
    const policy = resolveUserScopePolicy("user");

    expect(canViewCompanyUsersByScope(policy)).toBe(false);
    expect(canCreateCompanyUsersByScope(policy)).toBe(false);
  });
});
