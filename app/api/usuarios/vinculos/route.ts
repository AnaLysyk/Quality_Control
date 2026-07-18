import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { authenticateRequest } from "@/backend/jwtAuth";
import { checkPermission } from "@/backend/permissions/checkPermission";
import { createNotificationsForUsers } from "@/backend/userNotificationsStore";
import { writeAuditLog } from "@/backend/audit/writeAuditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getDb() {
  const { prisma } = await import("@/database/prismaClient");
  return prisma;
}

function canManage(user: Awaited<ReturnType<typeof authenticateRequest>>) {
  if (!user) return false;
  const role = String(user.permissionRole ?? user.role ?? user.companyRole ?? "")
    .trim()
    .toLowerCase();

  return Boolean(
    user.isGlobalAdmin ||
      role === "leader_tc" ||
      role === "empresa" ||
      role === "company" ||
      role === "company_admin" ||
      role === "technical_support" ||
      role === "support" ||
      checkPermission(user, "relationships:create") ||
      checkPermission(user, "relationships:edit") ||
      checkPermission(user, "users:update") ||
      checkPermission(user, "permissions:update"),
  );
}

function scopedCompanyIds(user: NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>) {
  const ids = new Set<string>();
  if (user.companyId) ids.add(user.companyId);
  return ids;
}

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!checkPermission(user, "relationships:view") && !checkPermission(user, "users:view") && !canManage(user)) {
    return NextResponse.json({ error: "Sem permissão para visualizar vínculos" }, { status: 403 });
  }

  const db = await getDb();
  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const personId = url.searchParams.get("personId");
  const companyId = url.searchParams.get("companyId");
  const allowedCompanyIds = scopedCompanyIds(user);
  const global = Boolean(user.isGlobalAdmin);

  if (personId) {
    const person = await db.user.findFirst({
      where: {
        id: personId,
        ...(global
          ? {}
          : {
              OR: [
                { home_company_id: { in: Array.from(allowedCompanyIds) } },
                { memberships: { some: { companyId: { in: Array.from(allowedCompanyIds) } } } },
                { links: { some: { companyId: { in: Array.from(allowedCompanyIds) }, active: true } } },
                { projectTeamAssignments: { some: { companyId: { in: Array.from(allowedCompanyIds) } } } },
              ],
            }),
      },
      select: {
        id: true,
        name: true,
        full_name: true,
        email: true,
        user: true,
        role: true,
        globalRole: true,
        status: true,
        active: true,
        memberships: {
          select: {
            companyId: true,
            role: true,
            allowedProjectIds: true,
            company: { select: { id: true, name: true, company_name: true, slug: true } },
          },
        },
        projectTeamAssignments: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            role: true,
            status: true,
            createdAt: true,
            removedAt: true,
            removalReason: true,
            company: { select: { id: true, name: true, company_name: true, slug: true } },
            project: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!person) return NextResponse.json({ error: "Pessoa não encontrada" }, { status: 404 });
    return NextResponse.json({ person });
  }

  const companyWhere = global ? {} : { id: { in: Array.from(allowedCompanyIds) } };
  const [companies, projects, people] = await Promise.all([
    db.company.findMany({
      where: { ...companyWhere, active: true },
      select: { id: true, name: true, company_name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    db.project.findMany({
      where: {
        archivedAt: null,
        ...(companyId ? { companyId } : companyWhere.id ? { companyId: companyWhere.id } : {}),
      },
      select: { id: true, companyId: true, name: true, slug: true, status: true },
      orderBy: { name: "asc" },
    }),
    query.length >= 2
      ? db.user.findMany({
          where: {
            AND: [
              {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { full_name: { contains: query, mode: "insensitive" } },
                  { email: { contains: query, mode: "insensitive" } },
                  { user: { contains: query, mode: "insensitive" } },
                  { memberships: { some: { company: { name: { contains: query, mode: "insensitive" } } } } },
                ],
              },
              global
                ? {}
                : {
                    OR: [
                      { home_company_id: { in: Array.from(allowedCompanyIds) } },
                      { memberships: { some: { companyId: { in: Array.from(allowedCompanyIds) } } } },
                      { links: { some: { companyId: { in: Array.from(allowedCompanyIds) }, active: true } } },
                      { projectTeamAssignments: { some: { companyId: { in: Array.from(allowedCompanyIds) } } } },
                    ],
                  },
            ],
          },
          take: 30,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            full_name: true,
            email: true,
            user: true,
            role: true,
            globalRole: true,
            status: true,
            active: true,
          },
        })
      : [],
  ]);

  return NextResponse.json({
    companies,
    projects,
    people,
    permissions: { canManage: canManage(user) },
  });
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Sem permissão para criar vínculos" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    userId?: string;
    companyId?: string;
    projectId?: string;
    role?: "leader_tc" | "qa_tc";
  } | null;

  if (!body?.userId || !body.companyId || !body.projectId || !["leader_tc", "qa_tc"].includes(body.role ?? "")) {
    return NextResponse.json({ error: "Dados do vínculo inválidos" }, { status: 400 });
  }

  const userId = body.userId;
  const selectedCompanyId = body.companyId;
  const projectId = body.projectId;
  const assignmentRole: "leader_tc" | "qa_tc" = body.role as "leader_tc" | "qa_tc";

  const allowedCompanyIds = scopedCompanyIds(user);
  if (!user.isGlobalAdmin && !allowedCompanyIds.has(selectedCompanyId)) {
    return NextResponse.json({ error: "Empresa fora do seu contexto" }, { status: 403 });
  }

  const db = await getDb();

  try {
    const result = await db.$transaction(async (tx) => {
      const [target, company, project] = await Promise.all([
        tx.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, full_name: true, email: true, role: true },
        }),
        tx.company.findUnique({
          where: { id: selectedCompanyId },
          select: { id: true, name: true, company_name: true, slug: true },
        }),
        tx.project.findUnique({
          where: { id: projectId },
          select: { id: true, name: true, slug: true, companyId: true },
        }),
      ]);

      if (!target || !company || !project) throw new Error("Pessoa, empresa ou projeto não encontrado");
      if (project.companyId !== company.id) throw new Error("O projeto não pertence à empresa selecionada");
      if (["technical_support", "support"].includes(String(target.role))) {
        throw new Error("Suporte Técnico não participa de vínculos de projeto");
      }

      if (assignmentRole === "qa_tc") {
        const leader = await tx.projectTeamAssignment.findFirst({
          where: { projectId: project.id, role: "leader_tc", status: "active" },
          select: { userId: true },
        });
        if (!leader) throw new Error("Defina um Líder TC ativo antes de vincular um Usuário TC");
      }

      const duplicate = await tx.projectTeamAssignment.findFirst({
        where: { userId: target.id, projectId: project.id, role: assignmentRole, status: "active" },
      });
      if (duplicate) throw new Error("Este vínculo já está ativo");

      if (assignmentRole === "leader_tc") {
        const currentLeader = await tx.projectTeamAssignment.findFirst({
          where: { projectId: project.id, role: "leader_tc", status: "active" },
        });
        if (currentLeader) {
          throw new Error("O projeto já possui um Líder TC ativo. Use a troca de liderança");
        }
      }

      const membershipRole = assignmentRole === "leader_tc" ? Role.leader_tc : Role.user;
      const membership = await tx.membership.upsert({
        where: { userId_companyId: { userId: target.id, companyId: company.id } },
        update: assignmentRole === "leader_tc" ? { role: membershipRole } : {},
        create: {
          userId: target.id,
          companyId: company.id,
          role: membershipRole,
          capabilities: [],
          allowedProjectIds: [project.id],
        },
        select: { userId: true, companyId: true, allowedProjectIds: true },
      });

      if (assignmentRole === "qa_tc" && !membership.allowedProjectIds.includes(project.id)) {
        await tx.membership.update({
          where: { userId_companyId: { userId: target.id, companyId: company.id } },
          data: { allowedProjectIds: { push: project.id } },
        });
      }

      const assignment = await tx.projectTeamAssignment.create({
        data: {
          userId: target.id,
          companyId: company.id,
          projectId: project.id,
          role: assignmentRole,
          createdBy: user.id,
        },
      });

      return { assignment, target, company, project, membershipCreatedOrUpdated: true };
    });

    await createNotificationsForUsers([result.target.id], {
      type: "RELATIONSHIP_ASSIGNED",
      title: "Novo vínculo de empresa e projeto",
      description: `Você foi vinculado à empresa ${result.company.company_name || result.company.name} no projeto ${result.project.name}.`,
      companySlug: result.company.slug,
      projectSlug: result.project.slug,
      actorId: user.id,
      actorName: user.email,
      dedupeKey: `relationship-assigned:${result.assignment.id}`,
      link: "/admin/users/vinculos",
    });

    writeAuditLog({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "create",
      entityType: "ProjectTeamAssignment",
      entityId: result.assignment.id,
      entityLabel: result.target.full_name || result.target.name,
      metadata: {
        companyId: result.company.id,
        projectId: result.project.id,
        role: assignmentRole,
        companyMembershipUpdated: result.membershipCreatedOrUpdated,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao criar vínculo" },
      { status: 400 },
    );
  }
}

export async function DELETE(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!canManage(user)) return NextResponse.json({ error: "Sem permissão para remover vínculos" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    assignmentId?: string;
    reason?: string;
  } | null;

  if (!body?.assignmentId || !body.reason?.trim()) {
    return NextResponse.json({ error: "Informe o vínculo e a justificativa" }, { status: 400 });
  }

  const assignmentId = body.assignmentId;
  const reason = body.reason.trim();
  const db = await getDb();

  try {
    const result = await db.$transaction(async (tx) => {
      const assignment = await tx.projectTeamAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          user: { select: { id: true, name: true } },
          company: { select: { id: true, name: true, company_name: true, slug: true } },
          project: { select: { id: true, name: true, slug: true } },
        },
      });

      if (!assignment) throw new Error("Vínculo não encontrado");
      if (assignment.status !== "active") throw new Error("Este vínculo já foi removido");

      const allowedCompanyIds = scopedCompanyIds(user);
      if (!user.isGlobalAdmin && !allowedCompanyIds.has(assignment.companyId)) {
        throw new Error("Empresa fora do seu contexto");
      }

      if (assignment.role === "leader_tc") {
        throw new Error(
          "O Líder TC não pode ser removido diretamente. Realize a troca de liderança para manter o projeto com um líder ativo",
        );
      }

      const leader = await tx.projectTeamAssignment.findFirst({
        where: { projectId: assignment.projectId, role: "leader_tc", status: "active" },
        select: { userId: true },
      });

      const updated = await tx.projectTeamAssignment.update({
        where: { id: assignment.id },
        data: {
          status: "removed",
          removedBy: user.id,
          removedAt: new Date(),
          removalReason: reason,
        },
      });

      const membership = await tx.membership.findUnique({
        where: { userId_companyId: { userId: assignment.userId, companyId: assignment.companyId } },
        select: { allowedProjectIds: true },
      });

      if (membership?.allowedProjectIds.includes(assignment.projectId)) {
        await tx.membership.update({
          where: { userId_companyId: { userId: assignment.userId, companyId: assignment.companyId } },
          data: {
            allowedProjectIds: membership.allowedProjectIds.filter((id) => id !== assignment.projectId),
          },
        });
      }

      return { ...assignment, updated, leaderUserId: leader?.userId ?? null };
    });

    await createNotificationsForUsers([result.user.id, result.leaderUserId ?? ""].filter(Boolean), {
      type: "RELATIONSHIP_REMOVED",
      title: "Vínculo de projeto removido",
      description: `O vínculo de ${result.user.name} com ${result.project.name} foi removido. Motivo: ${reason}`,
      companySlug: result.company.slug,
      projectSlug: result.project.slug,
      actorId: user.id,
      actorName: user.email,
      dedupeKey: `relationship-removed:${result.id}`,
      link: "/admin/users/vinculos",
    });

    writeAuditLog({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "remove",
      entityType: "ProjectTeamAssignment",
      entityId: result.id,
      entityLabel: result.user.name,
      metadata: {
        companyId: result.companyId,
        projectId: result.projectId,
        role: result.role,
        reason,
        notifiedLeaderId: result.leaderUserId,
      },
    });

    return NextResponse.json({ success: true, assignment: result.updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao remover vínculo" },
      { status: 400 },
    );
  }
}
