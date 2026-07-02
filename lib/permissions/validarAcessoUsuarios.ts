import { resolveEffectivePermissionMatrix, hasPermissionAccess, type PermissionMatrix } from "@/lib/permissionMatrix";

export type UsuarioComAcesso = {
  permissions?: PermissionMatrix | null;
  permissionRole?: string | null;
  role?: string | null;
  companyRole?: string | null;
  globalRole?: string | null;
  isGlobalAdmin?: boolean | null;
};

export type AcessoUsuarios = {
  canViewUsers: boolean;
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canViewPermissions: boolean;
  canEditPermissions: boolean;
  canResetPermissions: boolean;
  canClonePermissions: boolean;
  canManagePrivilegedProfiles: boolean;
};

function hasAnyAction(permissions: PermissionMatrix, moduleId: string, actions: string[]) {
  return actions.some((action) => hasPermissionAccess(permissions, moduleId, action));
}

export function resolverAcessoUsuarios(user: UsuarioComAcesso | null | undefined): AcessoUsuarios {
  if (!user) {
    return {
      canViewUsers: false,
      canCreateUsers: false,
      canEditUsers: false,
      canViewPermissions: false,
      canEditPermissions: false,
      canResetPermissions: false,
      canClonePermissions: false,
      canManagePrivilegedProfiles: false,
    };
  }

  const permissions = resolveEffectivePermissionMatrix(user);
  const canViewUsers = hasAnyAction(permissions, "users", ["view", "view_company", "view_all"]);
  const canCreateUsers = hasPermissionAccess(permissions, "users", "create");
  const canEditUsers = hasPermissionAccess(permissions, "users", "edit");
  const canViewPermissions = hasPermissionAccess(permissions, "permissions", "view");
  const canEditPermissions = hasPermissionAccess(permissions, "permissions", "edit");
  const canResetPermissions = hasPermissionAccess(permissions, "permissions", "reset");
  const canClonePermissions = hasPermissionAccess(permissions, "permissions", "clone");

  return {
    canViewUsers,
    canCreateUsers,
    canEditUsers,
    canViewPermissions,
    canEditPermissions,
    canResetPermissions,
    canClonePermissions,
    canManagePrivilegedProfiles: canEditUsers && canEditPermissions,
  };
}

