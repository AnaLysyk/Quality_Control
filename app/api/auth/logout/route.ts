import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

function getSessionId(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(/session_id=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function POST(req: Request) {
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
