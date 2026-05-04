import type { AccessContext } from "@/lib/auth/session";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function isInternalWikiManager(access: AccessContext | null) {
  if (!access) return false;
  if (access.isGlobalAdmin) return true;

  const role = normalize(access.role);
  const globalRole = normalize(access.globalRole);
  return role === "leader_tc" || role === "technical_support" || globalRole === "leader_tc" || globalRole === "technical_support";
}

function hasCompanyWikiScope(access: AccessContext | null, companySlug: string) {
  if (!access) return false;

  const targetSlug = normalize(companySlug);
  if (!targetSlug) return false;

  if (isInternalWikiManager(access)) return true;
  if (normalize(access.companySlug) === targetSlug) return true;

  return access.companySlugs.some((slug) => normalize(slug) === targetSlug);
}

export function canReadCompanyWiki(access: AccessContext | null, companySlug: string) {
  return hasCompanyWikiScope(access, companySlug);
}

function isCompanyWikiEditor(access: AccessContext | null) {
  if (!access) return false;
  if (isInternalWikiManager(access)) return true;

  const companyRole = normalizeLegacyRole(access.companyRole ?? null);
  const role = normalizeLegacyRole(access.role ?? null);

  return (
    companyRole === SYSTEM_ROLES.EMPRESA ||
    companyRole === SYSTEM_ROLES.COMPANY_USER ||
    role === SYSTEM_ROLES.EMPRESA ||
    role === SYSTEM_ROLES.COMPANY_USER ||
    normalize(access.userOrigin) === "client_company"
  );
}

export function canEditCompanyWiki(access: AccessContext | null, companySlug: string) {
  return isCompanyWikiEditor(access) && hasCompanyWikiScope(access, companySlug);
}
