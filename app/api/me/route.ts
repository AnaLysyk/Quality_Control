// Use dynamic import for the supabase server helper so tests that mock
// the module get the mocked exports at runtime.
import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";


function getSessionIdFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/session_id=([^;]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  return null;
}


export async function GET(req: Request) {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return NextResponse.json({ user: null, error: { code: "NO_SESSION" } }, { status: 401 });
  }
  const redis = getRedis();
  const raw = await redis.get(`session:${sessionId}`);
  if (!raw) {
    return NextResponse.json({ user: null, error: { code: "INVALID_SESSION" } }, { status: 401 });
  }
  const user = typeof raw === "string" ? JSON.parse(raw) : raw;

  // Sliding TTL: renovar sessão no Redis e cookie
  await redis.expire(`session:${sessionId}`, 60 * 60 * 8); // 8 horas

  const res = NextResponse.json({ user });
  res.cookies.set("session_id", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 horas
  });

  return res;
}

// PATCH não suportado neste modelo minimalista
export async function PATCH() {
  return NextResponse.json({ error: "Not implemented" }, { status: 405 });
}
