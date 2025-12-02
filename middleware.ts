import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublicAsset =
    pathname.startsWith("/images") ||
    pathname.startsWith("/public") ||
    pathname.match(/\.(ico|png|svg|jpg|jpeg|gif|webp|css|js)$/);

  // Public routes and assets
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    isPublicAsset
  ) {
    return NextResponse.next();
  }

  const auth = req.cookies.get("auth")?.value;
  const adminUser = process.env.ADMIN_USER || "admin";

  // Authenticated
  if (auth === adminUser) {
    return NextResponse.next();
  }

  // Redirect unauthenticated to login
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/:path*"],
};
