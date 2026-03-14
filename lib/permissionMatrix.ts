export type PermissionMatrix = Record<string, string[]>;
export type PermissionOverride = {
  allow?: PermissionMatrix;
  deny?: PermissionMatrix;
  updatedAt?: string;
};

function unique(values: string[]) {
  return Array.from(new Set(values));
}

export function normalizePermissionMatrix(input: unknown): PermissionMatrix {
  if (!input || typeof input !== "object") return {};

  const output: PermissionMatrix = {};
  for (const [moduleId, actions] of Object.entries(input as Record<string, unknown>)) {
    if (!Array.isArray(actions)) continue;
    output[moduleId] = unique(
      actions.filter((action): action is string => typeof action === "string" && action.trim().length > 0),
    );
  }
  return output;
}

export function hasPermissionAccess(
  permissions: PermissionMatrix | null | undefined,
  moduleId: string,
  action: string,
) {
  if (!permissions) return false;
  return Array.isArray(permissions[moduleId]) && permissions[moduleId].includes(action);
}

export function applyPermissionOverride(
  roleDefaults: PermissionMatrix | null | undefined,
  override: PermissionOverride | null | undefined,
) {
  const baseDefaults = normalizePermissionMatrix(roleDefaults);
  const allow = normalizePermissionMatrix(override?.allow);
  const deny = normalizePermissionMatrix(override?.deny);
  const modules = new Set<string>([
    ...Object.keys(baseDefaults),
    ...Object.keys(allow),
    ...Object.keys(deny),
  ]);
  const effective: PermissionMatrix = {};

  for (const moduleId of modules) {
    const next = new Set<string>(baseDefaults[moduleId] ?? []);
    for (const action of allow[moduleId] ?? []) next.add(action);
    for (const action of deny[moduleId] ?? []) next.delete(action);
    effective[moduleId] = Array.from(next);
  }

  return effective;
}

export function getOverrideState(
  roleDefaults: PermissionMatrix | null | undefined,
  override: PermissionOverride | null | undefined,
  moduleId: string,
  action: string,
) {
  const defaults = normalizePermissionMatrix(roleDefaults);
  const allow = normalizePermissionMatrix(override?.allow);
  const deny = normalizePermissionMatrix(override?.deny);
  const roleHas = Array.isArray(defaults[moduleId]) && defaults[moduleId].includes(action);
  const allowedByOverride = Array.isArray(allow[moduleId]) && allow[moduleId].includes(action);
  const deniedByOverride = Array.isArray(deny[moduleId]) && deny[moduleId].includes(action);

  if (!roleHas && allowedByOverride) return "allow";
  if (roleHas && deniedByOverride) return "deny";
  return "default";
}

export function getTicketViewScope(permissions: PermissionMatrix | null | undefined) {
  if (hasPermissionAccess(permissions, "tickets", "view_all")) return "all";
  if (hasPermissionAccess(permissions, "tickets", "view_company")) return "company";
  return "own";
}

export function getUsersViewScope(permissions: PermissionMatrix | null | undefined) {
  if (hasPermissionAccess(permissions, "users", "view_all")) return "all";
  if (hasPermissionAccess(permissions, "users", "view_company")) return "company";
  return "own";
}

export function toVisibilityMap(permissions: PermissionMatrix | null | undefined) {
  const visibility: Record<string, boolean> = {};
  const matrix = normalizePermissionMatrix(permissions);
  for (const [moduleId, actions] of Object.entries(matrix)) {
    visibility[moduleId] = actions.includes("view");
  }
  return visibility;
}
