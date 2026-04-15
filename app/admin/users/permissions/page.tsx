"use client";

export const dynamic = "force-dynamic";

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
import { editableProfileNeedsCompany, normalizeEditableProfileRole, type EditableProfileRole } from "@/lib/editableProfileRoles";
import {
  getFixedProfileHint,
  getFixedProfileLabel,
  getFixedProfileTone,
  resolveFixedProfileKind,
  type FixedProfileKind,
} from "@/lib/fixedProfilePresentation";
import { PERMISSION_MODULES, getActionLabel, getPermissionModule } from "@/lib/permissionCatalog";
import { resolveRoleDefaults } from "@/lib/roleDefaults";
import {
  applyPermissionOverride,
  getOverrideState,
  normalizePermissionMatrix,
  type PermissionMatrix,
  type PermissionOverride,
} from "@/lib/permissionMatrix";
import { useI18n } from "@/hooks/useI18n";

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
  profile_kind?: string | null;
  user_origin?: string | null;
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

type RoleFilter = "all" | FixedProfileKind;
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

function getRoleFilters(isPt: boolean): Array<{ value: RoleFilter; label: string; hint: string }> {
  return [
    { value: "all", label: isPt ? "Todos" : "All", hint: isPt ? "Todos os tipos de perfil" : "All profile types" },
    { value: "leader_tc", label: getFixedProfileLabel("leader_tc"), hint: getFixedProfileHint("leader_tc") },
    { value: "technical_support", label: getFixedProfileLabel("technical_support"), hint: getFixedProfileHint("technical_support") },
    { value: "empresa", label: getFixedProfileLabel("empresa", { short: true }), hint: getFixedProfileHint("empresa") },
    { value: "company_user", label: getFixedProfileLabel("company_user"), hint: getFixedProfileHint("company_user") },
    { value: "testing_company_user", label: getFixedProfileLabel("testing_company_user"), hint: getFixedProfileHint("testing_company_user") },
  ];
}

const PROFILE_OPTIONS: Array<{ value: EditableProfileRole; label: string; hint: string }> = [
  { value: "leader_tc", label: getFixedProfileLabel("leader_tc"), hint: getFixedProfileHint("leader_tc") },
  { value: "technical_support", label: getFixedProfileLabel("technical_support"), hint: getFixedProfileHint("technical_support") },
  { value: "empresa", label: getFixedProfileLabel("empresa"), hint: getFixedProfileHint("empresa") },
  { value: "company_user", label: getFixedProfileLabel("company_user"), hint: getFixedProfileHint("company_user") },
  { value: "testing_company_user", label: getFixedProfileLabel("testing_company_user"), hint: getFixedProfileHint("testing_company_user") },
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
  return normalizeEditableProfileRole(value);
}

function roleLabel(value?: string | null) {
  const normalized = normalizeRole(value);
  return getFixedProfileLabel(normalized, { short: false });
}

function roleHint(role: EditableProfileRole) {
  return getFixedProfileHint(role);
}

function roleNeedsCompany(role: EditableProfileRole) {
  return editableProfileNeedsCompany(role);
}

function statusLabel(value?: string | null, isPt = true) {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "inactive" || normalized === "blocked") return isPt ? "Inativo" : "Inactive";
  if (normalized === "invited") return isPt ? "Convidado" : "Invited";
  return isPt ? "Ativo" : "Active";
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

function badgeLabel(state: "allow" | "deny" | "default", isPt = true) {
  if (state === "allow") return isPt ? "Adicionado" : "Added";
  if (state === "deny") return isPt ? "Removido" : "Removed";
  return isPt ? "Perfil base" : "Base profile";
}

function profileKindForUser(user?: Pick<AdminUserItem, "profile_kind" | "permission_role" | "role" | "user_origin" | "company_count"> | null) {
  return resolveFixedProfileKind({
    profileKind: user?.profile_kind,
    permissionRole: user?.permission_role,
    role: user?.role,
    userOrigin: user?.user_origin,
    companyCount: user?.company_count,
  });
}

function profileLabelForUser(user?: Pick<AdminUserItem, "profile_kind" | "permission_role" | "role" | "user_origin" | "company_count"> | null) {
  return getFixedProfileLabel(profileKindForUser(user), { short: true });
}

function profileToneForUser(
  user?: Pick<AdminUserItem, "profile_kind" | "permission_role" | "role" | "user_origin" | "company_count"> | null,
  selected = false,
) {
  return getFixedProfileTone(profileKindForUser(user), { selected });
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

function getDisplayName(user?: Pick<AdminUserItem, "name" | "email"> | null, isPt = true) {
  return user?.name?.trim() || user?.email?.trim() || (isPt ? "Sem nome" : "No name");
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
  isPt?: boolean;
}) {
  const { user, selected = false, size = "sm", isPt = true } = props;
  const emoji = resolveAvatarEmoji(user?.avatar_key);
  const fallback = getInitials(getDisplayName(user, isPt));
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

function canManageInstitutionalProfiles(
  user?: { role?: string | null; permissionRole?: string | null; companyRole?: string | null } | null,
) {
  const resolvedRole =
    normalizeEditableProfileRole(user?.role);
  const resolvedPermissionRole =
    normalizeEditableProfileRole(user?.permissionRole);
  const resolvedCompanyRole =
    normalizeEditableProfileRole(user?.companyRole);
  return (
    resolvedRole === "leader_tc" ||
    resolvedPermissionRole === "leader_tc" ||
    resolvedCompanyRole === "leader_tc" ||
    resolvedRole === "technical_support" ||
    resolvedPermissionRole === "technical_support" ||
    resolvedCompanyRole === "technical_support"
  );
}

function companyLabel(user: AdminUserItem, isPt = true) {
  if (Array.isArray(user.company_names) && user.company_names.length > 1) {
    return `${user.company_names[0]} +${user.company_names.length - 1}`;
  }
  if (Array.isArray(user.company_names) && user.company_names.length === 1) {
    return user.company_names[0];
  }
  return user.company_name || (isPt ? "Sem empresa" : "No company");
}

function companyTitle(user: AdminUserItem, isPt = true) {
  if (Array.isArray(user.company_names) && user.company_names.length > 0) {
    return user.company_names.join(", ");
  }
  return user.company_name || (isPt ? "Sem empresa" : "No company");
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
  const matrix = normalizePermissionMatrix(resolveRoleDefaults(role));
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
        aria-label={title}
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
              aria-label={title}
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
  const { language } = useI18n();
  const isPt = language === "pt-BR";
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
  const [profileDraft, setProfileDraft] = useState<EditableProfileRole>("testing_company_user");
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
  const [profileModalRole, setProfileModalRole] = useState<EditableProfileRole>("testing_company_user");
  const [profileModalCompany, setProfileModalCompany] = useState("");

  const canManageProfiles = useMemo(() => canManageInstitutionalProfiles(authUser), [authUser]);

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
        setUsersError(json.error ?? (isPt ? "Não foi possível carregar os usuários." : "Could not load users."));
        return;
      }
      setUsers(Array.isArray(json.items) ? json.items : []);
    } catch (error) {
      setUsers([]);
      setUsersError(error instanceof Error ? error.message : (isPt ? "Não foi possível carregar os usuários." : "Could not load users."));
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
            ? json.error ?? (isPt ? "Não foi possível carregar as empresas." : "Could not load companies.")
            : (isPt ? "Não foi possível carregar as empresas." : "Could not load companies."),
        );
        return;
      }
      setCompanies(Array.isArray(json) ? json : []);
    } catch (error) {
      setCompanies([]);
      setCompaniesError(error instanceof Error ? error.message : (isPt ? "Não foi possível carregar as empresas." : "Could not load companies."));
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
        setPanelError(json.error ?? (isPt ? "Não foi possível carregar as permissões." : "Could not load permissions."));
        return;
      }
      setPermissionData(json);
    } catch (error) {
      setPermissionData(null);
      setDraftOverride(emptyOverride());
      setPanelError(error instanceof Error ? error.message : (isPt ? "Não foi possível carregar as permissões." : "Could not load permissions."));
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
      const profileKind = profileKindForUser(user);
      const matchesRole = roleFilter === "all" ? true : profileKind === roleFilter;
      if (!matchesRole) return false;

      if (!normalizedQuery) return true;
      return [
        user.name,
        user.email,
        user.company_name,
        profileLabelForUser(user),
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
      leader_tc: 0,
      technical_support: 0,
      empresa: 0,
      company_user: 0,
      testing_company_user: 0,
    };

    for (const user of users) {
      const role = profileKindForUser(user);
      counts[role] = (counts[role] ?? 0) + 1;
    }

    return counts;
  }, [users]);

  const roleFilters = useMemo(() => getRoleFilters(isPt), [isPt]);

  const availableProfileOptions = useMemo(() => {
    if (canManageProfiles) return PROFILE_OPTIONS;
    return PROFILE_OPTIONS.filter(
      (option) =>
        option.value !== "leader_tc" &&
        option.value !== "technical_support",
    );
  }, [canManageProfiles]);

  const testingCompanyUsersCount = useMemo(
    () => users.filter((user) => profileKindForUser(user) === "testing_company_user").length,
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
    () => normalizePermissionMatrix(resolveRoleDefaults(profileDraft)),
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
    if (!selectedUser) return isPt ? "Sem empresa" : "No company";
    const matched = filteredCompanies.find((company) => company.id === companyDraft);
    return matched?.name ?? companyLabel(selectedUser, isPt);
  }, [companyDraft, filteredCompanies, isPt, selectedUser]);

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
      const category = getPermissionModule(module.id)?.category ?? (isPt ? "Outros" : "Others");
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
  }, [effectiveModuleSummary, isPt]);

  const hasPermissionChanges = useMemo(
    () => serializeOverride(permissionData?.override) !== serializeOverride(draftOverride),
    [draftOverride, permissionData?.override],
  );

  const profileMetaChanged = useMemo(
    () => profileDraft !== originalRole || companyDraft !== originalCompanyId,
    [companyDraft, originalCompanyId, originalRole, profileDraft],
  );
  const canEditProfileBase = useMemo(() => {
    if (canManageProfiles) return true;
    return (
      profileDraft !== "leader_tc" &&
      profileDraft !== "technical_support"
    );
  }, [canManageProfiles, profileDraft]);

  const hasDraftChanges = hasPermissionChanges || profileMetaChanged;

  const initialOpenModule = useMemo(() => {
    const customModules = Array.from(
      new Set([
        ...Object.keys(normalizePermissionMatrix(permissionData?.override?.allow)),
        ...Object.keys(normalizePermissionMatrix(permissionData?.override?.deny)),
      ]),
    );
    if (customModules.length) return customModules[0] ?? "";
    if (profileDraft === "leader_tc") return "users";
    if (profileDraft === "technical_support") return "support";
    if (profileDraft === "empresa" || profileDraft === "company_user") return "tickets";
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
    const currentDefaults = normalizePermissionMatrix(resolveRoleDefaults(profileDraft));
    const nextDefaults = normalizePermissionMatrix(resolveRoleDefaults(profileModalRole));
    return diffPermissionMatrices(currentDefaults, nextDefaults);
  }, [profileDraft, profileModalRole]);

  const resetTargetPermissions = useMemo(
    () => normalizePermissionMatrix(resolveRoleDefaults(originalRole)),
    [originalRole],
  );

  const resetPreview = useMemo(
    () => diffPermissionMatrices(effectivePermissions, resetTargetPermissions),
    [effectivePermissions, resetTargetPermissions],
  );

  const resetTargetModules = useMemo(() => summarizeMatrixModules(resetTargetPermissions), [resetTargetPermissions]);
  const resetCurrentCompanyLabel = useMemo(() => {
    if (!roleNeedsCompany(profileDraft)) return isPt ? "Sem empresa principal" : "No primary company";
    return draftCompanyLabel;
  }, [draftCompanyLabel, isPt, profileDraft]);
  const resetTargetCompanyLabel = useMemo(() => {
    if (!roleNeedsCompany(originalRole)) return isPt ? "Sem empresa principal" : "No primary company";
    const matched = filteredCompanies.find((company) => company.id === originalCompanyId);
    return matched?.name ?? draftCompanyLabel;
  }, [draftCompanyLabel, filteredCompanies, isPt, originalCompanyId, originalRole]);
  const resetWillChangeRole = profileDraft !== originalRole;
  const resetWillChangeCompany = resetCurrentCompanyLabel !== resetTargetCompanyLabel;

  const nextRoleNeedsExtraData = roleNeedsCompany(profileModalRole);
  const profileCandidateCompanyId = useMemo(() => {
    if (!nextRoleNeedsExtraData) return "";
    return profileModalCompany || companyDraft || selectedUser?.client_id || selectedUser?.companies?.[0]?.id || "";
  }, [companyDraft, nextRoleNeedsExtraData, profileModalCompany, selectedUser]);
  const profileCandidateCompanyLabel = useMemo(() => {
    if (!nextRoleNeedsExtraData) return isPt ? "Não exige empresa principal" : "No primary company required";
    if (!profileCandidateCompanyId) return isPt ? "Empresa ainda não definida" : "Company not defined yet";

    const matchedCompany =
      filteredCompanies.find((company) => company.id === profileCandidateCompanyId) ??
      selectedUser?.companies?.find((company) => company.id === profileCandidateCompanyId);

    return matchedCompany?.name ?? draftCompanyLabel ?? (isPt ? "Empresa vinculada reaproveitada" : "Reused linked company");
  }, [draftCompanyLabel, filteredCompanies, isPt, nextRoleNeedsExtraData, profileCandidateCompanyId, selectedUser]);

  function applyProfileDraft(nextRole: EditableProfileRole, nextCompanyId?: string) {
    const fallbackCompanyId = companyDraft || selectedUser?.client_id || selectedUser?.companies?.[0]?.id || "";
    const resolvedCompanyId = roleNeedsCompany(nextRole)
      ? nextCompanyId ?? fallbackCompanyId
      : "";

    if (roleNeedsCompany(nextRole) && !resolvedCompanyId) {
      setPanelError(isPt ? "Selecione uma empresa para aplicar este perfil." : "Select a company to apply this profile.");
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
      setMessage(
        isPt
          ? `Perfil base ajustado para ${roleLabel(nextRole)} na edição atual. Revise o módulo desejado e salve para aplicar.`
          : `Base profile adjusted to ${roleLabel(nextRole)} in the current draft. Review the target module and save to apply.`,
      );
      return;
    }

    if (companyChanged) {
      setMessage(isPt ? "Empresa principal da edição atual atualizada. Salve para aplicar." : "Primary company updated in the current draft. Save to apply.");
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
      setPanelError(isPt ? "Selecione uma empresa para concluir a mudança de perfil." : "Select a company to complete the profile change.");
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
      setCreateGlobalError(isPt ? "Informe o nome completo." : "Enter the full name.");
      return;
    }
    if (!user) {
      setCreateGlobalError(isPt ? "Informe o usuário." : "Enter the username.");
      return;
    }
    if (!email) {
      setCreateGlobalError(isPt ? "Informe o e-mail." : "Enter the email." );
      return;
    }
    if (!isValidEmailAddress(email)) {
      setCreateGlobalError(isPt ? "Informe um e-mail válido." : "Enter a valid email.");
      return;
    }
    if (!password.trim()) {
      setCreateGlobalError(isPt ? "Informe a senha." : "Enter the password.");
      return;
    }
    if (password.trim().length < 8) {
      setCreateGlobalError(isPt ? "A senha deve ter pelo menos 8 caracteres." : "Password must have at least 8 characters.");
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
        role: "technical_support",
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
          setCreateGlobalError(isPt ? "Sessao expirada. Entre novamente para continuar." : "Session expired. Sign in again to continue.");
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
            res.status === 401
              ? (isPt ? "Sessao expirada. Entre novamente para continuar." : "Session expired. Sign in again to continue.")
              : (isPt ? "Não foi possível criar o perfil de Suporte Técnico agora." : "Could not create the Technical Support profile right now."),
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
      setMessage(
        isPt
          ? `Perfil de Suporte Tecnico criado para ${fullName}. Revise as permissoes e os ajustes de perfil, se necessario.`
          : `Technical Support profile created for ${fullName}. Review permissions and profile settings if needed.`,
      );
    } catch (error) {
      setCreateGlobalError(error instanceof Error ? error.message : (isPt ? "Não foi possível criar o perfil de Suporte Técnico agora." : "Could not create the Technical Support profile right now."));
    } finally {
      setCreateGlobalLoading(false);
    }
  }

  async function handleCopyEmail() {
    if (!selectedUser?.email) return;
    try {
      await navigator.clipboard.writeText(selectedUser.email);
      setPanelError(null);
      setMessage(isPt ? "E-mail copiado." : "Email copied.");
    } catch (error) {
      setMessage(null);
      setPanelError(error instanceof Error ? error.message : (isPt ? "Não foi possível copiar o e-mail." : "Could not copy email."));
    }
  }

  async function handleSave() {
    if (!selectedUserId || !selectedUser) return;

    if (roleNeedsCompany(profileDraft) && !companyDraft) {
      setPanelError(isPt ? "Selecione uma empresa para aplicar esse perfil." : "Select a company to apply this profile.");
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
          setPanelError(userJson.error ?? (isPt ? "Não foi possível atualizar o perfil do usuário." : "Could not update the user profile."));
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
          setPanelError(json.error ?? (isPt ? "Não foi possível salvar as permissões." : "Could not save permissions."));
          return;
        }
      }

      await loadUsers();
      await loadPermissions(selectedUserId);
      if (authUser?.id && authUser.id === selectedUserId) {
        await refreshUser();
      }
      setMessage(
        profileMetaChanged
          ? (isPt ? "Perfil, empresa e permissões atualizados." : "Profile, company, and permissions updated.")
          : (isPt ? "Permissões salvas." : "Permissions saved."),
      );
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : (isPt ? "Não foi possível salvar as permissões." : "Could not save permissions."));
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
      isPt
        ? `Edição atual restaurada para o padrão de ${roleLabel(originalRole)}. Revise os módulos e salve para aplicar.`
        : `Current draft restored to the ${roleLabel(originalRole)} baseline. Review modules and save to apply.`,
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
                {isPt ? "Gestão de permissões por usuário" : "User Permission Management"}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-white/88 sm:text-[15px]">
                {isPt
                  ? "Filtre usuários, ajuste o perfil base e gerencie os módulos e ações em um único painel."
                  : "Filter users, adjust the base profile, and manage modules and actions in a single panel."}
              </p>
            </div>
            {canManageProfiles ? (
              <button
                type="button"
                onClick={() => {
                  resetCreateGlobalForm();
                  setCreateGlobalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-white/18 bg-white/12 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(1,24,72,0.18)] backdrop-blur-sm transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <FiPlus size={16} />
                {isPt ? "Criar Suporte Técnico" : "Create Technical Support"}
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent)">{isPt ? "Usuários" : "Users"}</p>
                <h2 className="text-[20px] font-semibold tracking-tight text-(--tc-text-primary)">{isPt ? "Selecione um usuário para editar permissões" : "Select a user to edit permissions"}</h2>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)">{isPt ? "Busca" : "Search"}</span>
                <div className="flex items-center gap-3 rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2.5 focus-within:border-(--tc-accent) focus-within:ring-2 focus-within:ring-[rgba(239,0,1,0.14)]">
                  <FiSearch className="text-(--tc-accent)" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={isPt ? "Buscar por nome, usuário, e-mail ou empresa" : "Search by name, username, email, or company"}
                    className="w-full bg-transparent text-sm text-(--tc-text-primary) outline-none placeholder:text-(--tc-text-muted)"
                  />
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)">{isPt ? "Tipo de perfil" : "Profile type"}</span>
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder={isPt ? "Selecionar tipo de perfil" : "Select profile type"} />
                  </SelectTrigger>
                  <SelectContent>
                    {roleFilters.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label} ({roleCounts[option.value as RoleFilter] ?? 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              {query.trim() ? (
                <div className="text-sm font-medium text-(--tc-text-secondary)">
                  {filteredUsers.length} {filteredUsers.length === 1 ? (isPt ? "resultado" : "result") : (isPt ? "resultados" : "results")}
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-3 [scrollbar-gutter:stable]">
            <div className="min-w-0 pr-2">
            {usersLoading && <p className="px-2 py-4 text-sm text-(--tc-text-muted)">{isPt ? "Carregando usuários..." : "Loading users..."}</p>}
            {usersError && !usersLoading && (
              <p className="rounded-2xl border border-[rgba(239,0,1,0.18)] bg-[rgba(239,0,1,0.08)] px-4 py-3 text-sm text-(--tc-accent)">
                {friendlyUiError(usersError, isPt ? "Não foi possível carregar a lista de usuários agora." : "Could not load the user list right now.")}
              </p>
            )}
            {!usersLoading && !usersError && filteredUsers.length === 0 && (
              <p className="px-2 py-4 text-sm text-(--tc-text-muted)">
                {isPt
                  ? "Nenhum usuário encontrado para a combinação atual de busca e perfil."
                  : "No users found for the current search and profile filters."}
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
                      <AvatarIdentity user={user} selected={selected} isPt={isPt} />

                      <div className="min-w-0 flex-1 space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{getDisplayName(user, isPt)}</p>
                            {getUserSecondaryLabel(user) ? (
                              <p className={`truncate text-[11px] ${selected ? "text-white/76" : "text-(--tc-text-secondary)"}`}>
                                {getUserSecondaryLabel(user)}
                              </p>
                            ) : null}
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${profileToneForUser(user, selected)}`}>
                            {profileLabelForUser(user)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={`rounded-full px-2.5 py-1 ${statusTone(user.status, selected)}`}>
                            {statusLabel(user.status, isPt)}
                          </span>
                          {selected && (
                            <span
                              title={companyTitle(user, isPt)}
                              className="truncate text-[11px] text-white/74"
                            >
                              {companyLabel(user, isPt)}
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
                <h2 className="text-xl font-semibold text-(--tc-text-primary)">{isPt ? "Selecione um usuário" : "Select a user"}</h2>
                <p className="text-sm leading-6 text-(--tc-text-muted)">
                  {isPt
                    ? "Escolha um usuário na coluna da esquerda para revisar o perfil base, ajustar permissões e salvar as alterações."
                    : "Choose a user from the left column to review the base profile, adjust permissions, and save changes."}
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
                      <AvatarIdentity user={selectedUser} selected size="lg" isPt={isPt} />
                      <div className="min-w-0 space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">{isPt ? "Usuário selecionado" : "Selected user"}</div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h2 className="min-w-0 truncate text-[22px] font-semibold tracking-tight text-white [text-shadow:0_10px_24px_rgba(1,24,72,0.24)] sm:text-[26px]">
                            {getDisplayName(selectedUser, isPt)}
                          </h2>
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${
                              isUserActive(selectedUser)
                                ? "border-[rgba(16,185,129,0.24)] bg-[rgba(16,185,129,0.14)] text-white"
                                : "border-[rgba(239,0,1,0.24)] bg-[rgba(239,0,1,0.14)] text-white"
                            }`}
                          >
                            <span className={`h-2 w-2 rounded-full ${isUserActive(selectedUser) ? "bg-emerald-300" : "bg-red-300"}`} />
                            {statusLabel(selectedUser.status, isPt)}
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
                              {isPt ? "Copiar e-mail" : "Copy email"}
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
                          {isPt ? "Perfil de origem" : "Source profile"}: {roleLabel(profileDraft)}
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
                        title={isPt
                          ? "Somente perfis técnicos privilegiados podem alterar ou criar perfis privilegiados."
                          : "Only privileged technical profiles can change or create privileged profiles."}
                      >
                        {isPt ? "Perfil de origem" : "Source profile"}: {roleLabel(profileDraft)}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setPermissionsViewerOpen(true)}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-medium text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      {isPt ? "Permissões ativas" : "Active permissions"}: {totalActiveActions}
                    </button>
                    <button
                      type="button"
                      onClick={openRestoreModal}
                      className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-3 py-1.5 font-medium text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      <FiRotateCcw size={14} />
                      {isPt ? "Restaurar padrão" : "Restore default"}
                    </button>
                  </div>
                </div>
              </header>

              {panelLoading && <p className="text-sm text-(--tc-text-muted)">{isPt ? "Carregando permissões..." : "Loading permissions..."}</p>}
              {panelError && (
                <p className="rounded-[22px] border border-[rgba(239,0,1,0.18)] bg-[rgba(239,0,1,0.08)] px-4 py-3 text-sm text-(--tc-accent)">
                  {friendlyUiError(panelError, isPt ? "Não foi possível carregar ou salvar as permissões agora." : "Could not load or save permissions right now.")}
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
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent)">{isPt ? "Permissões por módulo" : "Permissions by module"}</p>
                        <h3 className="text-lg font-semibold text-(--tc-text-primary)">{isPt ? "Selecione um módulo e ajuste as ações ao lado" : "Select a module and adjust actions on the right"}</h3>
                      </div>
                      <div className="rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-3 py-1.5 text-xs font-semibold text-(--tc-text-muted)">
                        {PERMISSION_MODULES.length} {isPt ? "módulos cadastrados" : "registered modules"}
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
                                    {customCount} {isPt ? "ajustes" : "overrides"}
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
                                {(effectivePermissions[activeModule.id] ?? []).length} {isPt ? "ativas" : "active"}
                              </span>
                              <span className="rounded-full border border-[rgba(1,24,72,0.12)] bg-[rgba(1,24,72,0.06)] px-3 py-1 text-(--tc-primary)">
                                {activeModule.actions.length} {isPt ? "ações" : "actions"}
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
                                        {badgeLabel(overrideState, isPt)}
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
                        {hasDraftChanges
                          ? isPt
                            ? `${customAllowCount} permissões adicionadas e ${customDenyCount} removidas na edição atual`
                            : `${customAllowCount} permissions added and ${customDenyCount} removed in the current draft`
                          : isPt
                            ? "Sem alterações pendentes"
                            : "No pending changes"}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving || panelLoading || !hasDraftChanges || (roleNeedsCompany(profileDraft) && !companyDraft)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(239,0,1,0.18)] disabled:opacity-60 [background:linear-gradient(135deg,var(--tc-accent)_0%,var(--tc-accent-hover)_100%)]"
                      >
                        <FiSave size={16} />
                        {saving ? (isPt ? "Salvando..." : "Saving...") : (isPt ? "Salvar alterações" : "Save changes")}
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
        title={isPt ? "Criar Suporte Técnico" : "Create Technical Support"}
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
              {isPt ? "Cancelar" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={() => void handleCreateGlobal()}
              disabled={createGlobalLoading}
              className="inline-flex items-center justify-center rounded-2xl bg-(--tc-accent) px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {createGlobalLoading ? (isPt ? "Criando..." : "Creating...") : (isPt ? "Criar Suporte Técnico" : "Create Technical Support")}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-2 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)">{isPt ? "Nome completo" : "Full name"}</span>
            <input
              value={createGlobalDraft.fullName}
              onChange={(event) => setCreateGlobalDraft((current) => ({ ...current, fullName: event.target.value }))}
              className="w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2.5 text-sm text-(--tc-text-primary) outline-none focus:border-(--tc-accent)"
              placeholder={isPt ? "Nome completo" : "Full name"}
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)">{isPt ? "Usuário" : "Username"}</span>
            <input
              value={createGlobalDraft.user}
              onChange={(event) => setCreateGlobalDraft((current) => ({ ...current, user: event.target.value }))}
              className="w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2.5 text-sm text-(--tc-text-primary) outline-none focus:border-(--tc-accent)"
              placeholder="login.global"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)">{isPt ? "E-mail" : "Email"}</span>
            <input
              type="email"
              value={createGlobalDraft.email}
              onChange={(event) => setCreateGlobalDraft((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2.5 text-sm text-(--tc-text-primary) outline-none focus:border-(--tc-accent)"
              placeholder="global@testingcompany.test"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)">{isPt ? "Telefone" : "Phone"}</span>
            <input
              value={createGlobalDraft.phone}
              onChange={(event) => setCreateGlobalDraft((current) => ({ ...current, phone: event.target.value }))}
              className="w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2.5 text-sm text-(--tc-text-primary) outline-none focus:border-(--tc-accent)"
              placeholder="+55 11 99999-9999"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)">{isPt ? "Senha" : "Password"}</span>
            <input
              type="password"
              value={createGlobalDraft.password}
              onChange={(event) => setCreateGlobalDraft((current) => ({ ...current, password: event.target.value }))}
              className="w-full rounded-2xl border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2.5 text-sm text-(--tc-text-primary) outline-none focus:border-(--tc-accent)"
              placeholder={isPt ? "Mínimo 8 caracteres" : "Minimum 8 characters"}
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
        title={isPt ? "Atenção" : "Attention"}
        description={isPt
          ? "Ao confirmar, o perfil selecionado substitui a base atual do usuário. Revise o impacto por módulo antes de continuar."
          : "By confirming, the selected profile replaces the user's current baseline. Review the impact by module before continuing."}
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
              {isPt ? "Cancelar" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={confirmProfileChange}
              className="inline-flex items-center justify-center rounded-2xl bg-(--tc-accent) px-4 py-2.5 text-sm font-semibold text-white"
            >
              {isPt ? "Confirmar alteração" : "Confirm change"}
            </button>
          </>
        }
      >
        <div
          className="rounded-3xl border border-[rgba(239,0,1,0.18)] px-5 py-4 [background:linear-gradient(135deg,rgba(239,0,1,0.08),rgba(1,24,72,0.04))]"
        >
          <div className="text-lg font-semibold text-(--tc-text-primary)">{isPt ? "A troca de perfil redefine a base do usuário." : "Changing profile redefines the user's baseline."}</div>
          <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary)">
            {isPt
              ? "Ao confirmar esta alteração, o perfil selecionado substituirá o perfil atual. Permissões e dados vinculados ao perfil de origem podem deixar de existir ou não ser recuperáveis."
              : "When you confirm this change, the selected profile replaces the current profile. Permissions and data tied to the previous baseline may no longer be available or recoverable."}
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[220px_220px_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Perfil atual" : "Current profile"}</div>
            <div className="mt-2 text-base font-semibold text-(--tc-text-primary)">{roleLabel(profileDraft)}</div>
          </div>
          <div className="rounded-[20px] border border-[rgba(239,0,1,0.14)] bg-[rgba(239,0,1,0.06)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Novo perfil" : "New profile"}</div>
            <div className="mt-2 text-base font-semibold text-(--tc-text-primary)">{roleLabel(profileModalRole)}</div>
          </div>
          <div className="rounded-[20px] border border-[rgba(1,24,72,0.12)] bg-[rgba(1,24,72,0.05)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Permissões atuais" : "Current permissions"}</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{profileChangePreview.currentCount} {isPt ? "permissões" : "permissions"}</div>
            <div className="mt-1 text-xs leading-5 text-(--tc-text-secondary)">{roleHint(profileDraft)}</div>
          </div>
          <div className="rounded-[20px] border border-[rgba(239,0,1,0.14)] bg-[rgba(239,0,1,0.06)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Permissões do novo perfil" : "New profile permissions"}</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{profileChangePreview.nextCount} {isPt ? "permissões" : "permissions"}</div>
            <div className="mt-1 text-xs leading-5 text-(--tc-text-secondary)">{roleHint(profileModalRole)}</div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-3xl border border-[rgba(1,24,72,0.12)] bg-[rgba(1,24,72,0.04)]">
            <div className="border-b border-[rgba(1,24,72,0.08)] px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Perfil atual" : "Current profile"}</div>
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
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Novo perfil" : "New profile"}</div>
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
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Perde na troca" : "Loses on change"}</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{profileChangePreview.lostCount} {isPt ? "permissões" : "permissions"}</div>
            {profileChangePreview.lostPreview.length > 0 && (
              <div className="mt-2 text-xs leading-5 text-(--tc-text-secondary)">{profileChangePreview.lostPreview.join(" | ")}</div>
            )}
          </div>
          <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Ganha na troca" : "Gains on change"}</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{profileChangePreview.gainedCount} {isPt ? "permissões" : "permissions"}</div>
            {profileChangePreview.gainedPreview.length > 0 && (
              <div className="mt-2 text-xs leading-5 text-(--tc-text-secondary)">{profileChangePreview.gainedPreview.join(" | ")}</div>
            )}
          </div>
          <div className="rounded-[20px] border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.12)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#92400e]">{isPt ? "Aviso" : "Warning"}</div>
            <div className="mt-2 text-sm leading-6 text-[#a16207]">
              {nextRoleNeedsExtraData
                ? profileCandidateCompanyId
                  ? isPt
                    ? `Empresa compatível reaproveitada: ${profileCandidateCompanyLabel}. Ao confirmar, esse vínculo seguirá para o novo perfil sem abrir a segunda etapa.`
                    : `Compatible company reused: ${profileCandidateCompanyLabel}. On confirmation, this link will carry over to the new profile without opening the second step.`
                  : isPt
                    ? `O perfil ${roleLabel(profileModalRole)} exige empresa vinculada. Como esse campo ainda não existe, a próxima etapa solicitará apenas esse dado faltante.`
                    : `The ${roleLabel(profileModalRole)} profile requires a linked company. Since this field is still missing, the next step will request only that missing data.`
                : isPt
                  ? "A mudança atualiza a base do usuário na edição atual. Depois, salve para aplicar no sistema."
                  : "This change updates the user's baseline in the current draft. Then save to apply in the system."}
            </div>
          </div>
        </div>
      </SurfaceModal>

      <SurfaceModal
        open={profileRequirementsOpen}
        title={isPt ? "Completar dados obrigatórios" : "Complete required data"}
        description={isPt
          ? "O novo perfil depende de dados adicionais para concluir a troca. Defina o vínculo exigido antes de aplicar a nova base."
          : "The new profile depends on additional data to complete the change. Define the required linkage before applying the new baseline."}
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
              {isPt ? "Voltar" : "Back"}
            </button>
            <button
              type="button"
              onClick={confirmProfileRequirements}
              disabled={!profileModalCompany}
              className="inline-flex items-center justify-center rounded-2xl bg-(--tc-accent) px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isPt ? "Concluir mudança" : "Finish change"}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Perfil atual" : "Current profile"}</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{roleLabel(profileDraft)}</div>
          </div>
          <div className="rounded-[20px] border border-[rgba(239,0,1,0.14)] bg-[rgba(239,0,1,0.06)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Novo perfil" : "New profile"}</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{roleLabel(profileModalRole)}</div>
          </div>
        </div>

        <div className="rounded-[20px] border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.12)] px-4 py-3 text-sm leading-6 text-[#a16207]">
          {isPt
            ? "Este perfil exige uma empresa principal para concluir a alteração. Sem esse vínculo, o usuário fica sem contexto operacional válido."
            : "This profile requires a primary company to complete the change. Without this linkage, the user has no valid operational context."}
        </div>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted)">{isPt ? "Empresa principal" : "Primary company"}</span>
          <Select value={profileModalCompany} onValueChange={setProfileModalCompany}>
            <SelectTrigger>
              <SelectValue placeholder={isPt ? "Selecione a empresa obrigatória" : "Select the required company"} />
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

        {companiesLoading && <p className="text-xs text-(--tc-text-muted)">{isPt ? "Carregando empresas..." : "Loading companies..."}</p>}
        {companiesError && <p className="text-xs text-(--tc-accent)">{friendlyUiError(companiesError, isPt ? "Não foi possível carregar as empresas agora." : "Could not load companies right now.")}</p>}
      </SurfaceModal>

      <SurfaceModal
        open={permissionsViewerOpen}
        title={isPt ? "Permissões ativas" : "Active permissions"}
        description={isPt ? "Resumo do acesso atual do usuário." : "Summary of the user's current access."}
        onClose={() => setPermissionsViewerOpen(false)}
        size="wide"
        icon={<FiShield size={20} />}
        footer={
          <button
            type="button"
            onClick={() => setPermissionsViewerOpen(false)}
            className="inline-flex items-center justify-center rounded-2xl border border-(--tc-border) bg-(--tc-surface) px-4 py-2.5 text-sm font-medium text-(--tc-text-primary) transition hover:bg-(--tc-surface)"
          >
            {isPt ? "Fechar" : "Close"}
          </button>
        }
      >
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div
            className="rounded-[26px] border border-(--tc-border) px-5 py-5 sm:px-6 [background:linear-gradient(135deg,rgba(1,24,72,0.06),rgba(1,24,72,0.02))]"
          >
            <div className="flex items-start gap-4">
              <AvatarIdentity user={selectedUser} size="lg" isPt={isPt} />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Usuário" : "User"}</div>
                <div className="mt-1 text-xl font-semibold text-(--tc-text-primary)">{getDisplayName(selectedUser, isPt)}</div>
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
                {isPt ? "Modulos" : "Modules"}
              </div>
              <div className="mt-3 text-2xl font-semibold text-(--tc-text-primary)">{totalActiveModules}</div>
            </div>
            <div className="rounded-[22px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted)">
                <FiShield size={13} />
                {isPt ? "Permissões" : "Permissions"}
              </div>
              <div className="mt-3 text-2xl font-semibold text-(--tc-text-primary)">{totalActiveActions}</div>
            </div>
            <div className="rounded-[22px] border border-[rgba(1,24,72,0.14)] bg-(--tc-surface) px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted)">{isPt ? "Ajustes manuais" : "Manual overrides"}</div>
              <div className="mt-3 text-2xl font-semibold text-(--tc-text-primary)">{customAllowCount + customDenyCount}</div>
              <div className="mt-2 text-xs font-medium text-(--tc-text-secondary)">
                {isPt
                  ? `+${customAllowCount} liberadas / -${customDenyCount} bloqueadas`
                  : `+${customAllowCount} granted / -${customDenyCount} blocked`}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[26px] border border-(--tc-border) bg-(--tc-surface)">
          <div className="flex flex-col gap-3 border-b border-(--tc-border) px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <div className="text-lg font-semibold text-(--tc-text-primary)">{isPt ? "Acessos por modulo" : "Access by module"}</div>
              <div className="mt-1 text-sm text-(--tc-text-secondary)">{isPt ? "Leitura direta dos modulos liberados no estado atual." : "Direct view of modules enabled in the current state."}</div>
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
                        {group.actionsCount} {isPt ? "permissões" : "permissions"}
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
                  {isPt
                    ? "Revise o perfil base e as personalizações aplicadas para liberar acesso a algum módulo."
                    : "Review the base profile and applied customizations to grant access to a module."}
                </p>
              </div>
            )}
          </ScrollArea>
        </section>
      </SurfaceModal>

      <SurfaceModal
        open={restoreModalOpen}
        title={isPt ? "Atenção" : "Attention"}
        description={isPt
          ? "Revise o impacto antes de restaurar a edição atual. A origem salva do usuário volta a ser a base e personalizações fora dela deixam de valer."
          : "Review impact before restoring the current draft. The user's saved origin becomes the baseline again and external customizations stop applying."}
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
              {isPt ? "Cancelar" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleResetDraft}
              className="inline-flex items-center justify-center rounded-2xl bg-(--tc-accent) px-4 py-2.5 text-sm font-semibold text-white"
            >
              {isPt ? "Confirmar restauração" : "Confirm restore"}
            </button>
          </>
        }
      >
        <div
          className="rounded-3xl border border-[rgba(239,0,1,0.18)] px-5 py-4 [background:linear-gradient(135deg,rgba(239,0,1,0.08),rgba(1,24,72,0.04))]"
        >
          <div className="text-lg font-semibold text-(--tc-text-primary)">{isPt ? "A restauração substitui o estado atual da edição." : "Restore replaces the current draft state."}</div>
          <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary)">
            {isPt
              ? "Ao confirmar, o sistema remove personalizações que não pertencem ao perfil de origem salvo e recalcula o contexto operacional do usuário. Revise o impacto em perfil, vínculo e permissões antes de continuar."
              : "When confirmed, the system removes customizations outside the saved origin profile and recalculates the user's operational context. Review profile, link, and permission impact before continuing."}
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[220px_220px_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Perfil atual" : "Current profile"}</div>
            <div className="mt-2 text-base font-semibold text-(--tc-text-primary)">{roleLabel(profileDraft)}</div>
          </div>
          <div className="rounded-[20px] border border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.08)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Após restaurar" : "After restore"}</div>
            <div className="mt-2 text-base font-semibold text-(--tc-text-primary)">{roleLabel(originalRole)}</div>
          </div>
          <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Vínculo atual" : "Current link"}</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">
              {resetCurrentCompanyLabel}
            </div>
          </div>
          <div className="rounded-[20px] border border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.08)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Vínculo restaurado" : "Restored link"}</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{resetTargetCompanyLabel}</div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[20px] border border-[rgba(239,0,1,0.18)] bg-[rgba(239,0,1,0.08)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Base atual" : "Current baseline"}</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{resetPreview.currentCount} {isPt ? "permissões ativas" : "active permissions"}</div>
            <div className="mt-1 text-xs leading-5 text-(--tc-text-secondary)">
              {resetWillChangeRole
                ? isPt
                  ? `A edição atual está operando como ${roleLabel(profileDraft)}.`
                  : `The current draft is operating as ${roleLabel(profileDraft)}.`
                : isPt
                  ? `A edição atual segue a base ${roleLabel(profileDraft)}.`
                  : `The current draft follows the ${roleLabel(profileDraft)} baseline.`}
            </div>
          </div>
          <div className="rounded-[20px] border border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.08)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Origem restaurada" : "Restored origin"}</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{resetPreview.nextCount} {isPt ? "permissões padrão" : "default permissions"}</div>
            <div className="mt-1 text-xs leading-5 text-(--tc-text-secondary)">
              {isPt
                ? `A base salva volta para ${roleLabel(originalRole)} sem personalizações manuais.`
                : `Saved baseline returns to ${roleLabel(originalRole)} without manual overrides.`}
            </div>
          </div>
          <div className="rounded-[20px] border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.12)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#92400e]">{isPt ? "Impacto da restauração" : "Restore impact"}</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">
              {resetWillChangeRole || resetWillChangeCompany
                ? (isPt ? "Perfil ou vínculo serão alterados" : "Profile or link will change")
                : (isPt ? "Base e vínculo já estão alinhados" : "Baseline and link are already aligned")}
            </div>
            <div className="mt-1 text-xs leading-5 text-[#a16207]">
              {resetWillChangeCompany
                ? isPt
                  ? `O vínculo principal volta para ${resetTargetCompanyLabel}.`
                  : `Primary link returns to ${resetTargetCompanyLabel}.`
                : isPt
                  ? "O vínculo principal permanece no mesmo contexto salvo."
                  : "Primary link remains in the same saved context."}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-3xl border border-[rgba(239,0,1,0.14)] bg-[rgba(239,0,1,0.05)]">
            <div className="border-b border-[rgba(239,0,1,0.08)] px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Atual" : "Current"}</div>
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
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Padrão restaurado" : "Restored default"}</div>
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
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Em vermelho: será removido" : "In red: will be removed"}</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{resetPreview.lostCount} {isPt ? "permissões" : "permissions"}</div>
            {resetPreview.lostPreview.length > 0 ? (
              <div className="mt-2 text-xs leading-5 text-(--tc-text-secondary)">{resetPreview.lostPreview.join(" | ")}</div>
            ) : (
              <div className="mt-2 text-xs leading-5 text-(--tc-text-secondary)">{isPt ? "Nenhuma permissão fora da origem atual será perdida." : "No permissions outside the current origin will be lost."}</div>
            )}
          </div>
          <div className="rounded-[20px] border border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.08)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted)">{isPt ? "Em verde: volta ao padrão" : "In green: returns to default"}</div>
            <div className="mt-2 text-sm font-semibold text-(--tc-text-primary)">{resetPreview.gainedCount} {isPt ? "permissões" : "permissions"}</div>
            {resetPreview.gainedPreview.length > 0 ? (
              <div className="mt-2 text-xs leading-5 text-(--tc-text-secondary)">{resetPreview.gainedPreview.join(" | ")}</div>
            ) : (
              <div className="mt-2 text-xs leading-5 text-(--tc-text-secondary)">{isPt ? "O padrão já está alinhado com o que a origem exige." : "The default is already aligned with what the origin requires."}</div>
            )}
          </div>
        </div>

        <div className="rounded-[20px] border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.12)] px-4 py-3 text-sm leading-6 text-[#a16207]">
          {isPt
            ? "Restaurar o padrão recalcula a base do perfil salvo e pode remover permissões e vínculos que não fazem parte da origem atual deste usuário. A restauração acontece na edição atual; depois disso, use salvar alterações para aplicar no sistema."
            : "Restoring default recalculates the saved profile baseline and may remove permissions and links that are not part of this user's current origin. Restore happens in the current draft; after that, use save changes to apply in the system."}
        </div>
      </SurfaceModal>
    </div>
  );
}
