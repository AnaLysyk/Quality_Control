"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./AccessRequests.module.css";
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
    avatarKind?: "emoji" | "gif" | "default";
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
      label: "Perfil",
      original: original ? toRequestProfileTypeLabel(original.profileType) : selected.accessType,
      current: draft.accessType ?? selected.accessType,
    },
    {
      label: "Empresa",
      original: original?.company || selected.company,
      current: draft.company ?? selected.company,
    },
    {
      label: "Usuário",
      original: original?.username || selected.username || "",
      current: draft.username ?? selected.username ?? "",
    },
    {
      label: "Nome completo",
      original: original?.fullName || original?.name || selected.fullName || selected.name,
      current: draft.fullName ?? selected.fullName ?? selected.name,
    },
    {
      label: "E-mail",
      original: original?.email || selected.email,
      current: draft.email ?? selected.email,
    },
    {
      label: "Telefone",
      original: original?.phone || selected.phone,
      current: draft.phone ?? selected.phone,
    },
    {
      label: "Cargo",
      original: original?.jobRole || selected.jobRole,
      current: draft.jobRole ?? selected.jobRole,
    },
    {
      label: "Título",
      original: original?.title || selected.title,
      current: draft.title ?? selected.title,
    },
    {
      label: "Descrição",
      original: original?.description || selected.description,
      current: draft.description ?? selected.description,
    },
    {
      label: "Observações",
      original: original?.notes || selected.notes,
      current: draft.adminNotes ?? selected.adminNotes ?? "",
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
  if (field === "fullName") return "Nome completo";
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

function adjustmentFieldBadgeClass(field: AccessRequestAdjustmentEntry["field"]) {
  if (field === "profileType" || field === "company") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (field === "password") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  if (field === "title" || field === "description" || field === "notes" || field === "jobRole") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

type AdjustmentFieldOption = {
  field: AccessRequestAdjustmentField;
  label: string;
  hint: string;
};

const BASE_ADJUSTMENT_FIELD_OPTIONS: AdjustmentFieldOption[] = [
  { field: "profileType", label: "Perfil", hint: "Perfil ou tipo de acesso" },
  { field: "company", label: "Empresa", hint: "Empresa vinculada ou selecionada" },
  { field: "fullName", label: "Nome completo", hint: "Nome principal do solicitante" },
  { field: "username", label: "Usuário sugerido", hint: "Login/usuário sugerido" },
  { field: "email", label: "E-mail", hint: "Endereço de e-mail" },
  { field: "phone", label: "Telefone", hint: "Telefone de contato" },
  { field: "jobRole", label: "Cargo", hint: "Cargo ou função" },
  { field: "title", label: "Título", hint: "Título da solicitação" },
  { field: "description", label: "Descrição", hint: "Descrição detalhada" },
  { field: "notes", label: "Observações", hint: "Observações complementares" },
  { field: "password", label: "Senha", hint: "Senha informada na solicitação" },
];

const COMPANY_ADJUSTMENT_FIELD_OPTIONS: AdjustmentFieldOption[] = [
  { field: "companyName", label: "Razão social", hint: "Nome da empresa" },
  { field: "companyTaxId", label: "CNPJ", hint: "Documento principal da empresa" },
  { field: "companyZip", label: "CEP", hint: "CEP cadastrado" },
  { field: "companyAddress", label: "Endereço", hint: "Endereço principal" },
  { field: "companyPhone", label: "Telefone da empresa", hint: "Telefone institucional" },
  { field: "companyWebsite", label: "Website", hint: "Website oficial" },
  { field: "companyLinkedin", label: "LinkedIn", hint: "LinkedIn institucional" },
  { field: "companyDescription", label: "Descrição da empresa", hint: "Descrição institucional" },
  { field: "companyNotes", label: "Observações da empresa", hint: "Observações da empresa" },
];

const inputBase =
  "mt-1 w-full rounded-[16px] border border-(--tc-border) bg-(--tc-surface) px-3.5 py-2.5 text-sm font-medium text-(--tc-text-primary) shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition placeholder:text-(--tc-text-muted) focus:border-(--tc-accent) focus:outline-none focus:ring-4 focus:ring-[rgba(239,0,1,0.12)]";

const readOnlyInputBase =
  "mt-1 w-full rounded-[16px] border border-(--tc-border) bg-(--tc-surface-2) px-3.5 py-2.5 text-sm font-medium text-(--tc-text-primary) shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]";

const labelBase = "text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-accent)";
const formLabelBase = "text-[11px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted)";

const sectionCard =
  "rounded-3xl border border-(--tc-border) bg-(--tc-surface) p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]";
const sectionMuted =
  "rounded-3xl border border-(--tc-border) bg-(--tc-surface-2) p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]";

const PROFILE_EMOJI_OPTIONS = ["👤", "🧑‍💻", "🧪", "🛡️", "🏢", "📊", "🚀", "⭐"] as const;

type StatusFilter = "all" | "open" | "in_progress" | "closed" | "rejected";
type DateFilter = "all" | "today" | "week" | "month";
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

function filterAccessRequestItems(
  items: AccessRequestItem[],
  searchTerm: string,
  statusFilter: StatusFilter,
  dateFilter: DateFilter,
) {
  const query = searchTerm.trim().toLowerCase();
  return items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (!isWithinDateFilter(item.createdAt, dateFilter)) return false;
    if (!query) return true;
    return [
      item.fullName,
      item.name,
      item.email,
      item.company,
      item.accessType,
      item.jobRole,
      item.title,
      item.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
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

function getAdjustmentFieldOptions(
  selected?: AccessRequestItem | null,
  selectedOriginal?: AccessRequestSnapshot | null,
) {
  return selectedOriginal?.companyProfile || selected?.companyProfile
    ? [...BASE_ADJUSTMENT_FIELD_OPTIONS, ...COMPANY_ADJUSTMENT_FIELD_OPTIONS]
    : BASE_ADJUSTMENT_FIELD_OPTIONS;
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

  const selectedAdjustmentDiff = selected?.lastAdjustmentDiff ?? [];
  const selectedHasRequesterAdjustment = Boolean(selected?.lastAdjustmentAt && selectedAdjustmentDiff.length > 0);
  const selectedOriginal = selected?.originalRequest ?? null;
  const latestAdjustmentRound = selected?.adjustmentHistory?.[selected.adjustmentHistory.length - 1] ?? null;
  const adjustmentFieldOptions = useMemo(
    () => getAdjustmentFieldOptions(selected, selectedOriginal),
    [selected, selectedOriginal],
  );
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
  const acceptDisabled = !selected || !draft || accepting || missingRequiredFields || (requiresCompany && !draft.clientId);

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
    setAdjustmentFieldsDraft(selected?.adjustmentRequestedFields ?? []);
    setAdjustmentFieldComments({});
  }, [selected]);

  useEffect(() => {
    setProfileEmoji(selected?.visualProfile?.avatarValue || PROFILE_EMOJI_OPTIONS[0]);
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
          avatarKind: "emoji",
          avatarValue: profileEmoji,
          avatarLabel: "Perfil do solicitante",
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

  async function persistVisualReview(next?: { emoji?: string; internalNotes?: string }) {
    if (!selected || !draft) return;

    const nextEmoji = next?.emoji ?? profileEmoji;
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
          avatarKind: "emoji",
          avatarValue: nextEmoji,
          avatarLabel: "Perfil do solicitante",
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
  async function requestAdjustment() {
    if (!selected) return;
    const body = commentDraft.trim();
    if (!body) return;
    if (adjustmentFieldsDraft.length === 0) {
      setCommentError("Selecione pelo menos um campo para devolucao de ajuste.");
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
          fieldComments: adjustmentFieldComments,
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
    if (!rejectionReason) {
      setError("Selecione o motivo da rejeição.");
      return;
    }
    const rejectionText = [rejectionReason.label, commentDraft.trim()]
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
    <div className="min-h-screen bg-transparent text-(--tc-text-primary)">
      <div className="mx-auto flex w-full max-w-480 flex-col gap-5 px-2.5 py-5 sm:px-3 sm:py-6 lg:px-4 xl:px-5 2xl:px-6">
        <section
          className={`relative overflow-hidden rounded-[26px] border border-(--tc-border) px-4 py-3 text-white shadow-[0_18px_44px_rgba(15,23,42,0.12)] sm:px-5 sm:py-4 ${styles.headerCard}`}
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
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/72">Central de aprovação</p>
                <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">Solicitações de acesso</h1>
                <p className="mt-2 max-w-2xl text-sm text-white/84">
                  Revise solicitações, acompanhe ajustes e aprove novos perfis de usuário.
                </p>
              </div>
            </div>


          </div>

          <div className="hidden">
            <div className="rounded-[22px] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">Abertas</span>
                <FiClock className="h-4 w-4 text-white/72" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">{statusCounters.open}</div>
              <p className="mt-1 text-sm text-white/76">Aguardando primeira leitura.</p>
            </div>

            <div className="rounded-[22px] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">Em análise</span>
                <FiRefreshCw className="h-4 w-4 text-white/72" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">{statusCounters.inReview}</div>
              <p className="mt-1 text-sm text-white/76">Fila ativa de triagem.</p>
            </div>

            <div className="rounded-[22px] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">Ajuste</span>
                <FiRefreshCw className="h-4 w-4 text-white/72" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">{statusCounters.inProgress}</div>
              <p className="mt-1 text-sm text-white/76">Solicitante reenviou a solicitação para nova análise.</p>
            </div>

            <div className="rounded-[22px] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">Aprovadas</span>
                <FiCheckCircle className="h-4 w-4 text-white/72" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">{statusCounters.approved}</div>
              <p className="mt-1 text-sm text-white/76">Acessos validados e convertidos.</p>
            </div>

            <div className="rounded-[22px] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">Recusadas</span>
                <FiSlash className="h-4 w-4 text-white/72" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">{statusCounters.rejected}</div>
              <p className="mt-1 text-sm text-white/76">Encerradas sem liberação.</p>
            </div>
          </div>
        </section>

        {(error || successMessage) ? (
          <div className="fixed right-4 top-4 z-[80] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
            {error ? (
              <div className="animate-in fade-in slide-in-from-top-2 rounded-3xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-800 shadow-[0_22px_50px_rgba(15,23,42,0.18)]">
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
              <div className="animate-in fade-in slide-in-from-top-2 rounded-3xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-800 shadow-[0_22px_50px_rgba(15,23,42,0.18)]">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-base">✓</div>
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

        <div className="grid items-stretch grid-cols-1 gap-5 xl:grid-cols-[minmax(300px,350px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(330px,390px)_minmax(0,1fr)]">
          <aside className="flex min-h-170 flex-col overflow-hidden rounded-[28px] border border-(--tc-border) bg-(--tc-surface) shadow-[0_20px_48px_rgba(15,23,42,0.08)] xl:h-[calc(100vh-5.2rem)] xl:min-h-0 2xl:sticky 2xl:top-4">
            <div className={`border-b border-(--tc-border) p-5 ${styles.asideHeader}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-semibold tracking-tight text-(--tc-text-primary)">Fila de solicitações</h2><p className="mt-1 text-sm text-(--tc-text-muted)">{filteredItems.length} item(ns) no filtro atual</p>
                </div>
                <div className="rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-3 py-1.5 text-xs font-semibold text-(--tc-text-muted)">
                  {statusCounters.total} total
                </div>
              </div>

            <div className="relative mt-5">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--tc-accent)" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, e-mail, empresa, perfil ou cargo"
                data-testid="access-requests-search-input"
                className="w-full rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) py-3 pl-10 pr-4 text-sm font-medium text-(--tc-text-primary) shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none transition placeholder:text-(--tc-text-muted) focus:border-(--tc-accent) focus:ring-4 focus:ring-[rgba(239,0,1,0.12)]"
              />
            </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-black uppercase tracking-[0.18em] text-(--tc-text-muted)">
                  Status
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                    className="mt-2 w-full rounded-2xl border border-(--tc-border) bg-white px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-(--tc-text-primary) outline-none transition focus:border-(--tc-accent) focus:ring-4 focus:ring-[rgba(239,0,1,0.10)]"
                  >
                    <option value="all">Todos os status</option>
                    <option value="open">Novas</option>
                    <option value="in_progress">Aguardando ajuste</option>
                    <option value="closed">Aprovadas</option>
                    <option value="rejected">Recusadas</option>
                  </select>
                </label>

                <label className="text-xs font-black uppercase tracking-[0.18em] text-(--tc-text-muted)">
                  Período
                  <select
                    value={dateFilter}
                    onChange={(event) => setDateFilter(event.target.value as DateFilter)}
                    className="mt-2 w-full rounded-2xl border border-(--tc-border) bg-white px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-(--tc-text-primary) outline-none transition focus:border-(--tc-accent) focus:ring-4 focus:ring-[rgba(239,0,1,0.10)]"
                  >
                    <option value="all">Todo o histórico</option>
                    <option value="today">Hoje</option>
                    <option value="week">Últimos 7 dias</option>
                    <option value="month">Últimos 30 dias</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pr-3 [scrollbar-width:none] sm:p-5 sm:pr-4 [&::-webkit-scrollbar]:hidden" data-testid="access-requests-list">
              {loading ? (
                <div className={`${sectionMuted} text-sm text-(--tc-text-muted)`}>Carregando solicitações...</div>
              ) : filteredItems.length === 0 ? (
                <div className={`${sectionMuted} text-sm text-(--tc-text-muted)`}>
                  Nenhuma solicitação encontrada para o filtro atual.
                </div>
              ) : (
                filteredItems.map((it) => {
                  const selectedRow = selectedId === it.id;
                  const displayName = getPersonDisplayName(it);
                  const initials = getPersonInitials(displayName);
                  const subtitle = getRequestPersonaSubtitle(it);

                  return (
                    <article
                      key={it.id}
                      data-testid="access-request-row"
                      className={`group rounded-[26px] border p-3.5 transition focus-within:ring-2 focus-within:ring-[rgba(239,0,1,0.22)] ${
                        selectedRow
                          ? `border-transparent text-white shadow-[0_20px_44px_rgba(1,24,72,0.18)] ${styles.rowSelected}`
                          : "border-(--tc-border) bg-(--tc-surface) shadow-[0_14px_34px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:border-[rgba(1,24,72,0.14)] hover:shadow-[0_18px_40px_rgba(15,23,42,0.1)]"
                      }`}
                    >
                      <button type="button" onClick={() => setSelectedId(it.id)} className="w-full text-left">
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black shadow-[0_12px_26px_rgba(15,23,42,0.12)] ${
                              selectedRow
                                ? "border border-white/20 bg-white/15 text-white"
                                : "border border-(--tc-border) bg-[linear-gradient(135deg,var(--tc-primary)_0%,rgba(239,0,1,0.82)_160%)] text-white"
                            }`}
                          >
                            {it.visualProfile?.avatarValue || initials}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className={`truncate text-base font-black leading-5 ${selectedRow ? "text-white" : "text-(--tc-text-primary)"}`}>
                                  {displayName}
                                </p>
                                <p className={`mt-1 truncate text-xs font-semibold ${selectedRow ? "text-white/78" : "text-(--tc-text-secondary)"}`}>
                                  {it.email}
                                </p>
                              </div>

                              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                                selectedRow ? "border-white/20 bg-white/15 text-white" : getStatusTone(it.status)
                              }`}>
                                {statusLabel(it.status)}
                              </span>
                            </div>

                            <p className={`mt-3 line-clamp-2 text-xs font-semibold leading-5 ${selectedRow ? "text-white/82" : "text-(--tc-text-muted)"}`}>
                              {subtitle}
                            </p>

                            <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 ${selectedRow ? "border-white/12" : "border-(--tc-border)"}`}>
                              <span className={`text-[11px] font-semibold ${selectedRow ? "text-white/72" : "text-(--tc-text-muted)"}`}>
                                {formatDateTime(it.createdAt)}
                              </span>
                              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                selectedRow ? "border-white/20 bg-white/10 text-white" : accessTypeBadgeClass(it.accessType)
                              }`}>
                                {it.accessType}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    </article>
                  );
                })
              )}
            </div>
          </aside>

          <section className="flex min-h-170 flex-col overflow-hidden rounded-[28px] border border-(--tc-border) bg-(--tc-surface) shadow-[0_20px_48px_rgba(15,23,42,0.08)] xl:h-[calc(100vh-5.2rem)] xl:min-h-0">
            {!selected || !draft ? (
              <div className={`${sectionMuted} flex min-h-105 flex-1 items-center justify-center p-6 sm:p-8`}>
                <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,var(--tc-primary)_0%,rgba(239,0,1,0.82)_180%)] text-white shadow-[0_18px_38px_rgba(1,24,72,0.16)]">
                    <FiClock size={24} />
                  </div>
                  <div className="mt-5 space-y-2">
                    <h3 className="text-[1.6rem] font-black tracking-[-0.04em] text-(--tc-text-primary)">
                      Selecione uma pessoa para analisar
                    </h3>
                    <p className="max-w-2xl text-sm leading-7 text-(--tc-text-muted)">
                      Escolha uma solicitação na fila para abrir o perfil em análise, comparar os dados enviados,
                      revisar ajustes e concluir a decisão com contexto completo.
                    </p>
                  </div>

                  <div className="mt-6 grid w-full gap-3 sm:grid-cols-3">
                    <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface) px-4 py-4 text-left shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted)">Abertas</div>
                      <div className="mt-2 text-3xl font-black text-(--tc-text-primary)">{statusCounters.open}</div>
                      <div className="mt-2 text-sm text-(--tc-text-muted)">Solicitações aguardando primeira leitura.</div>
                    </div>
                    <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface) px-4 py-4 text-left shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted)">Em análise</div>
                      <div className="mt-2 text-3xl font-black text-(--tc-text-primary)">{statusCounters.inReview}</div>
                      <div className="mt-2 text-sm text-(--tc-text-muted)">Fila administrativa ativa para válidação.</div>
                    </div>
                    <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface) px-4 py-4 text-left shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted)">Ajustes</div>
                      <div className="mt-2 text-3xl font-black text-(--tc-text-primary)">{statusCounters.inProgress}</div>
                      <div className="mt-2 text-sm text-(--tc-text-muted)">Retornos esperando correção do solicitante.</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-3 [scrollbar-width:none] sm:p-4 xl:p-5 2xl:p-6 [&::-webkit-scrollbar]:hidden">
                <section className="overflow-hidden rounded-[30px] border border-(--tc-border) bg-white p-5 shadow-[0_20px_54px_rgba(15,23,42,0.08)]">
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)]">
                    <div className="flex min-w-0 gap-5">
                      <div className="flex min-w-[132px] flex-col items-center">
                        <div className="flex h-28 w-28 items-center justify-center rounded-[34px] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#dbeafe_100%)] text-6xl shadow-[0_20px_42px_rgba(37,99,235,0.14)]">
                          {profileEmoji || selected.visualProfile?.avatarValue || getPersonInitials(selected.fullName || selected.name || selected.email)}
                        </div>

                        <div className="mt-3 flex flex-wrap justify-center gap-2">
                          {PROFILE_EMOJI_OPTIONS.slice(0, 6).map((emoji) => {
                            const activeEmoji = profileEmoji === emoji;
                            return (
                              <button
                                key={`profile-emoji-${emoji}`}
                                type="button"
                                onClick={() => {
                                  setProfileEmoji(emoji);
                                  void persistVisualReview({ emoji });
                                }}
                                className={`flex h-9 w-9 items-center justify-center rounded-2xl border text-lg transition ${
                                  activeEmoji
                                    ? "border-sky-300 bg-sky-50 shadow-[0_10px_22px_rgba(37,99,235,0.12)]"
                                    : "border-(--tc-border) bg-white hover:bg-(--tc-surface-2)"
                                }`}
                                aria-label={`Usar emoji ${emoji} no perfil`}
                              >
                                {emoji}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-black ${statusBadgeClass(selected.status)}`}>
                            {statusLabel(selected.status)}
                          </span>
                          <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-black ${accessTypeBadgeClass(selected.accessType)}`}>
                            {selected.accessType}
                          </span>
                        </div>

                        <p className="mt-4 text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">Perfil que será criado</p>
                        <h2 className="mt-1 break-words text-3xl font-black tracking-tight text-(--tc-text-primary)">
                          {draft.fullName || selected.fullName || selected.name || "(sem nome)"}
                        </h2>

                        <div className="mt-3 grid gap-2 text-sm font-semibold text-(--tc-text-secondary) sm:grid-cols-2">
                          <p className="truncate">E-mail: {draft.email || selected.email}</p>
                          <p className="truncate">Telefone: {draft.phone || selected.phone || "Não informado"}</p>
                          <p className="truncate">Usuário: @{draft.username || selected.username || "a-definir"}</p>
                          <p className="truncate">Cargo: {draft.jobRole || selected.jobRole || "Não informado"}</p>
                          <p className="truncate">Empresa: {draft.company || selected.company || "Sem empresa"}</p>
                          <p className="truncate">Recebida: {formatDateTime(selected.createdAt)}</p>
                        </div>

                        <p className="mt-4 max-w-3xl text-sm leading-6 text-(--tc-text-secondary)">
                          Este é o cadastro que será liberado no sistema. Revise os dados finais, confira as alterações do solicitante e conclua a decisão.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[26px] border border-(--tc-border) bg-(--tc-surface-2) p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-(--tc-text-muted)">Resumo da análise</p>
                          <h3 className="mt-1 text-lg font-black text-(--tc-text-primary)">Pronto para decisão</h3>
                        </div>
                        <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                          acceptDisabled
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}>
                          {acceptDisabled ? "Pendências" : "Pronto para aprovação"}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3">
                        <div className="flex items-center justify-between rounded-2xl border border-(--tc-border) bg-white px-3 py-2.5">
                          <span className="text-sm font-semibold text-(--tc-text-secondary)">Senha definida</span>
                          <span className={`text-sm font-black ${draft.passwordProvided ? "text-emerald-700" : "text-rose-700"}`}>
                            {draft.passwordProvided ? "Sim" : "Não"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-(--tc-border) bg-white px-3 py-2.5">
                          <span className="text-sm font-semibold text-(--tc-text-secondary)">Campos obrigatórios</span>
                          <span className={`text-sm font-black ${missingRequiredFields ? "text-amber-700" : "text-emerald-700"}`}>
                            {missingRequiredFields ? "Pendentes" : "OK"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-(--tc-border) bg-white px-3 py-2.5">
                          <span className="text-sm font-semibold text-(--tc-text-secondary)">Alterações do solicitante</span>
                          <span className="text-sm font-black text-amber-700">
                            {buildAccessRequestComparisonRows({ selected, selectedOriginal, draft }).filter((row) => row.changed).length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-(--tc-border) bg-white px-3 py-2.5">
                          <span className="text-sm font-semibold text-(--tc-text-secondary)">Última análise</span>
                          <span className="text-sm font-black text-(--tc-text-primary)">
                            {selected.reviewSummary?.lastReviewedAt ? formatDateTime(selected.reviewSummary.lastReviewedAt) : "Ainda não analisada"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
                  <div className={`${sectionCard} overflow-hidden border-0 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_46%,#eff6ff_100%)]`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-700">Alterações do solicitante</p>
                        <h3 className="mt-1 text-xl font-black tracking-tight text-(--tc-text-primary)">O que mudou antes de virar perfil</h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-(--tc-text-secondary)">
                          Cada card mostra o valor original e o valor atual que será usado na criação do usuário.
                        </p>
                      </div>

                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800">
                        {buildAccessRequestComparisonRows({ selected, selectedOriginal, draft }).filter((row) => row.changed).length} alteração(ões)
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3">
                      {buildAccessRequestComparisonRows({ selected, selectedOriginal, draft }).filter((row) => row.changed).length > 0 ? (
                        buildAccessRequestComparisonRows({ selected, selectedOriginal, draft })
                          .filter((row) => row.changed)
                          .map((row) => (
                            <article
                              key={`visual-change-${row.label}`}
                              className="overflow-hidden rounded-[24px] border border-amber-200 bg-white shadow-[0_16px_34px_rgba(217,119,6,0.10)]"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3">
                                <h4 className="font-black text-(--tc-text-primary)">{row.label}</h4>
                                <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800">
                                  Alterado
                                </span>
                              </div>

                              <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] md:items-stretch">
                                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-700">Antes</p>
                                  <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-rose-900">{row.originalText}</p>
                                </div>

                                <div className="hidden items-center justify-center text-xl font-black text-(--tc-text-muted) md:flex">→</div>

                                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3 ring-2 ring-sky-100">
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-700">Agora / perfil</p>
                                  <p className="mt-2 whitespace-pre-wrap break-words text-sm font-black leading-6 text-sky-950">{row.currentText}</p>
                                </div>
                              </div>
                            </article>
                          ))
                      ) : (
                        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-5 text-emerald-800">
                          <p className="font-black">Nenhuma alteração identificada.</p>
                          <p className="mt-1 text-sm leading-6">Os dados atuais estão iguais ao envio original.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`${sectionCard} overflow-hidden`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">Dados que serão salvos no perfil</p>
                        <h3 className="mt-1 text-xl font-black tracking-tight text-(--tc-text-primary)">Cadastro final</h3>
                      </div>
                      <span className="rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-3 py-1.5 text-xs font-black text-(--tc-text-muted)">
                        Prévia
                      </span>
                    </div>

                    <div className="mt-5 divide-y divide-(--tc-border) rounded-[24px] border border-(--tc-border) bg-white">
                      {[
                        { label: "Nome completo", value: draft.fullName || selected.fullName || selected.name || "Não informado" },
                        { label: "Usuário", value: draft.username || selected.username || "A definir" },
                        { label: "E-mail", value: draft.email || selected.email || "Não informado" },
                        { label: "Telefone", value: draft.phone || selected.phone || "Não informado" },
                        { label: "Empresa", value: draft.company || selected.company || "Sem empresa" },
                        { label: "Cargo", value: draft.jobRole || selected.jobRole || "Não informado" },
                        { label: "Perfil de acesso", value: draft.accessType || selected.accessType || "Não informado" },
                        { label: "Senha", value: draft.passwordProvided ? "Senha informada" : "Senha pendente" },
                      ].map((field) => (
                        <div key={`profile-final-${field.label}`} className="grid gap-2 px-4 py-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-(--tc-text-muted)">{field.label}</span>
                          <span className="break-words text-sm font-black text-(--tc-text-primary)">{field.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
                <section className="rounded-3xl border border-dashed border-(--tc-border) bg-(--tc-surface-2) px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Dados técnicos completos</p>
                      <h3 className="mt-1 text-lg font-black tracking-tight text-(--tc-text-primary)">Base original e edição administrativa</h3>
                      <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary)">
                        Área técnica mantida como apoio interno. A decisão principal deve ser feita pelos cards de perfil, resumo e alterações acima.
                      </p>
                    </div>

                    <span className="rounded-full border border-(--tc-border) bg-white px-3 py-1.5 text-xs font-black text-(--tc-text-muted)">
                      Oculto no fluxo principal
                    </span>
                  </div>
                </section>
                <section className={`${sectionCard} overflow-hidden`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Observações internas</p>
                      <h3 className="mt-1 text-lg font-black tracking-tight text-(--tc-text-primary)">Notas da análise</h3>
                      <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary)">
                        Informação visível apenas para administradores/revisores. Não será enviada para o solicitante.
                      </p>
                    </div>
                    <span className="rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-3 py-1.5 text-xs font-black text-(--tc-text-muted)">
                      Interno
                    </span>
                  </div>

                  <textarea
                    value={internalNotesDraft}
                    onChange={(event) => setInternalNotesDraft(event.target.value)}
                    onBlur={() => void persistVisualReview({ internalNotes: internalNotesDraft })}
                    placeholder="Registre contexto, validação do gestor, motivo da decisão ou ressalvas internas..."
                    rows={4}
                    className="mt-4 w-full resize-none rounded-[22px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-3 text-sm font-medium leading-6 text-(--tc-text-primary) outline-none transition placeholder:text-(--tc-text-muted) focus:border-(--tc-accent) focus:ring-4 focus:ring-[rgba(239,0,1,0.10)]"
                  />
                </section>

                <section className={sectionMuted}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-(--tc-accent)">Linha do tempo e conversa</p>
                      <h3 className="mt-2 text-lg font-semibold text-(--tc-text-primary)">Linha do tempo e conversa</h3>
                      <p className="mt-1 text-sm text-(--tc-text-secondary)">
                        Acompanhe o histórico, registre mensagens e mantenha a comunicação com o solicitante.
                      </p>
                    </div>
                    {commentLoading ? <span className="text-sm font-medium text-(--tc-text-muted)">Carregando...</span> : null}
                  </div>

                  {commentError ? (
                    <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                      {commentError}
                    </div>
                  ) : null}

                  {selected.adjustmentHistory.length > 0 ? (
                    <div className="mt-5 rounded-[20px] border border-(--tc-border) bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className={labelBase}>Rodadas de ajuste</p>
                          <p className="mt-2 text-sm text-(--tc-text-secondary)">
                            Histórico de devoluções, retorno do solicitante e campos marcados por rodada.
                          </p>
                        </div>
                        <span className="rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-3 py-1 text-xs font-semibold text-(--tc-text-secondary)">
                          {selected.adjustmentHistory.length} rodada(s)
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {[...selected.adjustmentHistory].reverse().map((round) => (
                          <div key={`round-${round.round}`} className="rounded-[18px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-(--tc-text-primary)">{round.round}º ajuste</span>
                              <span className="text-xs font-medium text-(--tc-text-muted)">
                                {formatDateTime(round.requestedAt)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-(--tc-text-secondary)">
                              {round.requestMessage?.trim() || "Sem mensagem registrada nesta rodada."}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {round.requestedFields.map((field) => (
                                <span
                                  key={`round-field-${round.round}-${field}`}
                                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adjustmentFieldBadgeClass(field)}`}
                                >
                                  {adjustmentFieldLabel(field, field)}
                                </span>
                              ))}
                            </div>
                            <p className="mt-3 text-xs font-medium text-(--tc-text-muted)">
                              {round.requesterReturnedAt
                                ? `Respondida em ${formatDateTime(round.requesterReturnedAt)}`
                                : "Ainda aguardando retorno do solicitante."}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 comments-chat">
                    <div className="comments-chat-list" aria-live="polite">
                      {comments.length === 0 ? (
                        <p className="comments-chat-empty">Nenhuma interação registrada ainda.</p>
                      ) : (
                        comments.map((comment) => {
                          const mine = comment.authorRole === "leader_tc";
                          return (
                            <div key={comment.id} className={`comments-chat-message ${mine ? "mine" : "other"}`}>
                              <div className="comments-chat-author">
                                {comment.authorRole === "leader_tc" ? "Admin" : "Solicitante"}: {comment.authorName}
                              </div>
                              <div className="comments-chat-bubble whitespace-pre-wrap">{comment.body}</div>
                              <div className="comments-chat-meta">{formatDateTime(comment.createdAt)}</div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="comments-chat-input">
                      <textarea
                        className={`${inputBase} mt-0 min-h-30 resize-none`}
                        rows={4}
                        placeholder={commentsLocked ? "Solicitação finalizada" : "Descreva o ajuste, a observação interna ou o motivo da decisão"}
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        disabled={commentsLocked}
                      />
                    </div>
                  </div>

                  {!commentsLocked ? (
                    <div className="mt-4 rounded-[20px] border border-(--tc-border) bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className={labelBase}>Campos para correção</p>
                          <p className="mt-2 text-sm text-(--tc-text-secondary)">
                            Ao solicitar ajuste, marque os campos que o solicitante pode corrigir. Os demais permanecem somente leitura.
                          </p>
                        </div>
                        <span className="rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-3 py-1 text-xs font-semibold text-(--tc-text-secondary)">
                          {adjustmentFieldsDraft.length} campo(s)
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {adjustmentFieldOptions.map((option) => {
                          const selectedField = adjustmentFieldsDraft.includes(option.field);
                          return (
                            <button
                              key={`adjustment-field-${option.field}`}
                              type="button"
                              onClick={() =>
                                setAdjustmentFieldsDraft((current) =>
                                  current.includes(option.field)
                                    ? current.filter((field) => field !== option.field)
                                    : [...current, option.field],
                                )
                              }
                              className={`inline-flex items-center rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                selectedField
                                  ? "border-rose-300 bg-rose-50 text-rose-700 shadow-[0_8px_18px_rgba(225,29,72,0.1)]"
                                  : "border-(--tc-border) bg-(--tc-surface-2) text-(--tc-text-secondary) hover:border-[rgba(239,0,1,0.28)] hover:text-(--tc-text-primary)"
                              }`}
                              title={option.hint}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      {adjustmentFieldsDraft.length > 0 ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {adjustmentFieldsDraft.map((field) => {
                            const option = adjustmentFieldOptions.find((item) => item.field === field);
                            return (
                              <label key={`adjustment-comment-${field}`} className="text-xs font-semibold text-(--tc-text-secondary)">
                                Observacao para {option?.label ?? field}
                                <input
                                  type="text"
                                  value={adjustmentFieldComments[field] ?? ""}
                                  onChange={(event) =>
                                    setAdjustmentFieldComments((current) => ({
                                      ...current,
                                      [field]: event.target.value,
                                    }))
                                  }
                                  className="mt-2 w-full rounded-xl border border-(--tc-border) bg-white px-3 py-2 text-sm text-(--tc-text-primary)"
                                  data-testid={`access-request-adjustment-comment-${field}`}
                                />
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="sticky bottom-0 z-20 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-(--tc-border) bg-white/95 px-4 py-4 shadow-[0_-18px_42px_rgba(15,23,42,0.10)] backdrop-blur-md">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${draft.passwordProvided ? "border border-emerald-300 bg-emerald-100 text-emerald-800" : "border border-rose-300 bg-rose-100 text-rose-800"}`}>
                        {draft.passwordProvided ? "Senha válida" : "Senha ausente"}
                      </span>
                      {requiresCompany && !draft.clientId ? (
                        <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
                          Empresa obrigatória
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-3">
                    <select
                      value={rejectionReasonDraft}
                      onChange={(event) => setRejectionReasonDraft(event.target.value)}
                      disabled={commentsLocked}
                      className="min-h-10 rounded-full border border-rose-300 bg-white px-4 text-xs font-semibold text-rose-700 disabled:opacity-60"
                      data-testid="access-request-rejection-reason"
                      aria-label="Motivo da rejeição"
                    >
                      <option value="">Motivo da rejeição</option>
                      {ACCESS_REQUEST_REJECTION_REASONS.map((reason) => (
                        <option key={reason.value} value={reason.value}>
                          {reason.label}
                        </option>
                      ))}
                    </select>
<button
                      type="button"
                      onClick={requestAdjustment}
                      disabled={requestingAdjustment || selectedIsPasswordReset || !commentDraft.trim() || commentsLocked || adjustmentFieldsDraft.length === 0}
                      className="rounded-[20px] border border-amber-300 bg-amber-50 px-5 py-3 text-xs font-black uppercase tracking-[0.22em] text-amber-800 transition hover:-translate-y-0.5 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {requestingAdjustment ? "Enviando..." : "Solicitar ajuste"}
                    </button>

                    <button
                      type="button"
                      onClick={rejectRequest}
                      aria-label="Recusar solicitação"
                      disabled={accepting || !rejectionReasonDraft || commentsLocked}
                      className="rounded-[20px] border border-rose-300 bg-rose-50 px-5 py-3 text-xs font-black uppercase tracking-[0.22em] text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {accepting ? "Processando..." : "Recusar"}
                    </button>

                    <button
                      type="button"
                      onClick={acceptRequest}
                      aria-label="Aprovar solicitação"
                      disabled={acceptDisabled}
                      className="rounded-[22px] bg-(--tc-primary) px-7 py-3 text-xs font-black uppercase tracking-[0.24em] text-white shadow-[0_18px_38px_rgba(1,24,72,0.26)] transition hover:-translate-y-0.5 hover:bg-[rgba(1,24,72,0.88)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {accepting ? "Aprovando..." : selectedIsPasswordReset ? "Aprovar reset" : "Aprovar acesso"}
                    </button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </section>
        </div>
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

