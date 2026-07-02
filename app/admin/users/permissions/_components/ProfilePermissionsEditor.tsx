"use client";

export const dynamic = "force-dynamic";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiEye,
  FiEyeOff,
  FiGrid,
  FiInfo,
  FiLock,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiShield,
  FiSliders,
  FiUnlock,
  FiUsers,
} from "react-icons/fi";
import AccessDeniedState from "@/components/access/AccessDeniedState";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import { getFixedProfileHint, getFixedProfileLabel, getFixedProfileTone } from "@/lib/fixedProfilePresentation";
import { ACTION_LABELS, PERMISSION_MODULES, getActionLabel, type PermissionModule } from "@/lib/permissionCatalog";
import {
  applyPermissionOverride,
  hasPermissionAccess,
  normalizePermissionMatrix,
  type PermissionMatrix,
} from "@/lib/permissionMatrix";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";
import { SYSTEM_ROUTES } from "@/lib/navigation/route-map";

type RoutePermission = { moduleId: string; action: string } | null;
type ActiveTab = "overview" | "modules" | "screens" | "brain" | "users";
type ScreenFilter = "all" | "visible" | "hidden";

type ProfileOverride = {
  role?: SystemRole;
  allow?: PermissionMatrix;
  deny?: PermissionMatrix;
  updatedAt?: string;
  updatedBy?: string | null;
  reason?: string | null;
};

type ProfilePermissionsResponse = {
  role: SystemRole;
  label: string;
  systemDefaults: PermissionMatrix;
  profileDefaults?: PermissionMatrix;
  override: ProfileOverride | null;
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
};

type ProfileUsersResponse = {
  role: SystemRole;
  label: string;
  users: ProfileUserSummary[];
  total: number;
};

type NoticeState =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

const PROFILE_ORDER: SystemRole[] = [
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
  SYSTEM_ROLES.TESTING_COMPANY_USER,
  SYSTEM_ROLES.EMPRESA,
  SYSTEM_ROLES.COMPANY_USER,
];

const QUICK_CONTROL_MODULES = new Set(["dashboard", "context", "operations", "ai", "brain", "chat"]);
const CRITICAL_MODULES = new Set(["permissions", "users", "access_requests", "audit"]);

const TABS: Array<{ id: ActiveTab; label: string; icon: typeof FiGrid }> = [
  { id: "overview", label: "Visão geral", icon: FiInfo },
  { id: "modules", label: "Módulos e funções", icon: FiGrid },
  { id: "screens", label: "Telas impactadas", icon: FiEye },
  { id: "brain", label: "Brain e Assistente", icon: FiShield },
  { id: "users", label: "Usuários impactados", icon: FiUsers },
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
  override: ProfileOverride,
  systemDefaults: PermissionMatrix,
  moduleId: string,
  action: string,
  shouldAllow: boolean,
): ProfileOverride {
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

function resolveRoutePermission(permission: RoutePermission | undefined, routeModuleId?: string | null): RoutePermission {
  if (permission) return permission;
  if (routeModuleId === "chat") return { moduleId: "chat", action: "view" };
  return null;
}

function routePermissionAllowed(permissions: PermissionMatrix, permission: RoutePermission) {
  if (!permission) return true;
  if (permission.action === "view") {
    return ["view", "view_own", "view_company", "view_all"].some((action) =>
      hasPermissionAccess(permissions, permission.moduleId, action),
    );
  }
  return hasPermissionAccess(permissions, permission.moduleId, permission.action);
}

function getModulePermissionState(
  module: PermissionModule,
  systemDefaults: PermissionMatrix,
  effectivePermissions: PermissionMatrix,
) {
  const total = module.actions.length;
  const allowed = module.actions.filter((action) => hasPermissionAccess(effectivePermissions, module.id, action)).length;
  const baseAllowed = module.actions.filter((action) => hasPermissionAccess(systemDefaults, module.id, action)).length;
  if (allowed === 0) {
    return { label: "Oculto", tone: "border-rose-200 bg-rose-50 text-rose-700", allowed, total, baseAllowed };
  }
  if (allowed === total) {
    return { label: "Completo", tone: "border-emerald-200 bg-emerald-50 text-emerald-700", allowed, total, baseAllowed };
  }
  return { label: "Parcial", tone: "border-amber-200 bg-amber-50 text-amber-800", allowed, total, baseAllowed };
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sem alteração salva";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Sem alteração salva";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function resolveCurrentRole(user: ReturnType<typeof usePermissionAccess>["user"], accessRole?: string | null) {
  return (
    normalizeLegacyRole(typeof user?.permissionRole === "string" ? user.permissionRole : null) ??
    normalizeLegacyRole(typeof user?.role === "string" ? user.role : null) ??
    normalizeLegacyRole(typeof user?.companyRole === "string" ? user.companyRole : null) ??
    normalizeLegacyRole(accessRole ?? null)
  );
}

function notifyPermissionRuntimeChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("qc:permissions-changed"));
  try {
    window.localStorage.setItem("qc:permissions-changed", String(Date.now()));
  } catch {
    // Navegadores com storage bloqueado continuam recebendo o evento da janela.
  }
}

function PermissionToggle(props: {
  moduleId: string;
  action: string;
  systemDefaults: PermissionMatrix;
  effectivePermissions: PermissionMatrix;
  disabled: boolean;
  compact?: boolean;
  onToggle: (moduleId: string, action: string, checked: boolean) => void;
}) {
  const { moduleId, action, systemDefaults, effectivePermissions, disabled, compact = false, onToggle } = props;
  const checked = hasPermissionAccess(effectivePermissions, moduleId, action);
  const baseChecked = hasPermissionAccess(systemDefaults, moduleId, action);
  const changed = checked !== baseChecked;

  return (
    <label
      className={[
        "group flex min-w-0 items-center gap-3 rounded-xl border bg-white text-sm font-semibold transition",
        compact ? "min-h-9 px-3 py-2" : "min-h-10 px-3 py-2.5",
        checked ? "border-emerald-200 text-emerald-950" : "border-slate-200 text-slate-600",
        changed ? "ring-2 ring-[#011848]/10" : "",
        disabled ? "cursor-not-allowed opacity-65" : "cursor-pointer hover:border-[#011848]/35 hover:bg-slate-50",
      ].join(" ")}
    >
      <span
        className={[
          "relative flex h-5 w-9 shrink-0 items-center rounded-full border transition",
          checked ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-slate-200",
        ].join(" ")}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onToggle(moduleId, action, event.target.checked)}
        />
        <span
          className={[
            "absolute h-4 w-4 rounded-full bg-white shadow-sm transition",
            checked ? "left-4" : "left-0.5",
          ].join(" ")}
        />
      </span>
      <span className="min-w-0 flex-1 truncate">{getActionLabel(action)}</span>
      {checked ? <FiUnlock className="h-3.5 w-3.5 text-emerald-600" /> : <FiLock className="h-3.5 w-3.5 text-rose-500" />}
      {changed ? (
        <span className="rounded-full border border-[#011848]/15 bg-[#011848]/5 px-2 py-0.5 text-[10px] font-black uppercase text-[#011848]">
          Ajuste
        </span>
      ) : null}
    </label>
  );
}

export default function ProfilePermissionsEditor({
  initialUserId = null,
  initialRole = SYSTEM_ROLES.LEADER_TC,
}: {
  initialUserId?: string | null;
  initialRole?: SystemRole;
}) {
  const { user, accessContext, loading, can, refreshUser } = usePermissionAccess();
  const [selectedRole, setSelectedRole] = useState<SystemRole>(initialRole);
  const [query, setQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("modules");
  const [screenFilter, setScreenFilter] = useState<ScreenFilter>("all");
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(() => new Set(["dashboard", "context", "operations"]));
  const [profileState, setProfileState] = useState<ProfilePermissionsResponse | null>(null);
  const [draftOverride, setDraftOverride] = useState<ProfileOverride>({ allow: {}, deny: {} });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeState>({ type: "idle" });
  const [profileUsers, setProfileUsers] = useState<ProfileUserSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialUserId);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    setSelectedRole(initialRole);
    setSelectedUserId(initialUserId);
  }, [initialRole, initialUserId]);

  const currentRole = resolveCurrentRole(user, accessContext?.role ?? null);
  const canView =
    user?.isGlobalAdmin === true ||
    currentRole === SYSTEM_ROLES.LEADER_TC ||
    currentRole === SYSTEM_ROLES.TECHNICAL_SUPPORT ||
    can("permissions", "view");
  const canEdit = profileState?.canEdit === true && can("permissions", "edit");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoadingProfile(true);
      setNotice({ type: "idle" });
      try {
        const response = await fetch(
          selectedUserId ? `/api/admin/user-permissions/${selectedUserId}` : `/api/admin/profile-permissions/${selectedRole}`,
          { credentials: "include" },
        );
        const payload = (await response.json().catch(() => null)) as ProfilePermissionsResponse | { error?: string } | null;
        if (!response.ok) throw new Error((payload as { error?: string } | null)?.error ?? "Falha ao carregar perfil");
        if (cancelled) return;
        const data = payload as ProfilePermissionsResponse;
        setProfileState(data);
        setDraftOverride(data.override ?? { role: data.role ?? selectedRole, allow: {}, deny: {} });
      } catch (error) {
        if (!cancelled) {
          setProfileState(null);
          setDraftOverride({ role: selectedRole, allow: {}, deny: {} });
          setNotice({ type: "error", message: error instanceof Error ? error.message : "Falha ao carregar perfil" });
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    }

    if (canView) void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [canView, selectedRole, selectedUserId]);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoadingUsers(true);
      try {
        const response = await fetch(`/api/admin/profile-permissions/${selectedRole}/users`, { credentials: "include" });
        const payload = (await response.json().catch(() => null)) as ProfileUsersResponse | { error?: string } | null;
        if (!response.ok) throw new Error((payload as { error?: string } | null)?.error ?? "Falha ao carregar usuários do perfil");
        if (!cancelled) setProfileUsers((payload as ProfileUsersResponse).users ?? []);
      } catch {
        if (!cancelled) setProfileUsers([]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    }

    if (canView) void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [canView, selectedRole]);

  const editingUser = Boolean(selectedUserId);
  const selectedUser = profileUsers.find((item) => item.id === selectedUserId) ?? null;

  const systemDefaults = useMemo(
    () => profileState?.systemDefaults ?? normalizePermissionMatrix(resolveRoleDefaults(selectedRole)),
    [profileState?.systemDefaults, selectedRole],
  );

  const effectivePermissions = useMemo(
    () => applyPermissionOverride(systemDefaults, draftOverride),
    [draftOverride, systemDefaults],
  );

  const hasDraftChanges = useMemo(() => {
    const current = JSON.stringify({
      allow: normalizePermissionMatrix(profileState?.override?.allow),
      deny: normalizePermissionMatrix(profileState?.override?.deny),
    });
    const draft = JSON.stringify({
      allow: normalizePermissionMatrix(draftOverride.allow),
      deny: normalizePermissionMatrix(draftOverride.deny),
    });
    return current !== draft;
  }, [draftOverride.allow, draftOverride.deny, profileState?.override?.allow, profileState?.override?.deny]);

  const normalizedQuery = normalizeText(query);
  const normalizedUserQuery = normalizeText(userQuery);

  const filteredUsers = useMemo(() => {
    if (!normalizedUserQuery) return profileUsers;
    return profileUsers.filter((profileUser) =>
      normalizeText(`${profileUser.label} ${profileUser.email} ${profileUser.status}`).includes(normalizedUserQuery),
    );
  }, [normalizedUserQuery, profileUsers]);

  const filteredModules = useMemo(() => {
    if (!normalizedQuery) return PERMISSION_MODULES;
    return PERMISSION_MODULES.filter((permissionModule) => {
      const haystack = normalizeText(
        `${permissionModule.id} ${permissionModule.label} ${permissionModule.description} ${permissionModule.category} ${permissionModule.actions.join(" ")}`,
      );
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  const allScreenRows = useMemo(() => {
    return SYSTEM_ROUTES.map((route) => {
      const permission = resolveRoutePermission(route.requiredPermission, route.moduleId);
      const visible = routePermissionAllowed(effectivePermissions, permission);
      const moduleLabel =
        PERMISSION_MODULES.find((permissionModule) => permissionModule.id === permission?.moduleId)?.label ??
        permission?.moduleId ??
        "Controlada pelo produto";
      return { route, permission, visible, moduleLabel };
    });
  }, [effectivePermissions]);

  const queriedScreenRows = useMemo(() => {
    if (!normalizedQuery) return allScreenRows;
    return allScreenRows.filter((row) => {
      const permissionLabel = row.permission
        ? `${row.permission.moduleId} ${ACTION_LABELS[row.permission.action] ?? row.permission.action}`
        : "produto";
      const haystack = normalizeText(
        `${row.route.label} ${row.route.path} ${row.route.moduleId} ${row.moduleLabel} ${permissionLabel}`,
      );
      return haystack.includes(normalizedQuery);
    });
  }, [allScreenRows, normalizedQuery]);

  const screenRows = useMemo(() => {
    if (screenFilter === "visible") return queriedScreenRows.filter((row) => row.visible);
    if (screenFilter === "hidden") return queriedScreenRows.filter((row) => !row.visible);
    return queriedScreenRows;
  }, [queriedScreenRows, screenFilter]);

  const visibleScreenCount = allScreenRows.filter((row) => row.visible).length;
  const hiddenScreenCount = allScreenRows.length - visibleScreenCount;
  const effectivePermissionCount = countPermissionActions(effectivePermissions);
  const overriddenCount = countPermissionActions(draftOverride.allow) + countPermissionActions(draftOverride.deny);
  const quickModules = PERMISSION_MODULES.filter((module) => QUICK_CONTROL_MODULES.has(module.id));
  const fullModuleCount = PERMISSION_MODULES.filter(
    (module) => getModulePermissionState(module, systemDefaults, effectivePermissions).allowed === module.actions.length,
  ).length;
  const hiddenModuleCount = PERMISSION_MODULES.filter(
    (module) => getModulePermissionState(module, systemDefaults, effectivePermissions).allowed === 0,
  ).length;
  const partialModuleCount = PERMISSION_MODULES.length - fullModuleCount - hiddenModuleCount;
  const adjustedModuleCount = PERMISSION_MODULES.filter((module) => {
    const state = getModulePermissionState(module, systemDefaults, effectivePermissions);
    return state.allowed !== state.baseAllowed;
  }).length;
  const userOverrideCount = profileUsers.filter((profileUser) => profileUser.hasOverride).length;
  const activeUsersCount = profileUsers.filter((profileUser) => profileUser.active).length;
  const impactedUsersCount = editingUser ? 1 : activeUsersCount;
  const targetLabel = editingUser && selectedUser ? selectedUser.label : getFixedProfileLabel(selectedRole);
  const targetSubtitle = editingUser
    ? "Ajuste individual: somente este usuário será impactado. O perfil original não será alterado."
    : "Ajuste por perfil: todos os usuários ativos deste perfil seráo impactados.";
  const canReset = profileState?.canEdit === true && can("permissions", "reset");

  function handleToggle(moduleId: string, action: string, checked: boolean) {
    setDraftOverride((current) => toggleOverrideAction(current, systemDefaults, moduleId, action, checked));
  }

  function handleModuleToggle(module: PermissionModule, shouldAllow: boolean) {
    if (!shouldAllow && CRITICAL_MODULES.has(module.id)) {
      const confirmed = window.confirm(
        `Ocultar ${module.label} pode remover acesso administrativo sensível. Deseja continuar?`,
      );
      if (!confirmed) return;
    }

    setDraftOverride((current) =>
      module.actions.reduce(
        (nextOverride, action) => toggleOverrideAction(nextOverride, systemDefaults, module.id, action, shouldAllow),
        current,
      ),
    );
  }

  function toggleExpandedModule(moduleId: string) {
    setExpandedModuleIds((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }

  function handleSelectProfile(profile: SystemRole) {
    setSelectedUserId(null);
    setSelectedRole(profile);
    setQuery("");
    setUserQuery("");
    setActiveTab("modules");
    setNotice({ type: "idle" });
  }

  function handleEditProfileDefaults() {
    setSelectedUserId(null);
    setNotice({ type: "idle" });
  }

  function handleSelectUser(profileUser: ProfileUserSummary) {
    setSelectedUserId(profileUser.id);
    setActiveTab("users");
    setNotice({ type: "idle" });
  }

  function updateSelectedUserSummary(saved: ProfileOverride | null, permissions: PermissionMatrix) {
    if (!selectedUserId) return;
    setProfileUsers((current) =>
      current.map((profileUser) =>
        profileUser.id === selectedUserId
          ? {
              ...profileUser,
              hasOverride: Boolean(saved && (countPermissionActions(saved.allow) || countPermissionActions(saved.deny))),
              overrideCount: saved ? countPermissionActions(saved.allow) + countPermissionActions(saved.deny) : 0,
              effectiveCount: countPermissionActions(permissions),
              updatedAt: saved?.updatedAt ?? null,
            }
          : profileUser,
      ),
    );
  }

  async function handleSave() {
    if (!canEdit || !hasDraftChanges) return;
    setSaving(true);
    setNotice({ type: "idle" });
    try {
      const body = {
        allow: normalizePermissionMatrix(draftOverride.allow),
        deny: normalizePermissionMatrix(draftOverride.deny),
        reason: editingUser ? "Ajuste individual pela Gestão de Perfis" : "Ajuste pela Gestão de Perfis",
      };
      const response = await fetch(selectedUserId ? `/api/admin/user-permissions/${selectedUserId}` : `/api/admin/profile-permissions/${selectedRole}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as { saved?: ProfileOverride; permissions?: PermissionMatrix; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Falha ao salvar perfil");
      const saved = payload?.saved ?? { role: selectedRole, ...body, updatedAt: new Date().toISOString() };
      const permissions = payload?.permissions ?? effectivePermissions;
      setDraftOverride(saved);
      setProfileState((current) =>
        current
          ? {
              ...current,
              override: saved,
              permissions,
              counts: {
                system: countPermissionActions(systemDefaults),
                profile: current.counts?.profile,
                allow: countPermissionActions(saved.allow),
                deny: countPermissionActions(saved.deny),
                effective: countPermissionActions(permissions),
              },
            }
          : current,
      );
      updateSelectedUserSummary(saved, permissions);
      setNotice({
        type: "success",
        message: editingUser
          ? "Usuário salvo. Ele mantem o perfil, mas agora usa permissões individuais."
          : "Perfil salvo. As telas e funcoes bloqueadas ja saem da navegacao e da experiencia do perfil.",
      });
      await refreshUser();
      notifyPermissionRuntimeChanged();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Falha ao salvar perfil" });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!canReset) return;
    const confirmed = window.confirm(
      editingUser
        ? "Este usuário voltara a herdar o perfil. Deseja restaurar o ajuste individual?"
        : "Isso remove os ajustes e volta ao padrão do sistema. Deseja restaurar o perfil?",
    );
    if (!confirmed) return;

    setSaving(true);
    setNotice({ type: "idle" });
    try {
      const response = await fetch(selectedUserId ? `/api/admin/user-permissions/${selectedUserId}` : `/api/admin/profile-permissions/${selectedRole}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as { permissions?: PermissionMatrix; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Falha ao restaurar perfil");
      const emptyOverride = { role: selectedRole, allow: {}, deny: {} };
      const permissions = payload?.permissions ?? systemDefaults;
      setDraftOverride(emptyOverride);
      setProfileState((current) =>
        current
          ? {
              ...current,
              override: null,
              permissions,
              counts: {
                system: countPermissionActions(systemDefaults),
                profile: current.counts?.profile,
                allow: 0,
                deny: 0,
                effective: countPermissionActions(permissions),
              },
            }
          : current,
      );
      updateSelectedUserSummary(null, permissions);
      setNotice({
        type: "success",
        message: editingUser
          ? "Usuário restaurado. Ele voltou a seguir o padrão efetivo do perfil."
          : "Perfil restaurado para o padrão do sistema.",
      });
      await refreshUser();
      notifyPermissionRuntimeChanged();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Falha ao restaurar perfil" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AccessDeniedState state="loading" />;

  if (!canView) {
    return (
      <AccessDeniedState
        moduleName="Gestão de Perfis"
        requiredPermission="permissions:view"
        title="Acesso restrito"
        description="A central de perfis exige permissão para visualizar a matriz de acessos."
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] py-4 text-[#0f172a] px-3 sm:px-4 lg:px-6">
      <div className="mx-auto w-full max-w-7xl flex flex-col gap-4">
        {/* Header Executivo */}
        <section className="rounded-3xl border border-slate-200 bg-[#011848] text-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-3">
                <FiShield className="h-4 w-4 text-blue-200" />
                <span className="text-xs font-black uppercase tracking-wider text-blue-200">Governança de Acesso</span>
              </div>
              <h1 className="text-3xl font-black tracking-tight">Central de Acessos e Perfis</h1>
              <p className="mt-2 text-sm font-semibold text-blue-100">
                Controle único de telas, ações, dados, Brain e assistente por perfil, empresa, projeto e usuário.
              </p>
              <p className="mt-4 flex flex-wrap items-center gap-3 text-sm font-bold">
                <span className="text-white">{targetLabel}</span>
                <span className="text-blue-300">/</span>
                <span className="text-blue-100">
                  {impactedUsersCount} {impactedUsersCount === 1 ? "usuário impactado" : "usuários impactados"}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2 sm:flex-col">
              <button
                type="button"
                onClick={handleReset}
                disabled={!canReset || saving || loadingProfile}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-300/30 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiRefreshCw className="h-4 w-4" />
                {editingUser ? "Restaurar usuário" : "Restaurar padrão"}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canEdit || saving || loadingProfile || !hasDraftChanges}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#011848] shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiSave className="h-4 w-4" />
                {saving ? "Salvando..." : hasDraftChanges ? "Salvar alterações" : "Tudo salvo"}
              </button>
            </div>
          </div>
          
          {/* Status Bar */}
          <div className="border-t border-blue-900/50 bg-blue-950/20 px-6 py-3">
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-white">
                <span className={`h-2 w-2 rounded-full ${hasDraftChanges ? "bg-[#ef0001]" : "bg-emerald-400"}`} />
                {hasDraftChanges ? "Alterações pendentes" : "Tudo salvo"}
              </span>
              <span className="hidden text-blue-200 sm:inline">/</span>
              <span className="text-blue-100">
                {editingUser ? "Permissão individual" : "Permissão por perfil"}
              </span>
            </div>
          </div>
        </section>

        {/* Indicadores Compactos */}
        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Permissões efetivas", value: effectivePermissionCount, icon: FiUnlock, tone: "emerald" },
            { label: "Telas visíveis", value: visibleScreenCount, icon: FiEye, tone: "emerald" },
            { label: "Telas ocultas", value: hiddenScreenCount, icon: FiEyeOff, tone: "rose" },
            { label: "Ajustes no alvo", value: overriddenCount, icon: FiSliders, tone: "red" },
            { label: editingUser ? "Usuário afetado" : "Usuários ativos", value: impactedUsersCount, icon: FiUsers, tone: "blue" },
          ].map((metric) => {
            const Icon = metric.icon;
            const toneClass = {
              emerald: "text-emerald-600",
              rose: "text-rose-600",
              red: "text-[#ef0001]",
              blue: "text-[#011848]",
            }[metric.tone];
            return (
              <div key={metric.label} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <Icon className={`h-4 w-4 shrink-0 ${toneClass}`} />
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase text-slate-500">{metric.label}</div>
                  <div className="text-lg font-black text-[#0f172a]">{metric.value}</div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Layout Principal: 2 Colunas */}
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Sidebar Esquerda */}
          <aside className="flex flex-col gap-4">
            {/* Perfis */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Tipos de Perfil</h3>
              <div className="mt-3 space-y-2">
                {PROFILE_ORDER.map((profile) => {
                  const selected = selectedRole === profile;
                  return (
                    <button
                      key={profile}
                      type="button"
                      onClick={() => handleSelectProfile(profile)}
                      className={[
                        "w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-bold transition",
                        selected
                          ? "border-[#011848] bg-[#011848] text-white shadow-sm"
                          : `${getFixedProfileTone(profile)} hover:border-[#011848] hover:bg-white`,
                      ].join(" ")}
                    >
                      <span className="truncate">{getFixedProfileLabel(profile, { short: true })}</span>
                      {selected ? <FiCheck className="h-4 w-4 shrink-0" /> : <FiChevronRight className="h-4 w-4 shrink-0 opacity-40" />}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Info Perfil Selecionado */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">Perfil selecionado</p>
                  <h4 className="mt-1.5 font-black text-[#0f172a]">{getFixedProfileLabel(selectedRole)}</h4>
                </div>
                <FiShield className="h-4 w-4 text-[#ef0001] shrink-0" />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">{getFixedProfileHint(selectedRole)}</p>
            </section>

            {/* Escopo */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase text-slate-500 mb-2">Escopo da Alteração</p>
              <h4 className="font-black text-[#0f172a] mb-3">{editingUser ? "Por usuário" : "Por perfil"}</h4>

              <button
                type="button"
                onClick={handleEditProfileDefaults}
                className={[
                  "w-full rounded-lg border px-3 py-3 text-left text-sm font-bold transition",
                  !editingUser
                    ? "border-[#011848] bg-[#011848] text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#011848] hover:bg-white",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>Editar padrão do perfil</span>
                  {!editingUser && <FiCheck className="h-4 w-4 shrink-0" />}
                </div>
                <p className={["mt-1 text-xs leading-4", !editingUser ? "text-blue-50/85" : "text-slate-500"].join(" ")}>
                  Afeta todos os usuários.
                </p>
              </button>
            </section>

            {/* Usuários do Perfil */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5">
                <FiSearch className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <input
                  type="search"
                  value={userQuery}
                  onChange={(event) => setUserQuery(event.target.value)}
                  placeholder="Buscar usuário..."
                  className="w-full bg-transparent text-xs font-semibold outline-none placeholder:text-slate-400"
                  aria-label="Buscar usuário do perfil"
                />
              </label>

              <div className="mt-2 flex items-center justify-between px-1 text-[10px] font-black uppercase text-slate-400">
                <span>{loadingUsers ? "Carregando..." : `${filteredUsers.length}/${profileUsers.length}`}</span>
                <span>{userOverrideCount} individual</span>
              </div>

              <div className="mt-2.5 max-h-64 space-y-1.5 overflow-y-auto">
                {filteredUsers.length ? (
                  filteredUsers.map((profileUser) => {
                    const selected = profileUser.id === selectedUserId;
                    return (
                      <button
                        key={profileUser.id}
                        type="button"
                        onClick={() => handleSelectUser(profileUser)}
                        className={[
                          "w-full rounded-lg border px-2.5 py-2 text-left text-xs transition",
                          selected
                            ? "border-[#011848] bg-[#011848] text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-[#011848]",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0">
                            <div className="truncate font-bold">{profileUser.label}</div>
                            <div className={selected ? "text-blue-50/80" : "text-slate-500"}>
                              {profileUser.email}
                            </div>
                          </div>
                          {profileUser.hasOverride && (
                            <span className={["shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase", selected ? "border border-white/25 bg-white/15 text-white" : "border border-blue-200 bg-blue-50 text-[#011848]"].join(" ")}>
                              Ind
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-semibold text-slate-500">
                    Nenhum usuário.
                  </div>
                )}
              </div>
            </section>
          </aside>

          {/* Workspace Principal */}
          <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {/* Toolbar */}
            <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-black text-[#0f172a]">{targetLabel}</h2>
                    <p className="mt-1 text-xs font-semibold text-slate-600">{targetSubtitle}</p>
                  </div>
                  <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 lg:min-w-64">
                    <FiSearch className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar módulo, tela, função..."
                      className="w-full bg-transparent text-xs font-semibold outline-none placeholder:text-slate-400"
                      aria-label="Buscar módulo, tela ou função"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-1">
                    {TABS.map((tab) => {
                      const Icon = tab.icon;
                      const selected = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={[
                            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-bold transition",
                            selected ? "bg-white text-[#011848] shadow-sm" : "text-slate-500 hover:text-[#011848]",
                          ].join(" ")}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {notice.type !== "idle" && (
                    <div
                      className={[
                        "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-semibold",
                        notice.type === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-rose-200 bg-rose-50 text-rose-800",
                      ].join(" ")}
                      role="status"
                    >
                      {notice.type === "success" ? <FiCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <FiAlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                      <span>{notice.message}</span>
                    </div>
                  )}
                </div>

                {!canEdit && profileState && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                    Você pode consultar, mas não possui permissão para editar a matriz.
                  </div>
                )}
              </div>
            </div>

            {/* Conteúdo das Abas */}
            <div className="flex-1 overflow-auto p-5">
                {activeTab === "overview" ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <h4 className="text-xs font-black uppercase text-slate-500">Estou editando quem?</h4>
                        <div className="mt-3 space-y-2">
                          <p className="text-lg font-black text-[#011848]">{targetLabel}</p>
                          <p className="text-xs leading-5 text-slate-600">{targetSubtitle}</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <h4 className="text-xs font-black uppercase text-slate-500">O que muda?</h4>
                        <ul className="mt-3 space-y-1.5 text-xs font-semibold text-slate-700">
                          <li>â€¢ {hiddenScreenCount} tela{hiddenScreenCount !== 1 ? "s" : ""} fica{hiddenScreenCount !== 1 ? "m" : ""} oculta{hiddenScreenCount !== 1 ? "s" : ""}</li>
                          <li>â€¢ {partialModuleCount} módulo{partialModuleCount !== 1 ? "s" : ""} parcial{partialModuleCount !== 1 ? "is" : ""}</li>
                          <li>â€¢ {adjustedModuleCount} módulo{adjustedModuleCount !== 1 ? "s" : ""} alterado{adjustedModuleCount !== 1 ? "s" : ""}</li>
                          <li>â€¢ {overriddenCount} ajuste{overriddenCount !== 1 ? "s" : ""} direto{overriddenCount !== 1 ? "s" : ""}</li>
                        </ul>
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                      <div className="text-center">
                        <p className="text-xs font-black uppercase text-slate-500">Usuários impactados</p>
                        <p className="mt-2 text-2xl font-black text-[#011848]">{impactedUsersCount}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-black uppercase text-slate-500">Permissões liberadas</p>
                        <p className="mt-2 text-2xl font-black text-emerald-600">{effectivePermissionCount}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-black uppercase text-slate-500">Telas ocultas</p>
                        <p className="mt-2 text-2xl font-black text-[#ef0001]">{hiddenScreenCount}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h4 className="text-xs font-black uppercase text-slate-500 mb-4">Decisões rápidas</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="border-b border-slate-200 text-xs font-black uppercase text-slate-500">
                            <tr>
                              <th className="pb-2 pr-3">Módulo</th>
                              <th className="pb-2 px-3">Estado</th>
                              <th className="pb-2 px-3 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {quickModules.map((module) => {
                              const state = getModulePermissionState(module, systemDefaults, effectivePermissions);
                              return (
                                <tr key={module.id} className="hover:bg-white/50">
                                  <td className="py-2.5 pr-3">
                                    <div className="font-bold text-[#0f172a]">{module.label}</div>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${state.tone}`}>
                                      {state.label}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleModuleToggle(module, true)}
                                        disabled={!canEdit || loadingProfile || saving}
                                        className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Liberar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleModuleToggle(module, false)}
                                        disabled={!canEdit || loadingProfile || saving}
                                        className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Ocultar
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeTab === "modules" ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50">
                    <div className="border-b border-slate-200 bg-white px-4 py-3">
                      <h4 className="text-sm font-black text-[#0f172a]">Matriz de Módulos e Funções</h4>
                      <p className="mt-1 text-xs font-semibold text-slate-600">
                        Clique em um módulo para expandir e ajustar as ações individuais.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-600 border-collapse text-left">
                        <thead className="bg-white text-xs font-black uppercase text-slate-500">
                          <tr className="border-b border-slate-200">
                            <th className="px-4 py-2.5">Módulo</th>
                            <th className="px-4 py-2.5">Categoria</th>
                            <th className="px-4 py-2.5">Permissões</th>
                            <th className="px-4 py-2.5">Estado</th>
                            <th className="px-4 py-2.5">Ajustes</th>
                            <th className="px-4 py-2.5 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {filteredModules.length ? (
                            filteredModules.map((module) => {
                              const state = getModulePermissionState(module, systemDefaults, effectivePermissions);
                              const expanded = expandedModuleIds.has(module.id);
                              const changedActions = module.actions.filter(
                                (action) =>
                                  hasPermissionAccess(effectivePermissions, module.id, action) !==
                                  hasPermissionAccess(systemDefaults, module.id, action),
                              ).length;
                              return (
                                <Fragment key={module.id}>
                                  <tr className="hover:bg-slate-50">
                                    <td className="px-4 py-3">
                                      <div className="flex items-start gap-2">
                                        <button
                                          type="button"
                                          onClick={() => toggleExpandedModule(module.id)}
                                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:border-[#011848] hover:text-[#011848]"
                                          aria-label={expanded ? `Recolher ${module.label}` : `Expandir ${module.label}`}
                                        >
                                          {expanded ? <FiChevronDown className="h-3.5 w-3.5" /> : <FiChevronRight className="h-3.5 w-3.5" />}
                                        </button>
                                        <div className="min-w-0">
                                          <div className="font-bold text-[#0f172a]">{module.label}</div>
                                          <div className="mt-0.5 text-[11px] text-slate-500">{module.description}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">{module.category}</td>
                                    <td className="px-4 py-3 text-xs font-bold text-slate-700">
                                      {state.allowed}/{state.total}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${state.tone}`}>
                                        {state.label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      {changedActions ? (
                                        <span className="inline-flex rounded-full border border-[#011848]/15 bg-[#011848]/5 px-2 py-0.5 text-xs font-bold text-[#011848]">
                                          {changedActions}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-slate-400">Herdado</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex justify-end gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleModuleToggle(module, true)}
                                          disabled={!canEdit || loadingProfile || saving}
                                          className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          Liberar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleModuleToggle(module, false)}
                                          disabled={!canEdit || loadingProfile || saving}
                                          className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          Ocultar
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                  {expanded ? (
                                    <tr className="bg-slate-50">
                                      <td colSpan={6} className="px-4 py-3">
                                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                          {module.actions.map((action) => (
                                            <PermissionToggle
                                              key={`${module.id}-${action}`}
                                              moduleId={module.id}
                                              action={action}
                                              systemDefaults={systemDefaults}
                                              effectivePermissions={effectivePermissions}
                                              disabled={!canEdit || loadingProfile || saving}
                                              onToggle={handleToggle}
                                            />
                                          ))}
                                        </div>
                                      </td>
                                    </tr>
                                  ) : null}
                                </Fragment>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-xs font-semibold text-slate-500">
                                Nenhum módulo encontrado.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {activeTab === "screens" ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-sm font-black text-[#0f172a]">Telas Impactadas</h4>
                        <p className="mt-1 text-xs font-semibold text-slate-600">
                          Visualize quais telas e rotas serão afetadas pelas permissões.
                        </p>
                      </div>
                      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
                        {[
                          { id: "all", label: "Todas" },
                          { id: "visible", label: "Visíveis" },
                          { id: "hidden", label: "Ocultas" },
                        ].map((filter) => (
                          <button
                            key={filter.id}
                            type="button"
                            onClick={() => setScreenFilter(filter.id as ScreenFilter)}
                            className={[
                              "h-7 rounded-md px-2.5 text-xs font-bold transition",
                              screenFilter === filter.id ? "bg-[#011848] text-white shadow-sm" : "text-slate-600 hover:text-[#011848]",
                            ].join(" ")}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-600 border-collapse bg-white text-left text-xs">
                        <thead className="border-b border-slate-200 bg-white text-[11px] font-bold uppercase text-slate-500">
                          <tr>
                            <th className="px-4 py-2.5">Tela</th>
                            <th className="px-4 py-2.5">Rota</th>
                            <th className="px-4 py-2.5">Módulo</th>
                            <th className="px-4 py-2.5">Permissão</th>
                            <th className="px-4 py-2.5">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {screenRows.length ? (
                            screenRows.map(({ route, permission, visible, moduleLabel }) => (
                              <tr key={route.id} className="hover:bg-slate-50">
                                <td className="px-4 py-2.5">
                                  <div className="font-bold text-[#0f172a]">{route.label}</div>
                                </td>
                                <td className="px-4 py-2.5">
                                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                    {route.path}
                                  </code>
                                </td>
                                <td className="px-4 py-2.5 font-semibold text-slate-600">{moduleLabel}</td>
                                <td className="px-4 py-2.5 text-slate-600">
                                  {permission ? `${permission.moduleId}:${ACTION_LABELS[permission.action] ?? permission.action}` : "Produto"}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={[
                                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold",
                                      visible
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                        : "border-rose-200 bg-rose-50 text-rose-800",
                                    ].join(" ")}
                                  >
                                    {visible ? <FiEye className="h-3 w-3" /> : <FiEyeOff className="h-3 w-3" />}
                                    {visible ? "Visível" : "Oculta"}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-xs font-semibold text-slate-500">
                                Nenhuma tela encontrada.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {activeTab === "brain" ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50">
                    <div className="border-b border-slate-200 bg-white px-4 py-3">
                      <h4 className="text-sm font-black text-[#0f172a]">Brain e Assistente</h4>
                      <p className="mt-1 text-xs font-semibold text-slate-600">
                        Controle quais módulos, dados e ações o Brain e Assistente podem acessar.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-600 border-collapse bg-white text-left">
                        <thead className="border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                          <tr>
                            <th className="px-4 py-2.5">Recurso</th>
                            <th className="px-4 py-2.5">Descrição</th>
                            <th className="px-4 py-2.5">Estado</th>
                            <th className="px-4 py-2.5 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {[
                            {
                              id: "brain",
                              label: "Brain Visual",
                              desc: "Leitura contextual e grafo de conhecimento.",
                              actions: ["view", "read", "use", "view_external_sources", "use_qase_data", "use_jira_data"],
                            },
                            {
                              id: "assistant",
                              label: "Assistente IA",
                              desc: "Automações, sugestões e mensagens inteligentes.",
                              actions: ["query_qase", "query_jira", "create_external_ticket", "update_external_ticket"],
                            },
                            {
                              id: "chat",
                              label: "Chat",
                              desc: "Comunicação em tempo real com contexto.",
                              actions: ["view", "use"],
                            },
                            {
                              id: "operations",
                              label: "Dados Operacionais",
                              desc: "Brain pode consultar dados operacionais e métricas.",
                              actions: ["view"],
                            },
                            {
                              id: "qase",
                              label: "Qase/Kase",
                              desc: "Brain pode acessar informações de testes e defeitos.",
                              actions: ["view", "view_projects", "view_cases", "view_runs", "view_results", "view_defects", "sync"],
                            },
                            {
                              id: "jira",
                              label: "Jira",
                              desc: "Arquitetura preparada para issues, bugs, épicos, sprints e transições.",
                              actions: ["view", "view_projects", "view_issues", "view_bugs", "view_sprints", "sync"],
                            },
                            {
                              id: "users",
                              label: "Dados de Usuários",
                              desc: "Brain pode listar e consultar informações de usuários.",
                              actions: ["view", "view_company", "view_all"],
                            },
                          ].map((resource) => {
                            const hasModule = PERMISSION_MODULES.find((m) => m.id === resource.id);
                            const allowedActions = hasModule
                              ? resource.actions.filter((a) => hasPermissionAccess(effectivePermissions, resource.id, a))
                              : [];
                            const state =
                              allowedActions.length === 0
                                ? { label: "Bloqueado", tone: "border-rose-200 bg-rose-50 text-rose-800" }
                                : allowedActions.length === resource.actions.length
                                  ? { label: "Completo", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" }
                                : { label: "Parcial", tone: "border-amber-200 bg-amber-50 text-amber-800" };
                            return (
                              <tr key={resource.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-bold text-[#0f172a]">{resource.label}</td>
                                <td className="px-4 py-3 text-xs text-slate-600">{resource.desc}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${state.tone}`}>
                                    {state.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {hasModule && (
                                    <div className="flex justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const m = PERMISSION_MODULES.find((mod) => mod.id === resource.id);
                                          if (m) handleModuleToggle(m, true);
                                        }}
                                        disabled={!canEdit || loadingProfile || saving}
                                        className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Liberar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const m = PERMISSION_MODULES.find((mod) => mod.id === resource.id);
                                          if (m) handleModuleToggle(m, false);
                                        }}
                                        disabled={!canEdit || loadingProfile || saving}
                                        className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Bloquear
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {activeTab === "users" ? (
                  <section className="profile-command-section rounded-2xl border border-slate-200 bg-white">
                    <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-base font-black text-[#0f172a]">Usuários impactados</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          Pessoas que seguem este perfil e podem receber excecao individual quando necessario.
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase text-slate-500">
                        {activeUsersCount} ativos / {userOverrideCount} com ajuste
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-225 border-collapse text-left">
                        <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Usuário</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Ajuste individual</th>
                            <th className="px-4 py-3">Permissões efetivas</th>
                            <th className="px-4 py-3">Ultima alteração</th>
                            <th className="px-4 py-3 text-right">Acao</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {profileUsers.length ? (
                            profileUsers.map((profileUser) => {
                              const selected = profileUser.id === selectedUserId;
                              return (
                                <tr key={profileUser.id} className={selected ? "bg-[#011848]/5" : "hover:bg-slate-50/70"}>
                                  <td className="px-4 py-3 font-black text-[#0f172a]">{profileUser.label}</td>
                                  <td className="px-4 py-3 text-sm font-semibold text-slate-600">{profileUser.email}</td>
                                  <td className="px-4 py-3">
                                    <span className={["rounded-full border px-2.5 py-1 text-xs font-black", profileUser.active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-500"].join(" ")}>
                                      {profileUser.active ? "Ativo" : "Inativo"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    {profileUser.hasOverride ? (
                                      <span className="rounded-full border border-[#011848]/15 bg-[#011848]/5 px-2.5 py-1 text-xs font-black text-[#011848]">
                                        Sim / {profileUser.overrideCount}
                                      </span>
                                    ) : (
                                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-500">
                                        Nao
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-sm font-black text-slate-700">{profileUser.effectiveCount}</td>
                                  <td className="px-4 py-3 text-sm font-semibold text-slate-500">{formatDateTime(profileUser.updatedAt)}</td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectUser(profileUser)}
                                      className={[
                                        "rounded-lg border px-3 py-1.5 text-xs font-black transition",
                                        selected
                                          ? "border-[#011848] bg-[#011848] text-white"
                                          : "border-slate-200 bg-white text-slate-700 hover:border-[#011848] hover:text-[#011848]",
                                      ].join(" ")}
                                    >
                                      {selected ? "Editando" : "Editar usuário"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={7} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                                Nenhum usuário encontrado.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </main>
  );
}



