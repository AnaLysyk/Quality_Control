import "server-only";

import type { BrainRuntimeContext } from "@/lib/brain/runtime";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  createdAt: string;
};

const DEFAULT_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry<unknown>>();
let permissionVersionBump = Date.now();

function normalizePart(value: unknown) {
  if (value === null || value === undefined || value === "") return "all";
  return String(value).trim() || "all";
}

export function getBrainPermissionVersionStamp() {
  return String(permissionVersionBump);
}

export function getBrainCacheKey(context: BrainRuntimeContext, extra: Record<string, unknown> = {}) {
  const parts = [
    `user:${normalizePart(context.userId)}`,
    `role:${normalizePart(context.role)}`,
    `company:${normalizePart(context.companyId)}`,
    `project:${normalizePart(context.projectId)}`,
    `permission:${context.permissionVersion}`,
    `bump:${permissionVersionBump}`,
    ...Object.keys(extra)
      .sort()
      .map((key) => `${key}:${normalizePart(extra[key])}`),
  ];
  return parts.join("|");
}

export function getCachedBrainValue<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCachedBrainValue<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    createdAt: new Date().toISOString(),
  });
  return value;
}

export function invalidateBrainCache(reason = "manual") {
  cache.clear();
  permissionVersionBump = Date.now();
  return {
    ok: true,
    reason,
    permissionVersion: getBrainPermissionVersionStamp(),
    invalidatedAt: new Date(permissionVersionBump).toISOString(),
  };
}
