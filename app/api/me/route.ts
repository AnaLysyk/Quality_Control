import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
import type { AuthCompany } from "@/../packages/contracts/src/auth";

type SessionUser = {
  userId?: string;
  id?: string;
  email?: string;
  role?: string;
  companyId?: string;
  companySlug?: string;
  isGlobalAdmin?: boolean;
};

function readCookieValue(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split("=");
    if (key === name) {
      return rest.join("=").trim();
    }
  }
  return null;
}

async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionId = readCookieValue(cookieHeader, "session_id");
  if (sessionId) {
    const redis = getRedis();
    const raw = await redis.get<string>(`session:${sessionId}`);
    if (raw) {
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return parsed as SessionUser;
      } catch {
        return null;
      }
    }
  }

  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice("bearer ".length).trim() : "";
  const cookieToken = readCookieValue(cookieHeader, "auth_token");
  const token = bearer || cookieToken;
  if (!token) return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload & {
      sub?: string;
      email?: string;
      role?: string;
      companyId?: string;
      companySlug?: string;
      isGlobalAdmin?: boolean;
    };
    return {
      userId: typeof payload.sub === "string" ? payload.sub : undefined,
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

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { user: null, companies: [], error: { code, message } },
    { status },
  );
}

export async function GET(req: Request) {
  const session = await getSessionUser(req);
  if (!session) {
    return errorResponse(401, "NO_SESSION", "Nao autorizado");
  }

  const userId = session.userId ?? session.id;
  if (!userId) {
    return errorResponse(401, "INVALID_SESSION", "Sessao invalida");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { userCompanies: { include: { company: true } } },
  });
  if (!user) {
    return errorResponse(401, "USER_NOT_FOUND", "Usuario nao encontrado");
  }

  const companies: AuthCompany[] = user.userCompanies.map((link) => ({
    id: link.company.id,
    name: link.company.name,
    slug: link.company.slug,
    role: link.role,
    active: true,
  }));

  const primary = companies[0] ?? null;
  const resolvedRole = session.role ?? primary?.role ?? null;
  const resolvedCompanyId = session.companyId ?? primary?.id ?? null;
  const resolvedCompanySlug = session.companySlug ?? primary?.slug ?? null;

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: resolvedRole,
      clientId: resolvedCompanyId,
      clientSlug: resolvedCompanySlug,
      defaultClientSlug: resolvedCompanySlug,
      clientSlugs: companies.map((company) => company.slug),
      isGlobalAdmin: session.isGlobalAdmin === true,
    },
    companies,
  });
}

export async function PATCH() {
  return NextResponse.json({ error: "Not implemented" }, { status: 405 });
}
