import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/lib/automations/access";
import { authenticateRequest } from "@/lib/jwtAuth";
import { prisma } from "@/lib/prismaClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  cursor: z.string().trim().optional(),
  companySlug: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  route: z.string().trim().optional(),
  window: z.enum(["all", "1h", "24h", "7d"]).optional(),
});

type AuditPayload = {
  route: string;
  ok: boolean;
  actorUserId?: string | null;
  companySlug?: string | null;
  durationMs?: number | null;
  statusCode?: number | null;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
};

function resolveAccess(user: Awaited<ReturnType<typeof authenticateRequest>>) {
  const allowedCompanySlugs = resolveAutomationAllowedCompanySlugs(user);
  return {
    access: resolveAutomationAccess(user, allowedCompanySlugs.length),
    allowedCompanySlugs,
  };
}

function parsePayload(value: string): AuditPayload | null {
  try {
    const parsed = JSON.parse(value) as AuditPayload;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.route !== "string" || typeof parsed.ok !== "boolean") return null;
    return parsed;
  } catch {
    return null;
  }
}

function shouldExposePayload(
  payload: AuditPayload,
  hasGlobalCompanyVisibility: boolean,
  allowedCompanySlugs: string[],
) {
  if (hasGlobalCompanyVisibility) return true;
  const companySlug = payload.companySlug?.trim();
  if (!companySlug) return false;
  return allowedCompanySlugs.includes(companySlug);
}

function resolveCutoffDate(window: "all" | "1h" | "24h" | "7d") {
  if (window === "all") return null;
  const now = Date.now();
  if (window === "1h") return new Date(now - 60 * 60 * 1000);
  if (window === "24h") return new Date(now - 24 * 60 * 60 * 1000);
  return new Date(now - 7 * 24 * 60 * 60 * 1000);
}

function matchesTimeWindow(payload: AuditPayload, cutoff: Date | null) {
  if (!cutoff) return true;
  if (!payload.createdAt) return false;
  const createdAt = new Date(payload.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;
  return createdAt >= cutoff;
}

function matchesCompanyScope(
  payload: AuditPayload,
  companySlug: string | null,
  allowedCompanySlugs: string[],
  hasGlobalCompanyVisibility: boolean,
) {
  const payloadCompanySlug = payload.companySlug?.trim();
  if (companySlug) {
    return payloadCompanySlug === companySlug;
  }
  if (!payloadCompanySlug) return hasGlobalCompanyVisibility;
  return allowedCompanySlugs.includes(payloadCompanySlug);
}

type CursorPayload = {
  updatedAt: string;
  key: string;
};

function encodeCursor(payload: CursorPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(raw?: string | null): CursorPayload | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as CursorPayload;
    if (!parsed || typeof parsed.key !== "string" || typeof parsed.updatedAt !== "string") return null;
    const date = new Date(parsed.updatedAt);
    if (Number.isNaN(date.getTime())) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const user = await authenticateRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { access, allowedCompanySlugs } = resolveAccess(user);

  if (!access.canOpen) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  if (!access.canViewTechnicalLogs) {
    return NextResponse.json({ error: "Sem permissão para logs técnicos." }, { status: 403 });
  }

  const parsedQuery = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const routeFilter = parsedQuery.data.route?.trim();
  const companySlug = parsedQuery.data.companySlug?.trim() || null;
  const window = parsedQuery.data.window ?? "all";
  const limit = parsedQuery.data.limit ?? 50;
  const cursor = decodeCursor(parsedQuery.data.cursor);
  const cutoff = resolveCutoffDate(window);
  const fetchLimit = Math.max(limit * 4, 50);

  if (companySlug && !access.hasGlobalCompanyVisibility && !allowedCompanySlugs.includes(companySlug)) {
    return NextResponse.json({ error: "Empresa fora do escopo da sessão." }, { status: 403 });
  }

  const historyPrefix = routeFilter
    ? `automation:execution:item:${routeFilter}:%`
    : "automation:execution:item:%";

  const cursorFilter = cursor
    ? Prisma.sql`AND ("updatedAt" < ${new Date(cursor.updatedAt)} OR ("updatedAt" = ${new Date(cursor.updatedAt)} AND "key" < ${cursor.key}))`
    : Prisma.empty;

  const historyRows = await prisma.$queryRaw<Array<{ key: string; value: string; updatedAt: Date }>>`
    SELECT "key", "value", "updatedAt"
    FROM "persistent_kv"
    WHERE "key" LIKE ${historyPrefix}
    ${cursorFilter}
    ORDER BY "updatedAt" DESC, "key" DESC
    LIMIT ${fetchLimit + 1}
  `;

  let scanRows = historyRows.slice(0, fetchLimit);
  const hasMoreRows = historyRows.length > fetchLimit;

  if (scanRows.length === 0 && !cursor) {
    scanRows =
      routeFilter && routeFilter.length > 0
        ? await prisma.$queryRaw<Array<{ key: string; value: string; updatedAt: Date }>>`
            SELECT "key", "value", "updatedAt"
            FROM "persistent_kv"
            WHERE "key" = ${`automation:execution:last:${routeFilter}`}
          `
        : await prisma.$queryRaw<Array<{ key: string; value: string; updatedAt: Date }>>`
            SELECT "key", "value", "updatedAt"
            FROM "persistent_kv"
            WHERE "key" = ${"automation:execution:last"}
               OR "key" LIKE ${"automation:execution:last:%"}
            ORDER BY "updatedAt" DESC, "key" DESC
            LIMIT ${fetchLimit}
          `;
  }

  const audits = scanRows
    .map((row) => {
      const payload = parsePayload(row.value);
      return payload ? { key: row.key, payload } : null;
    })
    .filter((entry): entry is { key: string; payload: AuditPayload } => Boolean(entry))
    .filter((entry) => matchesCompanyScope(entry.payload, companySlug, allowedCompanySlugs, access.hasGlobalCompanyVisibility))
    .filter((entry) => shouldExposePayload(entry.payload, access.hasGlobalCompanyVisibility, allowedCompanySlugs))
    .filter((entry) => matchesTimeWindow(entry.payload, cutoff))
    .slice(0, limit);

  const nextCursor = hasMoreRows
    ? encodeCursor({
        key: scanRows[scanRows.length - 1]?.key ?? "",
        updatedAt: scanRows[scanRows.length - 1]?.updatedAt?.toISOString?.() ?? new Date(0).toISOString(),
      })
    : null;

  return NextResponse.json({
    audits,
    limit,
    nextCursor,
    total: audits.length,
    window,
  });
}
