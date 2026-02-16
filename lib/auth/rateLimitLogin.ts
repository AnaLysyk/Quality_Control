// Simple Redis-based rate limit for login attempts
import { getRedis } from "@/lib/redis";

export async function checkLoginRateLimit(ipHash: string, login: string, limit = 5, windowSec = 300) {
  const redis = await getRedis();
  const key = `login:rl:${ipHash}:${login}`;
  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, windowSec);
  if (current > limit) return { blocked: true, retryAfter: windowSec };
  return { blocked: false };
}
