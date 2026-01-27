import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { fetchBackend } from "@/lib/backendProxy";

function getSessionId(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(/session_id=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function POST(req: Request) {
  const backendRes = await fetchBackend(req, "/auth/logout", { method: "POST" });
  if (backendRes) {
    const res = NextResponse.json({ ok: true });
    const setCookie = backendRes.headers.get("set-cookie");
    if (setCookie) res.headers.set("set-cookie", setCookie);
    res.cookies.set("session_id", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return res;
  }

  const sessionId = getSessionId(req);

  if (sessionId) {
    const redis = getRedis();
    await redis.del(`session:${sessionId}`);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("session_id", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });

  return res;
}
