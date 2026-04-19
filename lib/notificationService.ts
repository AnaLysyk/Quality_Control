import "server-only";

import type { WikiDoc } from "@/data/platformDocsStore";
import type { RequestRecord } from "@/data/requestsStore";
import type { Release } from "@/types/release";
import type { SuporteRecord } from "@/lib/ticketsStore";
import type { TicketCommentRecord } from "@/lib/ticketCommentsStore";
import type { CompanyDefectRecord } from "@/lib/companyDefects";
import {
  closeNotificationsByDedupeKey,
  createNotificationsForUsers,
} from "@/lib/userNotificationsStore";
import {
  listLocalCompanies,
  listLocalLinksForCompany,
  listLocalUsers,
  listLocalMemberships,
  getLocalUserById,
} from "@/lib/auth/localStore";
import { toRequestProfileTypeLabel, type RequestProfileType, type ReviewQueue } from "@/lib/requestRouting";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";

function isAdminUser(user: { is_global_admin?: boolean; globalRole?: string | null }) {
  return user.is_global_admin === true || normalizeLegacyRole(user.globalRole) === SYSTEM_ROLES.LEADER_TC;
}

function canReviewAccessRequestsByRole(role?: string | null) {
  return hasPermissionAccess(resolveRoleDefaults(role), "access_requests", "view");
}

function canReceiveReviewQueue(role: string | null | undefined, queue: ReviewQueue, isGlobalAdmin = false) {
  if (isGlobalAdmin) return true;
  if (queue !== "admin_and_global" && queue !== "global_only") return false;
  return canReviewAccessRequestsByRole(role);
}

function isTechnicalSupportUser(user: { role?: string | null }) {
  return normalizeLegacyRole(user.role) === SYSTEM_ROLES.TECHNICAL_SUPPORT;
}

function describePermissionRole(role?: string | null) {
  const normalized = normalizeLegacyRole(role);
  if (normalized === SYSTEM_ROLES.LEADER_TC) return "Lider TC";
  if (normalized === SYSTEM_ROLES.TECHNICAL_SUPPORT) return "Suporte tecnico";
  if (normalized === SYSTEM_ROLES.EMPRESA || normalized === SYSTEM_ROLES.COMPANY_USER) return "Empresa";
  return "Usuario";
}

function normalizeCompanySlug(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function parseBooleanFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  return null;
}

function isCompanyLinkedNotificationFanoutEnabled(company: Record<string, unknown>) {
  const candidates = [
    company.notifications_fanout_enabled,
    company.notificationsFanoutEnabled,
    company.notify_linked_users_on_change,
    company.notifyLinkedUsersOnChange,
  ];
  for (const candidate of candidates) {
    const parsed = parseBooleanFlag(candidate);
    if (parsed !== null) return parsed;
  }
  return true;
}

async function resolveAdminUserIds() {
  const users = await listLocalUsers();
  return users.filter(isAdminUser).map((user) => user.id);
}

async function resolveTechnicalSupportUserIds() {
  const [users, memberships] = await Promise.all([listLocalUsers(), listLocalMemberships()]);
  const ids = new Set<string>();
  users.filter(isTechnicalSupportUser).forEach((user) => ids.add(user.id));
  memberships
    .filter((membership) => isTechnicalSupportUser({ role: membership.role }))
    .forEach((membership) => ids.add(membership.userId));
  return Array.from(ids);
}

async function resolveRequestReviewerIds(queue: ReviewQueue) {
  const [users, memberships] = await Promise.all([listLocalUsers(), listLocalMemberships()]);
  const all = new Set<string>();

  for (const user of users) {
    if (canReceiveReviewQueue(user.role, queue, isAdminUser(user))) {
      all.add(user.id);
    }
  }

  for (const membership of memberships) {
    if (canReceiveReviewQueue(membership.role, queue)) {
      all.add(membership.userId);
    }
  }

  return Array.from(all);
}

async function resolveSelfServiceRequestReviewerIds() {
  return resolveTechnicalSupportUserIds();
}

async function resolveCompanyUserIds(companySlug?: string | null) {
  const adminIds = await resolveAdminUserIds();
  if (!companySlug) return adminIds;
  const companies = await listLocalCompanies();
  const normalizedSlug = normalizeCompanySlug(companySlug);
  const company = companies.find((item) => normalizeCompanySlug(item.slug) === normalizedSlug);
  if (!company) return adminIds;
  const links = await listLocalLinksForCompany(company.id);
  const memberIds = links.map((link) => link.userId);
  return Array.from(new Set([...adminIds, ...memberIds]));
}

async function resolveCompanyLinkedUserIds(companySlug?: string | null) {
  if (!companySlug) return [] as string[];
  const companies = await listLocalCompanies();
  const normalizedSlug = normalizeCompanySlug(companySlug);
  const company = companies.find((item) => normalizeCompanySlug(item.slug) === normalizedSlug);
  if (!company) return [] as string[];
  if (!isCompanyLinkedNotificationFanoutEnabled(company as Record<string, unknown>)) {
    return [] as string[];
  }
  const links = await listLocalLinksForCompany(company.id);
  return Array.from(new Set(links.map((link) => link.userId).filter(Boolean)));
}

function isActiveNotificationUser(user: { active?: boolean; status?: string | null }) {
  return user.active !== false && user.status !== "blocked";
}

function isPrivilegedWikiRole(role?: string | null) {
  const normalized = normalizeLegacyRole(role);
  return normalized === SYSTEM_ROLES.LEADER_TC || normalized === SYSTEM_ROLES.TECHNICAL_SUPPORT;
}

function matchesCompanyId(left?: string | null, right?: string | null) {
  const normalizedLeft = (left ?? "").trim();
  const normalizedRight = (right ?? "").trim();
  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight;
}

function isDirectCompanyWikiUser(
  user: {
    user_origin?: string | null;
    default_company_slug?: string | null;
    created_by_company_id?: string | null;
    home_company_id?: string | null;
  },
  company: { id: string; slug?: string | null },
) {
  const companySlug = normalizeCompanySlug(company.slug);
  const defaultCompanySlug = normalizeCompanySlug(user.default_company_slug);
  if (user.user_origin === "client_company" && companySlug && defaultCompanySlug === companySlug) {
    return true;
  }
  return matchesCompanyId(user.created_by_company_id, company.id) || matchesCompanyId(user.home_company_id, company.id);
}

async function resolvePlatformWikiRecipientIds() {
  const users = await listLocalUsers();
  return users
    .filter((user) => Boolean(user.id) && isActiveNotificationUser(user))
    .map((user) => user.id);
}

async function resolveCompanyWikiRecipientIds(companySlug?: string | null) {
  const normalizedSlug = normalizeCompanySlug(companySlug);
  if (!normalizedSlug) return [] as string[];

  const [users, companies, memberships] = await Promise.all([
    listLocalUsers(),
    listLocalCompanies(),
    listLocalMemberships(),
  ]);
  const company = companies.find((item) => normalizeCompanySlug(item.slug) === normalizedSlug);
  if (!company) return [] as string[];

  const linkedFanoutEnabled = isCompanyLinkedNotificationFanoutEnabled(company as Record<string, unknown>);
  const membershipsByUserId = new Map<string, (typeof memberships)[number][]>();
  for (const membership of memberships) {
    const current = membershipsByUserId.get(membership.userId) ?? [];
    current.push(membership);
    membershipsByUserId.set(membership.userId, current);
  }

  const recipients = new Set<string>();
  for (const user of users) {
    if (!user.id || !isActiveNotificationUser(user)) continue;
    const userMemberships = membershipsByUserId.get(user.id) ?? [];
    const linkedToCompany = linkedFanoutEnabled && userMemberships.some((membership) => membership.companyId === company.id);
    const hasPrivilegedAccess =
      user.is_global_admin === true ||
      normalizeLegacyRole(user.globalRole) === SYSTEM_ROLES.LEADER_TC ||
      isPrivilegedWikiRole(user.role) ||
      userMemberships.some((membership) => isPrivilegedWikiRole(membership.role));
    const directCompanyUser = isDirectCompanyWikiUser(user, company);

    if (linkedToCompany || hasPrivilegedAccess || directCompanyUser) {
      recipients.add(user.id);
    }
  }

  return Array.from(recipients);
}

function buildCompanyWikiDocsLink(companySlug: string) {
  return `/empresas/${encodeURIComponent(companySlug)}/docs`;
}

function buildWikiDocNotificationTitle(event: "created" | "published") {
  return event === "created" ? "Novo documento publicado" : "Documento publicado";
}

function buildWikiDocNotificationDescription(input: {
  title: string;
  scopeLabel: string;
  event: "created" | "published";
}) {
  if (input.event === "created") {
    return `${input.title} foi criado e publicado no repositório ${input.scopeLabel}.`;
  }
  return `${input.title} foi publicado no repositório ${input.scopeLabel}.`;
}

export async function notifyPlatformWikiDocPublished(input: {
  doc: Pick<WikiDoc, "id" | "title" | "updatedAt">;
  event: "created" | "published";
}) {
  const recipients = await resolvePlatformWikiRecipientIds();
  if (!recipients.length) return;

  await createNotificationsForUsers(recipients, {
    type: "DOC_PUBLISHED",
    title: buildWikiDocNotificationTitle(input.event),
    description: buildWikiDocNotificationDescription({
      title: input.doc.title || "Documento",
      scopeLabel: "da Testing Company",
      event: input.event,
    }),
    link: "/docs",
    dedupeKey: `wiki-doc:platform:${input.doc.id}:${input.doc.updatedAt}`,
  });
}

export async function notifyCompanyWikiDocPublished(input: {
  companySlug: string;
  doc: Pick<WikiDoc, "id" | "title" | "updatedAt">;
  event: "created" | "published";
}) {
  const normalizedSlug = normalizeCompanySlug(input.companySlug);
  if (!normalizedSlug) return;

  const recipients = await resolveCompanyWikiRecipientIds(normalizedSlug);
  if (!recipients.length) return;

  const companies = await listLocalCompanies();
  const company = companies.find((item) => normalizeCompanySlug(item.slug) === normalizedSlug);
  const companyLabel = company?.name || company?.company_name || normalizedSlug;

  await createNotificationsForUsers(recipients, {
    type: "DOC_PUBLISHED",
    title: buildWikiDocNotificationTitle(input.event),
    description: buildWikiDocNotificationDescription({
      title: input.doc.title || "Documento",
      scopeLabel: `de ${companyLabel}`,
      event: input.event,
    }),
    companySlug: normalizedSlug,
    link: buildCompanyWikiDocsLink(normalizedSlug),
    dedupeKey: `wiki-doc:company:${normalizedSlug}:${input.doc.id}:${input.doc.updatedAt}`,
  });
}

async function resolveCompanySlugFromClientId(clientId?: string | null) {
  if (!clientId) return null;
  const normalizedClientId = clientId.trim();
  if (!normalizedClientId) return null;
  const companies = await listLocalCompanies();
  const byId = companies.find((item) => item.id === normalizedClientId);
  return byId?.slug ?? null;
}

async function resolveAccessRequestRecipientIds(input: {
  reviewQueue: ReviewQueue;
  companySlug?: string | null;
  clientId?: string | null;
}) {
  const reviewerIds = await resolveRequestReviewerIds(input.reviewQueue);
  const resolvedCompanySlug =
    normalizeCompanySlug(input.companySlug) ||
    normalizeCompanySlug(await resolveCompanySlugFromClientId(input.clientId));
  const companyLinkedIds = await resolveCompanyLinkedUserIds(resolvedCompanySlug || null);
  return Array.from(new Set([...reviewerIds, ...companyLinkedIds]));
}

function buildDefectLink(companySlug?: string | null, defectSlug?: string | null) {
  if (!companySlug || !defectSlug) return null;
  return `/empresas/${encodeURIComponent(companySlug)}/defeitos?defect=${encodeURIComponent(defectSlug)}`;
}

async function resolveDefectRecipientIds(input: {
  defect: Pick<CompanyDefectRecord, "slug" | "createdByUserId" | "assignedToUserId">;
  companySlug?: string | null;
  actorId: string;
}) {
  const recipients = new Set<string>();
  const companyRecipients = await resolveCompanyUserIds(input.companySlug ?? null);
  companyRecipients.forEach((id) => {
    if (id && id !== input.actorId) recipients.add(id);
  });
  if (input.defect.createdByUserId && input.defect.createdByUserId !== input.actorId) {
    recipients.add(input.defect.createdByUserId);
  }
  if (input.defect.assignedToUserId && input.defect.assignedToUserId !== input.actorId) {
    recipients.add(input.defect.assignedToUserId);
  }
  return Array.from(recipients);
}

export async function notifyPasswordResetRequest(request: RequestRecord) {
  const reviewerIds = await resolveSelfServiceRequestReviewerIds();
  const userLabel = request.userName || request.userEmail || "Usuario";
  await createNotificationsForUsers(reviewerIds, {
    type: "PASSWORD_RESET_REQUEST",
    title: "Reset de senha solicitado",
    description: `${userLabel} solicitou reset de senha para o Suporte tecnico.`,
    requestId: request.id,
    dedupeKey: `reset:reviewers:${request.id}`,
  });

  await createNotificationsForUsers([request.userId], {
    type: "PASSWORD_RESET_PENDING",
    title: "Solicitacao de reset enviada",
    description: "Aguardando analise do Suporte tecnico.",
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

  let reviewerName = "um revisor";
  if (request.reviewedBy) {
    const reviewer = await getLocalUserById(request.reviewedBy);
    reviewerName = reviewer?.full_name?.trim() || reviewer?.name || reviewer?.email || request.reviewedBy;
  }

  const userLabel = request.userName || request.userEmail || "Usuario";
  const userDescription = approved
    ? `Seu reset foi aprovado por ${reviewerName}. Verifique seu email para continuar.`
    : `Seu reset foi rejeitado por ${reviewerName}. Entre em contato com o administrador.`;

  await closeNotificationsByDedupeKey(request.userId, `reset:user:${request.id}`);
  await createNotificationsForUsers([request.userId], {
    type,
    title,
    description: userDescription,
    requestId: request.id,
  });

  const reviewerDescription = approved
    ? `Reset de senha de ${userLabel} foi aprovado por ${reviewerName}.`
    : `Reset de senha de ${userLabel} foi rejeitado por ${reviewerName}.`;

  const reviewerIds = (await resolveSelfServiceRequestReviewerIds()).filter((id) => id !== request.userId);
  if (reviewerIds.length > 0) {
    await createNotificationsForUsers(reviewerIds, {
      type,
      title: `Reset de senha ${approved ? "aprovado" : "rejeitado"}`,
      description: reviewerDescription,
      requestId: request.id,
      dedupeKey: `reset:status:${request.id}`,
    });
  }
}

export async function notifyProfileDeletionRequest(request: RequestRecord) {
  const reviewerIds = await resolveSelfServiceRequestReviewerIds();
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

export async function notifyDefectStatusChanged(input: {
  defect: Pick<CompanyDefectRecord, "slug" | "title" | "name" | "createdByUserId" | "assignedToUserId">;
  companySlug?: string | null;
  actorId: string;
  actorName?: string | null;
  nextStatusLabel: string;
}) {
  const recipients = await resolveDefectRecipientIds(input);
  if (!recipients.length) return;
  const defectLabel = input.defect.title || input.defect.name || input.defect.slug;
  const actorLabel = input.actorName || "Fluxo de defeitos";
  await createNotificationsForUsers(recipients, {
    type: "DEFECT_STATUS_CHANGED",
    title: "Status do defeito atualizado",
    description: `${actorLabel} atualizou ${defectLabel} para ${input.nextStatusLabel}.`,
    companySlug: input.companySlug ?? null,
    link: buildDefectLink(input.companySlug ?? null, input.defect.slug),
    dedupeKey: `defect:${input.defect.slug}:status:${input.nextStatusLabel}:${Date.now()}`,
  });
}

export async function notifyDefectCommentAdded(input: {
  defect: Pick<CompanyDefectRecord, "slug" | "title" | "name" | "createdByUserId" | "assignedToUserId">;
  companySlug?: string | null;
  actorId: string;
  actorName?: string | null;
  commentId: string;
  body: string;
}) {
  const recipients = await resolveDefectRecipientIds(input);
  if (!recipients.length) return;
  const defectLabel = input.defect.title || input.defect.name || input.defect.slug;
  const preview = input.body.length > 160 ? `${input.body.slice(0, 160)}...` : input.body;
  await createNotificationsForUsers(recipients, {
    type: "DEFECT_COMMENT_ADDED",
    title: "Novo comentario no defeito",
    description: `${input.actorName || "Novo comentario"} em ${defectLabel}: ${preview}`,
    companySlug: input.companySlug ?? null,
    link: buildDefectLink(input.companySlug ?? null, input.defect.slug),
    dedupeKey: `defect:${input.defect.slug}:comment:${input.commentId}`,
  });
}

export async function notifyDefectAssigned(input: {
  defect: Pick<CompanyDefectRecord, "slug" | "title" | "name" | "createdByUserId" | "assignedToUserId">;
  companySlug?: string | null;
  actorId: string;
  assigneeId: string;
  assigneeName?: string | null;
}) {
  const recipients = await resolveDefectRecipientIds(input);
  if (!recipients.length) return;
  const defectLabel = input.defect.title || input.defect.name || input.defect.slug;
  await createNotificationsForUsers(recipients, {
    type: "DEFECT_ASSIGNED",
    title: "Responsavel do defeito atualizado",
    description: `${defectLabel} foi atribuido para ${input.assigneeName || "um responsavel"}.`,
    companySlug: input.companySlug ?? null,
    link: buildDefectLink(input.companySlug ?? null, input.defect.slug),
    dedupeKey: `defect:${input.defect.slug}:assigned:${input.assigneeId}:${Date.now()}`,
  });
}

export async function notifyIntegrationRunCreated(input: {
  slug: string;
  title: string;
  clientId?: string | null;
  clientName?: string | null;
  qaseProject?: string | null;
}) {
  const runSlug = input.slug ?? "run";
  const runName = input.title || runSlug;

  const companySlug = await resolveCompanySlugForIntegration(input.clientId, input.clientName, input.qaseProject);
  const recipients = await resolveCompanyUserIds(companySlug);
  if (!recipients.length) return;

  const link = companySlug
    ? `/empresas/${encodeURIComponent(companySlug)}/runs/${encodeURIComponent(runSlug)}`
    : null;

  await createNotificationsForUsers(recipients, {
    type: "RUN_CREATED",
    title: "Nova run via integração",
    description: `${runName} foi registrada via integração.`,
    companySlug,
    link,
    dedupeKey: `run:${runSlug}:created`,
  });
}

async function resolveCompanySlugForIntegration(
  clientId?: string | null,
  clientName?: string | null,
  qaseProject?: string | null,
) {
  const companies = await listLocalCompanies();
  if (clientId) {
    const byId = companies.find((c) => c.id === clientId || c.slug === clientId);
    if (byId) return byId.slug;
  }
  if (clientName) {
    const normalized = clientName.trim().toLowerCase();
    const byName = companies.find(
      (c) =>
        (c.name ?? "").trim().toLowerCase() === normalized ||
        (c.company_name ?? "").trim().toLowerCase() === normalized ||
        (c.slug ?? "").trim().toLowerCase() === normalized,
    );
    if (byName) return byName.slug;
  }
  if (qaseProject) {
    const code = qaseProject.trim().toUpperCase();
    const byProject = companies.find((c) => {
      const codes = Array.isArray(c.qase_project_codes) ? c.qase_project_codes : [];
      return codes.some((pc: unknown) => typeof pc === "string" && pc.trim().toUpperCase() === code);
    });
    if (byProject) return byProject.slug;
  }
  return null;
}

export async function notifySuporteCreated(suporte: SuporteRecord) {
  const recipients = Array.from(
    new Set([
      ...(await resolveAdminUserIds()),
      ...(await resolveTechnicalSupportUserIds()),
      ...(await resolveCompanyUserIds(suporte.companySlug ?? null)),
    ]),
  );
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
  const companyRecipients = await resolveCompanyUserIds(input.suporte.companySlug ?? null);
  companyRecipients
    .filter((id) => id !== input.actorId)
    .forEach((id) => recipients.add(id));
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
  const companyRecipients = await resolveCompanyUserIds(input.suporte.companySlug ?? null);
  companyRecipients
    .filter((id) => id !== input.actorId)
    .forEach((id) => recipients.add(id));
  if (input.suporte.createdBy && input.suporte.createdBy !== input.actorId) {
    recipients.add(input.suporte.createdBy);
  }
  if (input.suporte.assignedToUserId && input.suporte.assignedToUserId !== input.actorId) {
    recipients.add(input.suporte.assignedToUserId);
  }
  if (!input.suporte.assignedToUserId && input.suporte.createdBy === input.actorId) {
    const supportUsers = await resolveTechnicalSupportUserIds();
    supportUsers.filter((id) => id !== input.actorId).forEach((id) => recipients.add(id));
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
  const recipients = new Set<string>();
  const companyRecipients = await resolveCompanyUserIds(input.suporte.companySlug ?? null);
  companyRecipients
    .filter((id) => id !== input.actorId)
    .forEach((id) => recipients.add(id));
  if (input.comment.authorUserId && input.comment.authorUserId !== input.actorId) {
    recipients.add(input.comment.authorUserId);
  }
  if (!recipients.size) return;
  await createNotificationsForUsers(Array.from(recipients), {
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
  const recipients = new Set<string>();
  const companyRecipients = await resolveCompanyUserIds(input.suporte.companySlug ?? null);
  companyRecipients
    .filter((id) => id !== input.actorId)
    .forEach((id) => recipients.add(id));
  if (input.assigneeId && input.assigneeId !== input.actorId) {
    recipients.add(input.assigneeId);
  }
  if (!recipients.size) return;
  await createNotificationsForUsers(Array.from(recipients), {
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
  companySlug?: string | null;
  clientId?: string | null;
}) {
  const recipients = await resolveAccessRequestRecipientIds({
    reviewQueue: input.reviewQueue ?? "admin_and_global",
    companySlug: input.companySlug ?? null,
    clientId: input.clientId ?? null,
  });
  if (!recipients.length) return;
  const preview = input.body.length > 160 ? `${input.body.slice(0, 160)}...` : input.body;
  await createNotificationsForUsers(recipients, {
    type: "ACCESS_REQUEST_COMMENT",
    title: "Novo comentario em solicitacao de acesso",
    description: `${input.authorName}: ${preview}`,
    requestId: input.requestId,
    link: "/admin/access-requests",
    companySlug: input.companySlug ?? null,
    dedupeKey: `access-request:${input.requestId}:comment:${input.commentId}`,
  });
}

export async function notifyAccessRequestCreated(input: {
  requestId: string;
  requesterName: string;
  profileType: RequestProfileType;
  reviewQueue: ReviewQueue;
  companySlug?: string | null;
  clientId?: string | null;
}) {
  const recipients = await resolveAccessRequestRecipientIds({
    reviewQueue: input.reviewQueue,
    companySlug: input.companySlug ?? null,
    clientId: input.clientId ?? null,
  });
  if (!recipients.length) return;
  await createNotificationsForUsers(recipients, {
    type: "ACCESS_REQUEST_CREATED",
    title: "Nova solicitacao de acesso",
    description: `${input.requesterName} solicitou ${toRequestProfileTypeLabel(input.profileType)}.`,
    requestId: input.requestId,
    link: "/admin/access-requests",
    companySlug: input.companySlug ?? null,
    dedupeKey: `access-request:${input.requestId}:created`,
  });
}

export async function notifyAccessRequestAccepted(input: {
  requestId: string;
  requesterName: string;
  approverName: string;
  profileType: RequestProfileType;
  reviewQueue: ReviewQueue;
  companySlug?: string | null;
  clientId?: string | null;
}) {
  const recipients = await resolveAccessRequestRecipientIds({
    reviewQueue: input.reviewQueue,
    companySlug: input.companySlug ?? null,
    clientId: input.clientId ?? null,
  });
  if (!recipients.length) return;
  await createNotificationsForUsers(recipients, {
    type: "ACCESS_REQUEST_ACCEPTED",
    title: "Solicitacao de acesso aprovada",
    description: `${input.approverName} aprovou a solicitacao de ${input.requesterName} (${toRequestProfileTypeLabel(input.profileType)}).`,
    requestId: input.requestId,
    link: "/admin/access-requests",
    companySlug: input.companySlug ?? null,
    dedupeKey: `access-request:${input.requestId}:accepted`,
  });
}

export async function notifyAccessRequestRejected(input: {
  requestId: string;
  requesterName: string;
  rejectorName: string;
  profileType: RequestProfileType;
  reviewQueue: ReviewQueue;
  reason?: string | null;
  companySlug?: string | null;
  clientId?: string | null;
}) {
  const recipients = await resolveAccessRequestRecipientIds({
    reviewQueue: input.reviewQueue,
    companySlug: input.companySlug ?? null,
    clientId: input.clientId ?? null,
  });
  if (!recipients.length) return;
  const reasonSuffix = input.reason ? ` Motivo: ${input.reason}` : "";
  await createNotificationsForUsers(recipients, {
    type: "ACCESS_REQUEST_REJECTED",
    title: "Solicitacao de acesso recusada",
    description: `${input.rejectorName} recusou a solicitacao de ${input.requesterName} (${toRequestProfileTypeLabel(input.profileType)}).${reasonSuffix}`,
    requestId: input.requestId,
    link: "/admin/access-requests",
    companySlug: input.companySlug ?? null,
    dedupeKey: `access-request:${input.requestId}:rejected`,
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

export async function notifyTicketUpdated(input: {
  ticket: TicketRecord;
  actorId: string;
  actorName?: string | null;
  changedFields?: string[];
}) {
  if (!input?.ticket) return;
  const suporte = input.ticket as SuporteRecord;
  const recipients = new Set<string>();
  const companyRecipients = await resolveCompanyUserIds(suporte.companySlug ?? null);
  companyRecipients
    .filter((id) => id !== input.actorId)
    .forEach((id) => recipients.add(id));
  if (suporte.createdBy && suporte.createdBy !== input.actorId) {
    recipients.add(suporte.createdBy);
  }
  if (suporte.assignedToUserId && suporte.assignedToUserId !== input.actorId) {
    recipients.add(suporte.assignedToUserId);
  }
  if (!recipients.size) return;
  const actorLabel = input.actorName || "Alguem";
  const fieldsLabel = input.changedFields?.length
    ? ` (${input.changedFields.join(", ")})`
    : "";
  await createNotificationsForUsers(Array.from(recipients), {
    type: "TICKET_STATUS_CHANGED",
    title: "Suporte atualizado",
    description: `${actorLabel} editou o chamado ${suporte.title}${fieldsLabel}.`,
    companySlug: suporte.companySlug ?? null,
    link: "/meus-chamados",
    ticketId: suporte.id,
    dedupeKey: `suporte:${suporte.id}:updated:${Date.now()}`,
  });
}
