import { getLocalUserById, listLocalCompanies, listLocalLinksForUser, normalizeLocalRole } from "@/lib/auth/localStore";
import { resolveCapabilities } from "@/lib/permissions";

type SessionPayload = {
  userId: string;
  email: string;
  name?: string;
  role?: string | null;
  globalRole?: string | null;
  companyRole?: string | null;
  capabilities?: string[];
  companyId?: string | null;
  companySlug?: string | null;
  isGlobalAdmin?: boolean;
};

type BuildSessionResult = {
  session: SessionPayload;
  jwt: Record<string, unknown>;
  requestedCompanySlug?: string | null;
};

type BuildSessionOptions = {
  requestedSlug?: string | null;
};

export async function buildLocalSessionForUser(
  userId: string,
  opts: BuildSessionOptions = {},
): Promise<BuildSessionResult | null> {
  const user = await getLocalUserById(userId);
  if (!user || user.active === false || user.status === "blocked") return null;

  const [links, companies] = await Promise.all([listLocalLinksForUser(user.id), listLocalCompanies()]);
  const isGlobalAdmin = user.globalRole === "global_admin" || user.is_global_admin === true;
  const allowedCompanies = isGlobalAdmin
    ? companies
    : companies.filter((company) => links.some((link) => link.companyId === company.id));

  const requestedSlug = typeof opts.requestedSlug === "string" ? opts.requestedSlug.trim() : "";
  const requestedCompany =
    requestedSlug && allowedCompanies.length
      ? allowedCompanies.find((company) => company.slug === requestedSlug) ?? null
      : null;
  const activeCompany =
    requestedCompany ??
    allowedCompanies.find((company) => company.slug === user.default_company_slug) ??
    allowedCompanies[0] ??
    null;
  const activeLink = activeCompany ? links.find((link) => link.companyId === activeCompany.id) ?? null : null;
  const normalizedRole = normalizeLocalRole(activeLink?.role ?? user.role ?? null);
  const companyRole = normalizedRole ?? "user";
  const capabilities = resolveCapabilities({
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole: companyRole === "company_admin" ? "company_admin" : companyRole === "viewer" ? "viewer" : "user",
    membershipCapabilities: activeLink?.capabilities ?? null,
  });
  const effectiveRole = isGlobalAdmin ? "admin" : companyRole === "company_admin" ? "company" : "user";

  const session: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    companyId: activeCompany?.id ?? null,
    companySlug: activeCompany?.slug ?? null,
    role: effectiveRole,
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    capabilities,
    isGlobalAdmin,
  };

  const jwtPayload = {
    sub: user.id,
    userId: user.id,
    email: user.email,
    role: effectiveRole,
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    capabilities,
    companyId: activeCompany?.id ?? null,
    companySlug: activeCompany?.slug ?? null,
    isGlobalAdmin,
  };

  return {
    session,
    jwt: jwtPayload,
    requestedCompanySlug: requestedCompany?.slug ?? null,
  };
}
