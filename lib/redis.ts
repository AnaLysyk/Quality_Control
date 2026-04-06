import "server-only";

import { Redis } from "@upstash/redis";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prismaClient";
import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";

type RedisValue = {
  value: string;
  expiresAt?: number;
};

class InMemoryRedis {
  private store = new Map<string, RedisValue>();

  private isExpired(entry: RedisValue): boolean {
    return !!(entry.expiresAt && Date.now() > entry.expiresAt);
  }

  private expireEntryIfNeeded(key: string, entry: RedisValue): boolean {
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return true;
    }
    return false;
  }

  async set(key: string, value: string, opts?: { ex?: number }) {
    const entry: RedisValue = { value };
    if (opts?.ex) {
      entry.expiresAt = Date.now() + opts.ex * 1000;
    }
    this.store.set(key, entry);
    return "OK";
  }

  async get<T = string>(key: string) {
    const entry = this.store.get(key);
    if (!entry || this.expireEntryIfNeeded(key, entry)) {
      return null;
    }
    return entry.value as unknown as T;
  }

  async del(key: string) {
    return this.store.delete(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number) {
    const entry = this.store.get(key);
    if (!entry || this.expireEntryIfNeeded(key, entry)) {
      return 0;
    }
    entry.expiresAt = Date.now() + seconds * 1000;
    this.store.set(key, entry);
    return 1;
  }

  async incr(key: string) {
    const currentRaw = await this.get<string>(key);
    const current = Number.parseInt(String(currentRaw ?? "0"), 10);
    const next = Number.isFinite(current) ? current + 1 : 1;
    await this.set(key, String(next));
    return next;
  }

  async keys(pattern: string) {
    const regex = patternToRegex(pattern);
    return Array.from(this.store.keys()).filter((key) => {
      const entry = this.store.get(key);
      if (!entry || this.expireEntryIfNeeded(key, entry)) {
        return false;
      }
      return regex.test(key);
    });
  }
}

class PostgresRedis {
  private async deleteExpiredKeyIfNeeded(row: { key: string; expiresAt: Date | null }) {
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
      await prisma.$executeRaw`DELETE FROM "persistent_kv" WHERE "key" = ${row.key}`;
      return true;
    }
    return false;
  }

  private async readActiveEntry(key: string) {
    const rows = await prisma.$queryRaw<Array<{ key: string; value: string; expiresAt: Date | null }>>`
      SELECT "key", "value", "expiresAt"
      FROM "persistent_kv"
      WHERE "key" = ${key}
      LIMIT 1
    `;
    const row = rows[0] ?? null;
    if (!row) return null;
    if (await this.deleteExpiredKeyIfNeeded({ key: row.key, expiresAt: row.expiresAt })) {
      return null;
    }
    return row;
  }

  async set(key: string, value: string, opts?: { ex?: number }) {
    const expiresAt = opts?.ex ? new Date(Date.now() + opts.ex * 1000) : null;
    await prisma.$executeRaw`
      INSERT INTO "persistent_kv" ("key", "value", "expiresAt", "createdAt", "updatedAt")
      VALUES (${key}, ${value}, ${expiresAt}, NOW(), NOW())
      ON CONFLICT ("key")
      DO UPDATE SET
        "value" = EXCLUDED."value",
        "expiresAt" = EXCLUDED."expiresAt",
        "updatedAt" = NOW()
    `;
    return "OK";
  }

  async get<T = string>(key: string) {
    const row = await this.readActiveEntry(key);
    return row ? (row.value as unknown as T) : null;
  }

  async del(key: string) {
    return prisma.$executeRaw`DELETE FROM "persistent_kv" WHERE "key" = ${key}`;
  }

  async expire(key: string, seconds: number) {
    const row = await this.readActiveEntry(key);
    if (!row) return 0;
    await prisma.$executeRaw`
      UPDATE "persistent_kv"
      SET "expiresAt" = ${new Date(Date.now() + seconds * 1000)}, "updatedAt" = NOW()
      WHERE "key" = ${key}
    `;
    return 1;
  }

  async incr(key: string) {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ key: string; value: string; expiresAt: Date | null }>>`
        SELECT "key", "value", "expiresAt"
        FROM "persistent_kv"
        WHERE "key" = ${key}
        LIMIT 1
      `;
      const row = rows[0] ?? null;
      if (!row || (row.expiresAt && row.expiresAt.getTime() <= Date.now())) {
        await tx.$executeRaw`
          INSERT INTO "persistent_kv" ("key", "value", "expiresAt", "createdAt", "updatedAt")
          VALUES (${key}, ${"1"}, ${null}, NOW(), NOW())
          ON CONFLICT ("key")
          DO UPDATE SET
            "value" = ${"1"},
            "expiresAt" = NULL,
            "updatedAt" = NOW()
        `;
        return 1;
      }

      const current = Number.parseInt(row.value, 10);
      const next = Number.isFinite(current) ? current + 1 : 1;
      await tx.$executeRaw`
        UPDATE "persistent_kv"
        SET "value" = ${String(next)}, "expiresAt" = ${row.expiresAt}, "updatedAt" = NOW()
        WHERE "key" = ${key}
      `;
      return next;
    });
  }

  async keys(pattern: string) {
    const regex = patternToRegex(pattern);
    const rows = await prisma.$queryRaw<Array<{ key: string; expiresAt: Date | null }>>`
      SELECT "key", "expiresAt"
      FROM "persistent_kv"
    `;
    const now = Date.now();
    const expiredKeys = rows
      .filter((row) => row.expiresAt && row.expiresAt.getTime() <= now)
      .map((row) => row.key);

    if (expiredKeys.length > 0) {
      await prisma.$executeRaw`
        DELETE FROM "persistent_kv"
        WHERE "key" IN (${Prisma.join(expiredKeys)})
      `;
    }

    return rows
      .filter((row) => !row.expiresAt || row.expiresAt.getTime() > now)
      .map((row) => row.key)
      .filter((key) => regex.test(key));
  }
}

function patternToRegex(pattern: string): RegExp {
  const parts = pattern.split("*").map((segment) => escapeRegex(segment));
  return new RegExp(`^${parts.join(".*")}$`);
}

function escapeRegex(value: string): string {
  return value.replace(/[-[\]{}()+?.,\\^$|#]/g, "\\$0");
}

type RedisClient = Redis | InMemoryRedis | PostgresRedis;

let redis: RedisClient | null = null;
let mockRedis: InMemoryRedis | null = null;
let postgresRedis: PostgresRedis | null = null;
let warnedRedisMissing = false;

function resolveRedisEnv(): { url: string; token: string } | null {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    return { url: kvUrl, token: kvToken };
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) {
    return { url: upstashUrl, token: upstashToken };
  }

  return null;
}

function canUsePersistentFallback() {
  return shouldUsePostgresPersistence();
}

export function getRedis() {
  if (redis) return redis;

  const resolved = resolveRedisEnv();
  const url = resolved?.url;
  const token = resolved?.token;

  if (!url || !token) {
    if (canUsePersistentFallback()) {
      postgresRedis = postgresRedis ?? new PostgresRedis();
      redis = postgresRedis;
      if (!warnedRedisMissing) {
        warnedRedisMissing = true;
        console.warn(
          "[REDIS] UPSTASH_REDIS_REST_URL/TOKEN ou KV_REST_API_URL/TOKEN ausentes; usando fallback persistente em PostgreSQL.",
        );
      }
      return redis;
    }

    mockRedis = mockRedis ?? new InMemoryRedis();
    redis = mockRedis;
    if (!warnedRedisMissing) {
      warnedRedisMissing = true;
      console.warn(
        "[REDIS] UPSTASH_REDIS_REST_URL/TOKEN ou KV_REST_API_URL/TOKEN ausentes; usando fallback em memoria (nao persistente).",
      );
    }
    return redis;
  }

  redis = new Redis({ url, token });
  return redis;
}

// For compatibility with old imports
export { redis };

export function isRedisConfigured(): boolean {
  return resolveRedisEnv() !== null || canUsePersistentFallback();
}

export function assertRedisConfigured(feature = "This feature") {
  if (!isRedisConfigured()) {
    throw new Error(
      `[REDIS] ${feature} requires Redis or DATABASE_URL-backed persistence. Configure KV_REST_API_URL/KV_REST_API_TOKEN, UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN, or DATABASE_URL.`,
    );
  }
}
