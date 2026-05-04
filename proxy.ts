import { NextRequest, NextResponse } from "next/server";
import {
  canonicalizeCompanyPathnameForAccess,
  COMPANY_ROUTE_MODE_COOKIE,
  LONG_COMPANY_ROUTE_MODE,
  rewriteShortCompanyPathname,
  SHORT_COMPANY_ROUTE_MODE,
  shortenCompanyPathname,
  shouldUseShortCompanyRoutes,
} from "@/lib/companyRoutes";

function normalizeValue(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  if (typeof atob === "function") {
    return atob(padded);
  }
  return Buffer.from(padded, "base64").toString("utf8");
}

function readJwtPayload(request: NextRequest) {
  const token =
    request.cookies.get("access_token")?.value ??
    request.cookies.get("auth_token")?.value ??
    null;

  if (!token) return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as {
      role?: unknown;
      companyRole?: unknown;
      companySlug?: unknown;
      defaultCompanySlug?: unknown;
      default_company_slug?: unknown;
      userOrigin?: unknown;
      user_origin?: unknown;
      isGlobalAdmin?: unknown;
      globalRole?: unknown;
    };
    return payload;
  } catch {
    return null;
  }
}

type CompanyRouteAccessDecision = {
  usePublicRoutes: boolean;
  source: "cookie" | "jwt" | "default";
  routeModeCookie: string;
  role: string;
  companyRole: string;
  companySlug: string;
  defaultCompanySlug: string;
  userOrigin: string;
  isGlobalAdmin: boolean;
};

function resolveCompanyRouteAccessForRequest(request: NextRequest): CompanyRouteAccessDecision {
  const routeModeCookie = normalizeValue(request.cookies.get(COMPANY_ROUTE_MODE_COOKIE)?.value ?? null);
  const payload = readJwtPayload(request);
  if (!payload) {
    return {
      usePublicRoutes: false,
      source:
        routeModeCookie === SHORT_COMPANY_ROUTE_MODE || routeModeCookie === LONG_COMPANY_ROUTE_MODE
          ? "cookie"
          : "default",
      routeModeCookie,
      role: "",
      companyRole: "",
      companySlug: "",
      defaultCompanySlug: "",
      userOrigin: "",
      isGlobalAdmin: false,
    };
  }

  const normalizedRole = normalizeValue(typeof payload.role === "string" ? payload.role : null);
  const normalizedCompanyRole = normalizeValue(typeof payload.companyRole === "string" ? payload.companyRole : null);
  const normalizedCompanySlug = normalizeValue(typeof payload.companySlug === "string" ? payload.companySlug : null);
  const normalizedDefaultCompanySlug = normalizeValue(
    typeof payload.defaultCompanySlug === "string"
      ? payload.defaultCompanySlug
      : typeof payload.default_company_slug === "string"
        ? payload.default_company_slug
        : null,
  );
  const normalizedOrigin = normalizeValue(
    typeof payload.userOrigin === "string"
      ? payload.userOrigin
      : typeof payload.user_origin === "string"
        ? payload.user_origin
        : null,
  );
  const isGlobalAdmin =
    payload.isGlobalAdmin === true ||
    normalizeValue(typeof payload.globalRole === "string" ? payload.globalRole : null) === "global_admin";

  const usePublicRoutes = shouldUseShortCompanyRoutes({
    isGlobalAdmin,
    role: normalizedRole || null,
    companyRole: normalizedCompanyRole || null,
    userOrigin: normalizedOrigin || null,
    clientSlug: normalizedCompanySlug || null,
    defaultClientSlug: normalizedDefaultCompanySlug || null,
  });

  return {
    usePublicRoutes,
    source: "jwt",
    routeModeCookie,
    role: normalizedRole,
    companyRole: normalizedCompanyRole,
    companySlug: normalizedCompanySlug,
    defaultCompanySlug: normalizedDefaultCompanySlug,
    userOrigin: normalizedOrigin,
    isGlobalAdmin,
  };
}

function debugCompanyRouteDecision(
  request: NextRequest,
  access: CompanyRouteAccessDecision,
  action: "redirect" | "rewrite" | "pass",
  targetPath: string | null,
) {
  if (process.env.NODE_ENV === "production") return;

  const sourcePath = request.nextUrl.pathname;
  const isRelevantPath =
    sourcePath.startsWith("/empresas/") ||
    Boolean(shortenCompanyPathname(sourcePath)) ||
    Boolean(rewriteShortCompanyPathname(sourcePath)) ||
    sourcePath.startsWith("/login");

  if (!isRelevantPath) return;

  const details = [
    `action=${action}`,
    `source=${sourcePath}`,
    `target=${targetPath ?? "-"}`,
    `usePublicRoutes=${access.usePublicRoutes}`,
    `decisionSource=${access.source}`,
    `modeCookie=${access.routeModeCookie || "-"}`,
    `role=${access.role || "-"}`,
    `companyRole=${access.companyRole || "-"}`,
    `companySlug=${access.companySlug || "-"}`,
    `defaultCompanySlug=${access.defaultCompanySlug || "-"}`,
    `userOrigin=${access.userOrigin || "-"}`,
    `global=${access.isGlobalAdmin}`,
  ];

  console.info(`[company-routes] ${details.join(" ")}`);
}

export function proxy(request: NextRequest) {
  const mockRole = request.cookies.get("mock_role")?.value;
  const reqWithUser = request as NextRequest & { user?: { role: string; email: string } };
  const globalScope = globalThis as { user?: { role: string; email: string } };
  if (mockRole === "admin" || mockRole === "company" || mockRole === "client") {
    reqWithUser.user = { role: mockRole, email: `${mockRole}@mock.com` };
    globalScope.user = { role: mockRole, email: `${mockRole}@mock.com` };
  } else {
    reqWithUser.user = undefined;
    globalScope.user = undefined;
  }

  const routeAccess = resolveCompanyRouteAccessForRequest(request);
  const canonicalPath = routeAccess.usePublicRoutes
    ? canonicalizeCompanyPathnameForAccess(request.nextUrl.pathname, {
        isGlobalAdmin: routeAccess.isGlobalAdmin,
        role: routeAccess.role || null,
        companyRole: routeAccess.companyRole || null,
        userOrigin: routeAccess.userOrigin || null,
        clientSlug: routeAccess.companySlug || null,
        defaultClientSlug: routeAccess.defaultCompanySlug || null,
      })
    : null;
  if (canonicalPath && canonicalPath !== request.nextUrl.pathname) {
    debugCompanyRouteDecision(request, routeAccess, "redirect", canonicalPath);
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = canonicalPath;
    return NextResponse.redirect(nextUrl);
  }

  const rewrittenPath = rewriteShortCompanyPathname(request.nextUrl.pathname);
  if (rewrittenPath) {
    debugCompanyRouteDecision(request, routeAccess, "rewrite", rewrittenPath);
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = rewrittenPath;
    return NextResponse.rewrite(nextUrl);
  }

  debugCompanyRouteDecision(request, routeAccess, "pass", null);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
