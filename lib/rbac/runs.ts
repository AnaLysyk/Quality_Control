import { getMockRole, resolveDefectRole, type Role } from "@/lib/rbac/defects";

type AuthUser = {
  id: string;
  isGlobalAdmin: boolean;
};

export async function resolveRunRole(authUser: AuthUser | null, clientSlug?: string | null): Promise<Role> {
  try {
    return await resolveDefectRole(authUser, clientSlug);
  } catch {
    return "user";
  }
}

export const canCreateRun = (role: Role) => role === "admin" || role === "company";
export const canEditRun = (role: Role) => role === "admin" || role === "company" || role === "user";
export const canDeleteRun = (role: Role) => role === "admin";
export const canLinkDefect = (role: Role) => role === "admin" || role === "company";
export const getRunMockRole = getMockRole;
