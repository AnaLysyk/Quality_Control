import { resolverAcessoUsuarios } from "@/backend/permissions/validarAcessoUsuarios";

describe("acesso da feature de usuarios", () => {
  it("permite gestao completa para Lider TC", () => {
    expect(resolverAcessoUsuarios({ permissionRole: "leader_tc" })).toEqual({
      canViewUsers: true,
      canCreateUsers: true,
      canEditUsers: true,
      canDeleteUsers: true,
      canViewPermissions: true,
      canEditPermissions: true,
      canResetPermissions: true,
      canClonePermissions: true,
      canManagePrivilegedProfiles: true,
    });
  });

  it("permite gestao completa para Suporte Tecnico conforme matriz central", () => {
    expect(resolverAcessoUsuarios({ permissionRole: "technical_support" })).toMatchObject({
      canViewUsers: true,
      canCreateUsers: true,
      canEditUsers: true,
      canDeleteUsers: true,
      canViewPermissions: true,
      canEditPermissions: true,
      canResetPermissions: true,
      canClonePermissions: true,
      canManagePrivilegedProfiles: true,
    });
  });

  it("respeita uma matriz explicita de permissoes", () => {
    expect(
      resolverAcessoUsuarios({
        permissionRole: "leader_tc",
        permissions: {
          users: ["view"],
          permissions: ["view"],
        },
      }),
    ).toMatchObject({
      canViewUsers: true,
      canCreateUsers: false,
      canEditUsers: false,
      canViewPermissions: true,
      canEditPermissions: false,
    });
  });

  it("nega acesso quando nao existe usuario autenticado", () => {
    expect(resolverAcessoUsuarios(null).canViewUsers).toBe(false);
    expect(resolverAcessoUsuarios(null).canViewPermissions).toBe(false);
  });
});
