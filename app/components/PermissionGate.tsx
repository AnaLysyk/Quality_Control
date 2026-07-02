"use client";

import type { ReactNode } from "react";
import { useCurrentWorkspaceContext, type Permission } from "@/hooks/useCurrentWorkspaceContext";

type PermissionGateProps = {
  /** Required permission(s). If multiple, ALL must be satisfied unless `mode="any"`. */
  require: Permission | Permission[];
  /** "all" (default) = every permission required; "any" = at least one required. */
  mode?: "all" | "any";
  /** Content to render when permission is granted. */
  children: ReactNode;
  /** Optional fallback when permission is denied. Renders nothing by default. */
  fallback?: ReactNode;
};

/**
 * Conditionally renders children based on the current user's permissions.
 *
 * Usage:
 * ```tsx
 * <PermissionGate require="test_run:create">
 *   <button>Criar Run</button>
 * </PermissionGate>
 * ```
 */
export function PermissionGate({ require, mode = "all", children, fallback = null }: PermissionGateProps) {
  const { can } = useCurrentWorkspaceContext();

  const perms = Array.isArray(require) ? require : [require];
  const allowed =
    mode === "any" ? perms.some((p) => can(p)) : perms.every((p) => can(p));

  return allowed ? <>{children}</> : <>{fallback}</>;
}

