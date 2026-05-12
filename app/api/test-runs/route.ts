import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { emitBrainEvent } from "@/lib/brain/events";

async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
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

  const prisma = await getPrisma();
  const runs = await prisma.testRun.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      ...(projectId ? { projectId } : {}),
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

  return NextResponse.json({ runs, total: runs.length });
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

  const prisma = await getPrisma();
  const run = await prisma.testRun.create({
    data: {
      companyId,
      projectId,
      planId,
      title,
      source,
      status: "pending",
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

  return NextResponse.json(run, { status: 201 });
}

export async function PATCH(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !body.id) return NextResponse.json({ message: "id obrigatório" }, { status: 400 });

  const prisma = await getPrisma();
  const existing = await prisma.testRun.findUnique({ where: { id: String(body.id) } });
  if (!existing) return NextResponse.json({ message: "Run não encontrada" }, { status: 404 });

  const allowedStatuses = ["pending", "running", "passed", "failed", "error"];
  const status = typeof body.status === "string" && allowedStatuses.includes(body.status)
    ? body.status
    : undefined;

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

  return NextResponse.json(run);
}
