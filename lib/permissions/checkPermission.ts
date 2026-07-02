/**
 * Server-side permission checker for API route handlers.
 *
 * Bridges the legacy PermissionMatrix format (Record<module, action[]>) to the
 * new `module:action` Permission string format used in useCurrentWorkspaceContext.
 *
 * Usage:
 * ```ts
 * const user = await authenticateRequest(req);
 * if (!user) return NextResponse.json({ message: "NÃ£o autorizado" }, { status: 401 });
 * if (!checkPermission(user, "test_repository:create")) {
 *   return NextResponse.json({ message: "Sem permissÃ£o" }, { status: 403 });
 * }
 * ```
 */

import { resolveEffectivePermissionMatrix } from "@/lib/permissionMatrix";
import type { AuthUser } from "@/lib/jwtAuth";

/**
 * Resolves whether `user` has the given `module:action` permission.
 *
 * Resolution order:
 * 1. If `user.isGlobalAdmin` â†’ always true.
 * 2. Compute effective PermissionMatrix from `resolveEffectivePermissionMatrix`.
 * 3. Check if the module key contains the requested action.
 */
export function checkPermission(user: AuthUser, permission: string): boolean {
  if (user.isGlobalAdmin) return true;

  const [module, action] = permission.split(":");
  if (!module || !action) return false;

  const matrix = resolveEffectivePermissionMatrix({
    permissions: user.permissions ?? null,
    permissionRole: user.permissionRole ?? null,
    role: user.role ?? null,
    companyRole: user.companyRole ?? null,
    globalRole: user.globalRole ?? null,
    isGlobalAdmin: user.isGlobalAdmin,
  });

  const actions: string[] = matrix[module] ?? [];
  return actions.includes(action);
}

/**
 * Like `checkPermission`, but requires ALL permissions in the list.
 */
export function checkAllPermissions(user: AuthUser, permissions: string[]): boolean {
  return permissions.every((p) => checkPermission(user, p));
}

/**
 * Like `checkPermission`, but requires ANY permission in the list.
 */
export function checkAnyPermission(user: AuthUser, permissions: string[]): boolean {
  return permissions.some((p) => checkPermission(user, p));
}

