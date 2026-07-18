import "server-only";

import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { normalizeLegacyRole, type SystemRole } from "@/lib/auth/roles";
import {
  applyPermissionOverride,
  normalizePermissionMatrix,
  type PermissionMatrix,
  type PermissionOverride,
} from "@/lib/permissionMatrix";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";
import {
  canUsePersistentJsonStore,
  readPersistentJson,
  writePersistentJson,
} from "@/database/persistentJsonStore";

export type ProfilePermissionsOverride = PermissionOverride & {
  role: SystemRole;
  updatedBy?: string | null;
  reason?: string | null;
};

type ProfilePermissionsStore = {
  version: 1;
  items: ProfilePermissionsOverride[];
};

const STORE_KEY = "qc:profile_permission_overrides:v1";
const LOCAL_PROFILE_PERMISSIONS_FILE = process.env.LOCAL_AUTH_DATA_DIR
  ? resolve(process.env.LOCAL_AUTH_DATA_DIR, "profile-permission-overrides.json")
  : resolve(process.cwd(), "data", "profile-permission-overrides.json");

let memoryStore: ProfilePermissionsStore = { version: 1, items: [] };

function normalizeStoredOverride(input: unknown): ProfilePermissionsOverride | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Partial<ProfilePermissionsOverride>;
  const role = normalizeLegacyRole(record.role ?? null);
  if (!role) return null;

  return {
    role,
    allow: normalizePermissionMatrix(record.allow),
    deny: normalizePermissionMatrix(record.deny),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
    updatedBy: typeof record.updatedBy === "string" ? record.updatedBy : null,
    reason: typeof record.reason === "string" ? record.reason : null,
  };
}

function normalizeStore(input: unknown): ProfilePermissionsStore {
  if (!input || typeof input !== "object") return { version: 1, items: [] };
  const record = input as Partial<ProfilePermissionsStore>;
  const items = Array.isArray(record.items)
    ? record.items
        .map(normalizeStoredOverride)
        .filter((item): item is ProfilePermissionsOverride => item !== null)
    : [];
  return { version: 1, items };
}

async function readFileStore() {
  try {
    const parsed = JSON.parse(await readFile(LOCAL_PROFILE_PERMISSIONS_FILE, "utf8")) as unknown;
    memoryStore = normalizeStore(parsed);
    return memoryStore;
  } catch {
    return memoryStore;
  }
}

async function writeFileStore(store: ProfilePermissionsStore) {
  const normalized = normalizeStore(store);
  memoryStore = normalized;
  await mkdir(dirname(LOCAL_PROFILE_PERMISSIONS_FILE), { recursive: true });
  const temporaryFile = `${LOCAL_PROFILE_PERMISSIONS_FILE}.${process.pid}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(normalized, null, 2), "utf8");
  await rename(temporaryFile, LOCAL_PROFILE_PERMISSIONS_FILE);
}

async function readStore() {
  if (canUsePersistentJsonStore()) {
    const stored = await readPersistentJson<ProfilePermissionsStore>(STORE_KEY, memoryStore);
    memoryStore = normalizeStore(stored);
    return memoryStore;
  }

  return readFileStore();
}

async function writeStore(store: ProfilePermissionsStore) {
  const normalized = normalizeStore(store);
  memoryStore = normalized;
  if (canUsePersistentJsonStore()) {
    const persisted = await writePersistentJson(STORE_KEY, normalized);
    if (persisted) return;
  }
  await writeFileStore(normalized);
}

export async function listProfilePermissionOverrides() {
  const store = await readStore();
  return store.items;
}

export async function getProfilePermissionOverride(roleInput: string | null | undefined) {
  const role = normalizeLegacyRole(roleInput);
  if (!role) return null;
  const store = await readStore();
  return store.items.find((item) => item.role === role) ?? null;
}

export async function setProfilePermissionOverride(
  roleInput: string,
  override: Partial<ProfilePermissionsOverride>,
) {
  const role = normalizeLegacyRole(roleInput);
  if (!role) throw new Error("Perfil invalido");

  const nextOverride: ProfilePermissionsOverride = {
    role,
    allow: normalizePermissionMatrix(override.allow),
    deny: normalizePermissionMatrix(override.deny),
    updatedAt: new Date().toISOString(),
    updatedBy: typeof override.updatedBy === "string" ? override.updatedBy : null,
    reason: typeof override.reason === "string" ? override.reason : null,
  };

  const store = await readStore();
  const items = store.items.filter((item) => item.role !== role);
  items.push(nextOverride);
  await writeStore({ version: 1, items });
  return nextOverride;
}

export async function deleteProfilePermissionOverride(roleInput: string) {
  const role = normalizeLegacyRole(roleInput);
  if (!role) return;
  const store = await readStore();
  await writeStore({
    version: 1,
    items: store.items.filter((item) => item.role !== role),
  });
}

export async function resolveProfilePermissionDefaults(roleInput: string | null | undefined) {
  const role = normalizeLegacyRole(roleInput);
  const base = normalizePermissionMatrix(resolveRoleDefaults(role));
  if (!role) return base;
  const override = await getProfilePermissionOverride(role);
  return applyPermissionOverride(base, override);
}

export function resolvePermissionsFromDefaults(
  defaults: PermissionMatrix,
  override: PermissionOverride | null | undefined,
) {
  return applyPermissionOverride(defaults, override);
}

