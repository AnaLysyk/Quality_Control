import "server-only";

import type { AuthUser } from "@/lib/jwtAuth";
import { getCompanyDefects, type CompanyDefectRecord } from "@/lib/companyDefects";
import { getLocalUserById } from "@/lib/auth/localStore";
import { resolveLocalUserDisplayName } from "@/lib/manualReleaseResponsible";

export function hasGlobalCompanyVisibility(user: AuthUser | null | undefined) {
  if (!user) return false;
  if (user.isGlobalAdmin) return true;
  const roles = [user.role, user.companyRole, user.permissionRole]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase());
  return roles.includes("leader_tc") || roles.includes("technical_support");
}

export function resolveAllowedCompanySlugs(user: AuthUser) {
  if (Array.isArray(user.companySlugs) && user.companySlugs.length) return user.companySlugs;
  if (user.companySlug) return [user.companySlug];
  return [];
}

export function canAccessCompanyDefects(user: AuthUser, companySlug: string) {
  if (!companySlug) return false;
  if (hasGlobalCompanyVisibility(user)) return true;
  return resolveAllowedCompanySlugs(user).includes(companySlug);
}

export async function resolveDefectActor(user: AuthUser | null) {
  if (!user) return { actorId: null, actorName: null };
  const localUser = await getLocalUserById(user.id);
  return {
    actorId: user.id,
    actorName: resolveLocalUserDisplayName(localUser, user.email),
  };
}

export async function resolveAccessibleCompanyDefect(companySlug: string, defectSlug: string) {
  if (!companySlug || !defectSlug) return null;
  const payload = await getCompanyDefects(companySlug);
  return payload.items.find((item) => item.slug === defectSlug) ?? null;
}

export function pickDefectNotificationShape(defect: CompanyDefectRecord) {
  return {
    slug: defect.slug,
    title: defect.title,
    name: defect.name,
    createdByUserId: defect.createdByUserId,
    assignedToUserId: defect.assignedToUserId,
  };
}
