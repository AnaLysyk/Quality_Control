import { normalizeLegacyRole, SYSTEM_ROLES } from "../lib/auth/roles";
import { normalizeAccessType } from "../lib/accessRequestMessage";
import { ROLE_DEFAULTS } from "../lib/permissions/roleDefaults";
import { PERMISSION_MODULES } from "../lib/permissionCatalog";
import { canReviewAccessRequests, canReviewerAccessQueue, canViewAccessRequestQueue } from "../lib/requestReviewAccess";
import { requestProfileTypeNeedsCompany } from "../lib/requestRouting";

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
    // Suporte tecnico ve os modulos (view) mas nao pode aprovar/rejeitar
    expect(ROLE_DEFAULTS[SYSTEM_ROLES.TECHNICAL_SUPPORT].access_requests).toEqual(["view"]);
    expect(ROLE_DEFAULTS[SYSTEM_ROLES.TECHNICAL_SUPPORT].users).toEqual(["view", "view_all"]);
  });

  it("keeps company profiles able to view and create company users", () => {
    expect(ROLE_DEFAULTS[SYSTEM_ROLES.EMPRESA].users).toEqual(["view", "create", "view_company"]);
    expect(ROLE_DEFAULTS[SYSTEM_ROLES.COMPANY_USER].users).toEqual(["view", "create", "view_company"]);
  });

  it("keeps user TC operational inside linked company scope", () => {
    const defaults = ROLE_DEFAULTS[SYSTEM_ROLES.TESTING_COMPANY_USER];

    expect(defaults.releases).toEqual(["view"]);
    expect(defaults.runs).toEqual(["view"]);
    expect(defaults.defects).toEqual(["view"]);
    expect(defaults.testPlans).toEqual(["view"]);
    expect(defaults.documents).toEqual(["view"]);
    expect(defaults.users).toEqual(["view", "create", "view_company"]);
    expect(defaults.permissions).toEqual([]);
    expect(defaults.access_requests).toEqual([]);
    expect(defaults.audit).toEqual([]);
  });

  it("keeps permission catalog covering all default modules", () => {
    const catalogModuleIds = new Set(PERMISSION_MODULES.map((module) => module.id));
    const defaultModuleIds = new Set(Object.values(ROLE_DEFAULTS).flatMap((defaults) => Object.keys(defaults)));

    expect([...defaultModuleIds].filter((moduleId) => !catalogModuleIds.has(moduleId)).sort()).toEqual([]);
  });

  it("routes company-user access requests to an existing company context", () => {
    expect(normalizeAccessType("Usuarios da empresa")).toBe("empresa");
    expect(requestProfileTypeNeedsCompany("company_user")).toBe(true);
    expect(requestProfileTypeNeedsCompany("empresa")).toBe(false);
  });

  it("keeps access-request review queue gated by capability", () => {
    expect(canReviewAccessRequests({ role: "leader_tc" })).toBe(true);
    expect(canReviewAccessRequests({ role: "technical_support" })).toBe(false);
    expect(canViewAccessRequestQueue({ role: "technical_support" }, "admin_and_global")).toBe(true);
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
