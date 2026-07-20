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
  it("prioriza o papel global normalizado", () => {
    expect(resolveUserProfileRole(input({ globalRole: "technical_support" }))).toBe(SYSTEM_ROLES.TECHNICAL_SUPPORT);
  });

  it("não converte objetos com String padrão", () => {
    expect(resolveUserProfileRole(input({ role: { value: "leader_tc" } }))).toBe(SYSTEM_ROLES.TESTING_COMPANY_USER);
  });

  it.each([
    [123, SYSTEM_ROLES.TESTING_COMPANY_USER],
    [true, SYSTEM_ROLES.TESTING_COMPANY_USER],
    ["leader_tc", SYSTEM_ROLES.LEADER_TC],
  ])("normaliza valores primitivos de role", (role, expected) => {
    expect(resolveUserProfileRole(input({ role }))).toBe(expected);
  });

  it("converte usuário TC em usuário empresarial quando há contexto de empresa", () => {
    expect(resolveUserProfileRole(input({ role: "testing_company_user", home_company_id: "company-1" }))).toBe(SYSTEM_ROLES.COMPANY_USER);
  });

  it("usa usuário empresarial como fallback para origem de cliente", () => {
    expect(resolveUserProfileRole(input({ role: null, user_origin: "client" }))).toBe(SYSTEM_ROLES.COMPANY_USER);
  });
});
