import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";
import { hasPermission, getUserRoleFromSession } from "@/lib/permissions";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

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

  // Protected routes
  const protectedPaths = ['/dashboard', '/admin', '/empresas', '/me', '/settings', '/api/me', '/api/user'];
  const isProtected = protectedPaths.some(path => pathname.startsWith(path));

  if (!isProtected) {
    return NextResponse.next();
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const mockRole = SUPABASE_MOCK ? (readCookieValue(cookieHeader, "mock_role") ?? "admin").trim().toLowerCase() : null;
  if (SUPABASE_MOCK && mockRole) {
    const userRole = mockRole === "admin" ? "admin" : "user";
    if (pathname.startsWith('/admin/') && !hasPermission(userRole, 'view_admin')) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Session verification
  const sessionId = req.cookies.get("session_id")?.value;
  if (!sessionId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const redis = getRedis();
    const raw = await redis.get(`session:${sessionId}`);
    if (!raw) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const session = typeof raw === "string" ? JSON.parse(raw) : raw;
    const userRole = getUserRoleFromSession(session);

    if (pathname.startsWith('/admin/') && !hasPermission(userRole, 'view_admin')) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Proxy session validation error:', error);
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/:path*"],
};
