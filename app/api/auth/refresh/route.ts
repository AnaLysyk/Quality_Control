import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

import { buildLocalSessionForUser } from "@/lib/auth/sessionBuilder";
import { createRefreshToken, hashRefreshToken } from "@/lib/auth/refreshToken";
import { getRedis } from "@/lib/redis";
import { shouldUseSecureCookies } from "@/lib/auth/cookies";
import { getJwtSecret } from "@/lib/auth/jwtSecret";

const DEFAULT_ACCESS_TTL_SECONDS = 60 * 60 * 8;
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

type RefreshRecord = {
  v?: number;
  userId?: string;
};

export async function POST(req: Request) {
  const secret = getJwtSecret();
  if (!secret) {
    return NextResponse.json({ error: "JWT_SECRET ausente; refresh desativado" }, { status: 501 });
  }

  const accessTtlSeconds = readPositiveIntEnv("ACCESS_TOKEN_TTL_SECONDS", DEFAULT_ACCESS_TTL_SECONDS);
  const refreshTtlSeconds = readPositiveIntEnv("REFRESH_TOKEN_TTL_SECONDS", DEFAULT_REFRESH_TTL_SECONDS);

  const cookieHeader = req.headers.get("cookie") ?? "";
  const refreshToken = readCookieValue(cookieHeader, "refresh_token");
  if (!refreshToken) {
    return NextResponse.json({ error: "Refresh token invalido" }, { status: 401 });
  }

  const redis = getRedis();
  const refreshHash = hashRefreshToken(refreshToken);
  const refreshKey = `refresh:${refreshHash}`;
  let stored: string | null = null;
  try {
    stored = await redis.get<string>(refreshKey);
  } catch (err) {
    console.error("[REFRESH REDIS GET ERROR]", err);
    return NextResponse.json({ error: "Servico de autenticacao indisponivel" }, { status: 503 });
  }
  if (!stored) {
    return NextResponse.json({ error: "Refresh token invalido" }, { status: 401 });
  }

  let record: RefreshRecord | null = null;
  try {
    record = (typeof stored === "string" ? JSON.parse(stored) : stored) as RefreshRecord;
  } catch {
    record = null;
  }

  const userId = record && typeof record.userId === "string" ? record.userId : null;
  if (!userId) {
    try {
      await redis.del(refreshKey);
    } catch (err) {
      console.error("[REFRESH REDIS DEL ERROR]", err);
    }
    return NextResponse.json({ error: "Refresh token invalido" }, { status: 401 });
  }

  const requestedCompanySlug = readCookieValue(cookieHeader, "active_company_slug");
  const built = await buildLocalSessionForUser(userId, { requestedSlug: requestedCompanySlug });
  if (!built) {
    try {
      await redis.del(refreshKey);
    } catch (err) {
      console.error("[REFRESH REDIS DEL ERROR]", err);
    }
    return NextResponse.json({ error: "Refresh token invalido" }, { status: 401 });
  }

  // Rotation: invalidate old refresh, create new one.
  try {
    await redis.del(refreshKey);
  } catch (err) {
    console.error("[REFRESH REDIS DEL ERROR]", err);
  }
  const nextRefreshToken = createRefreshToken();
  const nextRefreshHash = hashRefreshToken(nextRefreshToken);
  try {
    await redis.set(
      `refresh:${nextRefreshHash}`,
      JSON.stringify({ v: 1, userId, createdAt: Date.now() }),
      { ex: refreshTtlSeconds },
    );
  } catch (err) {
    console.error("[REFRESH REDIS SET ERROR]", err);
    return NextResponse.json({ error: "Servico de autenticacao indisponivel" }, { status: 503 });
  }

  const accessToken = jwt.sign(built.jwt, secret, {
    expiresIn: `${accessTtlSeconds}s`,
    algorithm: "HS256",
  });

  const secureCookies = shouldUseSecureCookies(req);
  const res = NextResponse.json({
    ok: true,
    session: {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: accessTtlSeconds,
    },
  });

  res.headers.set("Cache-Control", "no-store");

  setCookie(res, "access_token", accessToken, accessTtlSeconds, secureCookies);
  // Legacy alias.
  setCookie(res, "auth_token", accessToken, accessTtlSeconds, secureCookies);
  setCookie(res, "refresh_token", nextRefreshToken, refreshTtlSeconds, secureCookies);

  return res;
}
