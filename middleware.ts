import { type NextRequest, NextResponse } from "next/server";

// Role-based route access matrix
// Maps routes to allowed roles
const ROUTE_ACCESS_MAP: Record<string, string[]> = {
  "/empresas": ["leader_tc", "technical_support", "testing_company_user"],
  "/operacao": ["leader_tc", "technical_support"],
  "/operacoes/buscar": ["leader_tc", "technical_support"],
  "/admin/": ["leader_tc", "technical_support"],
  "/admin/permissoes": ["leader_tc"],
};

// Check if user role has access to route
function hasRouteAccess(pathname: string, userRole: string | null): boolean {
  if (!userRole) return false;

  // Check exact matches first
  for (const [route, allowedRoles] of Object.entries(ROUTE_ACCESS_MAP)) {
    if (pathname === route && allowedRoles.includes(userRole)) {
      return true;
    }
  }

  // Check prefix matches (for /admin/*)
  for (const [route, allowedRoles] of Object.entries(ROUTE_ACCESS_MAP)) {
    if (route.endsWith("/") && pathname.startsWith(route)) {
      if (allowedRoles.includes(userRole)) {
        return true;
      }
    }
  }

  // Routes accessible to all authenticated users
  const publicRoutes = [
    "/",
    "/home",
    "/chat",
    "/conversas",
    "/operacoes/dashboard",
    "/operacoes/metricas",
    "/casos-de-teste",
    "/planos-de-teste",
    "/runs",
    "/defeitos",
    "/automacoes",
    "/suporte",
    "/brain",
    "/documentos",
  ];

  for (const route of publicRoutes) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      return true;
    }
  }

  return true; // Default allow for now
}

export function middleware(request: NextRequest) {
  // TODO: Extract user role from JWT/session
  // For now, just pass through
  // This middleware will be enhanced after session implementation
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except api, _next, public assets
    "/((?!api|_next|.*\\..*|public).*)",
  ],
};
