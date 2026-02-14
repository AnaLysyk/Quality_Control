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

type LoginRequest = {
  login?: string;
  user?: string;
  usuario?: string;
  password?: string;
  clientSlug?: string;
  companySlug?: string;
};

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
      return NextResponse.json({ error: "Content-Type invalido" }, { status: 415 });
    }

    const contentLengthHeader = req.headers.get("content-length");
    if (contentLengthHeader) {
      const parsedLength = Number.parseInt(contentLengthHeader, 10);
      if (Number.isFinite(parsedLength) && parsedLength > MAX_REQUEST_BYTES) {
        return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
      }
    }

    let parsed: unknown;
    try {
      parsed = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
    }

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
    }

    const body = parsed as LoginRequest;

    const login = typeof body.login === "string" ? body.login.trim() : "";
    const userInput = typeof body.user === "string" ? body.user.trim() : "";
    const usuarioInput = typeof body.usuario === "string" ? body.usuario.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const identifierRaw = userInput || usuarioInput || login || "";
    const normalizedIdentifier = identifierRaw.includes("@") ? identifierRaw.toLowerCase() : identifierRaw;

    if (!normalizedIdentifier || !password) {
      return NextResponse.json({ error: "Usuario e senha obrigatorios" }, { status: 400 });
    }

    if (normalizedIdentifier.length > MAX_IDENTIFIER_LENGTH) {
      return NextResponse.json({ error: "Usuario invalido" }, { status: 400 });
    }

    if (password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json({ error: "Senha invalida" }, { status: 400 });
    }

    const user = await findLocalUserByEmailOrId(normalizedIdentifier);
    if (!user || user.active === false || user.status === "blocked") {
      return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
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
        refreshToken ? refreshTtlSeconds : sessionTtlSeconds,
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

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[LOGIN ERROR]", err);
    return NextResponse.json({ error: "Erro interno: " + message }, { status: 500 });
  }
}
