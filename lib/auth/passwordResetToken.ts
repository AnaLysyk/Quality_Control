import { createHash } from "crypto";

import { getRedis } from "@/lib/redis";

const RESET_TOKEN_TTL_SECONDS = 15 * 60;

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashedResetTokenKey(token: string) {
  return `reset:v2:${hashPasswordResetToken(token)}`;
}

function legacyResetTokenKey(token: string) {
  return `reset:${token}`;
}

export async function storePasswordResetToken(token: string, userId: string) {
  const redis = getRedis();
  await redis.set(hashedResetTokenKey(token), userId, { ex: RESET_TOKEN_TTL_SECONDS });
}

export async function consumePasswordResetToken(token: string) {
  const redis = getRedis();
  const hashedKey = hashedResetTokenKey(token);
  const legacyKey = legacyResetTokenKey(token);

  const userId = (await redis.get<string>(hashedKey)) ?? (await redis.get<string>(legacyKey));
  if (!userId) return null;

  await Promise.all([redis.del(hashedKey), redis.del(legacyKey)]);
  return userId;
}

export async function hasPasswordResetToken(token: string) {
  const redis = getRedis();
  const userId = (await redis.get<string>(hashedResetTokenKey(token))) ?? (await redis.get<string>(legacyResetTokenKey(token)));
  return Boolean(userId);
}
