import "server-only";

import { getUserOverride, type UserPermissionsOverride } from "./store/permissionsStore";
import { type Role } from "./permissions/roleDefaults";
import { listLocalLinksForUser, listLocalUsers } from "@/lib/auth/localStore";
import { resolvePermissionRoleForUser } from "@/lib/adminUsers";
import { hasForcedGlobalAccessForUser } from "@/lib/auth/specialAccess";
import { SYSTEM_ROLES } from "@/lib/auth/roles";
import { type PermissionMatrix } from "@/lib/permissionMatrix";
import {
  resolvePermissionsFromDefaults,
  resolveProfilePermissionDefaults,
} from "@/lib/store/profilePermissionsStore";

export type RoleKey = Role;

export type ResolvedPermissionAccess = {
  userId: string;
  roleKey: RoleKey;
  roleDefaults: Record<string, string[]>;
  override: UserPermissionsOverride | null;
  permissions: PermissionMatrix;
};

type LocalPermissionUser = Awaited<ReturnType<typeof listLocalUsers>>[number];
type LocalPermissionLink = Awaited<ReturnType<typeof listLocalLinksForUser>>[number];

function resolvesToLeaderProfile(user: LocalPermissionUser | null | undefined) {
  if (!user) return false;
  return (
    user.globalRole === "global_admin" ||
    user.is_global_admin === true ||
    hasForcedGlobalAccessForUser({ id: user.id, email: user.email, user: user.user ?? null })
  );
}

async function resolvePermissionSourceForUser(userId: string): Promise<{
  roleKey: RoleKey;
}> {
  const [users, links]: [LocalPermissionUser[], LocalPermissionLink[]] = await Promise.all([
    listLocalUsers(),
    listLocalLinksForUser(userId),
  ]);
  const user = users.find((item) => item.id === userId) ?? null;

  return {
    roleKey: resolvesToLeaderProfile(user) ? SYSTEM_ROLES.LEADER_TC : resolvePermissionRoleForUser(user, links),
  };
}

export async function resolveRoleKeyForUser(userId: string): Promise<RoleKey> {
  const source = await resolvePermissionSourceForUser(userId);
  return source.roleKey;
}

export async function resolvePermissionAccessForUser(userId: string): Promise<ResolvedPermissionAccess> {
  const { roleKey } = await resolvePermissionSourceForUser(userId);
  const override = await getUserOverride(userId);
  const roleDefaults = await resolveProfilePermissionDefaults(roleKey);
  const permissions = resolvePermissionsFromDefaults(roleDefaults, override ?? undefined);

  return {
    userId,
    roleKey,
    roleDefaults,
    override,
    permissions,
  };
}

