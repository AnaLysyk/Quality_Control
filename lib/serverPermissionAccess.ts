import "server-only";

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
import {
  getUserPermissionOverride,
  type UserPermissionsOverride,
} from "@/lib/store/userPermissionsStore";

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

type PermissionAccessCacheEntry = {
  expiresAt: number;
  value: ResolvedPermissionAccess;
};

type PermissionAccessGlobalState = typeof globalThis & {
  __qcPermissionAccessCache?: Map<string, PermissionAccessCacheEntry>;
  __qcPermissionAccessInflight?: Map<string, Promise<ResolvedPermissionAccess>>;
};

const PERMISSION_ACCESS_CACHE_TTL_MS = 30_000;

function getPermissionAccessCache() {
  const globalState = globalThis as PermissionAccessGlobalState;
  if (!globalState.__qcPermissionAccessCache) {
    globalState.__qcPermissionAccessCache = new Map();
  }
  return globalState.__qcPermissionAccessCache;
}

function getPermissionAccessInflight() {
  const globalState = globalThis as PermissionAccessGlobalState;
  if (!globalState.__qcPermissionAccessInflight) {
    globalState.__qcPermissionAccessInflight = new Map();
  }
  return globalState.__qcPermissionAccessInflight;
}

function removeCacheEntry<T>(map: Map<string, T>, key: string) {
  map.delete(key);
}

export function invalidatePermissionAccessCache(userId?: string | null) {
  const cache = getPermissionAccessCache();
  const inflight = getPermissionAccessInflight();
  if (userId) {
    removeCacheEntry(cache, userId);
    removeCacheEntry(inflight, userId);
    return;
  }
  cache.clear();
  inflight.clear();
}

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

async function resolvePermissionAccessForUserUncached(userId: string): Promise<ResolvedPermissionAccess> {
  const { roleKey } = await resolvePermissionSourceForUser(userId);
  const override = await getUserPermissionOverride(userId);
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

export async function resolvePermissionAccessForUser(userId: string): Promise<ResolvedPermissionAccess> {
  const cache = getPermissionAccessCache();
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inflight = getPermissionAccessInflight();
  const current = inflight.get(userId);
  if (current) return current;

  const promise = resolvePermissionAccessForUserUncached(userId);
  inflight.set(userId, promise);

  try {
    const value = await promise;
    cache.set(userId, {
      value,
      expiresAt: Date.now() + PERMISSION_ACCESS_CACHE_TTL_MS,
    });
    return value;
  } finally {
    if (inflight.get(userId) === promise) {
      removeCacheEntry(inflight, promise as unknown as string);
      removeCacheEntry(inflight, userId);
    }
  }
}
