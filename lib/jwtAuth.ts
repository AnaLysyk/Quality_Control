import "server-only";

import { getAccessContext } from "@/lib/auth/session";
import { findUserByEmailOrId } from "@/lib/simpleAuth";
import { listLocalCompanies, listLocalLinksForUser, normalizeLocalRole, toLegacyRole } from "@/lib/auth/localStore";
import { resolveCapabilities } from "@/lib/permissions";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";
import { resolveVisibleCompanies } from "@/lib/companyVisibility";
import type { PermissionMatrix } from "@/lib/permissionMatrix";

export type AuthUser = {
  id: string;
  email: string;
  user?: string | null;
  isGlobalAdmin: boolean;
  role?: string | null;
  globalRole?: string | null;
  companyRole?: string | null;
  capabilities?: string[];
  companyId?: string | null;
  companySlug?: string | null;
  companySlugs?: string[];
  permissions?: PermissionMatrix;
  permissionRole?: string | null;
};

export async function authenticateRequest(req: Request): Promise<AuthUser | null> {
  const access = await getAccessContext(req);
  if (access) {
    const permissionAccess = await resolvePermissionAccessForUser(access.userId);
    return {
      id: access.userId,
      email: access.email,
      user: access.user ?? null,
      isGlobalAdmin: access.isGlobalAdmin,
      role: access.role,
      globalRole: access.globalRole ?? null,
      companyRole: access.companyRole ?? null,
      capabilities: access.capabilities ?? [],
      companyId: access.companyId,
      companySlug: access.companySlug,
      companySlugs: access.companySlugs,
      permissions: permissionAccess.permissions,
      permissionRole: permissionAccess.roleKey,
    };
  }

  const headerAuth = req.headers.get("authorization");
  let identifier: string | null = null;
  if (headerAuth?.toLowerCase().startsWith("bearer ")) {
    identifier = headerAuth.slice("bearer ".length).trim();
  }
  if (!identifier) {
    const url = new URL(req.url);
    identifier = url.searchParams.get("user");
  }
  if (!identifier) return null;

  const user = await findUserByEmailOrId(identifier);
  if (!user) return null;

  const [links, companies] = await Promise.all([listLocalLinksForUser(user.id), listLocalCompanies()]);
  const isGlobalAdmin =
    (user as { is_global_admin?: boolean; globalRole?: string | null }).is_global_admin === true ||
    (user as { globalRole?: string | null }).globalRole === "global_admin";
  const allowedCompanies = resolveVisibleCompanies(companies, {
    user: {
      role: (user as { role?: string | null }).role ?? null,
      companyRole: (user as { role?: string | null }).role ?? null,
      userOrigin: (user as { user_origin?: string | null }).user_origin ?? null,
      isGlobalAdmin,
      default_company_slug: (user as { default_company_slug?: string | null }).default_company_slug ?? null,
      defaultClientSlug: (user as { default_company_slug?: string | null }).default_company_slug ?? null,
    },
    links,
    preferredSlug: (user as { default_company_slug?: string | null }).default_company_slug ?? null,
  });
  const shouldBindCompanyContext = !isGlobalAdmin && allowedCompanies.length > 0;
  const primary = shouldBindCompanyContext ? allowedCompanies[0] ?? null : null;
  const companySlugs = allowedCompanies
    .map((company) => company.slug)
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
  const primaryLink = primary ? links.find((link) => link.companyId === primary.id) ?? null : null;
  const rawRole = primaryLink?.role ?? (user as { role?: string | null }).role ?? null;
  const normalizedRole = normalizeLocalRole(rawRole);
  const companyRole = normalizedRole;
  const effectiveRole = toLegacyRole(companyRole, isGlobalAdmin);
  const capabilities = resolveCapabilities({
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    membershipCapabilities: primaryLink?.capabilities ?? null,
  });
  const permissionAccess = await resolvePermissionAccessForUser(user.id);

  return {
    id: user.id,
    email: user.email,
    isGlobalAdmin,
    role: effectiveRole,
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    capabilities,
    companyId: shouldBindCompanyContext ? primary?.id ?? null : null,
    companySlug: shouldBindCompanyContext ? primary?.slug ?? null : null,
    companySlugs,
    permissions: permissionAccess.permissions,
    permissionRole: permissionAccess.roleKey,
  };
}
