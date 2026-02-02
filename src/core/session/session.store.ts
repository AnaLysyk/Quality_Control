import "server-only";
import jwt from "jsonwebtoken";

import { getRedis } from "@/lib/redis";
import {
  getLocalUserById,
  listLocalCompanies,
  listLocalLinksForUser,
  normalizeLocalRole,
  normalizeGlobalRole,
  toLegacyRole,
} from "@/lib/auth/localStore";
import { resolveCapabilities } from "@/lib/permissions";

export type SessionPayload = {
  userId?: string;
  id?: string;
  email?: string;
  role?: string;
  globalRole?: string;
  companyRole?: string;
  capabilities?: string[];
  companyId?: string;
  companySlug?: string;
  isGlobalAdmin?: boolean;
};

export type AccessContext = {
  userId: string;
  email: string;
  isGlobalAdmin: boolean;
  role: string | null;
  globalRole?: string | null;
  companyRole?: string | null;
  capabilities?: string[];
  companyId: string | null;
  companySlug: string | null;
  companySlugs: string[];
};

function readCookieValue(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split("=");
    if (key === name) {
      const value = rest.join("=").trim();
      return value.length ? decodeURIComponent(value) : "";
    }
  }
  return null;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice("bearer ".length).trim();
    return token.length ? token : null;
  }
  return null;
}

export async function getSessionPayload(req: Request): Promise<SessionPayload | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionId = readCookieValue(cookieHeader, "session_id");
  if (sessionId) {
    try {
      const redis = getRedis();
      const raw = await redis.get<string>(`session:${sessionId}`);
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return parsed as SessionPayload;
      }
    } catch {
      return null;
    }
  }

  const bearer = extractBearerToken(req);
  const cookieToken = readCookieValue(cookieHeader, "auth_token");
  const token = bearer || cookieToken;
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fallback: allow bearer token to be a session_id when JWT is not configured.
    try {
      const redis = getRedis();
      const raw = await redis.get<string>(`session:${token}`);
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return parsed as SessionPayload;
      }
    } catch {
      return null;
    }
    return null;
  }

  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload & {
      sub?: string;
      userId?: string;
      email?: string;
      role?: string;
      globalRole?: string;
      companyRole?: string;
      capabilities?: string[];
      companyId?: string;
      companySlug?: string;
      isGlobalAdmin?: boolean;
    };

    return {
      userId: typeof payload.userId === "string" ? payload.userId : undefined,
      id: typeof payload.sub === "string" ? payload.sub : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
      globalRole: typeof payload.globalRole === "string" ? payload.globalRole : undefined,
      companyRole: typeof payload.companyRole === "string" ? payload.companyRole : undefined,
      capabilities: Array.isArray(payload.capabilities) ? payload.capabilities : undefined,
      companyId: typeof payload.companyId === "string" ? payload.companyId : undefined,
      companySlug: typeof payload.companySlug === "string" ? payload.companySlug : undefined,
      isGlobalAdmin: payload.isGlobalAdmin === true,
    };
  } catch {
    return null;
  }
}

export async function getAccessContext(req: Request): Promise<AccessContext | null> {
  const session = await getSessionPayload(req);
  if (!session) return null;

  const userId = session.userId ?? session.id;
  if (!userId) return null;

  const [user, links, companies] = await Promise.all([
    getLocalUserById(userId),
    listLocalLinksForUser(userId),
    listLocalCompanies(),
  ]);
  if (!user || user.active === false || user.status === "blocked") return null;

  const resolvedGlobalRole = normalizeGlobalRole(user.globalRole ?? session.globalRole ?? null);
  const isGlobalAdmin =
    resolvedGlobalRole === "global_admin" || user.is_global_admin === true || session.isGlobalAdmin === true;
  const allowedCompanies = isGlobalAdmin
    ? companies
    : companies.filter((company) => links.some((link) => link.companyId === company.id));
  if (!isGlobalAdmin && allowedCompanies.length === 0) return null;
  const companySlugs = allowedCompanies
    .map((company) => company.slug)
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);

  const primaryCompany =
    allowedCompanies.find((company) => company.id === session.companyId) ??
    allowedCompanies.find((company) => company.slug === session.companySlug) ??
    allowedCompanies.find((company) => company.slug === user.default_company_slug) ??
    allowedCompanies[0] ??
    null;

  const primaryLink =
    primaryCompany ? links.find((link) => link.companyId === primaryCompany.id) ?? null : null;

  const rawRole = session.companyRole ?? primaryLink?.role ?? user.role ?? null;
  const companyRole = normalizeLocalRole(rawRole);
  const capabilities = resolveCapabilities({
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole: companyRole === "company_admin" ? "company_admin" : companyRole === "viewer" ? "viewer" : "user",
    membershipCapabilities: primaryLink?.capabilities ?? session.capabilities ?? null,
  });
  const effectiveRole = toLegacyRole(companyRole, isGlobalAdmin);

  return {
    userId: user.id,
    email: user.email,
    isGlobalAdmin,
    role: effectiveRole,
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    capabilities,
    companyId: session.companyId ?? primaryCompany?.id ?? null,
    companySlug: session.companySlug ?? primaryCompany?.slug ?? null,
    companySlugs,
  };
}
