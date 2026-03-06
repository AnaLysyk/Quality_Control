import { getJson, setJson, deleteKey } from './redisClient';
import { ROLE_DEFAULTS } from '../permissions/roleDefaults';

const PREFIX = 'qc:user_permissions:';

export type UserPermissionsOverride = {
  userId: string;
  allow?: Record<string, string[]>;
  deny?: Record<string, string[]>;
  updatedAt?: string;
};

export async function getUserOverride(userId: string): Promise<UserPermissionsOverride | null> {
  const key = PREFIX + userId;
  const v = await getJson(key);
  return v;
}

export async function setUserOverride(userId: string, override: Partial<UserPermissionsOverride>) {
  const key = PREFIX + userId;
  const now = new Date().toISOString();
  const merged = { ...(await getUserOverride(userId) || { userId }), ...override, updatedAt: now };
  await setJson(key, merged);
  return merged;
}

export async function deleteUserOverride(userId: string) {
  const key = PREFIX + userId;
  await deleteKey(key);
}

export function effectivePermissions(role: string, override?: UserPermissionsOverride) {
  const roleDefaults = (ROLE_DEFAULTS as any)[role] || {};
  const allow = override?.allow || {};
  const deny = override?.deny || {};

  const modules = new Set<string>([...Object.keys(roleDefaults), ...Object.keys(allow), ...Object.keys(deny)]);
  const effective: Record<string, Set<string>> = {};

  for (const m of modules) {
    const base = new Set<string>((roleDefaults[m] || []));
    (allow[m] || []).forEach(a => base.add(a));
    (deny[m] || []).forEach(a => base.delete(a));
    effective[m] = base;
  }

  return effective; // Record<module, Set<action>>
}
