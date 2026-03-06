import ROLE_DEFAULTS from './rolePermissions';

export type PermMap = Record<string, string[]>;

export function effectivePermissions(role: string, allow?: PermMap, deny?: PermMap): PermMap {
  const out: PermMap = {};
  const roleDefaults = ROLE_DEFAULTS[role] || {};

  for (const [mod, actions] of Object.entries(roleDefaults)) {
    out[mod] = Array.from(new Set(actions));
  }

  for (const [mod, actions] of Object.entries(allow || {})) {
    out[mod] = Array.from(new Set([...(out[mod] || []), ...actions]));
  }

  for (const [mod, actions] of Object.entries(deny || {})) {
    out[mod] = (out[mod] || []).filter((a) => !actions.includes(a));
  }

  return out;
}

export function can(role: string, allow: PermMap | undefined, deny: PermMap | undefined, moduleKey: string, action: string) {
  const eff = effectivePermissions(role, allow, deny);
  const actions = eff[moduleKey] || [];
  return actions.includes(action);
}

export default { effectivePermissions, can };
