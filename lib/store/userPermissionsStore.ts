import "server-only";

import { prisma } from "@/lib/prismaClient";
import {
  applyPermissionOverride,
  normalizePermissionMatrix,
  type PermissionMatrix,
  type PermissionOverride,
} from "@/lib/permissionMatrix";
import { resolveProfilePermissionDefaults } from "@/lib/store/profilePermissionsStore";

export type UserPermissionsOverride = PermissionOverride & {
  userId: string;
  updatedAt?: string;
  updatedBy?: string | null;
};

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

export async function getUserPermissionOverride(userId: string | null | undefined) {
  if (!userId) return null;
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

