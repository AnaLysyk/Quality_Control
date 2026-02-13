import jwt from "jsonwebtoken";
import { getRedis } from "@/lib/redis";
import { listLocalCompanies, listLocalLinksForUser } from "@/lib/auth/localStore";
import { getJwtSecret } from "@/lib/auth/jwtSecret";

export type AuthContext = { userId: string; companySlugs: string[] };

function readCookieValue(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    if (key === name) {
      const value = rest.join("=");
      return value ? decodeURIComponent(value) : "";
    }
  }
  return null;
}

export async function getAuthContext(req: Request): Promise<AuthContext | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  const cookieToken = readCookieValue(cookieHeader, "access_token") ?? readCookieValue(cookieHeader, "auth_token");
  const token = bearer || cookieToken;
  if (token) {
    const secret = getJwtSecret();
    if (!secret) {
      const redis = getRedis();
      const raw = await redis.get<string>(`session:${token}`);
      if (!raw) return null;
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        const userId = (parsed as { userId?: string; id?: string }).userId ?? (parsed as { id?: string }).id;
        if (!userId) return null;
        const isGlobalAdmin = (parsed as { isGlobalAdmin?: boolean }).isGlobalAdmin === true;
        const [links, companies] = await Promise.all([listLocalLinksForUser(userId), listLocalCompanies()]);
        const allowed = isGlobalAdmin ? companies : companies.filter((company) => links.some((link) => link.companyId === company.id));
        return { userId, companySlugs: allowed.map((c) => c.slug) };
      } catch {
        return null;
      }
    }
    try {
      const payload = jwt.verify(token, secret) as jwt.JwtPayload & { sub?: string; isGlobalAdmin?: boolean };
      const userId = typeof payload.sub === "string" ? payload.sub : null;
      if (!userId) return null;
      const isGlobalAdmin = payload.isGlobalAdmin === true;
      const [links, companies] = await Promise.all([listLocalLinksForUser(userId), listLocalCompanies()]);
      const allowed = isGlobalAdmin ? companies : companies.filter((company) => links.some((link) => link.companyId === company.id));
      return { userId, companySlugs: allowed.map((c) => c.slug) };
    } catch {
      return null;
    }
  }

  const sessionId = readCookieValue(cookieHeader, "session_id");
  if (!sessionId) return null;

  const redis = getRedis();
  const raw = await redis.get<string>(`session:${sessionId}`);
  if (!raw) return null;

  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const userId = (parsed as { userId?: string; id?: string }).userId ?? (parsed as { id?: string }).id;
    if (!userId) return null;
    const isGlobalAdmin = (parsed as { isGlobalAdmin?: boolean }).isGlobalAdmin === true;
    const [links, companies] = await Promise.all([listLocalLinksForUser(userId), listLocalCompanies()]);
    const allowed = isGlobalAdmin ? companies : companies.filter((company) => links.some((link) => link.companyId === company.id));
    return { userId, companySlugs: allowed.map((c) => c.slug) };
  } catch {
    return null;
  }
}

export function canAccessCompany(auth: AuthContext, companySlug: string) {
  return auth.companySlugs.includes(companySlug);
}
