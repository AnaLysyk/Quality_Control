import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";

export type EditableProfileRole = SystemRole;
export type StoredEditableUserRole =
  | "company_admin"
  | "user"
  | "leader_tc"
  | "technical_support";

export function resolveEditableProfileRole(value?: string | null): EditableProfileRole | null {
  return normalizeLegacyRole(value);
}

export function normalizeEditableProfileRole(value?: string | null): EditableProfileRole {
  return resolveEditableProfileRole(value) ?? SYSTEM_ROLES.TESTING_COMPANY_USER;
}

export function isGlobalPrivilegeProfileRole(role: EditableProfileRole) {
  return role === SYSTEM_ROLES.LEADER_TC;
}

export function toStoredEditableUserRole(role: EditableProfileRole): StoredEditableUserRole {
  if (role === SYSTEM_ROLES.EMPRESA) return "company_admin";
  if (role === SYSTEM_ROLES.LEADER_TC) return "leader_tc";
  if (role === SYSTEM_ROLES.TECHNICAL_SUPPORT) return "technical_support";
  return "user";
}

export function editableProfileNeedsCompany(role: EditableProfileRole) {
  return (
    role === SYSTEM_ROLES.EMPRESA ||
    role === SYSTEM_ROLES.COMPANY_USER ||
    role === SYSTEM_ROLES.TESTING_COMPANY_USER
  );
}

export function resolveEditableProfileUserState(role: EditableProfileRole, companyId?: string | null) {
  const normalizedCompanyId = companyId?.trim() || null;

  if (role === SYSTEM_ROLES.EMPRESA || role === SYSTEM_ROLES.COMPANY_USER) {
    return {
      created_by_company_id: normalizedCompanyId,
      home_company_id: normalizedCompanyId,
      user_origin: "client_company" as const,
      user_scope: "company_only" as const,
      allow_multi_company_link: false,
    };
  }

  return {
    created_by_company_id: null,
    home_company_id: null,
    user_origin: "testing_company" as const,
    user_scope: "shared" as const,
    allow_multi_company_link: true,
  };
}
