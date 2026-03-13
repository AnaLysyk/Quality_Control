import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { isRedisConfigured } from "@/lib/redis";
import { normalizePermissionMatrix } from "@/lib/permissionMatrix";
import { getJson, setJson, deleteKey } from "./redisClient";
import { ROLE_DEFAULTS } from "../permissions/roleDefaults";

const PREFIX = "qc:user_permissions:";
const FILE_PATH = path.join(process.cwd(), "data", "permissionOverrides.json");

export type UserPermissionsOverride = {
  userId: string;
  allow?: Record<string, string[]>;
  deny?: Record<string, string[]>;
  updatedAt?: string;
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
  };
}

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

export async function getUserOverride(userId: string): Promise<UserPermissionsOverride | null> {
  if (isRedisConfigured()) {
    const key = PREFIX + userId;
    const value = await getJson(key);
    return value;
  }

  const store = await readOverridesFile();
  return store.items.find((item) => item.userId === userId) ?? null;
}

export async function setUserOverride(userId: string, override: Partial<UserPermissionsOverride>) {
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
  if (isRedisConfigured()) {
    const key = PREFIX + userId;
    await deleteKey(key);
    return;
  }

  const store = await readOverridesFile();
  const nextItems = store.items.filter((item) => item.userId !== userId);
  await writeOverridesFile({ items: nextItems });
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
