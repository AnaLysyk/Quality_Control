import { NextResponse } from "next/server";
import { authenticateRequest, type AuthUser } from "@/backend/jwtAuth";
import { emitBrainEvent } from "@/backend/brain/events";
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

async function getPrisma() {
  const { prisma } = await import("@/database/prismaClient");
  return prisma;
}

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId") ?? url.searchParams.get("companySlug");
  const projectId = url.searchParams.get("projectId");
  const planId = url.searchParams.get("planId");
  const status = url.searchParams.get("status");
  const take = Math.min(Number(url.searchParams.get("take") ?? "50"), 200);

  if (!canUseGlobalTestCaseScope(user)) {
    const allowedCompanies = resolveAllowedTestCaseCompanies(user);
    const normalizedCompanyId = companyId?.trim().toLowerCase();
    if (!normalizedCompanyId || !allowedCompanies.includes(normalizedCompanyId)) {
      return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
    }
  }
  const allowedProjectIds = resolveAllowedProjectIds(user);
  if (allowedProjectIds && projectId && !allowedProjectIds.includes(projectId)) {
    return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
  }

  const prisma = await getPrisma();
  const runs = await prisma.testRun.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      ...(projectId ? { projectId } : allowedProjectIds ? { projectId: { in: allowedProjectIds } } : {}),
      ...(planId ? { planId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      results: { select: { id: true, title: true, status: true, durationMs: true, errorMsg: true } },
      plan: { select: { id: true, title: true } },
      project: { select: { id: true, name: true, slug: true } },
    },
  });

  return NextResponse.json({
    runs: runs.map((run) => ({
      ...run,
      durationSeconds: durationSeconds(run.startedAt, run.finishedAt),
    })),
    total: runs.length,
  });
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Body inválido" }, { status: 400 });

  const companyId = String(body.companyId ?? body.companySlug ?? "").trim() || null;
  const projectId = String(body.projectId ?? "").trim() || null;
  const planId = String(body.planId ?? "").trim() || null;
  const title = String(body.title ?? "Execução manual").trim();
  const source = String(body.source ?? "manual").trim();
  const status = normalizeRunStatus(body.status) ?? "pending";

  if (!matchesRunScope(user, companyId, projectId)) {
    return NextResponse.json({ message: "Sem permissão para criar execução neste contexto" }, { status: 403 });
  }

  const prisma = await getPrisma();
  const run = await prisma.testRun.create({
    data: {
      companyId,
      projectId,
      planId,
      title,
      source,
      status,
      createdById: user.id,
    },
  });

  emitBrainEvent({
    type: "test_run.created",
    subject: run.id,
    source: "/api/test-runs",
    actorId: user.id,
    actorRole: user.role ?? "user",
    companyId: companyId,
    projectId: projectId,
    data: { runId: run.id, title: run.title, source: run.source },
  });

  return NextResponse.json({
    ...run,
    durationSeconds: durationSeconds(run.startedAt, run.finishedAt),
  }, { status: 201 });
}

export async function PATCH(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !body.id) return NextResponse.json({ message: "id obrigatório" }, { status: 400 });

  const prisma = await getPrisma();
  const existing = await prisma.testRun.findUnique({ where: { id: String(body.id) } });
  if (!existing || !matchesRunScope(user, existing.companyId, existing.projectId)) {
    return NextResponse.json({ message: "Run não encontrada" }, { status: 404 });
  }

  const status = normalizeRunStatus(body.status);

  const run = await prisma.testRun.update({
    where: { id: String(body.id) },
    data: {
      ...(status ? { status } : {}),
      ...(typeof body.passCount === "number" ? { passCount: body.passCount } : {}),
      ...(typeof body.failCount === "number" ? { failCount: body.failCount } : {}),
      ...(typeof body.skipCount === "number" ? { skipCount: body.skipCount } : {}),
      ...(typeof body.totalCount === "number" ? { totalCount: body.totalCount } : {}),
      ...(body.startedAt ? { startedAt: new Date(body.startedAt as string) } : {}),
      ...(body.finishedAt ? { finishedAt: new Date(body.finishedAt as string) } : {}),
    },
  });

  if (status === "passed" || status === "failed" || status === "error") {
    emitBrainEvent({
      type: status === "passed" ? "test_run.finished" : "test_run.failed",
      subject: run.id,
      source: "/api/test-runs",
      actorId: user.id,
      actorRole: user.role ?? "user",
      companyId: run.companyId ?? null,
      projectId: run.projectId ?? null,
      data: {
        runId: run.id,
        title: run.title,
        status: run.status,
        passCount: run.passCount ?? 0,
        failCount: run.failCount ?? 0,
        totalCount: run.totalCount ?? 0,
      },
    });
  }

  return NextResponse.json({
    ...run,
    durationSeconds: durationSeconds(run.startedAt, run.finishedAt),
  });
}

