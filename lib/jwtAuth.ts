import "server-only";

import { getAccessContext } from "@/lib/auth/session";
import { findUserByEmailOrId } from "@/lib/simpleAuth";
import { listLocalCompanies, listLocalLinksForUser, normalizeLocalRole } from "@/lib/auth/localStore";
import { resolveCapabilities } from "@/lib/permissions";

export type AuthUser = {
  id: string;
  email: string;
  isGlobalAdmin: boolean;
  role?: string | null;
  globalRole?: string | null;
  companyRole?: string | null;
  capabilities?: string[];
  companyId?: string | null;
  companySlug?: string | null;
  companySlugs?: string[];
};

/**
 * Auth helper used by API routes.
 * - Prefer access_token (JWT) cookie (or session_id when JWT_SECRET is absent).
 * - Fallback: Authorization Bearer <email|id> or ?user= for local tooling.
 */
export async function authenticateRequest(req: Request): Promise<AuthUser | null> {
  const access = await getAccessContext(req);
  if (access) {
    return {
      id: access.userId,
      email: access.email,
      isGlobalAdmin: access.isGlobalAdmin,
      role: access.role,
      globalRole: access.globalRole ?? null,
      companyRole: access.companyRole ?? null,
      capabilities: access.capabilities ?? [],
      companyId: access.companyId,
      companySlug: access.companySlug,
      companySlugs: access.companySlugs,
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
  const allowedCompanies = isGlobalAdmin
    ? companies
    : companies.filter((company) => links.some((link) => link.companyId === company.id));
  if (!isGlobalAdmin && allowedCompanies.length === 0) return null;
  const primary = allowedCompanies[0] ?? null;
  const companySlugs = allowedCompanies
    .map((company) => company.slug)
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
  const primaryLink = primary ? links.find((link) => link.companyId === primary.id) ?? null : null;
  const rawRole = primaryLink?.role ?? (user as { role?: string | null }).role ?? null;
  const normalizedRole = normalizeLocalRole(rawRole);
  const companyRole = normalizedRole;
  const effectiveRole = isGlobalAdmin ? "admin" : normalizedRole === "company_admin" ? "company" : "user";
  const capabilities = resolveCapabilities({
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole: companyRole === "company_admin" ? "company_admin" : companyRole === "viewer" ? "viewer" : "user",
    membershipCapabilities: primaryLink?.capabilities ?? null,
  });

  return {
    id: user.id,
    email: user.email,
    isGlobalAdmin,
    role: effectiveRole,
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    capabilities,
    companyId: primary?.id ?? null,
    companySlug: primary?.slug ?? null,
    companySlugs,
  };
}
