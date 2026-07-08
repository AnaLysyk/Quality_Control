"use client";



async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}
export const dynamic = "force-dynamic";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiEye,
  FiEyeOff,
  FiRefreshCw,
  FiRotateCcw,
  FiSave,
  FiSearch,
  FiShield,
  FiSliders,
  FiUsers,
  FiX,
} from "react-icons/fi";
import AccessDeniedState from "@/components/access/AccessDeniedState";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import { getFixedProfileLabel } from "@/lib/fixedProfilePresentation";
import { PERMISSION_MODULES, type PermissionModule } from "@/lib/permissionCatalog";
import {
  applyPermissionOverride,
  hasPermissionAccess,
  normalizePermissionMatrix,
  type PermissionMatrix,
} from "@/lib/permissionMatrix";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";

type ProfileUserSummary = {
  id: string;
  name: string | null;
  fullName: string | null;
  email: string;
  label: string;
  active: boolean;
  status: string;
  hasOverride: boolean;
  overrideCount: number;
  effectiveCount: number;
  updatedAt: string | null;
  companyId?: string | null;
  companySlug?: string | null;
  companyName?: string | null;
  clientId?: string | null;
  clientSlug?: string | null;
  primaryCompanySlug?: string | null;
  companyIds?: string[];
  companySlugs?: string[];
  companies?: Array<{
    id?: string | null;
    slug?: string | null;
    name?: string | null;
  }>;
  company?: {
    id?: string | null;
    slug?: string | null;
    name?: string | null;
  } | null;
};

type ProfileUsersResponse = {
  role: SystemRole;
  label: string;
  users: ProfileUserSummary[];
  total: number;
};

type UserPermissionRow = ProfileUserSummary & {
  role: SystemRole;
  roleLabel: string;
};

type PermissionOverride = {
  role?: SystemRole;
  allow?: PermissionMatrix;
  deny?: PermissionMatrix;
  updatedAt?: string;
  updatedBy?: string | null;
  reason?: string | null;
};

type UserPermissionsResponse = {
  role: SystemRole;
  label: string;
  systemDefaults: PermissionMatrix;
  profileDefaults?: PermissionMatrix;
  override: PermissionOverride | null;
  permissions: PermissionMatrix;
  canEdit: boolean;
  user?: {
    id: string;
    name: string | null;
    fullName: string | null;
    email: string;
    active: boolean;
    status: string;
  };
  counts?: {
    system: number;
    profile?: number;
    allow: number;
    deny: number;
    effective: number;
  };
};

type NoticeState =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type UserSortKey = "name" | "role" | "status" | "updatedAt" | "permissions" | "adjustments";
type SortDirection = "asc" | "desc";

const PROFILE_OPTIONS: Array<{ role: SystemRole; label: string }> = [
  { role: SYSTEM_ROLES.LEADER_TC, label: "Líder TC" },
  { role: SYSTEM_ROLES.TECHNICAL_SUPPORT, label: "Suporte Técnico" },
  { role: SYSTEM_ROLES.TESTING_COMPANY_USER, label: "Usuário TC" },
  { role: SYSTEM_ROLES.EMPRESA, label: "Empresa" },
  { role: SYSTEM_ROLES.COMPANY_USER, label: "Usuário da Empresa" },
];

const USER_GUIDE_STEPS = [
  {
    title: "1. Encontre o usuário",
    description: "Busque por nome, e-mail ou filtre por perfil e status.",
  },
  {
    title: "2. Abra o controle",
    description: "Use Ativar/Desativar no usuário para abrir o guia individual.",
  },
  {
    title: "3. Ajuste o módulo",
    description: "Ative ou desative módulos apenas para aquele usuário.",
  },
  {
    title: "4. Salve a exceção",
    description: "Salve para manter o usuário diferente do padrão do perfil.",
  },
];

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function countPermissionActions(input: PermissionMatrix | null | undefined) {
  return Object.values(input ?? {}).reduce(
    (total, actions) => total + (Array.isArray(actions) ? actions.length : 0),
    0,
  );
}

function compactMatrix(matrix: PermissionMatrix) {
  return Object.fromEntries(
    Object.entries(matrix)
      .map(([moduleId, actions]) => [
        moduleId,
        Array.from(new Set(actions)).filter((action) => action.trim().length > 0),
      ])
      .filter(([, actions]) => actions.length > 0),
  ) as PermissionMatrix;
}

function addAction(matrix: PermissionMatrix, moduleId: string, action: string) {
  return compactMatrix({
    ...matrix,
    [moduleId]: Array.from(new Set([...(matrix[moduleId] ?? []), action])),
  });
}

function removeAction(matrix: PermissionMatrix, moduleId: string, action: string) {
  return compactMatrix({
    ...matrix,
    [moduleId]: (matrix[moduleId] ?? []).filter((item) => item !== action),
  });
}

function toggleOverrideAction(
  override: PermissionOverride,
  systemDefaults: PermissionMatrix,
  moduleId: string,
  action: string,
  shouldAllow: boolean,
): PermissionOverride {
  const baseHasAction = hasPermissionAccess(systemDefaults, moduleId, action);
  let allow = normalizePermissionMatrix(override.allow);
  let deny = normalizePermissionMatrix(override.deny);

  if (shouldAllow) {
    deny = removeAction(deny, moduleId, action);
    allow = baseHasAction ? removeAction(allow, moduleId, action) : addAction(allow, moduleId, action);
  } else {
    allow = removeAction(allow, moduleId, action);
    deny = baseHasAction ? addAction(deny, moduleId, action) : removeAction(deny, moduleId, action);
  }

  return { ...override, allow, deny };
}

function resolveCurrentRole(user: ReturnType<typeof usePermissionAccess>["user"], accessRole?: string | null) {
  return (
    normalizeLegacyRole(typeof user?.permissionRole === "string" ? user.permissionRole : null) ??
    normalizeLegacyRole(typeof user?.role === "string" ? user.role : null) ??
    normalizeLegacyRole(typeof user?.companyRole === "string" ? user.companyRole : null) ??
    normalizeLegacyRole(accessRole ?? null)
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sem data";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function toRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function addScopeKey(keys: Set<string>, value: unknown) {
  if (typeof value !== "string") return;
  const normalized = value.trim().toLowerCase();
  if (normalized) keys.add(normalized);
}

function collectCompanyScopeKeys(source: unknown) {
  const keys = new Set<string>();
  const record = toRecord(source);

  [
    "companyId",
    "companySlug",
    "companyName",
    "clientId",
    "clientSlug",
    "primaryCompanySlug",
    "activeCompanySlug",
    "activeClientSlug",
  ].forEach((field) => addScopeKey(keys, record[field]));

  ["companyIds", "companySlugs", "clientIds", "clientSlugs"].forEach((field) => {
    const value = record[field];
    if (Array.isArray(value)) value.forEach((item) => addScopeKey(keys, item));
  });

  const company = toRecord(record.company);
  ["id", "slug", "name"].forEach((field) => addScopeKey(keys, company[field]));

  const companies = record.companies;
  if (Array.isArray(companies)) {
    companies.forEach((item) => {
      const itemRecord = toRecord(item);
      ["id", "slug", "name"].forEach((field) => addScopeKey(keys, itemRecord[field]));
    });
  }

  return keys;
}

function canAccessUserByCompanyScope(profileUser: UserPermissionRow, allowedCompanyKeys: Set<string>) {
  const userCompanyKeys = collectCompanyScopeKeys(profileUser);

  if (!allowedCompanyKeys.size) return false;
  if (!userCompanyKeys.size) return false;

  for (const key of userCompanyKeys) {
    if (allowedCompanyKeys.has(key)) return true;
  }

  return false;
}

function notifyPermissionRuntimeChanged() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent("qc:permissions-changed"));

  try {
    window.localStorage.setItem("qc:permissions-changed", String(Date.now()));
  } catch {
    // Mantém apenas o evento.
  }
}

function resolveStatusLabel(user: UserPermissionRow) {
  const normalized = normalizeText(user.status ?? "");

  if (normalized.includes("inactive") || normalized.includes("inativo")) return "Inativo";
  if (normalized.includes("active") || normalized.includes("ativo")) return "Ativo";

  return user.active ? "Ativo" : "Inativo";
}

function resolveStatusFilterValue(user: UserPermissionRow) {
  return resolveStatusLabel(user) === "Ativo" ? "ativo" : "inativo";
}


function profileBadgeClass(role?: string | null) {
  const value = String(role ?? "").toLowerCase();

  if (value.includes("leader") || value.includes("lider")) {
    return "border-red-300 bg-red-50 text-red-800 dark:border-red-400/50 dark:bg-red-500/20 dark:text-red-100";
  }

  if (value.includes("technical") || value.includes("support") || value.includes("suporte")) {
    return "border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-400/50 dark:bg-cyan-500/20 dark:text-cyan-100";
  }

  if (value.includes("testing") || value.includes("tc")) {
    return "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-400/50 dark:bg-indigo-500/20 dark:text-indigo-100";
  }

  if (value.includes("empresa") && value.includes("user")) {
    return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/50 dark:bg-emerald-500/20 dark:text-emerald-100";
  }

  if (value.includes("empresa") || value.includes("company")) {
    return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/50 dark:bg-amber-500/20 dark:text-amber-100";
  }

  return "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-500/50 dark:bg-slate-700/45 dark:text-slate-100";
}
function statusBadgeClass(user: UserPermissionRow) {
  return resolveStatusFilterValue(user) === "ativo"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-50 text-slate-600";
}

function getModuleState(module: PermissionModule, permissions: PermissionMatrix) {
  const allowed = module.actions.filter((action) => hasPermissionAccess(permissions, module.id, action)).length;
  const total = module.actions.length;

  if (allowed === 0) {
    return {
      label: "Oculto",
      tone: "border-rose-200 bg-rose-50 text-rose-700",
      icon: FiEyeOff,
      allowed,
      total,
    };
  }

  if (allowed === total) {
    return {
      label: "Ativo",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: FiEye,
      allowed,
      total,
    };
  }

  return {
    label: "Parcial",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    icon: FiSliders,
    allowed,
    total,
  };
}

export default function UsersPermissionsPage() {
  const { user, accessContext, loading, can, refreshUser } = usePermissionAccess();

  const [users, setUsers] = useState<UserPermissionRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>({ type: "idle" });

  const [query, setQuery] = useState("");
  const [profileFilter, setProfileFilter] = useState<"all" | SystemRole>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const [sortKey, setSortKey] = useState<UserSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [loadingDetailsId, setLoadingDetailsId] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [detailsByUserId, setDetailsByUserId] = useState<Record<string, UserPermissionsResponse>>({});
  const [draftsByUserId, setDraftsByUserId] = useState<Record<string, PermissionOverride>>({});

  const currentRole = resolveCurrentRole(user, accessContext?.role ?? null);

  const canView =
    user?.isGlobalAdmin === true ||
    currentRole === SYSTEM_ROLES.LEADER_TC ||
    currentRole === SYSTEM_ROLES.TECHNICAL_SUPPORT ||
    can("permissions", "view");

  const canSeeAllUsers =
    user?.isGlobalAdmin === true ||
    currentRole === SYSTEM_ROLES.LEADER_TC ||
    currentRole === SYSTEM_ROLES.TECHNICAL_SUPPORT;

  const allowedCompanyKeys = useMemo(() => {
    const keys = new Set<string>();

    collectCompanyScopeKeys(user).forEach((key) => keys.add(key));
    collectCompanyScopeKeys(accessContext).forEach((key) => keys.add(key));

    return keys;
  }, [accessContext, user]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError(null);

    try {
      const responses = await Promise.all(
        PROFILE_OPTIONS.map(async (profile) => {
          const response = await fetch(`/api/admin/profile-permissions/${profile.role}/users`, {
            credentials: "include",
          });

          const payload = (await response.json().catch(() => null)) as ProfileUsersResponse | { error?: string } | null;

          if (!response.ok) {
            throw new Error((payload as { error?: string } | null)?.error ?? "Falha ao carregar usuários.");
          }

          return {
            role: profile.role,
            roleLabel: profile.label,
            users: ((payload as ProfileUsersResponse)?.users ?? []) as ProfileUserSummary[],
          };
        }),
      );

      const byId = new Map<string, UserPermissionRow>();

      responses.forEach((group) => {
        group.users.forEach((profileUser) => {
          if (!profileUser.id || byId.has(profileUser.id)) return;

          byId.set(profileUser.id, {
            ...profileUser,
            role: group.role,
            roleLabel: group.roleLabel,
          });
        });
      });

      const allUsers = Array.from(byId.values());
      const scopedUsers = canSeeAllUsers
        ? allUsers
        : allUsers.filter((profileUser) => canAccessUserByCompanyScope(profileUser, allowedCompanyKeys));

      setUsers(scopedUsers);
    } catch (loadError) {
      setUsers([]);
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar usuários.");
    } finally {
      setLoadingUsers(false);
    }
  }, [allowedCompanyKeys, canSeeAllUsers]);

  useEffect(() => {
    if (canView) void loadUsers();
  }, [canView, loadUsers]);

  async function loadUserPermissions(profileUser: UserPermissionRow) {
    if (detailsByUserId[profileUser.id]) return;

    setLoadingDetailsId(profileUser.id);
    setNotice({ type: "idle" });

    try {
      const response = await fetch(`/api/admin/user-permissions/${profileUser.id}`, {
        credentials: "include",
      });

      const payload = (await response.json().catch(() => null)) as UserPermissionsResponse | { error?: string } | null;

      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error ?? "Falha ao carregar permissões do usuário.");
      }

      const data = payload as UserPermissionsResponse;

      setDetailsByUserId((current) => ({ ...current, [profileUser.id]: data }));
      setDraftsByUserId((current) => ({
        ...current,
        [profileUser.id]: data.override ?? { role: data.role ?? profileUser.role, allow: {}, deny: {} },
      }));
    } catch (loadError) {
      setNotice({
        type: "error",
        message: loadError instanceof Error ? loadError.message : "Falha ao carregar permissões do usuário.",
      });
    } finally {
      setLoadingDetailsId(null);
    }
  }

  function toggleExpandedUser(profileUser: UserPermissionRow) {
    setExpandedUserId((current) => {
      const next = current === profileUser.id ? null : profileUser.id;
      if (next) void loadUserPermissions(profileUser);
      return next;
    });
  }

  function getUserSystemDefaults(profileUser: UserPermissionRow) {
    return detailsByUserId[profileUser.id]?.systemDefaults ?? normalizePermissionMatrix(resolveRoleDefaults(profileUser.role));
  }

  function getUserDraft(profileUser: UserPermissionRow) {
    return draftsByUserId[profileUser.id] ?? { role: profileUser.role, allow: {}, deny: {} };
  }

  function getUserEffectivePermissions(profileUser: UserPermissionRow) {
    return applyPermissionOverride(getUserSystemDefaults(profileUser), getUserDraft(profileUser));
  }

  function handleUserModuleToggle(profileUser: UserPermissionRow, module: PermissionModule, shouldAllow: boolean) {
    const systemDefaults = getUserSystemDefaults(profileUser);

    setDraftsByUserId((current) => {
      const currentDraft = current[profileUser.id] ?? { role: profileUser.role, allow: {}, deny: {} };

      const nextDraft = module.actions.reduce(
        (nextOverride, action) => toggleOverrideAction(nextOverride, systemDefaults, module.id, action, shouldAllow),
        currentDraft,
      );

      return { ...current, [profileUser.id]: nextDraft };
    });
  }

  async function handleSaveUser(profileUser: UserPermissionRow) {
    const draft = getUserDraft(profileUser);
    const systemDefaults = getUserSystemDefaults(profileUser);
    const permissions = applyPermissionOverride(systemDefaults, draft);

    setSavingUserId(profileUser.id);
    setNotice({ type: "idle" });

    try {
      const body = {
        allow: normalizePermissionMatrix(draft.allow),
        deny: normalizePermissionMatrix(draft.deny),
        reason: `Ajuste individual de permissões para ${profileUser.label}`,
      };

      const response = await fetch(`/api/admin/user-permissions/${profileUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const payload = (await response.json().catch(() => null)) as
        | { saved?: PermissionOverride; permissions?: PermissionMatrix; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao salvar permissões do usuário.");
      }

      const saved = payload?.saved ?? { role: profileUser.role, ...body, updatedAt: new Date().toISOString() };
      const savedPermissions = payload?.permissions ?? permissions;

      setDraftsByUserId((current) => ({ ...current, [profileUser.id]: saved }));
      setDetailsByUserId((current) => ({
        ...current,
        [profileUser.id]: {
          ...(current[profileUser.id] ?? {
            role: profileUser.role,
            label: profileUser.roleLabel,
            systemDefaults,
            override: null,
            permissions: savedPermissions,
            canEdit: true,
          }),
          override: saved,
          permissions: savedPermissions,
        },
      }));

      setUsers((current) =>
        current.map((item) =>
          item.id === profileUser.id
            ? {
                ...item,
                hasOverride: true,
                overrideCount: countPermissionActions(saved.allow) + countPermissionActions(saved.deny),
                effectiveCount: countPermissionActions(savedPermissions),
                updatedAt: saved.updatedAt ?? new Date().toISOString(),
              }
            : item,
        ),
      );

      await refreshUser();
      notifyPermissionRuntimeChanged();

      setNotice({ type: "success", message: "Permissões individuais salvas." });
    } catch (saveError) {
      setNotice({
        type: "error",
        message: saveError instanceof Error ? saveError.message : "Falha ao salvar permissões do usuário.",
      });
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleResetUser(profileUser: UserPermissionRow) {
    const confirmed = window.confirm(`Restaurar ${profileUser.label} para o padrão do perfil?`);
    if (!confirmed) return;

    setSavingUserId(profileUser.id);
    setNotice({ type: "idle" });

    try {
      const response = await fetch(`/api/admin/user-permissions/${profileUser.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const payload = (await response.json().catch(() => null)) as { permissions?: PermissionMatrix; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao restaurar permissões do usuário.");
      }

      const permissions = payload?.permissions ?? getUserSystemDefaults(profileUser);

      setDraftsByUserId((current) => ({
        ...current,
        [profileUser.id]: { role: profileUser.role, allow: {}, deny: {} },
      }));

      setDetailsByUserId((current) => ({
        ...current,
        [profileUser.id]: {
          ...(current[profileUser.id] ?? {
            role: profileUser.role,
            label: profileUser.roleLabel,
            systemDefaults: getUserSystemDefaults(profileUser),
            override: null,
            permissions,
            canEdit: true,
          }),
          override: null,
          permissions,
        },
      }));

      setUsers((current) =>
        current.map((item) =>
          item.id === profileUser.id
            ? {
                ...item,
                hasOverride: false,
                overrideCount: 0,
                effectiveCount: countPermissionActions(permissions),
                updatedAt: null,
              }
            : item,
        ),
      );

      await refreshUser();
      notifyPermissionRuntimeChanged();

      setNotice({ type: "success", message: "Usuário restaurado para o padrão do perfil." });
    } catch (resetError) {
      setNotice({
        type: "error",
        message: resetError instanceof Error ? resetError.message : "Falha ao restaurar permissões do usuário.",
      });
    } finally {
      setSavingUserId(null);
    }
  }

  const filteredUsers = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    const minTime = dateStart ? new Date(`${dateStart}T00:00:00`).getTime() : null;
    const maxTime = dateEnd ? new Date(`${dateEnd}T23:59:59`).getTime() : null;

    return users.filter((profileUser) => {
      if (normalizedQuery) {
        const content = normalizeText(
          `${profileUser.label} ${profileUser.name ?? ""} ${profileUser.fullName ?? ""} ${profileUser.email}`,
        );

        if (!content.includes(normalizedQuery)) return false;
      }

      if (profileFilter !== "all" && profileUser.role !== profileFilter) return false;
      if (statusFilter !== "all" && resolveStatusFilterValue(profileUser) !== statusFilter) return false;

      if (minTime || maxTime) {
        const time = profileUser.updatedAt ? Date.parse(profileUser.updatedAt) : Number.NaN;

        if (!Number.isFinite(time)) return false;
        if (minTime && time < minTime) return false;
        if (maxTime && time > maxTime) return false;
      }

      return true;
    });
  }, [dateEnd, dateStart, profileFilter, query, statusFilter, users]);

  const sortedUsers = useMemo(() => {
    const items = [...filteredUsers];

    items.sort((a, b) => {
      let left: number | string = "";
      let right: number | string = "";

      if (sortKey === "name") {
        left = a.label || a.email;
        right = b.label || b.email;
      }

      if (sortKey === "role") {
        left = a.roleLabel;
        right = b.roleLabel;
      }

      if (sortKey === "status") {
        left = resolveStatusLabel(a);
        right = resolveStatusLabel(b);
      }

      if (sortKey === "updatedAt") {
        left = a.updatedAt ? Date.parse(a.updatedAt) : 0;
        right = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      }

      if (sortKey === "permissions") {
        left = a.effectiveCount;
        right = b.effectiveCount;
      }

      if (sortKey === "adjustments") {
        left = a.overrideCount;
        right = b.overrideCount;
      }

      const result =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), "pt-BR");

      return sortDirection === "asc" ? result : -result;
    });

    return items;
  }, [filteredUsers, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sortedUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const activeUsersCount = users.filter((profileUser) => profileUser.active).length;
  const overrideUsersCount = users.filter((profileUser) => profileUser.hasOverride).length;

  function clearFilters() {
    setQuery("");
    setProfileFilter("all");
    setStatusFilter("all");
    setDateStart("");
    setDateEnd("");
    setPage(1);
  }

  function toggleSort(nextKey: UserSortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  if (loading) return <AccessDeniedState state="loading" />;

  if (!canView) {
    return (
      <AccessDeniedState
        moduleName="Usuários e Permissões"
        requiredPermission="permissions:view"
        title="Acesso restrito"
        description="A gestão de permissões individuais exige permissão para visualizar acessos."
      />
    );
  }

  const sortMark = sortDirection === "asc" ? "?" : "?";

  return (
    <main className="qc-users-permissions-page min-h-screen px-4 py-4 text-[#0f172a] lg:px-6">
      {notice.type !== "idle" ? (
        <div
          className={[
            "fixed right-5 top-5 z-50 flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl",
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800",
          ].join(" ")}
        >
          {notice.type === "success" ? (
            <FiCheck className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1">{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice({ type: "idle" })}
            aria-label="Fechar mensagem"
            title="Fechar mensagem"
            className="rounded-lg p-1 opacity-70 transition hover:bg-white/70 hover:opacity-100"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="flex w-full max-w-none flex-col gap-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#011848]">
                <FiShield className="h-4 w-4" />
                Gestão de permissões individuais
              </div>

              <h1 className="text-2xl font-black tracking-tight text-[#0f172a] xl:text-3xl">
                Permissões por usuário
              </h1>

              <p className="mt-1 max-w-6xl text-sm font-semibold text-slate-500">
                Gerencie exceções individuais sem alterar o padrão global definido por perfil.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/permissions"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:border-[#011848] hover:text-[#011848]"
              >
                <FiShield className="h-3.5 w-3.5" />
                Perfis e permissões
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Usuários", value: users.length, icon: FiUsers },
              { label: "Ativos", value: activeUsersCount, icon: FiEye },
              { label: "Ajustes individuais", value: overrideUsersCount, icon: FiSliders },
              { label: "Perfis", value: PROFILE_OPTIONS.length, icon: FiShield },
            ].map((metric) => {
              const Icon = metric.icon;

              return (
                <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{metric.label}</p>
                      <p className="mt-1 text-2xl font-black text-[#011848]">{metric.value}</p>
                    </div>
                    <Icon className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#011848]">
                <FiSliders className="h-4 w-4" />
                Modo guiado para usuário
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Este fluxo ativa ou desativa permissões para um usuário específico, sem alterar o padrão do perfil.
              </p>
            </div>
            <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700">
              Ativar / Desativar individual
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {USER_GUIDE_STEPS.map((step) => (
              <div key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black text-[#011848]">{step.title}</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-[#011848]">
          Empresas visualizam apenas usuários vinculados ao próprio escopo. Liderança e suporte técnico visualizam todos.
        </section>

        <section className="sticky top-3 z-30 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
            <FiSearch className="h-4 w-4 shrink-0 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nome, e-mail ou usuário"
              className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
            />
          </label>

          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]">
            <select
              aria-label="Filtrar por perfil"
              title="Filtrar por perfil"
              value={profileFilter}
              onChange={(event) => {
                setProfileFilter(event.target.value as "all" | SystemRole);
                setPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none"
            >
              <option value="all">Todos os perfis</option>
              {PROFILE_OPTIONS.map((profile) => (
                <option key={profile.role} value={profile.role}>
                  {profile.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por status"
              title="Filtrar por status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none"
            >
              <option value="all">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>

            <input
              aria-label="Data inicial"
              title="Data inicial"
              type="date"
              value={dateStart}
              onChange={(event) => {
                setDateStart(event.target.value);
                setPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none"
            />

            <input
              aria-label="Data final"
              title="Data final"
              type="date"
              value={dateEnd}
              onChange={(event) => {
                setDateEnd(event.target.value);
                setPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none"
            />

            <select
              aria-label="Itens por página"
              title="Itens por página"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none"
            >
              <option value={10}>10 por página</option>
              <option value={20}>20 por página</option>
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
            </select>

            <button
              type="button"
              onClick={clearFilters}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#011848] hover:text-[#011848]"
            >
              Limpar filtros
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-black text-[#0f172a]">Listagem de usuários</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {loadingUsers ? "Carregando usuários..." : `${sortedUsers.length} usuários encontrados`}
              </p>
            </div>
          </div>

          {error ? (
            <div className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-full border-collapse text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/80">
                <tr className="border-b border-slate-200 dark:border-slate-700/70">
                  <th className="w-10 px-4 py-3" />

                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey("name");
                        setSortDirection((current) => (sortKey === "name" ? (current === "asc" ? "desc" : "asc") : "asc"));
                      }}
                      className={[
                        "inline-flex items-center gap-1 text-xs font-black transition",
                        sortKey === "name" ? "text-cyan-300" : "text-slate-400 hover:text-white",
                      ].join(" ")}
                    >
                      Usuário
                      <span className={sortKey === "name" ? "text-cyan-300" : "text-slate-500"}>
                        {sortKey === "name" ? (sortDirection === "asc" ? "?" : "?") : "?"}
                      </span>
                    </button>
                  </th>

                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey("role");
                        setSortDirection((current) => (sortKey === "role" ? (current === "asc" ? "desc" : "asc") : "asc"));
                      }}
                      className={[
                        "inline-flex items-center gap-1 text-xs font-black transition",
                        sortKey === "role" ? "text-cyan-300" : "text-slate-400 hover:text-white",
                      ].join(" ")}
                    >
                      Perfil
                      <span className={sortKey === "role" ? "text-cyan-300" : "text-slate-500"}>
                        {sortKey === "role" ? (sortDirection === "asc" ? "?" : "?") : "?"}
                      </span>
                    </button>
                  </th>

                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey("status");
                        setSortDirection((current) => (sortKey === "status" ? (current === "asc" ? "desc" : "asc") : "asc"));
                      }}
                      className={[
                        "inline-flex items-center gap-1 text-xs font-black transition",
                        sortKey === "status" ? "text-cyan-300" : "text-slate-400 hover:text-white",
                      ].join(" ")}
                    >
                      Status
                      <span className={sortKey === "status" ? "text-cyan-300" : "text-slate-500"}>
                        {sortKey === "status" ? (sortDirection === "asc" ? "?" : "?") : "?"}
                      </span>
                    </button>
                  </th>

                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey("updatedAt");
                        setSortDirection((current) => (sortKey === "updatedAt" ? (current === "asc" ? "desc" : "asc") : "desc"));
                      }}
                      className={[
                        "inline-flex items-center gap-1 text-xs font-black transition",
                        sortKey === "updatedAt" ? "text-cyan-300" : "text-slate-400 hover:text-white",
                      ].join(" ")}
                    >
                      Último ajuste
                      <span className={sortKey === "updatedAt" ? "text-cyan-300" : "text-slate-500"}>
                        {sortKey === "updatedAt" ? (sortDirection === "asc" ? "?" : "?") : "?"}
                      </span>
                    </button>
                  </th>

                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey("permissions");
                        setSortDirection((current) => (sortKey === "permissions" ? (current === "asc" ? "desc" : "asc") : "desc"));
                      }}
                      className={[
                        "inline-flex items-center gap-1 text-xs font-black transition",
                        sortKey === "permissions" ? "text-cyan-300" : "text-slate-400 hover:text-white",
                      ].join(" ")}
                    >
                      Permissões
                      <span className={sortKey === "permissions" ? "text-cyan-300" : "text-slate-500"}>
                        {sortKey === "permissions" ? (sortDirection === "asc" ? "?" : "?") : "?"}
                      </span>
                    </button>
                  </th>

                  <th className="px-4 py-3 text-right text-xs font-black text-slate-400">
                    Controle
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {pageRows.length ? (
                  pageRows.map((profileUser) => {
                    const expanded = expandedUserId === profileUser.id;
                    const details = detailsByUserId[profileUser.id];
                    const effectivePermissions = getUserEffectivePermissions(profileUser);
                    const canEditUser = details?.canEdit === true && can("permissions", "edit");
                    const savingThisUser = savingUserId === profileUser.id;

                    return (
                      <Fragment key={profileUser.id}>
                        <tr className="bg-white align-top hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggleExpandedUser(profileUser)}
                              className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-[#011848] hover:text-[#011848]"
                            >
                              {expanded ? <FiChevronDown className="h-4 w-4" /> : <FiChevronRight className="h-4 w-4" />}
                            </button>
                          </td>

                          <td className="px-4 py-3">
                            <p className="text-sm font-black text-[#0f172a]">{profileUser.label}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{profileUser.email}</p>
                          </td>

                          <td className="px-4 py-3">
                            <span className={["w-fit rounded-full border px-2.5 py-1 text-xs font-black", profileBadgeClass(profileUser.role)].join(" ")}>{profileUser.roleLabel || getFixedProfileLabel(profileUser.role, { short: true })}</span>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={[
                                "w-fit rounded-full border px-2.5 py-1 text-xs font-black uppercase",
                                statusBadgeClass(profileUser),
                              ].join(" ")}
                            >
                              {resolveStatusLabel(profileUser)}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-xs font-bold text-slate-500">
                            {formatDateTime(profileUser.updatedAt)}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">
                              {profileUser.effectiveCount}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {profileUser.hasOverride ? (
                                <span className="rounded-full border border-[#ef0001]/20 bg-[#ef0001]/5 px-2.5 py-1 text-xs font-black text-[#ef0001]">
                                  {profileUser.overrideCount} ajuste{profileUser.overrideCount === 1 ? "" : "s"}
                                </span>
                              ) : (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                                  Padrão
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => toggleExpandedUser(profileUser)}
                                className="h-7 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-black uppercase tracking-wide text-[#011848] transition hover:border-[#011848] hover:bg-slate-50"
                              >
                                {expanded ? "Fechar" : "Ativar/Desativar"}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {expanded ? (
                          <tr className="bg-slate-50">
                            <td colSpan={7} className="px-4 py-4">
                              {loadingDetailsId === profileUser.id ? (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
                                  Carregando permissões...
                                </div>
                              ) : (
                                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                                  <section className="rounded-2xl border border-slate-200 bg-white">
                                    <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                      <div>
                                        <h3 className="text-sm font-black text-[#0f172a]">Permissões individuais</h3>
                                        <p className="mt-1 text-xs font-semibold text-slate-500">
                                          Ative ou desative módulos somente para este usuário.
                                        </p>
                                      </div>

                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleResetUser(profileUser)}
                                          disabled={!canEditUser || savingThisUser}
                                          aria-label={`Restaurar permissões de ${profileUser.label}`}
                                          title="Restaurar para o padrão do perfil"
                                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-[#ef0001] hover:text-[#ef0001] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          <FiRotateCcw className="h-3.5 w-3.5" />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleSaveUser(profileUser)}
                                          disabled={!canEditUser || savingThisUser}
                                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#011848] px-3 text-xs font-black text-white transition hover:bg-[#0b245f] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          <FiSave className="h-3.5 w-3.5" />
                                          {savingThisUser ? "Salvando..." : "Salvar"}
                                        </button>
                                      </div>
                                    </div>

                                    <div className="grid max-h-[520px] gap-0 overflow-y-auto">
                                      {PERMISSION_MODULES.map((module) => {
                                        const state = getModuleState(module, effectivePermissions);
                                        const StateIcon = state.icon;

                                        return (
                                          <div key={module.id} className="grid gap-3 border-b border-slate-100 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_110px_160px] sm:items-center">
                                            <div className="min-w-0">
                                              <p className="truncate text-sm font-black text-[#0f172a]">{module.label}</p>
                                              <p className="truncate text-xs font-semibold text-slate-500">{module.description}</p>
                                            </div>

                                            <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${state.tone}`}>
                                              <StateIcon className="h-3.5 w-3.5" />
                                              {state.label}
                                            </span>

                                            <div className="flex justify-start gap-2 sm:justify-end">
                                              <button
                                                type="button"
                                                onClick={() => handleUserModuleToggle(profileUser, module, true)}
                                                disabled={!canEditUser || savingThisUser}
                                                className="h-8 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                              >
                                                Ativar
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() => handleUserModuleToggle(profileUser, module, false)}
                                                disabled={!canEditUser || savingThisUser}
                                                className="h-8 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                              >
                                                Desativar
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </section>

                                  <aside className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                                      <FiClock className="h-4 w-4" />
                                      Histórico
                                    </div>

                                    {details?.override?.updatedAt ? (
                                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-sm font-black text-[#0f172a]">
                                          {details.override.reason || "Permissões alteradas"}
                                        </p>
                                        <p className="mt-1 text-xs font-semibold text-slate-500">
                                          {details.override.updatedBy ? `Alterado por ${details.override.updatedBy}` : "Alteração administrativa registrada."}
                                        </p>
                                        <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
                                          {formatDateTime(details.override.updatedAt)}
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-sm font-black text-[#0f172a]">Sem alterações individuais</p>
                                        <p className="mt-1 text-xs font-semibold text-slate-500">
                                          Este usuário segue o padrão do perfil.
                                        </p>
                                      </div>
                                    )}
                                  </aside>
                                </div>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm font-semibold text-slate-500">
                      {loadingUsers ? "Carregando usuários..." : "Nenhum usuário encontrado com os filtros atuais."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-xs font-bold text-slate-500 md:flex-row md:items-center md:justify-between">
            <span>
              Exibindo {pageRows.length ? (currentPage - 1) * pageSize + 1 : 0}–
              {Math.min(currentPage * pageSize, sortedUsers.length)} de {sortedUsers.length} usuários
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={currentPage === 1}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Primeira
              </button>

              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>

              <span className="rounded-lg bg-slate-100 px-3 py-2 font-black text-slate-700">
                {currentPage}/{totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage === totalPages}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Próxima
              </button>

              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Última
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}




