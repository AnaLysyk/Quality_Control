import "server-only";

import type { RequestRecord } from "@/data/requestsStore";
import type { Release } from "@/types/release";
import type { SuporteRecord } from "@/lib/ticketsStore";
import type { SuporteCommentRecord } from "@/lib/ticketCommentsStore";
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

function isAdminUser(user: { is_global_admin?: boolean; globalRole?: string | null }) {
  return user.is_global_admin === true || user.globalRole === "global_admin";
}

function isItDevUser(user: { role?: string | null }) {
  const role = (user.role ?? "").toLowerCase();
  return role === "it_dev" || role === "itdev" || role === "developer" || role === "dev";
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
    type: "SUPORTE_CREATED",
    title: "Novo suporte",
    description,
    companySlug: suporte.companySlug ?? null,
    link: "/kanban-it",
    suporteId: suporte.id,
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
    type: "SUPORTE_STATUS_CHANGED",
    title: "Status do suporte atualizado",
    description,
    companySlug: input.suporte.companySlug ?? null,
    link: "/meus-chamados",
    suporteId: input.suporte.id,
    dedupeKey: `suporte:${input.suporte.id}:status:${input.suporte.updatedAt}`,
  });
}

export async function notifySuporteCommentAdded(input: {
  suporte: SuporteRecord;
  comment: SuporteCommentRecord;
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
    type: "SUPORTE_COMMENT_ADDED",
    title: "Novo comentario no suporte",
    description: `${authorLabel}: ${input.comment.body.slice(0, 160)}`,
    companySlug: input.suporte.companySlug ?? null,
    link: "/meus-chamados",
    suporteId: input.suporte.id,
    dedupeKey: `suporte:${input.suporte.id}:comment:${input.comment.id}`,
  });
}

export async function notifySuporteReactionAdded(input: {
  suporte: SuporteRecord;
  comment: SuporteCommentRecord;
  actorId: string;
}) {
  if (input.comment.authorUserId === input.actorId) return;
  await createNotificationsForUsers([input.comment.authorUserId], {
    type: "SUPORTE_REACTION_ADDED",
    title: "Curtiram seu comentario",
    description: "Uma reacao foi adicionada ao seu comentario.",
    companySlug: input.suporte.companySlug ?? null,
    link: "/meus-chamados",
    suporteId: input.suporte.id,
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
    type: "SUPORTE_ASSIGNED",
    title: "Suporte atribuido",
    description: `Voce foi atribuido ao suporte ${input.suporte.title}.",
    companySlug: input.suporte.companySlug ?? null,
    link: "/kanban-it",
    suporteId: input.suporte.id,
    dedupeKey: `suporte:${input.suporte.id}:assigned:${input.assigneeId}`,
  });
}

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
