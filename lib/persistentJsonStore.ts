import "server-only";

import { getRedis, isRedisConfigured } from "@/lib/redis";
import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";

const USE_POSTGRES = shouldUsePostgresPersistence();

async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

export function canUsePersistentJsonStore(): boolean {
  return USE_POSTGRES || isRedisConfigured();
}

export async function readPersistentJson<T>(key: string, fallback: T): Promise<T> {
  if (!canUsePersistentJsonStore()) return fallback;

  if (USE_POSTGRES) {
    try {
      const prisma = await getPrisma();
      const row = await prisma.persistentKeyValue.findUnique({ where: { key } });
      if (!row) return fallback;
      const parsed = JSON.parse(row.value) as T;
      return (parsed ?? fallback) as T;
    } catch {
      return fallback;
    }
  }

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

  if (USE_POSTGRES) {
    try {
      const prisma = await getPrisma();
      await prisma.persistentKeyValue.upsert({
        where: { key },
        update: { value: JSON.stringify(value) },
        create: { key, value: JSON.stringify(value) },
      });
      return true;
    } catch {
      return false;
    }
  }

  try {
    await getRedis().set(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
