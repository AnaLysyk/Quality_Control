import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { checkPermission } from "@/lib/permissions/checkPermission";
import { createNotificationsForUsers } from "@/lib/userNotificationsStore";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthUser = NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>;
type LeadershipAction = "assign_leader" | "transfer_leader" | "add_qa" | "remove_qa";
type OperationTarget = { id: string; name: string; full_name?: string | null; email: string };
type OperationProject = {
  id: string;
  name: string;
  slug: string;
  companyId: string;
  company: { id: string; name: string; company_name: string | null; slug: string };
};
type OperationResult = {
  action: LeadershipAction;
  project: OperationProject;
  target: OperationTarget;
  assignment: { id: string };
  notifyIds: string[];
  previousLeaderId?: string;
};

async function getDb() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

function normalizedRole(user: AuthUser) {
  return String(user.permissionRole ?? user.role ?? user.companyRole ?? user.globalRole ?? "")
    .trim()
    .toLowerCase();
}

function hasPlatformVisibility(user: AuthUser) {
  const role = normalizedRole(user);
  return Boolean(user.isGlobalAdmin || ["technical_support", "support"].includes(role));
}

function canEditRelationships(user: AuthUser) {
  return Boolean(
    user.isGlobalAdmin ||
      ["technical_support", "support", "leader_tc", "empresa", "company", "company_admin"].includes(normalizedRole(user)) ||
      checkPermission(user, "relationships:edit") ||
      checkPermission(user, "relationships:create"),
  );
}

async function resolveScopedCompanyIds(user: AuthUser) {
  if (hasPlatformVisibility(user)) return null;

  const db = await getDb();
  const ids = new Set<string>();
  if (user.companyId) ids.add(user.companyId);

  const [memberships, links, assignments] = await Promise.all([
    db.membership.findMany({ where: { userId: user.id }, select: { companyId: true } }),
    db.userCompanyLink.findMany({ where: { userId: user.id, active: true }, select: { companyId: true } }),
    db.projectTeamAssignment.findMany({ where: { userId: user.id, status: "active" }, select: { companyId: true } }),
  ]);

  memberships.forEach((item) => ids.add(item.companyId));
  links.forEach((item) => ids.add(item.companyId));
  assignments.forEach((item) => ids.add(item.companyId));
  return ids;
}

async function assertCompanyScope(user: AuthUser, companyId: string) {
  const scopedIds = await resolveScopedCompanyIds(user);
  if (scopedIds && !scopedIds.has(companyId)) {
    throw new Error("Empresa fora do seu contexto autorizado");
  }
}

async function ensureCompanyMembership(tx: Prisma.TransactionClient, userId: string, companyId: string, role: Role) {
  await tx.membership.upsert({
    where: { userId_companyId: { userId, companyId } },
    update: { role },
    create: { userId, companyId, role, capabilities: [] },
  });
}

function isLeaderProfile(target: { role: Role | null; globalRole: string | null; is_global_admin: boolean }) {
  return Boolean(
    target.role === Role.leader_tc ||
      ["leader_tc", "global_admin"].includes(String(target.globalRole ?? "")) ||
      target.is_global_admin,
  );
}

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!checkPermission(user, "relationships:view")) {
    return NextResponse.json({ error: "Sem permissão para visualizar vínculos" }, { status: 403 });
  }

  const projectId = new URL(req.url).searchParams.get("projectId")?.trim();
  if (!projectId) return NextResponse.json({ error: "Informe o projeto" }, { status: 400 });

  const db = await getDb();
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      slug: true,
      companyId: true,
      company: { select: { id: true, name: true, company_name: true, slug: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });

  try {
    await assertCompanyScope(user, project.companyId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Acesso negado" }, { status: 403 });
  }

  const [assignments, leaderCandidates, qaCandidates] = await Promise.all([
    db.projectTeamAssignment.findMany({
      where: { projectId, status: "active" },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, name: true, full_name: true, email: true, user: true } },
      },
    }),
    db.user.findMany({
      where: {
        active: true,
        OR: [
          { role: Role.leader_tc },
          { globalRole: { in: ["leader_tc", "global_admin"] } },
          { is_global_admin: true },
          { memberships: { some: { companyId: project.companyId, role: Role.leader_tc } } },
        ],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, full_name: true, email: true, user: true },
      take: 100,
    }),
    db.user.findMany({
      where: {
        active: true,
        OR: [
          { globalRole: { in: ["testing_company_user", "qa_tc"] } },
          { projectTeamAssignments: { some: { role: "qa_tc", status: "active" } } },
        ],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, full_name: true, email: true, user: true },
      take: 200,
    }),
  ]);

  return NextResponse.json({
    project,
    leader: assignments.find((item) => item.role === "leader_tc") ?? null,
    qaUsers: assignments.filter((item) => item.role === "qa_tc"),
    leaderCandidates,
    qaCandidates,
    permissions: {
      canEdit: canEditRelationships(user),
      canDelete: checkPermission(user, "relationships:delete") || canEditRelationships(user),
    },
  });
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!canEditRelationships(user)) {
    return NextResponse.json({ error: "Sem permissão para alterar liderança ou equipe" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    action?: LeadershipAction;
    projectId?: string;
    companyId?: string;
    userId?: string;
    newLeaderId?: string;
    assignmentId?: string;
    reason?: string;
  } | null;

  if (!body?.action || !["assign_leader", "transfer_leader", "add_qa", "remove_qa"].includes(body.action)) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }
  if (!body.projectId) return NextResponse.json({ error: "Informe o projeto" }, { status: 400 });

  const db = await getDb();
  const project = await db.project.findUnique({
    where: { id: body.projectId },
    select: {
      id: true,
      name: true,
      slug: true,
      companyId: true,
      company: { select: { id: true, name: true, company_name: true, slug: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });

  try {
    await assertCompanyScope(user, project.companyId);
    if (body.companyId && body.companyId !== project.companyId) {
      throw new Error("O projeto não pertence à empresa informada");
    }

    const result = await db.$transaction<OperationResult>(async (tx) => {
      if (body.action === "assign_leader") {
        if (!body.userId) throw new Error("Selecione o Líder TC");
        const target = await tx.user.findUnique({
          where: { id: body.userId },
          select: { id: true, name: true, full_name: true, email: true, role: true, globalRole: true, is_global_admin: true },
        });
        if (!target) throw new Error("Líder não encontrado");
        if (!isLeaderProfile(target)) throw new Error("A pessoa selecionada não possui perfil de Líder TC");

        const current = await tx.projectTeamAssignment.findFirst({
          where: { projectId: project.id, role: "leader_tc", status: "active" },
        });
        if (current) throw new Error("O projeto já possui liderança. Use a transferência");

        await ensureCompanyMembership(tx, target.id, project.companyId, Role.leader_tc);
        const assignment = await tx.projectTeamAssignment.create({
          data: { userId: target.id, companyId: project.companyId, projectId: project.id, role: "leader_tc", createdBy: user.id },
          select: { id: true },
        });
        return { action: body.action, project, target, assignment, notifyIds: [target.id] };
      }

      if (body.action === "transfer_leader") {
        if (!body.newLeaderId) throw new Error("Selecione o novo Líder TC");
        if (!body.reason?.trim()) throw new Error("Informe a justificativa da transferência");

        const [current, target] = await Promise.all([
          tx.projectTeamAssignment.findFirst({
            where: { projectId: project.id, role: "leader_tc", status: "active" },
            include: { user: { select: { id: true, name: true, full_name: true, email: true } } },
          }),
          tx.user.findUnique({
            where: { id: body.newLeaderId },
            select: { id: true, name: true, full_name: true, email: true, role: true, globalRole: true, is_global_admin: true },
          }),
        ]);

        if (!current) throw new Error("O projeto não possui um Líder TC ativo");
        if (!target) throw new Error("Novo líder não encontrado");
        if (current.userId === target.id) throw new Error("Selecione outro líder para a transferência");
        if (!isLeaderProfile(target)) throw new Error("A pessoa selecionada não possui perfil de Líder TC");

        await ensureCompanyMembership(tx, target.id, project.companyId, Role.leader_tc);
        await tx.projectTeamAssignment.update({
          where: { id: current.id },
          data: { status: "removed", removedBy: user.id, removedAt: new Date(), removalReason: body.reason.trim() },
        });
        const assignment = await tx.projectTeamAssignment.create({
          data: { userId: target.id, companyId: project.companyId, projectId: project.id, role: "leader_tc", createdBy: user.id },
          select: { id: true },
        });
        const qaUsers = await tx.projectTeamAssignment.findMany({
          where: { projectId: project.id, role: "qa_tc", status: "active" },
          select: { userId: true },
        });
        return {
          action: body.action,
          project,
          target,
          assignment,
          notifyIds: [current.userId, target.id, ...qaUsers.map((item) => item.userId)],
          previousLeaderId: current.userId,
        };
      }

      if (body.action === "add_qa") {
        if (!body.userId) throw new Error("Selecione o Usuário TC");
        const target = await tx.user.findUnique({
          where: { id: body.userId },
          select: { id: true, name: true, full_name: true, email: true },
        });
        if (!target) throw new Error("Usuário TC não encontrado");

        const leader = await tx.projectTeamAssignment.findFirst({
          where: { projectId: project.id, role: "leader_tc", status: "active" },
          select: { userId: true },
        });
        if (!leader) throw new Error("Defina a liderança antes de adicionar Usuários TC");

        const duplicate = await tx.projectTeamAssignment.findFirst({
          where: { projectId: project.id, userId: target.id, role: "qa_tc", status: "active" },
        });
        if (duplicate) throw new Error("Este Usuário TC já está vinculado ao projeto");

        await ensureCompanyMembership(tx, target.id, project.companyId, Role.user);
        const assignment = await tx.projectTeamAssignment.create({
          data: { userId: target.id, companyId: project.companyId, projectId: project.id, role: "qa_tc", createdBy: user.id },
          select: { id: true },
        });
        return { action: body.action, project, target, assignment, notifyIds: [target.id, leader.userId] };
      }

      if (!body.assignmentId) throw new Error("Informe o vínculo do Usuário TC");
      if (!body.reason?.trim()) throw new Error("Informe a justificativa da remoção");

      const current = await tx.projectTeamAssignment.findUnique({
        where: { id: body.assignmentId },
        include: { user: { select: { id: true, name: true, full_name: true, email: true } } },
      });
      if (!current || current.projectId !== project.id || current.role !== "qa_tc" || current.status !== "active") {
        throw new Error("Vínculo de Usuário TC não encontrado");
      }

      const leader = await tx.projectTeamAssignment.findFirst({
        where: { projectId: project.id, role: "leader_tc", status: "active" },
        select: { userId: true },
      });
      const assignment = await tx.projectTeamAssignment.update({
        where: { id: current.id },
        data: { status: "removed", removedBy: user.id, removedAt: new Date(), removalReason: body.reason.trim() },
        select: { id: true },
      });
      return {
        action: body.action,
        project,
        target: current.user,
        assignment,
        notifyIds: [current.userId, leader?.userId ?? ""].filter(Boolean),
      };
    });

    const title = result.action === "transfer_leader"
      ? "Liderança transferida"
      : result.action === "assign_leader"
        ? "Liderança atribuída"
        : result.action === "add_qa"
          ? "Usuário TC adicionado ao projeto"
          : "Usuário TC removido do projeto";

    const description = result.action === "transfer_leader"
      ? `A liderança do projeto ${result.project.name} foi transferida para ${result.target.full_name || result.target.name}.`
      : result.action === "assign_leader"
        ? `${result.target.full_name || result.target.name} foi definido como Líder TC do projeto ${result.project.name}.`
        : result.action === "add_qa"
          ? `${result.target.full_name || result.target.name} foi adicionado ao projeto ${result.project.name}.`
          : `${result.target.full_name || result.target.name} foi removido do projeto ${result.project.name}.`;

    await createNotificationsForUsers(Array.from(new Set(result.notifyIds.filter(Boolean))), {
      type: result.action === "remove_qa" ? "RELATIONSHIP_REMOVED" : "RELATIONSHIP_ASSIGNED",
      title,
      description,
      companySlug: result.project.company.slug,
      projectSlug: result.project.slug,
      actorId: user.id,
      actorName: user.email,
      dedupeKey: `relationship:${result.action}:${result.assignment.id}`,
      link: "/admin/users/vinculos",
    });

    writeAuditLog({
      actorUserId: user.id,
      actorEmail: user.email,
      action: result.action,
      entityType: "ProjectTeamAssignment",
      entityId: result.assignment.id,
      entityLabel: result.project.name,
      metadata: {
        companyId: result.project.companyId,
        projectId: result.project.id,
        targetUserId: result.target.id,
        previousLeaderId: result.previousLeaderId,
        reason: body.reason?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao atualizar liderança ou equipe" }, { status: 400 });
  }
}
