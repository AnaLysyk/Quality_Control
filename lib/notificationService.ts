import "server-only";

// Este módulo só deve ser importado em server components ou rotas de API Next.js
import type { RequestRecord } from "@/data/requestsStore";
import type { Release } from "@/types/release";
import type { TicketRecord } from "@/lib/ticketsStore";
import type { TicketCommentRecord } from "@/lib/ticketCommentsStore";
import {
  closeNotificationsByDedupeKey,
  createNotificationsForUsers,
} from "@/lib/userNotificationsStore";
import {
  listLocalCompanies,
  listLocalLinksForCompany,
  listLocalUsers,
  listLocalMemberships,
} from "@/lib/auth/localStore";

// Retorna true se o usuário for admin global
function isAdminUser(user: { is_global_admin?: boolean; globalRole?: string | null }) {
  return user.is_global_admin === true || user.globalRole === "global_admin";
}

// Retorna true se o usuário for desenvolvedor (it_dev)
function isItDevUser(user: { role?: string | null }) {
  const role = (user.role ?? "").toLowerCase();
  return role === "it_dev" || role === "itdev" || role === "developer" || role === "dev";
}

async function resolveAdminUserIds() {
  const users = await listLocalUsers();
  return users.filter(isAdminUser).map((user) => user.id);
}

// Retorna lista de IDs de usuários admin global
async function resolveItDevUserIds() {
  const [users, memberships] = await Promise.all([listLocalUsers(), listLocalMemberships()]);
  const ids = new Set<string>();
  users.filter(isItDevUser).forEach((user) => ids.add(user.id));
  memberships
    .filter((membership) => isItDevUser({ role: membership.role }))
    .forEach((membership) => ids.add(membership.userId));
  return Array.from(ids);
}

// Retorna lista de IDs de usuários vinculados a uma empresa (inclui admins globais)
async function resolveCompanyUserIds(companySlug?: string | null) {
  const adminIds = await resolveAdminUserIds();
  if (!companySlug) return adminIds;
  const companies = await listLocalCompanies();
  const company = companies.find((item) => item.slug === companySlug);
  if (!company) return adminIds;
  const links = await listLocalLinksForCompany(company.id);
  const memberIds = links.map((link) => link.userId);
  return Array.from(new Set([...adminIds, ...memberIds]));
}

/**
 * Notifica admins e usuário sobre solicitação de reset de senha.
 */
export async function notifyPasswordResetRequest(request: RequestRecord) {
  const adminIds = await resolveAdminUserIds();
  const userLabel = request.userName || request.userEmail || "Usuario";
  await createNotificationsForUsers(adminIds, {
    type: "PASSWORD_RESET_REQUEST",
    title: "Reset de senha solicitado",
    description: `${userLabel} solicitou reset de senha.`,
    requestId: request.id,
    dedupeKey: `reset:admin:${request.id}`,
  });

  await createNotificationsForUsers([request.userId], {
    type: "PASSWORD_RESET_PENDING",
    title: "Solicitacao de reset enviada",
    description: "Aguardando aprovacao do administrador.",
    requestId: request.id,
    dedupeKey: `reset:user:${request.id}`,
  });
}

/**
 * Notifica usuário sobre aprovação ou rejeição do reset de senha.
 */
export async function notifyPasswordResetStatus(
  request: RequestRecord,
  status: "APPROVED" | "REJECTED",
) {
  const approved = status === "APPROVED";
  const type = approved ? "PASSWORD_RESET_APPROVED" : "PASSWORD_RESET_REJECTED";
  const title = approved ? "Reset de senha aprovado" : "Reset de senha rejeitado";
  const description = approved
    ? "Seu reset foi aprovado. Verifique seu email para continuar."
    : "Seu reset foi rejeitado. Entre em contato com o administrador.";

  await closeNotificationsByDedupeKey(request.userId, `reset:user:${request.id}`);
  await createNotificationsForUsers([request.userId], {
    type,
    title,
    description,
    requestId: request.id,
  });
}

/**
 * Notifica usuários da empresa sobre criação de nova run manual.
 */
export async function notifyManualRunCreated(release: Release) {
  const companySlug = release.clientSlug ?? null;
  const recipients = await resolveCompanyUserIds(companySlug);
  if (!recipients.length) return;
  const runSlug = release.slug ?? release.id ?? "run";
  const runName = release.name || runSlug;
  const link = companySlug
    ? `/empresas/${encodeURIComponent(companySlug)}/runs/${encodeURIComponent(runSlug)}`
    : null;
  const dedupeKey = `run:${runSlug}:created`;

  await createNotificationsForUsers(recipients, {
    type: "RUN_CREATED",
    title: "Nova run criada",
    description: `${runName} foi registrada.`,
    companySlug,
    link,
    dedupeKey,
  });

  await notifyManualRunFailure(release, recipients, link);
}

/**
 * Notifica usuários sobre falha(s) em uma run manual.
 */
export async function notifyManualRunFailure(
  release: Release,
  cachedRecipients?: string[],
  cachedLink?: string | null,
) {
  const failCount = Math.max(0, Number(release.stats?.fail ?? 0));
  if (failCount <= 0) return;
  const companySlug = release.clientSlug ?? null;
  const recipients = cachedRecipients ?? (await resolveCompanyUserIds(companySlug));
  if (!recipients.length) return;
  const runSlug = release.slug ?? release.id ?? "run";
  const runName = release.name || runSlug;
  const link =
    cachedLink ??
    (companySlug
      ? `/empresas/${encodeURIComponent(companySlug)}/runs/${encodeURIComponent(runSlug)}`
      : null);
  await createNotificationsForUsers(recipients, {
    type: "TEST_FAILED",
    title: "Caso de teste falhou",
    description: `${runName} teve ${failCount} falha(s) detectada(s).`,
    companySlug,
    link,
    dedupeKey: `run:${runSlug}:fail`,
  });
}

/**
 * Notifica admins e devs sobre novo chamado criado.
 */
export async function notifyTicketCreated(ticket: TicketRecord) {
  const recipients = Array.from(new Set([...(await resolveAdminUserIds()), ...(await resolveItDevUserIds())]));
  if (!recipients.length) return;
  const requester = ticket.createdByName || ticket.createdByEmail || "Usuario";
  const companyLabel = ticket.companySlug ? ` (${ticket.companySlug})` : "";
  const description = ticket.description
    ? `${requester}${companyLabel}: ${ticket.title}\n${ticket.description}`
    : `${requester}${companyLabel}: ${ticket.title}`;
  await createNotificationsForUsers(recipients, {
    type: "TICKET_CREATED",
    title: "Novo chamado",
    description,
    companySlug: ticket.companySlug ?? null,
    link: "/kanban-it",
    ticketId: ticket.id,
    dedupeKey: `ticket:${ticket.id}`,
  });
}

/**
 * Notifica criador e responsável por mudança de status do chamado.
 */
export async function notifyTicketStatusChanged(input: {
  ticket: TicketRecord;
  actorId: string;
  nextStatusLabel: string;
  reason?: string | null;
}) {
  const recipients = new Set<string>();
  if (input.ticket.createdBy && input.ticket.createdBy !== input.actorId) {
    recipients.add(input.ticket.createdBy);
  }
  if (input.ticket.assignedToUserId && input.ticket.assignedToUserId !== input.actorId) {
    recipients.add(input.ticket.assignedToUserId);
  }
  if (!recipients.size) return;
  const description = input.reason
    ? `Status atualizado para ${input.nextStatusLabel}. Motivo: ${input.reason}`
    : `Status atualizado para ${input.nextStatusLabel}.`;
  await createNotificationsForUsers(Array.from(recipients), {
    type: "TICKET_STATUS_CHANGED",
    title: "Status do chamado atualizado",
    description,
    companySlug: input.ticket.companySlug ?? null,
    link: "/meus-chamados",
    ticketId: input.ticket.id,
    dedupeKey: `ticket:${input.ticket.id}:status:${input.ticket.updatedAt}`,
  });
}

/**
 * Notifica partes interessadas sobre novo comentário em chamado.
 */
export async function notifyTicketCommentAdded(input: {
  ticket: TicketRecord;
  comment: TicketCommentRecord;
  actorId: string;
  actorName?: string | null;
}) {
  const recipients = new Set<string>();
  if (input.ticket.createdBy && input.ticket.createdBy !== input.actorId) {
    recipients.add(input.ticket.createdBy);
  }
  if (input.ticket.assignedToUserId && input.ticket.assignedToUserId !== input.actorId) {
    recipients.add(input.ticket.assignedToUserId);
  }
  if (!input.ticket.assignedToUserId && input.ticket.createdBy === input.actorId) {
    const itDevs = await resolveItDevUserIds();
    itDevs.filter((id) => id !== input.actorId).forEach((id) => recipients.add(id));
  }
  if (!recipients.size) return;
  const authorLabel = input.actorName || "Novo comentario";
  await createNotificationsForUsers(Array.from(recipients), {
    type: "TICKET_COMMENT_ADDED",
    title: "Novo comentario no chamado",
    description: `${authorLabel}: ${input.comment.body.slice(0, 160)}`,
    companySlug: input.ticket.companySlug ?? null,
    link: "/meus-chamados",
    ticketId: input.ticket.id,
    dedupeKey: `ticket:${input.ticket.id}:comment:${input.comment.id}`,
  });
}

/**
 * Notifica autor do comentário sobre reação recebida.
 */
export async function notifyTicketReactionAdded(input: {
  ticket: TicketRecord;
  comment: TicketCommentRecord;
  actorId: string;
}) {
  if (input.comment.authorUserId === input.actorId) return;
  await createNotificationsForUsers([input.comment.authorUserId], {
    type: "TICKET_REACTION_ADDED",
    title: "Curtiram seu comentario",
    description: "Uma reacao foi adicionada ao seu comentario.",
    companySlug: input.ticket.companySlug ?? null,
    link: "/meus-chamados",
    ticketId: input.ticket.id,
    dedupeKey: `ticket:${input.ticket.id}:reaction:${input.comment.id}:${input.actorId}`,
  });
}

/**
 * Notifica usuário atribuído a um chamado.
 */
export async function notifyTicketAssigned(input: {
  ticket: TicketRecord;
  assigneeId: string;
  actorId: string;
}) {
  if (!input.assigneeId || input.assigneeId === input.actorId) return;
  await createNotificationsForUsers([input.assigneeId], {
    type: "TICKET_ASSIGNED",
    title: "Chamado atribuido",
    description: `Voce foi atribuido ao chamado ${input.ticket.title}.`,
    companySlug: input.ticket.companySlug ?? null,
    link: "/kanban-it",
    ticketId: input.ticket.id,
    dedupeKey: `ticket:${input.ticket.id}:assigned:${input.assigneeId}`,
  });
}

/**
 * Notifica admins sobre novo comentário em solicitação de acesso.
 */
export async function notifyAccessRequestComment(input: {
  requestId: string;
  commentId: string;
  authorName: string;
  body: string;
}) {
  const adminIds = await resolveAdminUserIds();
  if (!adminIds.length) return;
  const preview = input.body.length > 160 ? `${input.body.slice(0, 160)}...` : input.body;
  await createNotificationsForUsers(adminIds, {
    type: "ACCESS_REQUEST_COMMENT",
    title: "Novo comentario em solicitacao de acesso",
    description: `${input.authorName}: ${preview}`,
    requestId: input.requestId,
    link: "/admin/access-requests",
    dedupeKey: `access-request:${input.requestId}:comment:${input.commentId}`,
  });
}
