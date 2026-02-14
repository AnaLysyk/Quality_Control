import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";
// import removido: hasPermission, getUserRoleFromSession não existem em @/lib/permissions

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

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublicAsset =
    pathname.startsWith("/images") ||
    pathname.startsWith("/public") ||
    pathname.match(/\.(ico|png|svg|jpg|jpeg|gif|webp|css|js)$/);

  // Public routes and assets
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/auth/reset-request") ||
    pathname.startsWith("/api/auth/reset-password") ||
    pathname.startsWith("/api/auth/reset-via-token") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    isPublicAsset
  ) {
    return NextResponse.next();
  }

  // Rotas protegidas (UI + APIs que exigem sessão)
  const protectedPaths = ["/dashboard", "/admin", "/empresas", "/me", "/settings", "/api/me", "/api/user"];
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
  const isApiRequest = pathname.startsWith("/api/");

  if (!isProtected) {
    return NextResponse.next();
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice("bearer ".length).trim() : "";
  const authCookieName = (process.env.AUTH_COOKIE_NAME ?? "auth_token").trim() || "auth_token";
  const authToken =
    readCookieValue(cookieHeader, "auth_token") ||
    (authCookieName ? readCookieValue(cookieHeader, authCookieName) : null);
  const isAdminPath = pathname === "/admin" || pathname === "/admin/" || pathname.startsWith("/admin/");
  const isAdminRedirectPath = pathname === "/admin" || pathname === "/admin/" || pathname === "/admin/home";
  const nonAdminRedirectTarget = "/empresas";

  if (bearerToken || authToken) {
    return NextResponse.next();
  }

  // Session verification
  const sessionId = req.cookies.get("session_id")?.value;
  if (!sessionId) {
    if (isApiRequest) {
      return NextResponse.json(
        { error: { code: "NO_SESSION", message: "Sessão não encontrada." } },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const redis = getRedis();
    const raw = await redis.get(`session:${sessionId}`);
    if (!raw) {
      if (isApiRequest) {
        return NextResponse.json(
          { error: { code: "NO_SESSION", message: "Sessão inválida." } },
          { status: 401 }
        );
      }
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const session = typeof raw === "string" ? JSON.parse(raw) : raw;
    const userRole = getUserRoleFromSession(session);

    if (isAdminPath && !hasPermission(userRole, 'view_admin')) {
      if (isAdminRedirectPath) {
        return NextResponse.redirect(new URL(nonAdminRedirectTarget, req.url));
      }
      return NextResponse.next();
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Proxy session validation error:", error);
    if (isApiRequest) {
      return NextResponse.json(
        { error: { code: "NO_SESSION", message: "Falha ao validar sessão." } },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/:path*"],
};
