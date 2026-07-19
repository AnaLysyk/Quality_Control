import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { prisma } from "@/database/prismaClient";
import {
  applyPermissionOverride,
  normalizePermissionMatrix,
  type PermissionMatrix,
  type PermissionOverride,
} from "@/backend/permissionMatrix";
import { resolveProfilePermissionDefaults } from "@/backend/store/profilePermissionsStore";

export type UserPermissionsOverride = PermissionOverride & {
  userId: string;
  updatedAt?: string;
  updatedBy?: string | null;
};

type UserPermissionsFallbackStore = {
  items: UserPermissionsOverride[];
};

const LOCAL_USER_PERMISSIONS_FILE = process.env.LOCAL_AUTH_DATA_DIR
  ? resolve(process.env.LOCAL_AUTH_DATA_DIR, "user-permissions-overrides.json")
  : resolve(process.cwd(), "data", "user-permissions-overrides.json");

let memoryFallbackItems: UserPermissionsOverride[] = [];

function shouldUseJsonFallback() {
  return process.env.E2E_USE_JSON === "1" || process.env.E2E_USE_JSON === "true";
}

function normalizeStoredOverride(input: unknown, userId: string): UserPermissionsOverride {
  const record = (input && typeof input === "object" ? input : {}) as Partial<UserPermissionsOverride>;
  return {
    userId,
    allow: normalizePermissionMatrix(record.allow),
    deny: normalizePermissionMatrix(record.deny),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
    updatedBy: typeof record.updatedBy === "string" ? record.updatedBy : null,
  };
}

function normalizeFallbackOverride(input: unknown): UserPermissionsOverride | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Partial<UserPermissionsOverride>;
  if (typeof record.userId !== "string" || !record.userId.trim()) return null;
  return normalizeStoredOverride(record, record.userId.trim());
}

async function readJsonFallbackStore(): Promise<UserPermissionsFallbackStore> {
  try {
    const parsed = JSON.parse(await readFile(LOCAL_USER_PERMISSIONS_FILE, "utf8")) as unknown;
    const record = parsed && typeof parsed === "object" ? parsed as Partial<UserPermissionsFallbackStore> : {};
    const items = Array.isArray(record.items)
      ? record.items
          .map(normalizeFallbackOverride)
          .filter((item): item is UserPermissionsOverride => item !== null)
      : [];
    memoryFallbackItems = items;
    return { items };
  } catch {
    return { items: memoryFallbackItems };
  }
}

async function writeJsonFallbackStore(store: UserPermissionsFallbackStore) {
  const items = store.items
    .map(normalizeFallbackOverride)
    .filter((item): item is UserPermissionsOverride => item !== null);
  memoryFallbackItems = items;
  await mkdir(dirname(LOCAL_USER_PERMISSIONS_FILE), { recursive: true });
  const temporaryFile = `${LOCAL_USER_PERMISSIONS_FILE}.${process.pid}.tmp`;
  await writeFile(temporaryFile, JSON.stringify({ items }, null, 2), "utf8");
  await rename(temporaryFile, LOCAL_USER_PERMISSIONS_FILE);
}

export async function getUserPermissionOverride(userId: string | null | undefined) {
  if (!userId) return null;
  if (shouldUseJsonFallback()) {
    const store = await readJsonFallbackStore();
    return store.items.find((item) => item.userId === userId) ?? null;
  }
  const row = await prisma.userPermissionOverride.findUnique({ where: { userId } });
  if (!row) return null;

  return normalizeStoredOverride(
    {
      userId: row.userId,
      allow: row.allow,
      deny: row.deny,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy ?? null,
    },
    row.userId,
  );
}

export async function setUserPermissionOverride(
  userId: string,
  override: Partial<UserPermissionsOverride>,
) {
  if (!userId) throw new Error("Usuario invalido");
  if (shouldUseJsonFallback()) {
    const saved = normalizeStoredOverride(
      {
        userId,
        allow: override.allow,
        deny: override.deny,
        updatedAt: new Date().toISOString(),
        updatedBy: typeof override.updatedBy === "string" ? override.updatedBy : null,
      },
      userId,
    );
    const store = await readJsonFallbackStore();
    const nextItems = store.items.filter((item) => item.userId !== userId);
    nextItems.push(saved);
    await writeJsonFallbackStore({ items: nextItems });
    return saved;
  }

  const allow = normalizePermissionMatrix(override.allow);
  const deny = normalizePermissionMatrix(override.deny);
  const updatedBy = typeof override.updatedBy === "string" ? override.updatedBy : null;

  const row = await prisma.userPermissionOverride.upsert({
    where: { userId },
    update: { allow, deny, updatedBy },
    create: { userId, allow, deny, updatedBy },
  });

  return normalizeStoredOverride(
    {
      userId: row.userId,
      allow: row.allow,
      deny: row.deny,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy ?? null,
    },
    row.userId,
  );
}

export async function deleteUserPermissionOverride(userId: string | null | undefined) {
  if (!userId) return;
  if (shouldUseJsonFallback()) {
    const store = await readJsonFallbackStore();
    await writeJsonFallbackStore({
      items: store.items.filter((item) => item.userId !== userId),
    });
    return;
  }
  await prisma.userPermissionOverride.deleteMany({ where: { userId } });
}

export async function resolveUserPermissionsFromProfile(
  userId: string | null | undefined,
  role: string | null | undefined,
) {
  const profilePermissions = await resolveProfilePermissionDefaults(role);
  if (!userId) return profilePermissions;
  const override = await getUserPermissionOverride(userId);
  return applyPermissionOverride(profilePermissions, override);
}

export function countPermissionActions(input: PermissionMatrix | null | undefined) {
  return Object.values(input ?? {}).reduce(
    (total, actions) => total + (Array.isArray(actions) ? actions.length : 0),
    0,
  );
}
