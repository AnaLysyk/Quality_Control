import "server-only";

import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

import { getRedis } from "@/lib/redis";
import { getJwtSecret } from "@/lib/auth/jwtSecret";

const DEBUG_AUTH_HEADERS = process.env.DEBUG_AUTH_HEADERS === "true";
const SENSITIVE_HEADER_NAMES = new Set(["authorization", "cookie", "set-cookie", "x-api-key"]);

type AdminSession = {
  id: string;
  email: string;
  token: string;
  role?: string | null;
  isGlobalAdmin?: boolean;
  globalRole?: string | null;
};

type SessionUser = {
  userId?: string;
  id?: string;
  email?: string;
  role?: string;
  isGlobalAdmin?: boolean;
  globalRole?: string | null;
};

export async function extractAccessToken(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice("bearer ".length).trim();
    if (token) return token;
  }

  const store = await cookies();
  return store.get("access_token")?.value || store.get("auth_token")?.value || null;
}

function serializeDebugHeaders(req: Request): Array<[string, string]> {
  if (typeof req.headers?.entries !== "function") return [];

  return Array.from(req.headers.entries()).map(([key, value]) => {
    if (SENSITIVE_HEADER_NAMES.has(key.toLowerCase())) {
      return [key, "[redacted]"];
    }
    if (value.length > 160) {
      return [key, `${value.slice(0, 157)}...`];
    }
    return [key, value];
  });
}

async function readSessionUser(req: Request): Promise<SessionUser | null> {
  if (DEBUG_AUTH_HEADERS) {
    try {
      console.info("[AUTH][readSessionUser] headers:", JSON.stringify(serializeDebugHeaders(req)));
    } catch (error) {
      console.error("[AUTH][readSessionUser] failed to serialize headers:", error);
    }
  }

  // Allows fake auth in E2E runs via test headers.
  let testAdmin = false;
  let testRole = "admin";
  if (req.headers) {
    if (typeof req.headers.get === "function") {
      testAdmin = req.headers.get("x-test-admin") === "true";
      testRole = req.headers.get("x-test-role") || "admin";
    } else if (typeof req.headers.entries === "function") {
      for (const [key, value] of req.headers.entries()) {
        if (key.toLowerCase() === "x-test-admin" && value === "true") testAdmin = true;
        if (key.toLowerCase() === "x-test-role") testRole = value;
      }
    }
  }

  if (testAdmin) {
    if (DEBUG_AUTH_HEADERS) {
      console.info("[AUTH][readSessionUser] testRole:", testRole);
    }
    return {
      userId: "test-admin",
      id: "test-admin",
      email: "admin@teste.com",
      role: testRole,
      isGlobalAdmin: ["admin", "dev", "global_admin", "super-admin"].includes(testRole),
      globalRole: testRole === "admin" || testRole === "global_admin" ? "global_admin" : undefined,
    };
  }

  const token = await extractAccessToken(req);
  if (token) {
    const secret = getJwtSecret();
    if (!secret) {
      const redis = getRedis();
      const raw = await redis.get<string>(`session:${token}`);
      if (!raw) return null;
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return parsed as SessionUser;
      } catch {
        return null;
      }
    }

    try {
      const payload = jwt.verify(token, secret) as jwt.JwtPayload & {
        sub?: string;
        email?: string;
        role?: string;
        isGlobalAdmin?: boolean;
        globalRole?: string | null;
      };
      return {
        userId: typeof payload.sub === "string" ? payload.sub : undefined,
        email: typeof payload.email === "string" ? payload.email : undefined,
        role: typeof payload.role === "string" ? payload.role : undefined,
        isGlobalAdmin: payload.isGlobalAdmin === true,
        globalRole: typeof payload.globalRole === "string" ? payload.globalRole : null,
      };
    } catch {
      // Token exists but is invalid/expired: do not fall back to session_id.
      return null;
    }
  }

  const store = await cookies();
  const sessionId = store.get("session_id")?.value;
  if (!sessionId) return null;

  const redis = getRedis();
  const raw = await redis.get<string>(`session:${sessionId}`);
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed as SessionUser;
  } catch {
    return null;
  }
}

function isAdminRole(role?: string | null) {
  const normalized = (role ?? "").toLowerCase();
  return normalized === "admin" || normalized === "super-admin" || normalized === "global_admin";
}

function isGlobalDeveloperRole(role?: string | null) {
  const normalized = (role ?? "").toLowerCase().trim();
  return normalized === "it_dev" || normalized === "itdev" || normalized === "developer" || normalized === "dev";
}

function isSupportRole(role?: string | null) {
  const normalized = (role ?? "").toLowerCase().trim();
  return (
    normalized === "support" ||
    normalized === "technical_support" ||
    normalized === "tech_support" ||
    normalized === "support_tech"
  );
}

export async function requireGlobalAdmin(
  req: Request,
  opts?: { token?: string | null },
): Promise<AdminSession | null> {
  const session = await readSessionUser(req);
  if (!session) return null;

  const role = session.role ?? null;
  const isGlobalAdmin =
    session.isGlobalAdmin === true || (session.globalRole ?? "").toLowerCase() === "global_admin";
  if (!isGlobalAdmin && !isAdminRole(role)) return null;

  return {
    id: session.userId ?? session.id ?? "",
    email: session.email ?? "",
    token: opts?.token ?? "",
    role,
    isGlobalAdmin,
    globalRole: session.globalRole ?? null,
  };
}

export async function requireGlobalAdminWithStatus(
  req: Request,
  opts?: { token?: string | null },
): Promise<{ admin: AdminSession | null; status: 200 | 401 | 403 }> {
  const admin = await requireGlobalAdmin(req, opts);
  if (admin) return { admin, status: 200 };

  const session = await readSessionUser(req);
  if (!session) return { admin: null, status: 401 };
  return { admin: null, status: 403 };
}

export async function requireGlobalDeveloper(
  req: Request,
  opts?: { token?: string | null },
): Promise<AdminSession | null> {
  const session = await readSessionUser(req);
  if (!session) return null;

  if (!isGlobalDeveloperRole(session.role)) return null;

  return {
    id: session.userId ?? session.id ?? "",
    email: session.email ?? "",
    token: opts?.token ?? "",
    role: session.role ?? null,
    isGlobalAdmin: session.isGlobalAdmin === true,
    globalRole: session.globalRole ?? null,
  };
}

export async function requireGlobalDeveloperWithStatus(
  req: Request,
  opts?: { token?: string | null },
): Promise<{ admin: AdminSession | null; status: 200 | 401 | 403 }> {
  const admin = await requireGlobalDeveloper(req, opts);
  if (admin) return { admin, status: 200 };

  const session = await readSessionUser(req);
  if (!session) return { admin: null, status: 401 };
  return { admin: null, status: 403 };
}

export async function requireAccessRequestReviewer(
  req: Request,
  opts?: { token?: string | null },
): Promise<AdminSession | null> {
  const session = await readSessionUser(req);
  if (!session) return null;

  const role = session.role ?? null;
  const isGlobalAdmin = session.isGlobalAdmin === true || (session.globalRole ?? "").toLowerCase() === "global_admin";

  if (!(isGlobalAdmin || isGlobalDeveloperRole(role) || isSupportRole(role))) return null;

  return {
    id: session.userId ?? session.id ?? "",
    email: session.email ?? "",
    token: opts?.token ?? "",
    role,
    isGlobalAdmin,
    globalRole: session.globalRole ?? null,
  };
}

export async function requireAccessRequestReviewerWithStatus(
  req: Request,
  opts?: { token?: string | null },
): Promise<{ admin: AdminSession | null; status: 200 | 401 | 403 }> {
  const admin = await requireAccessRequestReviewer(req, opts);
  if (admin) return { admin, status: 200 };

  const session = await readSessionUser(req);
  if (!session) return { admin: null, status: 401 };
  return { admin: null, status: 403 };
}

export type { AdminSession };
