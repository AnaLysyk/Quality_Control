import "server-only";

import {
  getLocalUserById,
  listLocalCompanies,
  listLocalLinksForUser,
  normalizeLocalRole,
} from "@/lib/auth/localStore";
import { resolveCapabilities } from "@/lib/permissions";

export type BuiltSessionPayload = {
  userId: string;
  email: string;
  name: string;
  companyId: string | null;
  companySlug: string | null;
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
  const hasDevRole =
    normalizeLocalRole(user.role ?? null) === "it_dev" ||
    links.some((link) => normalizeLocalRole(link.role ?? null) === "it_dev");
  const hasFullCompanyAccess = isGlobalAdmin || hasDevRole;
  const shouldBindCompanyContext = !hasFullCompanyAccess;
  const allowedCompanies = hasFullCompanyAccess
    ? companies
    : companies.filter((company) => links.some((link) => link.companyId === company.id));

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
  const normalizedRole = normalizeLocalRole(activeLink?.role ?? user.role ?? null);
  const companyRole = normalizedRole ?? "user";

  const capabilities = resolveCapabilities({
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole:
      companyRole === "company_admin"
        ? "company_admin"
        : companyRole === "it_dev"
          ? "it_dev"
          : companyRole === "viewer"
            ? "viewer"
            : "user",
    membershipCapabilities: activeLink?.capabilities ?? null,
  });

  const effectiveRole =
    companyRole === "it_dev"
      ? "it_dev"
      : isGlobalAdmin
        ? "admin"
        : companyRole === "company_admin"
          ? "company"
          : "user";

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
    isGlobalAdmin,
  };

  return {
    session,
    jwt: jwtPayload,
    requestedCompanySlug: requestedCompany?.slug ?? null,
  };
}
