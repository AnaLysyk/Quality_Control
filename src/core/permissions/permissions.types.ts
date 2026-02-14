/**
 * Types for user roles, company roles, global roles, capabilities, and permissions.
 * Used for access control, RBAC, and feature gating throughout the app.
 */
export type UserRole = "user" | "admin" | "super-admin";
/**
 * Roles a user can have within a company.
 */
export type CompanyRole = "company_admin" | "it_dev" | "user" | "viewer";
/**
 * Special global role for superusers.
 */
export type GlobalRole = "global_admin";
/**
 * Fine-grained capabilities for RBAC and feature checks.
 * '*' means full access.
 */
export type Capability =
  | "company:read"
  | "company:write"
  | "user:read"
  | "user:write"
  | "metrics:read"
  | "metrics:write"
  | "release:read"
  | "release:write"
  | "run:read"
  | "run:write"
  | "defect:read"
  | "defect:write"
  | "*";

/**
 * Coarse permissions for UI and feature gating.
 */
export type Permission =
  | "read_dashboard"
  | "manage_users"
  | "manage_companies"
  | "manage_releases"
  | "manage_tests"
  | "view_admin"
  | "manage_settings";
