import "server-only";

import type { AccessContext } from "@/backend/auth/session";
import { resolverAcessoUsuarios } from "@/backend/permissions/validarAcessoUsuarios";
import { resolvePermissionAccessForUser } from "@/backend/serverPermissionAccess";

export async function validarAcessoUsuariosNoServidor(access: AccessContext | null) {
  if (!access) return resolverAcessoUsuarios(null);

  const permissionAccess = await resolvePermissionAccessForUser(access.userId);
  return resolverAcessoUsuarios({
    permissions: permissionAccess.permissions,
    permissionRole: permissionAccess.roleKey,
    role: access.role,
    companyRole: access.companyRole,
    globalRole: access.globalRole,
    isGlobalAdmin: access.isGlobalAdmin,
  });
}

