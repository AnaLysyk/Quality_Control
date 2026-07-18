import "server-only";

import { getAccessContext } from "@/backend/auth/session";
import { resolvePermissionAccessForUser } from "@/backend/serverPermissionAccess";
import { isE2eMockAllowed } from "@/backend/auth/e2eMockGate";
import type { PermissionMatrix } from "@/backend/permissionMatrix";
import type { AccessAssignment, ProjectScope } from "@/backend/auth/accessAssignment";

export type AuthUser = {
  id: string;
  email: string;
  user?: string | null;
  isGlobalAdmin: boolean;
  role?: string | null;
  globalRole?: string | null;
  companyRole?: string | null;
  capabilities?: string[];
  companyId?: string | null;
  companySlug?: string | null;
  companySlugs?: string[];
  // null/undefined = sem restrição de projeto; array = restrito a esses projectIds.
  allowedProjectIds?: string[] | null;
  permissions?: PermissionMatrix;
  permissionRole?: string | null;
  assignments?: AccessAssignment[];
  projectScope?: ProjectScope;
};

type PlaywrightDecodedAuth = {
  id?: string;
  email?: string;
  role?: string;
  permissionRole?: string;
  companyRole?: string;
  companySlug?: string;
  companySlugs?: string[];
  isGlobalAdmin?: boolean;
};

function readE2eAuthCookie(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("e2e_auth="));
}

function normalizeDecodedCompanySlugs(decoded: PlaywrightDecodedAuth) {
  if (Array.isArray(decoded.companySlugs)) {
    return decoded.companySlugs.filter(
      (slug): slug is string => typeof slug === "string" && slug.trim().length > 0,
    );
  }
  return decoded.companySlug ? [decoded.companySlug] : [];
}

function buildPlaywrightAuthUser(decoded: PlaywrightDecodedAuth): AuthUser {
  return {
    id: decoded.id ?? "e2e-mock-user",
    email: decoded.email ?? "e2e@testingcompany.local",
    user: decoded.email ?? null,
    isGlobalAdmin: decoded.isGlobalAdmin === true,
    role: decoded.role ?? decoded.permissionRole ?? null,
    globalRole: decoded.isGlobalAdmin === true ? "global_admin" : null,
    companyRole: decoded.companyRole ?? decoded.role ?? null,
    capabilities: [],
    companyId: decoded.companySlug ?? null,
    companySlug: decoded.companySlug ?? null,
    companySlugs: normalizeDecodedCompanySlugs(decoded),
    permissions: {},
    permissionRole: decoded.permissionRole ?? decoded.role ?? null,
  };
}

function parsePlaywrightAuthUser(req: Request): AuthUser | null {
  if (!isE2eMockAllowed()) return null;

  const rawCookie = readE2eAuthCookie(req);
  if (!rawCookie) return null;

  try {
    const encoded = rawCookie.slice("e2e_auth=".length);
    const decoded = JSON.parse(
      Buffer.from(decodeURIComponent(encoded), "base64url").toString("utf8"),
    ) as PlaywrightDecodedAuth;
    return buildPlaywrightAuthUser(decoded);
  } catch {
    return null;
  }
}

async function resolveAccessContextAuthUser(req: Request): Promise<AuthUser | null> {
  const access = await getAccessContext(req);
  if (!access) return null;

  const permissionAccess = await resolvePermissionAccessForUser(access.userId);
  return {
    id: access.userId,
    email: access.email,
    user: access.user ?? null,
    isGlobalAdmin: access.isGlobalAdmin,
    role: access.role,
    globalRole: access.globalRole ?? null,
    companyRole: access.companyRole ?? null,
    capabilities: access.capabilities ?? [],
    companyId: access.companyId,
    companySlug: access.companySlug,
    companySlugs: access.companySlugs,
    allowedProjectIds: access.allowedProjectIds,
    permissions: permissionAccess.permissions,
    permissionRole: permissionAccess.roleKey,
    assignments: access.assignments,
    projectScope: access.projectScope,
  };
}

export async function authenticateRequest(req: Request): Promise<AuthUser | null> {
  const mockUser = parsePlaywrightAuthUser(req);
  if (mockUser) return mockUser;

  return resolveAccessContextAuthUser(req);
}
