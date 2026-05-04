import { NextResponse } from "next/server";
import { hashRefreshToken } from "@/lib/auth/refreshToken";
import { getRedis } from "@/lib/redis";
import { shouldUseSecureCookies } from "@/lib/auth/cookies";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { COMPANY_ROUTE_MODE_COOKIE } from "@/lib/companyRoutes";

function readCookieValue(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((segment) => segment.trim());
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split("=");
    if (key === name) {
      const value = rest.join("=").trim();
      return value.length ? decodeURIComponent(value) : "";
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
    if (sessionId) {
    await redis.del(`session:${sessionId}`);
    }
    if (refreshToken) {
      await redis.del(`refresh:${hashRefreshToken(refreshToken)}`);
    }
  }

  addAuditLogSafe({
    action: "auth.logout",
    entityType: "user",
    metadata: { sessionId: sessionId ? `${sessionId.slice(0, 8)}...` : null },
  });

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
  clear(COMPANY_ROUTE_MODE_COOKIE);

  return res;
}
