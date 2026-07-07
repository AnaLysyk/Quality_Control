import { applyPermissionOverride, type PermissionMatrix } from "@/lib/permissionMatrix";
import { canAccess } from "@/lib/permissions/can-access";
import { getUserAccessContext } from "@/lib/permissions/get-user-access-context";

function contextFor(userId: string, permissions: PermissionMatrix) {
  return getUserAccessContext({
    id: userId,
    role: "testing_company_user",
    permissionRole: "testing_company_user",
    permissions,
  });
}

describe("heranca e excecoes da matriz central de permissoes", () => {
  const systemDefaults: PermissionMatrix = {
    dashboard: ["view"],
    documents: ["view"],
    permissions: [],
    applications: [],
  };

  it("aplica sobrescrita de perfil para todos os usuarios daquele perfil", () => {
    const profilePermissions = applyPermissionOverride(systemDefaults, {
      allow: { permissions: ["view"] },
    });

    const userA = contextFor("profile-user-a", profilePermissions);
    const userB = contextFor("profile-user-b", profilePermissions);

    expect(canAccess(userA, "permissions.view")).toBe(true);
    expect(canAccess(userB, "permissions.view")).toBe(true);
  });

  it("mantem permissao extra isolada no usuario que recebeu allow individual", () => {
    const profilePermissions = applyPermissionOverride(systemDefaults, {
      allow: { permissions: ["view"] },
    });
    const userA = contextFor("profile-user-a", applyPermissionOverride(profilePermissions, {
      allow: { applications: ["view"] },
    }));
    const userB = contextFor("profile-user-b", profilePermissions);

    expect(canAccess(userA, "applications.view")).toBe(true);
    expect(canAccess(userB, "applications.view")).toBe(false);
    expect(canAccess(userB, "permissions.view")).toBe(true);
  });

  it("remove acesso via deny individual sem alterar o perfil nem outros usuarios", () => {
    const profilePermissions = applyPermissionOverride(systemDefaults, {
      allow: { permissions: ["view"] },
    });
    const userA = contextFor("profile-user-a", applyPermissionOverride(profilePermissions, {
      deny: { permissions: ["view"] },
    }));
    const userB = contextFor("profile-user-b", profilePermissions);

    expect(canAccess(userA, "permissions.view")).toBe(false);
    expect(canAccess(userB, "permissions.view")).toBe(true);
  });
});
