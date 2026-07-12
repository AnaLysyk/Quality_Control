import "server-only";
import jwt from "jsonwebtoken";

import { getRedis } from "@/lib/redis";
import {
  getLocalUserById,
  listLocalCompanies,
  listLocalLinksForUser,
  normalizeGlobalRole,
  normalizeLocalRole,
} from "@/lib/auth/localStore";
import { hasForcedGlobalAccessForUser } from "@/lib/auth/specialAccess";
import { resolvePermissionRoleForUser } from "@/lib/adminUsers";
import { resolveCapabilities } from "@/lib/permissions";
import { getJwtSecret } from "@/lib/auth/jwtSecret";

export type SessionPayload = {
  userId?: string;
  id?: string;
  email?: string;
  role?: string;
  permissionRole?: string;
  globalRole?: string;
  companyRole?: string;
  capabilities?: string[];
  companyId?: string;
  companySlug?: string;
  isGlobalAdmin?: boolean;
};

export type AccessContext = {
  userId: string;
  email: string;
  user?: string | null;
  userOrigin?: string | null;
  isGlobalAdmin: boolean;
  role: string | null;
  permissionRole: string | null;
  globalRole?: string | null;
  companyRole?: string | null;
  capabilities?: string[];
  companyId: string | null;
  companySlug: string | null;
  companySlugs: string[];
  // null = sem restrição de projeto; array = restrito aos projectIds informados.
  allowedProjectIds: string[] | null;
};

type ActiveProjectAssignment = {
  companyId: string;
  projectId: string;
  role: string;
};

const SESSION_COOKIE = "session_id";
const ACCESS_COOKIE = "access_token";
const LEGACY_AUTH_COOKIE = "auth_token";

function readCookieValue(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split("=");
    if (key === name) {
      const value = rest.join("=").trim();
      return value.length ? decodeURIComponent(value) : "";
    }
  }
  return null;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice("bearer ".length).trim();
    return token.length ? token : null;
  }
  return null;
}

function safeJsonParse<T>(raw: unknown): T | null {
  try {
    if (typeof raw === "string") return JSON.parse(raw) as T;
    return (raw as T) ?? null;
  } catch {
    return null;
  }
}

async function readSessionFromRedis(sessionId: string): Promise<SessionPayload | null> {
  if (!sessionId) return null;
  try {
    const redis = getRedis();
    const raw = await redis.get<string>(`session:${sessionId}`);
    return safeJsonParse<SessionPayload>(raw);
  } catch {
    return null;
  }
}

function parseJwtSession(token: string, secret: string): SessionPayload | null {
  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload & {
      sub?: string;
      userId?: string;
      email?: string;
      role?: string;
      permissionRole?: string;
      globalRole?: string;
      companyRole?: string;
      capabilities?: string[];
      companyId?: string;
      companySlug?: string;
      isGlobalAdmin?: boolean;
    };

    return {
      userId: typeof payload.userId === "string" ? payload.userId : undefined,
      id: typeof payload.sub === "string" ? payload.sub : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
      permissionRole: typeof payload.permissionRole === "string" ? payload.permissionRole : undefined,
      globalRole: typeof payload.globalRole === "string" ? payload.globalRole : undefined,
      companyRole: typeof payload.companyRole === "string" ? payload.companyRole : undefined,
      capabilities: Array.isArray(payload.capabilities) ? payload.capabilities : undefined,
      companyId: typeof payload.companyId === "string" ? payload.companyId : undefined,
      companySlug: typeof payload.companySlug === "string" ? payload.companySlug : undefined,
      isGlobalAdmin: payload.isGlobalAdmin === true,
    };
  } catch {
    return null;
  }
}

async function listActiveProjectAssignments(userId: string): Promise<ActiveProjectAssignment[]> {
  if (process.env.E2E_USE_JSON === "1") return [];

  try {
    const { prisma } = await import("@/lib/prismaClient");
    return await prisma.projectTeamAssignment.findMany({
      where: { userId, status: "active" },
      select: { companyId: true, projectId: true, role: true },
    });
  } catch {
    // A autenticação não deve cair quando o banco estiver temporariamente indisponível.
    return [];
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function getSessionPayload(req: Request): Promise<SessionPayload | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";

  // Preferimos um access token explícito (Bearer / cookie access_token).
  // Se existir, mas estiver inválido/expirado, não fazemos fallback para session_id.
  const bearer = extractBearerToken(req);
  const accessCookie = readCookieValue(cookieHeader, ACCESS_COOKIE);
  const legacyCookie = readCookieValue(cookieHeader, LEGACY_AUTH_COOKIE);
  const token = bearer || accessCookie || legacyCookie;
  if (token) {
    const secret = getJwtSecret();
    if (!secret) return await readSessionFromRedis(token);
    return parseJwtSession(token, secret);
  }

  const sessionId = readCookieValue(cookieHeader, SESSION_COOKIE);
  if (sessionId) {
    const fromRedis = await readSessionFromRedis(sessionId);
    if (fromRedis) return fromRedis;
  }

  return null;
}

export async function getAccessContext(req: Request): Promise<AccessContext | null> {
  const session = await getSessionPayload(req);
  if (!session) return null;

  const userId = session.userId ?? session.id;
  if (!userId) return null;

  const [user, links, companies, projectAssignments] = await Promise.all([
    getLocalUserById(userId),
    listLocalLinksForUser(userId),
    listLocalCompanies(),
    listActiveProjectAssignments(userId),
  ]);

  if (!user || user.active === false || user.status === "blocked") return null;

  const hasForcedLeaderAccess = hasForcedGlobalAccessForUser({
    id: user.id,
    email: user.email,
    user: user.user,
  });

  const resolvedGlobalRole = normalizeGlobalRole(user.globalRole ?? session.globalRole ?? null);
  const sessionRole = (session.role ?? "").trim().toLowerCase();
  const userRole = normalizeLocalRole(user.role ?? null);

  // A lista especial preserva o perfil/permissões de Líder TC, mas não concede
  // visibilidade global de empresas e projetos.
  const isGlobalAdmin =
    !hasForcedLeaderAccess &&
    (resolvedGlobalRole === "global_admin" ||
      user.is_global_admin === true ||
      session.isGlobalAdmin === true);

  const hasTechnicalSupportRole =
    sessionRole === "technical_support" ||
    userRole === "technical_support" ||
    links.some((link) => normalizeLocalRole(link.role ?? null) === "technical_support");

  const hasLeaderTcRole =
    hasForcedLeaderAccess ||
    sessionRole === "leader_tc" ||
    userRole === "leader_tc" ||
    links.some((link) => normalizeLocalRole(link.role ?? null) === "leader_tc") ||
    projectAssignments.some((assignment) => assignment.role === "leader_tc");

  const hasQaTcAssignments = projectAssignments.some((assignment) => assignment.role === "qa_tc");
  const hasUnrestrictedCompanyAccess = isGlobalAdmin || hasTechnicalSupportRole;
  const shouldBindCompanyContext = !hasUnrestrictedCompanyAccess;

  const roleAssignments = hasLeaderTcRole
    ? projectAssignments.filter((assignment) => assignment.role === "leader_tc")
    : hasQaTcAssignments
      ? projectAssignments.filter((assignment) => assignment.role === "qa_tc")
      : [];
  const assignedCompanyIds = new Set(roleAssignments.map((assignment) => assignment.companyId));

  const isDirectCompanyUser =
    userRole === "empresa" ||
    userRole === "company_user" ||
    user.user_origin === "client_company";

  const allowedCompanies = hasUnrestrictedCompanyAccess
    ? companies
    : hasLeaderTcRole || hasQaTcAssignments
      ? companies.filter((company) => assignedCompanyIds.has(company.id))
      : companies.filter((company) => {
          if (links.some((link) => link.companyId === company.id)) return true;
          if (!isDirectCompanyUser) return false;
          if (session.companyId && company.id === session.companyId) return true;
          if (session.companySlug && company.slug === session.companySlug) return true;
          if (user.default_company_slug && company.slug === user.default_company_slug) return true;
          return false;
        });

  const companySlugs = unique(
    allowedCompanies
      .map((company) => company.slug)
      .filter((slug): slug is string => typeof slug === "string" && slug.length > 0),
  );

  const primaryCompany = shouldBindCompanyContext
    ? allowedCompanies.find((company) => company.id === session.companyId) ??
      allowedCompanies.find((company) => company.slug === session.companySlug) ??
      allowedCompanies.find((company) => company.slug === user.default_company_slug) ??
      allowedCompanies[0] ??
      null
    : null;

  const primaryLink = primaryCompany
    ? links.find((link) => link.companyId === primaryCompany.id) ?? null
    : null;

  const rawRole = session.companyRole ?? primaryLink?.role ?? user.role ?? null;
  const companyRole = normalizeLocalRole(rawRole);
  const permissionRole = hasForcedLeaderAccess
    ? "leader_tc"
    : resolvePermissionRoleForUser(user, links);
  const capabilities = resolveCapabilities({
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    membershipCapabilities: primaryLink?.capabilities ?? session.capabilities ?? null,
  });
  const effectiveRole = hasForcedLeaderAccess ? "leader_tc" : permissionRole;

  const leaderProjectIds = unique(
    projectAssignments
      .filter((assignment) => assignment.role === "leader_tc")
      .map((assignment) => assignment.projectId),
  );
  const qaProjectIds = unique(
    projectAssignments
      .filter((assignment) => assignment.role === "qa_tc")
      .map((assignment) => assignment.projectId),
  );
  const isProjectScopedRole =
    companyRole === "company_user" || companyRole === "testing_company_user";

  const allowedProjectIds = hasUnrestrictedCompanyAccess
    ? null
    : hasLeaderTcRole
      ? leaderProjectIds
      : hasQaTcAssignments
        ? qaProjectIds
        : isProjectScopedRole && primaryLink?.allowedProjectIds?.length
          ? unique(primaryLink.allowedProjectIds)
          : null;

  return {
    userId: user.id,
    email: user.email,
    user: user.user ?? null,
    userOrigin: user.user_origin ?? null,
    isGlobalAdmin,
    role: effectiveRole,
    permissionRole,
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    capabilities,
    companyId: shouldBindCompanyContext ? primaryCompany?.id ?? null : null,
    companySlug: shouldBindCompanyContext ? primaryCompany?.slug ?? null : null,
    companySlugs,
    allowedProjectIds,
  };
}
