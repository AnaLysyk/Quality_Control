import { SYSTEM_ROLES } from "@/lib/auth/roles";

export function isDevRole(role?: string | null | undefined) {
  const value = (role ?? "").toLowerCase();
  return value === SYSTEM_ROLES.LEADER_TC || value === SYSTEM_ROLES.TECHNICAL_SUPPORT;
}
