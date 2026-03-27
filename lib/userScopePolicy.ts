export type ScopeRoleKey =
  | "admin"
  | "dev"
  | "company"
  | "user"
  | "support"
  | "leader_tc"
  | "technical_support";

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
  roleKey: "user",
  companyAccessScope: "none",
  visibleUserKinds: [],
  creatableUserKinds: [],
  canLinkAcrossCompanies: false,
  usesPermissionMatrix: true,
};

const SCOPE_POLICIES: Record<ScopeRoleKey, Omit<UserScopePolicy, "roleKey">> = {
  admin: {
    companyAccessScope: "all_companies",
    visibleUserKinds: ["testing_company", "company", "support"],
    creatableUserKinds: ["testing_company", "company", "support"],
    canLinkAcrossCompanies: true,
    usesPermissionMatrix: true,
  },
  dev: {
    companyAccessScope: "all_companies",
    visibleUserKinds: ["testing_company", "company", "support"],
    creatableUserKinds: ["testing_company", "company", "support"],
    canLinkAcrossCompanies: true,
    usesPermissionMatrix: true,
  },
  company: {
    companyAccessScope: "own_company",
    visibleUserKinds: ["company"],
    creatableUserKinds: ["company"],
    canLinkAcrossCompanies: false,
    usesPermissionMatrix: true,
  },
  leader_tc: {
    companyAccessScope: "linked_companies",
    visibleUserKinds: ["testing_company", "company"],
    creatableUserKinds: ["testing_company", "company"],
    canLinkAcrossCompanies: true,
    usesPermissionMatrix: true,
  },
  support: {
    companyAccessScope: "linked_companies",
    visibleUserKinds: ["company", "support"],
    creatableUserKinds: [],
    canLinkAcrossCompanies: false,
    usesPermissionMatrix: true,
  },
  technical_support: {
    companyAccessScope: "linked_companies",
    visibleUserKinds: ["company", "support"],
    creatableUserKinds: [],
    canLinkAcrossCompanies: false,
    usesPermissionMatrix: true,
  },
  user: {
    companyAccessScope: "none",
    visibleUserKinds: [],
    creatableUserKinds: [],
    canLinkAcrossCompanies: false,
    usesPermissionMatrix: true,
  },
};

export function normalizeScopeRoleKey(value?: string | null): ScopeRoleKey {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "global_admin" || normalized === "admin") return "admin";
  if (normalized === "dev" || normalized === "it_dev" || normalized === "developer") return "dev";
  if (normalized === "company" || normalized === "company_admin" || normalized === "client_admin") return "company";
  if (normalized === "support") return "support";
  if (normalized === "leader_tc" || normalized === "tc_leader" || normalized === "lider_tc") return "leader_tc";
  if (normalized === "technical_support" || normalized === "tech_support" || normalized === "support_tech") {
    return "technical_support";
  }
  return "user";
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
