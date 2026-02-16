import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";

import { verifyPassword } from "@/lib/passwordHash";
import { shouldUseSecureCookies } from "@/lib/auth/cookies";
import { createRefreshToken, hashRefreshToken } from "@/lib/auth/refreshToken";
import { buildLocalSessionForUser } from "@/lib/auth/sessionBuilder";
import { getRedis } from "@/lib/redis";
import { findLocalUserByEmailOrId } from "@/lib/auth/localStore";
import { getJwtSecret } from "@/lib/auth/jwtSecret";
import { checkLoginRateLimit } from "@/lib/auth/rateLimitLogin";
import { authLog } from "@/lib/auth/authLog";
import { hasMinRole, Role } from "@/lib/rbac/roleLevels";


type RawLoginBody = {
  login?: unknown;
  user?: unknown;
  usuario?: unknown;
  password?: unknown;
  clientSlug?: unknown;
  companySlug?: unknown;
};

function normalizeLoginBody(body: RawLoginBody) {
  const loginRaw = body.login ?? body.user ?? body.usuario ?? null;
  if (typeof loginRaw !== "string" || typeof body.password !== "string") {
    return { ok: false as const, error: "CREDENCIAIS_OBRIGATORIAS" };
  }
  const login = loginRaw.trim();
  if (!login || !body.password) {
    return { ok: false as const, error: "CREDENCIAIS_OBRIGATORIAS" };
  }
  if (login.length > 120 || body.password.length > 200) {
    return { ok: false as const, error: "CREDENCIAIS_TAMANHO_INVALIDO" };
  }
  return { ok: true as const, login, password: body.password, clientSlug: body.clientSlug, companySlug: body.companySlug };
}

const SESSION_TTL_SECONDS = 60 * 60 * 8;
const DEFAULT_REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_IDENTIFIER_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 1024;

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function setCookie(res: NextResponse, name: string, value: string, maxAgeSeconds: number, secure: boolean) {
  res.cookies.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

function buildAuthToken(payload: Record<string, unknown>, ttlSeconds: number) {
  const secret = getJwtSecret();
  if (!secret) return null;
  return jwt.sign(payload, secret, { expiresIn: `${ttlSeconds}s` });
}


export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "CONTENT_TYPE_INVALIDO" }, { status: 415 });
    }

    const contentLengthHeader = req.headers.get("content-length");
    if (contentLengthHeader) {
      const parsedLength = Number.parseInt(contentLengthHeader, 10);
      if (Number.isFinite(parsedLength) && parsedLength > MAX_REQUEST_BYTES) {
        return NextResponse.json({ error: "PAYLOAD_MUITO_GRANDE" }, { status: 413 });
      }
    }

    let parsed: unknown;
    try {
      parsed = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON_INVALIDO" }, { status: 400 });
    }

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ error: "PAYLOAD_INVALIDO" }, { status: 400 });
    }

    // Normaliza e valida payload
    const norm = normalizeLoginBody(parsed as RawLoginBody);
    if (!norm.ok) {
      authLog("login_failure", {
        login_normalizado: norm.login ?? null,
        motivo: norm.error,
        ip_hash: req.headers.get("x-forwarded-for") || null,
        user_agent_hash: req.headers.get("user-agent") || null,
      });
      return NextResponse.json({ error: norm.error }, { status: 400 });
    }
    const login = norm.login;
    const password = norm.password;
    // Hash IP para rate limit (pode customizar para hash real)
    const ipHash = req.headers.get("x-forwarded-for") || "local";
    // Rate limit por IP+login
    const rl = await checkLoginRateLimit(ipHash, login);
    if (rl.blocked) {
      authLog("login_rate_limited", {
        login_normalizado: login,
        ip_hash: ipHash,
        motivo: "rate_limit_excedido"
      });
      return NextResponse.json(
        { error: "MUITAS_TENTATIVAS" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const user = await findLocalUserByEmailOrId(login);
    if (!user || user.active === false || user.status === "blocked") {
      authLog("login_failure", {
        login_normalizado: login,
        motivo: "CREDENCIAIS_INVALIDAS",
        ip_hash: ipHash,
        user_agent_hash: req.headers.get("user-agent") || null,
      });
      return NextResponse.json({ error: "CREDENCIAIS_INVALIDAS" }, { status: 401 });
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      authLog("login_failure", {
        login_normalizado: login,
        motivo: "CREDENCIAIS_INVALIDAS",
        ip_hash: ipHash,
        user_agent_hash: req.headers.get("user-agent") || null,
      });
      return NextResponse.json({ error: "CREDENCIAIS_INVALIDAS" }, { status: 401 });
    }

    // RBAC: Exemplo de uso (bloqueia login de EMPRESA em endpoint só para USUARIO+)
    // if (!hasMinRole(user.role as Role, "USUARIO")) {
    //   authLog("login_failure", {
    //     login_normalizado: login,
    //     motivo: "ACESSO_NEGADO",
    //     ip_hash: ipHash,
    //     user_agent_hash: req.headers.get("user-agent") || null,
    //   });
    //   return NextResponse.json({ error: "ACESSO_NEGADO" }, { status: 403 });
    // }

    const requestedSlug =
      (typeof norm?.clientSlug === "string" && norm.clientSlug.trim()) ||
      (typeof norm?.companySlug === "string" && norm.companySlug.trim()) ||
      "";

    const built = await buildLocalSessionForUser(user.id, { requestedSlug });
    if (!built) {
      authLog("login_failure", {
        login_normalizado: login,
        motivo: "CREDENCIAIS_INVALIDAS",
        ip_hash: ipHash,
        user_agent_hash: req.headers.get("user-agent") || null,
      });
      return NextResponse.json({ error: "CREDENCIAIS_INVALIDAS" }, { status: 401 });
    }

    const accessTtlSeconds = readPositiveIntEnv("ACCESS_TOKEN_TTL_SECONDS", SESSION_TTL_SECONDS);
    const refreshTtlSeconds = readPositiveIntEnv("REFRESH_TOKEN_TTL_SECONDS", DEFAULT_REFRESH_TTL_SECONDS);

    const sessionId = randomUUID();
    const redis = getRedis();
    const sessionTtlSeconds = accessTtlSeconds;
    await redis.set(`session:${sessionId}`, JSON.stringify(built.session), { ex: sessionTtlSeconds });

    const accessToken = buildAuthToken(built.jwt, accessTtlSeconds);
    const tokenToExpose = accessToken ?? sessionId;

    const refreshToken = accessToken ? createRefreshToken() : null;
    if (refreshToken) {
      const refreshHash = hashRefreshToken(refreshToken);
      await redis.set(
        `refresh:${refreshHash}`,
        JSON.stringify({ v: 1, userId: user.id, createdAt: Date.now() }),
        { ex: refreshTtlSeconds },
      );
    }
    const secureCookies = shouldUseSecureCookies(req);
    const res = NextResponse.json({
      ok: true,
      session: {
        access_token: tokenToExpose,
        token_type: "Bearer",
        expires_in: accessTtlSeconds,
      },
    });
    res.headers.set("Cache-Control", "no-store");

    setCookie(res, "session_id", sessionId, sessionTtlSeconds, secureCookies);
    setCookie(res, "access_token", tokenToExpose, accessTtlSeconds, secureCookies);
    setCookie(res, "auth_token", tokenToExpose, accessTtlSeconds, secureCookies);
    if (refreshToken) {
      setCookie(res, "refresh_token", refreshToken, refreshTtlSeconds, secureCookies);
    } else {
      res.cookies.set("refresh_token", "", {
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookies,
        path: "/",
        maxAge: 0,
      });
    }

    if (built.requestedCompanySlug) {
      setCookie(
        res,
        "active_company_slug",
        built.requestedCompanySlug,
        refreshToken ? refreshTtlSeconds : sessionTtlSeconds,
        secureCookies,
      );
    } else {
      res.cookies.set("active_company_slug", "", {
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookies,
        path: "/",
        maxAge: 0,
      });
    }

    authLog("login_success", {
      login_normalizado: login,
      ip_hash: ipHash,
      user_agent_hash: req.headers.get("user-agent") || null,
      resultado: "ok"
    });

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    authLog("login_error", { motivo: message });
    return NextResponse.json({ error: "ERRO_INTERNO" }, { status: 500 });
  }
}
