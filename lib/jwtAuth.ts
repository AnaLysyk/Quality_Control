import "server-only";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { getUserById } from "@/data/usersRepository";
import { getUserRoleInClient } from "@/data/userClientsRepository";

export type AuthUser = {
  id: string;
  email: string;
  isGlobalAdmin: boolean;
};

const COOKIE_NAME = "auth_token";

export function verifyToken(token: string | undefined): AuthUser | null {
  if (!token) return null;
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not set");
    const payload = jwt.verify(token, secret) as any;
    return {
      id: payload.sub,
      email: payload.email,
      isGlobalAdmin: Boolean(payload.isGlobalAdmin),
    };
  } catch {
    return null;
  }
}

function safeSetCookie(name: string, value: string, options: Parameters<ReturnType<typeof cookies>["set"]>[2]) {
  try {
    cookies().set(name, value, options);
  } catch {
    // Em ambiente de teste sem request store, apenas ignore.
  }
}

export function setAuthCookie(token: string) {
  safeSetCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function clearAuthCookie() {
  safeSetCookie(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export function signToken(payload: { sub: string; email: string; isGlobalAdmin: boolean }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  return jwt.sign(payload, secret, { expiresIn: "8h" });
}

export async function authenticateRequest(req: Request): Promise<AuthUser | null> {
  const headerAuth = req.headers.get("authorization");
  const headerToken = headerAuth?.startsWith("Bearer ") ? headerAuth.replace("Bearer ", "") : null;
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(COOKIE_NAME)?.value;
  return verifyToken(headerToken || cookieToken);
}

// re-export explícito para evitar tree-shake em ambientes edge/turbopack
export { verifyToken };

export function getClientIdFromHeader(req: Request): string | null {
  return req.headers.get("x-client-id");
}

export async function requireUserRecord(auth: AuthUser | null) {
  if (!auth) return null;
  const user = await getUserById(auth.id);
  if (!user || !user.active) return null;
  return user;
}

export async function authorizeClientAccess(params: {
  user: AuthUser;
  clientId: string | null;
  requiredRole?: "ADMIN" | "USER";
}) {
  if (params.user.isGlobalAdmin) return;
  if (!params.clientId) throw new Error("Forbidden");
  const role = await getUserRoleInClient(params.user.id, params.clientId);
  if (!role) throw new Error("Forbidden");
  if (params.requiredRole === "ADMIN" && role.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
}
