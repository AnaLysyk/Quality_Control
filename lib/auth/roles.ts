export const SYSTEM_ROLES = {
  EMPRESA: "empresa",
  COMPANY_USER: "company_user",
  TESTING_COMPANY_USER: "testing_company_user",
  LEADER_TC: "leader_tc",
  TECHNICAL_SUPPORT: "technical_support",
} as const;

export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

const SYSTEM_ROLE_SET = new Set<string>(Object.values(SYSTEM_ROLES));

export function isSystemRole(input?: string | null): input is SystemRole {
  return SYSTEM_ROLE_SET.has((input ?? "").trim().toLowerCase());
}

export function normalizeLegacyRole(input?: string | null): SystemRole | null {
  const value = (input ?? "").trim().toLowerCase();

  if (!value) return null;

  if (
    value === SYSTEM_ROLES.EMPRESA ||
    value === "company" ||
    value === "company_admin" ||
    value === "client_admin" ||
    value === "client_owner" ||
    value === "client_manager"
  ) {
    return SYSTEM_ROLES.EMPRESA;
  }

  if (value === SYSTEM_ROLES.COMPANY_USER || value === "client_user" || value === "company_viewer") {
    return SYSTEM_ROLES.COMPANY_USER;
  }

  if (value === SYSTEM_ROLES.TESTING_COMPANY_USER || value === "user" || value === "viewer") {
    return SYSTEM_ROLES.TESTING_COMPANY_USER;
  }

  if (
    value === SYSTEM_ROLES.LEADER_TC ||
    value === "testing_company_lead" ||
    value === "admin" ||
    value === "global_admin" ||
    value === "super-admin" ||
    value === "lider_tc" ||
    value === "tc_leader"
  ) {
    return SYSTEM_ROLES.LEADER_TC;
  }

  if (
    value === SYSTEM_ROLES.TECHNICAL_SUPPORT ||
    value === "support" ||
    value === "tech_support" ||
    value === "support_tech" ||
    value === "it_dev" ||
    value === "itdev" ||
    value === "dev" ||
    value === "developer"
  ) {
    return SYSTEM_ROLES.TECHNICAL_SUPPORT;
  }

  return null;
}

export function isTechnicalSupportRole(input?: string | null) {
  return normalizeLegacyRole(input) === SYSTEM_ROLES.TECHNICAL_SUPPORT;
}

export function isLeaderRole(input?: string | null) {
  return normalizeLegacyRole(input) === SYSTEM_ROLES.LEADER_TC;
}

export function isCompanyRole(input?: string | null) {
  return normalizeLegacyRole(input) === SYSTEM_ROLES.EMPRESA;
}
