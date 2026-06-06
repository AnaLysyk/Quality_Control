import "server-only";

import type { AccessContext } from "@/core/session/session.store";
import { resolverAcessoUsuarios } from "@/lib/permissions/validarAcessoUsuarios";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";

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
