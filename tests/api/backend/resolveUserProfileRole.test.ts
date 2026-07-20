import { SYSTEM_ROLES } from "@/backend/auth/roles";
import { resolveUserProfileRole } from "@/backend/permissions/resolveUserProfileRole";

function input(overrides: Partial<Parameters<typeof resolveUserProfileRole>[0]> = {}) {
  return {
    role: "user",
    globalRole: null,
    user_origin: null,
    user_scope: null,
    default_company_slug: null,
    home_company_id: null,
    created_by_company_id: null,
    ...overrides,
  };
}

describe("resolveUserProfileRole", () => {
  it("prioriza um papel global reconhecido", () => {
    expect(resolveUserProfileRole(input({ globalRole: "technical_support" }))).toBe(
      SYSTEM_ROLES.TECHNICAL_SUPPORT,
    );
  });

  it("normaliza papéis legados", () => {
    expect(resolveUserProfileRole(input({ role: "admin" }))).toBe(SYSTEM_ROLES.LEADER_TC);
    expect(resolveUserProfileRole(input({ role: "viewer" }))).toBe(
      SYSTEM_ROLES.TESTING_COMPANY_USER,
    );
  });

  it("classifica usuário comum como usuário empresarial quando há contexto de empresa", () => {
    expect(resolveUserProfileRole(input({ home_company_id: "company-1" }))).toBe(
      SYSTEM_ROLES.COMPANY_USER,
    );
    expect(resolveUserProfileRole(input({ created_by_company_id: "company-1" }))).toBe(
      SYSTEM_ROLES.COMPANY_USER,
    );
    expect(resolveUserProfileRole(input({ default_company_slug: "empresa-1" }))).toBe(
      SYSTEM_ROLES.COMPANY_USER,
    );
  });

  it("reconhece origens legadas de empresa", () => {
    expect(resolveUserProfileRole(input({ user_origin: "company" }))).toBe(
      SYSTEM_ROLES.COMPANY_USER,
    );
    expect(resolveUserProfileRole(input({ user_origin: "client" }))).toBe(
      SYSTEM_ROLES.COMPANY_USER,
    );
  });

  it("mantém usuário da Testing Company sem contexto empresarial", () => {
    expect(resolveUserProfileRole(input())).toBe(SYSTEM_ROLES.TESTING_COMPANY_USER);
  });

  it("usa o contexto como fallback quando o papel é desconhecido", () => {
    expect(resolveUserProfileRole(input({ role: "future_role", home_company_id: "company-1" }))).toBe(
      SYSTEM_ROLES.COMPANY_USER,
    );
    expect(resolveUserProfileRole(input({ role: "future_role" }))).toBe(
      SYSTEM_ROLES.TESTING_COMPANY_USER,
    );
  });
});
