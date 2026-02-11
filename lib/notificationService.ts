import "server-only";

import type { RequestRecord } from "@/data/requestsStore";
import type { Release } from "@/types/release";
import type { TicketRecord } from "@/lib/ticketsStore";
import {
  closeNotificationsByDedupeKey,
  createNotificationsForUsers,
} from "@/lib/userNotificationsStore";
import {
  listLocalCompanies,
  listLocalLinksForCompany,
  listLocalUsers,
} from "@/lib/auth/localStore";

function isAdminUser(user: { is_global_admin?: boolean; globalRole?: string | null }) {
  return user.is_global_admin === true || user.globalRole === "global_admin";
}

async function resolveAdminUserIds() {
  const users = await listLocalUsers();
  return users.filter(isAdminUser).map((user) => user.id);
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

export async function notifyTicketCreated(ticket: TicketRecord) {
  const recipients = await resolveAdminUserIds();
  if (!recipients.length) return;
  const requester = ticket.createdByName || ticket.createdByEmail || "Usuario";
  const companyLabel = ticket.companySlug ? ` (${ticket.companySlug})` : "";
  await createNotificationsForUsers(recipients, {
    type: "TICKET_CREATED",
    title: "Novo chamado",
    description: `${requester}${companyLabel}: ${ticket.title}`,
    companySlug: ticket.companySlug ?? null,
    link: "/admin/chamados",
    dedupeKey: `ticket:${ticket.id}`,
  });
}
