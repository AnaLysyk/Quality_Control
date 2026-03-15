"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCopy,
  FiGrid,
  FiPlus,
  FiRotateCcw,
  FiSave,
  FiSearch,
  FiShield,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveAvatarEmoji } from "@/lib/avatarCatalog";
import { PERMISSION_MODULES, getActionLabel, getPermissionModule } from "@/lib/permissionCatalog";
import { ROLE_DEFAULTS } from "@/lib/roleDefaults";
import {
  applyPermissionOverride,
  getOverrideState,
  normalizePermissionMatrix,
  type PermissionMatrix,
  type PermissionOverride,
} from "@/lib/permissionMatrix";

type AdminUserItem = {
  id: string;
  name: string;
  email: string;
  user?: string | null;
  avatar_key?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  permission_role?: string | null;
  client_id?: string | null;
  company_name?: string | null;
  company_names?: string[];
  company_count?: number;
  companies?: Array<{ id: string; name: string; slug: string | null; role: string }>;
  active?: boolean;
  status?: string | null;
};

type PermissionResponse = {
  userId: string;
  role: string;
  roleDefaults: PermissionMatrix;
  override: PermissionOverride | null;
  permissions: PermissionMatrix;
};

type CompanyOption = {
  id: string;
  name: string;
  slug: string | null;
  active?: boolean;
  status?: string | null;
};

type EditableProfileRole = "admin" | "dev" | "company" | "user";
type RoleFilter = "all" | EditableProfileRole;
type GlobalCreateDraft = {
  fullName: string;
  user: string;
  email: string;
  phone: string;
  password: string;
};

type ModuleSummaryItem = {
  id: string;
  label: string;
  description: string;
  actions: string[];
};

const ROLE_FILTERS: Array<{ value: RoleFilter; label: string; hint: string }> = [
  { value: "all", label: "Todos", hint: "Todos os tipos de perfil" },
  { value: "admin", label: "Usuario Lider TC", hint: "Perfil administrativo" },
  { value: "dev", label: "Suporte tecnico", hint: "Perfil Global" },
  { value: "company", label: "Usuario Empresa", hint: "Conta institucional da empresa" },
  { value: "user", label: "Usuario Testing Company", hint: "Usuario vinculado" },
];

const PROFILE_OPTIONS: Array<{ value: EditableProfileRole; label: string; hint: string }> = [
  { value: "admin", label: "Admin", hint: "Gestao administrativa" },
  { value: "dev", label: "Global", hint: "Visao tecnica total" },
  { value: "company", label: "Empresa", hint: "Escopo da empresa" },
  { value: "user", label: "Usuario", hint: "Acesso individual" },
];

function emptyOverride(): PermissionOverride {
  return { allow: {}, deny: {} };
}

function emptyGlobalCreateDraft(): GlobalCreateDraft {
  return {
    fullName: "",
    user: "",
    email: "",
    phone: "",
    password: "",
  };
}

function normalizeRole(value?: string | null): EditableProfileRole {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "admin" || normalized === "global_admin") return "admin";
  if (normalized === "dev" || normalized === "it_dev") return "dev";
  if (normalized === "company" || normalized === "client_admin") return "company";
  return "user";
}

function roleLabel(value?: string | null) {
  const normalized = normalizeRole(value);
  if (normalized === "admin") return "Admin";
  if (normalized === "dev") return "Global";
  if (normalized === "company") return "Empresa";
  return "Usuário";
}

function roleHint(role: EditableProfileRole) {
  if (role === "admin") return "Acesso amplo aos módulos administrativos, sem o fluxo técnico exclusivo do perfil Global.";
  if (role === "dev") return "Visão técnica total do sistema, incluindo suporte e manutenção global.";
  if (role === "company") return "Escopo da própria empresa, sem gestão global de usuários.";
  return "Escopo individual vinculado à empresa, sem gestão administrativa global.";
}

function roleNeedsCompany(role: EditableProfileRole) {
  return role === "user";
}

function statusLabel(value?: string | null) {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "inactive" || normalized === "blocked") return "Inativo";
  if (normalized === "invited") return "Convidado";
  return "Ativo";
}

function toneForOverride(state: "allow" | "deny" | "default") {
  if (state === "allow") {
    return "border-[rgba(16,185,129,0.22)] bg-[rgba(16,185,129,0.12)] text-(--tc-text-primary)";
  }
  if (state === "deny") {
    return "border-[rgba(239,0,1,0.18)] bg-[rgba(239,0,1,0.1)] text-(--tc-text-primary)";
  }
  return "border-(--tc-border) bg-(--tc-surface-2) text-(--tc-text-muted)";
}

function badgeLabel(state: "allow" | "deny" | "default") {
  if (state === "allow") return "Adicionado";
  if (state === "deny") return "Removido";
  return "Perfil base";
}

function roleTone(value?: string | null, selected = false) {
  if (selected) return "border border-white/20 bg-white/10 text-white";

  const normalized = (value ?? "").toLowerCase();
  if (normalized === "admin" || normalized === "global_admin") {
    return "border border-[rgba(1,24,72,0.12)] bg-[rgba(1,24,72,0.08)] text-(--tc-primary)";
  }
  if (normalized === "dev" || normalized === "it_dev") {
    return "border border-[rgba(59,130,246,0.18)] bg-[rgba(59,130,246,0.12)] text-[#2563eb]";
  }
  if (normalized === "company" || normalized === "client_admin") {
    return "border border-[rgba(239,0,1,0.18)] bg-[rgba(239,0,1,0.1)] text-(--tc-accent)";
  }
  return "border border-(--tc-border) bg-(--tc-surface-2) text-(--tc-text-muted)";
}

function statusTone(value?: string | null, selected = false) {
  if (selected) return "border border-white/20 bg-white/10 text-white";

  const normalized = (value ?? "").toLowerCase();
  if (normalized === "inactive" || normalized === "blocked") {
    return "border border-[rgba(239,0,1,0.18)] bg-[rgba(239,0,1,0.1)] text-(--tc-accent)";
  }
  if (normalized === "invited") {
    return "border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.12)] text-[#b45309]";
  }
  return "border border-[rgba(16,185,129,0.22)] bg-[rgba(16,185,129,0.12)] text-[#047857]";
}

function getInitials(name?: string | null) {
  const source = (name ?? "").trim();
  if (!source) return "SC";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function getDisplayName(user?: Pick<AdminUserItem, "name" | "email"> | null) {
  return user?.name?.trim() || user?.email?.trim() || "Sem nome";
}

function getDisplayUserHandle(user?: Pick<AdminUserItem, "user"> | null) {
  const login = user?.user?.trim();
  return login ? `@${login}` : null;
}

function getUserSecondaryLabel(user?: Pick<AdminUserItem, "user" | "email"> | null) {
  return getDisplayUserHandle(user) ?? user?.email?.trim() ?? null;
}

function AvatarIdentity(props: {
  user?: Pick<AdminUserItem, "name" | "email" | "avatar_key" | "avatar_url"> | null;
  selected?: boolean;
  size?: "sm" | "lg";
}) {
  const { user, selected = false, size = "sm" } = props;
  const emoji = resolveAvatarEmoji(user?.avatar_key);
  const fallback = getInitials(getDisplayName(user));
  const wrapperClass =
    size === "lg"
      ? "h-14 w-14 rounded-full text-2xl"
      : "h-10 w-10 rounded-full text-sm";

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden ${wrapperClass} ${
        selected
          ? "border border-white/20 bg-white/10 text-white"
          : "border border-(--tc-border) bg-(--tc-surface) text-(--tc-primary)"
      }`}
    >
      {user?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{emoji ?? fallback}</span>
      )}
    </div>
  );
}

function isValidEmailAddress(value?: string | null) {
  const source = (value ?? "").trim();
  if (!source) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(source);
}

function isGlobalDeveloperUser(
  user?: { role?: string | null; permissionRole?: string | null; companyRole?: string | null } | null,
) {
  const role = (user?.role ?? "").toLowerCase();
  const permissionRole = (user?.permissionRole ?? "").toLowerCase();
  const companyRole = (user?.companyRole ?? "").toLowerCase();
  return role === "it_dev" || permissionRole === "dev" || companyRole === "it_dev";
}

function companyLabel(user: AdminUserItem) {
  if (Array.isArray(user.company_names) && user.company_names.length > 1) {
    return `${user.company_names[0]} +${user.company_names.length - 1}`;
  }
  if (Array.isArray(user.company_names) && user.company_names.length === 1) {
    return user.company_names[0];
  }
  return user.company_name || "Sem empresa";
}

function companyTitle(user: AdminUserItem) {
  if (Array.isArray(user.company_names) && user.company_names.length > 0) {
    return user.company_names.join(", ");
  }
  return user.company_name || "Sem empresa";
}

function summarizeMatrixModules(matrix: PermissionMatrix) {
  return PERMISSION_MODULES.map((module) => {
    const actions = normalizePermissionMatrix(matrix)[module.id] ?? [];
    if (!actions.length) return null;
    return {
      id: module.id,
      label: module.label,
      description: module.description,
      actions,
    };
  }).filter((item): item is ModuleSummaryItem => Boolean(item));
}

function summarizeRoleModules(role: EditableProfileRole) {
  const matrix = normalizePermissionMatrix((ROLE_DEFAULTS as Record<string, PermissionMatrix>)[role] ?? {});
  return summarizeMatrixModules(matrix);
}

function toPermissionKeySet(matrix: PermissionMatrix) {
  return new Set(
    Object.entries(normalizePermissionMatrix(matrix)).flatMap(([moduleId, actions]) =>
      actions.map((action) => `${moduleId}:${action}`),
    ),
  );
}

function describePermissionKey(key: string) {
  const [moduleId, action] = key.split(":");
  const permissionModule = PERMISSION_MODULES.find((item) => item.id === moduleId);
  return `${permissionModule?.label ?? moduleId} - ${getActionLabel(action)}`;
}

function diffPermissionMatrices(current: PermissionMatrix, next: PermissionMatrix) {
  const currentSet = toPermissionKeySet(current);
  const nextSet = toPermissionKeySet(next);
  const gained = Array.from(nextSet).filter((key) => !currentSet.has(key));
  const lost = Array.from(currentSet).filter((key) => !nextSet.has(key));

  return {
    currentCount: currentSet.size,
    nextCount: nextSet.size,
    gainedCount: gained.length,
    lostCount: lost.length,
    gainedPreview: gained.slice(0, 4).map(describePermissionKey),
    lostPreview: lost.slice(0, 4).map(describePermissionKey),
  };
}

function toggleOverride(
  roleDefaults: PermissionMatrix,
  currentOverride: PermissionOverride,
  moduleId: string,
  action: string,
  nextChecked: boolean,
) {
  const allow = { ...normalizePermissionMatrix(currentOverride.allow) };
  const deny = { ...normalizePermissionMatrix(currentOverride.deny) };
  const roleHas = Array.isArray(roleDefaults[moduleId]) && roleDefaults[moduleId].includes(action);

  if (nextChecked) {
    if (roleHas) {
      deny[moduleId] = (deny[moduleId] ?? []).filter((item) => item !== action);
      if (deny[moduleId].length === 0) delete deny[moduleId];
    } else {
      allow[moduleId] = Array.from(new Set([...(allow[moduleId] ?? []), action]));
    }
  } else {
    if (roleHas) {
      deny[moduleId] = Array.from(new Set([...(deny[moduleId] ?? []), action]));
    } else {
      allow[moduleId] = (allow[moduleId] ?? []).filter((item) => item !== action);
      if (allow[moduleId].length === 0) delete allow[moduleId];
    }
  }

  return {
    ...currentOverride,
    allow,
    deny,
  };
}

function isUserActive(user: AdminUserItem) {
  const normalized = (user.status ?? "").toLowerCase();
  if (normalized === "inactive" || normalized === "blocked") return false;
  return user.active !== false;
}

function serializeOverride(override?: PermissionOverride | null) {
  const normalize = (matrix: PermissionMatrix | undefined) =>
    Object.fromEntries(
      Object.entries(normalizePermissionMatrix(matrix))
        .sort(([left], [right]) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }))
        .map(([moduleId, actions]) => [moduleId, [...actions].sort((left, right) => left.localeCompare(right, "pt-BR"))]),
    );

  return JSON.stringify({
    allow: normalize(override?.allow),
    deny: normalize(override?.deny),
  });
}

function friendlyUiError(message: string | null | undefined, fallback: string) {
  const value = (message ?? "").trim();
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (
    normalized.includes("upstash_redis_rest_url") ||
    normalized.includes("upstash_redis_rest_token") ||
    normalized.includes("redis") ||
    normalized.includes("environment variable")
  ) {
    return fallback;
  }
  return value;
}

function SurfaceModal(props: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  size?: "default" | "wide";
  tone?: "default" | "alert";
  icon?: ReactNode;
}) {
  const { open, title, description, onClose, children, footer, size = "default", tone = "default", icon } = props;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-90 flex items-start justify-center overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
      <button
        type="button"
        aria-label="Fechar modal"
        className="absolute inset-0 bg-[rgba(2,6,23,0.62)] backdrop-blur-[6px]"
        onClick={onClose}
      />
      <div
        className={`relative z-91 my-auto flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-[28px] border border-(--tc-border) bg-(--tc-surface) shadow-[0_30px_80px_rgba(2,6,23,0.48)] ${
          size === "wide" ? "max-w-6xl" : "max-w-xl"
        }`}
      >
        <div
          className={`border-b border-(--tc-border) px-5 py-5 sm:px-6 ${tone === "alert" ? "[background:linear-gradient(180deg,rgba(239,0,1,0.08),rgba(1,24,72,0.05))]" : "[background:linear-gradient(180deg,rgba(1,24,72,0.08),transparent)]"}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              {icon ? (
                <div
                  className={`mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                    tone === "alert"
                      ? "border-[rgba(239,0,1,0.18)] bg-[rgba(239,0,1,0.1)] text-(--tc-accent)"
                      : "border-(--tc-border) bg-(--tc-surface-2) text-(--tc-primary)"
                  }`}
                >
                  {icon}
                </div>
              ) : null}
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-(--tc-text-primary)">{title}</h3>
                {description && <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary)">{description}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar modal"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-(--tc-border) bg-(--tc-surface) text-(--tc-text-muted) transition hover:bg-(--tc-surface-2) hover:text-(--tc-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(239,0,1,0.16)]"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        <div className="flex flex-col gap-2 border-t border-(--tc-border) bg-(--tc-surface-2) px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          {footer}
        </div>
      </div>
    </div>
  );
}

export default function PermissionsPage() {
  const { user: authUser, refreshUser } = useAuthUser();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [permissionData, setPermissionData] = useState<PermissionResponse | null>(null);
  const [draftOverride, setDraftOverride] = useState<PermissionOverride>(emptyOverride());
  const [profileDraft, setProfileDraft] = useState<EditableProfileRole>("user");
  const [companyDraft, setCompanyDraft] = useState("");
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [openModule, setOpenModule] = useState("");
  const [profileComparisonOpen, setProfileComparisonOpen] = useState(false);
  const [profileRequirementsOpen, setProfileRequirementsOpen] = useState(false);
  const [permissionsViewerOpen, setPermissionsViewerOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [createGlobalOpen, setCreateGlobalOpen] = useState(false);
  const [createGlobalDraft, setCreateGlobalDraft] = useState<GlobalCreateDraft>(emptyGlobalCreateDraft());
  const [createGlobalLoading, setCreateGlobalLoading] = useState(false);
  const [createGlobalError, setCreateGlobalError] = useState<string | null>(null);
  const [profileModalRole, setProfileModalRole] = useState<EditableProfileRole>("user");
  const [profileModalCompany, setProfileModalCompany] = useState("");

  const canManagePrivilegedProfiles = useMemo(() => isGlobalDeveloperUser(authUser), [authUser]);

  async function loadUsers() {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch("/api/admin/users", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { items?: AdminUserItem[]; error?: string };
      if (!res.ok) {
        setUsers([]);
        setUsersError(json.error ?? "Não foi possível carregar os usuários.");
        return;
      }
      setUsers(Array.isArray(json.items) ? json.items : []);
    } catch (error) {
      setUsers([]);
      setUsersError(error instanceof Error ? error.message : "Não foi possível carregar os usuários.");
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadCompanies() {
    setCompaniesLoading(true);
    setCompaniesError(null);
    try {
      const res = await fetch("/api/companies", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => [])) as CompanyOption[] | { error?: string };
      if (!res.ok) {
        setCompanies([]);
        setCompaniesError(
          typeof json === "object" && !Array.isArray(json)
            ? json.error ?? "Não foi possível carregar as empresas."
            : "Não foi possível carregar as empresas.",
        );
        return;
      }
      setCompanies(Array.isArray(json) ? json : []);
    } catch (error) {
      setCompanies([]);
      setCompaniesError(error instanceof Error ? error.message : "Não foi possível carregar as empresas.");
    } finally {
      setCompaniesLoading(false);
    }
  }

  async function loadPermissions(userId: string) {
    setPanelLoading(true);
    setPanelError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/permissions`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as PermissionResponse & { error?: string };
      if (!res.ok) {
        setPermissionData(null);
        setDraftOverride(emptyOverride());
        setPanelError(json.error ?? "Não foi possível carregar as permissões.");
        return;
      }
      setPermissionData(json);
    } catch (error) {
      setPermissionData(null);
      setDraftOverride(emptyOverride());
      setPanelError(error instanceof Error ? error.message : "Não foi possível carregar as permissões.");
    } finally {
      setPanelLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
    void loadCompanies();
  }, []);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      const normalizedRole = normalizeRole(user.permission_role ?? user.role);
      const matchesRole = roleFilter === "all" ? true : normalizedRole === roleFilter;
      if (!matchesRole) return false;

      if (!normalizedQuery) return true;
      return [
        user.name,
        user.email,
        user.company_name,
        ...(Array.isArray(user.company_names) ? user.company_names : []),
        user.role,
        user.permission_role,
      ]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [query, roleFilter, users]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: users.length,
      admin: 0,
      dev: 0,
      company: 0,
      user: 0,
    };

    for (const user of users) {
      const role = normalizeRole(user.permission_role ?? user.role);
      counts[role] = (counts[role] ?? 0) + 1;
    }

    return counts;
  }, [users]);

  const availableProfileOptions = useMemo(() => {
    if (canManagePrivilegedProfiles) return PROFILE_OPTIONS;
    return PROFILE_OPTIONS.filter((option) => option.value !== "admin" && option.value !== "dev");
  }, [canManagePrivilegedProfiles]);

  const testingCompanyUsersCount = useMemo(
    () => users.filter((user) => normalizeRole(user.permission_role ?? user.role) === "user").length,
    [users],
  );

  useEffect(() => {
    if (!filteredUsers.length) {
      setSelectedUserId(null);
      return;
    }

    const selectedStillVisible = filteredUsers.some((user) => user.id === selectedUserId);
    if (!selectedStillVisible) {
      setSelectedUserId(filteredUsers[0]?.id ?? null);
    }
  }, [filteredUsers, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) return;
    void loadPermissions(selectedUserId);
  }, [selectedUserId]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const originalRole = useMemo<EditableProfileRole>(
    () => normalizeRole(permissionData?.role ?? selectedUser?.permission_role ?? selectedUser?.role),
    [permissionData?.role, selectedUser?.permission_role, selectedUser?.role],
  );

  const originalCompanyId = useMemo(
    () => selectedUser?.client_id ?? selectedUser?.companies?.[0]?.id ?? "",
    [selectedUser?.client_id, selectedUser?.companies],
  );

  const serverOverrideSignature = useMemo(
    () => serializeOverride(permissionData?.override),
    [permissionData?.override],
  );

  useEffect(() => {
    if (!selectedUser || !permissionData) return;
    setProfileDraft(normalizeRole(permissionData.role ?? selectedUser.permission_role ?? selectedUser.role));
    setCompanyDraft(selectedUser.client_id ?? selectedUser.companies?.[0]?.id ?? "");
    setDraftOverride(permissionData.override ?? emptyOverride());
    setProfileComparisonOpen(false);
    setProfileRequirementsOpen(false);
    setPermissionsViewerOpen(false);
    setRestoreModalOpen(false);
  }, [permissionData, selectedUser, selectedUserId, serverOverrideSignature]);

  const roleDefaultsPreview = useMemo(
    () => normalizePermissionMatrix((ROLE_DEFAULTS as Record<string, PermissionMatrix>)[profileDraft] ?? {}),
    [profileDraft],
  );

  const effectivePermissions = useMemo(
    () => applyPermissionOverride(roleDefaultsPreview, draftOverride),
    [draftOverride, roleDefaultsPreview],
  );

  const filteredCompanies = useMemo(
    () => companies.filter((company) => company.active !== false && (company.status ?? "active") !== "archived"),
    [companies],
  );

  const draftCompanyLabel = useMemo(() => {
    if (!selectedUser) return "Sem empresa";
    const matched = filteredCompanies.find((company) => company.id === companyDraft);
    return matched?.name ?? companyLabel(selectedUser);
  }, [companyDraft, filteredCompanies, selectedUser]);

  const customAllowCount = useMemo(
    () => Object.values(normalizePermissionMatrix(draftOverride.allow)).reduce((sum, actions) => sum + actions.length, 0),
    [draftOverride.allow],
  );

  const customDenyCount = useMemo(
    () => Object.values(normalizePermissionMatrix(draftOverride.deny)).reduce((sum, actions) => sum + actions.length, 0),
    [draftOverride.deny],
  );

  const totalActiveActions = useMemo(
    () => Object.values(effectivePermissions).reduce((sum, actions) => sum + actions.length, 0),
    [effectivePermissions],
  );

  const totalActiveModules = useMemo(
    () => Object.values(effectivePermissions).filter((actions) => actions.length > 0).length,
    [effectivePermissions],
  );

  const effectiveModuleSummary = useMemo(() => summarizeMatrixModules(effectivePermissions), [effectivePermissions]);
  const effectiveModuleGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        category: string;
        actionsCount: number;
        modules: ModuleSummaryItem[];
      }
    >();

    effectiveModuleSummary.forEach((module) => {
      const category = getPermissionModule(module.id)?.category ?? "Outros";
      const current = groups.get(category);
      if (current) {
        current.modules.push(module);
        current.actionsCount += module.actions.length;
        return;
      }

      groups.set(category, {
        category,
        actionsCount: module.actions.length,
        modules: [module],
      });
    });

    return Array.from(groups.values());
  }, [effectiveModuleSummary]);

  const hasPermissionChanges = useMemo(
    () => serializeOverride(permissionData?.override) !== serializeOverride(draftOverride),
    [draftOverride, permissionData?.override],
  );

  const profileMetaChanged = useMemo(
    () => profileDraft !== originalRole || companyDraft !== originalCompanyId,
    [companyDraft, originalCompanyId, originalRole, profileDraft],
  );
  const canEditProfileBase = useMemo(() => {
    if (canManagePrivilegedProfiles) return true;
    return profileDraft !== "admin" && profileDraft !== "dev";
  }, [canManagePrivilegedProfiles, profileDraft]);

  const hasDraftChanges = hasPermissionChanges || profileMetaChanged;

  const initialOpenModule = useMemo(() => {
    const customModules = Array.from(
      new Set([
        ...Object.keys(normalizePermissionMatrix(permissionData?.override?.allow)),
        ...Object.keys(normalizePermissionMatrix(permissionData?.override?.deny)),
      ]),
    );
    if (customModules.length) return customModules[0] ?? "";
    if (profileDraft === "admin") return "users";
    if (profileDraft === "dev") return "support";
    if (profileDraft === "company") return "tickets";
    return "settings";
  }, [permissionData?.override?.allow, permissionData?.override?.deny, profileDraft]);

  useEffect(() => {
    setOpenModule(initialOpenModule);
  }, [initialOpenModule, selectedUserId]);

  const activeModule = useMemo(
    () => PERMISSION_MODULES.find((module) => module.id === openModule) ?? PERMISSION_MODULES[0] ?? null,
    [openModule],
  );

  const currentRoleModules = useMemo(() => summarizeRoleModules(profileDraft), [profileDraft]);
  const nextRoleModules = useMemo(() => summarizeRoleModules(profileModalRole), [profileModalRole]);

  const profileChangePreview = useMemo(() => {
    const currentDefaults = normalizePermissionMatrix((ROLE_DEFAULTS as Record<string, PermissionMatrix>)[profileDraft] ?? {});
    const nextDefaults = normalizePermissionMatrix((ROLE_DEFAULTS as Record<string, PermissionMatrix>)[profileModalRole] ?? {});
    return diffPermissionMatrices(currentDefaults, nextDefaults);
  }, [profileDraft, profileModalRole]);

  const resetTargetPermissions = useMemo(
    () => normalizePermissionMatrix((ROLE_DEFAULTS as Record<string, PermissionMatrix>)[originalRole] ?? {}),
    [originalRole],
  );

  const resetPreview = useMemo(
    () => diffPermissionMatrices(effectivePermissions, resetTargetPermissions),
    [effectivePermissions, resetTargetPermissions],
  );

  const resetTargetModules = useMemo(() => summarizeMatrixModules(resetTargetPermissions), [resetTargetPermissions]);
  const resetCurrentCompanyLabel = useMemo(() => {
    if (!roleNeedsCompany(profileDraft)) return "Sem empresa principal";
    return draftCompanyLabel;
  }, [draftCompanyLabel, profileDraft]);
  const resetTargetCompanyLabel = useMemo(() => {
    if (!roleNeedsCompany(originalRole)) return "Sem empresa principal";
    const matched = filteredCompanies.find((company) => company.id === originalCompanyId);
    return matched?.name ?? draftCompanyLabel;
  }, [draftCompanyLabel, filteredCompanies, originalCompanyId, originalRole]);
  const resetWillChangeRole = profileDraft !== originalRole;
  const resetWillChangeCompany = resetCurrentCompanyLabel !== resetTargetCompanyLabel;

  const nextRoleNeedsExtraData = roleNeedsCompany(profileModalRole);
  const profileCandidateCompanyId = useMemo(() => {
    if (!nextRoleNeedsExtraData) return "";
    return profileModalCompany || companyDraft || selectedUser?.client_id || selectedUser?.companies?.[0]?.id || "";
  }, [companyDraft, nextRoleNeedsExtraData, profileModalCompany, selectedUser]);
  const profileCandidateCompanyLabel = useMemo(() => {
    if (!nextRoleNeedsExtraData) return "Não exige empresa principal";
    if (!profileCandidateCompanyId) return "Empresa ainda não definida";

    const matchedCompany =
      filteredCompanies.find((company) => company.id === profileCandidateCompanyId) ??
      selectedUser?.companies?.find((company) => company.id === profileCandidateCompanyId);

    return matchedCompany?.name ?? draftCompanyLabel ?? "Empresa vinculada reaproveitada";
  }, [draftCompanyLabel, filteredCompanies, nextRoleNeedsExtraData, profileCandidateCompanyId, selectedUser]);

  function applyProfileDraft(nextRole: EditableProfileRole, nextCompanyId?: string) {
    const fallbackCompanyId = companyDraft || selectedUser?.client_id || selectedUser?.companies?.[0]?.id || "";
    const resolvedCompanyId = roleNeedsCompany(nextRole)
      ? nextCompanyId ?? fallbackCompanyId
      : "";

    if (roleNeedsCompany(nextRole) && !resolvedCompanyId) {
      setPanelError("Selecione uma empresa para aplicar este perfil.");
      return;
    }

    const roleChanged = nextRole !== profileDraft;
    const companyChanged = resolvedCompanyId !== companyDraft;

    setProfileDraft(nextRole);
    setCompanyDraft(resolvedCompanyId);
    if (roleChanged) {
      setDraftOverride(emptyOverride());
    }
    setProfileComparisonOpen(false);
    setProfileRequirementsOpen(false);
    setPanelError(null);

    if (roleChanged) {
      setMessage(`Perfil base ajustado para ${roleLabel(nextRole)} na edição atual. Revise o módulo desejado e salve para aplicar.`);
      return;
    }

    if (companyChanged) {
      setMessage("Empresa principal da edição atual atualizada. Salve para aplicar.");
    }
  }

  function startProfileComparison(nextRole: EditableProfileRole) {
    setPanelError(null);
    if (nextRole === profileDraft) {
      return;
    }

    const compatibleCompanyId = companyDraft || selectedUser?.client_id || selectedUser?.companies?.[0]?.id || "";
    setProfileModalRole(nextRole);
    setProfileModalCompany(roleNeedsCompany(nextRole) ? compatibleCompanyId : "");
    setProfileRequirementsOpen(false);
    setProfileComparisonOpen(true);
  }

  function confirmProfileChange() {
    setPanelError(null);
    const resolvedCompanyId =
      profileModalCompany || companyDraft || selectedUser?.client_id || selectedUser?.companies?.[0]?.id || "";

    if (nextRoleNeedsExtraData && !resolvedCompanyId) {
      setProfileComparisonOpen(false);
      setProfileRequirementsOpen(true);
      return;
    }

    applyProfileDraft(profileModalRole, resolvedCompanyId);
  }

  function confirmProfileRequirements() {
    if (nextRoleNeedsExtraData && !profileModalCompany) {
      setPanelError("Selecione uma empresa para concluir a mudança de perfil.");
      return;
    }
    setPanelError(null);
    applyProfileDraft(profileModalRole, profileModalCompany);
  }

  function resetCreateGlobalForm() {
    setCreateGlobalDraft(emptyGlobalCreateDraft());
    setCreateGlobalError(null);
    setCreateGlobalLoading(false);
  }

  async function handleCreateGlobal() {
    const fullName = createGlobalDraft.fullName.trim();
    const user = createGlobalDraft.user.trim().toLowerCase();
    const email = createGlobalDraft.email.trim().toLowerCase();
    const phone = createGlobalDraft.phone.trim();
    const password = createGlobalDraft.password;

    if (!fullName) {
      setCreateGlobalError("Informe o nome completo.");
      return;
    }
    if (!user) {
      setCreateGlobalError("Informe o usuario.");
      return;
    }
    if (!email) {
      setCreateGlobalError("Informe o e-mail.");
      return;
    }
    if (!isValidEmailAddress(email)) {
      setCreateGlobalError("Informe um e-mail valido.");
      return;
    }
    if (!password.trim()) {
      setCreateGlobalError("Informe a senha.");
      return;
    }
    if (password.trim().length < 8) {
      setCreateGlobalError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    setCreateGlobalLoading(true);
    setCreateGlobalError(null);

    try {
      const payload = {
        full_name: fullName,
        name: fullName,
        user,
        email,
        phone,
        password,
        role: "it_dev",
      };

      const doCreate = () =>
        fetch("/api/admin/users", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

      let res = await doCreate();
      if (res.status === 401) {
        const refreshed = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });

        if (!refreshed.ok) {
          setCreateGlobalError("Sessao expirada. Entre novamente para continuar.");
          return;
        }

        await refreshUser();
        res = await doCreate();
      }

      const json = (await res.json().catch(() => ({}))) as { error?: string; item?: AdminUserItem | null };
      if (!res.ok) {
        setCreateGlobalError(
          friendlyUiError(
            json.error,
            res.status === 401 ? "Sessao expirada. Entre novamente para continuar." : "Nao foi possivel criar o perfil Global agora.",
          ),
        );
        return;
      }

      setCreateGlobalOpen(false);
      resetCreateGlobalForm();
      setQuery("");
      setRoleFilter("all");
      await loadUsers();
      if (json.item?.id) {
        setSelectedUserId(json.item.id);
      }
      setPanelError(null);
      setMessage(`Perfil Global criado para ${fullName}. Revise as permissoes e os ajustes de perfil, se necessario.`);
    } catch (error) {
      setCreateGlobalError(error instanceof Error ? error.message : "Nao foi possivel criar o perfil Global agora.");
    } finally {
      setCreateGlobalLoading(false);
    }
  }

  async function handleCopyEmail() {
    if (!selectedUser?.email) return;
    try {
      await navigator.clipboard.writeText(selectedUser.email);
      setPanelError(null);
      setMessage("E-mail copiado.");
    } catch (error) {
      setMessage(null);
      setPanelError(error instanceof Error ? error.message : "Não foi possível copiar o e-mail.");
    }
  }

  async function handleSave() {
    if (!selectedUserId || !selectedUser) return;

    if (roleNeedsCompany(profileDraft) && !companyDraft) {
      setPanelError("Selecione uma empresa para aplicar esse perfil.");
      return;
    }

    setSaving(true);
    setPanelError(null);
    setMessage(null);
    try {
      if (profileMetaChanged) {
        const userRes = await fetch(`/api/admin/users/${selectedUserId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            permission_role: profileDraft,
            client_id: companyDraft || null,
          }),
        });
        const userJson = (await userRes.json().catch(() => ({}))) as { error?: string };
        if (!userRes.ok) {
          setPanelError(userJson.error ?? "Não foi possível atualizar o perfil do usuário.");
          return;
        }
      }

      if (profileMetaChanged || hasPermissionChanges) {
        const allow = normalizePermissionMatrix(draftOverride.allow);
        const deny = normalizePermissionMatrix(draftOverride.deny);
        const shouldResetOverride = Object.keys(allow).length === 0 && Object.keys(deny).length === 0;
        const resetReason = profileMetaChanged ? "updated" : "restored";

        const res = await fetch(`/api/admin/users/${selectedUserId}/permissions`, {
          method: shouldResetOverride ? "DELETE" : "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(shouldResetOverride ? { reason: resetReason } : { allow, deny }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setPanelError(json.error ?? "Não foi possível salvar as permissões.");
          return;
        }
      }

      await loadUsers();
      await loadPermissions(selectedUserId);
      if (authUser?.id && authUser.id === selectedUserId) {
        await refreshUser();
      }
      setMessage(profileMetaChanged ? "Perfil, empresa e permissões atualizados." : "Permissões salvas.");
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Não foi possível salvar as permissões.");
    } finally {
      setSaving(false);
    }
  }

  function handleResetDraft() {
    if (!selectedUser) return;
    setPanelError(null);
    setMessage(null);

    setProfileDraft(originalRole);
    setCompanyDraft(roleNeedsCompany(originalRole) ? originalCompanyId : "");
    setDraftOverride(emptyOverride());
    setRestoreModalOpen(false);
    setMessage(
      `Edição atual restaurada para o padrão de ${roleLabel(originalRole)}. Revise os módulos e salve para aplicar.`,
    );
  }

  function openRestoreModal() {
    setPanelError(null);
    setRestoreModalOpen(true);
  }

  return (
    <div className="mx-auto max-w-550 space-y-3 px-0 pb-2 pt-1 sm:space-y-4">
      <section
        className="relative overflow-hidden rounded-[28px] border border-(--tc-border) p-4 text-white sm:rounded-4xl sm:p-5 xl:p-6 [background:linear-gradient(135deg,var(--tc-primary)_0%,var(--tc-primary-dark)_56%,rgba(239,0,1,0.88)_170%)] shadow-[0_32px_90px_rgba(1,24,72,0.22)]"
      >
        <div className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full blur-3xl bg-[rgba(255,255,255,0.12)]" />
        <div className="pointer-events-none absolute right-0 top-8 h-56 w-56 rounded-full blur-3xl bg-[rgba(239,0,1,0.3)]" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-44 w-44 rounded-full blur-3xl bg-[rgba(59,130,246,0.22)]" />

        <div className="relative space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-5xl space-y-2">
              <h1 className="text-[30px] font-semibold tracking-tight text-white [text-shadow:0_12px_35px_rgba(1,24,72,0.28)] sm:text-[40px]">
                Gestão de permissões por usuário
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-white/88 sm:text-[15px]">
                Filtre usuários, ajuste o perfil base e gerencie os módulos e ações em um único painel.
              </p>
            </div>
            {canManagePrivilegedProfiles ? (
              <button
                type="button"
                onClick={() => {
                  resetCreateGlobalForm();
                  setCreateGlobalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-white/18 bg-white/12 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(1,24,72,0.18)] backdrop-blur-sm transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <FiPlus size={16} />
                Criar Global
              </button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 rounded-3xl border border-white/15 bg-white/12 px-4 py-4 shadow-[0_16px_36px_rgba(1,24,72,0.18)] backdrop-blur-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/78">Usuários vinculados</div>
              <div className="mt-2 text-3xl font-semibold text-white">{testingCompanyUsersCount}</div>
              <div className="mt-1 text-xs text-white/84">Contas de usuários ligadas a empresas</div>
            </div>
            <div className="min-w-0 rounded-3xl border border-white/15 bg-white/12 px-4 py-4 shadow-[0_16px_36px_rgba(1,24,72,0.18)] backdrop-blur-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/78">Contas de acesso cadastradas</div>
              <div className="mt-2 text-3xl font-semibold text-white">{users.length}</div>
              <div className="mt-1 text-xs text-white/84">Total de usuários com login na plataforma</div>
            </div>
            <div className="min-w-0 rounded-3xl border border-white/15 bg-white/12 px-4 py-4 shadow-[0_16px_36px_rgba(1,24,72,0.18)] backdrop-blur-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/78">Resultados atuais</div>
              <div className="mt-2 text-3xl font-semibold text-white">{filteredUsers.length}</div>
              <div className="mt-1 text-xs text-white/84">Lista filtrada por busca e perfil</div>
            </div>
            <div className="min-w-0 rounded-3xl border border-white/15 bg-white/12 px-4 py-4 shadow-[0_16px_36px_rgba(1,24,72,0.18)] backdrop-blur-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/78">Empresas cadastradas</div>
              <div className="mt-2 text-3xl font-semibold text-white">{companies.length}</div>
              <div className="mt-1 text-xs text-white/84">Empresas disponíveis na base da plataforma</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid items-stretch gap-4 xl:grid-cols-[348px_minmax(0,1fr)] 2xl:grid-cols-[368px_minmax(0,1fr)]">
        <aside
          className="flex min-h-190 flex-col overflow-hidden rounded-[28px] border border-(--tc-border) bg-(--tc-surface) xl:sticky xl:top-4 xl:h-[calc(100vh-6.5rem)] shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
        >
          <div className="border-b border-(--tc-border) p-4 sm:p-5 [background:linear-gradient(180deg,rgba(1,24,72,0.08),transparent)]">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent)">Usuários</p>
                <h2 className="text-[20px] font-semibold tracking-tight text-(--tc-text-primary)">Selecione um usuário para editar permissões</h2>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)">Busca</span>
                <div className="flex items-center gap-3 rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2.5 focus-within:border-(--tc-accent) focus-within:ring-2 focus-within:ring-[rgba(239,0,1,0.14)]">
                  <FiSearch className="text-(--tc-accent)" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por nome, usuário, e-mail ou empresa"
                    className="w-full bg-transparent text-sm text-(--tc-text-primary) outline-none placeholder:text-(--tc-text-muted)"
                  />
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)">Tipo de perfil</span>
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar tipo de perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_FILTERS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label} ({roleCounts[option.value as RoleFilter] ?? 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              {query.trim() ? (
                <div className="text-sm font-medium text-(--tc-text-secondary)">
                  {filteredUsers.length} {filteredUsers.length === 1 ? "resultado" : "resultados"}
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-3 [scrollbar-gutter:stable]">
            <div className="min-w-0 pr-2">
            {usersLoading && <p className="px-2 py-4 text-sm text-(--tc-text-muted)">Carregando usuários...</p>}
            {usersError && !usersLoading && (
              <p className="rounded-2xl border border-[rgba(239,0,1,0.18)] bg-[rgba(239,0,1,0.08)] px-4 py-3 text-sm text-(--tc-accent)">
                {friendlyUiError(usersError, "Não foi possível carregar a lista de usuários agora.")}
              </p>
            )}
            {!usersLoading && !usersError && filteredUsers.length === 0 && (
              <p className="px-2 py-4 text-sm text-(--tc-text-muted)">
                Nenhum usuário encontrado para a combinação atual de busca e perfil.
              </p>
            )}

            <div className="space-y-3">
              {filteredUsers.map((user) => {
                const selected = user.id === selectedUserId;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={`group box-border w-full overflow-hidden rounded-[22px] border px-3.5 py-3 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(239,0,1,0.22)] focus-visible:ring-offset-2 focus-visible:ring-offset-(--tc-surface) ${
                      selected
                        ? "border-[rgba(1,24,72,0.08)] text-white [background:linear-gradient(135deg,rgba(1,24,72,0.94)_0%,rgba(8,42,108,0.94)_78%)] shadow-[0_16px_28px_rgba(1,24,72,0.16)]"
                        : "border-(--tc-border) text-(--tc-text-primary) hover:border-[rgba(1,24,72,0.12)] [background:linear-gradient(180deg,var(--tc-surface)_0%,var(--tc-surface-2)_100%)] shadow-[0_8px_18px_rgba(15,23,42,0.04)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AvatarIdentity user={user} selected={selected} />

                      <div className="min-w-0 flex-1 space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{getDisplayName(user)}</p>
                            {getUserSecondaryLabel(user) ? (
                              <p className={`truncate text-[11px] ${selected ? "text-white/76" : "text-(--tc-text-secondary)"}`}>
                                {getUserSecondaryLabel(user)}
                              </p>
                            ) : null}
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${roleTone(user.permission_role ?? user.role, selected)}`}>
                            {roleLabel(user.permission_role ?? user.role)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={`rounded-full px-2.5 py-1 ${statusTone(user.status, selected)}`}>
                            {statusLabel(user.status)}
                          </span>
                          {selected && (
                            <span
                              title={companyTitle(user)}
                              className="truncate text-[11px] text-white/74"
                            >
                              {companyLabel(user)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            </div>
          </div>
        </aside>

        <section
          className="flex min-h-190 flex-col overflow-hidden rounded-4xl border border-(--tc-border) bg-(--tc-surface) xl:h-[calc(100vh-6.5rem)] shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
        >
          {!selectedUser && (
            <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
              <div className="max-w-md space-y-4">
                <div
                  className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-3xl text-white [background:linear-gradient(135deg,var(--tc-primary)_0%,var(--tc-primary-dark)_58%,rgba(239,0,1,0.82)_180%)] shadow-[0_18px_40px_rgba(1,24,72,0.22)]"
                >
                  <FiUsers size={24} />
                </div>
                <h2 className="text-xl font-semibold text-(--tc-text-primary)">Selecione um usuário</h2>
                <p className="text-sm leading-6 text-(--tc-text-muted)">
                  Escolha um usuário na coluna da esquerda para revisar o perfil base, ajustar permissões e salvar as alterações.
                </p>
              </div>
            </div>
          )}

          {selectedUser && (
              <div className="flex min-h-0 flex-1 flex-col gap-4 p-3 sm:p-4">
              <header
                className="relative overflow-hidden rounded-3xl border border-[rgba(1,24,72,0.12)] p-3 text-white sm:rounded-[28px] sm:p-4 [background:linear-gradient(135deg,var(--tc-primary)_0%,rgba(10,34,90,0.96)_62%,rgba(239,0,1,0.82)_180%)] shadow-[0_22px_56px_rgba(1,24,72,0.18)]"
              >
                <div className="pointer-events-none absolute -right-10 top-0 h-28 w-28 rounded-full blur-3xl bg-[rgba(255,255,255,0.12)]" />
                <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full blur-3xl bg-[rgba(239,0,1,0.2)]" />

                <div className="relative flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-start gap-3">
                      <AvatarIdentity user={selectedUser} selected size="lg" />
                      <div className="min-w-0 space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">Usuário selecionado</div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h2 className="min-w-0 truncate text-[22px] font-semibold tracking-tight text-white [text-shadow:0_10px_24px_rgba(1,24,72,0.24)] sm:text-[26px]">
                            {getDisplayName(selectedUser)}
                          </h2>
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${
                              isUserActive(selectedUser)
                                ? "border-[rgba(16,185,129,0.24)] bg-[rgba(16,185,129,0.14)] text-white"
                                : "border-[rgba(239,0,1,0.24)] bg-[rgba(239,0,1,0.14)] text-white"
                            }`}
                          >
                            <span className={`h-2 w-2 rounded-full ${isUserActive(selectedUser) ? "bg-emerald-300" : "bg-red-300"}`} />
                            {statusLabel(selectedUser.status)}
                          </span>
                        </div>
                        {getDisplayUserHandle(selectedUser) ? (
                          <div className="text-sm font-medium text-white/88">{getDisplayUserHandle(selectedUser)}</div>
                        ) : null}
                        {isValidEmailAddress(selectedUser.email) ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-white/82">
                            <span className="break-all">{selectedUser.email}</span>
                            <button
                              type="button"
                              onClick={() => void handleCopyEmail()}
                              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                            >
                              <FiCopy size={12} />
                              Copiar e-mail
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {canEditProfileBase ? (
                      <Select value={profileDraft} onValueChange={(value) => startProfileComparison(normalizeRole(value))}>
                        <SelectTrigger className="h-auto min-w-52.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white shadow-none focus-visible:ring-white/60 data-placeholder:text-white/72">
                          Perfil de origem: {roleLabel(profileDraft)}
                        </SelectTrigger>
                        <SelectContent className="min-w-[18rem]">
                          {availableProfileOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex flex-col">
                                <span className="font-semibold text-(--tc-text-primary)">{option.label}</span>
                                <span className="text-xs text-(--tc-text-muted)">{option.hint}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div
                        className="inline-flex min-w-52.5 items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/88"
                        title="Somente o perfil Global pode alterar ou criar perfis privilegiados."
                      >
                        Perfil de origem: {roleLabel(profileDraft)}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setPermissionsViewerOpen(true)}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-medium text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      Permissões ativas: {totalActiveActions}
                    </button>
                    <button
                      type="button"
                      onClick={openRestoreModal}
                      className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-3 py-1.5 font-medium text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      <FiRotateCcw size={14} />
                      Restaurar padrão
                    </button>
                  </div>
                </div>
              </header>

              {panelLoading && <p className="text-sm text-(--tc-text-muted)">Carregando permissões...</p>}
              {panelError && (
                <p className="rounded-[22px] border border-[rgba(239,0,1,0.18)] bg-[rgba(239,0,1,0.08)] px-4 py-3 text-sm text-(--tc-accent)">
                  {friendlyUiError(panelError, "Não foi possível carregar ou salvar as permissões agora.")}
                </p>
              )}
              {message && (
                <p className="rounded-[22px] border border-[rgba(16,185,129,0.22)] bg-[rgba(16,185,129,0.12)] px-4 py-3 text-sm text-(--tc-text-primary)">
                  {message}
                </p>
              )}

              {!panelLoading && permissionData && (
                <section className="flex min-h-0 flex-1 flex-col rounded-[30px] border border-(--tc-border) bg-(--tc-surface) shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
                  <div className="border-b border-(--tc-border) px-5 py-5 sm:px-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent)">Permissões por módulo</p>
                        <h3 className="text-lg font-semibold text-(--tc-text-primary)">Selecione um módulo e ajuste as ações ao lado</h3>
                      </div>
                      <div className="rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-3 py-1.5 text-xs font-semibold text-(--tc-text-muted)">
                        {PERMISSION_MODULES.length} módulos cadastrados
                      </div>
                    </div>
                  </div>

                  <div className="grid min-h-0 flex-1 gap-4 p-4 sm:p-5 xl:grid-cols-[248px_minmax(0,1fr)]">
                    <section className="flex min-h-0 flex-col rounded-[22px] border border-(--tc-border) bg-(--tc-surface-2) p-2">
                      <ScrollArea className="min-h-0 flex-1" viewportClassName="pr-5">
                        <div className="space-y-1.5">
                          {PERMISSION_MODULES.map((module) => {
                            const checkedCount = (effectivePermissions[module.id] ?? []).length;
                            const customCount =
                              (normalizePermissionMatrix(draftOverride.allow)[module.id] ?? []).length +
                              (normalizePermissionMatrix(draftOverride.deny)[module.id] ?? []).length;
                            const selected = activeModule?.id === module.id;

                            return (
                              <button
                                key={module.id}
                                type="button"
                                onClick={() => setOpenModule(module.id)}
                                className={`w-full rounded-[14px] border border-(--tc-border) px-3 py-2 text-left transition-colors ${
                                  selected
                                    ? "border-[rgba(239,0,1,0.14)] bg-[rgba(239,0,1,0.05)]"
                                    : "bg-(--tc-surface) hover:bg-white"
                                }`}
                              >
                                <div className="flex min-h-10.5 items-center justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`h-2 w-2 rounded-full ${selected ? "bg-(--tc-accent)" : "bg-(--tc-border)"}`}
                                      />
                                      <div className="text-[13px] font-semibold leading-5 text-(--tc-text-primary)">{module.label}</div>
                                    </div>
                                  </div>
                                  <div
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      selected
                                        ? "border border-[rgba(239,0,1,0.16)] bg-[rgba(239,0,1,0.08)] text-(--tc-accent)"
                                        : "border border-(--tc-border) bg-(--tc-surface-2) text-(--tc-text-muted)"
                                    }`}
                                  >
                                    {checkedCount}/{module.actions.length}
                                  </div>
                                </div>
                                {customCount > 0 ? (
                                  <div className="mt-1 text-[10px] font-semibold text-(--tc-accent)">
                                    {customCount} ajustes
                                  </div>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </section>

                    {activeModule && (
                      <section className="flex min-h-0 flex-col rounded-3xl border border-(--tc-border) bg-(--tc-surface)">
                        <div className="border-b border-(--tc-border) px-4 py-4 sm:px-5">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-1">
                              <div className="inline-flex rounded-full border border-[rgba(239,0,1,0.12)] bg-[rgba(239,0,1,0.06)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-accent)">
                                {activeModule.category}
                              </div>
                              <h4 className="text-lg font-semibold text-(--tc-text-primary)">{activeModule.label}</h4>
                              <p className="text-sm leading-6 text-(--tc-text-secondary)">{activeModule.description}</p>
                            </div>

                            <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                              <span className="rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-3 py-1 text-(--tc-text-muted)">
                                {(effectivePermissions[activeModule.id] ?? []).length} ativas
                              </span>
                              <span className="rounded-full border border-[rgba(1,24,72,0.12)] bg-[rgba(1,24,72,0.06)] px-3 py-1 text-(--tc-primary)">
                                {activeModule.actions.length} ações
                              </span>
                            </div>
                          </div>
                        </div>

                        <ScrollArea className="min-h-0 flex-1" viewportClassName="p-4 pr-5 pb-5 sm:p-4 sm:pr-6 sm:pb-6">
                          <div className="grid gap-2 2xl:grid-cols-2">
                            {activeModule.actions.map((action) => {
                              const checked = (effectivePermissions[activeModule.id] ?? []).includes(action);
                              const overrideState = getOverrideState(roleDefaultsPreview, draftOverride, activeModule.id, action);

                              return (
                                <label
                                  key={`${activeModule.id}:${action}`}
                                  className={`flex flex-col items-start gap-2 rounded-2xl border px-3 py-2.5 transition sm:flex-row sm:items-center sm:justify-between ${
                                    checked
                                      ? "border-[rgba(1,24,72,0.16)] bg-[rgba(1,24,72,0.04)] shadow-[0_12px_24px_rgba(1,24,72,0.06)]"
                                      : "border-(--tc-border) bg-(--tc-surface)"
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={`h-2.5 w-2.5 rounded-full ${checked ? "bg-(--tc-accent)" : "bg-(--tc-border)"}`} />
                                      <span className="text-sm font-medium text-(--tc-text-primary)">{getActionLabel(action)}</span>
                                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${toneForOverride(overrideState)}`}>
                                        {badgeLabel(overrideState)}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-(--tc-text-secondary)">
                                      {activeModule.label} - {getActionLabel(action)}
                                    </p>
                                  </div>

                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(event) =>
                                      setDraftOverride((current) =>
                                        toggleOverride(roleDefaultsPreview, current, activeModule.id, action, event.target.checked),
                                      )
                                    }
                                    className="h-4 w-4 rounded border-(--tc-border) self-end sm:self-auto accent-(--tc-accent)"
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </section>
                    )}
                  </div>
                  <div className="border-t border-(--tc-border) bg-(--tc-surface) px-4 py-3 sm:px-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          hasDraftChanges
                            ? "border border-[rgba(245,158,11,0.24)] bg-[rgba(245,158,11,0.12)] text-[#b45309]"
                            : "border border-[rgba(16,185,129,0.22)] bg-[rgba(16,185,129,0.12)] text-[#047857]"
                        }`}
                      >
                        {hasDraftChanges ? `${customAllowCount} permissões adicionadas e ${customDenyCount} removidas na edição atual` : "Sem alterações pendentes"}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving || panelLoading || !hasDraftChanges || (roleNeedsCompany(profileDraft) && !companyDraft)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(239,0,1,0.18)] disabled:opacity-60 [background:linear-gradient(135deg,var(--tc-accent)_0%,var(--tc-accent-hover)_100%)]"
                      >
                        <FiSave size={16} />
                        {saving ? "Salvando..." : "Salvar alterações"}
                      </button>
                    </div>
                  </div>
                </section>
              )}
              </div>
          )}
        </section>
      </div>

      <SurfaceModal
        open={createGlobalOpen}
        title="Criar Global"
        onClose={() => {
          setCreateGlobalOpen(false);
          resetCreateGlobalForm();
        }}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setCreateGlobalOpen(false);
                resetCreateGlobalForm();
              }}
              className="inline-flex items-center justify-center rounded-2xl border border-(--tc-border) bg-(--tc-surface) px-4 py-2.5 text-sm font-medium text-(--tc-text-primary) transition hover:bg-(--tc-surface)"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleCreateGlobal()}
              disabled={createGlobalLoading}
              className="inline-flex items-center justify-center rounded-2xl bg-(--tc-accent) px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {createGlobalLoading ? "Criando..." : "Criar Global"}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-2 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)">Nome completo</span>
            <input
              value={createGlobalDraft.fullName}
              onChange={(event) => setCreateGlobalDraft((current) => ({ ...current, fullName: event.target.value }))}
              className="w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2.5 text-sm text-(--tc-text-primary) outline-none focus:border-(--tc-accent)"
              placeholder="Nome completo"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)">Usuario</span>
            <input
              value={createGlobalDraft.user}
              onChange={(event) => setCreateGlobalDraft((current) => ({ ...current, user: event.target.value }))}
              className="w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2.5 text-sm text-(--tc-text-primary) outline-none focus:border-(--tc-accent)"
              placeholder="login.global"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)">E-mail</span>
            <input
              type="email"
              value={createGlobalDraft.email}
              onChange={(event) => setCreateGlobalDraft((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2.5 text-sm text-(--tc-text-primary) outline-none focus:border-(--tc-accent)"
              placeholder="global@testingcompany.test"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)">Telefone</span>
            <input
              value={createGlobalDraft.phone}
              onChange={(event) => setCreateGlobalDraft((current) => ({ ...current, phone: event.target.value }))}
              className="w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2.5 text-sm text-(--tc-text-primary) outline-none focus:border-(--tc-accent)"
              placeholder="+55 11 99999-9999"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)">Senha</span>
            <input
              type="password"
              value={createGlobalDraft.password}
              onChange={(event) => setCreateGlobalDraft((current) => ({ ...current, password: event.target.value }))}
              className="w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2.5 text-sm text-(--tc-text-primary) outline-none focus:border-(--tc-accent)"
              placeholder="Minimo de 8 caracteres"
              autoComplete="new-password"
            />
          </label>
        </div>

        {createGlobalError ? (
          <div className="rounded-[18px] border border-[rgba(239,0,1,0.16)] bg-[rgba(239,0,1,0.08)] px-4 py-3 text-sm text-(--tc-accent)">
            {createGlobalError}
          </div>
        ) : null}
      </SurfaceModal>

      <SurfaceModal
        open={profileComparisonOpen}
        title="Atenção"
        description="Ao confirmar, o perfil selecionado substitui a base atual do usuário. Revise o impacto por módulo antes de continuar."
        onClose={() => setProfileComparisonOpen(false)}
        size="wide"
        tone="alert"
        icon={<FiAlertTriangle size={20} />}
        footer={
          <>
            <button
              type="button"
              onClick={() => setProfileComparisonOpen(false)}
              className="inline-flex items-center justify-center rounded-2xl border border-(--tc-border) bg-(--tc-surface) px-4 py-2.5 text-sm font-medium text-(--tc-text-primary) transition hover:bg-(--tc-surface)"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmProfileChange}
              className="inline-flex items-center justify-center rounded-2xl bg-(--tc-accent) px-4 py-2.5 text-sm font-semibold text-white"
            >
              Confirmar alteração
            </button>
          </>
        }
      >
        <div
          className="rounded-3xl border border-[rgba(239,0,1,0.18)] px-5 py-4 [background:linear-gradient(135deg,rgba(239,0,1,0.08),rgba(1,24,72,0.04))]"
        >
          <div className="text-lg font-semibold text-(--tc-text-primary)">A troca de perfil redefine a base do usuário.</div>
          <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary)">
            Ao confirmar esta alteração, o perfil selecionado substituirá o perfil atual. Permissões e dados vinculados ao perfil de origem podem deixar de existir ou não ser recuperáveis.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[220px_220px_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Perfil atual</div>
            <div className="mt-2 text-base font-semibold text-(--tc-text-primary)">{roleLabel(profileDraft)}</div>
          </div>
          <div className="rounded-[20px] border border-[rgba(239,0,1,0.14)] bg-[rgba(239,0,1,0.06)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Novo perfil</div>
            <div className="mt-2 text-base font-semibold text-(--tc-text-primary)">{roleLabel(profileModalRole)}</div>
          </div>
          <div className="rounded-[20px] border border-[rgba(1,24,72,0.12)] bg-[rgba(1,24,72,0.05)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Permissões atuais</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{profileChangePreview.currentCount} permissões</div>
            <div className="mt-1 text-xs leading-5 text-(--tc-text-secondary)">{roleHint(profileDraft)}</div>
          </div>
          <div className="rounded-[20px] border border-[rgba(239,0,1,0.14)] bg-[rgba(239,0,1,0.06)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Permissões do novo perfil</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{profileChangePreview.nextCount} permissões</div>
            <div className="mt-1 text-xs leading-5 text-(--tc-text-secondary)">{roleHint(profileModalRole)}</div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-3xl border border-[rgba(1,24,72,0.12)] bg-[rgba(1,24,72,0.04)]">
            <div className="border-b border-[rgba(1,24,72,0.08)] px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Perfil atual</div>
              <div className="mt-2 text-base font-semibold text-(--tc-text-primary)">{roleLabel(profileDraft)}</div>
            </div>
            <ScrollArea className="max-h-[44vh]" viewportClassName="p-4 pr-5 pb-5">
              <div className="space-y-3">
                {currentRoleModules.map((module) => (
                  <div key={`current-${module.id}`} className="rounded-[18px] border border-[rgba(1,24,72,0.1)] bg-white/60 px-4 py-3">
                    <div className="text-sm font-semibold text-(--tc-text-primary)">{module.label}</div>
                    <div className="mt-1 text-xs leading-5 text-(--tc-text-secondary)">{module.description}</div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {module.actions.map((action) => (
                        <span key={`current-${module.id}-${action}`} className="rounded-full border border-[rgba(1,24,72,0.12)] bg-[rgba(1,24,72,0.06)] px-2.5 py-1 text-[11px] font-semibold text-(--tc-primary)">
                          {getActionLabel(action)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </section>

          <section className="rounded-3xl border border-[rgba(239,0,1,0.14)] bg-[rgba(239,0,1,0.05)]">
            <div className="border-b border-[rgba(239,0,1,0.08)] px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Novo perfil</div>
              <div className="mt-2 text-base font-semibold text-(--tc-text-primary)">{roleLabel(profileModalRole)}</div>
            </div>
            <ScrollArea className="max-h-[44vh]" viewportClassName="p-4 pr-5 pb-5">
              <div className="space-y-3">
                {nextRoleModules.map((module) => (
                  <div key={`next-${module.id}`} className="rounded-[18px] border border-[rgba(239,0,1,0.12)] bg-white/70 px-4 py-3">
                    <div className="text-sm font-semibold text-(--tc-text-primary)">{module.label}</div>
                    <div className="mt-1 text-xs leading-5 text-(--tc-text-secondary)">{module.description}</div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {module.actions.map((action) => (
                        <span key={`next-${module.id}-${action}`} className="rounded-full border border-[rgba(239,0,1,0.12)] bg-[rgba(239,0,1,0.06)] px-2.5 py-1 text-[11px] font-semibold text-(--tc-accent)">
                          {getActionLabel(action)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </section>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Perde na troca</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{profileChangePreview.lostCount} permissões</div>
            {profileChangePreview.lostPreview.length > 0 && (
              <div className="mt-2 text-xs leading-5 text-(--tc-text-secondary)">{profileChangePreview.lostPreview.join(" | ")}</div>
            )}
          </div>
          <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Ganha na troca</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{profileChangePreview.gainedCount} permissões</div>
            {profileChangePreview.gainedPreview.length > 0 && (
              <div className="mt-2 text-xs leading-5 text-(--tc-text-secondary)">{profileChangePreview.gainedPreview.join(" | ")}</div>
            )}
          </div>
          <div className="rounded-[20px] border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.12)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#92400e]">Aviso</div>
            <div className="mt-2 text-sm leading-6 text-[#a16207]">
              {nextRoleNeedsExtraData
                ? profileCandidateCompanyId
                  ? `Empresa compatível reaproveitada: ${profileCandidateCompanyLabel}. Ao confirmar, esse vínculo seguirá para o novo perfil sem abrir a segunda etapa.`
                  : `O perfil ${roleLabel(profileModalRole)} exige empresa vinculada. Como esse campo ainda não existe, a próxima etapa solicitará apenas esse dado faltante.`
                : "A mudança atualiza a base do usuário na edição atual. Depois, salve para aplicar no sistema."}
            </div>
          </div>
        </div>
      </SurfaceModal>

      <SurfaceModal
        open={profileRequirementsOpen}
        title="Completar dados obrigatórios"
        description="O novo perfil depende de dados adicionais para concluir a troca. Defina o vínculo exigido antes de aplicar a nova base."
        onClose={() => {
          setProfileRequirementsOpen(false);
          setProfileComparisonOpen(true);
        }}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setProfileRequirementsOpen(false);
                setProfileComparisonOpen(true);
              }}
              className="inline-flex items-center justify-center rounded-2xl border border-(--tc-border) bg-(--tc-surface) px-4 py-2.5 text-sm font-medium text-(--tc-text-primary) transition hover:bg-(--tc-surface)"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={confirmProfileRequirements}
              disabled={!profileModalCompany}
              className="inline-flex items-center justify-center rounded-2xl bg-(--tc-accent) px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Concluir mudança
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Perfil atual</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{roleLabel(profileDraft)}</div>
          </div>
          <div className="rounded-[20px] border border-[rgba(239,0,1,0.14)] bg-[rgba(239,0,1,0.06)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Novo perfil</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{roleLabel(profileModalRole)}</div>
          </div>
        </div>

        <div className="rounded-[20px] border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.12)] px-4 py-3 text-sm leading-6 text-[#a16207]">
          Este perfil exige uma empresa principal para concluir a alteração. Sem esse vínculo, o usuário fica sem contexto operacional válido.
        </div>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)">Empresa principal</span>
          <Select value={profileModalCompany} onValueChange={setProfileModalCompany}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a empresa obrigatória" />
            </SelectTrigger>
            <SelectContent>
              {filteredCompanies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        {companiesLoading && <p className="text-xs text-(--tc-text-muted)">Carregando empresas...</p>}
        {companiesError && <p className="text-xs text-(--tc-accent)">{friendlyUiError(companiesError, "Não foi possível carregar as empresas agora.")}</p>}
      </SurfaceModal>

      <SurfaceModal
        open={permissionsViewerOpen}
        title="Permissões ativas"
        description="Resumo do acesso atual do usuário."
        onClose={() => setPermissionsViewerOpen(false)}
        size="wide"
        icon={<FiShield size={20} />}
        footer={
          <button
            type="button"
            onClick={() => setPermissionsViewerOpen(false)}
            className="inline-flex items-center justify-center rounded-2xl border border-(--tc-border) bg-(--tc-surface) px-4 py-2.5 text-sm font-medium text-(--tc-text-primary) transition hover:bg-(--tc-surface)"
          >
            Fechar
          </button>
        }
      >
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div
            className="rounded-[26px] border border-(--tc-border) px-5 py-5 sm:px-6 [background:linear-gradient(135deg,rgba(1,24,72,0.06),rgba(1,24,72,0.02))]"
          >
            <div className="flex items-start gap-4">
              <AvatarIdentity user={selectedUser} size="lg" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Usuario</div>
                <div className="mt-1 text-xl font-semibold text-(--tc-text-primary)">{getDisplayName(selectedUser)}</div>
                {getUserSecondaryLabel(selectedUser) ? (
                  <div className="mt-1 text-sm text-(--tc-text-secondary)">{getUserSecondaryLabel(selectedUser)}</div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[rgba(1,24,72,0.12)] bg-[rgba(1,24,72,0.06)] px-3 py-1 text-xs font-semibold text-(--tc-primary)">
                    {roleLabel(profileDraft)}
                  </span>
                  <span
                    className="rounded-full border border-(--tc-border) bg-(--tc-surface) px-3 py-1 text-xs font-semibold text-(--tc-text-secondary)"
                    title={draftCompanyLabel}
                  >
                    {draftCompanyLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-[22px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted)">
                <FiGrid size={13} />
                Modulos
              </div>
              <div className="mt-3 text-2xl font-semibold text-(--tc-text-primary)">{totalActiveModules}</div>
            </div>
            <div className="rounded-[22px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted)">
                <FiShield size={13} />
                Permissoes
              </div>
              <div className="mt-3 text-2xl font-semibold text-(--tc-text-primary)">{totalActiveActions}</div>
            </div>
            <div className="rounded-[22px] border border-[rgba(1,24,72,0.14)] bg-(--tc-surface) px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted)">Ajustes manuais</div>
              <div className="mt-3 text-2xl font-semibold text-(--tc-text-primary)">{customAllowCount + customDenyCount}</div>
              <div className="mt-2 text-xs font-medium text-(--tc-text-secondary)">
                +{customAllowCount} liberadas / -{customDenyCount} bloqueadas
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[26px] border border-(--tc-border) bg-(--tc-surface)">
          <div className="flex flex-col gap-3 border-b border-(--tc-border) px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <div className="text-lg font-semibold text-(--tc-text-primary)">Acessos por modulo</div>
              <div className="mt-1 text-sm text-(--tc-text-secondary)">Leitura direta dos modulos liberados no estado atual.</div>
            </div>
            <div className="rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-3 py-1.5 text-xs font-semibold text-(--tc-text-muted)">
              {effectiveModuleGroups.length} categorias
            </div>
          </div>
          <ScrollArea className="max-h-[58vh]" viewportClassName="p-5 pr-6 pb-5 sm:p-6 sm:pr-7 sm:pb-6">
            {effectiveModuleGroups.length ? (
              <div className="space-y-6">
                {effectiveModuleGroups.map((group) => (
                  <section key={`viewer-group-${group.category}`} className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-base font-semibold text-(--tc-text-primary)">{group.category}</div>
                      <div className="rounded-full border border-[rgba(1,24,72,0.1)] bg-[rgba(1,24,72,0.05)] px-3 py-1.5 text-xs font-semibold text-(--tc-primary)">
                        {group.actionsCount} permissoes
                      </div>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-2">
                      {group.modules.map((module) => (
                        <article
                          key={`viewer-${group.category}-${module.id}`}
                          className="rounded-[22px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-base font-semibold text-(--tc-text-primary)">{module.label}</div>
                            </div>
                            <div className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-2xl border border-[rgba(1,24,72,0.12)] bg-(--tc-surface) px-3 text-sm font-semibold text-(--tc-primary)">
                              {module.actions.length}
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {module.actions.map((action) => (
                              <span
                                key={`viewer-${module.id}-${action}`}
                                className="rounded-full border border-[rgba(1,24,72,0.12)] bg-[rgba(1,24,72,0.06)] px-2.5 py-1 text-[11px] font-semibold text-(--tc-primary)"
                              >
                                {getActionLabel(action)}
                              </span>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-(--tc-border) bg-(--tc-surface-2) px-4 py-8 text-center">
                <div className="text-base font-semibold text-(--tc-text-primary)">Nenhuma permissão ativa encontrada</div>
                <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary)">
                  Revise o perfil base e as personalizações aplicadas para liberar acesso a algum módulo.
                </p>
              </div>
            )}
          </ScrollArea>
        </section>
      </SurfaceModal>

      <SurfaceModal
        open={restoreModalOpen}
        title="Atenção"
        description="Revise o impacto antes de restaurar a edição atual. A origem salva do usuário volta a ser a base e personalizações fora dela deixam de valer."
        onClose={() => setRestoreModalOpen(false)}
        size="wide"
        tone="alert"
        icon={<FiAlertTriangle size={20} />}
        footer={
          <>
            <button
              type="button"
              onClick={() => setRestoreModalOpen(false)}
              className="inline-flex items-center justify-center rounded-2xl border border-(--tc-border) bg-(--tc-surface) px-4 py-2.5 text-sm font-medium text-(--tc-text-primary) transition hover:bg-(--tc-surface)"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleResetDraft}
              className="inline-flex items-center justify-center rounded-2xl bg-(--tc-accent) px-4 py-2.5 text-sm font-semibold text-white"
            >
              Confirmar restauração
            </button>
          </>
        }
      >
        <div
          className="rounded-3xl border border-[rgba(239,0,1,0.18)] px-5 py-4 [background:linear-gradient(135deg,rgba(239,0,1,0.08),rgba(1,24,72,0.04))]"
        >
          <div className="text-lg font-semibold text-(--tc-text-primary)">A restauração substitui o estado atual da edição.</div>
          <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary)">
            Ao confirmar, o sistema remove personalizações que não pertencem ao perfil de origem salvo e recalcula o contexto operacional do usuário. Revise o impacto em perfil, vínculo e permissões antes de continuar.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[220px_220px_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Perfil atual</div>
            <div className="mt-2 text-base font-semibold text-(--tc-text-primary)">{roleLabel(profileDraft)}</div>
          </div>
          <div className="rounded-[20px] border border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.08)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Após restaurar</div>
            <div className="mt-2 text-base font-semibold text-(--tc-text-primary)">{roleLabel(originalRole)}</div>
          </div>
          <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Vínculo atual</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">
              {resetCurrentCompanyLabel}
            </div>
          </div>
          <div className="rounded-[20px] border border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.08)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Vínculo restaurado</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{resetTargetCompanyLabel}</div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[20px] border border-[rgba(239,0,1,0.18)] bg-[rgba(239,0,1,0.08)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Base atual</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{resetPreview.currentCount} permissões ativas</div>
            <div className="mt-1 text-xs leading-5 text-(--tc-text-secondary)">
              {resetWillChangeRole
                ? `A edição atual está operando como ${roleLabel(profileDraft)}.`
                : `A edição atual segue a base ${roleLabel(profileDraft)}.`}
            </div>
          </div>
          <div className="rounded-[20px] border border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.08)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Origem restaurada</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{resetPreview.nextCount} permissões padrão</div>
            <div className="mt-1 text-xs leading-5 text-(--tc-text-secondary)">
              {`A base salva volta para ${roleLabel(originalRole)} sem personalizações manuais.`}
            </div>
          </div>
          <div className="rounded-[20px] border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.12)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#92400e]">Impacto da restauração</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">
              {resetWillChangeRole || resetWillChangeCompany ? "Perfil ou vínculo serão alterados" : "Base e vínculo já estão alinhados"}
            </div>
            <div className="mt-1 text-xs leading-5 text-[#a16207]">
              {resetWillChangeCompany
                ? `O vínculo principal volta para ${resetTargetCompanyLabel}.`
                : "O vínculo principal permanece no mesmo contexto salvo."}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-3xl border border-[rgba(239,0,1,0.14)] bg-[rgba(239,0,1,0.05)]">
            <div className="border-b border-[rgba(239,0,1,0.08)] px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Atual</div>
              <div className="mt-2 text-base font-semibold text-(--tc-text-primary)">{roleLabel(profileDraft)}</div>
            </div>
            <ScrollArea className="max-h-[38vh]" viewportClassName="p-4 pr-5 pb-5">
              <div className="space-y-3">
                {effectiveModuleSummary.map((module) => (
                  <div key={`restore-current-${module.id}`} className="rounded-[18px] border border-[rgba(239,0,1,0.12)] bg-white/70 px-4 py-3">
                    <div className="text-sm font-semibold text-(--tc-text-primary)">{module.label}</div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {module.actions.map((action) => (
                        <span key={`restore-current-${module.id}-${action}`} className="rounded-full border border-[rgba(239,0,1,0.12)] bg-[rgba(239,0,1,0.06)] px-2.5 py-1 text-[11px] font-semibold text-(--tc-accent)">
                          {getActionLabel(action)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </section>

          <section className="rounded-3xl border border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.06)]">
            <div className="border-b border-[rgba(16,185,129,0.12)] px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Padrão restaurado</div>
              <div className="mt-2 text-base font-semibold text-(--tc-text-primary)">{roleLabel(originalRole)}</div>
            </div>
            <ScrollArea className="max-h-[38vh]" viewportClassName="p-4 pr-5 pb-5">
              <div className="space-y-3">
                {resetTargetModules.map((module) => (
                  <div key={`restore-next-${module.id}`} className="rounded-[18px] border border-[rgba(16,185,129,0.16)] bg-white/80 px-4 py-3">
                    <div className="text-sm font-semibold text-(--tc-text-primary)">{module.label}</div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {module.actions.map((action) => (
                        <span key={`restore-next-${module.id}-${action}`} className="rounded-full border border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.08)] px-2.5 py-1 text-[11px] font-semibold text-[#047857]">
                          {getActionLabel(action)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </section>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[20px] border border-[rgba(239,0,1,0.18)] bg-[rgba(239,0,1,0.08)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Em vermelho: será removido</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{resetPreview.lostCount} permissões</div>
            {resetPreview.lostPreview.length > 0 ? (
              <div className="mt-2 text-xs leading-5 text-(--tc-text-secondary)">{resetPreview.lostPreview.join(" | ")}</div>
            ) : (
              <div className="mt-2 text-xs leading-5 text-(--tc-text-secondary)">Nenhuma permissão fora da origem atual será perdida.</div>
            )}
          </div>
          <div className="rounded-[20px] border border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.08)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">Em verde: volta ao padrão</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{resetPreview.gainedCount} permissões</div>
            {resetPreview.gainedPreview.length > 0 ? (
              <div className="mt-2 text-xs leading-5 text-(--tc-text-secondary)">{resetPreview.gainedPreview.join(" | ")}</div>
            ) : (
              <div className="mt-2 text-xs leading-5 text-(--tc-text-secondary)">O padrão já está alinhado com o que a origem exige.</div>
            )}
          </div>
        </div>

        <div className="rounded-[20px] border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.12)] px-4 py-3 text-sm leading-6 text-[#a16207]">
          Restaurar o padrão recalcula a base do perfil salvo e pode remover permissões e vínculos que não fazem parte da origem atual deste usuário. A restauração acontece na edição atual; depois disso, use salvar alterações para aplicar no sistema.
        </div>
      </SurfaceModal>
    </div>
  );
}






