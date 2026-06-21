import { hasAdminClientToolAccess } from "../../../lib/adminClientAccess";

describe("admin client access", () => {
  it("allows leader TC and technical support roles to see client admin tools", () => {
    expect(hasAdminClientToolAccess({ role: "leader_tc" })).toBe(true);
    expect(hasAdminClientToolAccess({ permissionRole: "technical_support" })).toBe(true);
    expect(hasAdminClientToolAccess({ globalRole: "global_admin" })).toBe(true);
  });

  it("keeps company-only roles out of the admin toolbar", () => {
    expect(hasAdminClientToolAccess({ role: "company_admin" })).toBe(false);
    expect(hasAdminClientToolAccess({ companyRole: "empresa" })).toBe(false);
  });

  it("honors any privileged role even when another field is more restrictive", () => {
    expect(hasAdminClientToolAccess({ permissionRole: "empresa", role: "leader_tc" })).toBe(true);
    expect(hasAdminClientToolAccess({ permissionRole: "testing_company_user", globalRole: "technical_support" })).toBe(true);
  });
});

