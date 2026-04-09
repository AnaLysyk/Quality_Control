import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";
import { getPrismaClientOptions } from "@/lib/prismaClientOptions";
import { isRedisConfigured } from "@/lib/redis";
import { normalizePermissionMatrix } from "@/lib/permissionMatrix";
import { getJson, setJson, deleteKey } from "./redisClient";
import { ROLE_DEFAULTS } from "../permissions/roleDefaults";

const USE_POSTGRES = shouldUsePostgresPersistence();

// Lazy-load prisma so tests without DB still work
async function getPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  const PrismaClientUnsafe = PrismaClient as unknown as new (
    options?: ConstructorParameters<typeof PrismaClient>[0] & {
      __internal?: {
        configOverride?: (config: Record<string, unknown>) => Record<string, unknown>;
      };
    },
  ) => InstanceType<typeof PrismaClient>;
  // Re-use a global instance to avoid too many connections
  const g = global as unknown as { _permPrisma?: InstanceType<typeof PrismaClient> };
  if (!g._permPrisma) {
    g._permPrisma = new PrismaClientUnsafe(getPrismaClientOptions({
      __internal: {
        configOverride: (config: Record<string, unknown>) => ({ ...config, copyEngine: true }),
      },
    }));
  }
  return g._permPrisma;
}

const PREFIX = "qc:user_permissions:";
const FILE_PATH = path.join(process.cwd(), "data", "permissionOverrides.json");

export type UserPermissionsOverride = {
  userId: string;
  allow?: Record<string, string[]>;
  deny?: Record<string, string[]>;
  updatedAt?: string;
  updatedBy?: string | null;
};

type PermissionsOverrideFile = {
  items: UserPermissionsOverride[];
};

function normalizeStoredOverride(input: unknown): UserPermissionsOverride | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Partial<UserPermissionsOverride>;
  if (typeof record.userId !== "string" || !record.userId.trim()) return null;

  return {
    userId: record.userId.trim(),
    allow: normalizePermissionMatrix(record.allow),
    deny: normalizePermissionMatrix(record.deny),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
    updatedBy: typeof record.updatedBy === "string" ? record.updatedBy : null,
  };
}

// ── Postgres helpers ───────────────────────────────────────────────────────

async function pgGetOverride(userId: string): Promise<UserPermissionsOverride | null> {
  const prisma = await getPrisma();
  const row = await prisma.userPermissionOverride.findUnique({ where: { userId } });
  if (!row) return null;
  return {
    userId: row.userId,
    allow: normalizePermissionMatrix(row.allow as unknown),
    deny: normalizePermissionMatrix(row.deny as unknown),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy ?? null,
  };
}

async function pgSetOverride(userId: string, override: Partial<UserPermissionsOverride>): Promise<UserPermissionsOverride> {
  const prisma = await getPrisma();
  const existing = await pgGetOverride(userId);
  const allow = normalizePermissionMatrix(override.allow ?? existing?.allow);
  const deny = normalizePermissionMatrix(override.deny ?? existing?.deny);
  const updatedBy = override.updatedBy ?? existing?.updatedBy ?? null;

  const row = await prisma.userPermissionOverride.upsert({
    where: { userId },
    create: { userId, allow, deny, updatedBy },
    update: { allow, deny, updatedBy },
  });

  return {
    userId: row.userId,
    allow: normalizePermissionMatrix(row.allow as unknown),
    deny: normalizePermissionMatrix(row.deny as unknown),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy ?? null,
  };
}

async function pgDeleteOverride(userId: string): Promise<void> {
  const prisma = await getPrisma();
  await prisma.userPermissionOverride.deleteMany({ where: { userId } });
}

async function pgListOverrides(): Promise<UserPermissionsOverride[]> {
  const prisma = await getPrisma();
  const rows = await prisma.userPermissionOverride.findMany({ orderBy: { updatedAt: "desc" } });
  return rows.map((row) => ({
    userId: row.userId,
    allow: normalizePermissionMatrix(row.allow as unknown),
    deny: normalizePermissionMatrix(row.deny as unknown),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy ?? null,
  }));
}

// ── File helpers (fallback) ────────────────────────────────────────────────

async function readOverridesFile(): Promise<PermissionsOverrideFile> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as { items?: unknown };
    const items = Array.isArray(parsed?.items)
      ? parsed.items.map(normalizeStoredOverride).filter((item): item is UserPermissionsOverride => item !== null)
      : [];

    return { items };
  } catch {
    return { items: [] };
  }
}

async function writeOverridesFile(store: PermissionsOverrideFile) {
  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(store, null, 2), "utf8");
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function getUserOverride(userId: string): Promise<UserPermissionsOverride | null> {
  if (USE_POSTGRES) return pgGetOverride(userId);
  if (isRedisConfigured()) {
    const key = PREFIX + userId;
    const value = await getJson(key);
    return value;
  }

  const store = await readOverridesFile();
  return store.items.find((item) => item.userId === userId) ?? null;
}

export async function setUserOverride(userId: string, override: Partial<UserPermissionsOverride>) {
  if (USE_POSTGRES) return pgSetOverride(userId, { ...override, userId });

  const now = new Date().toISOString();
  const merged: UserPermissionsOverride = {
    ...(await getUserOverride(userId) || { userId }),
    ...override,
    userId,
    allow: normalizePermissionMatrix(override.allow),
    deny: normalizePermissionMatrix(override.deny),
    updatedAt: now,
  };

  if (isRedisConfigured()) {
    const key = PREFIX + userId;
    await setJson(key, merged);
    return merged;
  }

  const store = await readOverridesFile();
  const nextItems = store.items.filter((item) => item.userId !== userId);
  nextItems.push(merged);
  await writeOverridesFile({ items: nextItems });
  return merged;
}

export async function deleteUserOverride(userId: string) {
  if (USE_POSTGRES) return pgDeleteOverride(userId);

  if (isRedisConfigured()) {
    const key = PREFIX + userId;
    await deleteKey(key);
    return;
  }

  const store = await readOverridesFile();
  const nextItems = store.items.filter((item) => item.userId !== userId);
  await writeOverridesFile({ items: nextItems });
}

/** Lista todos os overrides (para painel de administração). */
export async function listUserOverrides(): Promise<UserPermissionsOverride[]> {
  if (USE_POSTGRES) return pgListOverrides();

  if (isRedisConfigured()) {
    // Redis não tem scan simplificado aqui — retorna vazio para evitar complexidade
    return [];
  }

  const store = await readOverridesFile();
  return store.items;
}

export function effectivePermissions(role: string, override?: UserPermissionsOverride) {
  const roleDefaults = (ROLE_DEFAULTS as Record<string, Record<string, string[]>>)[role] ?? {};
  const allow = override?.allow || {};
  const deny = override?.deny || {};

  const modules = new Set<string>([...Object.keys(roleDefaults), ...Object.keys(allow), ...Object.keys(deny)]);
  const effective: Record<string, Set<string>> = {};

  for (const m of modules) {
    const base = new Set<string>((roleDefaults[m] || []));
    (allow[m] || []).forEach(a => base.add(a));
    (deny[m] || []).forEach(a => base.delete(a));
    effective[m] = base;
  }

  return effective; // Record<module, Set<action>>
}
