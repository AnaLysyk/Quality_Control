import { NextResponse } from "next/server";
import { hashRefreshToken } from "@/lib/auth/refreshToken";
import { getRedis } from "@/lib/redis";
import { shouldUseSecureCookies } from "@/lib/auth/cookies";

function readCookieValue(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawKey, ...rest] = cookie.split("=");
    if (rawKey.trim() === name) {
      const value = rest.join("=").trim();
      if (!value.length) return "";
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionId = readCookieValue(cookieHeader, "session_id");
  const refreshToken = readCookieValue(cookieHeader, "refresh_token");

  if (sessionId || refreshToken) {
    const redis = getRedis();
    try {
      if (sessionId) {
        await redis.del(`session:${sessionId}`);
      }
      if (refreshToken) {
        await redis.del(`refresh:${hashRefreshToken(refreshToken)}`);
      }
    } catch (err) {
      console.error("[LOGOUT REDIS ERROR]", err);
    }
  }

  const res = NextResponse.json({ ok: true });
  const secureCookies = shouldUseSecureCookies(req);
  const clear = (name: string) =>
    res.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies,
      path: "/",
      maxAge: 0,
    });

  clear("session_id");
  clear("auth_token");
  clear("access_token");
  clear("refresh_token");
  clear("active_company_slug");

  res.headers.set("Cache-Control", "no-store");

  return res;
}
