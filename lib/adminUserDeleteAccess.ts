import type { AccessContext } from "@/core/session/session.store";

export type DeletablePermissionRole = "admin" | "dev" | "company" | "user";

function normalizePermissionRole(input?: string | null): DeletablePermissionRole | null {
  const value = (input ?? "").trim().toLowerCase();
  if (value === "admin") return "admin";
  if (value === "dev") return "dev";
  if (value === "company") return "company";
  if (value === "user") return "user";
  return null;
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
    return targetRole === "admin" || targetRole === "company" || targetRole === "user";
  }

  return false;
}
