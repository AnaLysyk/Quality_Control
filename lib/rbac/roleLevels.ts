// RBAC role levels and helpers
export const ROLE_LEVEL = {
  EMPRESA: 1,
  USUARIO: 2,
  ADMIN: 3,
  DEV: 4,
} as const;

export type Role = keyof typeof ROLE_LEVEL;

export function hasMinRole(userRole: Role | null | undefined, required: Role) {
  if (!userRole) return false;
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[required];
}

export function requireRole(required: Role) {
  return function guard(session: { role?: Role | null }) {
    if (!hasMinRole(session.role ?? null, required)) {
      throw new Error("ACESSO_NEGADO");
    }
  };
}
