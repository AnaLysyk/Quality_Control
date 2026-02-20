
import crypto from "node:crypto";

type DbShape<T> = { items: T[]; revision?: number };
// --------------------------- File lock (mutex) ---------------------------
const fileLocks = new Map<string, Promise<void>>();

async function withFileLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = fileLocks.get(key) ?? Promise.resolve();

  let release!: () => void;
  const next = new Promise<void>((res) => (release = res));
  fileLocks.set(key, prev.then(() => next));

  try {
    await prev;
    return await fn();
  } finally {
    release();
    // limpeza: só remove se ninguém empilhou outro lock depois
    if (fileLocks.get(key) === prev.then(() => next)) {
      fileLocks.delete(key);
    }
  }
}
type StoreMode = "json" | "redis";

export function nowIso() {
  return new Date().toISOString();
}

export function makeId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function getStoreMode(): StoreMode {
  // Só usa Redis se STORE_MODE for explicitamente 'redis'.
  const forced = (process.env.STORE_MODE || "").toLowerCase();
  if (forced === "redis") return "redis";
  return "json";
}

// ------------------------------- JSON driver ------------------------------
async function readDbJson<T>(fileName: string): Promise<DbShape<T>> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const DATA_DIR = path.join(process.cwd(), "data");
  await fs.mkdir(DATA_DIR, { recursive: true });
  const filePath = path.join(DATA_DIR, fileName);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as DbShape<T>;
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
    return parsed;
  } catch (err: unknown) {
    if ((err as any)?.code === "ENOENT") return { items: [] };
    return { items: [] };
  }
}

async function writeDbJson<T>(fileName: string, data: DbShape<T>): Promise<void> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const DATA_DIR = path.join(process.cwd(), "data");
  await fs.mkdir(DATA_DIR, { recursive: true });
  const filePath = path.join(DATA_DIR, fileName);
  const tmp = `${filePath}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  // Versionamento global: incrementa revision
  const nextRevision = (data.revision ?? 0) + 1;
  const payload = JSON.stringify({ ...data, revision: nextRevision }, null, 2);
  await withFileLock(fileName, async () => {
    await fs.writeFile(tmp, payload, "utf8");
    await fs.rename(tmp, filePath);
  });
}

// ------------------------------ Redis driver ------------------------------
function makeRedisKey(fileName: string) {
  return `qc:jsondb:${fileName}`;
}

async function getRedis() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

async function readDbRedis<T>(fileName: string): Promise<DbShape<T>> {
  const redis = await getRedis();
  const key = makeRedisKey(fileName);
  const raw = await redis.get<string | DbShape<T>>(key);
  if (!raw) return { items: [] };
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as DbShape<T>;
      return parsed && Array.isArray(parsed.items) ? parsed : { items: [] };
    } catch {
      return { items: [] };
    }
  }
  return raw && Array.isArray((raw as any).items) ? (raw as DbShape<T>) : { items: [] };
}

async function writeDbRedis<T>(fileName: string, data: DbShape<T>): Promise<void> {
  const redis = await getRedis();
  const key = makeRedisKey(fileName);
  await redis.set(key, JSON.stringify(data));
}

// ---------------------------- Public API (same) ---------------------------
export async function readDb<T>(fileName: string): Promise<DbShape<T>> {
  const mode = getStoreMode();
  return mode === "redis" ? readDbRedis<T>(fileName) : readDbJson<T>(fileName);
}

export async function writeDb<T>(fileName: string, data: DbShape<T>): Promise<void> {
  const mode = getStoreMode();
  if (mode === "redis") return writeDbRedis<T>(fileName, data);
  return writeDbJson<T>(fileName, data);
}
