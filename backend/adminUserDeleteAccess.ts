import type { AccessContext } from "@/backend/auth/session";
import { resolveEditableProfileRole, type EditableProfileRole } from "@/backend/editableProfileRoles";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/backend/auth/roles";

export type DeletablePermissionRole = EditableProfileRole;

function normalizePermissionRole(input?: string | null): DeletablePermissionRole | null {
  return resolveEditableProfileRole(input);
}

export function canManageInstitutionalProfiles(access: Pick<AccessContext, "role" | "companyRole"> | null | undefined) {
  const role = normalizeLegacyRole(access?.role);
  const companyRole = normalizeLegacyRole(access?.companyRole);
  return (
    role === SYSTEM_ROLES.LEADER_TC ||
    companyRole === SYSTEM_ROLES.LEADER_TC ||
    role === SYSTEM_ROLES.TECHNICAL_SUPPORT ||
    companyRole === SYSTEM_ROLES.TECHNICAL_SUPPORT
  );
}

export function canDeleteUserByProfile(
  access: Pick<AccessContext, "role" | "companyRole"> | null | undefined,
  targetPermissionRole?: string | null,
) {
  const targetRole = normalizePermissionRole(targetPermissionRole);
  if (!targetRole) return false;

  if (canManageInstitutionalProfiles(access)) {
    return true;
  }

  const actorRole = normalizeLegacyRole(access?.role);
  if (actorRole === SYSTEM_ROLES.LEADER_TC) {
    return true;
  }

  return false;
}

