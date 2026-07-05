import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";

export type PermissionMatrix = Record<string, string[]>;
export type PermissionOverride = {
  allow?: PermissionMatrix;
  deny?: PermissionMatrix;
  updatedAt?: string;
};

const OPERATION_PROFILE_ACTIONS = ["view", "dashboard", "metrics", "search"];

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function expandOperationDefaults(role: string | null, matrix: PermissionMatrix) {
  if (role !== SYSTEM_ROLES.LEADER_TC && role !== SYSTEM_ROLES.TECHNICAL_SUPPORT) return matrix;
  return {
    ...matrix,
    operations: unique([...(matrix.operations ?? []), ...OPERATION_PROFILE_ACTIONS]),
  };
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

type EffectivePermissionMatrixInput = {
  permissions?: PermissionMatrix | null;
  permissionRole?: string | null;
  role?: string | null;
  companyRole?: string | null;
  globalRole?: string | null;
  isGlobalAdmin?: boolean | null;
};

function hasAnyPermissionActions(matrix: PermissionMatrix) {
  return Object.values(matrix).some((actions) => actions.length > 0);
}

function resolvePermissionRole(input: EffectivePermissionMatrixInput | null | undefined) {
  return (
    (input?.isGlobalAdmin === true ? normalizeLegacyRole("global_admin") : null) ??
    normalizeLegacyRole(input?.permissionRole ?? null) ??
    normalizeLegacyRole(input?.role ?? null) ??
    normalizeLegacyRole(input?.companyRole ?? null) ??
    normalizeLegacyRole(input?.globalRole ?? null)
  );
}

export function resolveEffectivePermissionMatrix(input: EffectivePermissionMatrixInput | null | undefined) {
  const normalized = normalizePermissionMatrix(input?.permissions);
  if (hasAnyPermissionActions(normalized)) return normalized;

  const role = resolvePermissionRole(input);
  if (!role) return normalized;

  return expandOperationDefaults(role, normalizePermissionMatrix(resolveRoleDefaults(role)));
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
    const deniedActions = new Set(deny[moduleId] ?? []);
    const next = unique([...(baseDefaults[moduleId] ?? []), ...(allow[moduleId] ?? [])]).filter(
      (action) => !deniedActions.has(action),
    );
    effective[moduleId] = next;
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
