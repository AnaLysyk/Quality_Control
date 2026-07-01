"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCheck,
  FiEye,
  FiEyeOff,
  FiFilter,
  FiGrid,
  FiLayers,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiShield,
  FiSliders,
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

const PROFILE_GUIDES: Record<SystemRole, string[]> = {
  [SYSTEM_ROLES.LEADER_TC]: [
    "Visão global sem precisar escolher empresa ou projeto.",
    "Pode acompanhar Brain, IA, Chat, usuários, suporte e governança.",
    "Operacional fica opcional: aparece apenas se o módulo estiver liberado.",
  ],
  [SYSTEM_ROLES.TECHNICAL_SUPPORT]: [
    "Enxerga o que precisa para atendimento, suporte e operação assistida.",
    "Não precisa selecionar empresa/projeto antes de consultar a visão geral.",
    "Operacional, Brain, IA e Chat podem ser ligados ou escondidos por perfil.",
  ],
  [SYSTEM_ROLES.TESTING_COMPANY_USER]: [
    "Troca empresa e projeto conforme o vínculo de trabalho.",
    "Vê dados operacionais apenas quando o contexto permitir.",
    "Acesso a IA, Brain e Chat pode ser ajustado sem mexer no código.",
  ],
  [SYSTEM_ROLES.EMPRESA]: [
    "Perfil institucional da empresa com visão do próprio contexto.",
    "Não precisa escolher empresa antes; o projeto guia o recorte de dados.",
    "Menus administrativos ficam ocultos quando a permissão não existir.",
  ],
  [SYSTEM_ROLES.COMPANY_USER]: [
    "Usuário da empresa com acesso simples e limitado ao próprio uso.",
    "Vê apenas telas úteis para consultar, pedir suporte e acompanhar qualidade.",
    "Funções avançadas ficam invisíveis para não poluir a navegação.",
  ],
};

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
  if (allowed === 0) return { label: "Oculto", tone: "border-rose-200 bg-rose-50 text-rose-700", allowed, total, baseAllowed };
  if (allowed === total) return { label: "Completo", tone: "border-emerald-200 bg-emerald-50 text-emerald-700", allowed, total, baseAllowed };
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

function notifyPermissionRuntimeChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("qc:permissions-changed"));
  window.localStorage.setItem("qc:permissions-changed", String(Date.now()));
}

function resolveCurrentRole(user: ReturnType<typeof usePermissionAccess>["user"], accessRole?: string | null) {
  return (
    normalizeLegacyRole(typeof user?.permissionRole === "string" ? user.permissionRole : null) ??
    normalizeLegacyRole(typeof user?.role === "string" ? user.role : null) ??
    normalizeLegacyRole(typeof user?.companyRole === "string" ? user.companyRole : null) ??
    normalizeLegacyRole(accessRole ?? null)
  );
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
        "group flex items-center gap-3 rounded-2xl border text-sm font-semibold transition",
        compact ? "min-h-9 px-3 py-2" : "min-h-11 px-3.5 py-2.5",
        checked
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-slate-200 bg-white text-slate-600",
        changed ? "ring-2 ring-blue-100" : "",
        disabled ? "cursor-not-allowed opacity-65" : "cursor-pointer hover:border-blue-300 hover:bg-blue-50/50",
      ].join(" ")}
    >
      <span
        className={[
          "relative flex h-5 w-9 shrink-0 items-center rounded-full border transition",
          checked ? "border-emerald-400 bg-emerald-500" : "border-slate-300 bg-slate-200",
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
      <span className="min-w-0 flex-1">{getActionLabel(action)}</span>
      {changed ? (
        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-blue-700">
          ajuste
        </span>
      ) : null}
    </label>
  );
}

export default function ProfileManagementPage() {
  const { user, accessContext, loading, can, refreshUser } = usePermissionAccess();
  const [selectedRole, setSelectedRole] = useState<SystemRole>(SYSTEM_ROLES.LEADER_TC);
  const [query, setQuery] = useState("");
  const [profileState, setProfileState] = useState<ProfilePermissionsResponse | null>(null);
  const [draftOverride, setDraftOverride] = useState<ProfileOverride>({ allow: {}, deny: {} });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeState>({ type: "idle" });
  const [profileUsers, setProfileUsers] = useState<ProfileUserSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

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
        setDraftOverride(data.override ?? { role: selectedRole, allow: {}, deny: {} });
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
    setSelectedUserId(null);
  }, [selectedRole]);

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

  const filteredModules = useMemo(() => {
    if (!normalizedQuery) return PERMISSION_MODULES;
    return PERMISSION_MODULES.filter((permissionModule) => {
      const haystack = normalizeText(
        `${permissionModule.id} ${permissionModule.label} ${permissionModule.description} ${permissionModule.category} ${permissionModule.actions.join(" ")}`,
      );
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  const groupedModules = useMemo(() => {
    const groups = new Map<string, PermissionModule[]>();
    for (const permissionModule of filteredModules) {
      const list = groups.get(permissionModule.category) ?? [];
      list.push(permissionModule);
      groups.set(permissionModule.category, list);
    }
    return Array.from(groups.entries());
  }, [filteredModules]);

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

  const screenRows = useMemo(() => {
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

  const selectedUser = profileUsers.find((item) => item.id === selectedUserId) ?? null;
  const editingUser = Boolean(selectedUserId);
  const visibleScreenCount = allScreenRows.filter((row) => row.visible).length;
  const hiddenScreenCount = allScreenRows.length - visibleScreenCount;
  const overriddenCount = countPermissionActions(draftOverride.allow) + countPermissionActions(draftOverride.deny);
  const quickModules = PERMISSION_MODULES.filter((module) => QUICK_CONTROL_MODULES.has(module.id));
  const fullModuleCount = PERMISSION_MODULES.filter(
    (module) => getModulePermissionState(module, systemDefaults, effectivePermissions).allowed === module.actions.length,
  ).length;
  const hiddenModuleCount = PERMISSION_MODULES.filter(
    (module) => getModulePermissionState(module, systemDefaults, effectivePermissions).allowed === 0,
  ).length;

  function handleToggle(moduleId: string, action: string, checked: boolean) {
    setDraftOverride((current) => toggleOverrideAction(current, systemDefaults, moduleId, action, checked));
  }

  function handleModuleToggle(module: PermissionModule, shouldAllow: boolean) {
    setDraftOverride((current) =>
      module.actions.reduce(
        (nextOverride, action) => toggleOverrideAction(nextOverride, systemDefaults, module.id, action, shouldAllow),
        current,
      ),
    );
  }

  async function handleSave() {
    if (!canEdit) return;
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
      const saved = payload?.saved ?? { role: selectedRole, ...body };
      setDraftOverride(saved);
      setProfileState((current) =>
        current
          ? {
              ...current,
              override: saved,
              permissions: payload?.permissions ?? effectivePermissions,
              counts: {
                system: countPermissionActions(systemDefaults),
                allow: countPermissionActions(saved.allow),
                deny: countPermissionActions(saved.deny),
                effective: countPermissionActions(payload?.permissions ?? effectivePermissions),
              },
            }
          : current,
      );
      setNotice({
        type: "success",
        message: editingUser
          ? "Usuário salvo. Ele mantém o perfil, mas agora usa permissões individuais."
          : "Perfil salvo. As mudanças já entram no controle de módulos, telas, IA, Brain e Chat.",
      });
      notifyPermissionRuntimeChanged();
      await refreshUser();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Falha ao salvar perfil" });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!canEdit) return;
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
      setDraftOverride(emptyOverride);
      setProfileState((current) =>
        current
          ? {
              ...current,
              override: null,
              permissions: payload?.permissions ?? systemDefaults,
              counts: {
                system: countPermissionActions(systemDefaults),
                allow: 0,
                deny: 0,
                effective: countPermissionActions(payload?.permissions ?? systemDefaults),
              },
            }
          : current,
      );
      setNotice({
        type: "success",
        message: editingUser
          ? "Usuário restaurado. Ele voltou a seguir o padrão efetivo do perfil."
          : "Perfil restaurado para o padrão do sistema.",
      });
      notifyPermissionRuntimeChanged();
      await refreshUser();
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
    <main className="profile-permissions-clean min-h-screen px-3 py-3 text-[#0b1a3c] sm:px-5 lg:px-6">
      <div className="mx-auto flex w-full max-w-none flex-col gap-4">
        <section className="profile-permissions-shell overflow-hidden rounded-[1.5rem] border border-slate-200/70 bg-white/82 shadow-sm shadow-slate-200/60">
          <div className="profile-permissions-hero border-b border-slate-200/70 px-5 py-4 text-[#011848] dark:text-white sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-[#011848] dark:text-white ring-1 ring-white/20">
                  <FiShield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-100">Governança de acesso</p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Gestão de Perfis</h1>
                </div>
              </div>

              <div className="profile-permissions-kpis flex flex-wrap gap-2 text-xs font-bold text-blue-50/90">
                <span>{countPermissionActions(effectivePermissions)} permissões</span>
                <span>{visibleScreenCount} telas visíveis</span>
                <span>{hiddenScreenCount} ocultas</span>
                <span>{overriddenCount} ajustes</span>
              </div>
            </div>
          </div>

          <div className="profile-permissions-layout grid gap-4 p-4 sm:p-5 xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="profile-permissions-profile-list rounded-2xl border border-slate-200/70 bg-slate-50/55 p-2.5">
              <p className="px-2 pb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Tipo de perfil</p>
              <div className="grid gap-2">
                {PROFILE_ORDER.map((profile) => {
                  const selected = selectedRole === profile;
                  return (
                    <button
                      key={profile}
                      type="button"
                      onClick={() => setSelectedRole(profile)}
                      className={[
                        "flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left text-sm font-black transition",
                        selected
                          ? "border-[#011848] bg-[#011848] text-[#011848] dark:text-white shadow-sm"
                          : `${getFixedProfileTone(profile)} hover:border-[#011848] hover:bg-white`,
                      ].join(" ")}
                    >
                      <span>{getFixedProfileLabel(profile, { short: true })}</span>
                      {selected ? <FiCheck className="h-4 w-4" /> : null}
                    </button>
                  );
                })}
              </div>

              <div className="profile-permissions-profile-hint mt-3 rounded-2xl border border-slate-200/70 bg-white/60 p-3">
                <h2 className="text-base font-black text-[#0b1a3c]">{getFixedProfileLabel(selectedRole)}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">{getFixedProfileHint(selectedRole)}</p>
                <ul className="mt-3 space-y-2 text-xs font-semibold leading-5 text-slate-600">
                  {PROFILE_GUIDES[selectedRole].map((item) => (
                    <li key={item} className="flex gap-2">
                      <FiCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>

            <div className="flex min-w-0 flex-col gap-4">
              <section className="profile-permissions-toolbar sticky top-3 z-10 rounded-2xl border border-slate-200/70 bg-white/88 p-3 shadow-sm backdrop-blur">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <label className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 xl:max-w-xl">
                    <FiSearch className="h-4 w-4 shrink-0 text-slate-500" />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar módulo, tela, função, Chat, IA, Brain ou Operacional..."
                      className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                      aria-label="Buscar módulo, tela ou função"
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={!canEdit || saving || loadingProfile}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-[#011848] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiRefreshCw className="h-4 w-4" />
                      {editingUser ? "Restaurar usuário" : "Restaurar padrão"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!canEdit || saving || loadingProfile || !hasDraftChanges}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#011848] px-4 text-sm font-black text-[#011848] dark:text-white shadow-sm transition hover:bg-[#0b255d] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiSave className="h-4 w-4" />
                      {saving ? "Salvando..." : hasDraftChanges ? "Salvar alterações" : "Tudo salvo"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 lg:flex-row lg:items-center lg:justify-between">
                  <span>
                    {editingUser && selectedUser ? (
                      <>Editando usuário: <strong>{selectedUser.label}</strong> · </>
                    ) : (
                      <>Editando padrão do perfil · </>
                    )}
                    Última alteração: <strong>{formatDateTime(draftOverride.updatedAt)}</strong>{" "}
                    {draftOverride.updatedBy ? `por ${draftOverride.updatedBy}` : ""}
                  </span>
                  <span className="font-semibold">
                    {fullModuleCount} módulos completos · {hiddenModuleCount} ocultos · {screenRows.length} telas no filtro atual
                  </span>
                </div>

                {notice.type !== "idle" ? (
                  <div
                    className={[
                      "mt-4 flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold",
                      notice.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-rose-200 bg-rose-50 text-rose-800",
                    ].join(" ")}
                    role="status"
                  >
                    {notice.type === "success" ? <FiCheck className="mt-0.5 h-4 w-4" /> : <FiAlertTriangle className="mt-0.5 h-4 w-4" />}
                    {notice.message}
                  </div>
                ) : null}

                {!canEdit ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                    Seu perfil pode consultar esta central, mas não possui permissão para editar a matriz.
                  </div>
                ) : null}
              </section>

              <section className="profile-permissions-section rounded-2xl border border-slate-200/70 bg-white/72 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FiSliders className="h-4 w-4 text-[#ef0001]" />
                      <h2 className="text-base font-black">Decisões rápidas do perfil</h2>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Ligue ou esconda o que mais muda a experiência do usuário: visão geral, contexto, Operacional, IA, Brain e Chat.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {quickModules.map((module) => {
                    const state = getModulePermissionState(module, systemDefaults, effectivePermissions);
                    return (
                      <div key={module.id} className="rounded-2xl border border-slate-200/70 bg-[#f8fafc] dark:bg-white/55 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-black text-[#0b1a3c]">{module.label}</h3>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{module.description}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-black ${state.tone}`}>
                            {state.label}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2">
                          {module.actions.map((action) => (
                            <PermissionToggle
                              key={`${module.id}-${action}`}
                              moduleId={module.id}
                              action={action}
                              systemDefaults={systemDefaults}
                              effectivePermissions={effectivePermissions}
                              disabled={!canEdit || loadingProfile || saving}
                              compact
                              onToggle={handleToggle}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="profile-permissions-section rounded-2xl border border-slate-200/70 bg-white/72 p-4">
                <div className="flex items-center gap-2">
                  <FiGrid className="h-4 w-4 text-[#ef0001]" />
                  <h2 className="text-base font-black">Módulos e funções</h2>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Cada módulo pode ser liberado, bloqueado ou ajustado ação por ação. O que ficar sem permissão sai do menu e da experiência do perfil.
                </p>

                <div className="mt-5 space-y-5">
                  {groupedModules.length ? (
                    groupedModules.map(([category, modules]) => (
                      <div key={category} className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
                        <div className="mb-3 flex items-center gap-2">
                          <FiLayers className="h-4 w-4 text-slate-500" />
                          <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">{category}</h3>
                        </div>
                        <div className="grid gap-3">
                          {modules.map((module) => {
                            const state = getModulePermissionState(module, systemDefaults, effectivePermissions);
                            return (
                              <div key={module.id} className="rounded-2xl border border-slate-200/70 bg-[#f8fafc] dark:bg-white/58 p-3">
                                <div className="grid gap-4 xl:grid-cols-[minmax(220px,340px)_minmax(0,1fr)]">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h4 className="font-black text-[#0b1a3c]">{module.label}</h4>
                                      <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${state.tone}`}>
                                        {state.allowed}/{state.total}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-slate-600">{module.description}</p>
                                    <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-slate-400">{module.id}</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleModuleToggle(module, true)}
                                        disabled={!canEdit || loadingProfile || saving}
                                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Liberar módulo
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleModuleToggle(module, false)}
                                        disabled={!canEdit || loadingProfile || saving}
                                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Ocultar módulo
                                      </button>
                                    </div>
                                  </div>
                                  <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
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
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
                      Nenhum módulo encontrado para a busca atual.
                    </div>
                  )}
                </div>
              </section>

              <section className="profile-permissions-section rounded-2xl border border-slate-200/70 bg-white/72 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FiFilter className="h-4 w-4 text-[#ef0001]" />
                      <h2 className="text-base font-black">Telas visíveis e invisíveis</h2>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Prévia calculada em tempo real. Se uma tela depender de permissão bloqueada, ela fica invisível para o perfil selecionado.
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs font-black">
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">
                      <FiEye className="h-3.5 w-3.5" /> {visibleScreenCount} visíveis
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-800">
                      <FiEyeOff className="h-3.5 w-3.5" /> {hiddenScreenCount} ocultas
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {screenRows.length ? (
                    screenRows.map(({ route, permission, visible, moduleLabel }) => (
                      <div
                        key={route.id}
                        className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-3 lg:grid-cols-[minmax(220px,1.3fr)_minmax(180px,0.8fr)_150px_minmax(220px,0.9fr)] lg:items-center"
                      >
                        <div className="min-w-0">
                          <div className="font-black text-[#0b1a3c]">{route.label}</div>
                          <div className="mt-1 truncate text-xs font-semibold text-slate-500">{route.path}</div>
                          <div className="mt-1 truncate text-[11px] font-semibold text-slate-400">{route.mainFile}</div>
                        </div>
                        <div>
                          {permission ? (
                            <div>
                              <div className="text-sm font-black text-slate-700">{moduleLabel}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {permission.moduleId}:{ACTION_LABELS[permission.action] ?? permission.action}
                              </div>
                            </div>
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-500">
                              Controlada pelo produto
                            </span>
                          )}
                        </div>
                        <div>
                          <span
                            className={[
                              "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-black",
                              visible
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border-rose-200 bg-rose-50 text-rose-800",
                            ].join(" ")}
                          >
                            {visible ? <FiEye className="h-3.5 w-3.5" /> : <FiEyeOff className="h-3.5 w-3.5" />}
                            {visible ? "Visível" : "Oculta"}
                          </span>
                        </div>
                        <div>
                          {permission ? (
                            <PermissionToggle
                              moduleId={permission.moduleId}
                              action={permission.action}
                              systemDefaults={systemDefaults}
                              effectivePermissions={effectivePermissions}
                              disabled={!canEdit || loadingProfile || saving}
                              compact
                              onToggle={handleToggle}
                            />
                          ) : (
                            <span className="text-xs font-semibold text-slate-500">Sem ação configurável nesta matriz.</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
                      Nenhuma tela encontrada para a busca atual.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
