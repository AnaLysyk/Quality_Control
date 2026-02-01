
import "server-only";

import { getAccessContext } from "@/lib/auth/session";
import { findUserByEmailOrId } from "@/lib/simpleAuth";
import { prisma } from "@/lib/prisma";

export type AuthUser = {
  id: string;
  email: string;
  isGlobalAdmin: boolean;
  role?: string | null;
  companyId?: string | null;
  companySlug?: string | null;
  companySlugs?: string[];
};

/**
 * Auth helper used by API routes.
 * - Prefer session_id / auth_token (JWT) cookies.
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

  const links = await prisma.userCompany.findMany({
    where: { user_id: user.id },
    include: { company: true },
  });
  const primary = links[0] ?? null;
  const companySlugs = links
    .map((link) => link.company.slug)
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);

  return {
    id: user.id,
    email: user.email,
    isGlobalAdmin: false,
    role: primary?.role ?? null,
    companyId: primary?.company.id ?? null,
    companySlug: primary?.company.slug ?? null,
    companySlugs,
  };
}
