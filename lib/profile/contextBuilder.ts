/**
 * Profile Engine â€” construtor do contexto
 * Decide quais abas, campos, aÃ§Ãµes aparecem
 */

import type { AuthUser } from "@/lib/jwtAuth";
import type {
  EntityStatus,
  EntityType,
  ProfileMode,
  ProfilePermissions,
  ProfileRuntimeContext,
  ProfileScope,
  ProfileTab,
  RoleInCompany,
  UserRole,
} from "./types";

/**
 * Resolve permissÃµes do viewer sobre o target
 */
function resolvePermissions(input: {
  viewer: AuthUser;
  targetType: EntityType;
  targetId: string;
  mode: ProfileMode;
  targetRole?: UserRole | RoleInCompany;
  targetStatus?: EntityStatus;
  isSelf: boolean;
  isSameCompany: boolean;
}): ProfilePermissions {
  const isAdmin = input.viewer.isGlobalAdmin === true;
  const isLeader = input.viewer.role === "leader_tc";
  const isSupport = input.viewer.role === "technical_support";
  const isCompanyUser = input.viewer.role === "company_user";
  const isTCUser = input.viewer.role === "testing_company_user";

  // Base: permissÃ£o por modo
  if (input.mode === "self") {
    return {
      canView: true,
      canEdit: !input.targetStatus || input.targetStatus === "active",
      canDeactivate: false,
      canArchive: false,
      canDelete: false,
      canManagePermissions: false,
      canManageCompanyLinks: false,
      canManageApplications: false,
      canManageIntegrations: false,
      canManageUsers: false,
      canViewAudit: false,
      canImpersonatePreview: false,
      canBlockUnblock: false,
      canResetPassword: false,
      canResendInvite: false,
      canEditByField: {
        name: true,
        email: false,
        phone: true,
        avatar: true,
        role: false,
        companyLink: false,
        permission: false,
      },
    };
  }

  if (input.mode === "view") {
    return {
      canView: true,
      canEdit: false,
      canDeactivate: isAdmin || (isLeader && input.isSameCompany),
      canArchive: isAdmin || (isLeader && input.isSameCompany),
      canDelete: false,
      canManagePermissions: false,
      canManageCompanyLinks: false,
      canManageApplications: false,
      canManageIntegrations: false,
      canManageUsers: false,
      canViewAudit: isAdmin || isLeader || isSupport,
      canImpersonatePreview: isAdmin || isLeader,
      canBlockUnblock: isAdmin || isLeader || isSupport,
      canResetPassword: false,
      canResendInvite: isAdmin || isLeader || isSupport,
      canEditByField: {},
    };
  }

  // admin-edit e edit: modos de ediÃ§Ã£o
  const canEditProfile =
    isAdmin || (isLeader && input.isSameCompany && input.targetStatus !== "blocked") || (isSupport && input.isSameCompany);

  const canManageDeep = isAdmin || (isLeader && input.isSameCompany);

  return {
    canView: true,
    canEdit: canEditProfile,
    canDeactivate: canManageDeep,
    canArchive: canManageDeep,
    canDelete: isAdmin,
    canManagePermissions: canManageDeep,
    canManageCompanyLinks: canManageDeep || (isTCUser && input.isSelf),
    canManageApplications: canManageDeep,
    canManageIntegrations: canManageDeep,
    canManageUsers: canManageDeep || (isCompanyUser && input.isSelf),
    canViewAudit: canManageDeep || isSupport,
    canImpersonatePreview: canManageDeep,
    canBlockUnblock: canManageDeep || isSupport,
    canResetPassword: canManageDeep || isSupport,
    canResendInvite: canManageDeep || isSupport,
    canEditByField: {
      name: canEditProfile,
      email: canManageDeep,
      phone: canEditProfile,
      avatar: canEditProfile,
      role: canManageDeep,
      companyLink: canManageDeep,
      permission: canManageDeep,
      status: canManageDeep,
      integration: canManageDeep,
    },
  };
}

/**
 * Resolve quais abas aparecem
 */
function resolveTabs(input: {
  entityType: EntityType;
  mode: ProfileMode;
  permissions: ProfilePermissions;
  isSelf: boolean;
}): ProfileTab[] {
  const tabs: ProfileTab[] = [];

  if (input.entityType === "company") {
    tabs.push("overview", "profile");
    if (input.permissions.canView || input.mode === "create") tabs.push("applications");
    if (input.permissions.canManageUsers || !input.mode.includes("view")) tabs.push("users");
    if (input.permissions.canManageIntegrations) tabs.push("integrations");
    if (input.permissions.canManagePermissions) tabs.push("permissions");
    if (input.permissions.canViewAudit) tabs.push("audit");
  } else {
    tabs.push("overview", "profile");
    if (input.permissions.canView || input.mode === "create") tabs.push("access");
    if (input.permissions.canManageCompanyLinks || input.isSelf) tabs.push("companies");
    if (input.permissions.canManagePermissions) tabs.push("permissions");
    if (input.permissions.canView) tabs.push("security");
    if (input.permissions.canViewAudit) tabs.push("audit");
  }

  return tabs;
}

/**
 * Resolve escopo do viewer
 */
function resolveScope(input: {
  viewer: AuthUser;
  targetType: EntityType;
  isSelf: boolean;
}): ProfileScope {
  const isAdmin = input.viewer.isGlobalAdmin === true;
  const viewerCompanyIds = input.viewer.companySlugs || [];

  return {
    allowedCompanyIds: isAdmin ? [] : viewerCompanyIds,
    allowedApplicationIds: [],
    allowedModuleIds: [],
    isSelfProfile: input.isSelf,
    isSameCompany: input.isSelf || isAdmin,
  };
}

/**
 * Build do contexto completo
 */
export function buildProfileRuntimeContext(input: {
  viewer: AuthUser;
  entityType: EntityType;
  entityId: string;
  mode: ProfileMode;
  targetRole?: UserRole | RoleInCompany;
  targetStatus?: EntityStatus;
  isSelf?: boolean;
  isSameCompany?: boolean;
}): ProfileRuntimeContext {
  const isSelf = input.isSelf ?? false;
  const isSameCompany = input.isSameCompany ?? false;

  const permissions = resolvePermissions({
    viewer: input.viewer,
    targetType: input.entityType,
    targetId: input.entityId,
    mode: input.mode,
    targetRole: input.targetRole,
    targetStatus: input.targetStatus,
    isSelf,
    isSameCompany,
  });

  const tabs = resolveTabs({
    entityType: input.entityType,
    mode: input.mode,
    permissions,
    isSelf,
  });

  const scope = resolveScope({
    viewer: input.viewer,
    targetType: input.entityType,
    isSelf,
  });

  return {
    entityType: input.entityType,
    entityId: input.entityId,
    mode: input.mode,
    viewer: {
      id: input.viewer.id,
      role: (input.viewer.role as UserRole) || "company_user",
      companyIds: input.viewer.companySlugs || [],
      companyId: input.viewer.companySlug,
    },
    target: input.isSelf
      ? undefined
      : {
          id: input.entityId,
          type: input.entityType,
          role: input.targetRole,
          status: input.targetStatus,
        },
    permissions,
    scope,
    visibleTabs: tabs,
    primaryAction:
      input.mode === "create"
        ? "create"
        : input.mode === "self"
          ? "edit"
          : input.mode === "admin-edit"
            ? "edit"
            : "view",
    showDangerZone: permissions.canDelete || permissions.canDeactivate,
    isDraft: input.mode === "create",
    canCompare: input.mode === "admin-edit" && permissions.canEdit,
  };
}

