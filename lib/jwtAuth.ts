import "server-only";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { getUserById } from "@/data/usersRepository";
import { getUserRoleInClient } from "@/data/userClientsRepository";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { isAuthUserGlobalAdmin } from "@/lib/rbac/globalAdmin";
import { isSupabaseDisabled } from "@/lib/envFlags";

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
    const payload = jwt.verify(token, secret) as jwt.JwtPayload & {
      sub?: unknown;
      email?: unknown;
      isGlobalAdmin?: unknown;
    };

    const id = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : "";
    if (!id) return null;

    return {
      id,
      email,
      isGlobalAdmin: payload.isGlobalAdmin === true,
    };
  } catch {
    return null;
  }
}

async function verifySupabaseToken(token: string | null): Promise<AuthUser | null> {
  if (!token) return null;
  try {
    const supabaseAdmin = getSupabaseServer();
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;

    const metadata = data.user.app_metadata;
    const metadataRole =
      metadata && typeof metadata === "object" && "role" in metadata ? (metadata as Record<string, unknown>).role : null;

    let userRow: Record<string, unknown> | null = null;
    try {
      const { data: row } = await supabaseAdmin
        .from("users")
        .select("is_global_admin,role")
        .eq("auth_user_id", data.user.id)
        .eq("active", true)
        .maybeSingle();
      userRow = (row as Record<string, unknown> | null) ?? null;
    } catch {
      userRow = null;
    }

    let profileRow: Record<string, unknown> | null = null;
    try {
      const primary = await supabaseAdmin.from("profiles").select("is_global_admin,role").eq("id", data.user.id).maybeSingle();
      profileRow = (primary.data as Record<string, unknown> | null) ?? null;

      if (!profileRow) {
        const fallback = await supabaseAdmin
          .from("profiles")
          .select("is_global_admin,role")
          .eq("auth_user_id", data.user.id)
          .maybeSingle();
        profileRow = (fallback.data as Record<string, unknown> | null) ?? null;
      }
    } catch {
      profileRow = null;
    }

    const isGlobalAdmin = await isAuthUserGlobalAdmin(supabaseAdmin, data.user.id, {
      metadataRole,
      userRow,
      profileRow,
    });
    return {
      id: data.user.id,
      email: data.user.email ?? "",
      isGlobalAdmin,
    };
  } catch {
    return null;
  }
}

type CookieStore = Awaited<ReturnType<typeof cookies>>;

async function safeSetCookie(name: string, value: string, options: Parameters<CookieStore["set"]>[2]) {
  try {
    const store = await cookies();
    store.set(name, value, options);
  } catch {
    // Em ambiente de teste sem request store, apenas ignore.
  }
}

export async function setAuthCookie(token: string) {
  await safeSetCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearAuthCookie() {
  await safeSetCookie(COOKIE_NAME, "", { path: "/", maxAge: 0 });
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

  const token = headerToken || cookieToken;
  const jwtUser = verifyToken(token || undefined);
  if (jwtUser) return jwtUser;

  if (isSupabaseDisabled()) return null;

  // Current Next.js login flow stores a Supabase access token in `auth_token`.
  return verifySupabaseToken(token ?? null);
}

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
  const FORBIDDEN_MESSAGE = "Acesso proibido";
  if (!params.clientId) throw new Error(FORBIDDEN_MESSAGE);
  const role = await getUserRoleInClient(params.user.id, params.clientId);
  if (!role) throw new Error(FORBIDDEN_MESSAGE);
  if (params.requiredRole === "ADMIN" && role.role !== "ADMIN") {
    throw new Error(FORBIDDEN_MESSAGE);
  }
}
