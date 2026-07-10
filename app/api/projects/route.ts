import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { resolveOperationalContext } from "@/lib/context/operationalContext";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getDb() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

// GET /api/projects?companySlug=

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companySlug = searchParams.get("companySlug")?.trim();
  if (!companySlug) return NextResponse.json({ error: "companySlug obrigatório" }, { status: 400 });

  const contextResult = await resolveOperationalContext(request, {
    moduleId: "context",
    action: "view_linked_projects",
    companySlug,
    requireCompany: true,
  });
  if (!contextResult.ok) return contextResult.response;

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
      qaseProjectCode: true,
      jiraProjectKey: true,
      manualCreationDisabled: true,
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
  qaseProjectCode: z.string().trim().optional(),
  jiraProjectKey: z.string().trim().optional(),
  manualCreationDisabled: z.boolean().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { companySlug, slug, name, description, color, iconKey, qaseProjectCode, jiraProjectKey, manualCreationDisabled } = parsed.data;
  const contextResult = await resolveOperationalContext(request, {
    moduleId: "context",
    action: "switch_project",
    companySlug,
    requireCompany: true,
  });
  if (!contextResult.ok) return contextResult.response;

  const role =
    contextResult.context.role ??
    normalizeLegacyRole(contextResult.context.access.role) ??
    normalizeLegacyRole(contextResult.context.access.companyRole);
  const canCreateProject =
    contextResult.context.access.isGlobalAdmin === true ||
    role === SYSTEM_ROLES.LEADER_TC ||
    role === SYSTEM_ROLES.TECHNICAL_SUPPORT ||
    role === SYSTEM_ROLES.EMPRESA;
  if (!canCreateProject) return NextResponse.json({ error: "Sem permissão para criar projetos" }, { status: 403 });

  const db = await getDb();
  const company = await db.company.findUnique({ where: { slug: companySlug }, select: { id: true } });
  if (!company) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

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
      qaseProjectCode: qaseProjectCode || null,
      jiraProjectKey: jiraProjectKey || null,
      manualCreationDisabled: manualCreationDisabled ?? false,
      createdById: contextResult.context.access.userId,
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
      qaseProjectCode: true,
      jiraProjectKey: true,
      manualCreationDisabled: true,
    },
  });

  writeAuditLog({
    actorUserId: contextResult.context.access.userId,
    actorEmail: contextResult.context.access.email ?? null,
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
