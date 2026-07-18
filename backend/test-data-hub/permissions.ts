import "server-only";

import type { AuthUser } from "@/backend/jwtAuth";
import { resolveCompanyProjectVisibility } from "@/backend/permissions/projectAccess";

/**
 * Test Data Hub Permissions
 *
 * Centralized permission checks for Test Data Hub operations.
 * Enforces:
 * - Company/project access
 * - Sensitivity level access
 * - Role-based restrictions
 */

export type SensitivityLevel = "public" | "internal" | "restricted" | "sensitive";

const SENSITIVITY_LEVELS: SensitivityLevel[] = ["public", "internal", "restricted", "sensitive"];

export function isSensitivityLevel(value: unknown): value is SensitivityLevel {
  return typeof value === "string" && SENSITIVITY_LEVELS.includes(value as SensitivityLevel);
}

export type PermissionDenialReason =
  | "not_authenticated"
  | "company_mismatch"
  | "project_mismatch"
  | "sensitivity_too_high"
  | "insufficient_role"
  | "asset_in_use"
  | "policy_violation";

export class PermissionError extends Error {
  constructor(
    public reason: PermissionDenialReason,
    message: string,
  ) {
    super(message);
    this.name = "PermissionError";
  }
}

export type CompanyProjectAccess = {
  companyAllowed: boolean;
  allProjects: boolean;
  projectIds: string[];
};

function normalizedRoles(user: AuthUser) {
  return new Set(
    [user.role, user.companyRole, user.globalRole, user.permissionRole]
      .filter((role): role is string => typeof role === "string" && role.trim().length > 0)
      .map((role) => role.trim().toLowerCase()),
  );
}

function hasAnyRole(user: AuthUser, roles: readonly string[]) {
  const actualRoles = normalizedRoles(user);
  return roles.some((role) => actualRoles.has(role));
}

/**
 * Resolve o escopo relacional sem achatar empresas e projetos. `allProjects`
 * distingue acesso total de uma lista vazia, que libera somente ativos de
 * nível da empresa (`projectId=null`).
 */
export function getCompanyProjectAccess(user: AuthUser | null, companySlug: string): CompanyProjectAccess {
  if (!user) return { companyAllowed: false, allProjects: false, projectIds: [] };
  if (user.isGlobalAdmin || user.projectScope === "unrestricted") {
    return { companyAllowed: true, allProjects: true, projectIds: [] };
  }

  if (user.projectScope && Array.isArray(user.assignments)) {
    const companyAllowed = user.assignments.some(
      (assignment) =>
        assignment.status === "active" &&
        assignment.companySlug.trim().toLowerCase() === companySlug.trim().toLowerCase(),
    );
    if (!companyAllowed) return { companyAllowed: false, allProjects: false, projectIds: [] };

    const visibility = resolveCompanyProjectVisibility(
      { projectScope: user.projectScope, assignments: user.assignments },
      { companySlug },
    );
    return {
      companyAllowed: true,
      allProjects: visibility.mode === "all",
      projectIds: visibility.mode === "selected" ? visibility.projectIds : [],
    };
  }

  // Compatibilidade exclusiva para sessões E2E/legadas sem o contrato novo.
  const companySlugs = Array.isArray(user.companySlugs)
    ? user.companySlugs
    : [user.companySlug].filter((slug): slug is string => typeof slug === "string");
  const companyAllowed = companySlugs.some(
    (slug) => slug.trim().toLowerCase() === companySlug.trim().toLowerCase(),
  );
  if (!companyAllowed) return { companyAllowed: false, allProjects: false, projectIds: [] };

  if (Array.isArray(user.allowedProjectIds)) {
    return { companyAllowed: true, allProjects: false, projectIds: [...new Set(user.allowedProjectIds)] };
  }
  return { companyAllowed: true, allProjects: true, projectIds: [] };
}

/**
 * Check if user can access company
 */
export function canAccessCompany(user: AuthUser | null, companySlug: string): boolean {
  return getCompanyProjectAccess(user, companySlug).companyAllowed;
}

/**
 * Check if user can access project within company
 * O par empresa+projeto é preservado; projetos de outra empresa nunca são
 * liberados por arrays achatados.
 */
export function canAccessProject(user: AuthUser | null, companySlug: string, projectId?: string | null): boolean {
  const access = getCompanyProjectAccess(user, companySlug);
  if (!access.companyAllowed) return false;
  if (!projectId) return true;
  return access.allProjects || access.projectIds.includes(projectId);
}

/**
 * Determine max sensitivity level user can access
 *
 * - Global admin: can access "sensitive"
 * - Company admin: can access "restricted"
 * - Leader TC: can access "restricted"
 * - Regular user: can access "internal"
 * - Viewer: can access "public" only
 */
export function getMaxSensitivityForUser(user: AuthUser | null): SensitivityLevel {
  if (!user) return "public";
  if (user.isGlobalAdmin) return "sensitive";

  if (hasAnyRole(user, ["admin", "global_admin", "company_admin", "empresa", "leader_tc", "technical_support"])) {
    return "restricted";
  }

  if (hasAnyRole(user, ["viewer", "read_only"])) {
    return "public";
  }

  if (hasAnyRole(user, ["support", "it_dev", "dev", "qa_tc", "testing_company_user", "company_user"])) {
    return "internal";
  }

  // Usuário autenticado e vinculado recebe, no máximo, dados internos.
  return "internal";
}

/**
 * Check if user can access asset with given sensitivity
 */
export function canAccessSensitivity(user: AuthUser | null, sensitivity: SensitivityLevel | string | null | undefined): boolean {
  if (!isSensitivityLevel(sensitivity)) return false;

  const maxSensitivity = getMaxSensitivityForUser(user);

  const maxIndex = SENSITIVITY_LEVELS.indexOf(maxSensitivity);
  const assetIndex = SENSITIVITY_LEVELS.indexOf(sensitivity);

  return assetIndex <= maxIndex;
}

/**
 * Check if user can create/modify asset in company
 */
export function canCreateAsset(user: AuthUser | null, companySlug: string): boolean {
  if (!user || !canAccessCompany(user, companySlug)) {
    return false;
  }

  // Only admin, company_admin, leader_tc, and technical_support can create assets
  return user.isGlobalAdmin || hasAnyRole(user, ["admin", "company_admin", "empresa", "leader_tc", "technical_support"]);
}

/**
 * Check if user can delete asset
 */
export function canDeleteAsset(user: AuthUser | null, companySlug: string, sensitivity: SensitivityLevel | string | null | undefined): boolean {
  if (!user || !canAccessCompany(user, companySlug)) {
    return false;
  }

  if (!isSensitivityLevel(sensitivity)) {
    return false;
  }

  // Only high-privilege users can delete sensitive assets
  if (sensitivity === "sensitive") {
    return user.isGlobalAdmin || hasAnyRole(user, ["admin", "company_admin", "empresa"]);
  }

  // Others need at least leader_tc or technical_support
  return user.isGlobalAdmin || hasAnyRole(user, ["admin", "company_admin", "empresa", "leader_tc", "technical_support"]);
}

/**
 * Check if user can view asset Base64 content
 * (More restrictive than reading metadata)
 */
export function canViewBase64(user: AuthUser | null, companySlug: string, sensitivity: SensitivityLevel | string | null | undefined): boolean {
  // User must have access to company
  if (!user || !canAccessCompany(user, companySlug)) {
    return false;
  }

  // User must have access to sensitivity level
  if (!canAccessSensitivity(user, sensitivity)) {
    return false;
  }

  // For "sensitive" assets, only global admin, admin, or company_admin
  if (sensitivity === "sensitive") {
    return user.isGlobalAdmin || hasAnyRole(user, ["admin", "company_admin", "empresa"]);
  }

  // For "restricted", exclude viewers
  if (sensitivity === "restricted") {
    return !hasAnyRole(user, ["viewer", "read_only"]);
  }

  return true;
}

/**
 * Check if user can link asset to test case
 */
export function canLinkAssetToCase(user: AuthUser | null, companySlug: string): boolean {
  if (!user || !canAccessCompany(user, companySlug)) {
    return false;
  }

  // Need at least QA lead or automation roles
  return user.isGlobalAdmin || hasAnyRole(user, ["admin", "company_admin", "empresa", "leader_tc", "technical_support", "it_dev", "dev", "qa_tc"]);
}

/**
 * Build permission error response
 */
export function permissionDenied(reason: PermissionDenialReason, details?: string): Error {
  const messages: Record<PermissionDenialReason, string> = {
    not_authenticated: "Usuário não autenticado",
    company_mismatch: "Sem acesso a essa empresa",
    project_mismatch: "Sem acesso a esse projeto",
    sensitivity_too_high: "Nível de sensibilidade restrito para seu perfil",
    insufficient_role: "Seu perfil não tem permissão para essa ação",
    asset_in_use: "Asset está em uso e não pode ser deletado. Archive ou substitua.",
    policy_violation: "Violação de política de uso do asset",
  };

  return new PermissionError(reason, details || messages[reason]);
}
