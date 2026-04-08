
import { NextRequest, NextResponse } from "next/server";
import {
  COMPANY_ROUTE_MODE_COOKIE,
  LONG_COMPANY_ROUTE_MODE,
  rewriteShortCompanyPathname,
  SHORT_COMPANY_ROUTE_MODE,
  shortenCompanyPathname,
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
  useShort: boolean;
  source: "cookie" | "jwt" | "default";
  routeModeCookie: string;
  role: string;
  companyRole: string;
  userOrigin: string;
  isGlobalAdmin: boolean;
};

function resolveCompanyRouteAccessForRequest(request: NextRequest): CompanyRouteAccessDecision {
  const routeModeCookie = normalizeValue(request.cookies.get(COMPANY_ROUTE_MODE_COOKIE)?.value ?? null);
  if (routeModeCookie === SHORT_COMPANY_ROUTE_MODE) {
    return {
      useShort: true,
      source: "cookie",
      routeModeCookie,
      role: "",
      companyRole: "",
      userOrigin: "",
      isGlobalAdmin: false,
    };
  }
  if (routeModeCookie === LONG_COMPANY_ROUTE_MODE) {
    return {
      useShort: false,
      source: "cookie",
      routeModeCookie,
      role: "",
      companyRole: "",
      userOrigin: "",
      isGlobalAdmin: false,
    };
  }

  const payload = readJwtPayload(request);
  if (!payload) {
    return {
      useShort: false,
      source: "default",
      routeModeCookie,
      role: "",
      companyRole: "",
      userOrigin: "",
      isGlobalAdmin: false,
    };
  }

  const normalizedRole = normalizeValue(typeof payload.role === "string" ? payload.role : null);
  const normalizedCompanyRole = normalizeValue(typeof payload.companyRole === "string" ? payload.companyRole : null);
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

  const useShort =
    !isGlobalAdmin &&
    (
    normalizedRole === "company" ||
    normalizedCompanyRole === "company_admin" ||
    normalizedCompanyRole === "client_admin" ||
    normalizedOrigin === "client_company"
  );

  return {
    useShort,
    source: "jwt",
    routeModeCookie,
    role: normalizedRole,
    companyRole: normalizedCompanyRole,
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
    Boolean(shortenCompanyPathname(sourcePath)) ||
    Boolean(rewriteShortCompanyPathname(sourcePath)) ||
    sourcePath.startsWith("/login");

  if (!isRelevantPath) return;

  const details = [
    `action=${action}`,
    `source=${sourcePath}`,
    `target=${targetPath ?? "-"}`,
    `useShort=${access.useShort}`,
    `decisionSource=${access.source}`,
    `modeCookie=${access.routeModeCookie || "-"}`,
    `role=${access.role || "-"}`,
    `companyRole=${access.companyRole || "-"}`,
    `userOrigin=${access.userOrigin || "-"}`,
    `global=${access.isGlobalAdmin}`,
  ];

  console.info(`[company-routes] ${details.join(" ")}`);
}

export function middleware(request: NextRequest) {
  // RBAC mock: se mock_role=admin, injeta user admin no request
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
  const shortPath = shortenCompanyPathname(request.nextUrl.pathname);
  if (shortPath && routeAccess.useShort && shortPath !== request.nextUrl.pathname) {
    debugCompanyRouteDecision(request, routeAccess, "redirect", shortPath);
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = shortPath;
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
