import type { AuthCompany } from "@/contracts/auth";
import {
  normalizeAuthenticatedUser,
  type AuthenticatedUserLike,
} from "@/lib/auth/normalizeAuthenticatedUser";
import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import { resolveFixedProfileKind, type FixedProfileKind } from "@/lib/fixedProfilePresentation";
import {
  applyPermissionOverride,
  normalizePermissionMatrix,
  resolveEffectivePermissionMatrix,
  type PermissionMatrix,
  type PermissionOverride,
} from "@/lib/permissionMatrix";

export type UserAccessContext = {
  userId: string;
  role: SystemRole | null;
  permissionRole: SystemRole | null;
  profileKind: FixedProfileKind;
  companyId: string | null;
  companySlug: string | null;
  companySlugs: string[];
  isGlobalAdmin: boolean;
  isTestingCompanyUser: boolean;
  isCompanyUser: boolean;
  permissions: PermissionMatrix;
};

type UserAccessSource = AuthenticatedUserLike & {
  id?: string;
  userId?: string;
  clientId?: string | null;
  companyId?: string | null;
  permissionOverride?: PermissionOverride | null;
};

export function getUserAccessContext(
  user: UserAccessSource | null | undefined,
  companies: AuthCompany[] = [],
): UserAccessContext | null {
  if (!user) return null;

  const userId =
    (typeof user.id === "string" && user.id.trim()) ||
    (typeof user.userId === "string" && user.userId.trim()) ||
    "";
  if (!userId) return null;

  const isGlobalAdmin =
    user.isGlobalAdmin === true ||
    user.is_global_admin === true ||
    String(user.globalRole ?? "").toLowerCase() === "global_admin";
  const companyRole = typeof user.companyRole === "string" ? user.companyRole : null;
  const permissionRole =
    (isGlobalAdmin ? SYSTEM_ROLES.LEADER_TC : null) ??
    normalizeLegacyRole(user.permissionRole ?? null) ??
    normalizeLegacyRole(user.role ?? null) ??
    normalizeLegacyRole(companyRole);
  const role =
    (isGlobalAdmin ? SYSTEM_ROLES.LEADER_TC : null) ??
    normalizeLegacyRole(user.role ?? null) ??
    normalizeLegacyRole(companyRole) ??
    permissionRole;
  const normalizedUser = normalizeAuthenticatedUser(user, companies);
  const companySlug =
    (typeof user.clientSlug === "string" && user.clientSlug.trim()) ||
    (typeof user.companySlug === "string" && user.companySlug.trim()) ||
    normalizedUser.primaryCompanySlug;
  const companyId =
    (typeof user.clientId === "string" && user.clientId.trim()) ||
    (typeof user.companyId === "string" && user.companyId.trim()) ||
    normalizedUser.companies.find((company) => company.slug === companySlug)?.id ||
    normalizedUser.companies[0]?.id ||
    null;
  const profileKind = resolveFixedProfileKind({
    permissionRole,
    role,
    companyRole,
    clientSlug: companySlug,
    companyCount: normalizedUser.companyCount,
  });
  const isCompanyUser =
    permissionRole === SYSTEM_ROLES.EMPRESA ||
    permissionRole === SYSTEM_ROLES.COMPANY_USER;
  const isTestingCompanyUser =
    permissionRole === SYSTEM_ROLES.LEADER_TC ||
    permissionRole === SYSTEM_ROLES.TECHNICAL_SUPPORT ||
    permissionRole === SYSTEM_ROLES.TESTING_COMPANY_USER;
  const resolvedUserPermissions =
    user.permissions != null ? normalizePermissionMatrix(user.permissions) : null;
  const userPermissionOverride =
    user.permissionOverride && typeof user.permissionOverride === "object"
      ? user.permissionOverride
      : null;
  const basePermissions =
    user.permissions != null
      ? (resolvedUserPermissions ?? {})
      : resolveEffectivePermissionMatrix({
          permissionRole,
          role,
          companyRole,
          globalRole: typeof user.globalRole === "string" ? user.globalRole : null,
          isGlobalAdmin,
        });

  return {
    userId,
    role,
    permissionRole,
    profileKind,
    companyId,
    companySlug,
    companySlugs: normalizedUser.companySlugs,
    isGlobalAdmin,
    isTestingCompanyUser,
    isCompanyUser,
    permissions: applyPermissionOverride(basePermissions, userPermissionOverride),
  };
}
