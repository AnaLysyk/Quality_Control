import "server-only";

import { Redis } from "@upstash/redis";
import { Prisma } from "@prisma/client";
import { prisma } from "@/database/prismaClient";
import { shouldUsePostgresPersistence } from "@/database/persistenceMode";

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
    // Upsert atômico numa única ida ao banco (sem `$transaction`, que precisa
    // reservar uma conexão dedicada por 2 round-trips e vinha estourando o
    // timeout do pool sob carga: "Unable to start a transaction in the given
    // time"). O INSERT ... ON CONFLICT já garante atomicidade no Postgres.
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "persistent_kv" ("key", "value", "expiresAt", "createdAt", "updatedAt")
      VALUES (${key}, '1', NULL, NOW(), NOW())
      ON CONFLICT ("key") DO UPDATE SET
        "value" = CASE
          WHEN "persistent_kv"."expiresAt" IS NOT NULL AND "persistent_kv"."expiresAt" <= NOW() THEN '1'
          WHEN "persistent_kv"."value" ~ '^[0-9]+$' THEN ("persistent_kv"."value"::bigint + 1)::text
          ELSE '1'
        END,
        "expiresAt" = CASE
          WHEN "persistent_kv"."expiresAt" IS NOT NULL AND "persistent_kv"."expiresAt" <= NOW() THEN NULL
          ELSE "persistent_kv"."expiresAt"
        END,
        "updatedAt" = NOW()
      RETURNING "value"
    `;
    const next = Number.parseInt(rows[0]?.value ?? "1", 10);
    return Number.isFinite(next) ? next : 1;
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
  return value.replace(/[-[\]{}()+?.,\\^$|#]/g, "\\$&");
}

type RedisClient = Redis | InMemoryRedis | PostgresRedis;

let redisClient: RedisClient | null = null;
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

function shouldUseMemoryFallback() {
  const fallback = (process.env.REDIS_FALLBACK ?? process.env.REDIS_STORE ?? "").trim().toLowerCase();
  return fallback === "memory" || fallback === "mock" || fallback === "in-memory";
}

export function getRedis() {
  if (redisClient) return redisClient;

  const resolved = resolveRedisEnv();
  const url = resolved?.url;
  const token = resolved?.token;

  if (!url || !token) {
    if (canUsePersistentFallback() && !shouldUseMemoryFallback()) {
      postgresRedis = postgresRedis ?? new PostgresRedis();
      redisClient = postgresRedis;
      if (!warnedRedisMissing) {
        warnedRedisMissing = true;
        console.warn(
          "[REDIS] Redis REST nao configurado; usando fallback persistente em PostgreSQL.",
        );
      }
      return redisClient;
    }

    mockRedis = mockRedis ?? new InMemoryRedis();
    redisClient = mockRedis;
    if (!warnedRedisMissing) {
      warnedRedisMissing = true;
      console.warn(
        "[REDIS] UPSTASH_REDIS_REST_URL/TOKEN ou KV_REST_API_URL/TOKEN ausentes; usando fallback em memoria (nao persistente).",
      );
    }
    return redisClient;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

function createRedisClientProxy(): RedisClient {
  return new Proxy({} as RedisClient, {
    get(_target, prop) {
      const client = getRedis();
      const value = Reflect.get(client as object, prop, client);
      return typeof value === "function" ? value.bind(client) : value;
    },
    set(_target, prop, value) {
      return Reflect.set(getRedis() as object, prop, value, getRedis());
    },
  });
}

// For compatibility with old imports.
export const redis: RedisClient = createRedisClientProxy();

export function isRedisConfigured(): boolean {
  return resolveRedisEnv() !== null || (canUsePersistentFallback() && !shouldUseMemoryFallback());
}

export function assertRedisConfigured(feature = "This feature") {
  if (!isRedisConfigured()) {
    throw new Error(
      `[REDIS] ${feature} requires Redis or DATABASE_URL-backed persistence. Configure KV_REST_API_URL/KV_REST_API_TOKEN, UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN, or DATABASE_URL.`,
    );
  }
}

