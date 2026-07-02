import { canDeleteUserByProfile, canManageInstitutionalProfiles } from "@/lib/adminUserDeleteAccess";
import { SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import type { LocalAuthCompany, LocalAuthUser } from "@/lib/auth/localStore";
import type { AuthUser } from "@/lib/jwtAuth";
import { normalizeLocalRole } from "@/lib/auth/localStore";

export type ProfileMode = "view" | "edit" | "create" | "self" | "admin-edit";
export type ProfileType = "company" | "user";

export type ProfilePermissions = {
  canEdit: boolean;
  canDelete: boolean;
  canDeactivate: boolean;
  canChangeRole: boolean;
  canManageCompanyLinks: boolean;
};

export type ProfileContext = {
  profileType: ProfileType;
  mode: ProfileMode;
  viewerRole: string | null;
  targetId: string;
  permissions: ProfilePermissions;
};

function isGlobalViewer(viewer: Pick<AuthUser, "isGlobalAdmin" | "role" | "companyRole"> | null | undefined) {
  if (!viewer) return false;
  if (viewer.isGlobalAdmin) return true;
  const role = normalizeLocalRole(viewer.role ?? null);
  const companyRole = normalizeLocalRole(viewer.companyRole ?? null);
  return role === SYSTEM_ROLES.LEADER_TC || companyRole === SYSTEM_ROLES.LEADER_TC;
}

function toAccessRole(viewer: Pick<AuthUser, "role" | "companyRole"> | null | undefined) {
  return {
    role: viewer?.role ?? null,
    companyRole: viewer?.companyRole ?? null,
  };
}

function viewerCanManageInstitutional(viewer: Pick<AuthUser, "role" | "companyRole"> | null | undefined) {
  return canManageInstitutionalProfiles(toAccessRole(viewer));
}

function normalizeViewerRole(viewer: Pick<AuthUser, "role" | "companyRole" | "isGlobalAdmin"> | null | undefined) {
  if (!viewer) return null;
  if (viewer.isGlobalAdmin) return SYSTEM_ROLES.LEADER_TC;
  return normalizeLocalRole(viewer.companyRole ?? viewer.role ?? null);
}

export function resolveCompanyProfilePermissions(
  viewer: Pick<AuthUser, "id" | "role" | "companyRole" | "companyId" | "companySlug" | "companySlugs" | "isGlobalAdmin"> | null | undefined,
  company: Pick<LocalAuthCompany, "id" | "slug" | "active">,
  mode: ProfileMode,
): ProfilePermissions {
  const institutional = viewerCanManageInstitutional(viewer);
  const sameCompany =
    viewer?.companyId === company.id ||
    (viewer?.companySlug ?? "").trim().toLowerCase() === (company.slug ?? "").trim().toLowerCase() ||
    (viewer?.companySlugs ?? []).some((slug) => (slug ?? "").trim().toLowerCase() === (company.slug ?? "").trim().toLowerCase());

  const canEdit = institutional || sameCompany || mode === "self" || mode === "edit";
  return {
    canEdit,
    canDelete: isGlobalViewer(viewer),
    canDeactivate: institutional || isGlobalViewer(viewer),
    canChangeRole: institutional || isGlobalViewer(viewer),
    canManageCompanyLinks: institutional || isGlobalViewer(viewer),
  };
}

export function resolveUserProfilePermissions(
  viewer: Pick<AuthUser, "id" | "role" | "companyRole" | "companyId" | "companySlug" | "companySlugs" | "isGlobalAdmin"> | null | undefined,
  target: Pick<LocalAuthUser, "id" | "role" | "user_origin" | "user_scope" | "allow_multi_company_link" | "created_by_company_id" | "home_company_id">,
  targetCompanyIds: string[],
  mode: ProfileMode,
): ProfilePermissions {
  const institutional = viewerCanManageInstitutional(viewer);
  const isSelf = viewer?.id === target.id;
  const sameCompany = targetCompanyIds.some((companyId) => companyId === viewer?.companyId);
  const targetRole = normalizeLocalRole(target.role ?? null);
  const canReviewTarget = canDeleteUserByProfile(toAccessRole(viewer), target.role ?? null) || institutional;

  return {
    canEdit: institutional || isSelf || sameCompany || mode === "self" || mode === "edit",
    canDelete: canReviewTarget && !isSelf,
    canDeactivate: institutional || canReviewTarget,
    canChangeRole: institutional || (!isSelf && sameCompany && targetRole !== SYSTEM_ROLES.LEADER_TC),
    canManageCompanyLinks: institutional || (!isSelf && sameCompany),
  };
}

export function buildProfileContext(params: {
  profileType: ProfileType;
  targetId: string;
  mode: ProfileMode;
  viewer: Pick<AuthUser, "id" | "role" | "companyRole" | "companyId" | "companySlug" | "companySlugs" | "isGlobalAdmin"> | null | undefined;
  permissions: ProfilePermissions;
}): ProfileContext {
  return {
    profileType: params.profileType,
    mode: params.mode,
    viewerRole: normalizeViewerRole(params.viewer),
    targetId: params.targetId,
    permissions: params.permissions,
  };
}

