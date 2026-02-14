import "server-only";
import jwt from "jsonwebtoken";

import { getRedis } from "@/lib/redis";
import {
  LocalAuthCompany,
  getLocalUserById,
  listLocalCompanies,
  listLocalLinksForUser,
  normalizeGlobalRole,
  normalizeLocalRole,
  toLegacyRole,
} from "@/lib/auth/localStore";
import { resolveCapabilities } from "@/lib/permissions";
import { getJwtSecret } from "@/lib/auth/jwtSecret";

export type SessionPayload = {
  userId?: string;
  id?: string;
  email?: string;
  role?: string;
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
  isGlobalAdmin: boolean;
  role: string | null;
  globalRole?: string | null;
  companyRole?: string | null;
  capabilities?: string[];
  companyId: string | null;
  companySlug: string | null;
  companySlugs: string[];
};

const SESSION_COOKIE = "session_id";
const ACCESS_COOKIE = "access_token";
const LEGACY_AUTH_COOKIE = "auth_token";

type HeaderStore = Pick<Headers, "get">;
type CookieStore = {
  get(name: string): { value: string } | undefined;
};

function isCompanyActive(company: LocalAuthCompany): boolean {
  const booleanFlag = company.active !== false;
  const status = typeof company.status === "string" ? company.status.trim().toLowerCase() : null;
  if (!booleanFlag) return false;
  if (!status) return true;
  return status === "active" || status === "ativa" || status === "ativo";
}

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

function extractBearerTokenFromHeaderValue(authHeader: string | null | undefined): string | null {
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice("bearer ".length).trim();
    return token.length ? token : null;
  }
  return null;
}

function extractBearerToken(req: Request): string | null {
  return extractBearerTokenFromHeaderValue(req.headers.get("authorization"));
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

export async function getSessionPayload(req: Request): Promise<SessionPayload | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";

  // 1) Preferimos um access token explicito (Bearer / cookie access_token).
  // Importante: se o token existir mas for invalido/expirado, NAO fazemos fallback para session_id
  // (isso evita burlar expiracao/refresh).
  const bearer = extractBearerToken(req);
  const accessCookie = readCookieValue(cookieHeader, ACCESS_COOKIE);
  const legacyCookie = readCookieValue(cookieHeader, LEGACY_AUTH_COOKIE);
  const token = bearer || accessCookie || legacyCookie;
  if (token) {
    // 2) Se JWT_SECRET nao existir, tratamos o token como session_id (fallback local).
    const secret = getJwtSecret();
    if (!secret) {
      return await readSessionFromRedis(token);
    }

    // 3) Se tiver JWT_SECRET, decodifica o JWT e normaliza o payload.
    return parseJwtSession(token, secret);
  }

  // 4) Fallback para clientes legados: session_id no Redis.
  const sessionId = readCookieValue(cookieHeader, SESSION_COOKIE);
  if (sessionId) {
    const fromRedis = await readSessionFromRedis(sessionId);
    if (fromRedis) return fromRedis;
  }

  return null;
}

function readCookieFromStore(store: CookieStore, name: string): string | null {
  const value = store.get(name)?.value;
  return typeof value === "string" ? value : null;
}

export async function getSessionPayloadFromStores(
  headerStore: HeaderStore | undefined,
  cookieStore: CookieStore,
): Promise<SessionPayload | null> {
  const bearer = headerStore ? extractBearerTokenFromHeaderValue(headerStore.get("authorization")) : null;
  const accessCookie = readCookieFromStore(cookieStore, ACCESS_COOKIE);
  const legacyCookie = readCookieFromStore(cookieStore, LEGACY_AUTH_COOKIE);
  const token = bearer || accessCookie || legacyCookie;
  if (token) {
    const secret = getJwtSecret();
    if (!secret) {
      return await readSessionFromRedis(token);
    }
    return parseJwtSession(token, secret);
  }

  const sessionId = readCookieFromStore(cookieStore, SESSION_COOKIE);
  if (sessionId) {
    const fromRedis = await readSessionFromRedis(sessionId);
    if (fromRedis) return fromRedis;
  }

  return null;
}

async function resolveAccessContext(session: SessionPayload | null): Promise<AccessContext | null> {
  if (!session) return null;

  const userId = session.userId ?? session.id;
  if (!userId) return null;

  const [user, links, companies] = await Promise.all([
    getLocalUserById(userId),
    listLocalLinksForUser(userId),
    listLocalCompanies(),
  ]);

  if (!user || user.active === false || user.status === "blocked") return null;

  const resolvedGlobalRole = normalizeGlobalRole(user.globalRole ?? session.globalRole ?? null);
  const sessionRole = (session.role ?? "").toLowerCase();
  const isGlobalAdmin =
    resolvedGlobalRole === "global_admin" ||
    user.is_global_admin === true ||
    session.isGlobalAdmin === true ||
    sessionRole === "admin";

  const hasDevRole =
    sessionRole === "it_dev" ||
    normalizeLocalRole(user.role ?? null) === "it_dev" ||
    links.some((link) => normalizeLocalRole(link.role ?? null) === "it_dev");
  const activeCompanies = companies.filter(isCompanyActive);
  const hasFullCompanyAccess = isGlobalAdmin || hasDevRole;
  const allowedCompanies = hasFullCompanyAccess
    ? activeCompanies
    : activeCompanies.filter((company) => links.some((link) => link.companyId === company.id));

  const companySlugs = allowedCompanies
    .map((company) => company.slug)
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);

  const primaryCompany =
    allowedCompanies.find((company) => company.id === session.companyId) ??
    allowedCompanies.find((company) => company.slug === session.companySlug) ??
    allowedCompanies.find((company) => company.slug === user.default_company_slug) ??
    allowedCompanies[0] ??
    null;

  const primaryLink = primaryCompany ? links.find((link) => link.companyId === primaryCompany.id) ?? null : null;

  const rawRole = session.companyRole ?? primaryLink?.role ?? user.role ?? null;
  const companyRole = normalizeLocalRole(rawRole);
  const capabilities = resolveCapabilities({
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole:
      companyRole === "company_admin"
        ? "company_admin"
        : companyRole === "it_dev"
          ? "it_dev"
          : companyRole === "viewer"
            ? "viewer"
            : "user",
    membershipCapabilities: primaryLink?.capabilities ?? session.capabilities ?? null,
  });
  const effectiveRole = toLegacyRole(companyRole, isGlobalAdmin);

  return {
    userId: user.id,
    email: user.email,
    isGlobalAdmin,
    role: effectiveRole,
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    capabilities,
    companyId: session.companyId ?? primaryCompany?.id ?? null,
    companySlug: session.companySlug ?? primaryCompany?.slug ?? null,
    companySlugs,
  };
}

export async function getAccessContext(req: Request): Promise<AccessContext | null> {
  const session = await getSessionPayload(req);
  return resolveAccessContext(session);
}

export async function getAccessContextFromStores(
  headerStore: HeaderStore | undefined,
  cookieStore: CookieStore,
): Promise<AccessContext | null> {
  const session = await getSessionPayloadFromStores(headerStore, cookieStore);
  return resolveAccessContext(session);
}
