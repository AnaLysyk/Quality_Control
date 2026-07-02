import { NextResponse } from "next/server";

import { filterBrainDomainGraphByAccess, resolveBrainAccess, type BrainAccessContext } from "@/lib/brain/access";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { prisma } from "@/lib/prismaClient";

type DomainNode = {
  id: string;
  type: string;
  module: string;
  companyId?: string;
  companyName?: string;
  projectId?: string;
  projectName?: string;
  label: string;
  description?: string;
  status: "ok" | "warning" | "missing" | "pending" | "error" | "orphan";
  size?: "sm" | "md" | "lg";
  information?: string;
  createdBy?: string;
  createdByEmail?: string;
  createdAt?: string;
  updatedAt?: string;
  generatedBy?: "user" | "system" | "brain" | "automation";
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

type DomainEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  type?: string;
  status?: "ok" | "warning" | "missing" | "pending" | "error" | "orphan";
  companyId?: string;
  projectId?: string;
  module?: string;
  metadata?: Record<string, unknown>;
};

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function normalizeRole(value?: string | null) {
  return normalizeLegacyRole(value) ?? value?.trim().toLowerCase() ?? null;
}

function normalizeBrainProfile(value?: string | null) {
  return normalizeRole(value) ?? "usuario";
}

function profileNodeId(profileType: string) {
  return `profile:${profileType || "usuario"}`;
}

function profileLabel(profileType: string) {
  const labels: Record<string, string> = {
    company: "Empresas do Sistema",
    empresa: "Empresa",
    company_user: "Usuário da Empresa",
    leader_tc: "Líder TC",
    technical_support: "Suporte Técnico",
    testing_company_user: "Usuário TC",
    user: "Usuário TC",
    viewer: "Usuário TC",
    usuario: "Usuário",
  };

  return labels[profileType] ?? profileType.replace(/_/g, " ");
}

function readStringField(value: object, key: string) {
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim().length > 0 ? field : null;
}

function profileKeyForUser(user: { role?: string | null; globalRole?: string | null }) {
  return normalizeBrainProfile(
    readStringField(user, "permissionRole") ??
      user.role ??
      user.globalRole ??
      readStringField(user, "companyRole") ??
      "",
  );
}

function isSameUser(value?: string | null, userId?: string | null) {
  return Boolean(value && userId && value === userId);
}

function isCompanyActor(access: BrainAccessContext) {
  const role = normalizeRole(access.user.permissionRole) ?? normalizeRole(access.user.role) ?? normalizeRole(access.user.companyRole);
  return role === SYSTEM_ROLES.EMPRESA || role === SYSTEM_ROLES.COMPANY_USER;
}

function date(value?: Date | null) {
  return value ? value.toISOString() : undefined;
}

function statusFromGeneric(value?: string | null): DomainNode["status"] {
  const normalized = (value ?? "").toLowerCase();
  if (["closed", "done", "resolved", "approved", "active", "ok", "pass", "passed"].includes(normalized)) return "ok";
  if (["rejected", "blocked", "failed", "error"].includes(normalized)) return "error";
  if (["open", "backlog", "todo", "in_progress", "pending", "rascunho"].includes(normalized)) return "pending";
  return "warning";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function resolveScopedCompanies(access: BrainAccessContext) {
  if (access.hasGlobalVisibility) {
    return prisma.company.findMany({
      where: { active: true },
      select: { id: true, slug: true, name: true, company_name: true, status: true, active: true, notes: true, internal_notes: true, createdAt: true, updatedAt: true },
      orderBy: { name: "asc" },
      take: 250,
    });
  }

  const ids = new Set(access.allowedCompanyIds);
  const slugs = new Set(access.allowedCompanySlugs);

  if (access.user.companyId) ids.add(access.user.companyId);
  if (access.user.companySlug) slugs.add(access.user.companySlug.toLowerCase());

  const linked = await prisma.userCompanyLink.findMany({
    where: { userId: access.user.id, active: true },
    select: { companyId: true },
  });
  linked.forEach((item) => ids.add(item.companyId));

  const memberships = await prisma.membership.findMany({
    where: { userId: access.user.id },
    select: { companyId: true },
  });
  memberships.forEach((item) => ids.add(item.companyId));

  return prisma.company.findMany({
    where: {
      active: true,
      OR: [
        ids.size ? { id: { in: Array.from(ids) } } : {},
        slugs.size ? { slug: { in: Array.from(slugs) } } : {},
      ].filter((item) => Object.keys(item).length > 0),
    },
    select: { id: true, slug: true, name: true, company_name: true, status: true, active: true, notes: true, internal_notes: true, createdAt: true, updatedAt: true },
    orderBy: { name: "asc" },
    take: 120,
  });
}

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ nodes: [], edges: [], error: accessResult.error }, { status: accessResult.status });
  }

  const access = accessResult.context;
  const companies = await resolveScopedCompanies(access);
  const companyIds = companies.map((company) => company.id);
  const companySlugs = companies.map((company) => company.slug).filter(Boolean);
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const companyBySlug = new Map(companies.map((company) => [company.slug, company]));
  const companyActor = isCompanyActor(access);

  if (!companyIds.length && !access.hasGlobalVisibility) {
    return NextResponse.json({ nodes: [], edges: [], summary: { warning: "Sem empresas vinculadas ao escopo atual." } });
  }

  const [
    projects,
    links,
    memberships,
    directUsers,
    tcUsers,
    tickets,
    comments,
    events,
    defects,
    kanbanCards,
    auditLogs,
  ] = await Promise.all([
    prisma.project.findMany({
      where: { companyId: { in: companyIds }, archivedAt: null },
      select: { id: true, companyId: true, name: true, slug: true, description: true, status: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 400,
    }),
    prisma.userCompanyLink.findMany({
      where: { companyId: { in: companyIds }, active: true },
      include: { user: true, company: true },
      take: 800,
    }),
    prisma.membership.findMany({
      where: { companyId: { in: companyIds } },
      include: { user: true, company: true },
      take: 800,
    }),
    prisma.user.findMany({
      where: {
        OR: [
          { home_company_id: { in: companyIds } },
          { created_by_company_id: { in: companyIds } },
          { default_company_slug: { in: companySlugs } },
        ],
      },
      take: 500,
    }),
    companyActor
      ? prisma.user.findMany({
          where: {
            OR: [
              { role: { in: ["leader_tc", "technical_support", "user", "viewer"] } },
              { user_origin: "testing_company" },
            ],
          },
          take: 120,
        })
      : Promise.resolve([]),
    prisma.ticket.findMany({
      where: access.hasGlobalVisibility
        ? {}
        : { OR: [{ companyId: { in: companyIds } }, { companySlug: { in: companySlugs } }, { createdBy: access.user.id }] },
      include: { assignee: true, creator: true },
      orderBy: { updatedAt: "desc" },
      take: 250,
    }),
    prisma.ticketComment.findMany({
      where: access.hasGlobalVisibility
        ? { deletedAt: null }
        : { deletedAt: null, ticket: { OR: [{ companyId: { in: companyIds } }, { companySlug: { in: companySlugs } }, { createdBy: access.user.id }] } },
      include: { ticket: true, author: true },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    prisma.ticketEvent.findMany({
      where: access.hasGlobalVisibility
        ? {}
        : { ticket: { OR: [{ companyId: { in: companyIds } }, { companySlug: { in: companySlugs } }, { createdBy: access.user.id }] } },
      include: { ticket: true },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    prisma.defect.findMany({
      where: access.hasGlobalVisibility ? {} : { companyId: { in: companyIds } },
      orderBy: { updatedAt: "desc" },
      take: 250,
    }),
    prisma.kanbanCard.findMany({
      where: access.hasGlobalVisibility ? {} : { clientSlug: { in: companySlugs } },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    prisma.auditLog.findMany({
      where: {},
      orderBy: { created_at: "desc" },
      take: access.hasGlobalVisibility || access.canManage ? 200 : 40,
    }).catch(() => []),
  ]);

  const visibleAuditLogs = access.hasGlobalVisibility
    ? auditLogs
    : auditLogs.filter((log) => {
        const metadata = record(log.metadata);
        const companyId = typeof metadata.companyId === "string" ? metadata.companyId : null;
        const companySlug = typeof metadata.companySlug === "string" ? metadata.companySlug : null;
        return Boolean((companyId && companyIds.includes(companyId)) || (companySlug && companySlugs.includes(companySlug)));
      });

  const visibleUsers = uniqueById([
    ...links.map((link) => link.user),
    ...memberships.map((membership) => membership.user),
    ...directUsers,
    ...tcUsers,
    ...tickets.map((ticket) => ticket.creator),
    ...tickets.map((ticket) => ticket.assignee).filter((user): user is NonNullable<typeof user> => Boolean(user)),
  ]);
  const visibleUserIds = new Set(visibleUsers.map((user) => user.id));
  const visibleNotes = await prisma.userNote.findMany({
    where: access.hasGlobalVisibility ? {} : { userId: { in: Array.from(new Set([...visibleUserIds, access.user.id])) } },
    include: { user: true },
    orderBy: { updatedAt: "desc" },
    take: 250,
  });

  const nodes: DomainNode[] = [];
  const edges: DomainEdge[] = [];

  const addNode = (node: DomainNode) => nodes.push(node);
  const addEdge = (edge: DomainEdge) => edges.push(edge);

  addNode({
    id: "domain:quality-control",
    type: "module",
    module: "Contexto",
    label: "Quality Control",
    description: "Mapa completo de empresas, usuários, projetos, chamados, defeitos, notas e fluxos visíveis pelo perfil atual.",
    status: "ok",
    size: "lg",
    information: access.hasGlobalVisibility
      ? "Perfil global: o Brain organiza o conhecimento por perfil, usuário, empresa e módulos."
      : "Perfil com escopo restrito: o Brain mostra perfis, empresas, usuários e fluxos permitidos.",
    metadata: {
      visibility: access.hasGlobalVisibility ? "global" : "scoped",
      role: access.user.role,
      companyRole: access.user.companyRole,
    },
  });

  for (const company of companies) {

  const profileTypes = uniqueById(
    [
      { id: "company" },
      ...visibleUsers.map((user) => ({
        id: profileKeyForUser(user),
      })),
    ],
  ).map((item) => item.id);

  for (const profileType of profileTypes) {
    const usersInProfile = visibleUsers.filter(
      (user) => profileKeyForUser(user) === profileType,
    );
    const isCompanyProfile = profileType === "company";

    addNode({
      id: profileNodeId(profileType),
      type: "profile",
      module: "Perfis",
      label: profileLabel(profileType),
      description: isCompanyProfile
        ? "Perfil Empresas do Sistema agrupa as empresas visíveis. Ao abrir uma empresa, o Brain mostra os módulos, usuários e movimentos daquele contexto."
        : `Perfil ${profileLabel(profileType)} agrupa usuários. Ao abrir um usuário, o Brain mostra o que ele vê, criou, executou, comentou ou movimentou.`,
      status: "ok",
      size: "lg",
      information: isCompanyProfile
        ? `Perfil Empresas do Sistema conecta ${companies.length} empresa(s) visíveis.`
        : `Perfil ${profileLabel(profileType)} conecta ${usersInProfile.length} usuário(s) visíveis.`,
      metadata: {
        profileType,
        subjectKind: "profile",
        userCount: usersInProfile.length,
        companyCount: isCompanyProfile ? companies.length : 0,
      },
    });

    addEdge({
      id: `domain-profile-${profileType}`,
      source: "domain:quality-control",
      target: profileNodeId(profileType),
      label: "organiza perfil",
      type: "contains",
      status: "ok",
      metadata: { profileType, subjectKind: "profile" },
    });
  }

    const companyNodeId = `company:${company.id}`;
    const name = company.company_name || company.name;
    addNode({
      id: companyNodeId,
      type: "company",
      module: "Contexto",
      companyId: company.id,
      companyName: name,
      label: name,
      description: company.notes || company.internal_notes || `Empresa ${name} no escopo do Brain.`,
      status: company.active === false || company.status === "inactive" ? "warning" : "ok",
      size: "lg",
      information: `${name} conecta projetos, usuários, chamados, defeitos, notas e documentos visíveis neste perfil.`,
      createdAt: date(company.createdAt),
      updatedAt: date(company.updatedAt),
      metadata: { slug: company.slug, status: company.status, profileType: "company", subjectKind: "company", subjectId: company.id },
    });
    addEdge({
      id: `profile-company-${company.id}`,
      source: profileNodeId("company"),
      target: companyNodeId,
      label: "contém empresa",
      type: "contains",
      status: "ok",
      companyId: company.id,
      metadata: { subjectKind: "company", profileType: "company" },
    });
  }

  for (const project of projects) {
    const company = companyById.get(project.companyId);
    addNode({
      id: `project:${project.id}`,
      type: "project",
      module: "Contexto",
      companyId: project.companyId,
      companyName: company?.company_name || company?.name,
      projectId: project.id,
      projectName: project.name,
      label: project.name,
      description: project.description ?? `Projeto ${project.name}.`,
      status: statusFromGeneric(project.status),
      size: "md",
      information: `Projeto ${project.name} organiza fluxos, evidências, defeitos e execuções da empresa.`,
      createdAt: date(project.createdAt),
      updatedAt: date(project.updatedAt),
      metadata: { slug: project.slug, status: project.status },
    });
    addEdge({ id: `company-${project.companyId}-project-${project.id}`, source: `company:${project.companyId}`, target: `project:${project.id}`, label: "possui projeto", type: "belongs_to_project", status: "ok", companyId: project.companyId, projectId: project.id });
  }

  for (const user of visibleUsers) {
    const userCompanyId = user.home_company_id || user.created_by_company_id || companyBySlug.get(user.default_company_slug ?? "")?.id || null;
    const company = userCompanyId ? companyById.get(userCompanyId) : null;
    const userNodeId = `user:${user.id}`;
    const profileType = profileKeyForUser(user);
    const role = normalizeRole(String(user.role ?? "")) ?? user.globalRole ?? "usuario";

    const userTickets = tickets.filter((ticket) => isSameUser(ticket.createdBy, user.id) || isSameUser(ticket.assignedToUserId, user.id));
    const userComments = comments.filter((comment) => isSameUser(comment.authorUserId, user.id));
    const userTicketEvents = events.filter((event) => isSameUser(event.actorUserId, user.id));
    const userNotes = visibleNotes.filter((note) => isSameUser(note.userId, user.id));
    const userAuditLogs = visibleAuditLogs.filter((log) => isSameUser(log.actor_user_id, user.id) || Boolean(log.actor_email && log.actor_email === user.email));

    const movementDates = [
      user.updatedAt,
      ...userTickets.map((item) => item.updatedAt),
      ...userComments.map((item) => item.createdAt),
      ...userTicketEvents.map((item) => item.createdAt),
      ...userNotes.map((item) => item.updatedAt),
      ...userAuditLogs.map((item) => item.created_at),
    ]
      .filter(Boolean)
      .map((item) => item instanceof Date ? item : new Date(String(item)))
      .filter((item) => Number.isFinite(item.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    const lastMovement = movementDates[0] ?? null;

    addNode({
      id: userNodeId,
      type: "person",
      module: "Usuarios",
      companyId: userCompanyId ?? undefined,
      companyName: company?.company_name || company?.name,
      label: user.full_name || user.name || user.email,
      description: `${user.email} · perfil ${profileLabel(profileType)} · visão lógica do usuário.`,
      status: user.active && user.status !== "inactive" ? "ok" : "warning",
      size: "md",
      information: `${user.full_name || user.name || user.email} é usuário do perfil ${profileLabel(profileType)}. Chamados: ${userTickets.length}; comentários: ${userComments.length}; notas/documentos: ${userNotes.length}; logs/eventos: ${userTicketEvents.length + userAuditLogs.length}; última movimentação: ${lastMovement ? lastMovement.toLocaleDateString("pt-BR") : "não identificada"}.`,
      createdAt: date(user.createdAt),
      updatedAt: date(user.updatedAt),
      metadata: {
        email: user.email,
        role,
        profileType,
        profileLabel: profileLabel(profileType),
        globalRole: user.globalRole,
        userOrigin: user.user_origin,
        userScope: user.user_scope,
        subjectKind: "user",
        subjectId: user.id,
        counters: {
          tickets: userTickets.length,
          comments: userComments.length,
          notes: userNotes.length,
          logs: userTicketEvents.length + userAuditLogs.length,
        },
        lastMovementAt: lastMovement ? lastMovement.toISOString() : null,
      },
    });

    addEdge({
      id: `profile-${profileType}-user-${user.id}`,
      source: profileNodeId(profileType),
      target: userNodeId,
      label: "contém usuário",
      type: "contains",
      status: "ok",
      companyId: userCompanyId ?? undefined,
      metadata: { profileType, subjectKind: "user", subjectId: user.id },
    });

    if (userCompanyId && companyById.has(userCompanyId)) {
      addEdge({
        id: `company-${userCompanyId}-user-${user.id}`,
        source: `company:${userCompanyId}`,
        target: userNodeId,
        label: "possui usuário",
        type: "contains",
        status: "ok",
        companyId: userCompanyId,
        metadata: { profileType, subjectKind: "user", subjectId: user.id },
      });
    }
  }

  for (const link of links) {
    addEdge({
      id: `user-link-${link.userId}-${link.companyId}`,
      source: `user:${link.userId}`,
      target: `company:${link.companyId}`,
      label: "vinculado à empresa",
      type: "permission_allows",
      status: link.status === "active" ? "ok" : "warning",
      companyId: link.companyId,
      metadata: { role: link.role, roleInCompany: link.roleInCompany, permissions: link.permissions },
    });
  }

  for (const membership of memberships) {
    addEdge({
      id: `membership-${membership.userId}-${membership.companyId}`,
      source: `user:${membership.userId}`,
      target: `company:${membership.companyId}`,
      label: "membro da empresa",
      type: "permission_allows",
      status: "ok",
      companyId: membership.companyId,
      metadata: { role: membership.role, capabilities: membership.capabilities },
    });
  }

  for (const ticket of tickets) {
    const company = ticket.companyId ? companyById.get(ticket.companyId) : ticket.companySlug ? companyBySlug.get(ticket.companySlug) : null;
    const companyId = ticket.companyId || company?.id || undefined;
    addNode({
      id: `ticket:${ticket.id}`,
      type: "event",
      module: "Suporte",
      companyId,
      companyName: company?.company_name || company?.name,
      label: ticket.code ? `${ticket.code} · ${ticket.title}` : ticket.title,
      description: ticket.description,
      status: statusFromGeneric(ticket.status),
      size: "lg",
      information: `Chamado ${ticket.code} está em ${ticket.status}, prioridade ${ticket.priority}, criado por ${ticket.createdByName || ticket.createdByEmail || ticket.creator.email}.`,
      createdBy: ticket.createdBy,
      createdByEmail: ticket.createdByEmail || ticket.creator.email,
      createdAt: date(ticket.createdAt),
      updatedAt: date(ticket.updatedAt),
      entityType: "ticket",
      entityId: ticket.id,
      metadata: { code: ticket.code, type: ticket.type, priority: ticket.priority, tags: ticket.tags, assignedToUserId: ticket.assignedToUserId, actorUserId: ticket.createdBy, subjectKind: "user" },
    });
    if (companyId) addEdge({ id: `company-${companyId}-ticket-${ticket.id}`, source: `company:${companyId}`, target: `ticket:${ticket.id}`, label: "possui chamado", type: "contains", status: "ok", companyId });
    addEdge({ id: `ticket-${ticket.id}-creator-${ticket.createdBy}`, source: `user:${ticket.createdBy}`, target: `ticket:${ticket.id}`, label: "criou chamado", type: "created_by", status: "ok", companyId, metadata: { subjectKind: "user", subjectId: ticket.createdBy } });
    if (ticket.assignedToUserId) addEdge({ id: `ticket-${ticket.id}-assignee-${ticket.assignedToUserId}`, source: `user:${ticket.assignedToUserId}`, target: `ticket:${ticket.id}`, label: "responsável por chamado", type: "action", status: "ok", companyId, metadata: { subjectKind: "user", subjectId: ticket.assignedToUserId } });
  }

  for (const comment of comments) {
    addNode({
      id: `ticket-comment:${comment.id}`,
      type: "comment",
      module: "Suporte",
      companyId: comment.ticket.companyId ?? undefined,
      label: comment.body.slice(0, 72) || "Comentário de chamado",
      description: comment.body,
      status: "ok",
      size: "sm",
      information: `Comentário de ${comment.authorName || comment.author.email} no chamado ${comment.ticket.code}.`,
      createdBy: comment.authorUserId,
      createdByEmail: comment.author.email,
      createdAt: date(comment.createdAt),
      entityType: "ticket_comment",
      entityId: comment.id,
      metadata: { actorUserId: comment.authorUserId, subjectKind: "user", subjectId: comment.authorUserId },
    });
    addEdge({ id: `ticket-${comment.ticketId}-comment-${comment.id}`, source: `ticket:${comment.ticketId}`, target: `ticket-comment:${comment.id}`, label: "tem comentário", type: "has_comment", status: "ok", companyId: comment.ticket.companyId ?? undefined });
    addEdge({ id: `comment-${comment.id}-author-${comment.authorUserId}`, source: `user:${comment.authorUserId}`, target: `ticket-comment:${comment.id}`, label: "escreveu comentário", type: "created_by", status: "ok", companyId: comment.ticket.companyId ?? undefined, metadata: { subjectKind: "user", subjectId: comment.authorUserId } });
  }

  for (const event of events) {
    addNode({
      id: `ticket-event:${event.id}`,
      type: "log",
      module: "Logs",
      companyId: event.ticket.companyId ?? undefined,
      label: event.type,
      description: `Evento do chamado ${event.ticket.code}.`,
      status: "ok",
      size: "sm",
      information: `Evento ${event.type} registrado no chamado ${event.ticket.code}.`,
      createdBy: event.actorUserId ?? undefined,
      createdAt: date(event.createdAt),
      entityType: "ticket_event",
      entityId: event.id,
      metadata: { payload: event.payload, actorUserId: event.actorUserId, subjectKind: event.actorUserId ? "user" : "system", subjectId: event.actorUserId },
    });
    addEdge({ id: `ticket-${event.ticketId}-event-${event.id}`, source: `ticket:${event.ticketId}`, target: `ticket-event:${event.id}`, label: "tem evento", type: "has_log", status: "ok", companyId: event.ticket.companyId ?? undefined });
  }

  for (const defect of defects) {
    const company = companyById.get(defect.companyId);
    addNode({
      id: `defect:${defect.id}`,
      type: "defect",
      module: "Defeitos",
      companyId: defect.companyId,
      companyName: company?.company_name || company?.name,
      label: defect.title,
      description: defect.description ?? "Defeito aberto sem descrição.",
      status: "pending",
      size: "lg",
      information: `Defeito aberto para ${company?.company_name || company?.name || "empresa"} e aguardando tratamento/correlação.`,
      createdAt: date(defect.createdAt),
      updatedAt: date(defect.updatedAt),
      entityType: "defect",
      entityId: defect.id,
      metadata: { releaseManualId: defect.releaseManualId },
    });
    addEdge({ id: `company-${defect.companyId}-defect-${defect.id}`, source: `company:${defect.companyId}`, target: `defect:${defect.id}`, label: "possui defeito", type: "contains", status: "pending", companyId: defect.companyId });
  }

  for (const card of kanbanCards) {
    const company = card.clientSlug ? companyBySlug.get(card.clientSlug) : null;
    const label = card.title || card.bug || `Cartão ${card.id}`;
    addNode({
      id: `kanban-defect:${card.id}`,
      type: "defect",
      module: "Defeitos",
      companyId: company?.id,
      companyName: company?.company_name || company?.name,
      projectName: card.project,
      label,
      description: card.bug || card.link || "Cartão Kanban relacionado a defeito ou execução.",
      status: statusFromGeneric(card.status),
      size: "md",
      information: `Cartão ${label} está em ${card.status || "status não informado"}.`,
      createdAt: date(card.createdAt),
      entityType: "kanban_card",
      entityId: String(card.id),
      metadata: { runId: card.runId, caseId: card.caseId, link: card.link, clientSlug: card.clientSlug },
    });
    if (company) addEdge({ id: `company-${company.id}-kanban-${card.id}`, source: `company:${company.id}`, target: `kanban-defect:${card.id}`, label: "possui cartão de defeito", type: "contains", status: statusFromGeneric(card.status), companyId: company.id });
  }

  for (const note of visibleNotes) {
    addNode({
      id: `note:${note.id}`,
      type: "document",
      module: "Documentos",
      label: note.title,
      description: note.content,
      status: statusFromGeneric(note.status),
      size: "md",
      information: `Nota ${note.title} criada por ${note.user.full_name || note.user.name || note.user.email}. Prioridade ${note.priority}.`,
      createdBy: note.userId,
      createdByEmail: note.user.email,
      createdAt: date(note.createdAt),
      updatedAt: date(note.updatedAt),
      entityType: "user_note",
      entityId: note.id,
      metadata: { color: note.color, priority: note.priority, tags: note.tags, status: note.status, actorUserId: note.userId, subjectKind: "user", subjectId: note.userId },
    });
    addEdge({ id: `user-${note.userId}-note-${note.id}`, source: `user:${note.userId}`, target: `note:${note.id}`, label: "possui nota", type: "has_document", status: "ok" });
  }

  for (const log of visibleAuditLogs) {
    addNode({
      id: `audit:${log.id}`,
      type: "log",
      module: "Logs",
      label: log.entity_label || log.action,
      description: `${log.action} em ${log.entity_type}.`,
      status: "ok",
      size: "sm",
      information: `Log ${log.action} por ${log.actor_email || "ator não informado"}.`,
      createdBy: log.actor_user_id ?? undefined,
      createdByEmail: log.actor_email ?? undefined,
      createdAt: date(log.created_at),
      entityType: "audit_log",
      entityId: log.id,
      metadata: { entityType: log.entity_type, entityId: log.entity_id, metadata: log.metadata, actorUserId: log.actor_user_id, actorEmail: log.actor_email, subjectKind: log.actor_user_id ? "user" : "system", subjectId: log.actor_user_id },
    });
    if (log.actor_user_id) {
      addEdge({ id: `user-${log.actor_user_id}-audit-${log.id}`, source: `user:${log.actor_user_id}`, target: `audit:${log.id}`, label: "gerou log", type: "has_log", status: "ok", metadata: { subjectKind: "user", subjectId: log.actor_user_id } });
    } else {
      addEdge({ id: `domain-audit-${log.id}`, source: "domain:quality-control", target: `audit:${log.id}`, label: "log sem ator mapeado", type: "has_log", status: "ok" });
    }
  }

  const uniqueNodes = uniqueById(nodes);
  const nodeIds = new Set(uniqueNodes.map((node) => node.id));
  const uniqueEdges = uniqueById(edges).filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  const visibleGraph = filterBrainDomainGraphByAccess(uniqueNodes, uniqueEdges, access);

  return NextResponse.json({
    nodes: visibleGraph.nodes,
    edges: visibleGraph.edges,
    summary: {
      companies: visibleGraph.nodes.filter((node) => node.type === "company").length,
      projects: visibleGraph.nodes.filter((node) => node.type === "project").length,
      users: visibleGraph.nodes.filter((node) => node.type === "person").length,
      tickets: visibleGraph.nodes.filter((node) => node.entityType === "ticket").length,
      ticketComments: visibleGraph.nodes.filter((node) => node.entityType === "ticket_comment").length,
      defects: visibleGraph.nodes.filter((node) => node.type === "defect").length,
      notes: visibleGraph.nodes.filter((node) => node.entityType === "user_note").length,
      logs: visibleGraph.nodes.filter((node) => node.type === "log").length,
      visibility: access.hasGlobalVisibility ? "global" : "scoped",
    },
  });
}
