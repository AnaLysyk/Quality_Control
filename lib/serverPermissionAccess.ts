import "server-only";

import { getUserOverride, effectivePermissions, type UserPermissionsOverride } from "./store/permissionsStore";
import { resolveRoleDefaults, type Role } from "./permissions/roleDefaults";
import { listLocalLinksForUser, listLocalUsers } from "@/lib/auth/localStore";
import { resolvePermissionRoleForUser } from "@/lib/adminUsers";
import { normalizePermissionMatrix, type PermissionMatrix } from "@/lib/permissionMatrix";

export type RoleKey = Role;

export type ResolvedPermissionAccess = {
  userId: string;
  roleKey: RoleKey;
  roleDefaults: Record<string, string[]>;
  override: UserPermissionsOverride | null;
  permissions: PermissionMatrix;
};

export async function resolveRoleKeyForUser(userId: string): Promise<RoleKey> {
  const [users, links] = await Promise.all([listLocalUsers(), listLocalLinksForUser(userId)]);
  const user = users.find((item) => item.id === userId) ?? null;
  return resolvePermissionRoleForUser(user, links);
}

export async function resolvePermissionAccessForUser(userId: string): Promise<ResolvedPermissionAccess> {
  const roleKey = await resolveRoleKeyForUser(userId);
  const override = await getUserOverride(userId);
  const roleDefaults = resolveRoleDefaults(roleKey);
  const calculated = effectivePermissions(roleKey, override ?? undefined);
  const permissions = normalizePermissionMatrix(
    Object.fromEntries(Object.entries(calculated).map(([moduleId, actions]) => [moduleId, Array.from(actions)])),
  );

  return {
    userId,
    roleKey,
    roleDefaults,
    override,
    permissions,
  };
}
