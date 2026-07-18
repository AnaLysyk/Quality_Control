import { NextResponse } from "next/server";
import { authenticateRequest, type AuthUser } from "@/backend/jwtAuth";
import { writeAuditLog } from "@/backend/audit/writeAuditLog";
import { checkPermission } from "@/backend/permissions/checkPermission";
import {
  canUseGlobalTestCaseScope,
  resolveAllowedProjectIds,
  resolveAllowedTestCaseCompanies,
} from "@/backend/test-cases/testCasePermissions";

function matchesRunScope(user: AuthUser, companyId?: string | null, projectId?: string | null) {
  if (!canUseGlobalTestCaseScope(user)) {
    const allowedCompanies = resolveAllowedTestCaseCompanies(user);
    const normalizedCompanyId = companyId?.trim().toLowerCase();
    if (!normalizedCompanyId || !allowedCompanies.includes(normalizedCompanyId)) return false;
  }
  const allowedProjectIds = resolveAllowedProjectIds(user);
  if (!allowedProjectIds) return true;
  return Boolean(projectId && allowedProjectIds.includes(projectId));
}

function durationSeconds(startedAt: Date | null | undefined, finishedAt: Date | null | undefined) {
  if (!startedAt) return null;
  const end = finishedAt ?? new Date();
  const diff = Math.floor((end.getTime() - startedAt.getTime()) / 1000);
  return diff >= 0 ? diff : null;
}

function normalizeRunStatus(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return undefined;
  if (["not_started", "pending", "queued", "draft", "saved"].includes(normalized)) return "pending";
  if (["in_progress", "running", "active", "em_andamento"].includes(normalized)) return "running";
  if (["paused", "pausada"].includes(normalized)) return "paused";
  if (["finalized", "finalizada", "completed", "passed", "passed_all", "done"].includes(normalized)) return "passed";
  if (["canceled", "cancelled", "cancelada", "aborted"].includes(normalized)) return "canceled";
  if (["blocked", "bloqueada"].includes(normalized)) return "blocked";
  if (["failed", "fail", "erro", "error", "falha"].includes(normalized)) return "failed";
  return normalized;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getDb() {
  const { prisma } = await import("@/database/prismaClient");
  return prisma;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  if (!checkPermission(user, "test_run:read")) {
    return NextResponse.json({ message: "Sem permissão para visualizar runs" }, { status: 403 });
  }

  const { id } = await params;
  const db = await getDb();

  const run = await db.testRun.findUnique({
    where: { id },
    include: {
      results: { select: { id: true, title: true, status: true, durationMs: true, errorMsg: true } },
      plan: { select: { id: true, title: true } },
      project: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!run || !matchesRunScope(user, run.companyId, run.projectId)) {
    return NextResponse.json({ message: "Run não encontrada" }, { status: 404 });
  }
  return NextResponse.json({
    ...run,
    durationSeconds: durationSeconds(run.startedAt, run.finishedAt),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Body inválido" }, { status: 400 });
  const requiredPermission = body.archive === true ? "test_run:delete" : "test_run:update";
  if (!checkPermission(user, requiredPermission)) {
    return NextResponse.json({ message: "Sem permissão para editar runs" }, { status: 403 });
  }

  const db = await getDb();
  const existing = await db.testRun.findUnique({ where: { id } });
  if (!existing || !matchesRunScope(user, existing.companyId, existing.projectId)) {
    return NextResponse.json({ message: "Run não encontrada" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim() || existing.title;
  const status = normalizeRunStatus(body.status);
  if (status) patch.status = status;
  if (typeof body.passCount === "number") patch.passCount = body.passCount;
  if (typeof body.failCount === "number") patch.failCount = body.failCount;
  if (typeof body.skipCount === "number") patch.skipCount = body.skipCount;
  if (typeof body.totalCount === "number") patch.totalCount = body.totalCount;
  if (typeof body.startedAt === "string" && body.startedAt) patch.startedAt = new Date(body.startedAt);
  if (typeof body.finishedAt === "string" && body.finishedAt) patch.finishedAt = new Date(body.finishedAt);
  if (body.archive === true) {
    patch.archivedAt = new Date();
    patch.archivedById = user.id;
    if (!patch.status) patch.status = "archived";
  }

  const run = await db.testRun.update({ where: { id }, data: patch });

  writeAuditLog({
    actorUserId: user.id,
    actorEmail: user.email,
    action: body.archive === true ? "archive" : "update",
    entityType: "TestRun",
    entityId: run.id,
    entityLabel: run.title,
    metadata: { companyId: run.companyId ?? null, projectId: run.projectId ?? null, status: run.status },
  });

  return NextResponse.json({
    ...run,
    durationSeconds: durationSeconds(run.startedAt, run.finishedAt),
  });
}

