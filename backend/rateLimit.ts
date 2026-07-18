import { createHash } from "crypto";
import { NextResponse } from "next/server";

import { getRedis } from "@/backend/redis";

function clientFingerprint(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || req.headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(address.slice(0, 128)).digest("hex").slice(0, 24);
}

// Fixed-window limiter. Chaves persistidas são opacas e vinculadas à origem.
export async function rateLimit(req: Request, key: string, limit = 30, windowSec = 60) {
  const redis = getRedis();
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSec);
  const opaqueKey = createHash("sha256").update(key.slice(0, 512)).digest("hex").slice(0, 32);
  const windowKey = `ratelimit:v2:${clientFingerprint(req)}:${opaqueKey}:${windowStart}`;
  const count = await redis.incr(windowKey);

  if (count === 1) {
    await redis.expire(windowKey, windowSec + 1);
  }
  if (count > limit) {
    const retryAfter = Math.max(1, windowSec - (now - windowStart));
    return {
      limited: true,
      response: NextResponse.json(
        { error: "Muitas tentativas. Tente novamente mais tarde." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      ),
    };
  }

  return { limited: false };
}
