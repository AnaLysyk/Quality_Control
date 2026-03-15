import "server-only";

import type { RequestRecord } from "@/data/requestsStore";
import type { Release } from "@/types/release";
import type { SuporteRecord } from "@/lib/ticketsStore";
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
import { canAdminReviewQueue, resolveReviewQueue, toRequestProfileTypeLabel, type ReviewQueue } from "@/lib/requestRouting";

function isAdminUser(user: { is_global_admin?: boolean; globalRole?: string | null }) {
  return user.is_global_admin === true || user.globalRole === "global_admin";
}

function isItDevUser(user: { role?: string | null }) {
  const role = (user.role ?? "").toLowerCase();
  return role === "it_dev" || role === "itdev" || role === "developer" || role === "dev";
}

function describePermissionRole(role?: string | null) {
  const normalized = (role ?? "").toLowerCase();
  if (normalized === "admin" || normalized === "global_admin") return "Admin";
  if (normalized === "dev" || normalized === "it_dev" || normalized === "itdev" || normalized === "developer") return "Dev";
  if (normalized === "company" || normalized === "company_admin" || normalized === "client_admin") return "Empresa";
  return "Usuario";
}

async function resolveAdminUserIds() {
  const users = await listLocalUsers();
  return users.filter(isAdminUser).map((user) => user.id);
}

async function resolveItDevUserIds() {
  const [users, memberships] = await Promise.all([listLocalUsers(), listLocalMemberships()]);
  const ids = new Set<string>();
  users.filter(isItDevUser).forEach((user) => ids.add(user.id));
  memberships
    .filter((membership) => isItDevUser({ role: membership.role }))
    .forEach((membership) => ids.add(membership.userId));
  return Array.from(ids);
}

async function resolveRequestReviewerIds(queue: ReviewQueue) {
  const globalIds = await resolveItDevUserIds();
  if (!canAdminReviewQueue(queue)) return globalIds;
  const adminIds = await resolveAdminUserIds();
  return Array.from(new Set([...adminIds, ...globalIds]));
}

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

export async function notifyPasswordResetRequest(request: RequestRecord) {
  const requestedProfileType =
    typeof request.payload?.profileType === "string" ? request.payload.profileType : null;
  const reviewQueue =
    typeof request.payload?.reviewQueue === "string" &&
    (request.payload.reviewQueue === "admin_and_global" || request.payload.reviewQueue === "global_only")
      ? request.payload.reviewQueue
      : resolveReviewQueue(
          requestedProfileType === "testing_company_user" ||
            requestedProfileType === "company_user" ||
            requestedProfileType === "testing_company_lead" ||
            requestedProfileType === "technical_support"
            ? requestedProfileType
            : "testing_company_user",
        );
  const reviewerIds = await resolveRequestReviewerIds(reviewQueue);
  const userLabel = request.userName || request.userEmail || "Usuario";
  const reviewerLabel = canAdminReviewQueue(reviewQueue) ? "Admin e Global" : "Global";
  await createNotificationsForUsers(reviewerIds, {
    type: "PASSWORD_RESET_REQUEST",
    title: "Reset de senha solicitado",
    description: `${userLabel} solicitou reset de senha para ${reviewerLabel}.`,
    requestId: request.id,
    dedupeKey: `reset:reviewers:${request.id}`,
  });

  await createNotificationsForUsers([request.userId], {
    type: "PASSWORD_RESET_PENDING",
    title: "Solicitacao de reset enviada",
    description: canAdminReviewQueue(reviewQueue)
      ? "Aguardando analise de Admin ou Global."
      : "Aguardando analise exclusiva do Global.",
    requestId: request.id,
    dedupeKey: `reset:user:${request.id}`,
  });
}

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

export async function notifyProfileDeletionRequest(request: RequestRecord) {
  const reviewQueue =
    typeof request.payload?.reviewQueue === "string" &&
    (request.payload.reviewQueue === "admin_and_global" || request.payload.reviewQueue === "global_only")
      ? request.payload.reviewQueue
      : "admin_and_global";
  const reviewerIds = await resolveRequestReviewerIds(reviewQueue);
  const userLabel = request.userName || request.userEmail || "Usuario";
  await createNotificationsForUsers(reviewerIds, {
    type: "PROFILE_DELETION_REQUEST",
    title: "Exclusao de perfil solicitada",
    description: `${userLabel} solicitou exclusao do proprio perfil.`,
    requestId: request.id,
    link: "/admin/requests",
    dedupeKey: `profile-deletion:reviewers:${request.id}`,
  });

  await createNotificationsForUsers([request.userId], {
    type: "PROFILE_DELETION_PENDING",
    title: "Solicitacao de exclusao enviada",
    description: "Seu pedido de exclusao de perfil foi enviado para analise.",
    requestId: request.id,
    link: "/requests",
    dedupeKey: `profile-deletion:user:${request.id}`,
  });
}

export async function notifyProfileDeletionStatus(
  request: RequestRecord,
  status: "APPROVED" | "REJECTED",
) {
  const approved = status === "APPROVED";
  await closeNotificationsByDedupeKey(request.userId, `profile-deletion:user:${request.id}`);
  await createNotificationsForUsers([request.userId], {
    type: approved ? "PROFILE_DELETION_APPROVED" : "PROFILE_DELETION_REJECTED",
    title: approved ? "Exclusao de perfil aprovada" : "Exclusao de perfil rejeitada",
    description: approved
      ? "Seu perfil foi desativado pela equipe administrativa."
      : "Seu pedido de exclusao de perfil foi rejeitado.",
    requestId: request.id,
    link: "/requests",
  });
}

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

export async function notifySuporteCreated(suporte: SuporteRecord) {
  const recipients = Array.from(new Set([...(await resolveAdminUserIds()), ...(await resolveItDevUserIds())]));
  if (!recipients.length) return;
  const requester = suporte.createdByName || suporte.createdByEmail || "Usuario";
  const companyLabel = suporte.companySlug ? ` (${suporte.companySlug})` : "";
  const description = suporte.description
    ? `${requester}${companyLabel}: ${suporte.title}\n${suporte.description}`
    : `${requester}${companyLabel}: ${suporte.title}`;
  await createNotificationsForUsers(recipients, {
    type: "TICKET_CREATED",
    title: "Novo suporte",
    description,
    companySlug: suporte.companySlug ?? null,
    link: "/kanban-it",
    ticketId: suporte.id,
    dedupeKey: `suporte:${suporte.id}`,
  });
}

export async function notifySuporteStatusChanged(input: {
  suporte: SuporteRecord;
  actorId: string;
  nextStatusLabel: string;
  reason?: string | null;
}) {
  const recipients = new Set<string>();
  if (input.suporte.createdBy && input.suporte.createdBy !== input.actorId) {
    recipients.add(input.suporte.createdBy);
  }
  if (input.suporte.assignedToUserId && input.suporte.assignedToUserId !== input.actorId) {
    recipients.add(input.suporte.assignedToUserId);
  }
  if (!recipients.size) return;
  const description = input.reason
    ? `Status atualizado para ${input.nextStatusLabel}. Motivo: ${input.reason}`
    : `Status atualizado para ${input.nextStatusLabel}.`;
  await createNotificationsForUsers(Array.from(recipients), {
    type: "TICKET_STATUS_CHANGED",
    title: "Status do suporte atualizado",
    description,
    companySlug: input.suporte.companySlug ?? null,
    link: "/meus-chamados",
    ticketId: input.suporte.id,
    dedupeKey: `suporte:${input.suporte.id}:status:${input.suporte.updatedAt}`,
  });
}

export async function notifySuporteCommentAdded(input: {
  suporte: SuporteRecord;
  comment: TicketCommentRecord;
  actorId: string;
  actorName?: string | null;
}) {
  const recipients = new Set<string>();
  if (input.suporte.createdBy && input.suporte.createdBy !== input.actorId) {
    recipients.add(input.suporte.createdBy);
  }
  if (input.suporte.assignedToUserId && input.suporte.assignedToUserId !== input.actorId) {
    recipients.add(input.suporte.assignedToUserId);
  }
  if (!input.suporte.assignedToUserId && input.suporte.createdBy === input.actorId) {
    const itDevs = await resolveItDevUserIds();
    itDevs.filter((id) => id !== input.actorId).forEach((id) => recipients.add(id));
  }
  if (!recipients.size) return;
  const authorLabel = input.actorName || "Novo comentario";
  await createNotificationsForUsers(Array.from(recipients), {
    type: "TICKET_COMMENT_ADDED",
    title: "Novo comentario no suporte",
    description: `${authorLabel}: ${input.comment.body.slice(0, 160)}`,
    companySlug: input.suporte.companySlug ?? null,
    link: "/meus-chamados",
    ticketId: input.suporte.id,
    dedupeKey: `suporte:${input.suporte.id}:comment:${input.comment.id}`,
  });
}

export async function notifySuporteReactionAdded(input: {
  suporte: SuporteRecord;
  comment: TicketCommentRecord;
  actorId: string;
}) {
  if (input.comment.authorUserId === input.actorId) return;
  await createNotificationsForUsers([input.comment.authorUserId], {
    type: "TICKET_REACTION_ADDED",
    title: "Curtiram seu comentario",
    description: "Uma reacao foi adicionada ao seu comentario.",
    companySlug: input.suporte.companySlug ?? null,
    link: "/meus-chamados",
    ticketId: input.suporte.id,
    dedupeKey: `suporte:${input.suporte.id}:reaction:${input.comment.id}:${input.actorId}`,
  });
}

export async function notifySuporteAssigned(input: {
  suporte: SuporteRecord;
  assigneeId: string;
  actorId: string;
}) {
  if (!input.assigneeId || input.assigneeId === input.actorId) return;
  await createNotificationsForUsers([input.assigneeId], {
    type: "TICKET_ASSIGNED",
    title: "Suporte atribuido",
    description: `Voce foi atribuido ao suporte ${input.suporte.title}.`,
    companySlug: input.suporte.companySlug ?? null,
    link: "/kanban-it",
    ticketId: input.suporte.id,
    dedupeKey: `suporte:${input.suporte.id}:assigned:${input.assigneeId}`,
  });
}

export async function notifyAccessRequestComment(input: {
  requestId: string;
  commentId: string;
  authorName: string;
  body: string;
  reviewQueue?: ReviewQueue | null;
}) {
  const reviewerIds = await resolveRequestReviewerIds(input.reviewQueue ?? "admin_and_global");
  if (!reviewerIds.length) return;
  const preview = input.body.length > 160 ? `${input.body.slice(0, 160)}...` : input.body;
  await createNotificationsForUsers(reviewerIds, {
    type: "ACCESS_REQUEST_COMMENT",
    title: "Novo comentario em solicitacao de acesso",
    description: `${input.authorName}: ${preview}`,
    requestId: input.requestId,
    link: "/admin/access-requests",
    dedupeKey: `access-request:${input.requestId}:comment:${input.commentId}`,
  });
}

export async function notifyAccessRequestCreated(input: {
  requestId: string;
  requesterName: string;
  profileType: "testing_company_user" | "company_user" | "testing_company_lead" | "technical_support";
  reviewQueue: ReviewQueue;
}) {
  const reviewerIds = await resolveRequestReviewerIds(input.reviewQueue);
  if (!reviewerIds.length) return;
  await createNotificationsForUsers(reviewerIds, {
    type: "ACCESS_REQUEST_CREATED",
    title: "Nova solicitacao de acesso",
    description: `${input.requesterName} solicitou ${toRequestProfileTypeLabel(input.profileType)}.`,
    requestId: input.requestId,
    link: "/admin/access-requests",
    dedupeKey: `access-request:${input.requestId}:created`,
  });
}

export async function notifyUserAccessUpdated(input: {
  targetUserId: string;
  actorEmail?: string | null;
  nextRole?: string | null;
  companyLabel?: string | null;
  permissionsCount?: number;
  restored?: boolean;
}) {
  if (!input.targetUserId) return;
  const roleLabel = describePermissionRole(input.nextRole);
  const actorLabel = input.actorEmail?.trim() || "administrador";
  const title = input.restored ? "Seu acesso foi restaurado" : "Seu acesso foi atualizado";
  const scopeLabel = input.companyLabel?.trim() ? ` Contexto principal: ${input.companyLabel}.` : "";
  const permissionsLabel =
    typeof input.permissionsCount === "number" ? ` Permissoes ativas: ${input.permissionsCount}.` : "";
  const description = input.restored
    ? `${actorLabel} restaurou seu acesso para a base ${roleLabel}.${scopeLabel}${permissionsLabel}`.trim()
    : `${actorLabel} atualizou seu perfil de acesso para ${roleLabel}.${scopeLabel}${permissionsLabel}`.trim();

  await createNotificationsForUsers([input.targetUserId], {
    type: input.restored ? "USER_ACCESS_RESTORED" : "USER_ACCESS_UPDATED",
    title,
    description,
    link: "/settings/profile",
  });
}

// Backwards-compatible wrappers for ticket-named notifications (map { ticket } -> { suporte })
import type { TicketRecord } from "@/lib/ticketsStore";

function unwrapTicketInput(input: { ticket: TicketRecord } | TicketRecord): TicketRecord | null {
  if (!input || typeof input !== "object") return null;
  return "ticket" in input ? input.ticket : input;
}

export async function notifyTicketCreated(input: { ticket: TicketRecord } | TicketRecord) {
  const ticket = unwrapTicketInput(input);
  if (!ticket) return;
  return notifySuporteCreated(ticket as SuporteRecord);
}

export async function notifyTicketStatusChanged(input: {
  ticket: TicketRecord;
  actorId: string;
  nextStatusLabel: string;
  reason?: string | null;
}) {
  if (!input || !input.ticket) return;
  return notifySuporteStatusChanged({ suporte: input.ticket as SuporteRecord, actorId: input.actorId, nextStatusLabel: input.nextStatusLabel, reason: input.reason });
}

export async function notifyTicketCommentAdded(input: {
  ticket: TicketRecord;
  comment: TicketCommentRecord;
  actorId: string;
  actorName?: string | null;
}) {
  if (!input || !input.ticket) return;
  return notifySuporteCommentAdded({ suporte: input.ticket as SuporteRecord, comment: input.comment, actorId: input.actorId, actorName: input.actorName });
}

export async function notifyTicketReactionAdded(input: { ticket: TicketRecord; comment: TicketCommentRecord; actorId: string }) {
  if (!input || !input.ticket) return;
  return notifySuporteReactionAdded({ suporte: input.ticket as SuporteRecord, comment: input.comment, actorId: input.actorId });
}

export async function notifyTicketAssigned(input: { ticket: TicketRecord; assigneeId: string; actorId: string }) {
  if (!input || !input.ticket) return;
  return notifySuporteAssigned({ suporte: input.ticket as SuporteRecord, assigneeId: input.assigneeId, actorId: input.actorId });
}

