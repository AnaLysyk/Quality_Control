import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { writeAuditLog } from "@/backend/audit/writeAuditLog";
import { checkPermission } from "@/backend/permissions/checkPermission";
import { assertCompanyAccess } from "@/backend/rbac/validateCompanyAccess";

async function hasCompanyAccessToProject(user: Parameters<typeof assertCompanyAccess>[0], companyId: string | null) {
  if (!companyId) return false;
  try {
    await assertCompanyAccess(user, companyId);
    return true;
  } catch {
    return false;
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getDb() {
  const { prisma } = await import("@/database/prismaClient");
  return prisma;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!checkPermission(user, "test_plan:read")) {
    return NextResponse.json({ error: "Sem permissão para visualizar projetos" }, { status: 403 });
  }

  const { id } = await params;
  const db = await getDb();
  const project = await db.project.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      status: true,
      color: true,
      iconKey: true,
      companyId: true,
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
      archivedById: true,
      qaseProjectCode: true,
      jiraProjectKey: true,
      manualCreationDisabled: true,
    },
  });

  if (!project) return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  if (!(await hasCompanyAccessToProject(user, project.companyId))) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  const requiredPermission = body.archive === true ? "test_plan:delete" : "test_plan:update";
  if (!checkPermission(user, requiredPermission)) {
    return NextResponse.json({ error: "Sem permissão para editar projetos" }, { status: 403 });
  }

  const db = await getDb();
  const existing = await db.project.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  if (!(await hasCompanyAccessToProject(user, existing.companyId))) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim() || existing.name;
  if (typeof body.description === "string") patch.description = body.description.trim() || null;
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.color === "string") patch.color = body.color;
  if (typeof body.iconKey === "string") patch.iconKey = body.iconKey;
  if (typeof body.qaseProjectCode === "string") patch.qaseProjectCode = body.qaseProjectCode.trim() || null;
  if (typeof body.jiraProjectKey === "string") patch.jiraProjectKey = body.jiraProjectKey.trim() || null;
  if (typeof body.manualCreationDisabled === "boolean") patch.manualCreationDisabled = body.manualCreationDisabled;

  if (body.archive === true) {
    patch.archivedAt = new Date();
    patch.archivedById = user.id;
    patch.status = "archived";
  }

  const project = await db.project.update({ where: { id }, data: patch });

  writeAuditLog({
    actorUserId: user.id,
    actorEmail: user.email,
    action: body.archive === true ? "archive" : "update",
    entityType: "Project",
    entityId: project.id,
    entityLabel: project.name,
    metadata: { companyId: project.companyId, status: project.status },
  });

  return NextResponse.json(project);
}

