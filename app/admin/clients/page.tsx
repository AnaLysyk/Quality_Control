"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreateClientModal, type ClientFormValues } from "@/clients/components/CreateClientModal";
import { CreateUserModal } from "@/admin/users/components/CreateUserModal";
import { useAuth } from "@/context/AuthContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { hasAdminClientToolAccess } from "@/lib/adminClientAccess";
import { fetchApi } from "@/lib/api";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { extractMessageFromJson, extractRequestIdFromJson, formatMessageWithRequestId, readApiError, unwrapEnvelopeData } from "@/lib/apiEnvelope";
import { FiCheckCircle, FiChevronLeft, FiChevronRight, FiCircle, FiExternalLink, FiEye, FiEyeOff, FiHome, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiUpload, FiUsers, FiX, FiXCircle, FiCloudLightning, FiShield, FiTool, FiUser, FiUserPlus } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Breadcrumb from "@/components/Breadcrumb";
import {
  getFixedProfileLabel,
  getFixedProfileTone,
  normalizeFixedProfileKind,
  resolveFixedProfileKind,
  type FixedProfileKind,
} from "@/lib/fixedProfilePresentation";

// ============================================================================
// TYPES
// ============================================================================

type Client = {
  id: string;
  name: string;
  slug?: string | null;
  taxId?: string | null;
  address?: string | null;
  description?: string | null;
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  docsLink?: string | null;
  linkedinUrl?: string | null;
  notes?: string | null;
  integrationMode?: "qase" | "manual" | null;
  qaseProjectCode?: string | null;
  qaseProjectCodes?: string[] | null;
  qaseToken?: string | null;
  hasQaseToken?: boolean;
  jiraBaseUrl?: string | null;
  jiraEmail?: string | null;
  jiraApiToken?: string | null;
  notificationsFanoutEnabled?: boolean;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type CompanyOption = {
  id: string;
  name: string;
  slug?: string | null;
};

type UserItem = {
  id: string;
  name: string;
  email: string;
  user?: string;
  permission_role?: string | null;
  profile_kind?: string | null;
  company_ids?: string[];
  company_names?: string[];
  active?: boolean;
  status?: string;
  avatar_url?: string | null;
  phone?: string | null;
  job_title?: string | null;
  linkedin_url?: string | null;
  client_id?: string | null;
  role?: string | null;
};

type UserTab = "company" | "testing" | "admin" | "support";

type AdminTab = "companies" | "users";

type LogoSource = {
  logoUrl?: string | null;
  slug?: string | null;
  website?: string | null;
  name?: string | null;
};

type CompanySection = {
  id: string;
  name: string;
  users: UserItem[];
};

type CreateModalConfig = {
  title: string;
  subtitle: string;
  submitLabel: string;
  initialRole: string;
  lockRole: boolean;
  allowedRoles?: FixedProfileKind[];
  showCompanyField: boolean;
  requireCompanySelection: boolean;
  companyOptional: boolean;
};

// ============================================================================
// CONSTANTS & UTILITIES
// ============================================================================

const FALLBACK_LOGOS: Record<string, string> = {
  griaule: "/images/griaule.png",
  "testing-company": "/images/testing-company.png",
};

function resolveLogoCandidates(source: LogoSource): string[] {
  const candidates: string[] = [];
  const addCandidate = (value: string | null | undefined) => {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed) return;
    if (!candidates.includes(trimmed)) candidates.push(trimmed);
  };

  const rawLogo = typeof source.logoUrl === "string" ? source.logoUrl.trim() : "";
  if (rawLogo) {
    if (/^(https?:|data:|blob:)/i.test(rawLogo)) {
      addCandidate(rawLogo);
    } else if (rawLogo.startsWith("//")) {
      addCandidate(`https:${rawLogo}`);
    } else if (rawLogo.startsWith("/")) {
      addCandidate(rawLogo);
    } else if (rawLogo.toLowerCase().startsWith("local:") && source.slug) {
      const relative = rawLogo.slice("local:".length);
      addCandidate(`/api/company-documents?slug=${encodeURIComponent(source.slug)}&path=${encodeURIComponent(relative)}`);
    } else if (rawLogo.includes(".")) {
      addCandidate(rawLogo.startsWith("images/") ? `/${rawLogo}` : `/images/${rawLogo}`);
    }
  }

  const slug = typeof source.slug === "string" ? source.slug.trim().toLowerCase() : "";
  if (slug && candidates.length === 0) {
    addCandidate(FALLBACK_LOGOS[slug]);
    addCandidate(`/images/${slug}.png`);
  }

  return candidates;
}

function getInitials(value: string | null | undefined, defaultValue = "?") {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return defaultValue;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return defaultValue;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}

function hasQaseTokenConfigured(client?: Partial<Client> | null) {
  if (!client) return false;
  if (typeof client.qaseToken === "string") return client.qaseToken.trim().length > 0;
  return client.hasQaseToken === true;
}

function normalize(text?: string | null) {
  return (text ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function normalizeProfileKind(user?: Pick<UserItem, "profile_kind" | "permission_role"> | null) {
  return resolveFixedProfileKind({
    profileKind: user?.profile_kind,
    permissionRole: user?.permission_role,
  });
}

function mapClient(row: Record<string, unknown>): Client {
  const name =
    typeof row.name === "string"
      ? row.name
      : typeof row.company_name === "string"
        ? row.company_name
        : "";

  const id = typeof row.id === "string" ? row.id : String(row.id ?? "");

  const readNullableString = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
  const readBoolean = (value: unknown) => (typeof value === "boolean" ? value : false);
  const readProjectCodes = (value: unknown): string[] | null => {
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value as string[];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const arr = trimmed
        .split(/[\s,;|]+/g)
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean);
      return arr.length ? Array.from(new Set(arr)) : null;
    }
    return null;
  };

  return {
    id,
    name,
    slug: readNullableString(row.slug),
    taxId: readNullableString(row.tax_id),
    address: readNullableString(row.address),
    description: readNullableString(row.description),
    website: readNullableString(row.website),
    phone: readNullableString(row.phone),
    logoUrl: readNullableString(row.logo_url),
    docsLink: readNullableString(row.docs_link),
    linkedinUrl: readNullableString(row.linkedin_url) ?? readNullableString(row.docs_link),
    notes: readNullableString(row.notes),
    integrationMode: readNullableString(row.integration_mode) as "qase" | "manual" | null,
    qaseProjectCode: readNullableString(row.qase_project_code),
    qaseProjectCodes: readProjectCodes(row.qase_project_codes),
    qaseToken: null,
    hasQaseToken: !!readNullableString(row.qase_token),
    jiraBaseUrl: readNullableString(row.jira_base_url),
    jiraEmail: readNullableString(row.jira_email),
    jiraApiToken: null,
    notificationsFanoutEnabled: typeof row.notifications_fanout_enabled === "boolean" ? row.notifications_fanout_enabled : true,
    ...(() => {
      const integrations = (row as any).integrations;
      if (!Array.isArray(integrations)) return {};
      const out: Partial<Client> = {};
      for (const it of integrations) {
        if (!it || typeof it !== "object") continue;
        const type = String(it.type || "").toUpperCase();
        const cfg = it.config ?? {};
        if (type === "QASE") {
          if (typeof cfg.token === "string" && cfg.token.trim()) {
            out.hasQaseToken = true;
            out.qaseToken = cfg.token;
          }
          if (Array.isArray(cfg.projects) && cfg.projects.length) {
            out.qaseProjectCodes = Array.from(
              new Set([
                ...(out.qaseProjectCodes ?? []),
                ...cfg.projects.map((p: any) =>
                  typeof p === "string" ? p.trim().toUpperCase() : String(p).trim().toUpperCase()
                ),
              ])
            );
            if (!out.qaseProjectCode && out.qaseProjectCodes && out.qaseProjectCodes.length)
              out.qaseProjectCode = out.qaseProjectCodes[0];
          }
        }
        if (type === "JIRA") {
          if (typeof cfg.baseUrl === "string" && cfg.baseUrl.trim()) out.jiraBaseUrl = cfg.baseUrl;
          if (typeof cfg.email === "string" && cfg.email.trim()) out.jiraEmail = cfg.email;
          if (typeof cfg.apiToken === "string" && cfg.apiToken.trim()) out.jiraApiToken = cfg.apiToken;
        }
      }
      return out;
    })(),
    active: readBoolean(row.active),
    createdAt: readNullableString(row.created_at),
    updatedAt: readNullableString(row.updated_at),
  };
}

function resolveUserTabParam(value: string | null): UserTab | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "company" || normalized === "empresa") return "company";
  if (normalized === "testing" || normalized === "tc" || normalized === "usuario-tc") return "testing";
  if (normalized === "admin" || normalized === "leader" || normalized === "lider") return "admin";
  if (normalized === "support" || normalized === "suporte") return "support";
  return null;
}

function resolveUserTabFromRole(value: string | null): UserTab | null {
  const role = normalizeFixedProfileKind(value);
  if (role === "empresa" || role === "company_user") return "company";
  if (role === "testing_company_user") return "testing";
  if (role === "leader_tc") return "admin";
  if (role === "technical_support") return "support";
  return null;
}

function resolveAdminTabParam(value: string | null): AdminTab | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "companies" || normalized === "empresas") return "companies";
  if (normalized === "users" || normalized === "usuarios") return "users";
  return null;
}

function profileLabel(user?: Pick<UserItem, "profile_kind" | "permission_role"> | null) {
  return getFixedProfileLabel(
    resolveFixedProfileKind({
      profileKind: user?.profile_kind,
      permissionRole: user?.permission_role,
    }),
    { short: true }
  );
}

function roleTone(user?: Pick<UserItem, "profile_kind" | "permission_role"> | null) {
  return getFixedProfileTone(
    resolveFixedProfileKind({
      profileKind: user?.profile_kind,
      permissionRole: user?.permission_role,
    })
  );
}

function isInactiveUser(user: UserItem) {
  return user.active === false || user.status === "inactive";
}

function statusLabel(user: UserItem) {
  return isInactiveUser(user) ? "Inativo" : "Ativo";
}

function statusTone(user: UserItem) {
  return isInactiveUser(user) ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";
}

function getUserHandle(user?: Pick<UserItem, "user"> | null) {
  return user?.user ? `@${user.user}` : "Sem login visivel";
}

// ============================================================================
// COMPONENTS
// ============================================================================

function CompanyLogo({ logoUrl, slug, website, name, className }: {
  logoUrl?: string | null;
  slug?: string | null;
  website?: string | null;
  name?: string | null;
  className?: string;
}) {
  const candidates = useMemo(
    () => resolveLogoCandidates({ logoUrl: logoUrl ?? null, slug: slug ?? null, website: website ?? null, name: name ?? null }),
    [logoUrl, slug, website, name]
  );
  const candidatesKey = candidates.join("|");
  const [imageState, setImageState] = useState<{ key: string; index: number; failed: boolean }>({
    key: candidatesKey,
    index: 0,
    failed: false,
  });
  const resolvedState =
    imageState.key === candidatesKey
      ? imageState
      : {
          key: candidatesKey,
          index: 0,
          failed: false,
        };

  const normalizedClass = className ? className.trim() : "";
  const alt = (name && name.trim()) || "Logo da empresa";
  const currentSrc = candidates[resolvedState.index] ?? null;

  if (!currentSrc || resolvedState.failed) {
    const initials = getInitials(name);
    return (
      <span
        role="img"
        aria-label={alt}
        className={`inline-flex h-full w-full items-center justify-center rounded bg-[var(--tc-surface-2,#f3f4f6)] text-xs font-semibold uppercase text-[var(--tc-text-muted,#6b7280)] ${normalizedClass}`.trim()}
      >
        {initials}
      </span>
    );
  }

  const handleError = () => {
    if (resolvedState.index < candidates.length - 1) {
      setImageState({
        key: candidatesKey,
        index: resolvedState.index + 1,
        failed: false,
      });
      return;
    }

    setImageState({
      key: candidatesKey,
      index: resolvedState.index,
      failed: true,
    });
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={alt}
      loading="lazy"
      className={`h-full w-full object-cover ${normalizedClass}`.trim()}
      onError={handleError}
    />
  );
}

function UserAvatar({ user, size = "md" }: { user: UserItem; size?: "md" | "lg" }) {
  const sizeClassName = size === "lg" ? "h-14 w-14 text-base" : "h-12 w-12 text-sm";

  if (user.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatar_url} alt={user.name} className={`block aspect-square ${sizeClassName} rounded-full object-cover`} />
    );
  }

  return (
    <div className={`flex aspect-square items-center justify-center rounded-full bg-slate-100 font-bold text-[var(--tc-text-primary,#0b1a3c)] ${sizeClassName}`}>
      {getInitials(user.name, "US")}
    </div>
  );
}

function UserInlineField({ label, value, valueClassName = "" }: { label: string; value: string; valueClassName?: string }) {
  return (
    <p className="text-[15px] leading-7 text-[var(--tc-text-secondary,#4b5563)] sm:text-base">
      <span className="font-medium text-[var(--tc-text-secondary,#4b5563)]">{label}: </span>
      <span className={`font-semibold text-[var(--tc-text-primary,#0b1a3c)] ${valueClassName}`} title={value}>
        {value}
      </span>
    </p>
  );
}

function UserCard({
  user,
  onSelect,
  companyLabel,
  showCompanyField = true,
}: {
  user: UserItem;
  onSelect: (user: UserItem) => void;
  companyLabel?: string | null;
  showCompanyField?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(user)}
      className="group w-full rounded-[22px] border border-[var(--tc-border,#d7deea)] bg-white px-4 py-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:border-[var(--tc-accent,#ef0001)]/22 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)] sm:px-5 sm:py-5"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-5">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <UserAvatar user={user} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-[1.9rem] font-semibold leading-none tracking-tight text-[var(--tc-text-primary,#0b1a3c)] sm:text-[2rem]">
              {user.name}
            </p>
            <div className="mt-3 space-y-1">
              <UserInlineField label="UsuÃ¡rio" value={getUserHandle(user)} valueClassName="break-all" />
              <UserInlineField label="E-mail" value={user.email} valueClassName="break-all" />
              <UserInlineField label="Cargo" value={user.job_title || "NÃ£o informado"} valueClassName="break-words" />
              {showCompanyField && companyLabel ? <UserInlineField label="Empresa" value={companyLabel} valueClassName="break-words" /> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:max-w-55 md:justify-end">
          <span
            className={`inline-flex max-w-full rounded-full border px-3 py-1.5 text-sm font-semibold ${roleTone(user)}`}
            title={profileLabel(user)}
          >
            <span className="truncate">{profileLabel(user)}</span>
          </span>
          <span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${statusTone(user)}`}>
            {statusLabel(user)}
          </span>
        </div>
      </div>
    </button>
  );
}

function UserStatusSection({
  title,
  count,
  emptyMessage,
  children,
}: {
  title: string;
  count: number;
  emptyMessage: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[var(--tc-border,#d7deea)] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between border-b border-[var(--tc-border,#d7deea)] pb-4">
        <h3 className="text-lg font-bold text-[var(--tc-text-primary,#0b1a3c)]">{title}</h3>
        <span className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] px-3 py-1 text-sm font-semibold text-[var(--tc-text-primary,#0b1a3c)]">
          {count}
        </span>
      </div>

      {count === 0 ? (
        <div className="mt-4 rounded-[18px] border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] px-4 py-6 text-sm text-[var(--tc-text-secondary,#4b5563)]">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-5">{children}</div>
      )}
    </section>
  );
}

function UserCardGrid({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

function CompanyUsersSection({
  company,
  onSelect,
}: {
  company: CompanySection;
  onSelect: (user: UserItem) => void;
}) {
  return (
    <section className="rounded-[20px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] p-3.5 sm:p-4">
      <div className="flex flex-col gap-2 border-b border-[var(--tc-border,#d7deea)] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h4 className="truncate text-lg font-bold text-[var(--tc-text-primary,#0b1a3c)]">{company.name}</h4>
          <p className="mt-1 text-sm text-[var(--tc-text-secondary,#4b5563)]">
            {company.users.length} perfil{company.users.length === 1 ? "" : "is"} vinculado{company.users.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-3 py-1 text-sm font-semibold text-[var(--tc-text-primary,#0b1a3c)]">
          {company.users.length} usuario{company.users.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4">
        <UserCardGrid>
          {company.users.map((user) => (
            <UserCard key={user.id} user={user} onSelect={onSelect} companyLabel={company.name} showCompanyField={false} />
          ))}
        </UserCardGrid>
      </div>
    </section>
  );
}

type CompanyStatusFilter = "all" | "active" | "inactive";
type CompanyIntegrationFilter = "all" | "integrated" | "manual";
type CompanySortMode = "name_asc" | "name_desc" | "status_active_first" | "integration_first" | "updated_desc";
type CompanyIntegrationBadge = { key: string; label: string; tone: "ok" | "warn" | "neutral" | "info" };

function companyStatusDotClass(value: CompanyStatusFilter) {
  if (value === "active") return "text-emerald-500";
  if (value === "inactive") return "text-amber-500";
  return "text-sky-500";
}

function companySortLabel(value: CompanySortMode) {
  if (value === "name_desc") return "Nome Z-A";
  if (value === "status_active_first") return "Ativas primeiro";
  if (value === "integration_first") return "Integradas primeiro";
  if (value === "updated_desc") return "Atualizadas primeiro";
  return "Nome A-Z";
}

function compareCompanyText(left?: string | null, right?: string | null) {
  return (left || "").localeCompare(right || "", "pt-BR", { sensitivity: "base" });
}

function companyTimestamp(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getCompanyIntegrationBadges(company: Client): CompanyIntegrationBadge[] {
  const badges: CompanyIntegrationBadge[] = [];
  const qaseCodes = Array.isArray(company.qaseProjectCodes)
    ? company.qaseProjectCodes.map((code) => String(code).trim()).filter(Boolean)
    : [];
  const hasQase = hasQaseTokenConfigured(company) || qaseCodes.length > 0 || Boolean(company.qaseProjectCode?.trim());
  const hasJira = Boolean(company.jiraBaseUrl?.trim() || company.jiraEmail?.trim() || company.jiraApiToken?.trim());

  if (hasQase) {
    badges.push({
      key: "qase",
      label: qaseCodes.length > 0 ? `Qase ${qaseCodes.length}` : "Qase",
      tone: hasQaseTokenConfigured(company) ? "ok" : "warn",
    });
  }
  if (hasJira) badges.push({ key: "jira", label: "Jira", tone: "info" });
  if (company.notificationsFanoutEnabled) badges.push({ key: "notifications", label: "Notificacoes", tone: "info" });
  if (badges.length === 0) {
    badges.push(company.integrationMode === "manual" ? { key: "manual", label: "Manual", tone: "neutral" } : { key: "none", label: "Sem integracao", tone: "warn" });
  }

  return badges;
}

function companyIntegrationBadgeClass(tone: CompanyIntegrationBadge["tone"]) {
  if (tone === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-950/35 dark:text-emerald-200";
  if (tone === "warn") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/35 dark:text-amber-200";
  if (tone === "info") return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700/50 dark:bg-sky-950/35 dark:text-sky-200";
  return "border-slate-200 bg-white text-slate-700 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-200";
}

function companyIntegrationRank(company: Client) {
  return getCompanyIntegrationBadges(company).some((badge) => badge.key !== "manual" && badge.key !== "none") ? 0 : 1;
}

function companyHasRealIntegration(company: Client) {
  return companyIntegrationRank(company) === 0;
}

function CompanyManagementQueueExperience({
  companies,
  loading,
  search,
  onSearchChange,
  canCreate,
  onCreate,
  onRefresh,
  onSelect,
  selectedId,
  searchInputRef,
}: {
  companies: Client[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  canCreate: boolean;
  onCreate: () => void;
  onRefresh: () => void;
  onSelect: (company: Client) => void;
  selectedId?: string | null;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [statusFilter, setStatusFilter] = useState<CompanyStatusFilter>("all");
  const [integrationFilter, setIntegrationFilter] = useState<CompanyIntegrationFilter>("all");
  const [sortMode, setSortMode] = useState<CompanySortMode>("name_asc");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  const activeCount = useMemo(() => companies.filter((company) => company.active).length, [companies]);
  const inactiveCount = useMemo(() => companies.length - activeCount, [activeCount, companies.length]);
  const normalizedSearch = normalize(search);
  const filteredCompanies = useMemo(() => {
    const next = companies.filter((company) => {
      if (statusFilter === "active" && !company.active) return false;
      if (statusFilter === "inactive" && company.active) return false;
      if (integrationFilter === "integrated" && !companyHasRealIntegration(company)) return false;
      if (integrationFilter === "manual" && companyHasRealIntegration(company)) return false;
      if (!normalizedSearch) return true;
      return [
        company.name,
        company.slug,
        company.taxId,
        company.website,
        company.phone,
        company.address,
        company.description,
        company.qaseProjectCode,
        ...(company.qaseProjectCodes ?? []),
        company.jiraBaseUrl,
        ...getCompanyIntegrationBadges(company).map((badge) => badge.label),
      ]
        .map(normalize)
        .join(" ")
        .includes(normalizedSearch);
    });

    return next.sort((left, right) => {
      if (sortMode === "name_desc") return compareCompanyText(right.name, left.name);
      if (sortMode === "status_active_first") return Number(!right.active) - Number(!left.active) || compareCompanyText(left.name, right.name);
      if (sortMode === "integration_first") return companyIntegrationRank(left) - companyIntegrationRank(right) || compareCompanyText(left.name, right.name);
      if (sortMode === "updated_desc") {
        return (
          companyTimestamp(right.updatedAt ?? right.createdAt) -
            companyTimestamp(left.updatedAt ?? left.createdAt) ||
          compareCompanyText(left.name, right.name)
        );
      }
      return compareCompanyText(left.name, right.name);
    });
  }, [companies, integrationFilter, normalizedSearch, sortMode, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredCompanies.length / pageSize));
  const visibleCompanies = useMemo(
    () => filteredCompanies.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
    [filteredCompanies, pageIndex, pageSize],
  );

  useEffect(() => {
    setPageIndex(0);
  }, [search, statusFilter, integrationFilter, companies.length]);

  useEffect(() => {
    setPageIndex((current) => Math.min(current, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  const statusOptions: Array<{ value: CompanyStatusFilter; label: string; count: number }> = [
    { value: "all", label: "Todas", count: companies.length },
    { value: "active", label: "Ativas", count: activeCount },
    { value: "inactive", label: "Inativas", count: inactiveCount },
  ];

  return (
    <section className="tc-queue-shell overflow-hidden rounded-[24px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] text-[var(--tc-text-primary,#0b1a3c)] shadow-[0_18px_54px_rgba(15,23,42,0.09)]">
      <div className="border-b border-[var(--tc-border,#d7deea)] bg-[linear-gradient(135deg,var(--tc-surface,#ffffff)_0%,var(--tc-surface-2,#f8fafc)_58%,rgba(14,165,233,0.08)_100%)] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">Fila de empresas</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">
              Use a busca e os filtros para encontrar empresas, abrir detalhes e manter o cadastro institucional.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {canCreate ? (
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[linear-gradient(90deg,var(--tc-primary,#011848)_0%,var(--tc-accent,#ef0001)_100%)] px-4 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_14px_30px_rgba(239,0,1,0.22)] ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:opacity-95"
              >
                <FiPlus className="h-4 w-4" />
                Cadastrar
              </button>
            ) : null}

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] text-[var(--tc-text-secondary,#4b5563)] shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-[rgba(239,0,1,0.28)] hover:bg-[var(--tc-surface-2,#f8fafc)] disabled:opacity-60"
              aria-label="Atualizar empresas"
              title="Atualizar"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <div className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3.5 text-[var(--tc-text-primary,#0b1a3c)] shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--tc-text-muted,#6b7280)]">Total</span>
              <span className="text-base font-black leading-none text-[var(--tc-primary,#011848)]">{companies.length}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(260px,1fr)_170px_190px_210px]">
          <label className="relative">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--tc-text-muted,#6b7280)]" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar por nome, slug, CNPJ, site ou telefone"
              className="h-12 w-full rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] pl-11 pr-4 text-sm font-semibold text-[var(--tc-text-primary,#0b1a3c)] outline-none transition placeholder:text-[var(--tc-text-muted,#94a3b8)] focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
              data-testid="company-search-input"
            />
          </label>

          <select
            aria-label="Filtrar empresas por status"
            title="Filtrar empresas por status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as CompanyStatusFilter)}
            className="h-12 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-4 text-sm font-black text-[var(--tc-text-primary,#0b1a3c)] outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.count})
              </option>
            ))}
          </select>

          <select
            aria-label="Ordenar empresas"
            title="Ordenar empresas"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as CompanySortMode)}
            className="h-12 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-4 text-sm font-black text-[var(--tc-text-primary,#0b1a3c)] outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
          >
            <option value="name_asc">Nome A-Z</option>
            <option value="name_desc">Nome Z-A</option>
            <option value="status_active_first">Ativas primeiro</option>
            <option value="integration_first">Integradas primeiro</option>
            <option value="updated_desc">Atualizadas primeiro</option>
          </select>

          <select
            aria-label="Filtrar empresas por integraÃ§Ã£o"
            title="Filtrar empresas por integraÃ§Ã£o"
            value={integrationFilter}
            onChange={(event) => setIntegrationFilter(event.target.value as CompanyIntegrationFilter)}
            className="h-12 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-4 text-sm font-black text-[var(--tc-text-primary,#0b1a3c)] outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
          >
            <option value="all">Todas integraÃ§Ãµes</option>
            <option value="integrated">Com integraÃ§Ã£o</option>
            <option value="manual">Manual / sem integraÃ§Ã£o</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatusFilter(option.value)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                statusFilter === option.value
                  ? "border-sky-600 bg-sky-700 text-white shadow-[0_12px_24px_rgba(14,116,144,0.18)]"
                  : "border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] text-[var(--tc-text-secondary,#4b5563)] hover:border-sky-300 hover:text-[var(--tc-text-primary,#0b1a3c)]"
              }`}
            >
              <FiCircle className={`h-2 w-2 ${statusFilter === option.value ? "text-white" : companyStatusDotClass(option.value)}`} />
              {option.label}
              <span className="opacity-75">{option.count}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-sm font-semibold text-[var(--tc-text-muted,#6b7280)]">Carregando empresas...</div>
      ) : filteredCompanies.length === 0 ? (
        <div className="flex min-h-90 items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--tc-surface-2,#f8fafc)] text-[var(--tc-text-muted,#6b7280)]">
              <FiSearch className="h-7 w-7" />
            </div>
            <h3 className="mt-5 text-xl font-black text-[var(--tc-text-primary,#0b1a3c)]">
              {companies.length === 0 ? "Nenhuma empresa cadastrada" : "Nenhuma empresa encontrada"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">
              {companies.length === 0 ? "Cadastre a primeira empresa para iniciar a base da plataforma." : "Ajuste os filtros ou busque por outra empresa."}
            </p>
            {canCreate && companies.length === 0 ? (
              <button
                type="button"
                onClick={onCreate}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#071e53_0%,#ef0001_100%)] px-5 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(239,0,1,0.18)] transition hover:opacity-95"
              >
                <FiPlus className="h-4 w-4" />
                Cadastrar empresa
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="hidden max-h-[calc(100vh-332px)] overflow-auto lg:block">
            <table className="w-full min-w-230 border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 bg-[var(--tc-surface,#ffffff)] shadow-[0_1px_0_var(--tc-border,#d7deea)]">
                <tr>
                  {["Empresa", "CNPJ", "Contato", "IntegraÃ§Ã£o", "Status", "AÃ§Ã£o"].map((column) => (
                    <th key={column} className="whitespace-nowrap border-b border-[var(--tc-border,#d7deea)] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleCompanies.map((company) => {
                  const active = company.id === selectedId;
                  const integrationBadges = getCompanyIntegrationBadges(company);

                  return (
                  <tr
                    key={company.id}
                    onClick={() => onSelect(company)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(company);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={`group cursor-pointer transition ${
                      active
                        ? "bg-sky-50/90 shadow-[inset_4px_0_0_#0284c7] dark:bg-sky-950/35"
                        : "odd:bg-[var(--tc-surface,#ffffff)] even:bg-[var(--tc-surface-2,#f8fafc)] hover:bg-sky-50/65 dark:hover:bg-sky-950/25"
                    }`}
                  >
                    <td className="border-b border-[var(--tc-border,#d7deea)] px-4 py-3 align-middle">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)]">
                          <CompanyLogo logoUrl={company.logoUrl} slug={company.slug} website={company.website} name={company.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[var(--tc-text-primary,#0b1a3c)]">{company.name}</p>
                          <p className="mt-0.5 truncate text-xs font-semibold text-[var(--tc-text-secondary,#4b5563)]">{company.slug ? `@${company.slug}` : "Sem slug"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-[var(--tc-border,#d7deea)] px-4 py-3 text-sm font-semibold text-[var(--tc-text-secondary,#4b5563)] align-middle">
                      {company.taxId || "NÃ£o informado"}
                    </td>
                    <td className="border-b border-[var(--tc-border,#d7deea)] px-4 py-3 text-sm font-semibold text-[var(--tc-text-secondary,#4b5563)] align-middle">
                      <div className="max-w-60 truncate">{company.website || company.phone || "NÃ£o informado"}</div>
                    </td>
                    <td className="border-b border-[var(--tc-border,#d7deea)] px-4 py-3 align-middle">
                      <div className="flex max-w-72 flex-wrap gap-1.5">
                        {integrationBadges.map((badge) => (
                          <span key={badge.key} className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${companyIntegrationBadgeClass(badge.tone)}`}>
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="border-b border-[var(--tc-border,#d7deea)] px-4 py-3 align-middle">
                      <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${company.active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {company.active ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="border-b border-[var(--tc-border,#d7deea)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--tc-accent,#ef0001)] align-middle">
                      {active ? "Selecionada" : "Ver detalhes"}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 lg:hidden">
            {visibleCompanies.map((company) => {
              const active = company.id === selectedId;
              const integrationBadges = getCompanyIntegrationBadges(company);

              return (
              <button
                key={`mobile-${company.id}`}
                type="button"
                onClick={() => onSelect(company)}
                className={`w-full rounded-[24px] border p-4 text-left shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 ${
                  active
                    ? "border-sky-300 bg-sky-50 shadow-[inset_4px_0_0_#0284c7] dark:border-sky-700/60 dark:bg-sky-950/35"
                    : "border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)]">
                    <CompanyLogo logoUrl={company.logoUrl} slug={company.slug} website={company.website} name={company.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-black text-[var(--tc-text-primary,#0b1a3c)]">{company.name}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${company.active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {company.active ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-[var(--tc-text-secondary,#4b5563)]">{company.slug ? `@${company.slug}` : company.taxId || "Sem slug"}</p>
                    <p className="mt-1 text-xs text-[var(--tc-text-muted,#6b7280)]">{company.website || company.phone || "Contato nÃ£o informado"}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {integrationBadges.map((badge) => (
                        <span key={`mobile-${company.id}-${badge.key}`} className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${companyIntegrationBadgeClass(badge.tone)}`}>
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-5 py-4">
            <p className="text-sm font-semibold text-[var(--tc-text-secondary,#4b5563)]">
              PÃ¡gina {pageIndex + 1} de {pageCount} Â· {filteredCompanies.length} resultado(s) Â· {companySortLabel(sortMode)}
            </p>

            <div className="flex items-center gap-2">
              <select
                aria-label="Quantidade de empresas por pÃ¡gina"
                title="Quantidade de empresas por pÃ¡gina"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPageIndex(0);
                }}
                className="h-10 rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 text-sm font-bold text-[var(--tc-text-primary,#0b1a3c)]"
              >
                {[10, 12, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}/pÃ¡gina
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                disabled={pageIndex === 0}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] text-[var(--tc-text-primary,#0b1a3c)] transition hover:bg-[var(--tc-surface-2,#f8fafc)] disabled:opacity-40"
                aria-label="PÃ¡gina anterior"
              >
                <FiChevronLeft />
              </button>

              <button
                type="button"
                onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))}
                disabled={pageIndex >= pageCount - 1}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] text-[var(--tc-text-primary,#0b1a3c)] transition hover:bg-[var(--tc-surface-2,#f8fafc)] disabled:opacity-40"
                aria-label="PrÃ³xima pÃ¡gina"
              >
                <FiChevronRight />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function AdminConsolidatedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const { user } = useAuthUser();
  const canUseAdminClientTools = hasAdminClientToolAccess(user);

  // Main tab state (Companies | Users)
  const [mainTab, setMainTab] = useState<AdminTab>("companies");

  // ========================================================================
  // COMPANIES TAB STATE
  // ========================================================================

  const [companies, setCompanies] = useState<Client[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesMessage, setCompaniesMessage] = useState<string | null>(null);
  const [companiesSearch, setCompaniesSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companyForm, setCompanyForm] = useState<Partial<Client>>({});
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyAction, setCompanyAction] = useState<null | "activate" | "deactivate" | "delete">(null);
  const [openCreateCompany, setOpenCreateCompany] = useState(false);
  const [openCompanyDetail, setOpenCompanyDetail] = useState(false);
  const companiesSearchInputRef = useRef<HTMLInputElement | null>(null);

  // ========================================================================
  // USERS TAB STATE
  // ========================================================================

  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersCompanies, setUsersCompanies] = useState<CompanyOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [activeUserTab, setActiveUserTab] = useState<UserTab>(
    () => resolveUserTabParam(searchParams.get("userTab") ?? searchParams.get("section")) ?? resolveUserTabFromRole(searchParams.get("role")) ?? "company",
  );
  const [usersSearch, setUsersSearch] = useState("");
  const [openCreateUser, setOpenCreateUser] = useState(false);
  const [openUserDetail, setOpenUserDetail] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const usersSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [createRolePreset, setCreateRolePreset] = useState<FixedProfileKind | null>(null);

  // ========================================================================
  // COMPANIES TAB FUNCTIONS
  // ========================================================================

  const loadCompanies = useCallback(async () => {
    setCompaniesLoading(true);
    setCompaniesMessage(null);
    try {
      const res = await fetchApi("/api/clients");
      if (res.status === 401) {
        setCompaniesMessage("SessÃ£o expirada. FaÃ§a login novamente.");
        router.replace("/login");
        setCompanies([]);
        return;
      }
      if (res.status === 403) {
        setCompaniesMessage("Acesso negado: use uma conta de admin global.");
        toast.error("Acesso negado: use uma conta de admin global.");
        setCompanies([]);
        return;
      }
      const raw = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = extractMessageFromJson(raw) || "Erro ao carregar empresas";
        const requestId = extractRequestIdFromJson(raw) || res.headers.get("x-request-id") || null;
        const formatted = formatMessageWithRequestId(msg, requestId);
        setCompaniesMessage(formatted);
        toast.error(formatted);
        setCompanies([]);
        return;
      }

      const data = unwrapEnvelopeData<{ items?: unknown[] }>(raw) ?? null;
      const items = Array.isArray(data?.items) ? data!.items : [];
      setCompanies(items.map((row) => mapClient((row ?? {}) as Record<string, unknown>)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar empresas";
      setCompaniesMessage(msg);
      toast.error(msg);
      setCompanies([]);
    } finally {
      setCompaniesLoading(false);
    }
  }, [router]);

  async function createInstitutionalCompanyUser(company: Client, data: ClientFormValues) {
    const adminEmail = data.adminEmail?.trim().toLowerCase();
    if (!adminEmail) return;

    const payload = {
      full_name: data.name.trim(),
      name: data.name.trim(),
      email: adminEmail,
      user: data.companyUsername?.trim().toLowerCase() || undefined,
      phone: data.phone?.trim() || undefined,
      avatar_url: data.logoUrl?.trim() || undefined,
      role: "empresa",
      client_id: company.id,
      job_title: "Administrador da empresa",
      linkedin_url: data.linkedin?.trim() || undefined,
      active: true,
    };

    const res = await fetchApi("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.status === 409) {
      toast.error("Empresa criada, mas jÃ¡ existe usuÃ¡rio com esse e-mail/login.");
      return;
    }

    if (!res.ok) {
      const err = await readApiError(res, "Empresa criada, mas nÃ£o foi possÃ­vel criar o usuÃ¡rio institucional.");
      toast.error(err.displayMessage);
      return;
    }

    toast.success("UsuÃ¡rio institucional da empresa criado e convite enviado.");
  }

  const handleUpdateCompany = useCallback(
    async (companyId: string, data: ClientFormValues) => {
      try {
        const normalizedCodes = Array.isArray(data.qaseProjectCodes)
          ? data.qaseProjectCodes.map((c) => (typeof c === "string" ? c.trim().toUpperCase() : String(c).trim().toUpperCase())).filter(Boolean)
          : typeof data.qaseProjectCode === "string"
            ? [data.qaseProjectCode.trim().toUpperCase()]
            : [];
        const address = [data.zip, data.address ?? data.description].filter(Boolean).join(" | ");
        const payload = {
          name: data.name,
          company_name: data.name,
          tax_id: data.taxId,
          address: address || undefined,
          address_number: data.addressNumber || undefined,
          address_detail: data.addressDetail || undefined,
          phone: data.phone,
          website: data.website,
          logo_url: data.logoUrl,
          linkedin_url: data.linkedin,
          qase_project_code: data.qaseProjectCode,
          qase_project_codes: normalizedCodes,
          qase_token: data.qaseToken || undefined,
          notifications_fanout_enabled: data.notificationsFanoutEnabled,
          short_description: data.description,
          notes: data.notes,
          active: data.active,
        };
        const res = await fetchApi(`/api/clients/${companyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.status === 401) {
          toast.error("SessÃ£o expirada. FaÃ§a login novamente.");
          router.replace("/login");
          return;
        }
        if (!res.ok) {
          const err = await readApiError(res, "Erro ao atualizar empresa");
          toast.error(err.displayMessage);
          return;
        }
        const updated = await res.json().catch(() => null);
        if (updated) {
          setCompanies((prev) => prev.map((c) => (c.id === companyId ? mapClient(updated) : c)));
          await refreshUser();
          toast.success("Empresa atualizada com sucesso");
          setOpenCompanyDetail(false);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao atualizar empresa";
        toast.error(msg);
      }
    },
    [refreshUser, router]
  );

  // ========================================================================
  // USERS TAB FUNCTIONS
  // ========================================================================

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const [usersRes, companiesRes] = await Promise.all([fetchApi("/api/admin/users"), fetchApi("/api/companies")]);

      if (usersRes.status === 401 || companiesRes.status === 401) {
        toast.error("SessÃ£o expirada. FaÃ§a login novamente.");
        router.replace("/login");
        return;
      }

      const usersJson = (await usersRes.json().catch(() => ({ items: [] }))) as { items?: UserItem[]; error?: string };
      const companiesJson = (await companiesRes.json().catch(() => ([]))) as CompanyOption[] | { error?: string };

      if (!usersRes.ok) {
        setUsersError(usersJson.error || "NÃ£o foi possÃ­vel carregar os usuÃ¡rios.");
        setUsers([]);
      } else {
        const items = Array.isArray(usersJson.items) ? usersJson.items : [];
        setUsers(items);
      }

      if (companiesRes.ok) {
        setUsersCompanies(Array.isArray(companiesJson) ? companiesJson : []);
      } else {
        setUsersCompanies([]);
      }
    } catch (err) {
      setUsers([]);
      setUsersCompanies([]);
      setUsersError(err instanceof Error ? err.message : "NÃ£o foi possÃ­vel carregar os usuÃ¡rios.");
    } finally {
      setUsersLoading(false);
    }
  }, [router]);

  const loadCurrentTab = useCallback(() => {
    const loader = mainTab === "companies" ? loadCompanies : loadUsers;
    loader().catch((error) => {
      const message = error instanceof Error ? error.message : "NÃ£o foi possÃ­vel carregar os dados.";
      if (mainTab === "companies") {
        setCompaniesMessage(message);
      } else {
        setUsersError(message);
      }
    });
  }, [loadCompanies, loadUsers, mainTab]);

  // ========================================================================
  // INITIAL LOAD
  // ========================================================================

  useEffect(() => {
    loadCurrentTab();
  }, [loadCurrentTab]);

  // URL ACTIONS - COMPANIES ONLY
  useEffect(() => {
    const modalParam = searchParams.get("modal");
    const focusParam = searchParams.get("focus");
    const roleParam = searchParams.get("role");
    const rolePreset = normalizeFixedProfileKind(roleParam);
    const roleTab = resolveUserTabFromRole(roleParam);
    const userTabParam = resolveUserTabParam(searchParams.get("userTab") ?? searchParams.get("section"));
    const adminTabParam = resolveAdminTabParam(searchParams.get("tab"));
    const queryParam = (searchParams.get("q") ?? searchParams.get("search") ?? "").trim();

    if (adminTabParam) {
      setMainTab(adminTabParam);
    }

    if (userTabParam || roleTab) {
      setMainTab("users");
      setActiveUserTab(userTabParam ?? roleTab ?? "company");
    }

    if (queryParam) {
      if ((adminTabParam ?? mainTab) !== "users" && !roleTab && !userTabParam) {
        setMainTab("companies");
      }
      setCompaniesSearch(queryParam);
    }

    setCreateRolePreset(rolePreset);

    if (modalParam === "create" && rolePreset) {
      setMainTab("users");
      setActiveUserTab(roleTab ?? "company");
      setSelectedUser(null);
      setOpenUserDetail(false);
      setOpenCreateUser(true);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (modalParam === "create") {
      setMainTab("companies");
      setSelectedCompanyId(null);
      setOpenCompanyDetail(false);
      setOpenCreateCompany(true);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (focusParam === "search") {
      setMainTab("companies");
      window.setTimeout(() => {
        companiesSearchInputRef.current?.focus();
      }, 100);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [mainTab, searchParams]);

  // ========================================================================
  // COMPANIES TAB COMPUTED VALUES
  // ========================================================================

  const filteredCompanies = useMemo(() => {
    const term = companiesSearch.trim().toLowerCase();
    if (!term) return companies;
    return companies.filter((client) =>
      [client.name, client.slug, client.taxId, client.website, client.phone, client.address]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [companies, companiesSearch]);

  const activeCompaniesCount = useMemo(() => companies.filter((item) => item.active).length, [companies]);
  const inactiveCompaniesCount = useMemo(() => Math.max(0, companies.length - activeCompaniesCount), [companies.length, activeCompaniesCount]);

  // ========================================================================
  // USERS TAB COMPUTED VALUES & SORTING
  // ========================================================================

  const sortUsers = useCallback((items: UserItem[]) => [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })), []);

  const searchedUsers = useMemo(() => {
    const term = normalize(usersSearch);
    if (!term) return users;
    return users.filter((user) => {
      const haystack = [user.name, user.user, user.email, ...(user.company_names ?? []), profileLabel(user)]
        .map(normalize)
        .join(" ");
      return haystack.includes(term);
    });
  }, [usersSearch, users]);

  const companyAccounts = useMemo(
    () => sortUsers(searchedUsers.filter((user) => normalizeProfileKind(user) === "empresa")),
    [searchedUsers, sortUsers]
  );

  const companyProfileUsers = useMemo(
    () => sortUsers(searchedUsers.filter((user) => normalizeProfileKind(user) === "company_user")),
    [searchedUsers, sortUsers]
  );

  const testingCompanyUsers = useMemo(
    () => sortUsers(searchedUsers.filter((user) => normalizeProfileKind(user) === "testing_company_user")),
    [searchedUsers, sortUsers]
  );

  const adminUsers = useMemo(
    () => sortUsers(searchedUsers.filter((user) => normalizeProfileKind(user) === "leader_tc")),
    [searchedUsers, sortUsers]
  );

  const supportUsers = useMemo(
    () => sortUsers(searchedUsers.filter((user) => normalizeProfileKind(user) === "technical_support")),
    [searchedUsers, sortUsers]
  );

  const testingActiveUsers = useMemo(() => testingCompanyUsers.filter((user) => !isInactiveUser(user)), [testingCompanyUsers]);
  const testingInactiveUsers = useMemo(() => testingCompanyUsers.filter((user) => isInactiveUser(user)), [testingCompanyUsers]);
  const adminActiveUsers = useMemo(() => adminUsers.filter((user) => !isInactiveUser(user)), [adminUsers]);
  const adminInactiveUsers = useMemo(() => adminUsers.filter((user) => isInactiveUser(user)), [adminUsers]);
  const supportActiveUsers = useMemo(() => supportUsers.filter((user) => !isInactiveUser(user)), [supportUsers]);
  const supportInactiveUsers = useMemo(() => supportUsers.filter((user) => isInactiveUser(user)), [supportUsers]);

  const companyAccountSections = useMemo<CompanySection[]>(
    () =>
      usersCompanies
        .map((company) => ({
          id: company.id,
          name: company.name,
          users: sortUsers(companyAccounts.filter((user) => (user.company_ids ?? []).includes(company.id))),
        }))
        .filter((company) => company.users.length > 0),
    [usersCompanies, companyAccounts, sortUsers]
  );

  const companySections = useMemo<CompanySection[]>(
    () =>
      usersCompanies
        .map((company) => ({
          id: company.id,
          name: company.name,
          users: sortUsers(companyProfileUsers.filter((user) => (user.company_ids ?? []).includes(company.id))),
        }))
        .filter((company) => company.users.length > 0),
    [usersCompanies, companyProfileUsers, sortUsers]
  );

  const totalUsersCount = users.length;
  const testingUsersCount = useMemo(() => users.filter((user) => normalizeProfileKind(user) === "testing_company_user").length, [users]);
  const adminUsersCount = useMemo(() => users.filter((user) => normalizeProfileKind(user) === "leader_tc").length, [users]);
  const supportUsersCount = useMemo(() => users.filter((user) => normalizeProfileKind(user) === "technical_support").length, [users]);

  const createModalConfig = useMemo<CreateModalConfig>(() => {
    if (activeUserTab === "company") {
      return {
        title: "Criar usuÃ¡rio da empresa",
        subtitle: "Selecione a empresa e cadastre o responsÃ¡vel jÃ¡ no contexto dela.",
        submitLabel: "Criar usuÃ¡rio da empresa",
        initialRole: "company_user",
        lockRole: true,
        showCompanyField: true,
        requireCompanySelection: true,
        companyOptional: false,
      };
    }

    if (activeUserTab === "admin") {
      return {
        title: "Criar Lider TC",
        subtitle: "Cadastre perfis de Lider TC com acesso total ao sistema.",
        submitLabel: "Criar Lider TC",
        initialRole: "leader_tc",
        lockRole: true,
        showCompanyField: false,
        requireCompanySelection: false,
        companyOptional: true,
      };
    }

    if (activeUserTab === "support") {
      return {
        title: "Criar Suporte TÃ©cnico",
        subtitle: "Cadastre contas tecnicas internas da Testing Company.",
        submitLabel: "Criar Suporte TÃ©cnico",
        initialRole: "technical_support",
        lockRole: true,
        showCompanyField: false,
        requireCompanySelection: false,
        companyOptional: true,
      };
    }

    return {
      title: "Criar usuÃ¡rio TC",
      subtitle: "Cadastre a pessoa da Testing Company e vincule a uma empresa quando necessÃ¡rio.",
      submitLabel: "Criar usuÃ¡rio TC",
      initialRole: "testing_company_user",
      lockRole: true,
      showCompanyField: true,
      requireCompanySelection: true,
      companyOptional: false,
    };
  }, [activeUserTab]);

  const currentUserTabTotal =
    activeUserTab === "company"
      ? companyAccounts.length + companyProfileUsers.length
      : activeUserTab === "testing"
        ? testingCompanyUsers.length
        : activeUserTab === "support"
          ? supportUsers.length
          : adminUsers.length;

  const userHasSearch = !!usersSearch.trim();

  const handleOpenUserDetail = useCallback((item: UserItem) => {
    setSelectedUser(item);
    setOpenCreateUser(false);
    setOpenUserDetail(true);
  }, []);

  const handleUserModalClose = useCallback(() => {
    setOpenCreateUser(false);
    setOpenUserDetail(false);
    setSelectedUser(null);
  }, []);

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto flex w-full max-w-550 flex-col gap-4 px-0 py-0">
        <Breadcrumb
          items={[
            { label: "Admin", href: "/admin/dashboard" },
            { label: "GestÃ£o de empresas" },
          ]}
        />

        {/* MAIN TAB SELECTOR */}
        <section className="overflow-hidden rounded-4xl border border-white/10 bg-[linear-gradient(135deg,#011848_0%,#082457_38%,#4b0f2f_72%,#ef0001_100%)] px-6 py-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:px-8">
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">GestÃ£o de empresas</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">Empresas</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/82">
                Gerencie o cadastro, listagem e identidade institucional das empresas.
              </p>
            </div>

            {/* MAIN TAB NAVIGATION */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMainTab("companies")}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  mainTab === "companies"
                    ? "border border-white/30 bg-white/15 text-white"
                    : "border border-white/12 bg-white/8 text-white/80 hover:bg-white/12"
                }`}
              >
                <FiHome className="h-4 w-4" /> Listagem ({companies.length})
              </button>
            </div>
          </div>
        </section>

        {/* COMPANIES TAB CONTENT */}
        {mainTab === "companies" && (
          <>
            {companiesMessage && (
              <p role="status" aria-live="polite" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {companiesMessage}
              </p>
            )}

            <CompanyManagementQueueExperience
              companies={companies}
              loading={companiesLoading}
              search={companiesSearch}
              onSearchChange={setCompaniesSearch}
              canCreate={canUseAdminClientTools}
              onCreate={() => {
                setSelectedCompanyId(null);
                setOpenCompanyDetail(false);
                setOpenCreateCompany(true);
              }}
              onRefresh={loadCompanies}
              onSelect={(company) => {
                setSelectedCompanyId(company.id);
                setOpenCompanyDetail(true);
              }}
              selectedId={selectedCompanyId}
              searchInputRef={companiesSearchInputRef}
            />

            <section className="hidden">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] lg:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--tc-text-muted,#6b7280)]">Carteira de empresas</p>
                  <h2 className="mt-2 text-2xl font-bold text-[var(--tc-text-primary,#0b1a3c)]">Lista de empresas</h2>
                  <p className="mt-1 text-sm text-[var(--tc-text-secondary,#4b5563)]">
                    Total: {companies.length} | Ativas: {activeCompaniesCount} | Inativas: {inactiveCompaniesCount}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {canUseAdminClientTools && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCompanyId(null);
                        setOpenCompanyDetail(false);
                        setOpenCreateCompany(true);
                      }}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] px-3.5 text-sm font-semibold text-[var(--tc-text-primary,#0b1a3c)] transition hover:border-[var(--tc-accent,#ef0001)]/30 hover:bg-white"
                    >
                      <FiPlus className="h-4 w-4" /> Cadastrar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={loadCompanies}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] px-3.5 text-sm font-semibold text-[var(--tc-text-primary,#0b1a3c)] transition hover:border-[var(--tc-accent,#ef0001)]/30 hover:bg-white disabled:opacity-60"
                    disabled={companiesLoading}
                  >
                    <FiRefreshCw className={`h-4 w-4 ${companiesLoading ? "animate-spin" : ""}`} /> Atualizar
                  </button>
                </div>
              </div>

              <label className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text-secondary,#4b5563)]">
                <FiSearch className="h-4 w-4 text-[var(--tc-text-muted,#6b7280)]" />
                <input
                  value={companiesSearch}
                  onChange={(event) => setCompaniesSearch(event.target.value)}
                  placeholder="Buscar por nome, slug, CNPJ, site ou telefone"
                  className="w-full bg-transparent outline-none placeholder:text-[var(--tc-text-muted,#94a3b8)]"
                />
              </label>

              {companiesLoading ? (
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="rounded-3xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] p-5">
                      <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
                      <div className="mt-4 flex items-start gap-3">
                        <div className="h-12 w-12 animate-pulse rounded-xl bg-slate-200" />
                        <div className="flex-1 space-y-2">
                          <div className="h-5 w-2/3 animate-pulse rounded-full bg-slate-200" />
                          <div className="h-4 w-1/2 animate-pulse rounded-full bg-slate-200" />
                          <div className="h-4 w-full animate-pulse rounded-full bg-slate-200" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {filteredCompanies.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setSelectedCompanyId(client.id);
                        setOpenCompanyDetail(true);
                      }}
                      className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-[var(--tc-border,#d7deea)] bg-white p-4 text-left transition hover:border-[var(--tc-accent,#ef0001)]/35 hover:shadow-[0_14px_32px_rgba(15,23,42,0.06)] cursor-pointer"
                    >
                      <div className="flex h-full flex-col gap-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)]">
                            <CompanyLogo
                              logoUrl={client.logoUrl}
                              slug={client.slug}
                              website={client.website}
                              name={client.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-[15px] font-bold leading-5 text-slate-900" title={client.name}>
                              {client.name}
                            </div>
                            <div className="mt-1 truncate text-sm text-slate-500">
                              {client.slug ? `@${client.slug}` : "Sem slug"}
                            </div>
                          </div>
                          <span
                            className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              client.active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {client.active ? "Ativa" : "Inativa"}
                          </span>
                        </div>
                        <div className="mt-auto flex items-center justify-end border-t border-[var(--tc-border,#eef2f7)] pt-3 text-xs">
                          <span className="font-semibold text-[var(--tc-accent,#ef0001)]">Ver detalhes</span>
                        </div>
                      </div>
                    </button>
                  ))}

                  {filteredCompanies.length === 0 && (
                    <div className="col-span-full text-sm text-[var(--tc-text-muted,#6b7280)]">
                      {canUseAdminClientTools ? (
                        <div className="mt-2 rounded-3xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] p-8 text-center">
                          <p className="text-xl font-bold text-[var(--tc-text-primary,#0b1a3c)]">
                            {companies.length === 0 ? "Nenhuma empresa cadastrada" : "Nenhuma empresa encontrada"}
                          </p>
                          <p className="mt-2 text-sm text-[var(--tc-text-secondary,#4b5563)]">
                            {companies.length === 0
                              ? "Cadastre a primeira empresa para iniciar a base da plataforma."
                              : "Ajuste a busca para encontrar outra empresa."}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCompanyId(null);
                              setOpenCompanyDetail(false);
                              setOpenCreateCompany(true);
                            }}
                            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#071e53_0%,#ef0001_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(239,0,1,0.18)] transition hover:opacity-95"
                          >
                            <FiPlus className="h-4 w-4" /> Cadastrar empresa
                          </button>
                        </div>
                      ) : (
                        <p>Nenhuma empresa encontrada.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}

        {/* USERS TAB CONTENT */}
        {mainTab === "users" && (
          <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
            <Tabs value={activeUserTab} onValueChange={(value) => setActiveUserTab(value as UserTab)}>
              <div className="border-b border-[var(--tc-border,#d7deea)] pb-5">
                <h2 className="text-2xl font-bold text-[var(--tc-text-primary,#0b1a3c)]">GestÃ£o por contexto</h2>
                <div className="mt-4">
                  <TabsList className="grid w-full grid-cols-1 gap-2 rounded-[22px] bg-[var(--tc-surface-alt,#f8fafc)] p-1.5 sm:grid-cols-2 xl:grid-cols-4">
                    <TabsTrigger value="company" className="min-h-15 rounded-[18px] px-4 text-sm font-semibold leading-5">
                      Empresa
                    </TabsTrigger>
                    <TabsTrigger value="testing" className="min-h-15 rounded-[18px] px-4 text-sm font-semibold leading-5">
                      UsuÃ¡rios TC
                    </TabsTrigger>
                    <TabsTrigger value="admin" className="min-h-15 rounded-[18px] px-4 text-sm font-semibold leading-5">
                      LÃ­der TC
                    </TabsTrigger>
                    <TabsTrigger value="support" className="min-h-15 rounded-[18px] px-4 text-sm font-semibold leading-5">
                      Suporte TÃ©cnico
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                <label className="flex flex-1 items-center gap-3 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text-secondary,#4b5563)]">
                  <FiSearch className="h-4 w-4 text-[var(--tc-text-muted,#6b7280)]" />
                  <input
                    ref={usersSearchInputRef}
                    value={usersSearch}
                    onChange={(event) => setUsersSearch(event.target.value)}
                    placeholder="Buscar por nome, usuÃ¡rio, e-mail ou empresa"
                    className="w-full bg-transparent outline-none placeholder:text-[var(--tc-text-muted,#94a3b8)]"
                    data-testid="users-search-input"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setOpenUserDetail(false);
                    setOpenCreateUser(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--tc-accent,#ef0001)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 lg:min-w-70"
                >
                  <FiUserPlus className="h-4 w-4" /> {createModalConfig.submitLabel}
                </button>
              </div>

              {usersError ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{usersError}</div> : null}

              {usersLoading ? (
                <div className="mt-6 grid gap-5 xl:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="rounded-3xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] p-5">
                      <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
                      <div className="mt-4 space-y-3">
                        {Array.from({ length: 3 }).map((__, rowIndex) => (
                          <div key={rowIndex} className="h-20 animate-pulse rounded-2xl bg-slate-200" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {userHasSearch ? (
                    <div className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] px-4 py-3 text-sm font-medium text-[var(--tc-text-secondary,#4b5563)]">
                      {currentUserTabTotal} resultado{currentUserTabTotal === 1 ? "" : "s"} encontrado{currentUserTabTotal === 1 ? "" : "s"}
                    </div>
                  ) : null}

                  <TabsContent value="company" className="mt-0">
                    {companySections.length === 0 && companyAccountSections.length === 0 ? (
                      <div className="flex min-h-65 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] px-6 text-center">
                        <FiUsers className="h-8 w-8 text-[var(--tc-text-muted,#6b7280)]" />
                        <div>
                          <h3 className="text-xl font-bold text-[var(--tc-text-primary,#0b1a3c)]">Nenhum perfil encontrado</h3>
                          <p className="mt-2 text-sm text-[var(--tc-text-secondary,#4b5563)]">Nenhuma empresa ou usuÃ¡rios da empresa encontrados.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {companyAccountSections.length > 0 && (
                          <div>
                            <h3 className="mb-3 text-lg font-bold text-[var(--tc-text-primary,#0b1a3c)]">Empresas Institucionais</h3>
                            <div className="space-y-3">
                              {companyAccountSections.map((company) => (
                                <CompanyUsersSection key={`account-${company.id}`} company={company} onSelect={handleOpenUserDetail} />
                              ))}
                            </div>
                          </div>
                        )}
                        {companySections.length > 0 && (
                          <div>
                            <h3 className="mb-3 text-lg font-bold text-[var(--tc-text-primary,#0b1a3c)]">UsuÃ¡rios da Empresa</h3>
                            <div className="space-y-3">
                              {companySections.map((company) => (
                                <CompanyUsersSection key={`company-${company.id}`} company={company} onSelect={handleOpenUserDetail} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="testing" className="mt-0">
                    {testingCompanyUsers.length === 0 ? (
                      <div className="flex min-h-65 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] px-6 text-center">
                        <FiUser className="h-8 w-8 text-[var(--tc-text-muted,#6b7280)]" />
                        <div>
                          <h3 className="text-xl font-bold text-[var(--tc-text-primary,#0b1a3c)]">Nenhum usuÃ¡rio TC</h3>
                          <p className="mt-2 text-sm text-[var(--tc-text-secondary,#4b5563)]">NÃ£o hÃ¡ usuÃ¡rios TC com os filtros atuais.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {testingActiveUsers.length > 0 && (
                          <UserStatusSection title="Ativos" count={testingActiveUsers.length} emptyMessage="Nenhum usuÃ¡rio ativo.">
                            <UserCardGrid>
                              {testingActiveUsers.map((user) => (
                                <UserCard key={user.id} user={user} onSelect={handleOpenUserDetail} companyLabel={user.company_names?.[0] || "Testing Company"} />
                              ))}
                            </UserCardGrid>
                          </UserStatusSection>
                        )}
                        {testingInactiveUsers.length > 0 && (
                          <UserStatusSection title="Inativos" count={testingInactiveUsers.length} emptyMessage="Nenhum usuÃ¡rio inativo.">
                            <UserCardGrid>
                              {testingInactiveUsers.map((user) => (
                                <UserCard key={user.id} user={user} onSelect={handleOpenUserDetail} companyLabel={user.company_names?.[0] || "Testing Company"} />
                              ))}
                            </UserCardGrid>
                          </UserStatusSection>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="admin" className="mt-0">
                    {adminUsers.length === 0 ? (
                      <div className="flex min-h-65 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] px-6 text-center">
                        <FiShield className="h-8 w-8 text-[var(--tc-text-muted,#6b7280)]" />
                        <div>
                          <h3 className="text-xl font-bold text-[var(--tc-text-primary,#0b1a3c)]">Nenhum LÃ­der TC encontrado</h3>
                          <p className="mt-2 text-sm text-[var(--tc-text-secondary,#4b5563)]">Nenhum LÃ­der TC com os filtros atuais.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {adminActiveUsers.length > 0 && (
                          <UserStatusSection title="Ativos" count={adminActiveUsers.length} emptyMessage="Nenhum LÃ­der ativo.">
                            <UserCardGrid>
                              {adminActiveUsers.map((user) => (
                                <UserCard key={user.id} user={user} onSelect={handleOpenUserDetail} companyLabel={null} />
                              ))}
                            </UserCardGrid>
                          </UserStatusSection>
                        )}
                        {adminInactiveUsers.length > 0 && (
                          <UserStatusSection title="Inativos" count={adminInactiveUsers.length} emptyMessage="Nenhum LÃ­der inativo.">
                            <UserCardGrid>
                              {adminInactiveUsers.map((user) => (
                                <UserCard key={user.id} user={user} onSelect={handleOpenUserDetail} companyLabel={null} />
                              ))}
                            </UserCardGrid>
                          </UserStatusSection>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="support" className="mt-0">
                    {supportUsers.length === 0 ? (
                      <div className="flex min-h-65 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-alt,#f8fafc)] px-6 text-center">
                        <FiTool className="h-8 w-8 text-[var(--tc-text-muted,#6b7280)]" />
                        <div>
                          <h3 className="text-xl font-bold text-[var(--tc-text-primary,#0b1a3c)]">Nenhum suporte tÃ©cnico encontrado</h3>
                          <p className="mt-2 text-sm text-[var(--tc-text-secondary,#4b5563)]">Nenhum suporte tÃ©cnico com os filtros atuais.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {supportActiveUsers.length > 0 && (
                          <UserStatusSection title="Ativos" count={supportActiveUsers.length} emptyMessage="Nenhum suporte ativo.">
                            <UserCardGrid>
                              {supportActiveUsers.map((user) => (
                                <UserCard key={user.id} user={user} onSelect={handleOpenUserDetail} companyLabel={null} />
                              ))}
                            </UserCardGrid>
                          </UserStatusSection>
                        )}
                        {supportInactiveUsers.length > 0 && (
                          <UserStatusSection title="Inativos" count={supportInactiveUsers.length} emptyMessage="Nenhum suporte inativo.">
                            <UserCardGrid>
                              {supportInactiveUsers.map((user) => (
                                <UserCard key={user.id} user={user} onSelect={handleOpenUserDetail} companyLabel={null} />
                              ))}
                            </UserCardGrid>
                          </UserStatusSection>
                        )}
                      </div>
                    )}
                  </TabsContent>
                </div>
              )}
            </Tabs>
          </section>
        )}
      </div>

      {/* MODALS */}
      <CreateClientModal
        open={openCreateCompany || openCompanyDetail}
        mode={openCompanyDetail ? "view" : "create"}
        clientId={selectedCompanyId}
        onClose={() => {
          setOpenCreateCompany(false);
          setOpenCompanyDetail(false);
          setSelectedCompanyId(null);
        }}
        onCreate={async (data: ClientFormValues) => {
          try {
            const normalizedCodes = Array.isArray(data.qaseProjectCodes)
              ? data.qaseProjectCodes.map((c) => (typeof c === "string" ? c.trim().toUpperCase() : String(c).trim().toUpperCase())).filter(Boolean)
              : typeof data.qaseProjectCode === "string"
              ? [data.qaseProjectCode.trim().toUpperCase()]
              : [];
            const legacyProjectCode = data.integrationMode === "qase" ? (normalizedCodes.length ? normalizedCodes[0] : null) : undefined;
            const address = [data.zip, data.address ?? data.description].filter(Boolean).join(" | ");
            const payload = {
              name: data.name,
              company_name: data.name,
              tax_id: data.taxId,
              address: address || undefined,
              address_number: data.addressNumber || undefined,
              address_detail: data.addressDetail || undefined,
              phone: data.phone,
              website: data.website,
              logo_url: data.logoUrl,
              linkedin_url: data.linkedin,
              notes: data.notes,
              active: data.active,
              description: data.description,
              integration_mode: data.integrationMode,
              qase_token: data.qaseToken || undefined,
              notifications_fanout_enabled: data.notificationsFanoutEnabled ?? true,
              admin_email: data.adminEmail || undefined,
              qase_project_codes: normalizedCodes,
              qase_project_code: legacyProjectCode ?? null,
              integrations: (() => {
                const items: any[] = [];
                if (data.qaseToken || (Array.isArray(data.qaseProjectCodes) && data.qaseProjectCodes.length)) {
                  items.push({ type: "QASE", config: { token: data.qaseToken || null, projects: data.qaseProjectCodes || [] } });
                }
                return items.length ? items : undefined;
              })(),
            };
            const res = await fetchApi("/api/clients", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (res.status === 401) {
              toast.error("SessÃ£o expirada. FaÃ§a login novamente.");
              router.replace("/login");
              return null;
            }
            if (!res.ok) {
              const err = await readApiError(res, "Erro ao criar cliente");
              setCompaniesMessage(err.message);
              toast.error(err.displayMessage);
              return null;
            }
            const created = await res.json().catch(() => null);
            if (created) {
              const createdCompany = mapClient(created);
              setCompanies((prev) => [createdCompany, ...prev]);
              await createInstitutionalCompanyUser(createdCompany, data);
              await refreshUser();
              toast.success("Empresa cadastrada");
              setOpenCreateCompany(false);
              return created;
            }
            return null;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Erro ao criar cliente";
            setCompaniesMessage(msg);
            toast.error(msg);
            return null;
          }
        }}
        onUpdate={handleUpdateCompany}
        onOpenUser={() => {}}
      />

      <CreateUserModal
        open={openCreateUser || openUserDetail}
        mode={openUserDetail ? "view" : "create"}
        userId={selectedUser?.id ?? null}
        initialData={
          selectedUser
            ? {
                name: selectedUser.name,
                login: selectedUser.user ?? null,
                email: selectedUser.email,
                phone: selectedUser.phone ?? null,
                role: normalizeProfileKind(selectedUser),
                jobTitle: selectedUser.job_title ?? null,
                linkedin: selectedUser.linkedin_url ?? null,
                avatarUrl: selectedUser.avatar_url ?? null,
                clientId: selectedUser.client_id ?? selectedUser.company_ids?.[0] ?? null,
                active: typeof selectedUser.active === "boolean" ? selectedUser.active : selectedUser.status === "active",
              }
            : undefined
        }
        clientId={selectedUser?.client_id ?? selectedUser?.company_ids?.[0] ?? null}
        clients={usersCompanies}
        companyOptional={createModalConfig.companyOptional}
        showCompanyField={createModalConfig.showCompanyField}
        requireCompanySelection={createModalConfig.requireCompanySelection}
        initialRole={createRolePreset ?? createModalConfig.initialRole}
        lockRole={createModalConfig.lockRole}
        allowedRoles={createModalConfig.allowedRoles}
        title={createModalConfig.title}
        subtitle={createModalConfig.subtitle}
        submitLabel={createModalConfig.submitLabel}
        onClose={handleUserModalClose}
        onCreated={async () => {
          handleUserModalClose();
          await loadUsers();
        }}
        onUpdated={async () => {
          handleUserModalClose();
          await loadUsers();
        }}
      />
    </div>
  );
}

