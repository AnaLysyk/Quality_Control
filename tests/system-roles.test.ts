import { normalizeLegacyRole, SYSTEM_ROLES } from "../lib/auth/roles";
import { ROLE_DEFAULTS } from "../lib/permissions/roleDefaults";
import { canReviewAccessRequests, canReviewerAccessQueue } from "../lib/requestReviewAccess";

describe("system role contract", () => {
  it("exposes only the canonical profile roles", () => {
    expect(Object.values(SYSTEM_ROLES).sort()).toEqual([
      "company_user",
      "empresa",
      "leader_tc",
      "technical_support",
      "testing_company_user",
    ]);
  });

  it("keeps permission defaults keyed only by canonical roles", () => {
    expect(Object.keys(ROLE_DEFAULTS).sort()).toEqual(Object.values(SYSTEM_ROLES).sort());
  });

  it("keeps access-request review capacity on leader TC, not support", () => {
    expect(ROLE_DEFAULTS[SYSTEM_ROLES.LEADER_TC].access_requests).toEqual([
      "view",
      "comment",
      "approve",
      "reject",
    ]);
    expect(ROLE_DEFAULTS[SYSTEM_ROLES.TECHNICAL_SUPPORT].access_requests).toEqual([]);
    expect(ROLE_DEFAULTS[SYSTEM_ROLES.TECHNICAL_SUPPORT].users).toEqual([]);
  });

  it("keeps access-request review queue gated by capability", () => {
    expect(canReviewAccessRequests({ role: "leader_tc" })).toBe(true);
    expect(canReviewAccessRequests({ role: "technical_support" })).toBe(false);
    expect(canReviewerAccessQueue({ role: "technical_support" }, "global_only")).toBe(false);
    expect(canReviewerAccessQueue({ role: "technical_support" }, "admin_and_global")).toBe(false);
    expect(canReviewerAccessQueue({ role: "it_dev" }, "global_only")).toBe(false);
    expect(canReviewerAccessQueue({ role: "technical_support", isGlobalAdmin: true }, "global_only")).toBe(false);
    expect(canReviewerAccessQueue({ role: "leader_tc" }, "admin_and_global")).toBe(true);
    expect(canReviewerAccessQueue({ role: "leader_tc" }, "global_only")).toBe(true);
    expect(canReviewerAccessQueue({ role: "user" }, "admin_and_global")).toBe(false);
    expect(canReviewerAccessQueue({ role: "leader_tc", isGlobalAdmin: true }, "global_only")).toBe(true);
  });

  it.each([
    ["empresa", "empresa"],
    ["company_admin", "empresa"],
    ["client_admin", "empresa"],
    ["company_user", "company_user"],
    ["client_user", "company_user"],
    ["testing_company_user", "testing_company_user"],
    ["user", "testing_company_user"],
    ["leader_tc", "leader_tc"],
    ["admin", "leader_tc"],
    ["global_admin", "leader_tc"],
    ["technical_support", "technical_support"],
    ["support", "technical_support"],
    ["tech_support", "technical_support"],
    ["it_dev", "technical_support"],
    ["dev", "technical_support"],
  ])("normalizes legacy role %s to canonical %s", (legacy, canonical) => {
    expect(normalizeLegacyRole(legacy)).toBe(canonical);
  });
});
