"use client";

/**
 * Hooks para usar Profile Engine no lado client
 */

import { createContext, ReactNode, useContext, useMemo } from "react";
import type { ProfileRuntimeContext } from "./types";

const ProfileContext = createContext<ProfileRuntimeContext | null>(null);

export function ProfileProvider({
  context,
  children,
}: {
  context: ProfileRuntimeContext;
  children: ReactNode;
}) {
  const value = useMemo(() => context, [context]);

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

/**
 * Hook para acessar contexto
 */
export function useProfileContext(): ProfileRuntimeContext {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfileContext deve ser usado dentro de ProfileProvider");
  }
  return context;
}

/**
 * Hook para verificar se ação é permitida
 */
export function useProfileAction(
  action:
    | "view"
    | "edit"
    | "delete"
    | "deactivate"
    | "archive"
    | "manage_users"
    | "manage_permissions"
    | "manage_links"
    | "manage_integrations"
    | "view_audit"
    | "impersonate"
    | "block"
    | "reset_password"
    | "resend_invite",
): boolean {
  const context = useProfileContext();
  const { permissions } = context;

  switch (action) {
    case "view":
      return permissions.canView;
    case "edit":
      return permissions.canEdit;
    case "delete":
      return permissions.canDelete;
    case "deactivate":
      return permissions.canDeactivate;
    case "archive":
      return permissions.canArchive;
    case "manage_users":
      return permissions.canManageUsers;
    case "manage_permissions":
      return permissions.canManagePermissions;
    case "manage_links":
      return permissions.canManageCompanyLinks;
    case "manage_integrations":
      return permissions.canManageIntegrations;
    case "view_audit":
      return permissions.canViewAudit;
    case "impersonate":
      return permissions.canImpersonatePreview;
    case "block":
      return permissions.canBlockUnblock;
    case "reset_password":
      return permissions.canResetPassword;
    case "resend_invite":
      return permissions.canResendInvite;
    default:
      return false;
  }
}

/**
 * Hook para filtrar abas visíveis
 */
export function useProfileTabs() {
  const context = useProfileContext();
  return context.visibleTabs;
}

/**
 * Hook para saber se zona de perigo aparece
 */
export function useDangerZone() {
  const context = useProfileContext();
  return context.showDangerZone;
}

/**
 * Hook para saber modo atual
 */
export function useProfileMode() {
  const context = useProfileContext();
  return context.mode;
}
