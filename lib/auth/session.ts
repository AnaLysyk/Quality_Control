import "server-only";
import jwt from "jsonwebtoken";

import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";

export type SessionPayload = {
  userId?: string;
  id?: string;
  email?: string;
  role?: string;
  companyId?: string;
  companySlug?: string;
  isGlobalAdmin?: boolean;
};

export type AccessContext = {
  userId: string;
  email: string;
  isGlobalAdmin: boolean;
  role: string | null;
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
  if (!secret) return null;

  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload & {
      sub?: string;
      userId?: string;
      email?: string;
      role?: string;
      companyId?: string;
      companySlug?: string;
      isGlobalAdmin?: boolean;
    };

    return {
      userId: typeof payload.userId === "string" ? payload.userId : undefined,
      id: typeof payload.sub === "string" ? payload.sub : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { userCompanies: { include: { company: true } } },
  });
  if (!user) return null;

  const companySlugs = user.userCompanies
    .map((link) => link.company.slug)
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);

  const primaryLink =
    user.userCompanies.find((link) => link.company.id === session.companyId) ??
    user.userCompanies.find((link) => link.company.slug === session.companySlug) ??
    user.userCompanies[0] ??
    null;

  return {
    userId: user.id,
    email: user.email,
    isGlobalAdmin: session.isGlobalAdmin === true,
    role: session.role ?? primaryLink?.role ?? null,
    companyId: session.companyId ?? primaryLink?.company.id ?? null,
    companySlug: session.companySlug ?? primaryLink?.company.slug ?? null,
    companySlugs,
  };
}
