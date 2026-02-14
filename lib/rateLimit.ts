import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

/**
 * Limitador simples de requisições baseado em chave/IP usando Redis.
 * @param req Request original
 * @param key Chave única (ex: IP ou userId)
 * @param limit Limite de requisições por janela (default: 30)
 * @param windowSec Duração da janela em segundos (default: 60)
 * @returns { limited: boolean, response?: NextResponse }
 */
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
