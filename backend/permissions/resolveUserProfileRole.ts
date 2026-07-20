import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/backend/auth/roles";

export type UserProfileRoleInput = {
  role: unknown;
  globalRole: string | null;
  user_origin: string | null;
  user_scope: string | null;
  default_company_slug: string | null;
  home_company_id: string | null;
  created_by_company_id: string | null;
};

function roleText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return "";
}

export function resolveUserProfileRole(user: UserProfileRoleInput): SystemRole | null {
  const globalRole = normalizeLegacyRole(user.globalRole ?? null);
  if (globalRole) return globalRole;

  const role = normalizeLegacyRole(roleText(user.role));
  const looksCompanyUser =
    user.user_origin === "company" ||
    user.user_origin === "client" ||
    Boolean(user.home_company_id || user.created_by_company_id || user.default_company_slug);

  if (role === SYSTEM_ROLES.TESTING_COMPANY_USER && looksCompanyUser) {
    return SYSTEM_ROLES.COMPANY_USER;
  }

  return role ?? (looksCompanyUser ? SYSTEM_ROLES.COMPANY_USER : SYSTEM_ROLES.TESTING_COMPANY_USER);
}
