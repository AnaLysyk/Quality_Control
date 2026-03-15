"use client";

import { useMemo } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  getTicketViewScope,
  getUsersViewScope,
  hasPermissionAccess,
  normalizePermissionMatrix,
  toVisibilityMap,
} from "@/lib/permissionMatrix";

export function usePermissionAccess() {
  const { user, loading } = useAuthUser();

  const permissions = useMemo(
    () => normalizePermissionMatrix(user?.permissions),
    [user?.permissions],
  );

  const visibility = useMemo(() => toVisibilityMap(permissions), [permissions]);

  return {
    user,
    loading,
    permissions,
    visibility,
    can: (moduleId: string, action: string) => hasPermissionAccess(permissions, moduleId, action),
    ticketScope: getTicketViewScope(permissions),
    usersScope: getUsersViewScope(permissions),
  };
}
