import { isCompanyProfileContext, resolveActiveIdentity } from "../lib/activeIdentity";
import type { AuthUser } from "../packages/contracts/src/auth";

describe("active identity", () => {
  it("prioritizes institutional company context over user permission role", () => {
    const user = {
      id: "company-with-user-permission",
      name: "Demo",
      email: "Demo",
      username: "Demo",
      role: "user",
      permissionRole: "user",
      companyRole: "company_admin",
      defaultClientSlug: "Demo",
    } satisfies AuthUser;

    const identity = resolveActiveIdentity({
      user,
      activeCompany: {
        name: "Demo",
        logoUrl: "/logos/griaule.png",
      },
    });

    expect(isCompanyProfileContext(user)).toBe(true);
    expect(identity.kind).toBe("company");
    expect(identity.displayName).toBe("Demo");
    expect(identity.showCompanyTag).toBe(false);
    expect(identity.companyTagLabel).toBeNull();
  });

  it("keeps personal identity for company-scoped user accounts", () => {
    const user = {
      id: "user-company",
      name: "Ana Paula",
      fullName: "Ana Paula Lysk",
      email: "ana@empresa.local",
      username: "ana.paula",
      role: "user",
      permissionRole: "company",
      companyRole: "company_admin",
      defaultClientSlug: "empresa-xpto",
      avatarUrl: "/avatars/user.png",
    } satisfies AuthUser;

    const identity = resolveActiveIdentity({
      user,
      activeCompany: {
        name: "Empresa XPTO",
        logoUrl: "/logos/empresa.png",
      },
    });

    expect(isCompanyProfileContext(user)).toBe(false);
    expect(identity.kind).toBe("user");
    expect(identity.displayName).toBe("Ana Paula Lysk");
    expect(identity.avatarUrl).toBe("/avatars/user.png");
    expect(identity.showCompanyTag).toBe(true);
    expect(identity.companyTagLabel).toBe("Empresa XPTO");
    expect(identity.accountName).toBe("Ana Paula Lysk");
  });

  it("keeps user identity and company tag for common users linked to a company", () => {
    const user = {
      id: "user-common",
      name: "Maria da Silva",
      email: "maria@empresa.local",
      username: "maria.silva",
      role: "user",
      permissionRole: "user",
      avatarUrl: "/avatars/maria.png",
    } satisfies AuthUser;

    const identity = resolveActiveIdentity({
      user,
      activeCompany: {
        name: "Empresa XPTO",
        logoUrl: "/logos/empresa.png",
      },
    });

    expect(isCompanyProfileContext(user)).toBe(false);
    expect(identity.kind).toBe("user");
    expect(identity.displayName).toBe("Maria da Silva");
    expect(identity.avatarUrl).toBe("/avatars/maria.png");
    expect(identity.showCompanyTag).toBe(true);
    expect(identity.companyTagLabel).toBe("Empresa XPTO");
  });

  it("does not turn global admin navigation into company identity", () => {
    const user = {
      id: "user-admin",
      name: "Admin Global",
      email: "admin@platform.local",
      username: "admin.global",
      role: "admin",
      isGlobalAdmin: true,
      avatarUrl: "/avatars/admin.png",
    } satisfies AuthUser;

    const identity = resolveActiveIdentity({
      user,
      activeCompany: {
        name: "Empresa XPTO",
        logoUrl: "/logos/empresa.png",
      },
    });

    expect(identity.kind).toBe("user");
    expect(identity.displayName).toBe("Admin Global");
    expect(identity.avatarUrl).toBe("/avatars/admin.png");
    expect(identity.showCompanyTag).toBe(false);
  });
});

