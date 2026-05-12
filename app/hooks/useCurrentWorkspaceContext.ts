"use client";

import { useClientContext, type ClientAccess } from "@/lib/core/company/CompanyContext";
import { useProjectContext, type ProjectRecord } from "@/lib/core/project/ProjectContext";

/**
 * Permission strings used by PermissionGate and `can()`.
 * Format: <module>:<action>
 */
export type Permission =
  | "test_repository:read"
  | "test_repository:create"
  | "test_repository:update"
  | "test_repository:delete"
  | "test_repository:import"
  | "test_plan:read"
  | "test_plan:create"
  | "test_plan:update"
  | "test_plan:delete"
  | "test_run:read"
  | "test_run:create"
  | "test_run:update"
  | "test_run:delete"
  | "playwright:execute"
  | "playwright:read"
  | "admin:access"
  | "admin:users"
  | "admin:clients"
  | "admin:audit_logs";

export type CurrentWorkspaceContextValue = {
  /** Active company (null while loading or when user has no companies). */
  currentCompany: ClientAccess | null;
  /** Active project (null when no project selected). */
  currentProject: ProjectRecord | null;

  /** All companies the user has access to. */
  availableCompanies: ClientAccess[];
  /** All projects for the active company. */
  availableProjects: ProjectRecord[];

  /** Effective permissions based on the user's role in the current company. */
  permissions: Permission[];

  /** Whether the user has the given permission. */
  can: (permission: Permission) => boolean;

  /** Switch active company. */
  setCompany: (slugOrId: string | null) => void;
  /** Switch active project. */
  setProject: (slugOrId: string | null) => void;

  /** Loading indicators. */
  isLoadingProjects: boolean;
  projectError: string | null;
};

/** Permissions granted to any authenticated user (regardless of role). */
const BASE_PERMISSIONS: Permission[] = [
  "test_repository:read",
  "test_plan:read",
  "test_run:read",
  "playwright:read",
];

/** Additional permissions granted to ADMIN role. */
const ADMIN_PERMISSIONS: Permission[] = [
  "test_repository:create",
  "test_repository:update",
  "test_repository:delete",
  "test_repository:import",
  "test_plan:create",
  "test_plan:update",
  "test_plan:delete",
  "test_run:create",
  "test_run:update",
  "test_run:delete",
  "playwright:execute",
  "admin:access",
  "admin:users",
  "admin:clients",
  "admin:audit_logs",
];

/** Permissions granted to USER role (beyond base). */
const USER_PERMISSIONS: Permission[] = [
  "test_repository:create",
  "test_repository:update",
  "test_plan:create",
  "test_plan:update",
  "test_run:create",
  "test_run:update",
  "playwright:execute",
];

function resolvePermissions(role: ClientAccess["role"] | undefined): Permission[] {
  if (role === "ADMIN") return [...BASE_PERMISSIONS, ...ADMIN_PERMISSIONS];
  if (role === "USER") return [...BASE_PERMISSIONS, ...USER_PERMISSIONS];
  return BASE_PERMISSIONS;
}

/**
 * Central workspace context hook.
 * Combines company + project + derived permissions.
 *
 * Usage:
 * ```tsx
 * const { currentCompany, currentProject, can, setProject } = useCurrentWorkspaceContext();
 * ```
 */
export function useCurrentWorkspaceContext(): CurrentWorkspaceContextValue {
  const company = useClientContext();
  const project = useProjectContext();

  const permissions = resolvePermissions(company.activeClient?.role);
  const permissionSet = new Set<Permission>(permissions);

  return {
    currentCompany: company.activeClient,
    currentProject: project.activeProject,
    availableCompanies: company.clients,
    availableProjects: project.projects,
    permissions,
    can: (p: Permission) => permissionSet.has(p),
    setCompany: company.setActiveClientSlug,
    setProject: project.setActiveProject,
    isLoadingProjects: project.loading,
    projectError: project.error,
  };
}
