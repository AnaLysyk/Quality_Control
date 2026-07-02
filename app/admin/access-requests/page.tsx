"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./AccessRequests.module.css";
import { AccessRequestProfileWorkspace, AccessRequestsTableExperience } from "./_components";
import { FiCheckCircle, FiClock, FiRefreshCw, FiSearch, FiSlash } from "react-icons/fi";
import { RequireAccessRequestReviewer } from "@/core/auth/RequireAccessRequestReviewer";
import { useAuthUser } from "@/hooks/useAuthUser";
import { getAccessToken } from "@/lib/api";
import { extractMessageFromJson, extractRequestIdFromJson, formatMessageWithRequestId, unwrapEnvelopeData } from "@/lib/apiEnvelope";
import type {
  AccessRequestAdjustmentEntry,
  AccessRequestAdjustmentField,
  AccessRequestAdjustmentRound,
  AccessRequestSnapshot,
  AccessType,
} from "@/lib/accessRequestMessage";
import { parseAccessRequestMessage } from "@/lib/accessRequestMessage";
import {
  normalizeRequestProfileType,
  requestProfileTypeNeedsCompany,
  toInternalAccessType,
  toRequestProfileTypeLabel,
  type RequestProfileTypeLabel,
} from "@/lib/requestRouting";
import { parsePasswordResetAccessRequestMessage } from "@/lib/passwordResetAccessQueue";
import { ACCESS_REQUEST_REJECTION_REASONS } from "@/lib/accessRequestsV2/domain";

type ClientOption = { id: string; name: string };

type RawSupportRequest = {
  id: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
  admin_notes?: string | null;
};

type AccessTypeLabel = RequestProfileTypeLabel;

type AccessRequestItem = {
  id: string;
  createdAt: string;
  status: string;
  email: string;
  name: string;
  fullName: string;
  username: string | null;
  phone: string;
  jobRole: string;
  accessType: AccessTypeLabel;
  clientId: string | null;
  company: string;
  companyProfile: AccessRequestSnapshot["companyProfile"];
  title: string;
  description: string;
  notes: string;
  passwordProvided: boolean;
  originalRequest: AccessRequestSnapshot;
  adjustmentRound: number;
  adjustmentRequestedFields: AccessRequestAdjustmentField[];
  adjustmentHistory: AccessRequestAdjustmentRound[];
  lastAdjustmentAt: string | null;
  lastAdjustmentDiff: AccessRequestAdjustmentEntry[];
  rawMessage: string;
  adminNotes: string | null;
  requestKind: "access_request" | "password_reset";
  linkedRequestId: string | null;
  visualProfile?: {
    avatarKind?: "emoji" | "gif" | "default" | "image";
    avatarValue?: string;
    avatarLabel?: string;
  } | null;
  reviewSummary?: {
    internalNotes?: string;
    visualStatus?: string;
    lastReviewedAt?: string;
    lastReviewedBy?: string;
    changedCount?: number;
    pendingFieldCount?: number;
    requiredFieldsOk?: boolean;
    passwordDefined?: boolean;
    companyDefined?: boolean;
  } | null;
};

type UserLoginCandidate = {
  id: string;
  email: string;
  user?: string | null;
};

type AccessRequestComment = {
  id: string;
  requestId: string;
  authorRole: "leader_tc" | "requester";
  authorName: string;
  authorEmail?: string | null;
  body: string;
  createdAt: string;
};

function parseFromMessage(message: string, fallbackEmail: string): Partial<AccessRequestItem> {
  const passwordReset = parsePasswordResetAccessRequestMessage(message);
  if (passwordReset) {
    const fullName = passwordReset.userName || passwordReset.userEmail || fallbackEmail;
    const email = passwordReset.userEmail || fallbackEmail;
    const profileType = passwordReset.profileType;
    const accessType = toInternalAccessType(profileType);
    const snapshot: AccessRequestSnapshot = {
      email,
      name: fullName,
      fullName,
      username: passwordReset.login,
      phone: "",
      passwordHash: null,
      jobRole: "Reset de senha",
      company: passwordReset.companyName || "(nao informado)",
      clientId: null,
      accessType,
      profileType,
      title: "Reset de senha",
      description: "Solicitou redefinicao de senha pelo fluxo Esqueci minha senha.",
      notes: "",
      companyProfile: null,
    };

    return {
      requestKind: "password_reset",
      linkedRequestId: passwordReset.requestId,
      email,
      name: fullName,
      fullName,
      username: passwordReset.login,
      phone: "",
      jobRole: "Reset de senha",
      company: passwordReset.companyName || "(nao informado)",
      clientId: null,
      accessType: toRequestProfileTypeLabel(profileType),
      companyProfile: null,
      title: "Reset de senha",
      description: "Solicitou redefinicao de senha pelo fluxo Esqueci minha senha.",
      notes: "",
      passwordProvided: false,
      originalRequest: snapshot,
      adjustmentRound: 0,
      adjustmentRequestedFields: [],
      adjustmentHistory: [],
      lastAdjustmentAt: null,
      lastAdjustmentDiff: [],
    };
  }

  const parsed = parseAccessRequestMessage(message, fallbackEmail);
  return {
    requestKind: "access_request",
    linkedRequestId: null,
    email: parsed.email,
    name: parsed.fullName || parsed.name,
    fullName: parsed.fullName || parsed.name,
    username: parsed.username,
    phone: parsed.phone,
    jobRole: parsed.jobRole,
    company: parsed.company,
    clientId: parsed.clientId,
    accessType: toRequestProfileTypeLabel(parsed.profileType),
    companyProfile: parsed.companyProfile,
    title: parsed.title,
    description: parsed.description,
    notes: parsed.notes,
    passwordProvided: Boolean(parsed.passwordHash?.trim()),
    originalRequest: parsed.originalRequest,
    adjustmentRound: parsed.adjustmentRound,
    adjustmentRequestedFields: parsed.adjustmentRequestedFields,
    adjustmentHistory: parsed.adjustmentHistory,
    lastAdjustmentAt: parsed.lastAdjustmentAt,
    lastAdjustmentDiff: parsed.lastAdjustmentDiff,
    visualProfile: parsed.visualProfile ?? null,
    reviewSummary: parsed.reviewSummary ?? null,
  };
}

function slugifyUsernamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");
}

function buildUniqueUsername(source: string, existingLogins: string[], currentValue?: string | null) {
  const base = slugifyUsernamePart(source) || "usuário";
  const current = (currentValue ?? "").trim().toLowerCase();
  const taken = new Set(
    existingLogins.map((item) => item.trim().toLowerCase()).filter((item) => item && item !== current),
  );

  if (!taken.has(base)) return base;

  let counter = 2;
  while (taken.has(`${base}${counter}`)) {
    counter += 1;
  }
  return `${base}${counter}`;
}

async function fetchWithToken(url: string, init?: RequestInit) {
  const token = await getAccessToken().catch(() => null);
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  if (token && !headers.has("authorization")) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers, credentials: "include", cache: "no-store" });
}

function toAcceptAccessType(label: AccessTypeLabel): AccessType {
  return toInternalAccessType(normalizeRequestProfileType(label) ?? "company_user");
}

function getItemsFromEnvelope<T>(value: unknown): T[] {
  if (!value || typeof value !== "object") return [];
  const items = (value as { items?: unknown }).items;
  return Array.isArray(items) ? (items as T[]) : [];
}

function statusLabel(status: string) {
  if (status === "closed") return "Aprovada";
  if (status === "rejected") return "Rejeitada";
  if (status === "in_progress") return "Aguardando ajuste";
  return "Aberta";
}

function statusBadgeClass(status: string) {
  if (status === "closed") return "border border-emerald-300 bg-emerald-100 text-emerald-800 shadow-[0_8px_18px_rgba(5,150,105,0.12)]";
  if (status === "rejected") return "border border-rose-300 bg-rose-100 text-rose-800 shadow-[0_8px_18px_rgba(225,29,72,0.12)]";
  if (status === "in_progress") return "border border-amber-300 bg-amber-100 text-amber-800 shadow-[0_8px_18px_rgba(217,119,6,0.12)]";
  return "border border-sky-300 bg-sky-100 text-sky-800 shadow-[0_8px_18px_rgba(14,165,233,0.12)]";
}

function accessTypeBadgeClass(accessType: AccessTypeLabel) {
  if (accessType === "Suporte Tecnico") return "border border-violet-300 bg-violet-100 text-violet-800";
  if (accessType === "Lider TC") return "border border-rose-300 bg-rose-100 text-rose-800";
  if (accessType === "Usuario da empresa") return "border border-amber-300 bg-amber-100 text-amber-800";
  return "border border-slate-300 bg-slate-100 text-slate-800";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function textOrFallback(value: string | null | undefined, fallback = "Não informado") {
  return value && value.trim() ? value : fallback;
}

function getPersonInitials(value: string | null | undefined) {
  const cleaned = (value ?? "").trim();
  if (!cleaned) return "QC";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : parts[0]?.[1] ?? "";
  return `${first}${last}`.toUpperCase();
}

function getPersonDisplayName(item: Pick<AccessRequestItem, "fullName" | "name" | "email">) {
  return item.fullName || item.name || item.email || "(sem nome)";
}

function getRequestPersonaSubtitle(item: Pick<AccessRequestItem, "accessType" | "company" | "jobRole">) {
  return [item.accessType, item.company || "Sem empresa", item.jobRole || "Cargo não informado"]
    .filter(Boolean)
    .join(" · ");
}

function getStatusTone(status: string) {
  if (status === "closed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "rejected") return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "in_progress") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-sky-50 text-sky-700 border-sky-200";
}

function normalizeComparisonText(value: unknown, fallback = "Não informado") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function buildAccessRequestComparisonRows(input: {
  selected: AccessRequestItem;
  selectedOriginal: AccessRequestSnapshot | null;
  draft: Partial<AccessRequestItem>;
}) {
  const { selected, selectedOriginal, draft } = input;
  const original = selectedOriginal ?? selected.originalRequest ?? null;

  return [
    {
      field: "profileType",
      label: "Perfil",
      original: original ? toRequestProfileTypeLabel(original.profileType) : selected.accessType,
      current: draft.accessType ?? selected.accessType,
    },
    {
      field: "company",
      label: "Empresa",
      original: original?.company || selected.company,
      current: draft.company ?? selected.company,
    },
    {
      field: "username",
      label: "Usuário",
      original: original?.username || selected.username || "",
      current: draft.username ?? selected.username ?? "",
    },
    {
      field: "fullName",
      label: "Nome completo",
      original: original?.fullName || original?.name || selected.fullName || selected.name,
      current: draft.fullName ?? selected.fullName ?? selected.name,
    },
    {
      field: "email",
      label: "E-mail",
      original: original?.email || selected.email,
      current: draft.email ?? selected.email,
    },
    {
      field: "phone",
      label: "Telefone",
      original: original?.phone || selected.phone,
      current: draft.phone ?? selected.phone,
    },
    {
      field: "jobRole",
      label: "Cargo",
      original: original?.jobRole || selected.jobRole,
      current: draft.jobRole ?? selected.jobRole,
    },
    {
      field: "title",
      label: "Título",
      original: original?.title || selected.title,
      current: draft.title ?? selected.title,
    },
    {
      field: "description",
      label: "Descrição",
      original: original?.description || selected.description,
      current: draft.description ?? selected.description,
    },
    {
      field: "notes",
      label: "Observações",
      original: original?.notes || selected.notes,
      current: draft.notes ?? selected.notes,
    },
    {
      field: "password",
      label: "Senha",
      original: selected.passwordProvided ? "Informada" : "Pendente",
      current: selected.passwordProvided ? "Informada" : "Pendente",
    },
  ].map((row) => {
    const originalText = normalizeComparisonText(row.original);
    const currentText = normalizeComparisonText(row.current);

    return {
      ...row,
      originalText,
      currentText,
      changed: originalText !== currentText,
    };
  });
}

function adjustmentFieldLabel(field: AccessRequestAdjustmentEntry["field"], fallback: string) {
  if (field === "profileType") return "Perfil";
  if (field === "company") return "Empresa";
  if (field === "companyName") return "Razao social";
  if (field === "companyTaxId") return "CNPJ";
  if (field === "companyZip") return "CEP";
  if (field === "companyAddress") return "Endereco";
  if (field === "companyPhone") return "Telefone da empresa";
  if (field === "companyWebsite") return "Website";
  if (field === "companyLinkedin") return "LinkedIn";
  if (field === "companyDescription") return "Descricao da empresa";
  if (field === "companyNotes") return "Observacoes da empresa";
  if (field === "fullName") return "Nome completo";
  if (field === "name") return "Nome";
  if (field === "username") return "Usuário";
  if (field === "email") return "E-mail";
  if (field === "phone") return "Telefone";
  if (field === "jobRole") return "Cargo";
  if (field === "title") return "Título";
  if (field === "description") return "Descrição";
  if (field === "notes") return "Observações";
  if (field === "password") return "Senha";
  return fallback || "Campo";
}

const inputBase =
  "mt-1 w-full rounded-[16px] border border-[var(--tc-border)] bg-[var(--tc-surface)] px-3.5 py-2.5 text-sm font-medium text-[var(--tc-text-primary)] shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition placeholder:text-[var(--tc-text-muted)] focus:border-[var(--tc-accent)] focus:outline-none focus:ring-4 focus:ring-[rgba(239,0,1,0.12)]";

const readOnlyInputBase =
  "mt-1 w-full rounded-[16px] border border-[var(--tc-border)] bg-[var(--tc-surface-2)] px-3.5 py-2.5 text-sm font-medium text-[var(--tc-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]";

const labelBase = "text-[11px] font-black uppercase tracking-[0.22em] text-slate-500";
const formLabelBase = "text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--tc-text-muted)]";

const sectionCard =
  "rounded-3xl border border-[var(--tc-border)] bg-[var(--tc-surface)] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]";
const sectionMuted =
  "rounded-3xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]";

const PROFILE_EMOJI_OPTIONS = ["\u{1F464}", "\u{1F9D1}\u200D\u{1F4BB}", "\u{1F9EA}", "\u{1F6E1}\uFE0F", "\u{1F3E2}", "\u{1F4CA}", "\u{1F680}", "\u2B50"] as const;
const ADJUSTABLE_PROFILE_FIELDS = new Set<AccessRequestAdjustmentField>([
  "profileType",
  "company",
  "fullName",
  "username",
  "email",
  "phone",
  "jobRole",
  "password",
]);

function isAdjustableProfileField(field: AccessRequestAdjustmentField) {
  return ADJUSTABLE_PROFILE_FIELDS.has(field);
}

type StatusFilter = "all" | "open" | "in_progress" | "closed" | "rejected";
type DateFilter = "all" | "today" | "week" | "month" | "two_hours";
type StatusCounters = {
  approved: number;
  inProgress: number;
  inReview: number;
  open: number;
  rejected: number;
  total: number;
};

function resolveViewerProfileLabel(user: ReturnType<typeof useAuthUser>["user"]) {
  const permissionRole = typeof user?.permissionRole === "string" ? user.permissionRole : null;
  const role = typeof user?.role === "string" ? user.role : null;
  const companyRole = typeof user?.companyRole === "string" ? user.companyRole : null;
  const normalizedRole =
    normalizeRequestProfileType(permissionRole) ??
    normalizeRequestProfileType(role) ??
    normalizeRequestProfileType(companyRole);

  if (normalizedRole === "technical_support") return "Suporte técnico";
  if (normalizedRole === "leader_tc") return "Lider TC";
  if (normalizedRole === "empresa") return "Empresa";
  if (normalizedRole === "company_user") return "Usuário da empresa";
  return "Painel institucional";
}

function isWithinDateFilter(value: string, dateFilter: DateFilter) {
  if (dateFilter === "all") return true;

  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) return true;

  const now = new Date();
  const start = new Date(now);

  if (dateFilter === "two_hours") {
    start.setHours(now.getHours() - 2, now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  }
  if (dateFilter === "today") {
    start.setHours(0, 0, 0, 0);
  }

  if (dateFilter === "week") {
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  }

  if (dateFilter === "month") {
    start.setDate(now.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  }

  return createdAt >= start;
}

function normalizeAccessRequestSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function filterAccessRequestItems(
  items: AccessRequestItem[],
  searchTerm: string,
  statusFilter: StatusFilter,
  dateFilter: DateFilter,
) {
  const query = normalizeAccessRequestSearch(searchTerm);
  return items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (!isWithinDateFilter(item.createdAt, dateFilter)) return false;
    if (!query) return true;
    const searchableText = normalizeAccessRequestSearch([
      item.fullName,
      item.name,
      item.email,
      item.company,
      item.accessType,
      item.jobRole,
      item.title,
      item.status,
    ].join(" "));

    return query
      .split(" ")
      .filter(Boolean)
      .every((token) => searchableText.includes(token));
  });
}

function calculateStatusCounters(items: AccessRequestItem[]): StatusCounters {
  return items.reduce<StatusCounters>(
    (acc, item) => {
      acc.total += 1;
      if (item.status === "open") {
        acc.open += 1;
        acc.inReview += 1;
      }
      if (item.status === "in_progress") {
        acc.inProgress += 1;
        acc.inReview += 1;
      }
      if (item.status === "closed") acc.approved += 1;
      if (item.status === "rejected") acc.rejected += 1;
      return acc;
    },
    { total: 0, open: 0, inReview: 0, inProgress: 0, approved: 0, rejected: 0 },
  );
}

function isAccessRequestDraftDirty(input: {
  draft: Partial<AccessRequestItem> | null;
  existingLogins: string[];
  selected: AccessRequestItem | null;
}) {
  const { draft, existingLogins, selected } = input;
  if (!selected || !draft) return false;
  if (selected.requestKind === "password_reset" || draft.requestKind === "password_reset") return false;

  const baselineUsername =
    selected.username ??
    buildUniqueUsername(selected.fullName || selected.name || selected.email, existingLogins, selected.username);

  return (
    (draft.accessType ?? "") !== (selected.accessType ?? "") ||
    (draft.username ?? "") !== baselineUsername ||
    (draft.clientId ?? "") !== (selected.clientId ?? "") ||
    (draft.company ?? "") !== (selected.company ?? "") ||
    (draft.fullName ?? "") !== (selected.fullName ?? "") ||
    (draft.email ?? "") !== (selected.email ?? "") ||
    (draft.phone ?? "") !== (selected.phone ?? "") ||
    (draft.jobRole ?? "") !== (selected.jobRole ?? "") ||
    (draft.title ?? "") !== (selected.title ?? "") ||
    (draft.description ?? "") !== (selected.description ?? "") ||
    (draft.adminNotes ?? "") !== (selected.adminNotes ?? "")
  );
}

function hasMissingRequiredFields(
  draft: Partial<AccessRequestItem> | null,
  draftIsPasswordReset: boolean,
) {
  if (draftIsPasswordReset) return false;
  return [
    draft?.fullName,
    draft?.username,
    draft?.email,
    draft?.phone,
    draft?.jobRole,
    draft?.title,
    draft?.description,
  ].some((value) => !String(value ?? "").trim()) || !draft?.passwordProvided;
}

function getEnvelopeRecord(raw: unknown) {
  return (
    unwrapEnvelopeData<Record<string, unknown>>(raw) ??
    (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {})
  );
}

function getResponseErrorMessage(raw: unknown, response: Response, fallback: string) {
  const msg = extractMessageFromJson(raw) || fallback;
  const requestId = extractRequestIdFromJson(raw) || response.headers.get("x-request-id") || null;
  return formatMessageWithRequestId(msg, requestId);
}

async function readJsonBody(response: Response) {
  return response.json().catch(() => null);
}

function mapAccessRequestItem(r: RawSupportRequest): AccessRequestItem {
  const parsedMsg = parseFromMessage(String(r.message ?? ""), String(r.email ?? ""));
  return {
    id: String(r.id),
    createdAt: String(r.created_at),
    status: String(r.status ?? "open"),
    email: String(parsedMsg.email ?? r.email ?? ""),
    name: String(parsedMsg.fullName ?? parsedMsg.name ?? ""),
    fullName: String(parsedMsg.fullName ?? parsedMsg.name ?? ""),
    username: typeof parsedMsg.username === "string" ? parsedMsg.username : null,
    phone: String(parsedMsg.phone ?? ""),
    jobRole: String(parsedMsg.jobRole ?? ""),
    accessType: (parsedMsg.accessType as AccessTypeLabel) ?? "Usuário Testing Company",
    clientId: parsedMsg.clientId ?? null,
    company: String(parsedMsg.company ?? ""),
    companyProfile: parsedMsg.companyProfile ?? null,
    title: String(parsedMsg.title ?? ""),
    description: String(parsedMsg.description ?? ""),
    notes: String(parsedMsg.notes ?? ""),
    passwordProvided: parsedMsg.passwordProvided === true,
    originalRequest:
      parsedMsg.originalRequest ??
      ({
        email: String(parsedMsg.email ?? r.email ?? ""),
        name: String(parsedMsg.fullName ?? parsedMsg.name ?? ""),
        fullName: String(parsedMsg.fullName ?? parsedMsg.name ?? ""),
        username: typeof parsedMsg.username === "string" ? parsedMsg.username : null,
        phone: String(parsedMsg.phone ?? ""),
        passwordHash: null,
        jobRole: String(parsedMsg.jobRole ?? ""),
        company: String(parsedMsg.company ?? ""),
        clientId: parsedMsg.clientId ?? null,
        accessType: toInternalAccessType(normalizeRequestProfileType((parsedMsg.accessType as string) ?? "") ?? "testing_company_user"),
        profileType: normalizeRequestProfileType((parsedMsg.accessType as string) ?? "") ?? "testing_company_user",
        title: String(parsedMsg.title ?? ""),
        description: String(parsedMsg.description ?? ""),
        notes: String(parsedMsg.notes ?? ""),
        companyProfile: parsedMsg.companyProfile ?? null,
      } satisfies AccessRequestSnapshot),
    adjustmentRound: parsedMsg.adjustmentRound ?? 0,
    adjustmentRequestedFields: parsedMsg.adjustmentRequestedFields ?? [],
    adjustmentHistory: parsedMsg.adjustmentHistory ?? [],
    lastAdjustmentAt: typeof parsedMsg.lastAdjustmentAt === "string" ? parsedMsg.lastAdjustmentAt : null,
    lastAdjustmentDiff: Array.isArray(parsedMsg.lastAdjustmentDiff) ? parsedMsg.lastAdjustmentDiff : [],
    rawMessage: String(r.message ?? ""),
    adminNotes: (r.admin_notes as string | null) ?? null,
    requestKind: parsedMsg.requestKind ?? "access_request",
    linkedRequestId: parsedMsg.linkedRequestId ?? null,
    visualProfile: parsedMsg.visualProfile ?? null,
    reviewSummary: parsedMsg.reviewSummary ?? null,
  };
}

function mapClientOption(value: unknown): ClientOption | null {
  const rec = (value ?? null) as Record<string, unknown> | null;
  const id = typeof rec?.id === "string" ? rec.id : "";
  const name =
    (typeof rec?.name === "string" ? rec.name : "") ||
    (typeof rec?.company_name === "string" ? String(rec.company_name) : "");
  return id && name ? { id, name } : null;
}

function getClientOptions(raw: unknown) {
  return getItemsFromEnvelope<unknown>(getEnvelopeRecord(raw))
    .map(mapClientOption)
    .filter((client): client is ClientOption => Boolean(client));
}

function getExistingLogins(raw: unknown) {
  const userItems = getItemsFromEnvelope<UserLoginCandidate>(getEnvelopeRecord(raw));
  return Array.from(
    new Set(
      userItems.flatMap((item) =>
        [item.user, item.email]
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          .map((value) => value.trim().toLowerCase()),
      ),
    ),
  );
}

async function loadAccessRequestsData() {
  const [reqRes, clientsRes, usersRes] = await Promise.all([
    fetchWithToken("/api/admin/access-requests"),
    fetchWithToken("/api/clients"),
    fetchWithToken("/api/admin/users"),
  ]);

  const reqRaw = await readJsonBody(reqRes);
  if (!reqRes.ok) {
    throw new Error(getResponseErrorMessage(reqRaw, reqRes, "Falha ao carregar solicitações"));
  }

  const clientsRaw = await readJsonBody(clientsRes);
  const usersRaw = await readJsonBody(usersRes);

  return {
    clients: clientsRes.ok ? getClientOptions(clientsRaw) : [],
    clientsError: clientsRes.ok ? null : getResponseErrorMessage(clientsRaw, clientsRes, "Falha ao carregar empresas"),
    items: getItemsFromEnvelope<RawSupportRequest>(getEnvelopeRecord(reqRaw)).map(mapAccessRequestItem),
    logins: getExistingLogins(usersRaw),
  };
}

function getNextSelectedAccessRequestId(previousId: string | null, items: AccessRequestItem[]) {
  return previousId && items.some((item) => item.id === previousId) ? previousId : items[0]?.id ?? null;
}

function AccessRequestsPage() {
  const { user } = useAuthUser();
  const [items, setItems] = useState<AccessRequestItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [existingLogins, setExistingLogins] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<AccessRequestItem> | null>(null);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [requestingAdjustment, setRequestingAdjustment] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [comments, setComments] = useState<AccessRequestComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [rejectionReasonDraft, setRejectionReasonDraft] = useState("");
  const [adjustmentFieldsDraft, setAdjustmentFieldsDraft] = useState<AccessRequestAdjustmentField[]>([]);
  const [adjustmentFieldComments, setAdjustmentFieldComments] = useState<Record<string, string>>({});
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  const [profileEmoji, setProfileEmoji] = useState<string>(PROFILE_EMOJI_OPTIONS[0]);
  const [profileAvatarKind, setProfileAvatarKind] = useState<"emoji" | "gif" | "default" | "image">("default");
  const [profileAvatarLabel, setProfileAvatarLabel] = useState("Perfil sem foto");
  const [internalNotesDraft, setInternalNotesDraft] = useState("");
  // Track whether the user has modified the draft form since the last selection change.
  // Prevents React Strict Mode double-invoke of load() from resetting user edits.
  const draftTouchedRef = useRef(false);

  const selected = useMemo(
    () => (selectedId ? items.find((i) => i.id === selectedId) ?? null : null),
    [items, selectedId],
  );

  const filteredItems = useMemo(
    () => filterAccessRequestItems(items, searchTerm, statusFilter, dateFilter),
    [items, searchTerm, statusFilter, dateFilter],
  );

  const statusCounters = useMemo(() => calculateStatusCounters(items), [items]);

  const selectedOriginal = selected?.originalRequest ?? null;
  const dirty = useMemo(
    () => isAccessRequestDraftDirty({ draft, existingLogins, selected }),
    [draft, existingLogins, selected],
  );
  const draftIsPasswordReset = draft?.requestKind === "password_reset";
  const selectedIsPasswordReset = selected?.requestKind === "password_reset";
  const draftProfileType =
    normalizeRequestProfileType((draft?.accessType ?? "Usuário Testing Company") as string) ?? "company_user";
  const requiresCompany = requestProfileTypeNeedsCompany(draftProfileType);
  const commentsLocked = selected?.status === "closed" || selected?.status === "rejected";
  const missingRequiredFields = hasMissingRequiredFields(draft, draftIsPasswordReset);
  const acceptDisabled =
    !selected ||
    !draft ||
    accepting ||
    missingRequiredFields ||
    adjustmentFieldsDraft.length > 0 ||
    (requiresCompany && !draft.clientId);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function handleAssistantFilter(event: Event) {
      const detail = (event as CustomEvent<{
        searchTerm?: string;
        statusFilter?: StatusFilter;
        dateFilter?: DateFilter;
      }>).detail ?? {};

      if (typeof detail.searchTerm === "string") {
        setSearchTerm(detail.searchTerm);
      }

      if (detail.statusFilter) {
        setStatusFilter(detail.statusFilter);
      }

      if (detail.dateFilter) {
        setDateFilter(detail.dateFilter);
      }
    }

    window.addEventListener("access-requests:assistant-filter", handleAssistantFilter);
    return () => window.removeEventListener("access-requests:assistant-filter", handleAssistantFilter);
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const data = await loadAccessRequestsData();
      if (data.clientsError) setError(data.clientsError);
      setClients(data.clients);
      setExistingLogins(data.logins);
      setItems(data.items);
      setSelectedId((prev) => getNextSelectedAccessRequestId(prev, data.items));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadComments = useCallback(
    async (id: string | null) => {
      if (!id) {
        setComments([]);
        return;
      }
      setCommentLoading(true);
      setCommentError(null);
      try {
        const res = await fetchWithToken(`/api/admin/access-requests/${id}/comments`);
        const json = (await res.json().catch(() => ({}))) as { items?: AccessRequestComment[]; error?: string };
        if (!res.ok) {
          setCommentError(json?.error || "Falha ao carregar comentários");
          setComments([]);
          return;
        }
        setComments(Array.isArray(json.items) ? json.items : []);
      } catch (err) {
        setCommentError(err instanceof Error ? err.message : "Erro ao carregar comentários");
        setComments([]);
      } finally {
        setCommentLoading(false);
      }
    },
    [],
  );

  const deleteRequest = useCallback(async (id: string) => {
    setError(null);
    setSuccessMessage(null);

    const res = await fetchWithToken(`/api/admin/access-requests/${id}`, {
      method: "DELETE",
    });
    const json = await readJsonBody(res);

    if (!res.ok || getEnvelopeRecord(json)?.ok === false) {
      const message = getResponseErrorMessage(json, res, "Falha ao remover solicitação");
      setError(message);
      throw new Error(message);
    }

    setItems((current) => {
      const next = current.filter((item) => item.id !== id);
      setSelectedId((previous) => getNextSelectedAccessRequestId(previous === id ? null : previous, next));
      return next;
    });
    setSuccessMessage("Solicitação removida e registrada nos logs do sistema.");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      draftTouchedRef.current = false;
      return;
    }
    // Only reset draft from selected when the user hasn't modified it yet.
    // This prevents a reload (or React Strict Mode double-invoke) from
    // overwriting user changes (e.g. Empresa selection).
    if (!draftTouchedRef.current) {
      const generatedUsername = buildUniqueUsername(
        selected.fullName || selected.name || selected.email,
        existingLogins,
        selected.username,
      );
      setDraft({ ...selected, username: selected.username ?? generatedUsername });
    }
  }, [existingLogins, selected]);

  // Reset the touched flag when the user picks a different row só
  // the draft initializes fresh for the new selection.
  useEffect(() => {
    draftTouchedRef.current = false;
  }, [selectedId]);

  useEffect(() => {
    loadComments(selectedId);
  }, [selectedId, loadComments]);

  useEffect(() => {
    setCommentDraft("");
  }, [selectedId]);

  useEffect(() => {
    setAdjustmentFieldsDraft((selected?.adjustmentRequestedFields ?? []).filter(isAdjustableProfileField));
    setAdjustmentFieldComments({});
  }, [selected]);

  useEffect(() => {
    setProfileEmoji(selected?.visualProfile?.avatarValue || "");
    setProfileAvatarKind(selected?.visualProfile?.avatarKind || "default");
    setProfileAvatarLabel(selected?.visualProfile?.avatarLabel || "Perfil sem foto");
    setInternalNotesDraft(selected?.reviewSummary?.internalNotes || selected?.adminNotes || "");
  }, [selectedId, selected]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setSuccessMessage("Conteúdo copiado.");
    } catch {
      // ignore
    }
  }

  async function saveChanges() {
    if (!selected || !draft) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetchWithToken(`/api/admin/access-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: draft.email,
          name: draft.fullName || draft.name,
          full_name: draft.fullName,
          user: draft.username,
          phone: draft.phone,
          role: draft.jobRole,
          company: draft.company,
          client_id: draft.clientId,
          access_type: draft.accessType,
          notes: draft.notes,
          admin_notes: internalNotesDraft || draft.adminNotes || "",
          title: draft.title,
          description: draft.description,
          avatarKind: profileAvatarKind,
          avatarValue: profileEmoji,
          avatarLabel: profileAvatarLabel,
          internalNotes: internalNotesDraft,
          visualStatus: missingRequiredFields ? "needs_adjustment" : "ready",
        }),
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((json.error as string) || (json.message as string) || "Falha ao salvar análise");
        return;
      }

      draftTouchedRef.current = false;
      setSuccessMessage("Análise salva com sucesso.");
      await load();
      await loadComments(selected.id);
    } finally {
      setSaving(false);
    }
  }

  async function persistVisualReview(next?: {
    avatar?: { avatarKind: "emoji" | "gif" | "default" | "image"; avatarValue: string; avatarLabel: string };
    internalNotes?: string;
  }) {
    if (!selected || !draft) return;

    const nextAvatarKind = next?.avatar?.avatarKind ?? profileAvatarKind;
    const nextAvatarValue = next?.avatar?.avatarValue ?? profileEmoji;
    const nextAvatarLabel = next?.avatar?.avatarLabel ?? profileAvatarLabel;
    const nextInternalNotes = next?.internalNotes ?? internalNotesDraft;

    setSaving(true);
    setError(null);

    try {
      const res = await fetchWithToken(`/api/admin/access-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: draft.email,
          name: draft.fullName || draft.name,
          full_name: draft.fullName,
          user: draft.username,
          phone: draft.phone,
          role: draft.jobRole,
          company: draft.company,
          client_id: draft.clientId,
          access_type: draft.accessType,
          notes: draft.notes,
          admin_notes: nextInternalNotes,
          title: draft.title,
          description: draft.description,
          avatarKind: nextAvatarKind,
          avatarValue: nextAvatarValue,
          avatarLabel: nextAvatarLabel,
          internalNotes: nextInternalNotes,
          visualStatus: missingRequiredFields ? "needs_adjustment" : "ready",
        }),
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((json.error as string) || (json.message as string) || "Falha ao salvar dados visuais");
        return;
      }

      draftTouchedRef.current = false;
      await load();
    } finally {
      setSaving(false);
    }
  }
  async function sendApplicantMessage() {
    if (!selected || commentsLocked) return;
    const body = commentDraft.trim();
    if (!body) {
      setCommentError("Escreva uma mensagem antes de enviar.");
      return;
    }

    setSendingComment(true);
    setCommentError(null);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetchWithToken(`/api/admin/access-requests/${selected.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: body }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setCommentError(json?.error || "Falha ao enviar mensagem.");
        return;
      }
      setCommentDraft("");
      setSuccessMessage("Mensagem enviada ao solicitante.");
      await loadComments(selected.id);
    } finally {
      setSendingComment(false);
    }
  }

  async function requestAdjustment() {
    if (!selected) return;
    if (adjustmentFieldsDraft.length === 0) {
      setCommentError("Selecione pelo menos um campo para devolucao de ajuste.");
      return;
    }

    const selectedFieldComments = adjustmentFieldsDraft.reduce<Record<string, string>>((acc, field) => {
      const value = adjustmentFieldComments[field]?.trim();
      if (value) acc[field] = value;
      return acc;
    }, {});
    const fieldCommentLines = adjustmentFieldsDraft
      .map((field) => {
        const note = selectedFieldComments[field];
        if (!note) return null;
        return `${adjustmentFieldLabel(field, "Campo")}: ${note}`;
      })
      .filter((line): line is string => Boolean(line));
    const generalMessage = commentDraft.trim();
    const fieldsMessage = fieldCommentLines.length
      ? `Campos para ajuste:\n${fieldCommentLines.map((line) => `- ${line}`).join("\n")}`
      : "";
    const body = [generalMessage, fieldsMessage].filter(Boolean).join("\n\n");

    if (!body) {
      setCommentError("Informe uma observacao em pelo menos um campo marcado ou escreva uma mensagem geral.");
      return;
    }

    setRequestingAdjustment(true);
    setCommentError(null);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetchWithToken(`/api/admin/access-requests/${selected.id}/request-adjustment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: body,
          fields: adjustmentFieldsDraft,
          fieldComments: selectedFieldComments,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setCommentError(json?.error || "Falha ao solicitar ajuste");
        return;
      }
      setCommentDraft("");
      setAdjustmentFieldsDraft([]);
      setAdjustmentFieldComments({});
      draftTouchedRef.current = false;
      setSuccessMessage("Solicitação enviada para ajuste.");
      await load();
      await loadComments(selected.id);
    } finally {
      setRequestingAdjustment(false);
    }
  }

  async function acceptRequest() {
    if (!selected || !draft) return;

    setAccepting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetchWithToken(`/api/admin/access-requests/${selected.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: draft.email,
          name: draft.fullName,
          full_name: draft.fullName,
          user: draft.username,
          phone: draft.phone,
          client_id: draft.clientId,
          comment: commentDraft.trim(),
          admin_notes: commentDraft.trim(),
          access_type: toAcceptAccessType((draft.accessType ?? "Usuário Testing Company") as AccessTypeLabel),
        }),
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((json.error as string) || (json.message as string) || "Falha ao aceitar");
        return;
      }

      // Reset before reload só the [selected] effect can set draft from fresh data.
      draftTouchedRef.current = false;
      setCommentDraft("");
      setSuccessMessage("Solicitação aprovada.");
      await load();
      await loadComments(selected.id);
    } finally {
      setAccepting(false);
    }
  }

  async function rejectRequest() {
    if (!selected || !draft) return;
    const rejectionReason = ACCESS_REQUEST_REJECTION_REASONS.find(
      (item) => item.value === rejectionReasonDraft,
    );
    if (!rejectionReason && !commentDraft.trim()) {
      setError("Informe um motivo da rejeição ou escreva um comentário antes de recusar.");
      return;
    }
    const rejectionText = [rejectionReason?.label, commentDraft.trim()]
      .filter(Boolean)
      .join("\n");

    setAccepting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetchWithToken(`/api/admin/access-requests/${selected.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: rejectionText,
          comment: rejectionText,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((json.error as string) || (json.message as string) || "Falha ao recusar");
        return;
      }

      // Reset before reload só the [selected] effect can set draft from fresh data.
      draftTouchedRef.current = false;
      setCommentDraft("");
      setRejectionReasonDraft("");
      setSuccessMessage("Solicitação recusada.");
      await load();
      await loadComments(selected.id);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-[var(--tc-text-primary)] transition-colors dark:bg-[#081323]">
      <div className="mx-auto flex w-full max-w-none flex-col gap-3 px-1.5 py-3 sm:px-2 lg:px-3 xl:px-4">
        <section
          className={`relative overflow-hidden rounded-none border-0 bg-transparent px-0 py-1 text-slate-950 shadow-none sm:px-0 dark:rounded-3xl dark:border dark:border-white/10 dark:bg-[linear-gradient(135deg,#07132a_0%,#101a34_54%,rgba(239,0,1,0.20)_140%)] dark:px-4 dark:py-3 dark:text-white dark:shadow-[0_18px_44px_rgba(0,0,0,0.28)]`}
        >
          <div className={`pointer-events-none absolute -right-10 top-0 h-28 w-28 rounded-full blur-3xl ${styles.blurDecorWhite}`} />
          <div className={`pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full blur-3xl ${styles.blurDecorRed}`} />
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 max-w-3xl items-start gap-4 sm:gap-5">
              <div className="app-page-cover-logo h-14 w-14 sm:h-16 sm:w-16">
                <Image
                  src="/images/tc.png"
                  alt="Logo Testing Company"
                  width={72}
                  height={72}
                  className="h-12 w-12 object-contain sm:h-14 sm:w-14"
                  priority
                />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500 dark:text-white/72">Central de aprovação</p>
                <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl dark:text-white">Solicitações de acesso</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-white/84">
                  Revise solicitações, acompanhe ajustes e aprove novos perfis de usuário.
                </p>
              </div>
            </div>


          </div>

          <div className="hidden">
            <div className="rounded-[18px] border border-slate-200 bg-transparent p-3 shadow-none dark:border-white/12 dark:bg-white/10 dark:backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-white/72">Abertas</span>
                <FiClock className="h-4 w-4 text-slate-500 dark:text-white/72" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">{statusCounters.open}</div>
              <p className="mt-1 text-sm text-slate-500 dark:text-white/76">Aguardando primeira leitura.</p>
            </div>

            <div className="rounded-[18px] border border-slate-200 bg-transparent p-3 shadow-none dark:border-white/12 dark:bg-white/10 dark:backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-white/72">Em análise</span>
                <FiRefreshCw className="h-4 w-4 text-slate-500 dark:text-white/72" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">{statusCounters.inReview}</div>
              <p className="mt-1 text-sm text-slate-500 dark:text-white/76">Fila ativa de triagem.</p>
            </div>

            <div className="rounded-[18px] border border-slate-200 bg-transparent p-3 shadow-none dark:border-white/12 dark:bg-white/10 dark:backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-white/72">Ajuste</span>
                <FiRefreshCw className="h-4 w-4 text-slate-500 dark:text-white/72" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">{statusCounters.inProgress}</div>
              <p className="mt-1 text-sm text-slate-500 dark:text-white/76">Solicitante reenviou a solicitação para nova análise.</p>
            </div>

            <div className="rounded-[18px] border border-slate-200 bg-transparent p-3 shadow-none dark:border-white/12 dark:bg-white/10 dark:backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-white/72">Aprovadas</span>
                <FiCheckCircle className="h-4 w-4 text-slate-500 dark:text-white/72" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">{statusCounters.approved}</div>
              <p className="mt-1 text-sm text-slate-500 dark:text-white/76">Acessos validados e convertidos.</p>
            </div>

            <div className="rounded-[18px] border border-slate-200 bg-transparent p-3 shadow-none dark:border-white/12 dark:bg-white/10 dark:backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-white/72">Recusadas</span>
                <FiSlash className="h-4 w-4 text-slate-500 dark:text-white/72" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">{statusCounters.rejected}</div>
              <p className="mt-1 text-sm text-slate-500 dark:text-white/76">Encerradas sem liberação.</p>
            </div>
          </div>
        </section>

        {(error || successMessage) ? (
          <div className="pointer-events-none fixed right-4 top-28 z-2147483647 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3 sm:right-8">
            {error ? (
              <div className="pointer-events-auto animate-in fade-in slide-in-from-top-2 rounded-3xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-800 shadow-[0_22px_50px_rgba(15,23,42,0.18)]">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-base">!</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-rose-900">Atenção</p>
                    <p className="mt-1 leading-6">{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    aria-label="Fechar aviso de erro"
                    className="rounded-full border border-rose-100 bg-rose-50 px-2 py-1 text-xs font-black text-rose-700 transition hover:bg-rose-100"
                  >
                    X
                  </button>
                </div>
              </div>
            ) : null}

            {successMessage ? (
              <div className="pointer-events-auto animate-in fade-in slide-in-from-top-2 rounded-3xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-800 shadow-[0_22px_50px_rgba(15,23,42,0.18)]">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-base">âœ“</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-emerald-900">Tudo certo</p>
                    <p className="mt-1 leading-6">{successMessage}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSuccessMessage(null)}
                    aria-label="Fechar aviso de sucesso"
                    className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                  >
                    X
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <AccessRequestsTableExperience
          items={filteredItems}
          loading={loading}
          total={statusCounters.total}
          statusCounts={statusCounters}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={(value) => setStatusFilter(value as StatusFilter)}
          dateFilter={dateFilter}
          onDateFilterChange={(value) => setDateFilter(value as DateFilter)}
          onDelete={deleteRequest}
          detail={(mode) =>
            selected && draft ? (
              <AccessRequestProfileWorkspace
                selected={selected}
                draft={draft}
                comparisonRows={buildAccessRequestComparisonRows({ selected, selectedOriginal, draft })}
                profileEmoji={profileEmoji}
                saving={saving}
                readOnly={mode === "view"}
                profileAvatarKind={profileAvatarKind}
                onSaveVisualProfile={() =>
                  void persistVisualReview({
                    avatar: {
                      avatarKind: profileAvatarKind,
                      avatarValue: profileEmoji,
                      avatarLabel: profileAvatarLabel,
                    },
                  })
                }
                onAvatarChange={(choice) => {
                  setProfileAvatarKind(choice.avatarKind);
                  setProfileEmoji(choice.avatarValue);
                  setProfileAvatarLabel(choice.avatarLabel);
                }}
                missingRequiredFields={missingRequiredFields}
                requiresCompany={requiresCompany}
                acceptDisabled={acceptDisabled}
                accepting={accepting}
                requestingAdjustment={requestingAdjustment}
                selectedIsPasswordReset={Boolean(selectedIsPasswordReset)}
                commentsLocked={commentsLocked}
                comments={comments}
                commentLoading={commentLoading}
                commentError={commentError}
                commentDraft={commentDraft}
                sendingComment={sendingComment}
                onCommentDraftChange={setCommentDraft}
                onSendComment={sendApplicantMessage}
                internalNotesDraft={internalNotesDraft}
                onInternalNotesChange={setInternalNotesDraft}
                onSaveInternalNotes={(value) => void persistVisualReview({ internalNotes: value })}
                adjustmentFieldsDraft={adjustmentFieldsDraft}
                adjustmentFieldComments={adjustmentFieldComments}
                onToggleAdjustmentField={(field) =>
                  setAdjustmentFieldsDraft((current) => {
                    const typedField = field as AccessRequestAdjustmentField;
                    if (!isAdjustableProfileField(typedField)) return current;
                    if (current.includes(typedField)) {
                      setAdjustmentFieldComments((comments) => {
                        const next = { ...comments };
                        delete next[field];
                        return next;
                      });
                      return current.filter((item) => item !== typedField);
                    }
                    return [...current, typedField];
                  })
                }
                onAdjustmentFieldCommentChange={(field, value) =>
                  setAdjustmentFieldComments((current) => ({
                    ...current,
                    [field]: value,
                  }))
                }
                rejectionReasons={ACCESS_REQUEST_REJECTION_REASONS}
                rejectionReasonDraft={rejectionReasonDraft}
                onRejectionReasonChange={setRejectionReasonDraft}
                onRequestAdjustment={requestAdjustment}
                onReject={rejectRequest}
                onApprove={acceptRequest}
              />
            ) : null
          }
        />
      </div>
    </div>
  );
}

export default function AccessRequestsPageWithGuard() {
  return (
    <RequireAccessRequestReviewer>
      <AccessRequestsPage />
    </RequireAccessRequestReviewer>
  );
}


