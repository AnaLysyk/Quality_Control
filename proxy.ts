import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";
import { hasPermission, getUserRoleFromSession } from "@/lib/permissions";

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

  // Rotas protegidas
  const protectedPaths = ['/dashboard', '/admin', '/empresas', '/me', '/settings', '/api/me', '/api/user'];
  const isProtected = protectedPaths.some(path => pathname.startsWith(path));

  if (!isProtected) {
    return NextResponse.next();
  }

  // Verificar sessão
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

    // Parse session
    const session = typeof raw === "string" ? JSON.parse(raw) : raw;
    const userRole = getUserRoleFromSession(session);

    // Check permissions for specific routes
    if (pathname.startsWith('/admin/') && !hasPermission(userRole, 'view_admin')) {
      return NextResponse.redirect(new URL("/dashboard", req.url)); // or 403
    }

    // For other protected routes, session is valid
    return NextResponse.next();
  } catch (error) {
    console.error('Proxy session validation error:', error);
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/:path*"],
};
