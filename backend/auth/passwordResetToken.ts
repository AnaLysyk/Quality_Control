import { createHash } from "crypto";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { dirname, resolve } from "path";

import { shouldUsePostgresPersistence } from "@/database/persistenceMode";
import { getRedis, isRedisConfigured } from "@/backend/redis";

const RESET_TOKEN_TTL_SECONDS = 15 * 60;
const LOCAL_TOKEN_FILE = process.env.LOCAL_AUTH_DATA_DIR
  ? resolve(process.env.LOCAL_AUTH_DATA_DIR, "password-reset-tokens.json")
  : null;

type LocalResetTokenRecord = {
  userId: string;
  expiresAt: number;
};

type LocalResetTokenStore = Record<string, LocalResetTokenRecord>;

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashedResetTokenKey(token: string) {
  return `reset:v2:${hashPasswordResetToken(token)}`;
}

function legacyResetTokenKey(token: string) {
  return `reset:${token}`;
}

function shouldUseLocalTokenFile() {
  return Boolean(LOCAL_TOKEN_FILE) && !isRedisConfigured() && !shouldUsePostgresPersistence();
}

async function readLocalTokenStore(): Promise<LocalResetTokenStore> {
  if (!LOCAL_TOKEN_FILE) return {};
  try {
    const parsed = JSON.parse(await readFile(LOCAL_TOKEN_FILE, "utf8")) as LocalResetTokenStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeLocalTokenStore(store: LocalResetTokenStore) {
  if (!LOCAL_TOKEN_FILE) return;
  await mkdir(dirname(LOCAL_TOKEN_FILE), { recursive: true });
  const temporaryFile = `${LOCAL_TOKEN_FILE}.${process.pid}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(store), "utf8");
  await rename(temporaryFile, LOCAL_TOKEN_FILE);
}

function removeExpiredLocalTokens(store: LocalResetTokenStore) {
  const now = Date.now();
  for (const [key, record] of Object.entries(store)) {
    if (!record?.userId || record.expiresAt <= now) {
      delete store[key];
    }
  }
}

export async function storePasswordResetToken(token: string, userId: string) {
  if (shouldUseLocalTokenFile()) {
    const store = await readLocalTokenStore();
    removeExpiredLocalTokens(store);
    store[hashPasswordResetToken(token)] = {
      userId,
      expiresAt: Date.now() + RESET_TOKEN_TTL_SECONDS * 1000,
    };
    await writeLocalTokenStore(store);
    return;
  }

  const redis = getRedis();
  await redis.set(hashedResetTokenKey(token), userId, { ex: RESET_TOKEN_TTL_SECONDS });
}

export async function consumePasswordResetToken(token: string) {
  if (shouldUseLocalTokenFile()) {
    const store = await readLocalTokenStore();
    removeExpiredLocalTokens(store);
    const tokenHash = hashPasswordResetToken(token);
    const record = store[tokenHash];
    delete store[tokenHash];
    await writeLocalTokenStore(store);
    return record?.userId ?? null;
  }

  const redis = getRedis();
  const hashedKey = hashedResetTokenKey(token);
  const legacyKey = legacyResetTokenKey(token);

  const userId = (await redis.get<string>(hashedKey)) ?? (await redis.get<string>(legacyKey));
  if (!userId) return null;

  await Promise.all([redis.del(hashedKey), redis.del(legacyKey)]);
  return userId;
}

export async function hasPasswordResetToken(token: string) {
  if (shouldUseLocalTokenFile()) {
    const store = await readLocalTokenStore();
    removeExpiredLocalTokens(store);
    const valid = Boolean(store[hashPasswordResetToken(token)]?.userId);
    await writeLocalTokenStore(store);
    return valid;
  }

  const redis = getRedis();
  const userId = (await redis.get<string>(hashedResetTokenKey(token))) ?? (await redis.get<string>(legacyResetTokenKey(token)));
  return Boolean(userId);
}

