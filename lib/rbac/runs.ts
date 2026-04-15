import { getMockRole, resolveDefectRole, type Role } from "@/lib/rbac/defects";

type AuthUser = {
  id: string;
  isGlobalAdmin: boolean;
};

export async function resolveRunRole(authUser: AuthUser | null, clientSlug?: string | null): Promise<Role> {
  try {
    return await resolveDefectRole(authUser, clientSlug);
  } catch {
    return "testing_company_user";
  }
}

export const canCreateRun = (role: Role) => role === "leader_tc" || role === "empresa";
export const canEditRun = (role: Role) => role === "leader_tc" || role === "empresa" || role === "testing_company_user";
export const canDeleteRun = (role: Role) => role === "leader_tc";
export const canLinkDefect = (role: Role) => role === "leader_tc" || role === "empresa";
export const getRunMockRole = getMockRole;
