import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { checkPermission } from "@/lib/permissions/checkPermission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getDb() {
  const { prisma } = await import("@/lib/prismaClient");
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

  if (!run) return NextResponse.json({ message: "Run não encontrada" }, { status: 404 });
  return NextResponse.json(run);
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
  if (!existing) return NextResponse.json({ message: "Run não encontrada" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim() || existing.title;
  if (typeof body.status === "string") patch.status = body.status;
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

  return NextResponse.json(run);
}
