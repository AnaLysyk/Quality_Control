"use client";

export const dynamic = "force-dynamic";

import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { useSWRProfileSummary } from "./useSWRProfileSummary";
import { useSWRCompanies } from "./useSWRCompanies";
import { useSWRCompanyProfile } from "./useSWRCompanyProfile";
import { useSWRCompanyUsers } from "./useSWRCompanyUsers";
import { CompanyUserCreateModal } from "./CompanyUserCreateModal";
import Link from "next/link";
import { FiAlertCircle, FiCheckCircle, FiChevronDown, FiEye, FiEyeOff, FiSearch, FiTrash2, FiUpload } from "react-icons/fi";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmDialog from "@/components/ConfirmDialog";
import UserAvatar from "@/components/UserAvatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { publishAuthUser, useAuthUser } from "@/hooks/useAuthUser";
import { useI18n } from "@/hooks/useI18n";
import { useAppSettings, type Language, type Theme } from "@/context/AppSettingsContext";
import { JOB_TITLE_OPTIONS } from "@/lib/jobTitles";
import { fetchApi } from "@/lib/api";
import { isCompanyProfileContext, isInstitutionalCompanyAccount } from "@/lib/activeIdentity";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";
import { getFixedProfileLabel, resolveFixedProfileKind } from "@/lib/fixedProfilePresentation";
import { hasPermissionAccess, normalizePermissionMatrix } from "@/lib/permissionMatrix";
import {
  canCreateCompanyUsersByScope,
  canViewCompanyUsersByScope,
  resolveUserScopePolicy,
} from "@/lib/userScopePolicy";

type LinkedCompany = {
  client_id: string;
  client_name: string;
  client_slug: string;
  client_active: boolean;
  role: "ADMIN" | "USER";
  link_active: boolean;
};

type UsernameReplacementDialogState = {
  mode: "generate" | "submit";
  currentUsername: string;
  nextUsername: string;
};

type AvatarSource = "upload" | "url" | null;

type ProfileSummary = {
  openDefectsCount: number;
  notesCreatedCount: number;
  linkedCompaniesCount: number;
  createdAt: string | null;
};

type CompanyProfile = {
  id: string;
  name: string;
  company_name?: string | null;
  slug?: string | null;
  tax_id?: string | null;
  cep?: string | null;
  address?: string | null;
  address_detail?: string | null;
  phone?: string | null;
  website?: string | null;
  logo_url?: string | null;
  docs_link?: string | null;
  linkedin_url?: string | null;
  qase_project_codes?: string[] | null;
  qase_token?: string | null;
  has_qase_token?: boolean;
  qase_token_masked?: string | null;
  qase_validation_status?: CompanyIntegrationState | null;
  qase_is_valid?: boolean;
  qase_is_active?: boolean;
  qase_validated_at?: string | null;
  jira_base_url?: string | null;
  jira_email?: string | null;
  jira_api_token?: string | null;
  has_jira_api_token?: boolean;
  jira_api_token_masked?: string | null;
  jira_validation_status?: CompanyIntegrationState | null;
  jira_is_valid?: boolean;
  jira_is_active?: boolean;
  jira_validated_at?: string | null;
  jira_account_name?: string | null;
  integration_mode?: string | null;
  notifications_fanout_enabled?: boolean;
  active?: boolean;
  status?: string | null;
};

type CompanyUser = {
  id: string;
  name: string;
  email: string;
  user: string;
  permission_role: string;
  active: boolean;
  status: string | null;
  avatar_url: string | null;
  user_origin: string | null;
  user_scope: string | null;
  allow_multi_company_link: boolean;
  origin_label: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeCompanies(payload: unknown): LinkedCompany[] {
  const rec = asRecord(payload);
  const items = Array.isArray(rec?.items) ? (rec.items as unknown[]) : [];

  return items
    .map((row) => {
      const current = asRecord(row) ?? {};
      const role: LinkedCompany["role"] = current.role === "ADMIN" ? "ADMIN" : "USER";
      return {
        client_id: typeof current.client_id === "string" ? current.client_id : "",
        client_name: typeof current.client_name === "string" ? current.client_name : "",
        client_slug: typeof current.client_slug === "string" ? current.client_slug : "",
        client_active: current.client_active === true,
        role,
        link_active: current.link_active === true,
      };
    })
    .filter((company) => company.client_id && company.client_name && company.client_slug);
}

function normalizeUiRole(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "it_dev" || normalized === "dev" || normalized === "developer" || normalized === "technical_support") return "global";
  if (normalized === "admin" || normalized === "global_admin" || normalized === "leader_tc") return "admin";
  if (normalized === "company" || normalized === "company_admin" || normalized === "client_admin" || normalized === "empresa") return "empresa";
  return "usuário";
}

function roleLabel(value?: string | null) {
  return getFixedProfileLabel(
    resolveFixedProfileKind({
      permissionRole: value,
      role: value,
    }),
  );
}

function companyUserProfileTypeLabel(user: Pick<CompanyUser, "permission_role" | "user_origin">) {
  return getFixedProfileLabel(
    resolveFixedProfileKind({
      permissionRole: user.permission_role,
      role: user.permission_role,
      userOrigin: user.user_origin,
    }),
  );
}

function statusLabel(active?: boolean, status?: string | null, t?: (key: string) => string) {
  if (active === false || status === "inactive" || status === "blocked") return t?.("settings.statusInactive") ?? "Inativo";
  if (status === "invited") return t?.("settings.statusInvited") ?? "Convidado";
  return t?.("settings.statusActive") ?? "Ativo";
}

function suggestUsername(value?: string | null) {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");

  return normalized || "usuário";
}

function normalizeSearchTerm(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function jobTitleMatchScore(option: string, query: string) {
  if (!query) return 0;

  const normalizedOption = normalizeSearchTerm(option);
  if (normalizedOption === query) return 5;
  if (normalizedOption.startsWith(query)) return 4;
  if (normalizedOption.split(/[\s/-]+/).some((token) => token.startsWith(query))) return 3;
  if (normalizedOption.includes(query)) return 2;
  return -1;
}

function normalizeProfileSummary(payload: unknown): ProfileSummary {
  const record = asRecord(payload) ?? {};
  return {
    openDefectsCount:
      typeof record.openDefectsCount === "number" && Number.isFinite(record.openDefectsCount) ? record.openDefectsCount : 0,
    notesCreatedCount:
      typeof record.notesCreatedCount === "number" && Number.isFinite(record.notesCreatedCount) ? record.notesCreatedCount : 0,
    linkedCompaniesCount:
      typeof record.linkedCompaniesCount === "number" && Number.isFinite(record.linkedCompaniesCount) ? record.linkedCompaniesCount : 0,
    createdAt: typeof record.createdAt === "string" && record.createdAt.trim() ? record.createdAt : null,
  };
}

function normalizeCompanyProfile(payload: unknown): CompanyProfile | null {
  const record = asRecord(payload);
  if (!record || typeof record.id !== "string" || !record.id.trim()) return null;

  const qaseProjectCodes = Array.isArray(record.qase_project_codes)
    ? record.qase_project_codes.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  return {
    id: record.id,
    name:
      (typeof record.name === "string" ? record.name : "") ||
      (typeof record.company_name === "string" ? record.company_name : "") ||
      "Empresa",
    company_name:
      typeof record.company_name === "string"
        ? record.company_name
        : typeof record.name === "string"
          ? record.name
          : null,
    slug: typeof record.slug === "string" ? record.slug : null,
    tax_id: typeof record.tax_id === "string" ? record.tax_id : null,
    cep: typeof record.cep === "string" ? record.cep : null,
    address: typeof record.address === "string" ? record.address : null,
    address_detail: typeof record.address_detail === "string" ? record.address_detail : null,
    phone: typeof record.phone === "string" ? record.phone : null,
    website: typeof record.website === "string" ? record.website : null,
    logo_url: typeof record.logo_url === "string" ? record.logo_url : null,
    docs_link: typeof record.docs_link === "string" ? record.docs_link : null,
    linkedin_url: typeof record.linkedin_url === "string" ? record.linkedin_url : null,
    qase_project_codes: qaseProjectCodes,
    qase_token: typeof record.qase_token === "string" ? record.qase_token : null,
    has_qase_token: record.has_qase_token === true,
    qase_token_masked: typeof record.qase_token_masked === "string" ? record.qase_token_masked : null,
    qase_validation_status:
      record.qase_validation_status === "empty" ||
      record.qase_validation_status === "pending" ||
      record.qase_validation_status === "saved" ||
      record.qase_validation_status === "active" ||
      record.qase_validation_status === "error" ||
      record.qase_validation_status === "pending_removal"
        ? record.qase_validation_status
        : null,
    qase_is_valid: record.qase_is_valid === true,
    qase_is_active: record.qase_is_active === true,
    qase_validated_at: typeof record.qase_validated_at === "string" ? record.qase_validated_at : null,
    jira_base_url: typeof record.jira_base_url === "string" ? record.jira_base_url : null,
    jira_email: typeof record.jira_email === "string" ? record.jira_email : null,
    jira_api_token: typeof record.jira_api_token === "string" ? record.jira_api_token : null,
    has_jira_api_token: record.has_jira_api_token === true,
    jira_api_token_masked: typeof record.jira_api_token_masked === "string" ? record.jira_api_token_masked : null,
    jira_validation_status:
      record.jira_validation_status === "empty" ||
      record.jira_validation_status === "pending" ||
      record.jira_validation_status === "saved" ||
      record.jira_validation_status === "active" ||
      record.jira_validation_status === "error" ||
      record.jira_validation_status === "pending_removal"
        ? record.jira_validation_status
        : null,
    jira_is_valid: record.jira_is_valid === true,
    jira_is_active: record.jira_is_active === true,
    jira_validated_at: typeof record.jira_validated_at === "string" ? record.jira_validated_at : null,
    jira_account_name: typeof record.jira_account_name === "string" ? record.jira_account_name : null,
    integration_mode: typeof record.integration_mode === "string" ? record.integration_mode : null,
    notifications_fanout_enabled:
      typeof record.notifications_fanout_enabled === "boolean" ? record.notifications_fanout_enabled : true,
    active: typeof record.active === "boolean" ? record.active : true,
    status: typeof record.status === "string" ? record.status : null,
  };
}

type CompanyIntegrationProvider = "manual" | "qase" | "jira";
type CompanyIntegrationState = "empty" | "pending" | "saved" | "active" | "error" | "pending_removal";

function normalizeIntegrationProvider(value?: string | null): CompanyIntegrationProvider {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "qase" || normalized === "jira") return normalized;
  return "manual";
}

function normalizeComparableText(value?: string | null) {
  return (value ?? "").trim();
}

function areStringListsEqual(left: string[] | null | undefined, right: string[] | null | undefined) {
  const normalizedLeft = (left ?? []).map((item) => item.trim().toUpperCase()).filter(Boolean).sort();
  const normalizedRight = (right ?? []).map((item) => item.trim().toUpperCase()).filter(Boolean).sort();
  if (normalizedLeft.length !== normalizedRight.length) return false;
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function resolveIntegrationStateMeta(
  state: CompanyIntegrationState,
  labels?: Partial<Record<CompanyIntegrationState, string>>,
) {
  const defaultLabels: Record<CompanyIntegrationState, string> = {
    empty: "Sem configuração",
    pending: "Pendente",
    saved: "Salvo",
    active: "Ativo",
    error: "Erro",
    pending_removal: "Remoção pendente",
  };
  const label = labels?.[state] ?? defaultLabels[state];

  if (state === "active") return { state, label, tone: "positive" as const };
  if (state === "error") return { state, label, tone: "danger" as const };
  if (state === "pending" || state === "pending_removal") return { state, label, tone: "warning" as const };
  if (state === "saved") return { state, label, tone: "neutral" as const };
  return { state, label, tone: "neutral" as const };
}

function resolveIntegrationActivationCopy(provider: CompanyIntegrationProvider, state: CompanyIntegrationState) {
  const providerLabel = provider === "qase" ? "Qase" : provider === "jira" ? "Jira" : "Integração";

  if (state === "active") {
    return { label: `${providerLabel} ativa`, detail: `${providerLabel} validada e pronta para uso.` };
  }
  if (state === "pending_removal") {
    return { label: `${providerLabel} com remoção pendente`, detail: `${providerLabel} será removida quando você salvar os dados de integração.` };
  }
  if (state === "error") {
    return { label: `${providerLabel} com erro`, detail: `${providerLabel} com erro de válidação.` };
  }
  if (state === "saved") {
    return { label: `${providerLabel} não ativa`, detail: `${providerLabel} configurada, mas ainda não validada.` };
  }
  if (state === "pending") {
    return { label: `${providerLabel} não ativa`, detail: `${providerLabel} em edição. Valide para ativar.` };
  }
  if (provider === "manual") {
    return { label: "Sem integração", detail: "Nenhuma integração externa configurada." };
  }
  return { label: `${providerLabel} não ativa`, detail: `${providerLabel} ainda não configurada.` };
}

function shouldShowIntegrationStatusPill(state: CompanyIntegrationState) {
  return state !== "active";
}

function normalizeCompanyUsers(payload: unknown): CompanyUser[] {
  const record = asRecord(payload);
  const items = Array.isArray(record?.items) ? record.items : [];
  return items.reduce<CompanyUser[]>((acc, item) => {
    const current = asRecord(item);
    if (!current || typeof current.id !== "string" || !current.id.trim()) return acc;
    acc.push({
      id: current.id,
      name: typeof current.name === "string" ? current.name : "Usuário",
      email: typeof current.email === "string" ? current.email : "",
      user: typeof current.user === "string" ? current.user : "",
      permission_role: typeof current.permission_role === "string" ? current.permission_role : "user",
      active: typeof current.active === "boolean" ? current.active : true,
      status: typeof current.status === "string" ? current.status : null,
      avatar_url: typeof current.avatar_url === "string" ? current.avatar_url : null,
      user_origin: typeof current.user_origin === "string" ? current.user_origin : null,
      user_scope: typeof current.user_scope === "string" ? current.user_scope : null,
      allow_multi_company_link:
        typeof current.allow_multi_company_link === "boolean" ? current.allow_multi_company_link : true,
      origin_label: typeof current.origin_label === "string" ? current.origin_label : "Interno TC",
    });
    return acc;
  }, []);
}

function optionalTrimmedString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function formatMetricDate(value?: string | null) {
  if (!value) return "Sem data";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem data";
  return parsed.toLocaleDateString("pt-BR");
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2.5 text-sm text-(--tc-text-primary)">
      <span className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-(--tc-accent) dark:text-[#ff8a8a]">{label}</span>
      {children}
    </label>
  );
}

function FieldHint({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "strong";
}) {
  return (
    <div
      className={
        tone === "strong"
          ? "text-[12px] font-semibold text-(--tc-accent) dark:text-[#ff8a8a]"
          : "text-[12px] font-medium text-(--tc-accent) dark:text-[#ff8a8a]"
      }
    >
      {children}
    </div>
  );
}

function Feedback({
  message,
  tone,
}: {
  message: string | null;
  tone: "error" | "success";
}) {
  if (!message) return null;

  const isError = tone === "error";
  const Icon = isError ? FiAlertCircle : FiCheckCircle;
  const title = isError ? "Erro" : "Sucesso";
  const className = isError
    ? "border-2 border-rose-500 bg-rose-100/95 text-rose-950 shadow-[0_10px_28px_rgba(190,24,93,0.16)] dark:border-rose-300 dark:bg-rose-950/72 dark:text-rose-50"
    : "border-2 border-emerald-500 bg-emerald-100/95 text-emerald-950 shadow-[0_10px_28px_rgba(5,150,105,0.16)] dark:border-emerald-300 dark:bg-emerald-950/72 dark:text-emerald-50";
  const iconWrapClass = isError
    ? "bg-rose-600 text-white dark:bg-rose-400 dark:text-rose-950"
    : "bg-emerald-600 text-white dark:bg-emerald-300 dark:text-emerald-950";

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-[18px] ${className}`}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm ${iconWrapClass}`}>
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] opacity-90">{title}</p>
          <p className="mt-1 text-[14px] font-semibold leading-6">{message}</p>
        </div>
      </div>
    </div>
  );
}

function extractApiError(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) return record.error.trim();
  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.message === "string" && nested.message.trim()) return nested.message.trim();
  }
  if (typeof record.message === "string" && record.message.trim()) return record.message.trim();
  return null;
}

const LOCAL_AVATAR_PREFIX = "/api/s3/object?key=";

function isLocalAvatarUrl(value?: string | null) {
  return typeof value === "string" && value.startsWith(LOCAL_AVATAR_PREFIX);
}

function resolveAvatarSource(value?: string | null): AvatarSource {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return null;
  return isLocalAvatarUrl(normalized) ? "upload" : "url";
}

function isBlobAvatarUrl(value?: string | null) {
  return typeof value === "string" && value.startsWith("blob:");
}

function PanelHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border-b border-(--tc-border) pb-4">
      <h2 className="text-[1.2rem] font-semibold tracking-[-0.02em] text-(--tc-text-primary)">{title}</h2>
      {description ? <p className="mt-1 text-sm font-semibold text-(--tc-accent) dark:text-[#ff8a8a]">{description}</p> : null}
    </div>
  );
}

function PanelSectionTitle({
  title,
  description,
  descriptionClassName,
}: {
  title: string;
  description?: string;
  descriptionClassName?: string;
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-base font-bold text-(--tc-text-primary)">{title}</h3>
      {description ? <p className={descriptionClassName ?? "text-sm font-medium text-[#0b1f52] dark:text-[#d7e5ff]"}>{description}</p> : null}
    </div>
  );
}

function HeroMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/14 bg-white/8 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">{label}</div>
      <div className="mt-2 min-h-10 text-[1.75rem] leading-[1.02] font-extrabold text-white sm:text-[1.95rem]" title={value}>
        {value}
      </div>
      {note ? <div className="mt-1 text-xs font-medium text-white/72">{note}</div> : null}
    </div>
  );
}

const pageShellClass = "tc-page-shell relative z-10 px-2 py-4 sm:px-4 lg:px-6 xl:px-8 2xl:px-10";
const heroClass = "tc-hero-panel";
const surfaceClass = "tc-panel";
const primaryButtonClass = "tc-button-primary";
const secondaryButtonClass = "tc-button-secondary";
const dangerButtonClass = "tc-button-danger";
const integrationSecondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#9fb0d8] bg-[#e7eefc] px-4 text-sm font-semibold text-[#0b1f52] shadow-[0_10px_22px_rgba(11,31,82,0.08)] transition duration-150 hover:border-[#7c92c6] hover:bg-[#d9e4fb] disabled:opacity-60 dark:border-[#36507f] dark:bg-[#13213a] dark:text-[#d7e5ff] dark:hover:bg-[#1a2b48]";
const savedTokenActionClass =
  "w-fit text-left text-xs font-medium text-(--tc-text-muted) underline-offset-2 transition hover:text-rose-700 hover:underline disabled:opacity-60 dark:hover:text-rose-200";
const inputClass =
  "h-14 w-full rounded-xl border border-slate-500 bg-[#f5f7fb] px-4 text-base font-semibold text-[#0b1f52] shadow-[0_3px_10px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.82)] outline-none transition placeholder:text-[#4b6697] hover:border-[#0b1f52] focus:border-(--tc-accent) focus:bg-white focus:ring-2 focus:ring-(--tc-accent)/26 dark:border-slate-400 dark:bg-[#13213a] dark:text-[#d7e5ff] dark:placeholder:text-[#b4cbff] dark:hover:border-[#d7e5ff] dark:focus:border-(--tc-accent) dark:focus:bg-[#182742]";
const selectInputClass =
  "h-14 w-full rounded-xl border border-slate-500 bg-[#f5f7fb] px-4 py-3 text-sm font-semibold text-[#0b1f52] shadow-[0_3px_10px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.82)] outline-none transition placeholder:text-[#4b6697] hover:border-[#0b1f52] focus:border-(--tc-accent) focus:bg-white focus:ring-2 focus:ring-(--tc-accent)/26 dark:border-slate-400 dark:bg-[#13213a] dark:text-[#d7e5ff] dark:hover:border-[#d7e5ff] dark:focus:border-(--tc-accent) dark:focus:bg-[#182742]";
const companyAvatarFrameClass =
  "border border-slate-300 bg-[#f7f9fc] ring-1 ring-white/70 shadow-[0_18px_40px_rgba(15,23,42,0.16)] dark:border-slate-500 dark:bg-[#13213a] dark:ring-white/10";
const companyAvatarImageClass = "object-cover";

type StatusTone = "neutral" | "positive" | "warning" | "danger";

function statusPillClass(tone: StatusTone) {
  if (tone === "positive") return "border-2 border-emerald-500 bg-emerald-100 text-emerald-900 shadow-[0_8px_20px_rgba(5,150,105,0.12)] dark:border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-50";
  if (tone === "danger") return "border-2 border-rose-500 bg-rose-100 text-rose-900 shadow-[0_8px_20px_rgba(225,29,72,0.12)] dark:border-rose-300 dark:bg-rose-950/70 dark:text-rose-50";
  if (tone === "warning") return "border-2 border-amber-500 bg-amber-100 text-amber-900 shadow-[0_8px_20px_rgba(217,119,6,0.12)] dark:border-amber-300 dark:bg-amber-950/70 dark:text-amber-50";
  return "border-2 border-slate-400 bg-slate-100 text-slate-900 shadow-[0_8px_20px_rgba(15,23,42,0.08)] dark:border-slate-300 dark:bg-slate-900/70 dark:text-slate-50";
}

function heroStatusPillClass(tone: StatusTone) {
  if (tone === "positive") return "border-emerald-200/70 bg-emerald-500/28 text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)]";
  if (tone === "danger") return "border-rose-200/70 bg-rose-500/28 text-white shadow-[0_10px_24px_rgba(244,63,94,0.22)]";
  if (tone === "warning") return "border-amber-200/70 bg-amber-500/28 text-white shadow-[0_10px_24px_rgba(245,158,11,0.22)]";
  return "border-white/25 bg-white/16 text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)]";
}

function resolveCompanyStatusMeta(companyProfile: CompanyProfile | null) {
  const normalizedStatus = (companyProfile?.status ?? "").trim().toLowerCase();
  if (normalizedStatus === "suspended") {
    return { label: "Suspensa", tone: "warning" as const };
  }
  if (companyProfile?.active === false || normalizedStatus === "inactive" || normalizedStatus === "archived") {
    return { label: "Inativa", tone: "warning" as const };
  }
  return { label: "Ativa", tone: "positive" as const };
}

function resolveCompanyIntegrationMeta({
  mode,
  hasToken,
  projectCodes,
  hasError,
}: {
  mode?: string | null;
  hasToken: boolean;
  projectCodes: string[];
  hasError: boolean;
}) {
  const normalizedMode = (mode ?? "").trim().toLowerCase();
  const hasProjects = projectCodes.length > 0;

  if (hasError) {
    return { label: "Erro na integração", tone: "danger" as const };
  }
  if (normalizedMode === "manual") {
    return { label: "Manual", tone: "neutral" as const };
  }
  if (!hasToken && !hasProjects) {
    return { label: "Sem integração", tone: "neutral" as const };
  }
  if (hasToken && hasProjects) {
    return { label: "Qase ativa", tone: "positive" as const };
  }
  return { label: "Configuração pendente", tone: "warning" as const };
}

export default function SettingsProfilePage() {
  const { user, loading, refreshUser } = useAuthUser();
  const { t } = useI18n();
  const { theme, language, setTheme, setLanguage, saveSettings, loading: settingsLoading } = useAppSettings();
  const [companies, setCompanies] = useState<LinkedCompany[]>([]);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [companyTaxId, setCompanyTaxId] = useState("");
  const [companyCep, setCompanyCep] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyAddressDetail, setCompanyAddressDetail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyDocsLink, setCompanyDocsLink] = useState("");
  const [companyLinkedinUrl, setCompanyLinkedinUrl] = useState("");
  const [companyNotificationsFanoutEnabled, setCompanyNotificationsFanoutEnabled] = useState(true);
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);
  const [companyLogoPreviewObjectUrl, setCompanyLogoPreviewObjectUrl] = useState<string | null>(null);
  const [companyLogoDirty, setCompanyLogoDirty] = useState(false);
  const [companyQaseToken, setCompanyQaseToken] = useState("");
  const [companyRemoveSavedQaseToken, setCompanyRemoveSavedQaseToken] = useState(false);
  const [companyShowQaseToken, setCompanyShowQaseToken] = useState(false);
  const [companyProjectCodes, setCompanyProjectCodes] = useState<string[]>([]);
  const [companyQaseValidationState, setCompanyQaseValidationState] = useState<CompanyIntegrationState>("empty");
  const [companyJiraBaseUrl, setCompanyJiraBaseUrl] = useState("");
  const [companyJiraEmail, setCompanyJiraEmail] = useState("");
  const [companyJiraApiToken, setCompanyJiraApiToken] = useState("");
  const [companyRemoveSavedJiraToken, setCompanyRemoveSavedJiraToken] = useState(false);
  const [companyShowJiraApiToken, setCompanyShowJiraApiToken] = useState(false);
  const [companyJiraValidationState, setCompanyJiraValidationState] = useState<CompanyIntegrationState>("empty");
  const [companyJiraValidationLoading, setCompanyJiraValidationLoading] = useState(false);
  const [companyJiraValidationMessage, setCompanyJiraValidationMessage] = useState<string | null>(null);
  const [companyJiraAccountName, setCompanyJiraAccountName] = useState<string | null>(null);
  const [companyIntegrationMode, setCompanyIntegrationMode] = useState("manual");
  const [companyIntegrationEditing, setCompanyIntegrationEditing] = useState(false);
  const [companyPendingDisableAll, setCompanyPendingDisableAll] = useState(false);
  const [companyDisableIntegrationsConfirmOpen, setCompanyDisableIntegrationsConfirmOpen] = useState(false);
  const [companySaveConfirmOpen, setCompanySaveConfirmOpen] = useState(false);
  const [companySaveConfirmDescription, setCompanySaveConfirmDescription] = useState<string | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [companySuccess, setCompanySuccess] = useState<string | null>(null);
  const [companyLogoUploading, setCompanyLogoUploading] = useState(false);
  const [companyLogoError, setCompanyLogoError] = useState<string | null>(null);
  const [companyLogoSuccess, setCompanyLogoSuccess] = useState<string | null>(null);
  const [companyUsersError, setCompanyUsersError] = useState<string | null>(null);
  const [companyUserCreateOpen, setCompanyUserCreateOpen] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<"perfil" | "usuários">("perfil");
  const [companyUsersTabActivated, setCompanyUsersTabActivated] = useState(false);
  const [qaseProjects, setQaseProjects] = useState<Array<{ code: string; title: string; status?: "valid" | "invalid" | "unknown" }>>([]);
  const [loadingQaseProjects, setLoadingQaseProjects] = useState(false);
  const [qaseProjectsError, setQaseProjectsError] = useState<string | null>(null);
  const [searchProjects, setSearchProjects] = useState("");
  const [onlyValidProjects, setOnlyValidProjects] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(12);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileFullName, setProfileFullName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileJobTitle, setProfileJobTitle] = useState("");
  const [profileLinkedinUrl, setProfileLinkedinUrl] = useState("");
  const [profileAvatarUrlInput, setProfileAvatarUrlInput] = useState("");
  const [profileUploadedAvatarUrl, setProfileUploadedAvatarUrl] = useState("");
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [profileAvatarSource, setProfileAvatarSource] = useState<AvatarSource>(null);
  const [profileAvatarDirty, setProfileAvatarDirty] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null);
  const [profileSummaryLoading, setProfileSummaryLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [generatingUsername, setGeneratingUsername] = useState(false);
  const [generatedUsernameHistory, setGeneratedUsernameHistory] = useState<string[]>([]);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);
  const [deleteUserSuccess, setDeleteUserSuccess] = useState<string | null>(null);
  const [deleteUserConfirmOpen, setDeleteUserConfirmOpen] = useState(false);
  const [deleteRequestOpen, setDeleteRequestOpen] = useState(false);
  const [deleteRequestReason, setDeleteRequestReason] = useState("");
  const [deleteRequestLoading, setDeleteRequestLoading] = useState(false);
  const [deleteRequestError, setDeleteRequestError] = useState<string | null>(null);
  const [deleteRequestSuccess, setDeleteRequestSuccess] = useState<string | null>(null);
  const [usernameReplacementDialog, setUsernameReplacementDialog] = useState<UsernameReplacementDialogState | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const companyLogoInputRef = useRef<HTMLInputElement | null>(null);
  const jobTitleFieldRef = useRef<HTMLDivElement | null>(null);
  const [jobTitleMenuOpen, setJobTitleMenuOpen] = useState(false);
  const router = useRouter();

  const userRecord = asRecord(user);
  const fullName =
    (typeof userRecord?.fullName === "string" ? userRecord.fullName : "") ||
    (typeof userRecord?.full_name === "string" ? String(userRecord.full_name) : "");
  const name = (typeof userRecord?.name === "string" ? userRecord.name : "") || "";
  const email = (typeof userRecord?.email === "string" ? userRecord.email : "") || "";
  const username =
    (typeof userRecord?.username === "string" ? userRecord.username : "") ||
    (typeof userRecord?.user === "string" ? String(userRecord.user) : "") ||
    email;
  const phone = (typeof userRecord?.phone === "string" ? userRecord.phone : "") || "";
  const jobTitle =
    (typeof userRecord?.jobTitle === "string" ? userRecord.jobTitle : "") ||
    (typeof userRecord?.job_title === "string" ? String(userRecord.job_title) : "") ||
    "";
  const linkedinUrl =
    (typeof userRecord?.linkedinUrl === "string" ? userRecord.linkedinUrl : "") ||
    (typeof userRecord?.linkedin_url === "string" ? String(userRecord.linkedin_url) : "") ||
    "";
  const avatarUrl = (typeof userRecord?.avatarUrl === "string" ? userRecord.avatarUrl : "") || "";
  const active = typeof userRecord?.active === "boolean" ? userRecord.active : true;
  const status = typeof userRecord?.status === "string" ? userRecord.status : null;
  const roleValue =
    (typeof userRecord?.permissionRole === "string" ? userRecord.permissionRole : "") ||
    (typeof userRecord?.role === "string" ? userRecord.role : "") ||
    (typeof userRecord?.companyRole === "string" ? String(userRecord.companyRole) : "");
  const companyContextRoleValue = (() => {
    const companyRole = typeof userRecord?.companyRole === "string" ? String(userRecord.companyRole) : "";
    if (normalizeUiRole(companyRole) === "empresa") return companyRole;
    const directRole = typeof userRecord?.role === "string" ? userRecord.role : "";
    if (normalizeUiRole(directRole) === "empresa") return directRole;
    return "";
  })();
  const currentClientId =
    typeof userRecord?.clientId === "string"
      ? userRecord.clientId
      : typeof userRecord?.clientId === "number"
        ? String(userRecord.clientId)
        : null;
  const currentClientSlug =
    (typeof userRecord?.clientSlug === "string"
      ? userRecord.clientSlug
      : typeof userRecord?.defaultClientSlug === "string"
        ? userRecord.defaultClientSlug
        : typeof userRecord?.default_company_slug === "string"
          ? String(userRecord.default_company_slug)
          : null) ?? null;
  const companyRouteInput = {
    isGlobalAdmin: user?.isGlobalAdmin === true || user?.is_global_admin === true,
    permissionRole: user?.permissionRole ?? null,
    role: user?.role ?? null,
    companyRole: user?.companyRole ?? null,
    userOrigin: user?.userOrigin ?? user?.user_origin ?? null,
    companyCount: Array.isArray(user?.clientSlugs) ? user.clientSlugs.length : 0,
    clientSlug: user?.clientSlug ?? null,
    defaultClientSlug: user?.defaultClientSlug ?? null,
  };
  const currentCompanyHomeHref = currentClientSlug
    ? buildCompanyPathForAccess(currentClientSlug, "home", companyRouteInput)
    : null;
  const homeCompanyId =
    typeof userRecord?.home_company_id === "string"
      ? String(userRecord.home_company_id)
      : typeof userRecord?.homeCompanyId === "string"
        ? String(userRecord.homeCompanyId)
        : null;
  const userOriginValue =
    typeof userRecord?.user_origin === "string"
      ? String(userRecord.user_origin)
      : typeof userRecord?.userOrigin === "string"
        ? String(userRecord.userOrigin)
        : null;
  const userScopeValue =
    typeof userRecord?.user_scope === "string"
      ? String(userRecord.user_scope)
      : typeof userRecord?.userScope === "string"
        ? String(userRecord.userScope)
        : null;
  const normalizedRole = normalizeUiRole(roleValue);
  const isGlobalProfile = normalizedRole === "global";
  const isAdminProfile = normalizedRole === "admin";
  const canDeleteDirectly = isGlobalProfile || isAdminProfile;
  const institutionalCompanyContext = isInstitutionalCompanyAccount(user ?? null);
  const hasCompanyContext = institutionalCompanyContext || isCompanyProfileContext(user ?? null);
  const companyScopeKey = !loading && hasCompanyContext ? currentClientSlug ?? currentClientId ?? homeCompanyId : null;
  const uiRoleLabel = roleLabel(roleValue);
  const userStatusLabel = statusLabel(active, status, t);
  const directDeleteModalTitle = isGlobalProfile ? t("settings.deleteProfile") : t("settings.deleteProfile");
  const directDeleteModalDescription = t("settings.deleteProfileConfirm");

  const uniqueCompanies = useMemo(() => {
    const map = new Map<string, LinkedCompany>();
    for (const company of companies) {
      map.set(company.client_id, company);
    }
    return Array.from(map.values());
  }, [companies]);

  const heroName = profileFullName.trim() || fullName || name || "Usuário";
  const heroUsername = profileUsername.trim() || username || "usuário";
  const userProfileBreadcrumbName = heroName.trim() || username || email || "Usuário";
  const persistedAvatarUrl = avatarUrl.trim();
  const activeAvatarUrl = (() => {
    if (profileAvatarSource === "upload") return profileUploadedAvatarUrl.trim();
    if (profileAvatarSource === "url") return profileAvatarUrlInput.trim();
    return "";
  })();
  const previewAvatarUrl = profileAvatarDirty ? activeAvatarUrl : persistedAvatarUrl;
  const heroAvatarUrl = persistedAvatarUrl;
  const avatarLoadingPlaceholder = loading && !persistedAvatarUrl && !profileAvatarDirty;
  const generatedUsernameHint = useMemo(
    () => suggestUsername(companyName.trim() || profileFullName.trim() || profileEmail.trim() || heroName),
    [companyName, heroName, profileEmail, profileFullName],
  );
  const filteredJobTitleOptions = useMemo(() => {
    const query = normalizeSearchTerm(profileJobTitle);
    return [...JOB_TITLE_OPTIONS]
      .map((option) => ({ option, score: jobTitleMatchScore(option, query) }))
      .filter(({ score }) => (query ? score >= 0 : true))
      .sort((left, right) => right.score - left.score || left.option.localeCompare(right.option, "pt-BR"))
      .map(({ option }) => option);
  }, [profileJobTitle]);
  const persistedUsername = useMemo(
    () => (
      (typeof user?.username === "string" ? user.username : "") ||
      (typeof user?.user === "string" ? user.user : "") ||
      username ||
      ""
    ).trim().toLowerCase(),
    [user?.user, user?.username, username],
  );
  const userPermissions = useMemo(
    () => normalizePermissionMatrix(user?.permissions),
    [user?.permissions],
  );
  const scopePolicy = useMemo(
    () => resolveUserScopePolicy(institutionalCompanyContext ? "company_admin" : companyContextRoleValue || roleValue),
    [companyContextRoleValue, institutionalCompanyContext, roleValue],
  );
  const canManageInstitutionalUsers = hasCompanyContext && institutionalCompanyContext;
  const canViewCompanyUsersTab =
    hasCompanyContext &&
    (
      canManageInstitutionalUsers ||
      (
        canViewCompanyUsersByScope(scopePolicy) &&
        (
          hasPermissionAccess(userPermissions, "users", "view") ||
          hasPermissionAccess(userPermissions, "users", "view_company") ||
          hasPermissionAccess(userPermissions, "users", "view_all") ||
          hasPermissionAccess(userPermissions, "users", "create")
        )
      )
    );
  const canCreateCompanyUsers =
    canViewCompanyUsersTab &&
    (
      canManageInstitutionalUsers ||
      (
        canCreateCompanyUsersByScope(scopePolicy) &&
        hasPermissionAccess(userPermissions, "users", "create")
      )
    );
  const canOpenCompanyHomeFromUserProfile =
    Boolean(currentClientSlug) &&
    !institutionalCompanyContext &&
    (
      scopePolicy.roleKey === "empresa" ||
      userOriginValue === "client_company" ||
      userScopeValue === "company_only"
    );
  const openDefectsMetricValue =
    profileSummaryLoading && !profileSummary ? "--" : String(profileSummary?.openDefectsCount ?? 0);
  const notesCreatedMetricValue =
    profileSummaryLoading && !profileSummary ? "--" : String(profileSummary?.notesCreatedCount ?? 0);
  const createdAtMetricValue =
    profileSummaryLoading && !profileSummary ? "--" : formatMetricDate(profileSummary?.createdAt ?? null);
  const linkedCompaniesMetricValue =
    profileSummaryLoading && !profileSummary
      ? "--"
      : String(profileSummary?.linkedCompaniesCount ?? uniqueCompanies.length);
  const shouldFetchCompanyUsers =
    canViewCompanyUsersTab && (companyUsersTabActivated || activeProfileTab === "usuários");

  const { companies: swrCompanies, error: swrCompaniesError, refetch: refetchCompanies } = useSWRCompanies(hasCompanyContext);
  const {
    companyProfile: swrCompanyProfile,
    loading: swrCompanyProfileLoading,
    error: swrCompanyProfileError,
    refetch: refetchCompanyProfile,
  } = useSWRCompanyProfile(hasCompanyContext, companyScopeKey);
  const {
    companyUsers: swrCompanyUsers,
    loading: swrCompanyUsersLoading,
    error: swrCompanyUsersFetchError,
    refetch: refetchCompanyUsers,
  } = useSWRCompanyUsers(shouldFetchCompanyUsers, companyScopeKey);
  const companyDisplayName = (companyProfile?.company_name || companyProfile?.name || "Empresa").trim();
  const companyProfileBreadcrumbName = companyDisplayName || currentClientSlug || "Empresa";
  const companySavedLogoUrl = companyProfile?.logo_url || null;
  const companyLogoPreviewUrl = companyLogoPreviewObjectUrl || companyLogoUrl.trim() || companySavedLogoUrl;
  const companySavedQaseProjectCodes = Array.isArray(companyProfile?.qase_project_codes) ? companyProfile.qase_project_codes : [];
  const companyHasSavedQaseToken = companyProfile?.has_qase_token === true;
  const companyHasSavedQaseConfig = companyHasSavedQaseToken || companySavedQaseProjectCodes.length > 0;
  const companyHasSavedActiveQaseIntegration = companyProfile?.qase_is_valid === true && companyProfile?.qase_is_active === true;
  const companyHasEffectiveQaseToken = (companyQaseToken.trim().length > 0) || (companyHasSavedQaseToken && !companyRemoveSavedQaseToken);
  const companyHasSavedJiraToken = companyProfile?.has_jira_api_token === true;
  const companySavedJiraBaseUrl = normalizeComparableText(companyProfile?.jira_base_url);
  const companySavedJiraEmail = normalizeComparableText(companyProfile?.jira_email);
  const companyHasSavedJiraConfig = Boolean(companySavedJiraBaseUrl || companySavedJiraEmail || companyHasSavedJiraToken);
  const companyHasSavedActiveJiraIntegration = companyProfile?.jira_is_valid === true && companyProfile?.jira_is_active === true;
  const companyHasEffectiveJiraToken = (companyJiraApiToken.trim().length > 0) || (companyHasSavedJiraToken && !companyRemoveSavedJiraToken);
  const normalizedCompanyIntegrationMode = normalizeIntegrationProvider(companyIntegrationMode);
  const qaseProjectsDirty = !areStringListsEqual(companyProjectCodes, companySavedQaseProjectCodes);
  const jiraConfigDirty =
    normalizeComparableText(companyJiraBaseUrl) !== companySavedJiraBaseUrl ||
    normalizeComparableText(companyJiraEmail) !== companySavedJiraEmail ||
    companyJiraApiToken.trim().length > 0 ||
    companyRemoveSavedJiraToken;
  const companyHasUnsavedQaseChanges = companyQaseToken.trim().length > 0 || companyRemoveSavedQaseToken || qaseProjectsDirty;
  const companyHasUnsavedJiraChanges = jiraConfigDirty;
  const companyHasSavedIntegrations = companyHasSavedQaseConfig || companyHasSavedJiraConfig;
  const companyVisibleSavedIntegrationCount =
    Number(companyHasSavedActiveQaseIntegration) + Number(companyHasSavedActiveJiraIntegration);
  const companyHasAnyIntegrationDraft =
    companyHasUnsavedQaseChanges ||
    companyHasUnsavedJiraChanges ||
    normalizeComparableText(companyJiraBaseUrl).length > 0 ||
    normalizeComparableText(companyJiraEmail).length > 0 ||
    companyQaseToken.trim().length > 0 ||
    companyJiraApiToken.trim().length > 0;
  const companyShouldPromptDisableAll = companyHasSavedIntegrations || companyHasAnyIntegrationDraft;
  const companyHasUnsavedIntegrationChanges =
    companyPendingDisableAll || companyHasUnsavedQaseChanges || companyHasUnsavedJiraChanges;
  const companyIntegrationEditorOpen = companyIntegrationEditing || companyHasUnsavedIntegrationChanges;
  const companyStatusMeta = resolveCompanyStatusMeta(companyProfile);
  const companyQaseDraftIsActive =
    companyPendingDisableAll
      ? false
      : companyHasUnsavedQaseChanges
        ? companyQaseValidationState === "active" && companyHasEffectiveQaseToken && companyProjectCodes.length > 0
        : companyHasSavedActiveQaseIntegration;
  const companyJiraDraftIsActive =
    companyPendingDisableAll
      ? false
      : companyHasUnsavedJiraChanges
        ? companyJiraValidationState === "active" &&
          Boolean(normalizeComparableText(companyJiraBaseUrl) && normalizeComparableText(companyJiraEmail) && companyHasEffectiveJiraToken)
        : companyHasSavedActiveJiraIntegration;

  const qaseSavedIntegrationState: CompanyIntegrationState = (() => {
    if (companyHasSavedActiveQaseIntegration) return "active";
    if (companyProfile?.qase_validation_status === "error") return "error";
    if (companyHasSavedQaseConfig) return "saved";
    return "empty";
  })();
  const qaseSavedIntegrationMeta = resolveIntegrationStateMeta(qaseSavedIntegrationState, {
    empty: "Sem Qase",
    saved: "Qase salva",
    active: "Qase ativa",
    error: "Qase invalida",
  });

  const qaseIntegrationState: CompanyIntegrationState = (() => {
    if (companyPendingDisableAll) return "pending_removal";
    if (qaseProjectsError || companyQaseValidationState === "error") return "error";
    if (companyHasUnsavedQaseChanges) {
      if (companyQaseDraftIsActive) return "active";
      return "pending";
    }
    if (companyHasSavedActiveQaseIntegration) return "active";
    if (companyHasEffectiveQaseToken || companyProjectCodes.length > 0) return "saved";
    return "empty";
  })();
  const qaseIntegrationMeta = resolveIntegrationStateMeta(qaseIntegrationState, {
    empty: "Sem Qase",
    pending: "Qase pendente",
    saved: "Qase salva",
    active: "Qase ativa",
    error: "Erro na Qase",
    pending_removal: "Remoção pendente",
  });

  const jiraSavedIntegrationState: CompanyIntegrationState = (() => {
    if (companyHasSavedActiveJiraIntegration) return "active";
    if (companyProfile?.jira_validation_status === "error") return "error";
    if (companyHasSavedJiraConfig) return "saved";
    return "empty";
  })();
  const jiraSavedIntegrationMeta = resolveIntegrationStateMeta(jiraSavedIntegrationState, {
    empty: "Sem Jira",
    saved: "Jira salvo",
    active: "Jira ativa",
    error: "Jira invalido",
  });

  const jiraIntegrationState: CompanyIntegrationState = (() => {
    if (companyPendingDisableAll) return "pending_removal";
    if (companyJiraValidationState === "error") return "error";
    if (jiraConfigDirty) {
      if (companyJiraDraftIsActive) return "active";
      return "pending";
    }
    if (companyHasSavedActiveJiraIntegration) return "active";
    if (normalizeComparableText(companyJiraBaseUrl) || normalizeComparableText(companyJiraEmail) || companyHasEffectiveJiraToken) return "saved";
    if (companyHasSavedJiraConfig) return "saved";
    return "empty";
  })();
  const jiraIntegrationMeta = resolveIntegrationStateMeta(jiraIntegrationState, {
    empty: "Sem Jira",
    pending: "Jira pendente",
    saved: "Jira salvo",
    active: "Jira ativa",
    error: "Erro no Jira",
    pending_removal: "Remoção pendente",
  });

  const companyRestIntegrationMeta = (() => {
    if (companyVisibleSavedIntegrationCount > 1) {
      return {
        state: "active" as const,
        label: `${companyVisibleSavedIntegrationCount} integrações ativas`,
        tone: "positive" as const,
      };
    }
    if (companyHasSavedActiveQaseIntegration) return qaseSavedIntegrationMeta;
    if (companyHasSavedActiveJiraIntegration) return jiraSavedIntegrationMeta;
    return resolveIntegrationStateMeta("empty", { empty: "Sem integração" });
  })();

  const companyEditingIntegrationMeta = (() => {
    if (companyPendingDisableAll) {
      return resolveIntegrationStateMeta("pending_removal", { pending_removal: "Remoção pendente" });
    }
    if (normalizedCompanyIntegrationMode === "qase") return qaseIntegrationMeta;
    if (normalizedCompanyIntegrationMode === "jira") return jiraIntegrationMeta;
    return companyRestIntegrationMeta;
  })();
  const companyFocusedSavedIntegrationStillActive =
    !companyPendingDisableAll &&
    (
      (normalizedCompanyIntegrationMode === "qase" && companyHasSavedActiveQaseIntegration && !companyRemoveSavedQaseToken) ||
      (normalizedCompanyIntegrationMode === "jira" && companyHasSavedActiveJiraIntegration && !companyRemoveSavedJiraToken)
    );
  const companyEditingDisplayIntegrationMeta =
    normalizedCompanyIntegrationMode === "qase" && companyFocusedSavedIntegrationStillActive
      ? qaseSavedIntegrationMeta
      : normalizedCompanyIntegrationMode === "jira" && companyFocusedSavedIntegrationStillActive
        ? jiraSavedIntegrationMeta
        : companyEditingIntegrationMeta;
  const companyIntegrationMeta = companyIntegrationEditorOpen ? companyEditingDisplayIntegrationMeta : companyRestIntegrationMeta;
  const companyEditingIntegrationActivation = resolveIntegrationActivationCopy(
    normalizedCompanyIntegrationMode,
    companyEditingDisplayIntegrationMeta.state,
  );
  const companyEditingSavedIntegrationProtected =
    companyFocusedSavedIntegrationStillActive &&
    (
      (normalizedCompanyIntegrationMode === "qase" && companyHasUnsavedQaseChanges) ||
      (normalizedCompanyIntegrationMode === "jira" && companyHasUnsavedJiraChanges)
    );
  const companyEditingIntegrationDetail =
    companyEditingSavedIntegrationProtected
      ? "A integração salva continua ativa até ser removida ou trocada."
      : companyEditingIntegrationActivation.detail;
  const companyIntegrationSaveBlockedMessage = `Status atual: ${companyEditingIntegrationActivation.label}. ${companyEditingIntegrationDetail} ${
    companyEditingSavedIntegrationProtected
      ? "Valide as alterações para substituir a integração atual ou cancele as alterações para voltar ao ultimo estado salvo."
      : "Valide a integração para ativar ou cancele as alterações para voltar ao ultimo estado salvo."
  }`;
  const companyStatusText = companyStatusMeta.label;
  const companyIntegrationText = companyIntegrationEditorOpen ? companyEditingIntegrationActivation.label : companyIntegrationMeta.label;
  const integrationSummaryCards = [
    {
      provider: "qase" as const,
      title: "Qase",
      meta: qaseSavedIntegrationMeta,
      visible: companyHasSavedActiveQaseIntegration,
    },
    {
      provider: "jira" as const,
      title: "Jira",
      meta: jiraSavedIntegrationMeta,
      visible: companyHasSavedActiveJiraIntegration,
    },
  ].filter((item) => item.visible);
  const companyActiveUsersCount = companyUsers.filter(
    (companyUser) => companyUser.active !== false && companyUser.status !== "inactive" && companyUser.status !== "blocked",
  ).length;
  const companyUsersMetricValue = !canViewCompanyUsersTab
    ? "Restrito"
    : !companyUsersTabActivated && companyUsers.length === 0
      ? "Sob demanda"
    : swrCompanyUsersLoading && companyUsers.length === 0
      ? "--"
      : String(companyUsers.length);
  const companyProjectsMetricValue =
    swrCompanyProfileLoading && !companyProfile ? "--" : String(companyProjectCodes.length);
  const companyStatusMetricValue =
    swrCompanyProfileLoading && !companyProfile ? "--" : companyStatusText;
  const companyIntegrationMetricValue =
    swrCompanyProfileLoading && !companyProfile ? "--" : companyIntegrationText;
  const companyDataFieldsDirty =
    normalizeComparableText(companyName) !== normalizeComparableText(companyProfile?.company_name ?? companyProfile?.name) ||
    normalizeComparableText(companyTaxId) !== normalizeComparableText(companyProfile?.tax_id) ||
    normalizeComparableText(companyCep) !== normalizeComparableText(companyProfile?.cep) ||
    normalizeComparableText(companyAddress) !== normalizeComparableText(companyProfile?.address) ||
    normalizeComparableText(companyAddressDetail) !== normalizeComparableText(companyProfile?.address_detail) ||
    normalizeComparableText(companyPhone) !== normalizeComparableText(companyProfile?.phone) ||
    normalizeComparableText(companyWebsite) !== normalizeComparableText(companyProfile?.website) ||
    normalizeComparableText(companyDocsLink) !== normalizeComparableText(companyProfile?.docs_link) ||
    normalizeComparableText(companyLinkedinUrl) !== normalizeComparableText(companyProfile?.linkedin_url) ||
    companyNotificationsFanoutEnabled !== (companyProfile?.notifications_fanout_enabled ?? true);
  const companyLogoValueDirty =
    normalizeComparableText(companyLogoUrl) !== normalizeComparableText(companySavedLogoUrl) || Boolean(companyLogoFile);
  const companyLogoHasChanges = companyLogoDirty || companyLogoValueDirty;
  const companyDetailsHasChanges = companyDataFieldsDirty || companyLogoHasChanges;
  const companyUsernameHasChanges =
    normalizeComparableText(profileUsername.trim().toLowerCase()) !== normalizeComparableText(persistedUsername);
  const companyProfileSaveHasChanges = companyDetailsHasChanges || companyUsernameHasChanges;
  const companyIntegrationHasChanges = companyHasUnsavedIntegrationChanges;
  const companyIntegrationSaveBlocked =
    companyPendingDisableAll
      ? false
      : (normalizedCompanyIntegrationMode === "qase" && companyHasUnsavedQaseChanges && !companyQaseDraftIsActive) ||
        (normalizedCompanyIntegrationMode === "jira" && companyHasUnsavedJiraChanges && !companyJiraDraftIsActive);
  const companyUsersMetricNote = !canViewCompanyUsersTab
    ? "Liberado por permissão"
    : !companyUsersTabActivated && companyUsers.length === 0
      ? "Carrega ao abrir Usuários"
    : swrCompanyUsersLoading && companyUsers.length === 0
      ? "Perfis cadastrados"
      : `${companyActiveUsersCount} ativos`;
  const companyContextLoading = hasCompanyContext && loading && !companyScopeKey;
  const filteredQaseProjects = qaseProjects.filter((project) => {
    const query = searchProjects.trim().toLowerCase();
    if (onlyValidProjects && project.status !== "valid") return false;
    if (!query) return true;
    return project.code.toLowerCase().includes(query) || project.title.toLowerCase().includes(query);
  });
  useEffect(() => {
    if (swrCompanies) setCompanies(normalizeCompanies(swrCompanies));
    if (swrCompaniesError) setCompaniesError(swrCompaniesError.message || String(swrCompaniesError));
  }, [swrCompanies, swrCompaniesError]);

  const { profileSummary: swrProfileSummary, loading: swrProfileSummaryLoading, error: swrProfileSummaryError } = useSWRProfileSummary(user?.id);
  useEffect(() => {
    if (swrProfileSummary) setProfileSummary(normalizeProfileSummary(swrProfileSummary));
    if (swrProfileSummaryError) setProfileSummary(null);
    setProfileSummaryLoading(swrProfileSummaryLoading);
  }, [swrProfileSummary, swrProfileSummaryError, swrProfileSummaryLoading]);

  useEffect(() => {
    if (activeProfileTab === "usuários" && !companyUsersTabActivated) {
      setCompanyUsersTabActivated(true);
    }
  }, [activeProfileTab, companyUsersTabActivated]);

  useEffect(() => {
    if (swrCompanyProfile) {
      const normalized = normalizeCompanyProfile(swrCompanyProfile);
      if (normalized) {
        setCompanyProfile(normalized);
        setCompanyError(null);
        setQaseProjectsError(null);
      }
    }
    if (swrCompanyProfileError) {
      setCompanyError(swrCompanyProfileError.message || String(swrCompanyProfileError));
    }
  }, [swrCompanyProfile, swrCompanyProfileError]);

  useEffect(() => {
    if (!companyScopeKey) return;
    setActiveProfileTab("perfil");
    setCompanyUsersTabActivated(false);
    setCompanyUsers([]);
    setCompanyUsersError(null);
    setCompanyError(null);
    setCompanySuccess(null);
    setCompanyLogoError(null);
    setCompanyLogoSuccess(null);
    setQaseProjectsError(null);
    setCompanyUserCreateOpen(false);
    setCompanyLogoDirty(false);
    setCompanyLogoFile(null);
    setCompanyQaseToken("");
    setCompanyRemoveSavedQaseToken(false);
    setCompanyShowQaseToken(false);
    setCompanyQaseValidationState("empty");
    setCompanyJiraBaseUrl("");
    setCompanyJiraEmail("");
    setCompanyJiraApiToken("");
    setCompanyRemoveSavedJiraToken(false);
    setCompanyShowJiraApiToken(false);
    setCompanyJiraValidationState("empty");
    setCompanyJiraValidationLoading(false);
    setCompanyJiraValidationMessage(null);
    setCompanyJiraAccountName(null);
    setCompanyDisableIntegrationsConfirmOpen(false);
    setCompanySaveConfirmOpen(false);
    setCompanySaveConfirmDescription(null);
    setCompanyLogoPreviewObjectUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }, [companyScopeKey]);

  useEffect(() => {
    if (!companyProfile) return;
    if (!companyDataFieldsDirty) {
      setCompanyName((companyProfile.company_name ?? companyProfile.name ?? "").trim());
      setCompanyTaxId(companyProfile.tax_id ?? "");
      setCompanyCep(companyProfile.cep ?? "");
      setCompanyAddress(companyProfile.address ?? "");
      setCompanyAddressDetail(companyProfile.address_detail ?? "");
      setCompanyPhone(companyProfile.phone ?? "");
      setCompanyWebsite(companyProfile.website ?? "");
      setCompanyDocsLink(companyProfile.docs_link ?? "");
      setCompanyLinkedinUrl(companyProfile.linkedin_url ?? "");
      setCompanyNotificationsFanoutEnabled(companyProfile.notifications_fanout_enabled ?? true);
    }
    if (!companyLogoHasChanges) {
      setCompanyLogoUrl(companyProfile.logo_url ?? "");
    }
    if (!companyHasUnsavedIntegrationChanges) {
      restoreCompanyIntegrationFromSaved(companyProfile);
    }
  }, [companyDataFieldsDirty, companyHasUnsavedIntegrationChanges, companyLogoHasChanges, companyProfile]);

  useEffect(() => {
    return () => {
      if (companyLogoPreviewObjectUrl) {
        URL.revokeObjectURL(companyLogoPreviewObjectUrl);
      }
    };
  }, [companyLogoPreviewObjectUrl]);

  useEffect(() => {
    if (swrCompanyUsers) {
      setCompanyUsers(normalizeCompanyUsers(swrCompanyUsers));
      setCompanyUsersError(null);
    }
    if (swrCompanyUsersFetchError) {
      setCompanyUsersError(swrCompanyUsersFetchError.message || String(swrCompanyUsersFetchError));
    }
  }, [swrCompanyUsers, swrCompanyUsersFetchError]);

  useEffect(() => {
    setProfileFullName(fullName || "");
    setProfileUsername(username || "");
    setProfileEmail(email || "");
    setProfilePhone(phone || "");
    setProfileJobTitle(jobTitle || "");
    setProfileLinkedinUrl(linkedinUrl || "");
    const nextAvatarUrl = avatarUrl || "";
    const nextSource = resolveAvatarSource(nextAvatarUrl);
    setProfileAvatarFile(null);
    setProfileAvatarDirty(false);
    setGeneratedUsernameHistory([]);
    setProfileAvatarSource(nextSource);
    setProfileUploadedAvatarUrl(nextSource === "upload" ? nextAvatarUrl : "");
    setProfileAvatarUrlInput(nextSource === "url" ? nextAvatarUrl : "");
  }, [avatarUrl, email, fullName, jobTitle, linkedinUrl, phone, username]);

  useEffect(() => {
    if (!jobTitleMenuOpen) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (!jobTitleFieldRef.current?.contains(event.target as Node)) {
        setJobTitleMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [jobTitleMenuOpen]);

  useEffect(() => {
    return () => {
      if (isBlobAvatarUrl(profileUploadedAvatarUrl)) {
        URL.revokeObjectURL(profileUploadedAvatarUrl);
      }
    };
  }, [profileUploadedAvatarUrl]);

  async function fetchUniqueUsernameCandidate() {
    const seed = companyName.trim() || profileFullName.trim() || profileEmail.trim() || heroName;
    const avoid = Array.from(
      new Set(
        [persistedUsername, profileUsername.trim().toLowerCase(), ...generatedUsernameHistory]
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    setGeneratingUsername(true);
    try {
      const response = await fetchApi("/api/me/username-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed, avoid }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setProfileError(extractApiError(payload) || "Não foi possível gerar um novo login.");
        return null;
      }
      const generated =
        payload && typeof payload === "object" && typeof (payload as { username?: unknown }).username === "string"
          ? ((payload as { username?: string }).username ?? "").trim().toLowerCase()
          : "";
      if (!generated) {
        setProfileError("Não foi possível gerar um novo login.");
        return null;
      }
      setGeneratedUsernameHistory((current) => (current.includes(generated) ? current : [...current, generated]));
      return generated;
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Não foi possível gerar um novo login.");
      return null;
    } finally {
      setGeneratingUsername(false);
    }
  }

  async function requestGeneratedUsername() {
    setProfileError(null);
    const generated = await fetchUniqueUsernameCandidate();
    if (!generated) return;
    const currentEffectiveUsername = profileUsername.trim().toLowerCase() || persistedUsername;

    if (currentEffectiveUsername && generated && currentEffectiveUsername !== generated) {
      setUsernameReplacementDialog({
        mode: "generate",
        currentUsername: currentEffectiveUsername,
        nextUsername: generated,
      });
      return;
    }

    setProfileUsername(generated);
  }

  async function submitProfileChanges(options?: { allowGeneratedReplacement?: boolean; forcedGeneratedUsername?: string }) {
    setProfileError(null);
    setProfileSuccess(null);

    const nextFullName = (profileFullName.trim() || fullName || name || username || "Conta").trim();
    const typedUsername = profileUsername.trim().toLowerCase();
    const nextUsername = (options?.forcedGeneratedUsername ?? typedUsername).trim().toLowerCase();
    const nextEmail = profileEmail.trim();
    const nextPhone = profilePhone.trim();
    const nextJobTitle = profileJobTitle.trim();
    const nextLinkedinUrl = profileLinkedinUrl.trim();
    let nextAvatarUrl = activeAvatarUrl.trim();

    if (!nextEmail) {
      setProfileError("Informe o e-mail do usuário.");
      return false;
    }
    if (!options?.allowGeneratedReplacement && !nextUsername && persistedUsername) {
      const generatedUsername = await fetchUniqueUsernameCandidate();
      if (!generatedUsername) return false;
      setUsernameReplacementDialog({
        mode: "submit",
        currentUsername: persistedUsername,
        nextUsername: generatedUsername,
      });
      return false;
    }

    setProfileLoading(true);
    try {
      setUsernameReplacementDialog(null);
      let resolvedUsernameAfterSave = nextUsername;
      if (profileAvatarSource === "upload" && profileAvatarFile) {
        setAvatarUploading(true);

        const form = new FormData();
        form.append("file", profileAvatarFile);

        const avatarResponse = await fetch("/api/me/avatar", {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const avatarPayload = await avatarResponse.json().catch(() => ({}));

        if (!avatarResponse.ok) {
          setProfileError(extractApiError(avatarPayload) || "Não foi possível enviar a foto.");
          return false;
        }

        nextAvatarUrl =
          avatarPayload && typeof avatarPayload === "object" && typeof (avatarPayload as { avatarUrl?: unknown }).avatarUrl === "string"
            ? ((avatarPayload as { avatarUrl?: string }).avatarUrl ?? "").trim()
            : "";

        setProfileUploadedAvatarUrl(nextAvatarUrl);
        setProfileAvatarFile(null);
        setProfileAvatarDirty(false);
      }

      const response = await fetchApi("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: nextFullName,
          name: nextFullName,
          user: nextUsername,
          email: nextEmail,
          phone: nextPhone,
          job_title: nextJobTitle || null,
          linkedin_url: nextLinkedinUrl || null,
          avatar_url: nextAvatarUrl || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setProfileError(extractApiError(payload) || `Não foi possível atualizar os dados (${response.status}).`);
        return false;
      }

      if (payload && typeof payload === "object" && "user" in payload) {
        const updatedUser = (payload as { user?: Record<string, unknown> | null }).user ?? null;
        if (updatedUser) {
          const resolvedUsername =
            (typeof updatedUser.username === "string" ? updatedUser.username : "") ||
            (typeof updatedUser.user === "string" ? updatedUser.user : "");
          if (resolvedUsername) {
            resolvedUsernameAfterSave = resolvedUsername;
            setProfileUsername(resolvedUsername);
          }
        }
      }

      const settingsResult = await saveSettings({ theme, language });
      if (!settingsResult.ok) {
        setProfileError(t("settings.savePreferencesError"));
        return false;
      }

      await refreshUser();
      setProfileAvatarDirty(false);
      const generatedOnSave = !typedUsername && !!resolvedUsernameAfterSave;
      setProfileSuccess(
        generatedOnSave
          ? t("settings.profileSavedGenerated", { username: resolvedUsernameAfterSave })
          : t("settings.profileSaved"),
      );
      return true;
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Não foi possível atualizar os dados.");
      return false;
    } finally {
      setAvatarUploading(false);
      setProfileLoading(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitProfileChanges();
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword.trim() || !newPassword.trim()) {
      setPasswordError("Informe a senha atual e a nova senha.");
      return;
    }
    if (newPassword.trim().length < 8) {
      setPasswordError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("As novas senhas não conferem.");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError("A nova senha deve ser diferente da atual.");
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await fetchApi("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPasswordError(extractApiError(payload) || `Não foi possível atualizar a senha (${response.status}).`);
        return;
      }

      setPasswordSuccess("Senha atualizada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Não foi possível atualizar a senha.");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleDeleteUser() {
    setDeleteUserError(null);
    setDeleteUserSuccess(null);

    setDeleteUserLoading(true);
    try {
      const response = await fetchApi("/api/me", {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setDeleteUserError(typeof payload?.error === "string" ? payload.error : "Erro ao deletar usuário.");
        return;
      }

      setDeleteUserSuccess("Usuário deletado com sucesso. Redirecionando...");
      publishAuthUser(null);
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      }).catch(() => null);
      window.setTimeout(() => {
        window.location.href = "/login";
      }, 1800);
    } catch (error) {
      setDeleteUserError(error instanceof Error ? error.message : "Erro ao deletar usuário.");
    } finally {
      setDeleteUserLoading(false);
    }
  }

  async function handleProfileDeletionRequest() {
    setDeleteRequestError(null);
    setDeleteRequestSuccess(null);

    const reason = deleteRequestReason.trim();
    if (!reason) {
      setDeleteRequestError("Descreva o motivo da exclusão do perfil.");
      return;
    }

    setDeleteRequestLoading(true);
    try {
      const response = await fetchApi("/api/requests/profile-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDeleteRequestError(extractApiError(payload) || "Não foi possível enviar a solicitação.");
        return;
      }

      setDeleteRequestSuccess("Solicitação enviada para análise.");
      setDeleteRequestOpen(false);
      setDeleteRequestReason("");
    } catch (error) {
      setDeleteRequestError(error instanceof Error ? error.message : "Não foi possível enviar a solicitação.");
    } finally {
      setDeleteRequestLoading(false);
    }
  }

  async function handleAvatarUpload(file?: File) {
    if (!file) return;

    setProfileError(null);
    setProfileSuccess(null);
    const previewUrl = URL.createObjectURL(file);
    setProfileAvatarFile(file);
    setProfileAvatarSource("upload");
    setProfileUploadedAvatarUrl(previewUrl);
    setProfileAvatarUrlInput("");
    setProfileAvatarDirty(true);
    setProfileSuccess("Foto pronta para salvar.");

    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  }

  async function handleCompanyLogoUpload(file?: File) {
    if (!file) return;
    setCompanyLogoError(null);
    setCompanyLogoSuccess(null);
    setCompanyLogoDirty(true);
    setCompanyLogoFile(file);
    setCompanyLogoUrl("");

    if (companyLogoPreviewObjectUrl) {
      URL.revokeObjectURL(companyLogoPreviewObjectUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setCompanyLogoPreviewObjectUrl(previewUrl);
    setCompanyLogoSuccess("Preview da logo pronto. Use o botao Salvar para aplicar no restante do sistema.");

    if (companyLogoInputRef.current) {
      companyLogoInputRef.current.value = "";
    }
  }

  async function handleFetchCompanyQaseProjects() {
    const token = companyQaseToken.trim();
    if (!token && !companyHasEffectiveQaseToken) {
      setQaseProjectsError("Informe o token da Qase antes de buscar os projetos.");
      setCompanyQaseValidationState("error");
      return;
    }

    setLoadingQaseProjects(true);
    setQaseProjectsError(null);
    try {
      const response = await fetchApi("/api/me/company-profile/qase-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token || undefined,
          all: true,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error((payload && extractApiError(payload)) || "Erro ao buscar projetos");
      }

      const items: Array<{ code: string; title: string; status: "valid" }> = Array.isArray(payload?.items)
        ? (payload.items as unknown[])
            .map((item: unknown) => {
              const current = asRecord(item);
              if (!current) return null;
              const code = typeof current.code === "string" ? current.code.trim().toUpperCase() : "";
              if (!code) return null;
              return {
                code,
                title: typeof current.title === "string" && current.title.trim() ? current.title.trim() : code,
                status: "valid" as const,
              };
            })
            .filter((item): item is { code: string; title: string; status: "valid" } => Boolean(item))
        : [];

      setQaseProjects(items);
      const preserved = companyProjectCodes.filter((code) => items.some((item) => item.code === code));
      setCompanyProjectCodes(preserved.length ? preserved : items.length === 1 ? [items[0].code] : companyProjectCodes);
      setCompanyQaseValidationState(items.length > 0 ? "active" : "saved");
    } catch (error) {
      setQaseProjects([]);
      setQaseProjectsError(error instanceof Error ? error.message : "Erro ao buscar projetos");
      setCompanyQaseValidationState("error");
    } finally {
      setLoadingQaseProjects(false);
    }
  }

  async function handleValidateCompanyJira() {
    const hasEffectiveToken = companyJiraApiToken.trim() || (companyHasSavedJiraToken && !companyRemoveSavedJiraToken);
    if (!normalizeComparableText(companyJiraBaseUrl) || !normalizeComparableText(companyJiraEmail) || !hasEffectiveToken) {
      setCompanyJiraValidationMessage("Informe URL base, e-mail técnico e API token do Jira antes de validar.");
      setCompanyJiraValidationState("error");
      return;
    }

    setCompanyJiraValidationLoading(true);
    setCompanyJiraValidationMessage(null);
    try {
      const response = await fetchApi("/api/me/company-profile/jira-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: optionalTrimmedString(companyJiraBaseUrl),
          email: optionalTrimmedString(companyJiraEmail),
          token: optionalTrimmedString(companyJiraApiToken),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error((payload && extractApiError(payload)) || "Não foi possível validar o Jira.");
      }

      const accountName = payload && typeof payload.accountName === "string" ? payload.accountName : null;
      setCompanyJiraAccountName(accountName);
      setCompanyJiraValidationMessage(accountName ? `Conexão válida com a conta ${accountName}.` : "Conexão válida com o Jira Cloud.");
      setCompanyJiraValidationState("active");
    } catch (error) {
      setCompanyJiraValidationMessage(error instanceof Error ? error.message : "Não foi possível validar o Jira.");
      setCompanyJiraValidationState("error");
    } finally {
      setCompanyJiraValidationLoading(false);
    }
  }

  async function handleCompanyUserCreated() {
    try {
      await refetchCompanyUsers();
      setCompanyUsersError(null);
    } catch (error) {
      setCompanyUsersError(error instanceof Error ? error.message : "Não foi possível atualizar os usuários da empresa.");
    }
  }

  function restoreCompanyIntegrationFromSaved(savedProfile?: CompanyProfile | null) {
    const source = savedProfile ?? companyProfile;
    setCompanyQaseToken("");
    setCompanyRemoveSavedQaseToken(false);
    setCompanyShowQaseToken(false);
    setCompanyProjectCodes(Array.isArray(source?.qase_project_codes) ? source.qase_project_codes : []);
    setCompanyQaseValidationState(source?.qase_is_valid === true && source?.qase_is_active === true ? "active" : source?.qase_validation_status ?? "empty");
    setCompanyJiraBaseUrl(source?.jira_base_url ?? "");
    setCompanyJiraEmail(source?.jira_email ?? "");
    setCompanyJiraApiToken("");
    setCompanyRemoveSavedJiraToken(false);
    setCompanyShowJiraApiToken(false);
    setCompanyJiraValidationState(source?.jira_is_valid === true && source?.jira_is_active === true ? "active" : source?.jira_validation_status ?? "empty");
    setCompanyJiraValidationMessage(null);
    setCompanyJiraAccountName(source?.jira_account_name ?? null);
    setCompanyJiraValidationLoading(false);
    setCompanyIntegrationMode("manual");
    setCompanyIntegrationEditing(false);
    setCompanyPendingDisableAll(false);
    setCompanyDisableIntegrationsConfirmOpen(false);
    setCompanySaveConfirmOpen(false);
    setCompanySaveConfirmDescription(null);
    setQaseProjects([]);
    setQaseProjectsError(null);
    setSearchProjects("");
    setOnlyValidProjects(false);
    setDisplayLimit(12);
  }

  function openCompanyIntegrationEditor(provider: CompanyIntegrationProvider) {
    setCompanyError(null);
    setCompanySuccess(null);
    setCompanyPendingDisableAll(false);
    setCompanyDisableIntegrationsConfirmOpen(false);
    setCompanySaveConfirmOpen(false);
    setCompanySaveConfirmDescription(null);
    setCompanyIntegrationMode(provider);
    setCompanyIntegrationEditing(true);
  }

  function handleCompanyIntegrationFocusChange(value: string) {
    const nextProvider = normalizeIntegrationProvider(value);
    if (nextProvider === "manual") {
      if (companyShouldPromptDisableAll) {
        setCompanyDisableIntegrationsConfirmOpen(true);
        return;
      }
      restoreCompanyIntegrationFromSaved();
      return;
    }

    openCompanyIntegrationEditor(nextProvider);
  }

  function handleConfirmDisableAllIntegrations() {
    setCompanyDisableIntegrationsConfirmOpen(false);
    setCompanyError(null);
    setCompanySuccess(null);
    setCompanyQaseToken("");
    setCompanyRemoveSavedQaseToken(false);
    setCompanyShowQaseToken(false);
    setCompanyProjectCodes([]);
    setCompanyQaseValidationState("pending_removal");
    setCompanyJiraBaseUrl("");
    setCompanyJiraEmail("");
    setCompanyJiraApiToken("");
    setCompanyRemoveSavedJiraToken(false);
    setCompanyShowJiraApiToken(false);
    setCompanyJiraValidationState("pending_removal");
    setCompanyJiraValidationMessage(null);
    setCompanyJiraAccountName(null);
    setQaseProjects([]);
    setQaseProjectsError(null);
    setSearchProjects("");
    setOnlyValidProjects(false);
    setDisplayLimit(12);
    setCompanyPendingDisableAll(true);
    setCompanyIntegrationMode("manual");
    setCompanyIntegrationEditing(true);
  }

  function collectCompanyDetailsChangedFieldLabels() {
    const changed = new Set<string>();
    if (companyUsernameHasChanges) changed.add("Usuário da empresa");
    if (normalizeComparableText(companyName) !== normalizeComparableText(companyProfile?.company_name ?? companyProfile?.name)) {
      changed.add("Nome da empresa");
    }
    if (normalizeComparableText(companyTaxId) !== normalizeComparableText(companyProfile?.tax_id)) changed.add("CNPJ");
    if (normalizeComparableText(companyCep) !== normalizeComparableText(companyProfile?.cep)) changed.add("CEP");
    if (normalizeComparableText(companyAddress) !== normalizeComparableText(companyProfile?.address)) changed.add("Endereço");
    if (normalizeComparableText(companyAddressDetail) !== normalizeComparableText(companyProfile?.address_detail)) changed.add("Complemento");
    if (normalizeComparableText(companyPhone) !== normalizeComparableText(companyProfile?.phone)) changed.add("Telefone comercial");
    if (normalizeComparableText(companyWebsite) !== normalizeComparableText(companyProfile?.website)) changed.add("Website");
    if (normalizeComparableText(companyDocsLink) !== normalizeComparableText(companyProfile?.docs_link)) changed.add("Link de documentos");
    if (normalizeComparableText(companyLinkedinUrl) !== normalizeComparableText(companyProfile?.linkedin_url)) changed.add("LinkedIn");
    if (companyNotificationsFanoutEnabled !== (companyProfile?.notifications_fanout_enabled ?? true)) {
      changed.add("Fan-out de notificações");
    }
    if (companyLogoDirty || companyLogoValueDirty) changed.add("Logo da empresa");
    return Array.from(changed);
  }

  async function submitCompanyProfileChanges(scope: "details" | "integrations") {
    setCompanyError(null);
    setCompanySuccess(null);

    if (scope === "details") {
      setCompanyLogoError(null);
      setCompanyLogoSuccess(null);
    }

    setCompanyLoading(true);
    try {
      let resolvedLogoUrl = optionalTrimmedString(companyLogoUrl) ?? companySavedLogoUrl ?? undefined;
      const requestPayload: Record<string, unknown> = {};

      if (scope === "details") {
        const nextName = companyName.trim();
        if (!nextName) {
          setCompanyError("Informe o nome da empresa.");
          return false;
        }

        requestPayload.name = nextName;
        requestPayload.company_name = nextName;
        requestPayload.tax_id = optionalTrimmedString(companyTaxId);
        requestPayload.cep = optionalTrimmedString(companyCep);
        requestPayload.address = optionalTrimmedString(companyAddress);
        requestPayload.address_detail = optionalTrimmedString(companyAddressDetail);
        requestPayload.phone = optionalTrimmedString(companyPhone);
        requestPayload.website = optionalTrimmedString(companyWebsite);
        requestPayload.docs_link = optionalTrimmedString(companyDocsLink);
        requestPayload.linkedin_url = optionalTrimmedString(companyLinkedinUrl);
        requestPayload.notifications_fanout_enabled = companyNotificationsFanoutEnabled;
        requestPayload.logo_url = companyLogoFile ? undefined : resolvedLogoUrl;
      } else {
        const effectiveIntegrationMode: CompanyIntegrationProvider = companyPendingDisableAll
          ? "manual"
          : companyHasEffectiveQaseToken || companyProjectCodes.length > 0
            ? "qase"
            : normalizeComparableText(companyJiraBaseUrl) || normalizeComparableText(companyJiraEmail) || companyHasEffectiveJiraToken
              ? "jira"
              : "manual";

        requestPayload.qase_token = companyPendingDisableAll ? undefined : optionalTrimmedString(companyQaseToken);
        requestPayload.clear_qase_token = companyPendingDisableAll ? true : companyRemoveSavedQaseToken || undefined;
        requestPayload.qase_project_codes = companyPendingDisableAll ? [] : qaseProjectsDirty ? companyProjectCodes : undefined;
        requestPayload.jira_base_url = companyPendingDisableAll ? undefined : optionalTrimmedString(companyJiraBaseUrl);
        requestPayload.jira_email = companyPendingDisableAll ? undefined : optionalTrimmedString(companyJiraEmail);
        requestPayload.jira_api_token = companyPendingDisableAll ? undefined : optionalTrimmedString(companyJiraApiToken);
        requestPayload.clear_jira_api_token = companyPendingDisableAll ? true : companyRemoveSavedJiraToken || undefined;
        requestPayload.clear_all_integrations = companyPendingDisableAll || undefined;
        requestPayload.integration_mode = effectiveIntegrationMode;
      }

      const response = await fetchApi("/api/me/company-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });
      const responsePayload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCompanyError(extractApiError(responsePayload) || `Não foi possível atualizar a empresa (${response.status}).`);
        return false;
      }

      const normalized = normalizeCompanyProfile(responsePayload);
      if (normalized) {
        setCompanyProfile(normalized);
      }

      if (scope === "details" && companyLogoFile) {
        setCompanyLogoUploading(true);
        const form = new FormData();
        form.append("file", companyLogoFile);

        const logoResponse = await fetch("/api/me/company-profile/logo", {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const logoPayload = await logoResponse.json().catch(() => ({}));
        if (!logoResponse.ok) {
          setCompanyLogoError(extractApiError(logoPayload) || "Não foi possível enviar o logo.");
          return false;
        }

        resolvedLogoUrl =
          logoPayload && typeof logoPayload === "object" && typeof (logoPayload as { logoUrl?: unknown }).logoUrl === "string"
            ? ((logoPayload as { logoUrl?: string }).logoUrl ?? "").trim() || resolvedLogoUrl
            : resolvedLogoUrl;

        setCompanyLogoUrl(resolvedLogoUrl ?? "");
      }

      await Promise.all([refetchCompanyProfile(), refetchCompanies(), refreshUser()]);
      // Invalidate related caches só the new logo propagates across the UI.
      try {
        mutate("/api/me");
        mutate("/api/me/company-profile");
        mutate("/api/me/profile-summary");
        if (companyProfile?.slug) mutate(`/api/empresas/${companyProfile.slug}/dashboard`);
        // router.refresh will revalidate server components / app-router data
        router.refresh();
      } catch {
        // ignore errors in cache invalidation
      }
      if (scope === "details") {
        if (companyLogoPreviewObjectUrl) {
          URL.revokeObjectURL(companyLogoPreviewObjectUrl);
        }
        setCompanyLogoPreviewObjectUrl(null);
        setCompanyLogoFile(null);
        setCompanyLogoDirty(false);
        setCompanySuccess("Dados da empresa atualizados com sucesso.");
      } else {
        setCompanyQaseToken("");
        setCompanyRemoveSavedQaseToken(false);
        setCompanyShowQaseToken(false);
        setQaseProjects([]);
        setQaseProjectsError(null);
        setSearchProjects("");
        setOnlyValidProjects(false);
        setDisplayLimit(12);
        setCompanyJiraApiToken("");
        setCompanyRemoveSavedJiraToken(false);
        setCompanyShowJiraApiToken(false);
        setCompanyPendingDisableAll(false);
        setCompanyIntegrationEditing(false);
        setCompanyDisableIntegrationsConfirmOpen(false);
        setCompanyIntegrationMode("manual");
        setCompanySuccess(
          companyPendingDisableAll ? "Integrações da empresa atualizadas com sucesso." : "Dados de integração atualizados com sucesso.",
        );
      }
      return true;
    } catch (error) {
      setCompanyError(error instanceof Error ? error.message : "Não foi possível atualizar a empresa.");
      return false;
    } finally {
      setCompanyLogoUploading(false);
      setCompanyLoading(false);
    }
  }

  async function submitCompanyProfileAndUsernameChanges() {
    setCompanyError(null);
    setCompanySuccess(null);
    setProfileError(null);
    setProfileSuccess(null);

    if (companyDetailsHasChanges) {
      const companySaved = await submitCompanyProfileChanges("details");
      if (!companySaved) return false;
    }

    if (companyUsernameHasChanges) {
      const usernameSaved = await submitProfileChanges();
      if (!usernameSaved) return false;
    }

    if (companyDetailsHasChanges && companyUsernameHasChanges) {
      setProfileSuccess(null);
      setCompanySuccess("Dados da empresa e usuário institucional atualizados com sucesso.");
    }

    return true;
  }

  function handleCompanyDetailsSaveRequest() {
    setCompanyError(null);
    setCompanySuccess(null);
    setProfileError(null);
    setProfileSuccess(null);

    if (!companyProfileSaveHasChanges) {
      return;
    }

    const changedFields = collectCompanyDetailsChangedFieldLabels();
    if (changedFields.length === 0) {
      void submitCompanyProfileAndUsernameChanges();
      return;
    }

    setCompanySaveConfirmDescription(
      `Alterar ${changedFields.join(", ")} vai refletir em outros módulos, listas e seletores da plataforma. Deseja continuar?`,
    );
    setCompanySaveConfirmOpen(true);
  }

  function handleCompanyIntegrationSaveRequest() {
    setCompanyError(null);
    setCompanySuccess(null);

    if (!companyIntegrationHasChanges) {
      return;
    }

    if (companyIntegrationSaveBlocked) {
      setCompanyError(companyIntegrationSaveBlockedMessage);
      return;
    }

    void submitCompanyProfileChanges("integrations");
  }

  if (hasCompanyContext) {
    return (
      <div className="relative isolate min-h-screen bg-(--page-bg,#f3f6fb) text-(--page-text,#0b1a3c)">
        <div className={pageShellClass}>
          <Breadcrumb
            items={[
              { label: companyProfileBreadcrumbName },
            ]}
          />

          <section className={heroClass}>
            <div className="space-y-5">
              <div className="flex flex-col gap-4 lg:gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <UserAvatar
                    src={companySavedLogoUrl}
                    name={companyDisplayName}
                    size="lg"
                    className="h-20 w-20 shrink-0 sm:h-24 sm:w-24 lg:h-28 lg:w-28"
                    frameClassName={companyAvatarFrameClass}
                    imageClassName={companyAvatarImageClass}
                    fallbackClassName="text-xl font-bold tracking-[0.18em] text-slate-600 dark:text-white"
                  />
                  <div className="min-w-0 space-y-3">
                    <div className="space-y-2">
                      <p className="tc-hero-kicker">Empresa</p>
                      <h1 className="tc-hero-title">{companyDisplayName}</h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 text-sm text-white/82">
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-extrabold uppercase tracking-[0.16em] ${heroStatusPillClass(companyIntegrationMeta.tone)}`}>
                        <span className="h-2.5 w-2.5 rounded-full bg-current" />
                        Status da integração: {companyIntegrationText}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                <HeroMetric label="Usuários vinculados" value={companyUsersMetricValue} note={companyUsersMetricNote} />
                <HeroMetric label="Projetos Qase" value={companyProjectsMetricValue} note="Projetos selecionados" />
                <HeroMetric label="Status" value={companyStatusMetricValue} note="Cadastro da empresa" />
                <HeroMetric label="Integração" value={companyIntegrationMetricValue} note="Contexto operacional" />
              </div>

              {companyContextLoading ? (
                <div className="rounded-2xl border border-white/18 bg-white/10 px-4 py-3 text-sm font-medium text-white/88 backdrop-blur-sm">
                  Carregando contexto da empresa...
                </div>
              ) : null}
            </div>
          </section>

          <Tabs
            value={activeProfileTab}
            onValueChange={(value) => setActiveProfileTab(value === "usuários" && canViewCompanyUsersTab ? "usuários" : "perfil")}
            className="space-y-5"
          >
            <div className={`${surfaceClass} px-1 py-1`}>
              <TabsList className={`grid w-full ${canViewCompanyUsersTab ? "grid-cols-2" : "grid-cols-1"} rounded-[22px] bg-transparent p-0`}>
                <TabsTrigger value="perfil">Perfil</TabsTrigger>
                {canViewCompanyUsersTab ? <TabsTrigger value="usuários">Usuários</TabsTrigger> : null}
              </TabsList>
            </div>

            <TabsContent value="perfil" className="space-y-5">
          <div className="space-y-5">
            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
              <section className={`${surfaceClass} space-y-6`}>
                <PanelHeader title="Dados da empresa" description="Campos do cadastro institucional da empresa. Descrição e notas ficam fora desta aba." />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nome da empresa"><input className={`form-control-user ${inputClass}`} value={companyName} onChange={(event) => setCompanyName(event.target.value)} disabled={companyLoading || swrCompanyProfileLoading} title="Nome da empresa" aria-label="Nome da empresa" required /></Field>
                  <Field label="Status da empresa">
                    <div className={`inline-flex min-h-14 items-center gap-2 rounded-xl border px-4 text-sm font-extrabold uppercase tracking-[0.14em] ${statusPillClass(companyStatusMeta.tone)}`}>
                      <span className="h-2.5 w-2.5 rounded-full bg-current" />
                      {companyStatusText}
                    </div>
                  </Field>
                  <Field label="CNPJ"><input className={`form-control-user ${inputClass}`} value={companyTaxId} onChange={(event) => setCompanyTaxId(event.target.value)} disabled={companyLoading || swrCompanyProfileLoading} title="CNPJ" aria-label="CNPJ" placeholder="00.000.000/0000-00" /></Field>
                  <Field label="CEP"><input className={`form-control-user ${inputClass}`} value={companyCep} onChange={(event) => setCompanyCep(event.target.value)} disabled={companyLoading || swrCompanyProfileLoading} title="CEP" aria-label="CEP" placeholder="00000-000" /></Field>
                  <Field label="Endereço"><input className={`form-control-user ${inputClass}`} value={companyAddress} onChange={(event) => setCompanyAddress(event.target.value)} disabled={companyLoading || swrCompanyProfileLoading} title="Endereço" aria-label="Endereço" placeholder="Rua, número, cidade" /></Field>
                  <Field label="Complemento / detalhe"><input className={`form-control-user ${inputClass}`} value={companyAddressDetail} onChange={(event) => setCompanyAddressDetail(event.target.value)} disabled={companyLoading || swrCompanyProfileLoading} title="Complemento ou detalhe" aria-label="Complemento ou detalhe" placeholder="Bloco, sala, referência" /></Field>
                  <Field label="Telefone comercial"><input className={`form-control-user ${inputClass}`} value={companyPhone} onChange={(event) => setCompanyPhone(event.target.value)} disabled={companyLoading || swrCompanyProfileLoading} title="Telefone comercial" aria-label="Telefone comercial" placeholder="+55 11 3333-3333" /></Field>
                  <Field label="Website"><input className={`form-control-user ${inputClass}`} value={companyWebsite} onChange={(event) => setCompanyWebsite(event.target.value)} disabled={companyLoading || swrCompanyProfileLoading} title="Website" aria-label="Website" placeholder="https://empresa.com.br" /></Field>
                  <Field label="Link de documentos"><input className={`form-control-user ${inputClass}`} value={companyDocsLink} onChange={(event) => setCompanyDocsLink(event.target.value)} disabled={companyLoading || swrCompanyProfileLoading} title="Link de documentos" aria-label="Link de documentos" placeholder="https://empresa.com.br/documentação" /></Field>
                  <Field label="LinkedIn da empresa"><input className={`form-control-user ${inputClass}`} value={companyLinkedinUrl} onChange={(event) => setCompanyLinkedinUrl(event.target.value)} disabled={companyLoading || swrCompanyProfileLoading} title="LinkedIn da empresa" aria-label="LinkedIn da empresa" placeholder="https://www.linkedin.com/company/empresa" /></Field>
                  <div className="md:col-span-2 rounded-xl border border-(--tc-border) bg-(--tc-surface-2) p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-(--tc-text-primary)">Fan-out de notificações</p>
                        <p className="text-xs text-(--tc-text-muted)">
                          Quando ativo, mudanças no contexto da empresa notificam também usuários vinculados (empresa e TC vinculado).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCompanyNotificationsFanoutEnabled((current) => !current)}
                        disabled={companyLoading || swrCompanyProfileLoading}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          companyNotificationsFanoutEnabled
                            ? "border border-emerald-300 bg-emerald-100 text-emerald-800"
                            : "border border-amber-300 bg-amber-100 text-amber-800"
                        }`}
                        aria-label="Alternar fan-out de notificações"
                        title="Alternar fan-out de notificações"
                      >
                        {companyNotificationsFanoutEnabled ? "Ligado" : "Desligado"}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section className={`${surfaceClass} space-y-5`}>
                <PanelHeader title="Logo da empresa" />
                <div className="overflow-hidden rounded-3xl border border-(--tc-border) bg-white px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:px-6 sm:py-7 dark:bg-(--tc-surface-2)">
                  <div className="flex flex-col gap-4">
                    <UserAvatar
                      src={companyLogoPreviewUrl}
                      name={companyDisplayName}
                      size="xl"
                      className="mx-auto h-36 w-36 max-w-full sm:h-44 sm:w-44 md:h-52 md:w-52"
                      frameClassName={companyAvatarFrameClass}
                      imageClassName={companyAvatarImageClass}
                      fallbackClassName="text-4xl font-bold tracking-[0.18em] text-slate-600 dark:text-white"
                    />
                    <input
                      ref={companyLogoInputRef}
                      id="company-logo-file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      title="Selecionar logo da empresa"
                      aria-label="Selecionar logo da empresa"
                      onChange={(event) => void handleCompanyLogoUpload(event.target.files?.[0])}
                    />
                    <div className="flex justify-center">
                      <button type="button" onClick={() => companyLogoInputRef.current?.click()} disabled={companyLogoUploading || !companyProfile?.id} aria-controls="company-logo-file" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-(--tc-border) bg-(--tc-surface) px-4 py-2 text-sm font-semibold text-(--tc-text-primary) transition hover:bg-(--tc-surface-2) disabled:opacity-60 sm:w-auto">
                        <FiUpload size={15} />
                        {companyLogoUploading ? "Aplicando..." : "Escolher logo"}
                      </button>
                    </div>
                    <p className="text-center text-sm font-bold leading-5 text-[#000f2d] opacity-100 dark:text-white!">
                      A imagem aparece primeiro no preview desta tela. Use o botao abaixo para salvar a logo no restante do sistema.
                    </p>
                  </div>
                </div>

                <Field label="URL do logo">
                  <input
                    className={`form-control-user ${inputClass}`}
                    value={companyLogoUrl}
                    onChange={(event) => {
                      setCompanyLogoError(null);
                      setCompanyLogoSuccess(null);
                      setCompanyLogoDirty(true);
                      setCompanyLogoFile(null);
                      if (companyLogoPreviewObjectUrl) {
                        URL.revokeObjectURL(companyLogoPreviewObjectUrl);
                        setCompanyLogoPreviewObjectUrl(null);
                      }
                      setCompanyLogoUrl(event.target.value);
                    }}
                    disabled={companyLoading || swrCompanyProfileLoading}
                    title="URL do logo"
                    aria-label="URL do logo"
                    placeholder="https://exemplo.com/logo.png"
                  />
                </Field>

                <Feedback message={companyLogoError} tone="error" />
                <Feedback message={companyLogoSuccess} tone="success" />
              </section>
            </div>

            <section className={`${surfaceClass} space-y-6`}>
              <PanelHeader title="Usuário da empresa" description="Login único do perfil institucional. A sugestao usa o nome da empresa e já evita duplicidade." />

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <Field label="Usuário da empresa">
                  <input
                    className={`form-control-user ${inputClass}`}
                    value={profileUsername}
                    onChange={(event) => setProfileUsername(event.target.value)}
                    disabled={profileLoading || loading}
                    title="Usuário da empresa"
                    aria-label="Usuário da empresa"
                    placeholder={`Ex.: ${generatedUsernameHint}`}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </Field>

                <button
                  type="button"
                  className="rounded-full border border-[#0b1f52] bg-[#0b1f52] px-3 py-2 text-sm font-semibold text-white transition hover:border-(--tc-accent) hover:bg-(--tc-accent) hover:text-white disabled:opacity-60 dark:border-[#0b1f52] dark:bg-[#0b1f52] dark:text-white dark:hover:border-(--tc-accent) dark:hover:bg-(--tc-accent) dark:hover:text-white"
                  onClick={() => void requestGeneratedUsername()}
                  disabled={profileLoading || loading || generatingUsername}
                >
                  {generatingUsername ? "Gerando..." : "Gerar usuário"}
                </button>
              </div>

              <FieldHint tone="strong">Baseado no nome da empresa e validado contra logins já existentes.</FieldHint>
              <Feedback message={profileError} tone="error" />
              <Feedback message={profileSuccess} tone="success" />
            </section>

            <section className={`${surfaceClass} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-(--tc-text-primary)">Salvar dados da empresa</p>
                <p className="text-xs font-medium text-(--tc-text-muted)">
                  Este botao salva a logo, os dados da empresa e o usuário institucional.
                </p>
              </div>
              <button
                type="button"
                className={`${primaryButtonClass} w-full sm:w-auto`}
                disabled={companyLoading || companyLogoUploading || profileLoading || loading || !companyProfileSaveHasChanges}
                onClick={handleCompanyDetailsSaveRequest}
              >
                {companyLoading || companyLogoUploading || profileLoading ? "Salvando..." : "Salvar"}
              </button>
            </section>

            <section className={`${surfaceClass} space-y-6`}>
              <PanelHeader title="Integrações" description="Qase e Jira ficam persistidos separadamente. O seletor apenas muda o foco da edição." />

              {!companyIntegrationEditorOpen ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                    <div className="space-y-2">
                      <div className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-(--tc-accent) dark:text-[#ff8a8a]">
                        Resumo das integrações
                      </div>
                      <div className={`inline-flex min-h-14 items-center rounded-xl border px-4 text-sm font-semibold ${statusPillClass(companyIntegrationMeta.tone)}`}>
                        {companyIntegrationText}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openCompanyIntegrationEditor(
                          companyHasSavedActiveQaseIntegration
                            ? "qase"
                            : companyHasSavedActiveJiraIntegration
                              ? "jira"
                              : companyHasSavedQaseConfig
                                ? "qase"
                                : companyHasSavedJiraConfig
                                  ? "jira"
                                  : "qase",
                        )
                      }
                      className={`${integrationSecondaryButtonClass} w-full sm:w-auto`}
                    >
                      {companyHasSavedIntegrations ? "Editar integrações" : "Configurar integração"}
                    </button>
                  </div>

                  {integrationSummaryCards.length > 0 ? (
                    <div className="space-y-3">
                      <PanelSectionTitle
                        title="Integrações salvas"
                        descriptionClassName="text-sm font-semibold text-(--tc-accent) dark:text-[#ff8a8a]"
                      />
                      <div className="grid gap-3 md:grid-cols-2">
                        {integrationSummaryCards.map((item) => (
                          <div key={item.provider} className="rounded-xl border border-(--tc-border) bg-(--tc-surface) p-4 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-(--tc-text-primary)">{item.title}</div>
                                <div className="mt-1 text-xs text-(--tc-text-muted)">
                                  {item.provider === "qase"
                                    ? `${companySavedQaseProjectCodes.length} projeto${companySavedQaseProjectCodes.length === 1 ? "" : "s"} salvo${companySavedQaseProjectCodes.length === 1 ? "" : "s"}`
                                    : companySavedJiraBaseUrl || companySavedJiraEmail || "Credenciais prontas para revisar"}
                                </div>
                                {item.provider === "qase" && companySavedQaseProjectCodes.length > 0 ? (
                                  <div className="mt-2 wrap-break-word text-xs font-semibold text-(--tc-text-primary)">
                                    Projetos: {companySavedQaseProjectCodes.join(", ")}
                                  </div>
                                ) : null}
                              </div>
                              {shouldShowIntegrationStatusPill(item.meta.state) ? (
                                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass(item.meta.tone)}`}>
                                  {item.meta.label}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {companyIntegrationEditorOpen ? (
                <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Integração em foco">
                  <select
                    id="company-integration-mode"
                    title="Integração em foco"
                    aria-label="Integração em foco"
                    className={`form-control-user ${selectInputClass}`}
                    value={companyIntegrationMode}
                    onChange={(event) => handleCompanyIntegrationFocusChange(event.target.value)}
                    disabled={companyLoading}
                  >
                    <option value="manual">Sem integração</option>
                    <option value="qase">Qase</option>
                    <option value="jira">Jira</option>
                  </select>
                </Field>

                <Field label="Status da integração em foco">
                  <div className="space-y-2">
                    <div className={`inline-flex min-h-14 items-center rounded-xl border px-4 text-sm font-semibold ${statusPillClass(companyIntegrationMeta.tone)}`}>
                      {companyIntegrationText}
                    </div>
                    {companyIntegrationEditorOpen ? (
                      <p className="text-xs font-medium text-(--tc-text-muted)">{companyEditingIntegrationDetail}</p>
                    ) : null}
                  </div>
                </Field>
              </div>

              {companyPendingDisableAll ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm font-semibold text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/30 dark:text-amber-100">
                  A empresa ficará sem integrações externas quando você salvar os dados de integração. Clique em <span className="font-extrabold">Salvar dados de integração</span> para aplicar ou em <span className="font-extrabold">Cancelar</span> para restaurar o ultimo estado salvo.
                </div>
              ) : null}

              {normalizedCompanyIntegrationMode === "qase" && !companyPendingDisableAll ? (
                <div className="space-y-5">
                  <PanelSectionTitle
                    title="Qase"
                    description="Token, status e projetos da Qase ficam separados das demais integrações."
                    descriptionClassName="text-sm font-semibold text-(--tc-accent) dark:text-[#ff8a8a]"
                  />

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_200px] md:items-start">
                    <Field label="Token da Qase">
                      <div className="space-y-2">
                        <div className="relative">
                          <input
                            type={companyShowQaseToken ? "text" : "password"}
                            className={`form-control-user ${inputClass} pr-14`}
                            value={companyQaseToken}
                            onChange={(event) => {
                              setCompanyQaseToken(event.target.value);
                              if (companyRemoveSavedQaseToken) {
                                setCompanyRemoveSavedQaseToken(false);
                              }
                              setCompanyQaseValidationState(event.target.value.trim() ? "pending" : "empty");
                              setQaseProjects([]);
                              setQaseProjectsError(null);
                            }}
                            disabled={companyLoading}
                            title="Token da Qase"
                            aria-label="Token da Qase"
                            placeholder={companyHasSavedQaseToken ? "Deixe em branco para manter o token salvo" : "Informe um token para ativar a integração"}
                          />
                          <button
                            type="button"
                            onClick={() => setCompanyShowQaseToken((current) => !current)}
                            className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#0b1f52] transition hover:bg-slate-200/70 dark:text-[#d7e5ff] dark:hover:bg-white/10"
                            aria-label={companyShowQaseToken ? "Ocultar token da Qase" : "Mostrar token da Qase"}
                            title={companyShowQaseToken ? "Ocultar token da Qase" : "Mostrar token da Qase"}
                          >
                            {companyShowQaseToken ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                          </button>
                        </div>
                        {companyHasSavedQaseToken && !companyRemoveSavedQaseToken ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCompanyQaseToken("");
                              setCompanyRemoveSavedQaseToken(true);
                              setCompanyQaseValidationState("pending");
                              setQaseProjects([]);
                              setQaseProjectsError(null);
                            }}
                            disabled={companyLoading}
                            className={savedTokenActionClass}
                            title="Remover token salvo"
                            aria-label="Remover token salvo"
                          >
                            Remover token salvo
                          </button>
                        ) : (
                          <p className="text-xs font-medium text-(--tc-text-muted)">Nenhum token salvo</p>
                        )}
                        {companyRemoveSavedQaseToken ? (
                          <FieldHint tone="strong">O token salvo será removido quando os dados de integração forem salvos.</FieldHint>
                        ) : null}
                      </div>
                    </Field>

                    <div className="flex min-w-0 flex-col gap-2 pt-[2.05rem]">
                      <button
                        type="button"
                        onClick={() => void handleFetchCompanyQaseProjects()}
                        disabled={loadingQaseProjects}
                        className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-linear-to-b from-(--tc-accent,#ff4b4b) to-(--tc-accent-dark,#c30000) px-4 text-sm font-semibold text-white shadow-lg transition duration-150 hover:opacity-95 disabled:opacity-60"
                      >
                        {loadingQaseProjects ? "Buscando..." : "Buscar projetos"}
                      </button>
                    </div>
                  </div>

                  {qaseProjectsError ? <Feedback message={qaseProjectsError} tone="error" /> : null}

                  {qaseProjects.length > 0 ? (
                    <div className="space-y-3 rounded-xl border border-(--tc-border) bg-(--tc-surface) p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-(--tc-text-primary)">Projetos encontrados</p>
                          <p className="text-xs font-semibold text-(--tc-accent) dark:text-[#ff8a8a]">Selecione os projetos que devem ficar vinculados a empresa.</p>
                        </div>
                        <div className="text-sm text-(--tc-text-muted)">{Math.min(displayLimit, filteredQaseProjects.length)} carregados - {companyProjectCodes.length} selecionado{companyProjectCodes.length === 1 ? "" : "s"}</div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-(--tc-text-muted)" />
                          <input value={searchProjects} onChange={(event) => setSearchProjects(event.target.value)} title="Filtrar projetos da Qase" aria-label="Filtrar projetos da Qase" placeholder="Filtrar projetos" className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) py-2 pl-10 pr-3 text-sm text-(--tc-text)" />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-(--tc-text-muted)">
                          <input type="checkbox" checked={onlyValidProjects} onChange={(event) => setOnlyValidProjects(event.target.checked)} aria-label="Mostrar apenas projetos validos" title="Mostrar apenas projetos validos" className="h-4 w-4" />
                          Mostrar apenas validos
                        </label>
                      </div>

                      <div className="grid gap-2">
                        {filteredQaseProjects.slice(0, displayLimit).map((project) => {
                          const selected = companyProjectCodes.includes(project.code);
                          return (
                            <label key={project.code} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm transition ${selected ? "border-2 border-(--tc-accent,#ef0001) bg-(--tc-accent-soft,rgba(255,230,230,0.9))" : "border-transparent hover:border-(--tc-border) hover:bg-(--tc-surface-2)"}`}>
                              <input type="checkbox" checked={selected} onChange={() => setCompanyProjectCodes((current) => current.includes(project.code) ? current.filter((item) => item !== project.code) : [...current, project.code])} aria-label={`Selecionar projeto ${project.code}`} title={`Selecionar projeto ${project.code}`} className="h-5 w-5" />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="block font-semibold text-(--tc-text)">{project.title}</span>
                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Válido</span>
                                </div>
                                <span className="text-xs text-(--tc-text-muted)">{project.code}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      {filteredQaseProjects.length > displayLimit ? (
                        <div className="flex justify-end">
                          <button type="button" onClick={() => setDisplayLimit((current) => current + 10)} className="rounded-md px-3 py-1 text-xs font-semibold hover:bg-(--tc-surface-2)">Carregar mais</button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-(--tc-border) bg-(--tc-surface) px-4 py-3 text-sm text-(--tc-text-primary)">
                    {companySavedQaseProjectCodes.length > 0 ? (
                      <div className="wrap-break-word">
                        Projetos vinculados: <span className="font-semibold">{companySavedQaseProjectCodes.join(", ")}</span>
                      </div>
                    ) : companyProjectCodes.length > 0 ? (
                      <div className="text-(--tc-text-muted)">
                        Os projetos selecionados nesta edição só aparecem aqui depois de validar a integração e salvar os dados de integração.
                      </div>
                    ) : (
                      <div>Nenhum projeto vinculado ainda.</div>
                    )}
                  </div>
                </div>
              ) : null}

              {normalizedCompanyIntegrationMode === "jira" && !companyPendingDisableAll ? (
                <div className="space-y-5">
                  <PanelSectionTitle
                    title="Jira"
                    description="Credenciais do Jira ficam persistidas separadamente da Qase e não somem ao trocar o seletor."
                    descriptionClassName="text-sm font-semibold text-(--tc-accent) dark:text-[#ff8a8a]"
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="URL base do Jira">
                      <input
                        type="url"
                        className={`form-control-user ${inputClass}`}
                        value={companyJiraBaseUrl}
                        onChange={(event) => {
                          setCompanyJiraBaseUrl(event.target.value);
                          setCompanyJiraValidationState(event.target.value.trim() ? "pending" : "empty");
                          setCompanyJiraValidationMessage(null);
                          setCompanyJiraAccountName(null);
                        }}
                        disabled={companyLoading}
                        title="URL base do Jira"
                        aria-label="URL base do Jira"
                        placeholder="https://empresa.atlassian.net"
                      />
                    </Field>

                    <Field label="E-mail técnico do Jira">
                      <input
                        type="text"
                        inputMode="email"
                        autoComplete="email"
                        spellCheck={false}
                        className={`form-control-user ${inputClass}`}
                        value={companyJiraEmail}
                        onChange={(event) => {
                          setCompanyJiraEmail(event.target.value);
                          setCompanyJiraValidationState(event.target.value.trim() ? "pending" : "empty");
                          setCompanyJiraValidationMessage(null);
                          setCompanyJiraAccountName(null);
                        }}
                        disabled={companyLoading}
                        title="E-mail técnico do Jira"
                        aria-label="E-mail técnico do Jira"
                        placeholder="integração@empresa.com"
                      />
                    </Field>
                  </div>

                  <Field label="API token do Jira">
                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          type={companyShowJiraApiToken ? "text" : "password"}
                          className={`form-control-user ${inputClass} pr-14`}
                          value={companyJiraApiToken}
                          onChange={(event) => {
                            setCompanyJiraApiToken(event.target.value);
                            if (companyRemoveSavedJiraToken) {
                              setCompanyRemoveSavedJiraToken(false);
                            }
                            setCompanyJiraValidationState(event.target.value.trim() ? "pending" : "empty");
                            setCompanyJiraValidationMessage(null);
                            setCompanyJiraAccountName(null);
                          }}
                          disabled={companyLoading}
                          title="API token do Jira"
                          aria-label="API token do Jira"
                          placeholder={companyHasSavedJiraToken ? "Deixe em branco para manter o token salvo" : "Informe um API token para ativar o Jira"}
                        />
                        <button
                          type="button"
                          onClick={() => setCompanyShowJiraApiToken((current) => !current)}
                          className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#0b1f52] transition hover:bg-slate-200/70 dark:text-[#d7e5ff] dark:hover:bg-white/10"
                          aria-label={companyShowJiraApiToken ? "Ocultar API token do Jira" : "Mostrar API token do Jira"}
                          title={companyShowJiraApiToken ? "Ocultar API token do Jira" : "Mostrar API token do Jira"}
                        >
                          {companyShowJiraApiToken ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                        </button>
                      </div>
                      <div>
                        {companyHasSavedJiraToken && !companyRemoveSavedJiraToken ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCompanyJiraApiToken("");
                              setCompanyRemoveSavedJiraToken(true);
                              setCompanyJiraValidationState("pending");
                              setCompanyJiraValidationMessage(null);
                              setCompanyJiraAccountName(null);
                            }}
                            disabled={companyLoading}
                            className={savedTokenActionClass}
                            title="Remover token salvo"
                            aria-label="Remover token salvo"
                          >
                            Remover token salvo
                          </button>
                        ) : (
                          <p className="text-xs font-medium text-(--tc-text-muted)">Nenhum token salvo</p>
                        )}
                      </div>
                      {companyRemoveSavedJiraToken ? (
                        <FieldHint tone="strong">O token salvo do Jira será removido quando os dados de integração forem salvos.</FieldHint>
                      ) : null}
                      <FieldHint>O token salvo não volta em texto aberto. Digite um novo valor para substituir.</FieldHint>
                    </div>
                  </Field>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-(--tc-text-primary)">
                        {companyJiraAccountName ? `Conta validada: ${companyJiraAccountName}` : "Valide as credenciais do Jira antes de salvar."}
                      </p>
                      {companyJiraValidationMessage ? (
                        <p className={`text-xs font-semibold ${companyJiraValidationState === "active" ? "text-emerald-700 dark:text-emerald-300" : "text-(--tc-accent) dark:text-[#ff8a8a]"}`}>
                          {companyJiraValidationMessage}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleValidateCompanyJira()}
                      disabled={companyLoading || companyJiraValidationLoading}
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-linear-to-b from-[#0b1f52] to-[#06102b] px-4 text-sm font-semibold text-white shadow-lg transition duration-150 hover:opacity-95 disabled:opacity-60 sm:w-auto"
                    >
                      {companyJiraValidationLoading ? "Validando..." : "Validar Jira"}
                    </button>
                  </div>
                </div>
              ) : null}

              {normalizedCompanyIntegrationMode === "manual" && !companyPendingDisableAll ? (
                <div className="rounded-xl border border-(--tc-border) bg-(--tc-surface) px-4 py-4 text-sm text-(--tc-text-primary)">
                  Selecione uma integração para editar as credenciais. <span className="font-semibold">Sem integração</span> mantém a operação sem conexão externa.
                </div>
              ) : null}

              {integrationSummaryCards.length > 0 ? (
                <div className="space-y-3">
                  <PanelSectionTitle
                    title="Outras integrações configuradas"
                    descriptionClassName="text-sm font-semibold text-(--tc-accent) dark:text-[#ff8a8a]"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    {integrationSummaryCards.map((item) => (
                      <div key={item.provider} className="rounded-xl border border-(--tc-border) bg-(--tc-surface) p-4 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-(--tc-text-primary)">{item.title}</div>
                            <div className="mt-1 text-xs text-(--tc-text-muted)">
                              {item.provider === "qase"
                                ? `${companySavedQaseProjectCodes.length} projeto${companySavedQaseProjectCodes.length === 1 ? "" : "s"} salvo${companySavedQaseProjectCodes.length === 1 ? "" : "s"}`
                                : companySavedJiraBaseUrl || companySavedJiraEmail || "Credenciais prontas para revisar"}
                            </div>
                            {item.provider === "qase" && companySavedQaseProjectCodes.length > 0 ? (
                              <div className="mt-2 wrap-break-word text-xs font-semibold text-(--tc-text-primary)">
                                Projetos: {companySavedQaseProjectCodes.join(", ")}
                              </div>
                            ) : null}
                          </div>
                          {shouldShowIntegrationStatusPill(item.meta.state) ? (
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass(item.meta.tone)}`}>
                              {item.meta.label}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
                </>
              ) : null}

              <Feedback message={companyError} tone="error" />
              <Feedback message={companySuccess} tone="success" />
              {companyIntegrationSaveBlocked ? (
                <div className="rounded-xl border border-rose-400 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:border-rose-500/50 dark:bg-rose-950/35 dark:text-rose-100">
                  {companyIntegrationSaveBlockedMessage}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                {companyIntegrationEditorOpen ? (
                  <button
                    type="button"
                    className={`${integrationSecondaryButtonClass} w-full sm:w-auto`}
                    onClick={() => restoreCompanyIntegrationFromSaved()}
                    disabled={companyLoading || companyLogoUploading}
                  >
                    Cancelar
                  </button>
                ) : null}
                {companyIntegrationEditorOpen ? (
                  <button
                    type="button"
                    className={`${primaryButtonClass} w-full sm:w-auto`}
                    disabled={companyLoading || companyLogoUploading || !companyIntegrationHasChanges || companyIntegrationSaveBlocked}
                    onClick={handleCompanyIntegrationSaveRequest}
                  >
                    {companyLoading ? "Salvando..." : "Salvar dados de integração"}
                  </button>
                ) : null}
              </div>
            </section>
          </div>

          <section className={`${surfaceClass} space-y-5`}>
            <PanelHeader title="Senha da conta" />
            <form className="grid gap-4 2xl:grid-cols-3" onSubmit={handlePasswordSubmit}>
              <Field label="Senha atual"><input type="password" className={`form-control-user ${inputClass}`} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" title="Senha atual" aria-label="Senha atual" placeholder="********" required /></Field>
              <Field label="Nova senha"><input type="password" className={`form-control-user ${inputClass}`} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" title="Nova senha" aria-label="Nova senha" placeholder="********" required /></Field>
              <Field label="Confirmar nova senha"><input type="password" className={`form-control-user ${inputClass}`} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" title="Confirmar nova senha" aria-label="Confirmar nova senha" placeholder="********" required /></Field>
              <div className="space-y-3 2xl:col-span-3">
                <Feedback message={passwordError} tone="error" />
                <Feedback message={passwordSuccess} tone="success" />
              </div>
              <div className="flex 2xl:col-span-3 2xl:justify-end">
                <button type="submit" className={`${primaryButtonClass} w-full sm:w-auto`} disabled={passwordLoading}>{passwordLoading ? "Atualizando..." : "Atualizar senha"}</button>
              </div>
            </form>
          </section>

            </TabsContent>

            {canViewCompanyUsersTab ? (
            <TabsContent value="usuários" className="space-y-5">
              <section className={`${surfaceClass} space-y-5`}>
                <div className="flex flex-col gap-4 border-b border-(--tc-border) pb-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-[1.2rem] font-semibold tracking-[-0.02em] text-(--tc-text-primary)">Usuários da empresa</h2>
                    <p className="text-sm font-semibold text-(--tc-accent) dark:text-[#ff8a8a]">
                      Usuários criados aqui nascem com origem institucional fechada e não podem ser vinculados a outras empresas.
                    </p>
                  </div>
                  {canCreateCompanyUsers ? (
                    <button
                      type="button"
                      className={`${primaryButtonClass} w-full sm:w-auto`}
                      onClick={() => setCompanyUserCreateOpen(true)}
                    >
                      Criar usuário
                    </button>
                  ) : null}
                </div>

                <Feedback message={companyUsersError} tone="error" />

                {swrCompanyUsersLoading && companyUsers.length === 0 ? (
                  <div className="rounded-2xl border border-(--tc-border) bg-(--tc-surface) px-4 py-6 text-sm font-semibold text-(--tc-text-primary)">
                    Carregando usuários da empresa...
                  </div>
                ) : null}

                {!companyUsersError && !swrCompanyUsersLoading && companyUsers.length === 0 ? <div className="tc-empty-state min-h-45">Nenhum usuário vinculado encontrado para esta empresa.</div> : null}
                {companyUsers.length > 0 ? (
                  <div className="divide-y divide-(--tc-border)">
                    {companyUsers.map((companyUser) => {
                      const profileTypeLabel = companyUserProfileTypeLabel(companyUser);

                      return (
                        <article key={companyUser.id} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar
                            src={companyUser.avatar_url ?? null}
                            name={companyUser.name}
                            size="md"
                            frameClassName={companyAvatarFrameClass}
                            imageClassName={companyAvatarImageClass}
                            fallbackClassName="text-sm font-bold tracking-[0.12em] text-slate-600 dark:text-white"
                          />
                          <div className="min-w-0 space-y-1">
                            <h3 className="truncate text-base font-semibold text-(--tc-text-primary)">{companyUser.name}</h3>
                            <p className="text-sm font-medium text-[#0b1f52] dark:text-[#d7e5ff]">@{companyUser.user || companyUser.email}</p>
                            <p className="truncate text-sm font-medium text-[#0b1f52] dark:text-[#d7e5ff]">{companyUser.email}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass(companyUser.active === false ? "warning" : "positive")}`}><span className="h-2 w-2 rounded-full bg-current" />{statusLabel(companyUser.active, companyUser.status, t)}</span>
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass("neutral")}`}><span className="h-2 w-2 rounded-full bg-current" />{profileTypeLabel}</span>
                        </div>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            </TabsContent>
            ) : null}
          </Tabs>

          {canCreateCompanyUsers ? (
            <CompanyUserCreateModal
              open={companyUserCreateOpen}
              companyName={companyDisplayName}
              onClose={() => setCompanyUserCreateOpen(false)}
              onCreated={handleCompanyUserCreated}
            />
          ) : null}

          <ConfirmDialog
            open={companyDisableIntegrationsConfirmOpen}
            title="Ficar sem integrações externas"
            description="Ao salvar, a empresa ficará sem integrações externas e as configurações atuais de Qase e Jira serao desativadas. Deseja continuar?"
            confirmLabel="Continuar sem integrações"
            cancelLabel="Cancelar"
            onCancel={() => setCompanyDisableIntegrationsConfirmOpen(false)}
            onConfirm={() => handleConfirmDisableAllIntegrations()}
          />

          <ConfirmDialog
            open={companySaveConfirmOpen}
            title="Confirmar alterações da empresa"
            description={companySaveConfirmDescription ?? undefined}
            confirmLabel="Salvar alterações"
            cancelLabel="Cancelar"
            onCancel={() => setCompanySaveConfirmOpen(false)}
            onConfirm={() => {
              setCompanySaveConfirmOpen(false);
              void submitCompanyProfileAndUsernameChanges();
            }}
          />

          <ConfirmDialog
            open={!!usernameReplacementDialog}
            title="Trocar login da conta"
            description={
              usernameReplacementDialog
                ? usernameReplacementDialog.mode === "generate"
                  ? `O login atual @${usernameReplacementDialog.currentUsername} sera substituido por @${usernameReplacementDialog.nextUsername}. O login atual deixara de funcionar.`
                  : `Salvar com o campo de usuario em branco vai substituir o login atual @${usernameReplacementDialog.currentUsername} por um novo login gerado automaticamente. O login atual deixara de funcionar.`
                : undefined
            }
            confirmLabel={usernameReplacementDialog?.mode === "generate" ? "Aplicar login" : "Salvar com novo login"}
            cancelLabel="Cancelar"
            onCancel={() => setUsernameReplacementDialog(null)}
            onConfirm={() => {
              if (!usernameReplacementDialog) return;
              if (usernameReplacementDialog.mode === "generate") {
                setProfileUsername(usernameReplacementDialog.nextUsername);
                setUsernameReplacementDialog(null);
                return;
              }
              const nextAction = usernameReplacementDialog;
              setProfileUsername(nextAction.nextUsername);
              setUsernameReplacementDialog(null);
              void submitProfileChanges({
                allowGeneratedReplacement: nextAction.mode === "submit",
                forcedGeneratedUsername: nextAction.nextUsername,
              });
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen bg-(--page-bg,#f3f6fb) text-(--page-text,#0b1a3c)">
      <div className={pageShellClass}>
        <Breadcrumb items={[{ label: userProfileBreadcrumbName }]} />

        <section className={heroClass}>
          <div className="space-y-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-start gap-4">
                <UserAvatar
                  src={heroAvatarUrl || null}
                  name={heroName}
                  showFallback={!avatarLoadingPlaceholder}
                  size="lg"
                  editable
                  onEdit={() => avatarInputRef.current?.click()}
                  className="h-24 w-24 shrink-0 sm:h-28 sm:w-28"
                  frameClassName={heroAvatarUrl ? "border-0 bg-transparent ring-0 shadow-[0_16px_34px_rgba(1,24,72,0.22)]" : "border border-white/28 bg-white/10 text-white shadow-[0_16px_34px_rgba(1,24,72,0.18)]"}
                  fallbackClassName="text-xl font-bold tracking-[0.18em] text-white"
                  buttonClassName="bg-(--tc-primary) text-white hover:bg-(--tc-accent)"
                />

                <div className="min-w-0 space-y-3">
                  <div className="space-y-2">
                    <p className="tc-hero-kicker">Usuário</p>
                    <h1 className="tc-hero-title">{heroName}</h1>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 text-sm text-white/82">
                    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/92">
                      @{heroUsername}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/92">
                      {uiRoleLabel}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/92">
                      {userStatusLabel}
                    </span>
                    {(profileEmail.trim() || email) ? (
                      <span className="truncate font-medium text-white/76">{profileEmail.trim() || email}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              {canOpenCompanyHomeFromUserProfile && currentClientSlug ? (
                <div className="tc-hero-actions">
                  <Link
                    href={currentCompanyHomeHref ?? "/empresas"}
                    className="inline-flex h-10 items-center rounded-lg border border-white/18 bg-white/8 px-4 text-sm font-semibold text-white transition hover:bg-white/12"
                  >
                    Abrir empresa
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeroMetric label="Defeitos abertos" value={openDefectsMetricValue} note="Criados por você" />
              <HeroMetric label="Notas criadas" value={notesCreatedMetricValue} note="Notas pessoais" />
              <HeroMetric label="Conta criada" value={createdAtMetricValue} note="Cadastro do usuário" />
              <HeroMetric label="Vinculos ativos" value={linkedCompaniesMetricValue} note="Empresas no cadastro" />
            </div>
          </div>
        </section>

        <form className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]" onSubmit={handleProfileSubmit}>
          <section className={`${surfaceClass} space-y-6`}>
            <PanelHeader title="Cadastro do usuário" />

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome completo">
                <input
                  className={`form-control-user ${inputClass}`}
                  value={profileFullName}
                  onChange={(event) => setProfileFullName(event.target.value)}
                  disabled={profileLoading || loading}
                  title="Nome completo"
                  placeholder="Ex.: Maria Silva"
                  required
                />
              </Field>

              <Field label="Usuário (login)">
                <div className="space-y-2">
                  <input
                    className={`form-control-user ${inputClass}`}
                    value={profileUsername}
                    onChange={(event) => setProfileUsername(event.target.value)}
                    disabled={profileLoading || loading}
                    placeholder={`Ex.: ${generatedUsernameHint}`}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#0b1f52] dark:text-[#d7e5ff]">
                    <FieldHint tone="strong">Único no sistema. Em branco, gera automaticamente.</FieldHint>
                    <button
                      type="button"
                      className="rounded-full border border-[#0b1f52] bg-[#0b1f52] px-3 py-1 font-semibold text-white transition hover:border-(--tc-accent) hover:bg-(--tc-accent) hover:text-white disabled:opacity-60 dark:border-[#0b1f52] dark:bg-[#0b1f52] dark:text-white dark:hover:border-(--tc-accent) dark:hover:bg-(--tc-accent) dark:hover:text-white"
                      onClick={() => void requestGeneratedUsername()}
                      disabled={profileLoading || loading || generatingUsername}
                    >
                      {generatingUsername ? "Gerando..." : "Gerar login"}
                    </button>
                  </div>
                </div>
              </Field>

              <Field label="E-mail">
                <input
                  type="email"
                  className={`form-control-user ${inputClass}`}
                  value={profileEmail}
                  onChange={(event) => setProfileEmail(event.target.value)}
                  disabled={profileLoading || loading}
                  title="E-mail"
                  placeholder="seu@email.com"
                  required
                />
              </Field>

              <Field label="Telefone">
                <input
                  className={`form-control-user ${inputClass}`}
                  value={profilePhone}
                  onChange={(event) => setProfilePhone(event.target.value)}
                  disabled={profileLoading || loading}
                  placeholder="+55 11 99999-9999"
                />
              </Field>
            </div>

            <div className="space-y-4 border-t border-(--tc-border) pt-6">
              <PanelSectionTitle title="Profissional" />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Cargo">
                  <div ref={jobTitleFieldRef} className="relative space-y-4">
                    <div className="relative">
                      <FiSearch
                        aria-hidden
                        className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[#0b1f52] dark:text-[#d7e5ff]"
                        size={16}
                      />
                      <input
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={Boolean(jobTitleMenuOpen)}
                        aria-controls="job-title-suggestions"
                        autoComplete="off"
                        className={`form-control-user ${inputClass} pl-11 pr-12`}
                        value={profileJobTitle}
                        onChange={(event) => {
                          setProfileJobTitle(event.target.value);
                          setJobTitleMenuOpen(true);
                        }}
                        onFocus={() => setJobTitleMenuOpen(true)}
                        onClick={() => setJobTitleMenuOpen(true)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setJobTitleMenuOpen(false);
                          }
                        }}
                        disabled={profileLoading || loading}
                        placeholder="Busque ou escolha um cargo"
                      />
                      <button
                        type="button"
                        aria-label={jobTitleMenuOpen ? "Fechar lista de cargos" : "Abrir lista de cargos"}
                        className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#0b1f52] transition hover:bg-rose-50 hover:text-(--tc-accent) dark:text-[#d7e5ff] dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
                        onClick={() => setJobTitleMenuOpen((current) => !current)}
                        disabled={profileLoading || loading}
                      >
                        <FiChevronDown className={`transition ${jobTitleMenuOpen ? "rotate-180" : ""}`} size={18} />
                      </button>
                    </div>

                    {jobTitleMenuOpen ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.55rem)] z-30 overflow-hidden rounded-[20px] border border-[#7b92bc] bg-white shadow-[0_18px_46px_rgba(15,23,42,0.18)] dark:border-[#7b92bc] dark:bg-white">
                        <div className="border-b border-[#d7e0ef] px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-(--tc-accent) dark:border-[#d7e0ef] dark:text-(--tc-accent)">
                          {profileJobTitle.trim()
                            ? `${filteredJobTitleOptions.length} sugestoes encontradas`
                            : `${JOB_TITLE_OPTIONS.length} cargos conhecidos`}
                        </div>
                        <div id="job-title-suggestions" role="listbox" className="max-h-72 overflow-y-auto py-2">
                          {filteredJobTitleOptions.length > 0 ? (
                            filteredJobTitleOptions.map((jobTitleOption) => {
                              const isSelected = normalizeSearchTerm(jobTitleOption) === normalizeSearchTerm(profileJobTitle);
                              return (
                                <button
                                  key={jobTitleOption}
                                  type="button"
                                  role="option"
                                  aria-selected={Boolean(isSelected)}
                                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold transition ${
                                    isSelected
                                      ? "bg-rose-50 text-[#0b1f52] dark:bg-rose-50 dark:text-[#0b1f52]"
                                      : "text-[#0b1f52] hover:bg-[#eef3fb] hover:text-[#0b1f52] dark:text-[#0b1f52] dark:hover:bg-[#eef3fb] dark:hover:text-[#0b1f52]"
                                  }`}
                                  onClick={() => {
                                    setProfileJobTitle(jobTitleOption);
                                    setJobTitleMenuOpen(false);
                                  }}
                                >
                                  <span>{jobTitleOption}</span>
                                  {isSelected ? <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-(--tc-accent)">Atual</span> : null}
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-4 py-4 text-sm font-semibold text-[#0b1f52] dark:text-[#0b1f52]">
                              Nenhum cargo conhecido encontrado. Você pode digitar um cargo personalizado.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}

                    <FieldHint tone="strong">Selecione na lista ou digite um cargo personalizado.</FieldHint>
                  </div>
                </Field>

                <Field label="LinkedIn">
                  <input
                    className={`form-control-user ${inputClass}`}
                    value={profileLinkedinUrl}
                    onChange={(event) => setProfileLinkedinUrl(event.target.value)}
                    disabled={profileLoading || loading}
                    placeholder="https://www.linkedin.com/in/seu-perfil"
                  />
                </Field>
              </div>
            </div>

            <div className="space-y-4 border-t border-(--tc-border) pt-6">
              <PanelSectionTitle title={t("settings.preferences")} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("settings.theme")}>
                  <select
                    className={`form-control-user ${selectInputClass}`}
                    value={theme}
                    onChange={(event) => setTheme(event.target.value as Theme)}
                    disabled={profileLoading || settingsLoading}
                    title={t("settings.theme")}
                  >
                    <option value="system">{t("settings.themeSystem")}</option>
                    <option value="light">{t("settings.themeLight")}</option>
                    <option value="dark">{t("settings.themeDark")}</option>
                  </select>
                </Field>

                <Field label={t("settings.language")}>
                  <select
                    className={`form-control-user ${selectInputClass}`}
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as Language)}
                    disabled={profileLoading || settingsLoading}
                    title={t("settings.language")}
                  >
                    <option value="pt-BR">{t("settings.languagePt")}</option>
                    <option value="en-US">{t("settings.languageEn")}</option>
                  </select>
                </Field>
              </div>
            </div>

            <div className="space-y-3 border-t border-(--tc-border) pt-6">
              <Feedback message={profileError} tone="error" />
              <Feedback message={profileSuccess} tone="success" />
              <div className="flex justify-end">
                <button type="submit" className={primaryButtonClass} disabled={profileLoading || loading || settingsLoading}>
                  {profileLoading ? t("settings.savingProfile") : t("settings.saveProfile")}
                </button>
              </div>
            </div>
          </section>

          <section className={`${surfaceClass} space-y-5`}>
            <PanelHeader title="Foto do perfil" />

            <div className="rounded-3xl border border-(--tc-border) bg-white px-6 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:bg-(--tc-surface-2)">
              <div className="flex flex-col items-center gap-4 text-center">
                <UserAvatar
                  src={previewAvatarUrl || null}
                  name={heroName}
                  showFallback={!avatarLoadingPlaceholder}
                  size="xl"
                  editable
                  onEdit={() => avatarInputRef.current?.click()}
                  frameClassName="border-4 border-white bg-transparent shadow-[0_20px_44px_rgba(15,23,42,0.16)] ring-1 ring-slate-200/80 dark:ring-white/10"
                  fallbackClassName="text-2xl font-bold tracking-[0.18em] text-slate-600 dark:text-white"
                  buttonClassName="bg-(--tc-primary) text-white hover:bg-(--tc-accent)"
                />
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-(--tc-accent) dark:text-[#ff8a8a]">
                    {avatarUploading ? "Enviando foto..." : profileAvatarFile ? "A nova foto aparece aqui antes de salvar." : "Upload e URL usam uma única origem por vez."}
                  </div>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Selecionar foto de perfil"
                  title="Selecionar foto de perfil"
                  onChange={(event) => void handleAvatarUpload(event.target.files?.[0])}
                />
              </div>
            </div>

            <Field label="URL da foto">
              <input
                className={`form-control-user ${inputClass}`}
                value={profileAvatarUrlInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setProfileAvatarUrlInput(nextValue);
                  if (nextValue.trim()) {
                    setProfileAvatarSource("url");
                    setProfileAvatarFile(null);
                    setProfileUploadedAvatarUrl("");
                    setProfileAvatarDirty(true);
                    return;
                  }
                  setProfileAvatarSource(null);
                  setProfileAvatarFile(null);
                  setProfileUploadedAvatarUrl("");
                  setProfileAvatarDirty(true);
                }}
                disabled={profileLoading || loading}
                placeholder="https://exemplo.com/foto.jpg"
              />
            </Field>

            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-(--tc-accent) dark:text-[#ff8a8a]">
              <span>
                {profileAvatarDirty
                  ? "Preview local. Salve para aplicar na capa e no menu."
                  : heroAvatarUrl
                    ? "A foto salva aparece na capa e no menu."
                    : "Sem foto, a conta usa as iniciais."}
              </span>
              {(profileAvatarDirty || heroAvatarUrl) ? (
                <button
                  type="button"
                  className="rounded-full border border-[#0b1f52] bg-[#eef3fb] px-3 py-1 font-semibold text-[#0b1f52] transition hover:border-(--tc-accent) hover:bg-(--tc-accent) hover:text-white dark:border-[#d7e5ff] dark:bg-[#122038] dark:text-[#d7e5ff] dark:hover:border-(--tc-accent) dark:hover:bg-(--tc-accent) dark:hover:text-white"
                  onClick={() => {
                    setProfileAvatarSource(null);
                    setProfileAvatarUrlInput("");
                    setProfileAvatarFile(null);
                    setProfileUploadedAvatarUrl("");
                    setProfileAvatarDirty(true);
                    setProfileSuccess(null);
                    setProfileError(null);
                  }}
                  disabled={profileLoading || avatarUploading || loading}
                >
                  Remover foto
                </button>
              ) : null}
            </div>

          </section>
        </form>

        <section className={`${surfaceClass} space-y-5`}>
          <PanelHeader title="Senha" />

          <form className="grid gap-4 xl:grid-cols-3" onSubmit={handlePasswordSubmit}>
            <Field label="Senha atual">
              <input
                type="password"
                className={`form-control-user ${inputClass}`}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                title="Senha atual"
                placeholder="••••••••"
                required
              />
            </Field>

            <Field label="Nova senha">
              <input
                type="password"
                className={`form-control-user ${inputClass}`}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                title="Nova senha"
                placeholder="••••••••"
                required
              />
            </Field>

            <Field label="Confirmar nova senha">
              <input
                type="password"
                className={`form-control-user ${inputClass}`}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                title="Confirmar nova senha"
                placeholder="••••••••"
                required
              />
            </Field>

            <div className="space-y-3 xl:col-span-3">
              <Feedback message={passwordError} tone="error" />
              <Feedback message={passwordSuccess} tone="success" />
            </div>

            <div className="flex justify-end xl:col-span-3">
              <button type="submit" className={primaryButtonClass} disabled={passwordLoading}>
                {passwordLoading ? "Atualizando..." : "Atualizar senha"}
              </button>
            </div>
          </form>
        </section>

        {hasCompanyContext ? (
          <section className={`${surfaceClass} space-y-5`}>
            <PanelHeader title="Empresas vinculadas" />

            <div className="space-y-3">
              <Feedback message={companiesError} tone="error" />

              {!companiesError && uniqueCompanies.length === 0 ? (
                <div className="tc-empty-state min-h-45">
                  Nenhuma empresa vinculada encontrada para este usuário.
                </div>
              ) : null}

              {uniqueCompanies.length > 0 ? (
                <div className="divide-y divide-(--tc-border)">
                  {uniqueCompanies.map((company) => (
                    <article key={company.client_id} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0 space-y-1">
                        <h3 className="truncate text-base font-semibold text-(--tc-text-primary)" title={company.client_name}>
                            {company.client_name}
                        </h3>
                        <p className="text-sm font-medium text-[#0b1f52] dark:text-[#d7e5ff]">{company.client_slug}</p>
                        <p className="text-sm font-medium text-[#0b1f52] dark:text-[#d7e5ff]">
                          {company.client_active ? "Empresa ativa" : "Empresa inativa"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass(company.link_active ? "positive" : "warning")}`}>
                            <span className="h-2 w-2 rounded-full bg-current" />
                            {company.link_active ? "Vínculo ativo" : "Vínculo inativo"}
                          </span>
                        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass("neutral")}`}>
                          <span className="h-2 w-2 rounded-full bg-current" />
                          {company.role}
                        </span>
                        <Link href={buildCompanyPathForAccess(company.client_slug, "home", companyRouteInput)} className={secondaryButtonClass}>
                          Abrir empresa
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className={`${surfaceClass} space-y-5`}>
          <PanelHeader title="Deletar perfil" description={canDeleteDirectly ? "Ação definitiva para perfis administrativos e globais." : "Perfis comuns precisam solicitar a exclusão para análise."} />

          <div className="space-y-3">
            <Feedback message={deleteUserError} tone="error" />
            <Feedback message={deleteUserSuccess} tone="success" />
            <Feedback message={deleteRequestError} tone="error" />
            <Feedback message={deleteRequestSuccess} tone="success" />

            {canDeleteDirectly ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  className={`${dangerButtonClass} justify-center`}
                  disabled={deleteUserLoading}
                  onClick={() => {
                    setDeleteUserError(null);
                    setDeleteUserSuccess(null);
                    setDeleteUserConfirmOpen(true);
                  }}
                >
                  <FiTrash2 size={15} />
                  {deleteUserLoading ? "Deletando..." : "Deletar perfil"}
                </button>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  className={dangerButtonClass}
                  disabled={deleteRequestLoading}
                  onClick={() => {
                    setDeleteRequestError(null);
                    setDeleteRequestOpen(true);
                  }}
                >
                  <FiTrash2 size={15} />
                  Solicitar exclusão de perfil
                </button>
              </div>
            )}
          </div>
        </section>

        <ConfirmDialog
          open={!!usernameReplacementDialog}
          title="Trocar login da conta"
          description={
            usernameReplacementDialog
              ? usernameReplacementDialog.mode === "generate"
                ? `O login atual @${usernameReplacementDialog.currentUsername} sera substituido por @${usernameReplacementDialog.nextUsername}. O login atual deixara de funcionar.`
                : `Salvar com o campo de usuario em branco vai substituir o login atual @${usernameReplacementDialog.currentUsername} por um novo login gerado automaticamente. O login atual deixara de funcionar.`
              : undefined
          }
          confirmLabel={usernameReplacementDialog?.mode === "generate" ? "Aplicar login" : "Salvar com novo login"}
          cancelLabel="Cancelar"
          onCancel={() => setUsernameReplacementDialog(null)}
          onConfirm={() => {
            if (!usernameReplacementDialog) return;
            if (usernameReplacementDialog.mode === "generate") {
              setProfileUsername(usernameReplacementDialog.nextUsername);
              setUsernameReplacementDialog(null);
              return;
            }
            const nextAction = usernameReplacementDialog;
            setProfileUsername(nextAction.nextUsername);
            setUsernameReplacementDialog(null);
            void submitProfileChanges({
              allowGeneratedReplacement: nextAction.mode === "submit",
              forcedGeneratedUsername: nextAction.nextUsername,
            });
          }}
        />

        <ConfirmDialog
          open={deleteUserConfirmOpen}
          title={directDeleteModalTitle}
          description={directDeleteModalDescription}
          confirmLabel={deleteUserLoading ? "Deletando..." : "Confirmar exclusão"}
          cancelLabel="Cancelar"
          onCancel={() => {
            if (deleteUserLoading) return;
            setDeleteUserConfirmOpen(false);
          }}
          onConfirm={() => {
            if (deleteUserLoading) return;
            setDeleteUserConfirmOpen(false);
            void handleDeleteUser();
          }}
        />

        {deleteRequestOpen ? (
          <div className="fixed inset-0 z-60 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => !deleteRequestLoading && setDeleteRequestOpen(false)} />
            <div className="relative z-70 w-full max-w-xl rounded-2xl border border-(--tc-border) bg-(--tc-surface) p-5 shadow-[0_30px_80px_rgba(2,6,23,0.6)]">
              <h3 className="text-base font-semibold text-(--tc-text-primary)">Solicitar exclusão de perfil</h3>
              <p className="mt-1 text-sm font-medium text-[#0b1f52] dark:text-[#d7e5ff]">Explique o motivo para a equipe administrativa analisar a exclusão.</p>

              <div className="mt-4 space-y-2">
                <label className="flex flex-col gap-2 text-sm text-(--tc-text-primary)">
                  <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-(--tc-accent) dark:text-[#ff8a8a]">Motivo</span>
                  <textarea
                    className="min-h-35 w-full rounded-xl border border-slate-400 bg-white px-4 py-3 text-sm font-medium text-[#0b1f52] outline-none transition placeholder:text-[#345388] focus:border-(--tc-accent) focus:bg-rose-50/60 focus:ring-2 focus:ring-(--tc-accent)/18 dark:border-slate-500 dark:bg-[#0f1b2d] dark:text-[#d7e5ff] dark:placeholder:text-[#b4cbff] dark:focus:bg-rose-500/10"
                    value={deleteRequestReason}
                    onChange={(event) => setDeleteRequestReason(event.target.value)}
                    placeholder="Descreva o motivo da exclusão do perfil."
                    disabled={deleteRequestLoading}
                  />
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteRequestOpen(false)}
                  className="rounded-md border border-slate-400 bg-white px-3 py-2 text-sm font-medium text-[#0b1f52] transition hover:border-(--tc-accent) hover:text-(--tc-accent) dark:border-slate-500 dark:bg-[#122038] dark:text-[#d7e5ff] dark:hover:text-rose-200"
                  disabled={deleteRequestLoading}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleProfileDeletionRequest()}
                  className="rounded-md bg-(--tc-accent) px-3 py-2 text-sm font-semibold text-white shadow-sm"
                  disabled={deleteRequestLoading}
                >
                  {deleteRequestLoading ? "Enviando..." : "Solicitar"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
