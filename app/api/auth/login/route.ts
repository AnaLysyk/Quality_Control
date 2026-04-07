import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";

import { hashPasswordSha256, safeEqualHex } from "@/lib/passwordHash";
import { shouldUseSecureCookies } from "@/lib/auth/cookies";
import { createRefreshToken, hashRefreshToken } from "@/lib/auth/refreshToken";
import { buildLocalSessionForUser } from "@/lib/auth/sessionBuilder";
import { getRedis } from "@/lib/redis";
import { findLocalUserByEmailOrId } from "@/lib/auth/localStore";
import { getJwtSecret } from "@/lib/auth/jwtSecret";
import { addAuditLogSafe } from "@/data/auditLogRepository";

const SESSION_TTL_SECONDS = 60 * 60 * 8;
const DEFAULT_REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;

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
    const body = await req.json().catch(() => null);
    const login = typeof body?.login === "string" ? body.login.trim() : "";
    const userInput = typeof body?.user === "string" ? body.user.trim() : "";
    const usuarioInput = typeof body?.usuario === "string" ? body.usuario.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const identifier = userInput || usuarioInput || login;

    if (!identifier || !password) {
      return NextResponse.json({ error: "Usuario e senha obrigatorios" }, { status: 400 });
    }

    const user = await findLocalUserByEmailOrId(identifier);
    if (!user || user.active === false || user.status === "blocked") {
      addAuditLogSafe({
        actorEmail: identifier,
        action: "auth.login.failure",
        entityType: "user",
        entityLabel: identifier,
        metadata: { reason: !user ? "user_not_found" : "account_inactive", ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null },
      });
      return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
    }

    const hashedInput = hashPasswordSha256(password);
    if (!safeEqualHex(hashedInput, user.password_hash)) {
      addAuditLogSafe({
        actorEmail: user.email ?? identifier,
        actorUserId: user.id,
        action: "auth.login.failure",
        entityType: "user",
        entityId: user.id,
        entityLabel: user.user ?? user.email ?? identifier,
        metadata: { reason: "invalid_password", ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null },
      });
      return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
    }

    const requestedSlug =
      (typeof body?.clientSlug === "string" && body.clientSlug.trim()) ||
      (typeof body?.companySlug === "string" && body.companySlug.trim()) ||
      "";

    const built = await buildLocalSessionForUser(user.id, { requestedSlug });
    if (!built) {
      return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
    }

    const accessTtlSeconds = readPositiveIntEnv("ACCESS_TOKEN_TTL_SECONDS", SESSION_TTL_SECONDS);
    const refreshTtlSeconds = readPositiveIntEnv("REFRESH_TOKEN_TTL_SECONDS", DEFAULT_REFRESH_TTL_SECONDS);

    const sessionId = randomUUID();
    const redis = getRedis();
    await redis.set(`session:${sessionId}`, JSON.stringify(built.session), { ex: SESSION_TTL_SECONDS });

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
    setCookie(res, "session_id", sessionId, refreshToken ? accessTtlSeconds : SESSION_TTL_SECONDS, secureCookies);
    // Sempre expõe um token para manter compatibilidade no middleware.
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
      // Mantem o contexto de empresa escolhido (admin ou company) apos login.
      setCookie(
        res,
        "active_company_slug",
        built.requestedCompanySlug,
        refreshToken ? refreshTtlSeconds : SESSION_TTL_SECONDS,
        secureCookies,
      );
    } else {
      // Limpa o contexto salvo quando o login nao especifica empresa.
      res.cookies.set("active_company_slug", "", {
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookies,
        path: "/",
        maxAge: 0,
      });
    }

    addAuditLogSafe({
      actorUserId: user.id,
      actorEmail: user.email ?? identifier,
      action: "auth.login.success",
      entityType: "user",
      entityId: user.id,
      entityLabel: user.user ?? user.email ?? identifier,
      metadata: { role: user.role ?? null, companySlug: built.requestedCompanySlug || null, ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null },
    });

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[LOGIN ERROR]", err);
    return NextResponse.json({ error: "Erro interno: " + message }, { status: 500 });
  }
}
