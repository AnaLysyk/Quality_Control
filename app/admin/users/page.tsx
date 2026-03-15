"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  FiHome,
  FiSearch,
  FiShield,
  FiTool,
  FiUser,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";

import Breadcrumb from "@/components/Breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchApi } from "@/lib/api";
import { CreateUserModal } from "@/admin/users/components/CreateUserModal";
import { UserDetailsModal } from "@/admin/users/components/UserDetailsModal";

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
  company_ids?: string[];
  company_names?: string[];
  active?: boolean;
  status?: string;
  avatar_url?: string | null;
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
  showCompanyField: boolean;
  requireCompanySelection: boolean;
  companyOptional: boolean;
};

function normalize(text?: string | null) {
  return (text ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function getInitials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "US";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

function roleLabel(permissionRole?: string | null) {
  if (permissionRole === "admin") return "Admin Global";
  if (permissionRole === "dev") return "Suporte Tecnico";
  if (permissionRole === "company") return "Empresa";
  return "Testing Company";
}

function roleTone(permissionRole?: string | null) {
  if (permissionRole === "admin") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (permissionRole === "dev") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  if (permissionRole === "company") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function contextBadgeLabel(user: UserItem, companyLabel?: string | null) {
  if (companyLabel?.trim()) return companyLabel.trim();
  return roleLabel(user.permission_role);
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
  onSelect: (user: UserItem) => void;
  companyLabel?: string | null;
  showCompanyField?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(user)}
      className="group w-full rounded-[22px] border border-(--tc-border,#d7deea) bg-white px-4 py-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:border-(--tc-accent,#ef0001)/22 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)] sm:px-5 sm:py-5"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-5">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <UserAvatar user={user} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-[1.9rem] font-semibold leading-none tracking-tight text-(--tc-text-primary,#0b1a3c) sm:text-[2rem]">
              {user.name}
            </p>
            <div className="mt-3 space-y-1">
              <UserInlineField label="Usuario" value={getUserHandle(user)} valueClassName="break-all" />
              <UserInlineField label="E-mail" value={user.email} valueClassName="break-all" />
              <UserInlineField label="Cargo" value={user.job_title || "Nao informado"} valueClassName="break-words" />
              {showCompanyField && companyLabel ? <UserInlineField label="Empresa" value={companyLabel} valueClassName="break-words" /> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:max-w-55 md:justify-end">
          <span
            className={`inline-flex max-w-full rounded-full border px-3 py-1.5 text-sm font-semibold ${roleTone(user.permission_role)}`}
            title={contextBadgeLabel(user, companyLabel)}
          >
            <span className="truncate">{contextBadgeLabel(user, companyLabel)}</span>
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
  onSelect: (user: UserItem) => void;
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

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<UserTab>("company");
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  const load = useCallback(async () => {
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
        setError(usersJson.error || "Nao foi possivel carregar os usuarios.");
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
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar os usuarios.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortUsers = useCallback(
    (items: UserItem[]) => [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
    [],
  );

  const searchedUsers = useMemo(() => {
    const term = normalize(search);
    if (!term) return users;
    return users.filter((user) => {
      const haystack = [user.name, user.user, user.email, ...(user.company_names ?? []), roleLabel(user.permission_role)]
        .map(normalize)
        .join(" ");
      return haystack.includes(term);
    });
  }, [search, users]);

  const companyProfileUsers = useMemo(
    () => sortUsers(searchedUsers.filter((user) => user.permission_role === "company")),
    [searchedUsers, sortUsers],
  );

  const testingCompanyUsers = useMemo(
    () => sortUsers(searchedUsers.filter((user) => user.permission_role === "user")),
    [searchedUsers, sortUsers],
  );

  const adminUsers = useMemo(
    () => sortUsers(searchedUsers.filter((user) => user.permission_role === "admin")),
    [searchedUsers, sortUsers],
  );
  const supportUsers = useMemo(
    () => sortUsers(searchedUsers.filter((user) => user.permission_role === "dev")),
    [searchedUsers, sortUsers],
  );

  const testingActiveUsers = useMemo(() => testingCompanyUsers.filter((user) => !isInactiveUser(user)), [testingCompanyUsers]);
  const testingInactiveUsers = useMemo(() => testingCompanyUsers.filter((user) => isInactiveUser(user)), [testingCompanyUsers]);
  const adminActiveUsers = useMemo(() => adminUsers.filter((user) => !isInactiveUser(user)), [adminUsers]);
  const adminInactiveUsers = useMemo(() => adminUsers.filter((user) => isInactiveUser(user)), [adminUsers]);
  const supportActiveUsers = useMemo(() => supportUsers.filter((user) => !isInactiveUser(user)), [supportUsers]);
  const supportInactiveUsers = useMemo(() => supportUsers.filter((user) => isInactiveUser(user)), [supportUsers]);

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
  const companyUsersCount = useMemo(() => users.filter((user) => user.permission_role === "company").length, [users]);
  const testingUsersCount = useMemo(() => users.filter((user) => user.permission_role === "user").length, [users]);
  const adminUsersCount = useMemo(() => users.filter((user) => user.permission_role === "admin").length, [users]);
  const supportUsersCount = useMemo(() => users.filter((user) => user.permission_role === "dev").length, [users]);

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
        title: "Criar usuario da empresa",
        subtitle: "Selecione a empresa e cadastre o responsavel ja no contexto dela.",
        submitLabel: "Criar usuario da empresa",
        initialRole: "client_admin",
        lockRole: true,
        showCompanyField: true,
        requireCompanySelection: true,
        companyOptional: false,
      };
    }

    if (activeTab === "admin") {
      return {
        title: "Criar Admin Global",
        subtitle: "Cadastre perfis de Suporte Tecnico Global com acesso total ao sistema.",
        submitLabel: "Criar Admin Global",
        initialRole: "global_admin",
        lockRole: true,
        showCompanyField: false,
        requireCompanySelection: false,
        companyOptional: true,
      };
    }

    if (activeTab === "support") {
      return {
        title: "Criar Suporte Tecnico",
        subtitle: "Cadastre contas tecnicas internas da Testing Company.",
        submitLabel: "Criar Suporte Tecnico",
        initialRole: "it_dev",
        lockRole: true,
        showCompanyField: false,
        requireCompanySelection: false,
        companyOptional: true,
      };
    }

    return {
      title: "Criar usuario Testing Company",
      subtitle: "Cadastre a pessoa da Testing Company e vincule a uma empresa ja existente.",
      submitLabel: "Criar usuario Testing Company",
      initialRole: "client_user",
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

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto flex w-full max-w-550 flex-col gap-4 px-0 py-0">
        <Breadcrumb
          items={[
            { label: "Admin", href: "/admin/home" },
            { label: "Empresas", href: "/admin/clients" },
            { label: "Gestao de usuarios" },
          ]}
        />

        <section className="overflow-hidden rounded-4xl border border-white/10 bg-[linear-gradient(135deg,#031843_0%,#082457_38%,#3a174f_72%,#9f1025_100%)] px-6 py-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:px-8">
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Gestao de usuarios</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">Usuarios da plataforma</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/82">
                Gerencie usuarios por contexto: empresa, Testing Company, lideranca e suporte tecnico.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/92">
                <FiUsers className="h-4 w-4" /> {totalUsersCount} contas visiveis
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/92">
                <FiHome className="h-4 w-4" /> {companyUsersCount} usuarios por empresa
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/92">
                <FiUser className="h-4 w-4" /> {testingUsersCount} usuarios Testing Company
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/92">
                <FiShield className="h-4 w-4" /> {adminUsersCount} admins globais
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white/92">
                <FiTool className="h-4 w-4" /> {supportUsersCount} suporte tecnico
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as UserTab)}>
            <div className="border-b border-(--tc-border,#d7deea) pb-5">
              <h2 className="text-2xl font-bold text-(--tc-text-primary,#0b1a3c)">Gestao por contexto</h2>
              <div className="mt-4">
                <TabsList className="grid w-full grid-cols-1 gap-2 rounded-[22px] bg-(--tc-surface-alt,#f8fafc) p-1.5 sm:grid-cols-2 xl:grid-cols-4">
                  <TabsTrigger value="company" className="min-h-15 rounded-[18px] px-4 text-sm font-semibold leading-5">
                    Usuarios por empresa
                  </TabsTrigger>
                  <TabsTrigger value="testing" className="min-h-15 rounded-[18px] px-4 text-sm font-semibold leading-5">
                    Usuarios Testing Company
                  </TabsTrigger>
                  <TabsTrigger value="admin" className="min-h-15 rounded-[18px] px-4 text-sm font-semibold leading-5">
                    Admin Global
                  </TabsTrigger>
                  <TabsTrigger value="support" className="min-h-15 rounded-[18px] px-4 text-sm font-semibold leading-5">
                    Suporte Tecnico
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                <label className="flex flex-1 items-center gap-3 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-3 text-sm text-(--tc-text-secondary,#4b5563)">
                  <FiSearch className="h-4 w-4 text-(--tc-text-muted,#6b7280)" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nome, usuario, e-mail ou empresa"
                    className="w-full bg-transparent outline-none placeholder:text-(--tc-text-muted,#94a3b8)"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setOpenCreate(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-(--tc-accent,#ef0001) px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 lg:min-w-70"
                >
                  <FiUserPlus className="h-4 w-4" /> {createModalConfig.submitLabel}
                </button>
              </div>
            </div>

            {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}

            {loading ? (
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
              <div className="mt-6 space-y-4">
                {hasSearch ? (
                  <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-3 text-sm font-medium text-(--tc-text-secondary,#4b5563)">
                    {currentTabTotal} resultado{currentTabTotal === 1 ? "" : "s"} encontrado{currentTabTotal === 1 ? "" : "s"}
                  </div>
                ) : null}

                <TabsContent value="company" className="mt-0">
                  {companySections.length === 0 ? (
                    <div className="flex min-h-65 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-6 text-center">
                      <FiUsers className="h-8 w-8 text-(--tc-text-muted,#6b7280)" />
                      <div>
                        <h3 className="text-xl font-bold text-(--tc-text-primary,#0b1a3c)">Nenhuma empresa com usuarios</h3>
                        <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">A busca atual nao encontrou usuarios vinculados a empresas.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-5 xl:grid-cols-2">
                      {[
                        {
                          id: "active",
                          title: "Ativos",
                          sections: companyActiveSections,
                          emptyMessage: "Nenhum usuario ativo encontrado nas empresas.",
                        },
                        {
                          id: "inactive",
                          title: "Inativos",
                          sections: companyInactiveSections,
                          emptyMessage: "Nenhum usuario inativo encontrado nas empresas.",
                        },
                      ].map((group) => (
                        <UserStatusSection
                          key={group.id}
                          title={group.title}
                          count={group.sections.reduce((total, section) => total + section.users.length, 0)}
                          emptyMessage={group.emptyMessage}
                        >
                          <div className="space-y-4">
                            {group.sections.map((company) => (
                              <CompanyUsersSection key={`${group.id}-${company.id}`} company={company} onSelect={setSelectedUser} />
                            ))}
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
                        <h3 className="text-xl font-bold text-(--tc-text-primary,#0b1a3c)">Nenhum usuario Testing Company</h3>
                        <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">Nao ha usuarios da Testing Company com os filtros atuais.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-5 xl:grid-cols-2">
                      {[
                        {
                          id: "active",
                          title: "Ativos",
                          users: testingActiveUsers,
                          emptyMessage: "Nenhum usuario ativo neste recorte.",
                        },
                        {
                          id: "inactive",
                          title: "Inativos",
                          users: testingInactiveUsers,
                          emptyMessage: "Nenhum usuario inativo neste recorte.",
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
                                onSelect={setSelectedUser}
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
                        <h3 className="text-xl font-bold text-(--tc-text-primary,#0b1a3c)">Nenhum Admin Global encontrado</h3>
                        <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">A busca atual nao encontrou admins globais com esse status.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-5 xl:grid-cols-2">
                      {[
                        {
                          id: "active",
                          title: "Ativos",
                          users: adminActiveUsers,
                          emptyMessage: "Nenhum Admin Global ativo neste recorte.",
                        },
                        {
                          id: "inactive",
                          title: "Inativos",
                          users: adminInactiveUsers,
                          emptyMessage: "Nenhum Admin Global inativo neste recorte.",
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
                              <UserCard key={`${group.id}-${user.id}`} user={user} onSelect={setSelectedUser} companyLabel={null} />
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
                        <h3 className="text-xl font-bold text-(--tc-text-primary,#0b1a3c)">Nenhum suporte tecnico encontrado</h3>
                        <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">A busca atual nao encontrou usuarios tecnicos com esse status.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-5 xl:grid-cols-2">
                      {[
                        {
                          id: "active",
                          title: "Ativos",
                          users: supportActiveUsers,
                          emptyMessage: "Nenhum suporte tecnico ativo neste recorte.",
                        },
                        {
                          id: "inactive",
                          title: "Inativos",
                          users: supportInactiveUsers,
                          emptyMessage: "Nenhum suporte tecnico inativo neste recorte.",
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
                              <UserCard key={`${group.id}-${user.id}`} user={user} onSelect={setSelectedUser} companyLabel={null} />
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

      <CreateUserModal
        open={openCreate}
        clientId={null}
        clients={companies}
        companyOptional={createModalConfig.companyOptional}
        showCompanyField={createModalConfig.showCompanyField}
        requireCompanySelection={createModalConfig.requireCompanySelection}
        initialRole={createModalConfig.initialRole}
        lockRole={createModalConfig.lockRole}
        title={createModalConfig.title}
        subtitle={createModalConfig.subtitle}
        submitLabel={createModalConfig.submitLabel}
        onClose={() => setOpenCreate(false)}
        onCreated={async () => {
          setOpenCreate(false);
          await load();
        }}
      />

      <UserDetailsModal
        open={!!selectedModalUser}
        user={selectedModalUser}
        clients={companies}
        onClose={() => setSelectedUser(null)}
        onSaved={async () => {
          setSelectedUser(null);
          await load();
        }}
      />
    </div>
  );
}
