import "server-only";

import type { AuthUser } from "@/lib/jwtAuth";

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

/**
 * Check if user can access company
 */
export function canAccessCompany(user: AuthUser | null, companySlug: string): boolean {
  if (!user) return false;
  if (user.isGlobalAdmin) return true;

  const companySlugs = Array.isArray(user.companySlugs) ? user.companySlugs : [user.companySlug].filter(Boolean);
  return companySlugs.includes(companySlug);
}

/**
 * Check if user can access project within company
 * (All users in company can currently access all projects; can be refined per-project)
 */
export function canAccessProject(user: AuthUser | null, companySlug: string, projectId?: string | null): boolean {
  if (!projectId) return true; // No project filter = company-level access
  return canAccessCompany(user, companySlug);
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

  const role = user.role || user.companyRole || user.globalRole || "";

  if (["admin", "company_admin", "leader_tc", "technical_support"].includes(role)) {
    return "restricted";
  }

  if (["support", "it_dev", "dev"].includes(role)) {
    return "internal";
  }

  // Default: public
  return "public";
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
  const role = user.role || user.companyRole || user.globalRole || "";
  return ["admin", "company_admin", "leader_tc", "technical_support"].includes(role) || user.isGlobalAdmin;
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
    return user.isGlobalAdmin || user.role === "admin" || user.companyRole === "company_admin";
  }

  // Others need at least leader_tc or technical_support
  const role = user.role || user.companyRole || user.globalRole || "";
  return ["admin", "company_admin", "leader_tc", "technical_support"].includes(role) || user.isGlobalAdmin;
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
    return user.isGlobalAdmin || user.role === "admin" || user.companyRole === "company_admin";
  }

  // For "restricted", exclude viewers
  if (sensitivity === "restricted") {
    const role = user.role || user.companyRole || user.globalRole || "";
    return role !== "viewer";
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
  const role = user.role || user.companyRole || user.globalRole || "";
  return ["admin", "company_admin", "leader_tc", "technical_support", "it_dev", "dev"].includes(role) || user.isGlobalAdmin;
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

