"use client";

import { useMemo } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { normalizeAuthenticatedUser, type NormalizedAuthenticatedUser } from "@/lib/auth/normalizeAuthenticatedUser";
import {
  getTicketViewScope,
  getUsersViewScope,
  hasPermissionAccess,
  normalizePermissionMatrix,
  toVisibilityMap,
} from "@/lib/permissionMatrix";

export function usePermissionAccess() {
  const { user, companies, loading } = useAuthUser();
  const normalizedUser: NormalizedAuthenticatedUser = useMemo(
    () => normalizeAuthenticatedUser(user, companies),
    [user, companies],
  );

  const permissions = useMemo(
    () => normalizePermissionMatrix(user?.permissions),
    [user?.permissions],
  );

  const visibility = useMemo(() => toVisibilityMap(permissions), [permissions]);

  return {
    user,
    companies,
    normalizedUser,
    loading,
    permissions,
    visibility,
    can: (moduleId: string, action: string) => hasPermissionAccess(permissions, moduleId, action),
    ticketScope: getTicketViewScope(permissions),
    usersScope: getUsersViewScope(permissions),
  };
}
