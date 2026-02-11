import "server-only";

import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

import { getRedis } from "@/lib/redis";
import { getJwtSecret } from "@/lib/auth/jwtSecret";

type AdminSession = {
  id: string;
  email: string;
  token: string;
};

type SessionUser = {
  userId?: string;
  id?: string;
  email?: string;
  role?: string;
  isGlobalAdmin?: boolean;
  globalRole?: string | null;
};

export async function extractAccessToken(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice("bearer ".length).trim();
    if (token) return token;
  }

  const store = await cookies();
  return store.get("access_token")?.value || store.get("auth_token")?.value || null;
}

async function readSessionUser(req: Request): Promise<SessionUser | null> {
  const token = await extractAccessToken(req);
  if (token) {
    const secret = getJwtSecret();
    if (!secret) {
      const redis = getRedis();
      const raw = await redis.get<string>(`session:${token}`);
      if (!raw) return null;
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return parsed as SessionUser;
      } catch {
        return null;
      }
    }

    try {
      const payload = jwt.verify(token, secret) as jwt.JwtPayload & {
        sub?: string;
        email?: string;
        role?: string;
        isGlobalAdmin?: boolean;
        globalRole?: string | null;
      };
      return {
        userId: typeof payload.sub === "string" ? payload.sub : undefined,
        email: typeof payload.email === "string" ? payload.email : undefined,
        role: typeof payload.role === "string" ? payload.role : undefined,
        isGlobalAdmin: payload.isGlobalAdmin === true,
        globalRole: typeof payload.globalRole === "string" ? payload.globalRole : null,
      };
    } catch {
      // Token exists but is invalid/expired: do not fall back to session_id.
      return null;
    }
  }

  const store = await cookies();
  const sessionId = store.get("session_id")?.value;
  if (!sessionId) return null;

  const redis = getRedis();
  const raw = await redis.get<string>(`session:${sessionId}`);
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed as SessionUser;
  } catch {
    return null;
  }
}

function isAdminRole(role?: string | null) {
  const normalized = (role ?? "").toLowerCase();
  return normalized === "admin" || normalized === "super-admin" || normalized === "global_admin";
}

export async function requireGlobalAdmin(
  req: Request,
  opts?: { token?: string | null },
): Promise<AdminSession | null> {
  const session = await readSessionUser(req);
  if (!session) return null;

  const role = session.role ?? null;
  const isGlobalAdmin =
    session.isGlobalAdmin === true || (session.globalRole ?? "").toLowerCase() === "global_admin";
  if (!isGlobalAdmin && !isAdminRole(role)) return null;

  return {
    id: session.userId ?? session.id ?? "",
    email: session.email ?? "",
    token: opts?.token ?? "",
  };
}

export async function requireGlobalAdminWithStatus(
  req: Request,
  opts?: { token?: string | null },
): Promise<{ admin: AdminSession | null; status: 200 | 401 | 403 }>
{
  const admin = await requireGlobalAdmin(req, opts);
  if (admin) return { admin, status: 200 };

  const session = await readSessionUser(req);
  if (!session) return { admin: null, status: 401 };
  return { admin: null, status: 403 };
}

export type { AdminSession };
