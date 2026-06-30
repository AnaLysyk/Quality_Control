"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  FiChevronLeft,
  FiChevronRight,
  FiCircle,
  FiHome,
  FiSearch,
  FiShield,
  FiTool,
  FiUser,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";

import Breadcrumb from "@/components/Breadcrumb";
import AccessDeniedState from "@/components/access/AccessDeniedState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { fetchApi } from "@/lib/api";
import { CreateUserModal } from "@/admin/users/components/CreateUserModal";
import { UserDetailsModal } from "@/admin/users/components/UserDetailsModal";
import { canAccess } from "@/lib/permissions/can-access";
import {
  getFixedProfileLabel,
  getFixedProfileTone,
  normalizeFixedProfileKind,
  resolveFixedProfileKind,
  type FixedProfileKind,
} from "@/lib/fixedProfilePresentation";

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

function normalize(text?: string | null) {
  return (text ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function getInitials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "US";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

function normalizeProfileKind(user?: Pick<UserItem, "profile_kind" | "permission_role"> | null) {
  return resolveFixedProfileKind({
    profileKind: user?.profile_kind,
    permissionRole: user?.permission_role,
  });
}

function profileLabel(user?: Pick<UserItem, "profile_kind" | "permission_role"> | null) {
  return getFixedProfileLabel(normalizeProfileKind(user), { short: true });
}

function roleTone(user?: Pick<UserItem, "profile_kind" | "permission_role"> | null) {
  return getFixedProfileTone(normalizeProfileKind(user));
}

function contextBadgeLabel(user: UserItem) {
  return profileLabel(user);
}

function getUserHandle(user?: Pick<UserItem, "user"> | null) {
  return user?.user ? `@${user.user}` : "Sem login visivel";
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

function UserAvatar({ user, size = "md" }: { user: UserItem; size?: "md" | "lg" }) {
  const sizeClassName = size === "lg" ? "h-14 w-14 text-base" : "h-12 w-12 text-sm";

  if (user.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatar_url} alt={user.name} className={`block aspect-square ${sizeClassName} rounded-full object-cover`} />
    );
  }

  return (
    <div className={`flex aspect-square items-center justify-center rounded-full bg-slate-100 font-bold text-(--tc-text-primary,#0b1a3c) ${sizeClassName}`}>
      {getInitials(user.name)}
    </div>
  );
}

function UserInlineField({ label, value, valueClassName = "" }: { label: string; value: string; valueClassName?: string }) {
  return (
    <p className="text-[15px] leading-7 text-(--tc-text-secondary,#4b5563) sm:text-base">
      <span className="font-medium text-(--tc-text-secondary,#4b5563)">{label}: </span>
      <span className={`font-semibold text-(--tc-text-primary,#0b1a3c) ${valueClassName}`} title={value}>
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
  onSelect?: (user: UserItem) => void;
  companyLabel?: string | null;
  showCompanyField?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(user)}
      disabled={!onSelect}
      className={`group w-full rounded-[22px] border border-(--tc-border,#d7deea) bg-white px-4 py-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition sm:px-5 sm:py-5 ${
        onSelect ? "hover:border-(--tc-accent,#ef0001)/22 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)]" : "cursor-default"
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-5">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <UserAvatar user={user} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-[1.9rem] font-semibold leading-none tracking-tight text-(--tc-text-primary,#0b1a3c) sm:text-[2rem]">
              {user.name}
            </p>
            <div className="mt-3 space-y-1">
              <UserInlineField label="Usuário" value={getUserHandle(user)} valueClassName="break-all" />
              <UserInlineField label="E-mail" value={user.email} valueClassName="break-all" />
              <UserInlineField label="Cargo" value={user.job_title || "Não informado"} valueClassName="break-words" />
              {showCompanyField && companyLabel ? <UserInlineField label="Empresa" value={companyLabel} valueClassName="break-words" /> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:max-w-55 md:justify-end">
          <span
            className={`inline-flex max-w-full rounded-full border px-3 py-1.5 text-sm font-semibold ${roleTone(user)}`}
            title={contextBadgeLabel(user)}
          >
            <span className="truncate">{contextBadgeLabel(user)}</span>
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
    <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between border-b border-(--tc-border,#d7deea) pb-4">
        <h3 className="text-lg font-bold text-(--tc-text-primary,#0b1a3c)">{title}</h3>
        <span className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-3 py-1 text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">
          {count}
        </span>
      </div>

      {count === 0 ? (
        <div className="mt-4 rounded-[18px] border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-6 text-sm text-(--tc-text-secondary,#4b5563)">
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
  onSelect?: (user: UserItem) => void;
}) {
  return (
    <section className="rounded-[20px] border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) p-3.5 sm:p-4">
      <div className="flex flex-col gap-2 border-b border-(--tc-border,#d7deea) pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h4 className="truncate text-lg font-bold text-(--tc-text-primary,#0b1a3c)">{company.name}</h4>
          <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">
            {company.users.length} perfil{company.users.length === 1 ? "" : "is"} vinculado{company.users.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">
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

type UserStatusFilter = "all" | "active" | "inactive";
type UserSortMode = "name_asc" | "name_desc" | "profile_asc" | "company_asc" | "status_active_first" | "status_inactive_first";

function userStatusFilterLabel(value: UserStatusFilter) {
  if (value === "active") return "Ativos";
  if (value === "inactive") return "Inativos";
  return "Todos";
}

function userStatusDotClass(value: UserStatusFilter) {
  if (value === "active") return "text-emerald-500";
  if (value === "inactive") return "text-amber-500";
  return "text-sky-500";
}

function compareQueueText(left?: string | null, right?: string | null) {
  return (left || "").localeCompare(right || "", "pt-BR", { sensitivity: "base" });
}

function userSortLabel(value: UserSortMode) {
  if (value === "name_desc") return "Nome Z-A";
  if (value === "profile_asc") return "Perfil";
  if (value === "company_asc") return "Empresa";
  if (value === "status_active_first") return "Ativos primeiro";
  if (value === "status_inactive_first") return "Inativos primeiro";
  return "Nome A-Z";
}

function UserManagementQueueExperience({
  title,
  description,
  users,
  loading,
  search,
  onSearchChange,
  canCreate,
  createLabel,
  onCreate,
  onSelect,
  selectedId,
  emptyTitle,
  emptyDescription,
  searchInputRef,
  profileBadgeMode = "profile",
}: {
  title: string;
  description: string;
  users: UserItem[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  canCreate: boolean;
  createLabel: string;
  onCreate: () => void;
  onSelect?: (user: UserItem) => void;
  selectedId?: string | null;
  emptyTitle: string;
  emptyDescription: string;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  profileBadgeMode?: "profile" | "company";
}) {
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");
  const [sortMode, setSortMode] = useState<UserSortMode>("name_asc");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(12);

  const activeCount = useMemo(() => users.filter((user) => !isInactiveUser(user)).length, [users]);
  const inactiveCount = useMemo(() => users.filter((user) => isInactiveUser(user)).length, [users]);
  const filteredUsers = useMemo(() => {
    const next =
      statusFilter === "active"
        ? users.filter((user) => !isInactiveUser(user))
        : statusFilter === "inactive"
          ? users.filter((user) => isInactiveUser(user))
          : [...users];

    return next.sort((left, right) => {
      if (sortMode === "name_desc") return compareQueueText(right.name, left.name);
      if (sortMode === "profile_asc") return compareQueueText(profileLabel(left), profileLabel(right)) || compareQueueText(left.name, right.name);
      if (sortMode === "company_asc") return compareQueueText(left.company_names?.[0], right.company_names?.[0]) || compareQueueText(left.name, right.name);
      if (sortMode === "status_active_first") return Number(isInactiveUser(left)) - Number(isInactiveUser(right)) || compareQueueText(left.name, right.name);
      if (sortMode === "status_inactive_first") return Number(isInactiveUser(right)) - Number(isInactiveUser(left)) || compareQueueText(left.name, right.name);
      return compareQueueText(left.name, right.name);
    });
  }, [sortMode, statusFilter, users]);
  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const visibleUsers = useMemo(
    () => filteredUsers.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
    [filteredUsers, pageIndex, pageSize],
  );

  useEffect(() => {
    setPageIndex(0);
  }, [search, statusFilter, users.length]);

  useEffect(() => {
    setPageIndex((current) => Math.min(current, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  const statusOptions: Array<{ value: UserStatusFilter; label: string; count: number }> = [
    { value: "all", label: "Todos", count: users.length },
    { value: "active", label: "Ativos", count: activeCount },
    { value: "inactive", label: "Inativos", count: inactiveCount },
  ];

  return (
    <section className="tc-queue-shell mt-5 overflow-hidden rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text-primary,#0b1a3c) shadow-[0_18px_54px_rgba(15,23,42,0.09)]">
      <div className="border-b border-(--tc-border,#d7deea) bg-[linear-gradient(135deg,var(--tc-surface,#ffffff)_0%,var(--tc-surface-2,#f8fafc)_58%,rgba(14,165,233,0.08)_100%)] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">{title}</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{description}</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {canCreate ? (
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[linear-gradient(90deg,var(--tc-primary,#011848)_0%,var(--tc-accent,#ef0001)_100%)] px-4 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_14px_30px_rgba(239,0,1,0.22)] ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:opacity-95"
              >
                <FiUserPlus className="h-4 w-4" />
                {createLabel}
              </button>
            ) : null}

            <div className="inline-flex h-10 items-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3.5 text-(--tc-text-primary,#0b1a3c) shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">Total</span>
              <span className="text-base font-black leading-none text-(--tc-primary,#011848)">{users.length}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(260px,1fr)_190px_190px]">
          <label className="relative">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--tc-text-muted,#6b7280)" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar por nome, usuário, e-mail ou empresa"
              className="h-12 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) pl-11 pr-4 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) outline-none transition placeholder:text-(--tc-text-muted,#94a3b8) focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
              data-testid="users-search-input"
            />
          </label>

          <select
            aria-label="Filtrar usuários por status"
            title="Filtrar usuários por status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as UserStatusFilter)}
            className="h-12 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 text-sm font-black text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.count})
              </option>
            ))}
          </select>

          <select
            aria-label="Ordenar usuários"
            title="Ordenar usuários"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as UserSortMode)}
            className="h-12 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 text-sm font-black text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
          >
            <option value="name_asc">Nome A-Z</option>
            <option value="name_desc">Nome Z-A</option>
            <option value="profile_asc">Perfil</option>
            <option value="company_asc">Empresa</option>
            <option value="status_active_first">Ativos primeiro</option>
            <option value="status_inactive_first">Inativos primeiro</option>
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
                  : "border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text-secondary,#4b5563) hover:border-sky-300 hover:text-(--tc-text-primary,#0b1a3c)"
              }`}
            >
              <FiCircle className={`h-2 w-2 ${statusFilter === option.value ? "text-white" : userStatusDotClass(option.value)}`} />
              {option.label}
              <span className="opacity-75">{option.count}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-sm font-semibold text-(--tc-text-muted,#6b7280)">Carregando usuários...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex min-h-90 items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-(--tc-surface-2,#f8fafc) text-(--tc-text-muted,#6b7280)">
              <FiSearch className="h-7 w-7" />
            </div>
            <h3 className="mt-5 text-xl font-black text-(--tc-text-primary,#0b1a3c)">{emptyTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{emptyDescription}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="hidden max-h-[calc(100vh-332px)] overflow-auto lg:block">
            <table className="w-full min-w-230 border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 bg-(--tc-surface,#ffffff) shadow-[0_1px_0_var(--tc-border,#d7deea)]">
                <tr>
                  {["Usuário", "Perfil", "Empresa", "Cargo", "Status", "Ação"].map((column) => (
                    <th key={column} className="whitespace-nowrap border-b border-(--tc-border,#d7deea) px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => {
                  const active = user.id === selectedId;
                  return (
                  <tr
                    key={user.id}
                    onClick={() => onSelect?.(user)}
                    onKeyDown={(event) => {
                      if (!onSelect) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(user);
                      }
                    }}
                    role={onSelect ? "button" : undefined}
                    tabIndex={onSelect ? 0 : undefined}
                    className={`group transition ${onSelect ? "cursor-pointer" : ""} ${
                      active
                        ? "bg-sky-50/90 shadow-[inset_4px_0_0_#0284c7] dark:bg-sky-950/35"
                        : "odd:bg-(--tc-surface,#ffffff) even:bg-(--tc-surface-2,#f8fafc) hover:bg-sky-50/65 dark:hover:bg-sky-950/25"
                    }`}
                  >
                    <td className="border-b border-(--tc-border,#d7deea) px-4 py-3 align-middle">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar user={user} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-(--tc-text-primary,#0b1a3c)">{user.name}</p>
                          <p className="mt-0.5 truncate text-xs font-semibold text-(--tc-text-secondary,#4b5563)">{getUserHandle(user)} · {user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-(--tc-border,#d7deea) px-4 py-3 align-middle">
                      <span className={`inline-flex max-w-52 rounded-full border px-3 py-1.5 text-xs font-black ${roleTone(user)}`}>
                        <span className="truncate">{profileBadgeMode === "company" ? user.company_names?.[0] || "Sem empresa" : profileLabel(user)}</span>
                      </span>
                    </td>
                    <td className="border-b border-(--tc-border,#d7deea) px-4 py-3 text-sm font-semibold text-(--tc-text-secondary,#4b5563) align-middle">
                      {user.company_names?.[0] || "Sem empresa"}
                    </td>
                    <td className="border-b border-(--tc-border,#d7deea) px-4 py-3 text-sm font-semibold text-(--tc-text-secondary,#4b5563) align-middle">
                      {user.job_title || "Não informado"}
                    </td>
                    <td className="border-b border-(--tc-border,#d7deea) px-4 py-3 align-middle">
                      <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${statusTone(user)}`}>{statusLabel(user)}</span>
                    </td>
                    <td className="border-b border-(--tc-border,#d7deea) px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-(--tc-accent,#ef0001) align-middle">
                      {active ? "Selecionado" : onSelect ? "Ver detalhes" : "Somente leitura"}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 lg:hidden">
            {visibleUsers.map((user) => (
              <button
                key={`mobile-${user.id}`}
                type="button"
                onClick={() => onSelect?.(user)}
                disabled={!onSelect}
                className={`w-full rounded-[24px] border p-4 text-left shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 disabled:cursor-default ${
                  user.id === selectedId
                    ? "border-sky-300 bg-sky-50 shadow-[inset_4px_0_0_#0284c7] dark:border-sky-700/60 dark:bg-sky-950/35"
                    : "border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff)"
                }`}
              >
                <div className="flex items-start gap-3">
                  <UserAvatar user={user} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-black text-(--tc-text-primary,#0b1a3c)">{user.name}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${statusTone(user)}`}>{statusLabel(user)}</span>
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-(--tc-text-secondary,#4b5563)">{user.email}</p>
                    <p className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">{profileBadgeMode === "company" ? user.company_names?.[0] || "Sem empresa" : profileLabel(user)} · {user.company_names?.[0] || "Sem empresa"}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-5 py-4">
            <p className="text-sm font-semibold text-(--tc-text-secondary,#4b5563)">
              Página {pageIndex + 1} de {pageCount} · {filteredUsers.length} resultado(s) · {userStatusFilterLabel(statusFilter)} · {userSortLabel(sortMode)}
            </p>

            <div className="flex items-center gap-2">
              <select
                aria-label="Quantidade de usuários por página"
                title="Quantidade de usuários por página"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPageIndex(0);
                }}
                className="h-10 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-3 text-sm font-bold text-(--tc-text-primary,#0b1a3c)"
              >
                {[10, 12, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}/página
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                disabled={pageIndex === 0}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text-primary,#0b1a3c) transition hover:bg-(--tc-surface-2,#f8fafc) disabled:opacity-40"
                aria-label="Página anterior"
              >
                <FiChevronLeft />
              </button>

              <button
                type="button"
                onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))}
                disabled={pageIndex >= pageCount - 1}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text-primary,#0b1a3c) transition hover:bg-(--tc-surface-2,#f8fafc) disabled:opacity-40"
                aria-label="Próxima página"
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

export default function AdminUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessContext, loading: accessLoading } = usePermissionAccess();
  const userAccess = useMemo(
    () => ({
      canViewUsers: canAccess(accessContext, "users.view"),
      canCreateUsers: canAccess(accessContext, "users.create"),
      canEditUsers: canAccess(accessContext, "users.edit"),
    }),
    [accessContext],
  );
  const [users, setUsers] = useState<UserItem[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<UserTab>(
    () => resolveUserTabParam(searchParams.get("tab")) ?? resolveUserTabFromRole(searchParams.get("role")) ?? "company",
  );
  const [search, setSearch] = useState("");
  const [companyUserCompanyFilter, setCompanyUserCompanyFilter] = useState("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const openCreateTokenRef = useRef<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [createRolePreset, setCreateRolePreset] = useState<FixedProfileKind | null>(null);

  const load = useCallback(async () => {
    if (!userAccess.canViewUsers) return;

    setLoading(true);

    setError(null);
    try {
      const [usersRes, companiesRes] = await Promise.all([fetchApi("/api/admin/users"), fetchApi("/api/companies")]);

      if (usersRes.status === 401 || companiesRes.status === 401) {
        toast.error("Sessao expirada. Faca login novamente.");
        router.replace("/login");
        return;
      }

      const usersJson = (await usersRes.json().catch(() => ({ items: [] }))) as { items?: UserItem[]; error?: string };
      const companiesJson = (await companiesRes.json().catch(() => ([]))) as CompanyOption[] | { error?: string };

      if (!usersRes.ok) {
        setError(usersJson.error || "Não foi possível carregar os usuários.");
        setUsers([]);
      } else {
        const items = Array.isArray(usersJson.items) ? usersJson.items : [];
        setUsers(items);
      }

      if (companiesRes.ok) {
        setCompanies(Array.isArray(companiesJson) ? companiesJson : []);
      } else {
        setCompanies([]);
      }
    } catch (err) {
      setUsers([]);
      setCompanies([]);
      setError(err instanceof Error ? err.message : "Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  }, [router, userAccess.canViewUsers]);

  const loadUsersAndCompanies = useCallback(() => {
    load().catch((err) => {
      setUsers([]);
      setCompanies([]);
      setError(err instanceof Error ? err.message : "Não foi possível carregar os usuários.");
      setLoading(false);
    });
  }, [load]);

  useEffect(() => {
    if (accessLoading || !userAccess.canViewUsers) {
      setLoading(false);
      return;
    }
    loadUsersAndCompanies();
  }, [accessLoading, loadUsersAndCompanies, userAccess.canViewUsers]);


  const sortUsers = useCallback(
    (items: UserItem[]) => [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
    [],
  );

  useEffect(() => {
    const focusParam = searchParams.get("focus");
    const roleParam = searchParams.get("role");
    const modalParam = searchParams.get("modal");
    const tabParam = resolveUserTabParam(searchParams.get("tab"));
    const roleTab = resolveUserTabFromRole(roleParam);
    const queryParam = (searchParams.get("q") ?? searchParams.get("search") ?? "").trim();

    if (tabParam || roleTab) {
      setActiveTab(tabParam ?? roleTab ?? "company");
    }

    if (queryParam) {
      setSearch(queryParam);
    }

    if (focusParam === "search" && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
        window.history.replaceState({}, "", window.location.pathname);
      }, 100);
    }

    const rolePreset = normalizeFixedProfileKind(roleParam);
    setCreateRolePreset(rolePreset);

    if (userAccess.canCreateUsers && (modalParam === "create" || searchParams.get("create") === "1")) {
      const token = searchParams.toString();
      if (openCreateTokenRef.current !== token) {
        openCreateTokenRef.current = token;
        setSelectedUser(null);
        setOpenCreate(true);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [searchParams, userAccess.canCreateUsers]);

  const searchedUsers = useMemo(() => {
    const term = normalize(search);
    if (!term) return users;
    return users.filter((user) => {
      const haystack = [user.name, user.user, user.email, ...(user.company_names ?? []), profileLabel(user)]
        .map(normalize)
        .join(" ");
      return haystack.includes(term);
    });
  }, [search, users]);

  const companyAccounts = useMemo(
    () => sortUsers(searchedUsers.filter((user) => normalizeProfileKind(user) === "empresa")),
    [searchedUsers, sortUsers],
  );
  const companyProfileUsers = useMemo(
    () => sortUsers(searchedUsers.filter((user) => normalizeProfileKind(user) === "company_user")),
    [searchedUsers, sortUsers],
  );

  const companyUserCompanyFilterOptions = useMemo(() => {
    const options = companies
      .map((company) => ({
        value: company.id,
        label: company.name,
        count: companyProfileUsers.filter((user) => (user.company_ids ?? []).includes(company.id)).length,
      }))
      .filter((option) => option.count > 0)
      .sort((left, right) => left.label.localeCompare(right.label, "pt-BR", { sensitivity: "base" }));

    return [
      {
        value: "all",
        label: "Todas as empresas",
        count: companyProfileUsers.length,
      },
      ...options,
    ];
  }, [companies, companyProfileUsers]);

  useEffect(() => {
    if (companyUserCompanyFilter === "all") return;

    const exists = companyUserCompanyFilterOptions.some((option) => option.value === companyUserCompanyFilter);
    if (!exists) setCompanyUserCompanyFilter("all");
  }, [companyUserCompanyFilter, companyUserCompanyFilterOptions]);

  const testingCompanyUsers = useMemo(
    () => sortUsers(searchedUsers.filter((user) => normalizeProfileKind(user) === "testing_company_user")),
    [searchedUsers, sortUsers],
  );

  const adminUsers = useMemo(
    () => sortUsers(searchedUsers.filter((user) => normalizeProfileKind(user) === "leader_tc")),
    [searchedUsers, sortUsers],
  );
  const supportUsers = useMemo(
    () => sortUsers(searchedUsers.filter((user) => normalizeProfileKind(user) === "technical_support")),
    [searchedUsers, sortUsers],
  );

  const testingActiveUsers = useMemo(() => testingCompanyUsers.filter((user) => !isInactiveUser(user)), [testingCompanyUsers]);
  const testingInactiveUsers = useMemo(() => testingCompanyUsers.filter((user) => isInactiveUser(user)), [testingCompanyUsers]);
  const adminActiveUsers = useMemo(() => adminUsers.filter((user) => !isInactiveUser(user)), [adminUsers]);
  const adminInactiveUsers = useMemo(() => adminUsers.filter((user) => isInactiveUser(user)), [adminUsers]);
  const supportActiveUsers = useMemo(() => supportUsers.filter((user) => !isInactiveUser(user)), [supportUsers]);
  const supportInactiveUsers = useMemo(() => supportUsers.filter((user) => isInactiveUser(user)), [supportUsers]);

  const companyAccountSections = useMemo<CompanySection[]>(
    () =>
      companies
        .map((company) => ({
          id: company.id,
          name: company.name,
          users: sortUsers(companyAccounts.filter((user) => (user.company_ids ?? []).includes(company.id))),
        }))
        .filter((company) => company.users.length > 0),
    [companies, companyAccounts, sortUsers],
  );
  const companySections = useMemo<CompanySection[]>(
    () =>
      companies
        .map((company) => ({
          id: company.id,
          name: company.name,
          users: sortUsers(companyProfileUsers.filter((user) => (user.company_ids ?? []).includes(company.id))),
        }))
        .filter((company) => company.users.length > 0),
    [companies, companyProfileUsers, sortUsers],
  );
  const companyActiveAccountSections = useMemo(
    () =>
      companyAccountSections
        .map((company) => ({
          ...company,
          users: company.users.filter((user) => !isInactiveUser(user)),
        }))
        .filter((company) => company.users.length > 0),
    [companyAccountSections],
  );
  const companyInactiveAccountSections = useMemo(
    () =>
      companyAccountSections
        .map((company) => ({
          ...company,
          users: company.users.filter((user) => isInactiveUser(user)),
        }))
        .filter((company) => company.users.length > 0),
    [companyAccountSections],
  );
  const companyActiveSections = useMemo(
    () =>
      companySections
        .map((company) => ({
          ...company,
          users: company.users.filter((user) => !isInactiveUser(user)),
        }))
        .filter((company) => company.users.length > 0),
    [companySections],
  );
  const companyInactiveSections = useMemo(
    () =>
      companySections
        .map((company) => ({
          ...company,
          users: company.users.filter((user) => isInactiveUser(user)),
        }))
        .filter((company) => company.users.length > 0),
    [companySections],
  );

  const totalUsersCount = users.length;
  const companyAccountsCount = 0;
  const companyUsersCount = useMemo(() => users.filter((user) => normalizeProfileKind(user) === "company_user").length, [users]);
  const testingUsersCount = useMemo(() => users.filter((user) => normalizeProfileKind(user) === "testing_company_user").length, [users]);
  const adminUsersCount = useMemo(() => users.filter((user) => normalizeProfileKind(user) === "leader_tc").length, [users]);
  const supportUsersCount = useMemo(() => users.filter((user) => normalizeProfileKind(user) === "technical_support").length, [users]);

  const selectedModalUser = useMemo(
    () =>
      selectedUser
        ? {
            ...selectedUser,
            role: selectedUser.role ?? undefined,
            linkedin_url: selectedUser.linkedin_url ?? undefined,
            avatar_url: selectedUser.avatar_url ?? undefined,
            client_id: selectedUser.client_id ?? undefined,
            status: selectedUser.status ?? undefined,
          }
        : null,
    [selectedUser],
  );

  const createModalConfig = useMemo<CreateModalConfig>(() => {
    if (activeTab === "company") {
      return {
        title: "Criar usuário da empresa",
        subtitle: "Selecione a empresa e cadastre o responsável já no contexto dela.",
        submitLabel: "Criar usuário da empresa",
        initialRole: "company_user",
        lockRole: true,
        showCompanyField: true,
        requireCompanySelection: true,
        companyOptional: false,
      };
    }

    if (activeTab === "admin") {
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

    if (activeTab === "support") {
      return {
        title: "Criar Suporte Técnico",
        subtitle: "Cadastre contas tecnicas internas da Testing Company.",
        submitLabel: "Criar Suporte Técnico",
        initialRole: "technical_support",
        lockRole: true,
        showCompanyField: false,
        requireCompanySelection: false,
        companyOptional: true,
      };
    }

    return {
        title: "Criar usuário TC",
        subtitle: "Cadastre a pessoa da Testing Company e vincule a uma empresa quando necessário.",
        submitLabel: "Criar usuário TC",
      initialRole: "testing_company_user",
      lockRole: true,
      showCompanyField: true,
      requireCompanySelection: true,
      companyOptional: false,
    };
  }, [activeTab]);

  const currentTabTotal =
    activeTab === "company"
      ? companyProfileUsers.length
      : activeTab === "testing"
        ? testingCompanyUsers.length
        : activeTab === "support"
          ? supportUsers.length
          : adminUsers.length;
  const hasSearch = !!search.trim();
  const currentTabUsers = useMemo(() => {
    if (activeTab === "company") {
      if (companyUserCompanyFilter === "all") return companyProfileUsers;
      return companyProfileUsers.filter((user) => (user.company_ids ?? []).includes(companyUserCompanyFilter));
    }
    if (activeTab === "testing") return testingCompanyUsers;
    if (activeTab === "support") return supportUsers;
    return adminUsers;
  }, [activeTab, adminUsers, companyProfileUsers, companyUserCompanyFilter, supportUsers, testingCompanyUsers]);
  const currentTabCopy = useMemo(() => {
    if (activeTab === "testing") {
      return {
        title: "Fila de usuários TC",
        description: "Listagem operacional dos usuários internos vinculados às empresas.",
        emptyTitle: "Nenhum usuário TC encontrado",
        emptyDescription: "Ajuste os filtros ou crie um novo usuário TC direto nesta tela.",
      };
    }
    if (activeTab === "admin") {
      return {
        title: "Fila de Líderes TC",
        description: "Listagem dos perfis de liderança com acesso administrativo.",
        emptyTitle: "Nenhum Líder TC encontrado",
        emptyDescription: "Ajuste os filtros ou crie um novo Líder TC direto nesta tela.",
      };
    }
    if (activeTab === "support") {
      return {
        title: "Fila de suporte técnico",
        description: "Listagem dos perfis técnicos internos da Testing Company.",
        emptyTitle: "Nenhum suporte técnico encontrado",
        emptyDescription: "Ajuste os filtros ou crie um novo suporte técnico direto nesta tela.",
      };
    }
    return {
      title: "Fila de usuários da empresa",
      description: "Listagem apenas dos usuários vinculados às empresas. Empresas institucionais ficam em Gestão de Empresas.",
      emptyTitle: "Nenhum usuário da empresa encontrado",
      emptyDescription: "Ajuste os filtros ou crie um usuário da empresa direto nesta tela.",
    };
  }, [activeTab]);

  if (accessLoading) {
    return <AccessDeniedState state="loading" />;
  }

  if (!userAccess.canViewUsers) {
    return (
      <AccessDeniedState
        moduleName="Usuários"
        requiredPermission="users.view"
        title="Acesso à gestão de usuários negado"
        description="Seu perfil não possui permissão para consultar os usuários da plataforma."
      />
    );
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto flex w-full max-w-550 flex-col gap-4 px-0 py-0">
        <Breadcrumb
          items={[
            { label: "Admin", href: "/admin/dashboard" },
            { label: "Gestão de usuários" },
          ]}
        />

        <section className="overflow-hidden rounded-4xl border border-white/10 bg-[linear-gradient(135deg,#011848_0%,#082457_38%,#4b0f2f_72%,#ef0001_100%)] px-6 py-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:px-8">
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Gestao de usuários</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">Usuários da plataforma</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/82">
                Gerencie usuários por contexto: usuários da empresa, usuários TC, liderança e suporte técnico.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/92">
                <FiUsers className="h-4 w-4" /> {totalUsersCount} contas visíveis
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/92">
                <FiUsers className="h-4 w-4" /> {companyUsersCount} Usuário da empresa
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/92">
                <FiUser className="h-4 w-4" /> {testingUsersCount} Usuario TC
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/92">
                <FiShield className="h-4 w-4" /> {adminUsersCount} Líder TC
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/92">
                <FiTool className="h-4 w-4" /> {supportUsersCount} Suporte Técnico
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as UserTab);
              setCreateRolePreset(null);
            }}
          >
            <div className="border-b border-(--tc-border,#d7deea) pb-5">
              <h2 className="text-2xl font-bold text-(--tc-text-primary,#0b1a3c)">Gestão por contexto</h2>
              <div className="mt-4">
                <TabsList className="grid w-full grid-cols-1 gap-2 rounded-[22px] bg-(--tc-surface-alt,#f8fafc) p-1.5 sm:grid-cols-2 xl:grid-cols-4">
                  <TabsTrigger value="company" className="min-h-15 rounded-[18px] px-4 text-sm font-semibold leading-5">
                    Usuários da empresa
                  </TabsTrigger>
                  <TabsTrigger value="testing" className="min-h-15 rounded-[18px] px-4 text-sm font-semibold leading-5">
                    Usuários TC
                  </TabsTrigger>
                  <TabsTrigger value="admin" className="min-h-15 rounded-[18px] px-4 text-sm font-semibold leading-5">
                    Líder TC
                  </TabsTrigger>
                  <TabsTrigger value="support" className="min-h-15 rounded-[18px] px-4 text-sm font-semibold leading-5">
                    Suporte Técnico
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="hidden">
                <label className="flex flex-1 items-center gap-3 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-3 text-sm text-(--tc-text-secondary,#4b5563)">
                  <FiSearch className="h-4 w-4 text-(--tc-text-muted,#6b7280)" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nome, usuário, e-mail ou empresa"
                    className="w-full bg-transparent outline-none placeholder:text-(--tc-text-muted,#94a3b8)"
                  />
                </label>

                {userAccess.canCreateUsers ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCreateRolePreset(null);
                      setSelectedUser(null);
                      setOpenCreate(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-(--tc-accent,#ef0001) px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 lg:min-w-70"
                  >
                    <FiUserPlus className="h-4 w-4" /> {createModalConfig.submitLabel}
                  </button>
                ) : null}
              </div>
            </div>

            {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}

            {activeTab === "company" ? (
              <div className="mt-5 rounded-[22px] border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) p-4">
                <label className="block text-xs font-black uppercase tracking-[0.18em] text-(--tc-accent,#ef0001)">
                  Empresa do usuário
                </label>
                <select
                  value={companyUserCompanyFilter}
                  onChange={(event) => setCompanyUserCompanyFilter(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) px-4 text-sm font-black text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
                  data-testid="company-user-company-filter"
                  aria-label="Filtrar usuários da empresa por empresa"
                >
                  {companyUserCompanyFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.count})
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs font-semibold text-(--tc-text-secondary,#4b5563)">
                  Usuários da empresa precisam ficar separados pela empresa onde trabalham. Empresa institucional fica em Gestão de Empresas.
                </p>
              </div>
            ) : null}

            <UserManagementQueueExperience
              title={currentTabCopy.title}
              description={currentTabCopy.description}
              users={currentTabUsers}
              loading={loading}
              search={search}
              onSearchChange={setSearch}
              canCreate={userAccess.canCreateUsers}
              createLabel={createModalConfig.submitLabel}
              onCreate={() => {
                setCreateRolePreset(null);
                setSelectedUser(null);
                setOpenCreate(true);
              }}
              onSelect={userAccess.canEditUsers ? setSelectedUser : undefined}
              selectedId={selectedUser?.id ?? null}
              emptyTitle={currentTabCopy.emptyTitle}
              emptyDescription={currentTabCopy.emptyDescription}
              searchInputRef={searchInputRef}
              profileBadgeMode={activeTab === "company" ? "company" : "profile"}
            />

            {false ? (
              <div className="mt-6 grid gap-5 xl:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) p-5">
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
              <div className="hidden">
                {hasSearch ? (
                  <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-3 text-sm font-medium text-(--tc-text-secondary,#4b5563)">
                    {currentTabTotal} resultado{currentTabTotal === 1 ? "" : "s"} encontrado{currentTabTotal === 1 ? "" : "s"}
                  </div>
                ) : null}

                <TabsContent value="company" className="mt-0">
                  {companySections.length === 0 && companyAccountSections.length === 0 ? (
                    <div className="flex min-h-65 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-6 text-center">
                      <FiUsers className="h-8 w-8 text-(--tc-text-muted,#6b7280)" />
                      <div>
                        <h3 className="text-xl font-bold text-(--tc-text-primary,#0b1a3c)">Nenhum usuário da empresa encontrado</h3>
                        <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">A busca atual não encontrou usuários da empresa.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-5 xl:grid-cols-2">
                      {[
                        {
                          id: "active",
                          title: "Ativos",
                          accountSections: companyActiveAccountSections,
                          sections: companyActiveSections,
                          emptyMessage: "Nenhum perfil ativo encontrado nas empresas.",
                        },
                        {
                          id: "inactive",
                          title: "Inativos",
                          accountSections: companyInactiveAccountSections,
                          sections: companyInactiveSections,
                          emptyMessage: "Nenhum perfil inativo encontrado nas empresas.",
                        },
                      ].map((group) => (
                        <UserStatusSection
                          key={group.id}
                          title={group.title}
                          count={
                            group.accountSections.reduce((total, section) => total + section.users.length, 0) +
                            group.sections.reduce((total, section) => total + section.users.length, 0)
                          }
                          emptyMessage={group.emptyMessage}
                        >
                          <div className="space-y-4">
                            <section className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-base font-bold text-(--tc-text-primary,#0b1a3c)">Empresa</h4>
                                <span className="rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text-primary,#0b1a3c)">
                                  {group.accountSections.reduce((total, section) => total + section.users.length, 0)}
                                </span>
                              </div>
                              {group.accountSections.length === 0 ? (
                                <div className="rounded-[18px] border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-6 text-sm text-(--tc-text-secondary,#4b5563)">
                                  Nenhuma empresa {group.id === "active" ? "ativa" : "inativa"} neste recorte.
                                </div>
                              ) : (
                                group.accountSections.map((company) => (
                                  <CompanyUsersSection
                                    key={`company-account-${group.id}-${company.id}`}
                                    company={company}
                                    onSelect={userAccess.canEditUsers ? setSelectedUser : undefined}
                                  />
                                ))
                              )}
                            </section>
                            <section className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-base font-bold text-(--tc-text-primary,#0b1a3c)">Usuários da empresa</h4>
                                <span className="rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text-primary,#0b1a3c)">
                                  {group.sections.reduce((total, section) => total + section.users.length, 0)}
                                </span>
                              </div>
                              {group.sections.length === 0 ? (
                                <div className="rounded-[18px] border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-6 text-sm text-(--tc-text-secondary,#4b5563)">
                                  Nenhum usuário da empresa {group.id === "active" ? "ativo" : "inativo"} neste recorte.
                                </div>
                              ) : (
                                group.sections.map((company) => (
                                  <CompanyUsersSection
                                    key={`${group.id}-${company.id}`}
                                    company={company}
                                    onSelect={userAccess.canEditUsers ? setSelectedUser : undefined}
                                  />
                                ))
                              )}
                            </section>
                          </div>
                        </UserStatusSection>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="testing" className="mt-0">
                  {testingCompanyUsers.length === 0 ? (
                    <div className="flex min-h-65 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-6 text-center">
                      <FiUsers className="h-8 w-8 text-(--tc-text-muted,#6b7280)" />
                      <div>
                        <h3 className="text-xl font-bold text-(--tc-text-primary,#0b1a3c)">Nenhum usuário TC</h3>
                        <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">Não há usuários TC com os filtros atuais.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-5 xl:grid-cols-2">
                      {[
                        {
                          id: "active",
                          title: "Ativos",
                          users: testingActiveUsers,
                          emptyMessage: "Nenhum usuário ativo neste recorte.",
                        },
                        {
                          id: "inactive",
                          title: "Inativos",
                          users: testingInactiveUsers,
                          emptyMessage: "Nenhum usuário inativo neste recorte.",
                        },
                      ].map((group) => (
                        <UserStatusSection
                          key={group.id}
                          title={group.title}
                          count={group.users.length}
                          emptyMessage={group.emptyMessage}
                        >
                          <UserCardGrid>
                            {group.users.map((user) => (
                              <UserCard
                                key={`${group.id}-${user.id}`}
                                user={user}
                                onSelect={userAccess.canEditUsers ? setSelectedUser : undefined}
                                companyLabel={user.company_names?.[0] || "Testing Company"}
                              />
                            ))}
                          </UserCardGrid>
                        </UserStatusSection>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="admin" className="mt-0">
                  {adminUsers.length === 0 ? (
                    <div className="flex min-h-65 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-6 text-center">
                      <FiShield className="h-8 w-8 text-(--tc-text-muted,#6b7280)" />
                      <div>
                        <h3 className="text-xl font-bold text-(--tc-text-primary,#0b1a3c)">Nenhum Lider TC encontrado</h3>
                        <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">A busca atual não encontrou Lider TC com esse status.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-5 xl:grid-cols-2">
                      {[
                        {
                          id: "active",
                          title: "Ativos",
                          users: adminActiveUsers,
                          emptyMessage: "Nenhum Líder TC ativo neste recorte.",
                        },
                        {
                          id: "inactive",
                          title: "Inativos",
                          users: adminInactiveUsers,
                          emptyMessage: "Nenhum Líder TC inativo neste recorte.",
                        },
                      ].map((group) => (
                        <UserStatusSection
                          key={group.id}
                          title={group.title}
                          count={group.users.length}
                          emptyMessage={group.emptyMessage}
                        >
                          <UserCardGrid>
                            {group.users.map((user) => (
                              <UserCard
                                key={`${group.id}-${user.id}`}
                                user={user}
                                onSelect={userAccess.canEditUsers ? setSelectedUser : undefined}
                                companyLabel={null}
                              />
                            ))}
                          </UserCardGrid>
                        </UserStatusSection>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="support" className="mt-0">
                  {supportUsers.length === 0 ? (
                    <div className="flex min-h-65 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-6 text-center">
                      <FiTool className="h-8 w-8 text-(--tc-text-muted,#6b7280)" />
                      <div>
                        <h3 className="text-xl font-bold text-(--tc-text-primary,#0b1a3c)">Nenhum suporte técnico encontrado</h3>
                        <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">A busca atual não encontrou usuários técnicos com esse status.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-5 xl:grid-cols-2">
                      {[
                        {
                          id: "active",
                          title: "Ativos",
                          users: supportActiveUsers,
                          emptyMessage: "Nenhum suporte técnico ativo neste recorte.",
                        },
                        {
                          id: "inactive",
                          title: "Inativos",
                          users: supportInactiveUsers,
                          emptyMessage: "Nenhum suporte técnico inativo neste recorte.",
                        },
                      ].map((group) => (
                        <UserStatusSection
                          key={group.id}
                          title={group.title}
                          count={group.users.length}
                          emptyMessage={group.emptyMessage}
                        >
                          <UserCardGrid>
                            {group.users.map((user) => (
                              <UserCard
                                key={`${group.id}-${user.id}`}
                                user={user}
                                onSelect={userAccess.canEditUsers ? setSelectedUser : undefined}
                                companyLabel={null}
                              />
                            ))}
                          </UserCardGrid>
                        </UserStatusSection>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </div>
            )}
          </Tabs>
        </section>
      </div>

      {userAccess.canCreateUsers ? (
        <CreateUserModal
          open={openCreate}
          clientId={activeTab === "company" && companyUserCompanyFilter !== "all" ? companyUserCompanyFilter : null}
          clients={companies}
          companyOptional={createModalConfig.companyOptional}
          showCompanyField={createModalConfig.showCompanyField}
          requireCompanySelection={createModalConfig.requireCompanySelection}
          initialRole={createRolePreset ?? createModalConfig.initialRole}
          lockRole={createModalConfig.lockRole}
          allowedRoles={createModalConfig.allowedRoles}
          title={createModalConfig.title}
          subtitle={createModalConfig.subtitle}
          submitLabel={createModalConfig.submitLabel}
          onClose={() => {
            setOpenCreate(false);
            setCreateRolePreset(null);
          }}
          onCreated={async () => {
            setOpenCreate(false);
            setCreateRolePreset(null);
            await load();
          }}
        />
      ) : null}

      {userAccess.canEditUsers ? (
        <UserDetailsModal
          open={!!selectedModalUser}
          user={selectedModalUser}
          clients={companies}
          onClose={() => setSelectedUser(null)}
          onSaved={async () => {
            setSelectedUser(null);
            await load();
          }}
          onDeleted={async () => {
            setSelectedUser(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}
