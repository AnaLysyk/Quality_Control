import "server-only";

import { getRedis, isRedisConfigured } from "@/lib/redis";

export function canUsePersistentJsonStore(): boolean {
  return isRedisConfigured();
}

export async function readPersistentJson<T>(key: string, fallback: T): Promise<T> {
  if (!canUsePersistentJsonStore()) return fallback;
  try {
    const raw = await getRedis().get<string>(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export async function writePersistentJson<T>(key: string, value: T): Promise<boolean> {
  if (!canUsePersistentJsonStore()) return false;
  try {
    await getRedis().set(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
