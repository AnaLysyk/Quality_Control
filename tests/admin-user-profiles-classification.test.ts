import {
  buildAdminUserItem,
  resolveAdminUserProfileKind,
  resolvePermissionRoleForUser,
} from "../lib/adminUsers";
import type { LocalAuthCompany, LocalAuthMembership, LocalAuthUser } from "../lib/auth/localStore";

function makeUser(overrides: Partial<LocalAuthUser> = {}): LocalAuthUser {
  return {
    id: "user-1",
    name: "Usuario Teste",
    full_name: "Usuario Teste",
    email: "usuario.teste@testing-company.local",
    user: "usuario.teste",
    password_hash: "hash-teste",
    role: "user",
    globalRole: null,
    is_global_admin: false,
    active: true,
    status: "active",
    user_origin: "testing_company",
    user_scope: "shared",
    allow_multi_company_link: true,
    default_company_slug: "demo",
    created_by_company_id: null,
    home_company_id: null,
    avatar_key: null,
    avatar_url: null,
    job_title: null,
    linkedin_url: null,
    ...overrides,
  };
}

function makeLink(role: string, companyId = "Demo"): LocalAuthMembership {
  return {
    id: `membership-${role}-${companyId}`,
    userId: "user-1",
    companyId,
    role,
    capabilities: [],
  };
}

function makeCompany(role = "user") {
  return {
    id: "Demo",
    name: "Demo",
    slug: "Demo",
    role,
  };
}

describe("admin user profile classification", () => {
  it("classifies the institutional company account as Empresa", () => {
    const user = makeUser({
      name: "Demo",
      full_name: "Demo",
      email: "Demo",
      user: "Demo",
      role: "company_admin",
      user_origin: "client_company",
      user_scope: "company_only",
      allow_multi_company_link: false,
      created_by_company_id: "Demo",
      home_company_id: "Demo",
    });
    const links = [makeLink("company_admin")];

    expect(resolvePermissionRoleForUser(user, links)).toBe("empresa");
    expect(resolveAdminUserProfileKind(user, links, makeCompany("company_admin"))).toBe("empresa");
    expect(
      buildAdminUserItem(
        user,
        links,
        new Map<string, LocalAuthCompany>([
          ["Demo", { id: "Demo", name: "Demo", slug: "Demo" } as LocalAuthCompany],
        ]),
      ).profile_kind,
    ).toBe("empresa");
  });

  it("classifies company-created users as Usuario da empresa", () => {
    const user = makeUser({
      name: "Ana da Empresa",
      full_name: "Ana da Empresa",
      email: "ana.empresa@demo.test",
      user: "ana.empresa",
      user_origin: "client_company",
      user_scope: "company_only",
      allow_multi_company_link: false,
      created_by_company_id: "Demo",
      home_company_id: "Demo",
    });
    const links = [makeLink("user")];

    expect(resolvePermissionRoleForUser(user, links)).toBe("company_user");
    expect(resolveAdminUserProfileKind(user, links, makeCompany("user"))).toBe("company_user");
  });

  it("keeps linked Testing Company users separated from company-created users", () => {
    const user = makeUser({
      name: "Usuario TC",
      full_name: "Usuario TC",
      email: "usuario.tc@testing-company.local",
      user: "usuario.tc",
      user_origin: "testing_company",
      user_scope: "shared",
      allow_multi_company_link: true,
    });
    const links = [makeLink("user")];

    expect(resolvePermissionRoleForUser(user, links)).toBe("testing_company_user");
    expect(resolveAdminUserProfileKind(user, links, makeCompany("user"))).toBe("testing_company_user");
  });

  it("preserves Lider TC as its own permission/profile kind", () => {
    const user = makeUser({
      name: "Lider TC",
      full_name: "Lider TC",
      role: "leader_tc",
      user_origin: "testing_company",
    });
    const links = [makeLink("leader_tc")];

    expect(resolvePermissionRoleForUser(user, links)).toBe("leader_tc");
    expect(resolveAdminUserProfileKind(user, links, makeCompany("leader_tc"))).toBe("leader_tc");
  });

  it("preserves Suporte Tecnico as its own permission/profile kind", () => {
    const user = makeUser({
      name: "Suporte TC",
      full_name: "Suporte TC",
      role: "technical_support",
      user_origin: "testing_company",
    });
    const links = [makeLink("technical_support")];

    expect(resolvePermissionRoleForUser(user, links)).toBe("technical_support");
    expect(resolveAdminUserProfileKind(user, links, makeCompany("technical_support"))).toBe("technical_support");
  });
});

