import { UserPermissionsOverride, effectivePermissions as calcEffective } from '../store/permissionsStore';

export function effectivePermissions(role: string, override?: UserPermissionsOverride) {
  return calcEffective(role, override);
}

export function can(role: string, override: UserPermissionsOverride | undefined, moduleId: string, action: string) {
  const eff = effectivePermissions(role, override);
  const set = eff[moduleId];
  if (!set) return false;
  return set.has(action);
}
