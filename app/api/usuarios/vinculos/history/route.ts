import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { authenticateRequest } from "@/backend/jwtAuth";
import { checkPermission } from "@/backend/permissions/checkPermission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthUser = NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>;
type ProfileKey = "leader_tc" | "qa_tc" | "business_user";
type AuditMetadata = {
  companyId?: string;
  projectId?: string;
  targetUserId?: string;
  previousLeaderId?: string;
  userId?: string;
  role?: string;
  reason?: string | null;
  projectIds?: string[];
};

const AUDIT_ACTIONS = [
  "create",
  "remove",
  "assign_leader",
  "transfer_leader",
  "add_qa",
  "remove_qa",
  "update_business_user_projects",
  "deactivate_business_user",
] as const;

async function getDb() {
  const { prisma } = await import("@/database/prismaClient");
  return prisma;
}

function normalizedRole(user: AuthUser) {
  return String(user.permissionRole ?? user.role ?? user.companyRole ?? user.globalRole ?? "")
    .trim()
    .toLowerCase();
}

function hasGlobalVisibility(user: AuthUser) {
  return Boolean(user.isGlobalAdmin || ["global_admin", "technical_support", "support"].includes(normalizedRole(user)));
}

async function resolveScopedCompanyIds(user: AuthUser) {
  if (hasGlobalVisibility(user)) return null;
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
  return Array.from(ids);
}

function metadataOf(value: Prisma.JsonValue | null): AuditMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AuditMetadata;
}

function profileFor(action: string, metadata: AuditMetadata): ProfileKey {
  if (action === "update_business_user_projects" || action === "deactivate_business_user") return "business_user";
  if (action === "assign_leader" || action === "transfer_leader" || metadata.role === "leader_tc") return "leader_tc";
  return "qa_tc";
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    create: "Vínculo criado",
    remove: "Vínculo removido",
    assign_leader: "Liderança atribuída",
    transfer_leader: "Liderança transferida",
    add_qa: "Usuário TC adicionado",
    remove_qa: "Usuário TC removido",
    update_business_user_projects: "Projetos empresariais atualizados",
    deactivate_business_user: "Acesso empresarial removido",
  };
  return labels[action] ?? action;
}

export async function GET(req: Request) {
  const operator = await authenticateRequest(req);
  if (!operator) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!checkPermission(operator, "relationships:view")) {
    return NextResponse.json({ error: "Sem permissão para visualizar histórico de vínculos" }, { status: 403 });
  }

  const db = await getDb();
  const scopedCompanyIds = await resolveScopedCompanyIds(operator);
  const requestedCompanyId = new URL(req.url).searchParams.get("companyId")?.trim();

  if (requestedCompanyId && scopedCompanyIds && !scopedCompanyIds.includes(requestedCompanyId)) {
    return NextResponse.json({ error: "Empresa fora do seu contexto autorizado" }, { status: 403 });
  }

  const logs = await db.auditLog.findMany({
    where: {
      entity_type: { in: ["ProjectTeamAssignment", "Membership", "User"] },
      action: { in: [...AUDIT_ACTIONS] },
    },
    orderBy: { created_at: "desc" },
    take: 500,
    select: {
      id: true,
      created_at: true,
      actor_user_id: true,
      actor_email: true,
      action: true,
      entity_id: true,
      entity_label: true,
      metadata: true,
    },
  });

  const normalized = logs.map((log) => ({ ...log, parsedMetadata: metadataOf(log.metadata) }));
  const visibleLogs = normalized.filter((log) => {
    const companyId = log.parsedMetadata.companyId;
    if (requestedCompanyId) return companyId === requestedCompanyId;
    if (!scopedCompanyIds) return true;
    return Boolean(companyId && scopedCompanyIds.includes(companyId));
  });

  const companyIds = Array.from(new Set(visibleLogs.map((log) => log.parsedMetadata.companyId).filter((id): id is string => Boolean(id))));
  const projectIds = Array.from(new Set(visibleLogs.map((log) => log.parsedMetadata.projectId).filter((id): id is string => Boolean(id))));
  const userIds = Array.from(new Set(visibleLogs.flatMap((log) => [
    log.parsedMetadata.targetUserId,
    log.parsedMetadata.userId,
    log.parsedMetadata.previousLeaderId,
    log.actor_user_id,
  ]).filter((id): id is string => Boolean(id))));

  const [companies, projects, users] = await Promise.all([
    companyIds.length
      ? db.company.findMany({
          where: { id: { in: companyIds } },
          select: { id: true, name: true, company_name: true, slug: true },
        })
      : [],
    projectIds.length
      ? db.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true, slug: true, companyId: true },
        })
      : [],
    userIds.length
      ? db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, full_name: true, email: true, avatar_url: true, avatar_key: true },
        })
      : [],
  ]);

  const companyById = new Map(companies.map((item) => [item.id, item]));
  const projectById = new Map(projects.map((item) => [item.id, item]));
  const userById = new Map(users.map((item) => [item.id, item]));

  const profiles: Array<{ key: ProfileKey; label: string; entries: unknown[] }> = [
    { key: "leader_tc", label: "Líder TC", entries: [] },
    { key: "qa_tc", label: "Usuário TC", entries: [] },
    { key: "business_user", label: "Usuário empresarial", entries: [] },
  ];
  const profileMap = new Map(profiles.map((profile) => [profile.key, profile]));

  for (const log of visibleLogs) {
    const metadata = log.parsedMetadata;
    const targetUserId = metadata.targetUserId || metadata.userId || null;
    const profile = profileMap.get(profileFor(log.action, metadata));
    if (!profile) continue;

    profile.entries.push({
      id: log.id,
      action: log.action,
      actionLabel: actionLabel(log.action),
      createdAt: log.created_at,
      reason: metadata.reason || null,
      company: metadata.companyId ? companyById.get(metadata.companyId) ?? null : null,
      project: metadata.projectId ? projectById.get(metadata.projectId) ?? null : null,
      targetUser: targetUserId ? userById.get(targetUserId) ?? null : null,
      previousLeader: metadata.previousLeaderId ? userById.get(metadata.previousLeaderId) ?? null : null,
      actor: log.actor_user_id ? userById.get(log.actor_user_id) ?? null : null,
      actorEmail: log.actor_email,
      entityLabel: log.entity_label,
      projectIds: metadata.projectIds ?? [],
    });
  }

  return NextResponse.json({
    profiles,
    total: visibleLogs.length,
    globalVisibility: hasGlobalVisibility(operator),
    scopedCompanyIds: scopedCompanyIds ?? [],
  });
}
