import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getPrismaClient } from "@/lib/prismaClient";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── GET /api/projects?companySlug= ───────────────────────────────────────────

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companySlug = searchParams.get("companySlug")?.trim();
  if (!companySlug) return NextResponse.json({ error: "companySlug obrigatório" }, { status: 400 });

  const prisma = getPrismaClient();
  const company = await prisma.company.findUnique({ where: { slug: companySlug }, select: { id: true } });
  if (!company) return NextResponse.json({ projects: [] });

  const projects = await prisma.project.findMany({
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
    projects: projects.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
  });
}

// ── POST /api/projects ────────────────────────────────────────────────────────

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

  // Only admins/leaders can create projects
  const role = (user.role ?? "").toLowerCase();
  const canCreate = ["admin", "leader_tc", "company_admin", "it_dev"].includes(role);
  if (!canCreate) return NextResponse.json({ error: "Sem permissão para criar projetos" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { companySlug, slug, name, description, color, iconKey } = parsed.data;

  const prisma = getPrismaClient();
  const company = await prisma.company.findUnique({ where: { slug: companySlug }, select: { id: true } });
  if (!company) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

  // Check uniqueness
  const existing = await prisma.project.findUnique({
    where: { companyId_slug: { companyId: company.id, slug } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: "Já existe um projeto com esse slug nessa empresa" }, { status: 409 });

  const project = await prisma.project.create({
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

  return NextResponse.json({ project: { ...project, createdAt: project.createdAt.toISOString() } }, { status: 201 });
}
