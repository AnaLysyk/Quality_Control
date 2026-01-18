import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

// Simple IP-based rate limiter (30 req/min default)
export async function rateLimit(req: Request, key: string, limit = 30, windowSec = 60) {
  const redis = getRedis();
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `ratelimit:${key}:${now - (now % windowSec)}`;
  const count = (await redis.get<number>(windowKey)) || 0;
  if (count >= limit) {
    return {
      limited: true,
      response: NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    };
  }
  await redis.set(windowKey, String(count + 1), { ex: windowSec });
  return { limited: false };
}
