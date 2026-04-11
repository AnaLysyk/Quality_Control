import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";

export type ScopeRoleKey =
  | SystemRole;

export type ScopeUserKind = "testing_company" | "company" | "support";
export type CompanyAccessScope = "none" | "own_company" | "linked_companies" | "all_companies";

export type UserScopePolicy = {
  roleKey: ScopeRoleKey;
  companyAccessScope: CompanyAccessScope;
  visibleUserKinds: ScopeUserKind[];
  creatableUserKinds: ScopeUserKind[];
  canLinkAcrossCompanies: boolean;
  usesPermissionMatrix: true;
};

const DEFAULT_SCOPE_POLICY: UserScopePolicy = {
  roleKey: SYSTEM_ROLES.TESTING_COMPANY_USER,
  companyAccessScope: "none",
  visibleUserKinds: [],
  creatableUserKinds: [],
  canLinkAcrossCompanies: false,
  usesPermissionMatrix: true,
};

const SCOPE_POLICIES: Record<ScopeRoleKey, Omit<UserScopePolicy, "roleKey">> = {
  [SYSTEM_ROLES.EMPRESA]: {
    companyAccessScope: "own_company",
    visibleUserKinds: ["company"],
    creatableUserKinds: ["company"],
    canLinkAcrossCompanies: false,
    usesPermissionMatrix: true,
  },
  [SYSTEM_ROLES.COMPANY_USER]: {
    companyAccessScope: "own_company",
    visibleUserKinds: ["company"],
    creatableUserKinds: ["company"],
    canLinkAcrossCompanies: false,
    usesPermissionMatrix: true,
  },
  [SYSTEM_ROLES.TESTING_COMPANY_USER]: {
    companyAccessScope: "linked_companies",
    visibleUserKinds: ["testing_company"],
    creatableUserKinds: [],
    canLinkAcrossCompanies: false,
    usesPermissionMatrix: true,
  },
  [SYSTEM_ROLES.LEADER_TC]: {
    companyAccessScope: "all_companies",
    visibleUserKinds: ["testing_company", "company"],
    creatableUserKinds: ["testing_company", "company"],
    canLinkAcrossCompanies: true,
    usesPermissionMatrix: true,
  },
  [SYSTEM_ROLES.TECHNICAL_SUPPORT]: {
    // Scope is global for support operations; it is not institutional user/company administration.
    companyAccessScope: "all_companies",
    visibleUserKinds: ["support"],
    creatableUserKinds: [],
    canLinkAcrossCompanies: false,
    usesPermissionMatrix: true,
  },
};

export function normalizeScopeRoleKey(value?: string | null): ScopeRoleKey {
  return normalizeLegacyRole(value) ?? SYSTEM_ROLES.TESTING_COMPANY_USER;
}

export function resolveUserScopePolicy(roleKey?: string | null): UserScopePolicy {
  const normalizedRoleKey = normalizeScopeRoleKey(roleKey);
  return {
    roleKey: normalizedRoleKey,
    ...(SCOPE_POLICIES[normalizedRoleKey] ?? DEFAULT_SCOPE_POLICY),
  };
}

export function canViewCompanyUsersByScope(policy: UserScopePolicy | null | undefined) {
  if (!policy) return false;
  return policy.visibleUserKinds.includes("company") && policy.companyAccessScope !== "none";
}

export function canCreateCompanyUsersByScope(policy: UserScopePolicy | null | undefined) {
  if (!policy) return false;
  return policy.creatableUserKinds.includes("company") && policy.companyAccessScope !== "none";
}
