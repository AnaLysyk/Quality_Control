import "server-only";

import { prisma } from "@/lib/prismaClient";

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_PRUNE_INTERVAL_SECONDS = 600;

let lastPruneAt = 0;

export type AutomationExecutionAudit = {
  route: string;
  ok: boolean;
  actorUserId?: string | null;
  companySlug?: string | null;
  durationMs?: number | null;
  statusCode?: number | null;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
};

function toPayload(input: AutomationExecutionAudit) {
  return {
    route: input.route,
    ok: input.ok,
    actorUserId: input.actorUserId ?? null,
    companySlug: input.companySlug ?? null,
    durationMs: input.durationMs ?? null,
    statusCode: input.statusCode ?? null,
    error: input.error ?? null,
    metadata: input.metadata ?? null,
    createdAt: new Date().toISOString(),
  };
}

function normalizeKeySegment(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function parseBoundedInt(rawValue: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt((rawValue ?? "").trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function getAuditRetentionDays() {
  return parseBoundedInt(process.env.AUTOMATION_AUDIT_RETENTION_DAYS, DEFAULT_RETENTION_DAYS, 1, 365);
}

function getPruneIntervalMs() {
  const seconds = parseBoundedInt(process.env.AUTOMATION_AUDIT_PRUNE_INTERVAL_SECONDS, DEFAULT_PRUNE_INTERVAL_SECONDS, 30, 86_400);
  return seconds * 1000;
}

async function upsertKv(key: string, value: string) {
  await prisma.$executeRaw`
    INSERT INTO "persistent_kv" ("key", "value", "expiresAt", "createdAt", "updatedAt")
    VALUES (${key}, ${value}, ${null}, NOW(), NOW())
    ON CONFLICT ("key")
    DO UPDATE SET
      "value" = EXCLUDED."value",
      "expiresAt" = NULL,
      "updatedAt" = NOW()
  `;
}

async function maybePruneAuditHistory() {
  const now = Date.now();
  if (now - lastPruneAt < getPruneIntervalMs()) return;
  lastPruneAt = now;

  const retentionDays = getAuditRetentionDays();
  const cutoffDate = new Date(now - retentionDays * 24 * 60 * 60 * 1000);

  try {
    await prisma.$executeRaw`
      DELETE FROM "persistent_kv"
      WHERE "key" LIKE ${"automation:execution:item:%"}
        AND "updatedAt" < ${cutoffDate}
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[automation-audit] Failed to prune audit history:", message);
  }
}

export async function saveAutomationExecutionAudit(input: AutomationExecutionAudit) {
  const payload = toPayload(input);
  const serialized = JSON.stringify(payload);
  const route = normalizeKeySegment(input.route);
  const routeKey = `automation:execution:last:${route}`;
  const historyKey = `automation:execution:item:${route}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

  try {
    await upsertKv(routeKey, serialized);
    await upsertKv("automation:execution:last", serialized);
    await upsertKv(historyKey, serialized);
    await maybePruneAuditHistory();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[automation-audit] Failed to persist execution audit:", message);
  }
}
