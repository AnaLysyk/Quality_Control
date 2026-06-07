"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { normalizeAuthenticatedUser, type NormalizedAuthenticatedUser } from "@/lib/auth/normalizeAuthenticatedUser";
import {
  getTicketViewScope,
  getUsersViewScope,
  toVisibilityMap,
  type PermissionMatrix,
} from "@/lib/permissionMatrix";
import { canAccess } from "@/lib/permissions/can-access";
import { getUserAccessContext } from "@/lib/permissions/get-user-access-context";

const subscribeToHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerHydrationSnapshot = () => false;
const EMPTY_PERMISSION_MATRIX: PermissionMatrix = {};

export function usePermissionAccess() {
  const { user, companies, loading, refreshUser } = useAuthUser();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydrationSnapshot,
  );
  const normalizedUser: NormalizedAuthenticatedUser = useMemo(
    () => normalizeAuthenticatedUser(user, companies),
    [user, companies],
  );

  const accessContext = useMemo(
    () => getUserAccessContext(user, companies),
    [companies, user],
  );
  const permissions = accessContext?.permissions ?? EMPTY_PERMISSION_MATRIX;

  const visibility = useMemo(() => toVisibilityMap(permissions), [permissions]);

  return {
    user,
    companies,
    normalizedUser,
    loading: loading || !hydrated,
    refreshUser,
    accessContext,
    permissions,
    visibility,
    can: (moduleId: string, action: string) =>
      canAccess(accessContext, { moduleId, action }),
    ticketScope: getTicketViewScope(permissions),
    usersScope: getUsersViewScope(permissions),
  };
}
