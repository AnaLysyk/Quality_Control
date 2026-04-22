import "server-only";

import {
  getLocalUserById,
  listLocalCompanies,
  listLocalLinksForUser,
  normalizeLocalRole,
} from "@/lib/auth/localStore";
import { resolveCapabilities } from "@/lib/permissions";
import { resolveVisibleCompanies, resolveCompanyVisibilityMode } from "@/lib/companyVisibility";

export type BuiltSessionPayload = {
  userId: string;
  email: string;
  name: string;
  companyId: string | null;
  companySlug: string | null;
  defaultCompanySlug: string | null;
  userOrigin: string | null;
  role: string;
  globalRole: "global_admin" | null;
  companyRole: string;
  capabilities: string[];
  isGlobalAdmin: boolean;
};

export type BuiltJwtPayload = {
  sub: string;
  email: string;
  role: string;
  globalRole: "global_admin" | null;
  companyRole: string;
  capabilities: string[];
  companyId: string | null;
  companySlug: string | null;
  defaultCompanySlug: string | null;
  userOrigin: string | null;
  isGlobalAdmin: boolean;
};

export type BuiltSession = {
  session: BuiltSessionPayload;
  jwt: BuiltJwtPayload;
  requestedCompanySlug: string | null;
};

export async function buildLocalSessionForUser(
  userId: string,
  opts?: { requestedSlug?: string | null },
): Promise<BuiltSession | null> {
  const user = await getLocalUserById(userId);
  if (!user || user.active === false || user.status === "blocked") return null;

  const [links, companies] = await Promise.all([
    listLocalLinksForUser(user.id),
    listLocalCompanies(),
  ]);

  const isGlobalAdmin = user.globalRole === "global_admin" || user.is_global_admin === true;
  const visibilityMode = resolveCompanyVisibilityMode(
    {
      role: user.role ?? null,
      companyRole: user.role ?? null,
      userOrigin: user.user_origin ?? null,
      isGlobalAdmin,
      default_company_slug: user.default_company_slug ?? null,
      defaultClientSlug: user.default_company_slug ?? null,
    },
    links,
  );
  const shouldBindCompanyContext = visibilityMode !== "all";
  const allowedCompanies = resolveVisibleCompanies(companies, {
    user: {
      role: user.role ?? null,
      companyRole: user.role ?? null,
      userOrigin: user.user_origin ?? null,
      isGlobalAdmin,
      default_company_slug: user.default_company_slug ?? null,
      defaultClientSlug: user.default_company_slug ?? null,
    },
    links,
    preferredSlug: opts?.requestedSlug ?? user.default_company_slug ?? null,
  });

  const requestedSlug = typeof opts?.requestedSlug === "string" ? opts.requestedSlug.trim() : "";
  const requestedCompany =
    shouldBindCompanyContext && requestedSlug && allowedCompanies.length
      ? allowedCompanies.find((company) => company.slug === requestedSlug) ?? null
      : null;

  const activeCompany =
    shouldBindCompanyContext
      ? requestedCompany ??
        allowedCompanies.find((company) => company.slug === user.default_company_slug) ??
        allowedCompanies[0] ??
        null
      : null;

  const activeLink = activeCompany ? links.find((link) => link.companyId === activeCompany.id) ?? null : null;
  const companyRole = normalizeLocalRole(activeLink?.role ?? user.role ?? null);

  const capabilities = resolveCapabilities({
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    membershipCapabilities: activeLink?.capabilities ?? null,
  });

  const effectiveRole = isGlobalAdmin ? "leader_tc" : companyRole;

  const displayName =
    (typeof user.full_name === "string" ? user.full_name.trim() : "") ||
    (typeof user.name === "string" ? user.name.trim() : "") ||
    user.email;

  const session: BuiltSessionPayload = {
    userId: user.id,
    email: user.email,
    name: displayName,
    companyId: shouldBindCompanyContext ? activeCompany?.id ?? null : null,
    companySlug: shouldBindCompanyContext ? activeCompany?.slug ?? null : null,
    defaultCompanySlug: user.default_company_slug ?? null,
    userOrigin: user.user_origin ?? null,
    role: effectiveRole,
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    capabilities,
    isGlobalAdmin,
  };

  const jwtPayload: BuiltJwtPayload = {
    sub: user.id,
    email: user.email,
    role: effectiveRole,
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    capabilities,
    companyId: shouldBindCompanyContext ? activeCompany?.id ?? null : null,
    companySlug: shouldBindCompanyContext ? activeCompany?.slug ?? null : null,
    defaultCompanySlug: user.default_company_slug ?? null,
    userOrigin: user.user_origin ?? null,
    isGlobalAdmin,
  };

  return {
    session,
    jwt: jwtPayload,
    requestedCompanySlug: requestedCompany?.slug ?? null,
  };
}
