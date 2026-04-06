import type { AccessContext } from "@/core/session/session.store";
import { resolveEditableProfileRole, type EditableProfileRole } from "@/lib/editableProfileRoles";

export type DeletablePermissionRole = EditableProfileRole;

function normalizePermissionRole(input?: string | null): DeletablePermissionRole | null {
  return resolveEditableProfileRole(input);
}

export function isGlobalDeveloperAccess(access: Pick<AccessContext, "role" | "companyRole"> | null | undefined) {
  const role = (access?.role ?? "").toLowerCase();
  const companyRole = (access?.companyRole ?? "").toLowerCase();
  return role === "it_dev" || companyRole === "it_dev";
}

export function canDeleteUserByProfile(
  access: Pick<AccessContext, "role" | "companyRole"> | null | undefined,
  targetPermissionRole?: string | null,
) {
  const targetRole = normalizePermissionRole(targetPermissionRole);
  if (!targetRole) return false;

  if (isGlobalDeveloperAccess(access)) {
    return true;
  }

  const actorRole = (access?.role ?? "").toLowerCase();
  if (actorRole === "admin") {
    return targetRole === "admin" || targetRole === "leader_tc" || targetRole === "company" || targetRole === "user";
  }

  return false;
}
