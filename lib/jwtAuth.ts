import "server-only";

import { getAccessContext } from "@/lib/auth/session";
import { findUserByEmailOrId } from "@/lib/simpleAuth";
import { listLocalCompanies, listLocalLinksForUser, normalizeLocalRole, toLegacyRole } from "@/lib/auth/localStore";
import { hasForcedGlobalAccessForUser } from "@/lib/auth/specialAccess";
import { resolveCapabilities } from "@/lib/permissions";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";
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
  // null/undefined = sem restrição de projeto; array = restrito a esses projectIds.
  allowedProjectIds?: string[] | null;
  permissions?: PermissionMatrix;
  permissionRole?: string | null;
};

type LocalJwtUser = NonNullable<Awaited<ReturnType<typeof findUserByEmailOrId>>>;
type LocalJwtLink = Awaited<ReturnType<typeof listLocalLinksForUser>>[number];
type LocalJwtCompany = Awaited<ReturnType<typeof listLocalCompanies>>[number];
type PlaywrightDecodedAuth = {
  id?: string;
  email?: string;
  role?: string;
  permissionRole?: string;
  companyRole?: string;
  companySlug?: string;
  companySlugs?: string[];
  isGlobalAdmin?: boolean;
};

function readE2eAuthCookie(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("e2e_auth="));
}

function normalizeDecodedCompanySlugs(decoded: PlaywrightDecodedAuth) {
  if (Array.isArray(decoded.companySlugs)) {
    return decoded.companySlugs.filter(
      (slug): slug is string => typeof slug === "string" && slug.trim().length > 0,
    );
  }
  return decoded.companySlug ? [decoded.companySlug] : [];
}

function buildPlaywrightAuthUser(decoded: PlaywrightDecodedAuth): AuthUser {
  return {
    id: decoded.id ?? "e2e-mock-user",
    email: decoded.email ?? "e2e@testingcompany.local",
    user: decoded.email ?? null,
    isGlobalAdmin: decoded.isGlobalAdmin === true,
    role: decoded.role ?? decoded.permissionRole ?? null,
    globalRole: decoded.isGlobalAdmin === true ? "global_admin" : null,
    companyRole: decoded.companyRole ?? decoded.role ?? null,
    capabilities: [],
    companyId: decoded.companySlug ?? null,
    companySlug: decoded.companySlug ?? null,
    companySlugs: normalizeDecodedCompanySlugs(decoded),
    permissions: {},
    permissionRole: decoded.permissionRole ?? decoded.role ?? null,
  };
}

function parsePlaywrightAuthUser(req: Request): AuthUser | null {
  if (process.env.PLAYWRIGHT_MOCK !== "true") return null;

  const rawCookie = readE2eAuthCookie(req);
  if (!rawCookie) return null;

  try {
    const encoded = rawCookie.slice("e2e_auth=".length);
    const decoded = JSON.parse(
      Buffer.from(decodeURIComponent(encoded), "base64url").toString("utf8"),
    ) as PlaywrightDecodedAuth;
    return buildPlaywrightAuthUser(decoded);
  } catch {
    return null;
  }
}

async function resolveAccessContextAuthUser(req: Request): Promise<AuthUser | null> {
  const access = await getAccessContext(req);
  if (!access) return null;

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
    allowedProjectIds: access.allowedProjectIds,
    permissions: permissionAccess.permissions,
    permissionRole: permissionAccess.roleKey,
  };
}

function resolveRequestIdentifier(req: Request) {
  const headerAuth = req.headers.get("authorization");
  if (headerAuth?.toLowerCase().startsWith("bearer ")) {
    return headerAuth.slice("bearer ".length).trim();
  }

  const url = new URL(req.url);
  return url.searchParams.get("user");
}

function localUserHasRole(user: LocalJwtUser, links: LocalJwtLink[], expectedRole: string) {
  return (
    normalizeLocalRole((user as { role?: string | null }).role ?? null) === expectedRole ||
    links.some((link) => normalizeLocalRole(link.role ?? null) === expectedRole)
  );
}

function isLocalGlobalAdmin(user: LocalJwtUser, hasForcedGlobalAccess: boolean) {
  return (
    hasForcedGlobalAccess ||
    (user as { is_global_admin?: boolean; globalRole?: string | null }).is_global_admin === true ||
    (user as { globalRole?: string | null }).globalRole === "global_admin"
  );
}

function resolveAllowedLocalCompanies(
  companies: LocalJwtCompany[],
  links: LocalJwtLink[],
  hasFullCompanyAccess: boolean,
) {
  return hasFullCompanyAccess
    ? companies
    : companies.filter((company) => links.some((link) => link.companyId === company.id));
}

function extractCompanySlugs(companies: LocalJwtCompany[]) {
  return companies
    .map((company) => company.slug)
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
}

async function resolveLocalAuthUser(identifier: string): Promise<AuthUser | null> {
  const user = await findUserByEmailOrId(identifier);
  if (!user) return null;

  const [links, companies] = await Promise.all([listLocalLinksForUser(user.id), listLocalCompanies()]);
  const hasForcedGlobalAccess = hasForcedGlobalAccessForUser({
    id: user.id,
    email: user.email,
    user: (user as { user?: string | null }).user ?? null,
  });
  const isGlobalAdmin = isLocalGlobalAdmin(user, hasForcedGlobalAccess);
  const hasTechnicalSupportRole = localUserHasRole(user, links, "technical_support");
  const hasLeaderTcRole = localUserHasRole(user, links, "leader_tc");
  const hasFullCompanyAccess = hasForcedGlobalAccess || isGlobalAdmin || hasTechnicalSupportRole || hasLeaderTcRole;
  const shouldBindCompanyContext = !hasFullCompanyAccess;
  const allowedCompanies = resolveAllowedLocalCompanies(companies, links, hasFullCompanyAccess);
  if (!hasFullCompanyAccess && allowedCompanies.length === 0) return null;
  const primary = shouldBindCompanyContext ? allowedCompanies[0] ?? null : null;
  const companySlugs = extractCompanySlugs(allowedCompanies);
  const primaryLink = primary ? links.find((link) => link.companyId === primary.id) ?? null : null;
  const rawRole = primaryLink?.role ?? (user as { role?: string | null }).role ?? null;
  const normalizedRole = normalizeLocalRole(rawRole);
  const companyRole = normalizedRole;
  const effectiveRole = hasForcedGlobalAccess ? "leader_tc" : toLegacyRole(companyRole, isGlobalAdmin);
  const capabilities = resolveCapabilities({
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    membershipCapabilities: primaryLink?.capabilities ?? null,
  });
  const permissionAccess = await resolvePermissionAccessForUser(user.id);
  const isProjectScopedRole = companyRole === "company_user" || companyRole === "testing_company_user";
  const allowedProjectIds =
    shouldBindCompanyContext && isProjectScopedRole && primaryLink?.allowedProjectIds?.length
      ? primaryLink.allowedProjectIds
      : null;

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
    allowedProjectIds,
    permissions: permissionAccess.permissions,
    permissionRole: permissionAccess.roleKey,
  };
}

export async function authenticateRequest(req: Request): Promise<AuthUser | null> {
  const mockUser = parsePlaywrightAuthUser(req);
  if (mockUser) return mockUser;

  const accessUser = await resolveAccessContextAuthUser(req);
  if (accessUser) return accessUser;

  const identifier = resolveRequestIdentifier(req);
  return identifier ? resolveLocalAuthUser(identifier) : null;
}

