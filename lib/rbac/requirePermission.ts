import "server-only";

import { NextResponse } from "next/server";

import { getAccessContext, type AccessContext } from "@/lib/auth/session";
import {
  hasPermissionAccess,
  type PermissionMatrix,
} from "@/lib/permissionMatrix";
import {
  resolvePermissionAccessForUser,
  type ResolvedPermissionAccess,
} from "@/lib/serverPermissionAccess";

type RequirePermissionOptions = {
  unauthorizedMessage?: string;
  forbiddenMessage?: string;
};

export type RequirePermissionSuccess = {
  ok: true;
  access: AccessContext;
  permissionAccess: ResolvedPermissionAccess;
  permissions: PermissionMatrix;
};

export type RequirePermissionFailure = {
  ok: false;
  access: AccessContext | null;
  permissionAccess: ResolvedPermissionAccess | null;
  response: NextResponse;
};

export type RequirePermissionResult =
  | RequirePermissionSuccess
  | RequirePermissionFailure;

function acceptedActions(action: string) {
  if (action === "view") return ["view", "view_own", "view_company", "view_all"];
  return [action];
}

export function hasResolvedPermission(
  permissions: PermissionMatrix | null | undefined,
  moduleId: string,
  action: string,
) {
  return acceptedActions(action).some((acceptedAction) =>
    hasPermissionAccess(permissions, moduleId, acceptedAction),
  );
}

export async function requirePermission(
  req: Request,
  moduleId: string,
  action: string,
  options: RequirePermissionOptions = {},
): Promise<RequirePermissionResult> {
  const access = await getAccessContext(req);
  if (!access) {
    return {
      ok: false,
      access: null,
      permissionAccess: null,
      response: NextResponse.json(
        { error: options.unauthorizedMessage ?? "Nao autenticado" },
        { status: 401 },
      ),
    };
  }

  const permissionAccess = await resolvePermissionAccessForUser(access.userId);
  const allowed = hasResolvedPermission(
    permissionAccess.permissions,
    moduleId,
    action,
  );

  if (!allowed) {
    return {
      ok: false,
      access,
      permissionAccess,
      response: NextResponse.json(
        { error: options.forbiddenMessage ?? "Sem permissao" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    access,
    permissionAccess,
    permissions: permissionAccess.permissions,
  };
}
