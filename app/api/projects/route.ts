import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { assertCompanyAccess } from "@/lib/rbac/validateCompanyAccess";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getDb() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

function forbiddenCompanyResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "FORBIDDEN_COMPANY_ACCESS";
  if (message === "MISSING_COMPANY_ID") {
    return NextResponse.json({ error: "Empresa obrigatória" }, { status: 400 });
  }
  return NextResponse.json({ error: "Empresa fora do escopo permitido" }, { status: 403 });
}

// GET /api/projects?companySlug=

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companySlug = searchParams.get("companySlug")?.trim();
  if (!companySlug) return NextResponse.json({ error: "companySlug obrigatório" }, { status: 400 });

  if (process.env.E2E_USE_JSON === "1") {
    return NextResponse.json({
      projects: [
        {
          id: "e2e-project-testing-company",
          slug: "quality-control",
          name: "Quality Control",
          description: "Projeto mockado para execucao E2E sem banco.",
          status: "active",
          color: "#2563eb",
          iconKey: "folder",
          companyId: companySlug,
          createdAt: new Date(0).toISOString(),
        },
      ],
    });
  }

  const db = await getDb();
  const company = await db.company.findUnique({ where: { slug: companySlug }, select: { id: true } });
  if (!company) return NextResponse.json({ projects: [] });

  try {
    await assertCompanyAccess(user, company.id);
  } catch (error) {
    return forbiddenCompanyResponse(error);
  }

  const projects = await db.project.findMany({
    where: { companyId: company.id, status: "active" },
    orderBy: { name: "asc" },
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
    },
  });

  return NextResponse.json({
    projects: projects.map((p: typeof projects[number]) => ({ ...p, createdAt: p.createdAt.toISOString() })),
  });
}

// POST /api/projects

const CreateSchema = z.object({
  companySlug: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug deve ser lowercase com hifens"),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  iconKey: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { companySlug, slug, name, description, color, iconKey } = parsed.data;

  const db = await getDb();
  const company = await db.company.findUnique({ where: { slug: companySlug }, select: { id: true } });
  if (!company) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

  try {
    await assertCompanyAccess(user, company.id);
  } catch (error) {
    return forbiddenCompanyResponse(error);
  }

  const canCreateProject =
    user.isGlobalAdmin === true ||
    ["leader_tc", "technical_support", "empresa"].includes(String(user.permissionRole ?? user.role ?? user.companyRole ?? "").toLowerCase());
  if (!canCreateProject) return NextResponse.json({ error: "Sem permissão para criar projetos" }, { status: 403 });

  const existing = await db.project.findUnique({
    where: { companyId_slug: { companyId: company.id, slug } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: "Já existe um projeto com esse slug nessa empresa" }, { status: 409 });

  const project = await db.project.create({
    data: {
      companyId: company.id,
      slug,
      name,
      description,
      color,
      iconKey,
      createdById: user.id,
    },
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
    },
  });

  writeAuditLog({
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    action: "create",
    entityType: "Project",
    entityId: project.id,
    entityLabel: project.name,
    metadata: {
      companyId: company.id,
      companySlug,
      projectId: project.id,
      projectSlug: project.slug,
      projectName: project.name,
      status: project.status,
      source: "api.projects.post",
    },
  });

  return NextResponse.json({ project: { ...project, createdAt: project.createdAt.toISOString() } }, { status: 201 });
}
