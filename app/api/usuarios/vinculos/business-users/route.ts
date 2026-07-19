import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { authenticateRequest } from "@/backend/jwtAuth";
import { assertUserCanLinkToCompany } from "@/backend/companyUserScope";
import { createNotificationsForUsers } from "@/backend/userNotificationsStore";
import { writeAuditLog } from "@/backend/audit/writeAuditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthUser = NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>;
type BusinessAction = "set_projects" | "deactivate";
type RequestBody = {
  action?: BusinessAction;
  userId?: string;
  projectIds?: string[];
  reason?: string;
};

async function getDb() {
  const { prisma } = await import("@/database/prismaClient");
  return prisma;
}

function normalizedRole(user: AuthUser) {
  return String(user.permissionRole ?? user.companyRole ?? user.role ?? user.globalRole ?? "")
    .trim()
    .toLowerCase();
}

function isCompanyOperator(user: AuthUser) {
  return ["empresa", "company", "company_admin"].includes(normalizedRole(user));
}

function hasPlatformVisibility(user: AuthUser) {
  return Boolean(user.isGlobalAdmin || ["technical_support", "support"].includes(normalizedRole(user)));
}

function displayName(user: { name: string; full_name: string | null }) {
  return user.full_name || user.name;
}

async function resolveBusinessContext(userId: string) {
  const db = await getDb();
  const target = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      full_name: true,
      email: true,
      active: true,
      status: true,
      role: true,
      globalRole: true,
      home_company_id: true,
      created_by_company_id: true,
      user_origin: true,
      user_scope: true,
      allow_multi_company_link: true,
      memberships: {
        select: {
          companyId: true,
          role: true,
          allowedProjectIds: true,
          company: { select: { id: true, name: true, company_name: true, slug: true } },
        },
      },
    },
  });

  if (!target) throw new Error("Usuário empresarial não encontrado");

  const companyId =
    target.home_company_id ||
    target.created_by_company_id ||
    target.memberships[0]?.companyId ||
    null;

  if (!companyId) throw new Error("Usuário empresarial sem empresa de origem configurada");

  assertUserCanLinkToCompany(target, companyId);

  const [company, projects] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, company_name: true, slug: true, active: true },
    }),
    db.project.findMany({
      where: { companyId, archivedAt: null },
      select: { id: true, name: true, slug: true, status: true, companyId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!company || !company.active) throw new Error("Empresa de origem não encontrada ou inativa");

  const membership = target.memberships.find((item) => item.companyId === companyId) ?? null;
  return { target, companyId, company, projects, membership };
}

function assertCanView(operator: AuthUser, companyId: string) {
  if (hasPlatformVisibility(operator)) return;
  if (isCompanyOperator(operator) && operator.companyId === companyId) return;
  throw new Error("Usuário empresarial fora do seu contexto autorizado");
}

function assertCompanyCanManage(operator: AuthUser, companyId: string) {
  if (!isCompanyOperator(operator) || operator.companyId !== companyId) {
    throw new Error("Somente a própria empresa pode alterar ou remover este usuário empresarial");
  }
}

export async function GET(req: Request) {
  const operator = await authenticateRequest(req);
  if (!operator) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const userId = new URL(req.url).searchParams.get("userId")?.trim();
  if (!userId) return NextResponse.json({ error: "Informe o usuário empresarial" }, { status: 400 });

  try {
    const context = await resolveBusinessContext(userId);
    assertCanView(operator, context.companyId);

    return NextResponse.json({
      user: {
        id: context.target.id,
        name: context.target.name,
        full_name: context.target.full_name,
        email: context.target.email,
        active: context.target.active,
        status: context.target.status,
      },
      company: context.company,
      projects: context.projects,
      selectedProjectIds: context.membership?.allowedProjectIds ?? [],
      permissions: {
        canManage: isCompanyOperator(operator) && operator.companyId === context.companyId,
        canDeactivate: isCompanyOperator(operator) && operator.companyId === context.companyId,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar usuário empresarial" },
      { status: 403 },
    );
  }
}

export async function POST(req: Request) {
  const operator = await authenticateRequest(req);
  if (!operator) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as RequestBody | null;
  if (!body?.action || !body.userId) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  try {
    const context = await resolveBusinessContext(body.userId);
    assertCompanyCanManage(operator, context.companyId);

    if (body.action === "set_projects") {
      const projectIds = Array.from(new Set((body.projectIds ?? []).filter(Boolean)));
      if (!projectIds.length) {
        throw new Error("Selecione pelo menos um projeto para o usuário empresarial");
      }

      const validProjectIds = new Set(context.projects.map((project) => project.id));
      if (projectIds.some((projectId) => !validProjectIds.has(projectId))) {
        throw new Error("Todos os projetos devem pertencer à empresa de origem do usuário");
      }

      const db = await getDb();
      const membership = await db.membership.upsert({
        where: { userId_companyId: { userId: context.target.id, companyId: context.companyId } },
        update: { role: Role.user, allowedProjectIds: projectIds },
        create: {
          userId: context.target.id,
          companyId: context.companyId,
          role: Role.user,
          capabilities: [],
          allowedProjectIds: projectIds,
        },
        select: { id: true, allowedProjectIds: true },
      });

      await createNotificationsForUsers([context.target.id], {
        type: "RELATIONSHIP_ASSIGNED",
        title: "Acessos de projeto atualizados",
        description: `A empresa ${context.company.company_name || context.company.name} atualizou seus projetos autorizados.`,
        companySlug: context.company.slug,
        actorId: operator.id,
        actorName: operator.email,
        dedupeKey: `business-user-projects:${membership.id}:${Date.now()}`,
        link: "/admin/users/vinculos",
      });

      writeAuditLog({
        actorUserId: operator.id,
        actorEmail: operator.email,
        action: "update_business_user_projects",
        entityType: "Membership",
        entityId: membership.id,
        entityLabel: displayName(context.target),
        metadata: {
          userId: context.target.id,
          companyId: context.companyId,
          projectIds: membership.allowedProjectIds,
        },
      });

      return NextResponse.json({ success: true, selectedProjectIds: membership.allowedProjectIds });
    }

    if (body.action === "deactivate") {
      const reason = body.reason?.trim();
      if (!reason) throw new Error("Informe a justificativa da remoção do usuário empresarial");

      const db = await getDb();
      const result = await db.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: context.target.id },
          data: { active: false, status: "inactive" },
          select: { id: true, name: true, full_name: true, email: true },
        });

        await tx.userCompanyLink.updateMany({
          where: { userId: context.target.id, companyId: context.companyId, active: true },
          data: { active: false },
        });

        await tx.projectTeamAssignment.updateMany({
          where: { userId: context.target.id, companyId: context.companyId, status: "active" },
          data: {
            status: "removed",
            removedBy: operator.id,
            removedAt: new Date(),
            removalReason: reason,
          },
        });

        return updatedUser;
      });

      writeAuditLog({
        actorUserId: operator.id,
        actorEmail: operator.email,
        action: "deactivate_business_user",
        entityType: "User",
        entityId: result.id,
        entityLabel: result.full_name || result.name,
        metadata: {
          companyId: context.companyId,
          reason,
          preservedHistory: true,
        },
      });

      return NextResponse.json({ success: true, userId: result.id });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao atualizar usuário empresarial" },
      { status: 400 },
    );
  }
}
