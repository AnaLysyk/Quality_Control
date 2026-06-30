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
import Breadcrumb from "@/components/Breadcrumb";
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
  counts?: {
    system: number;
    allow: number;
    deny: number;
    effective: number;
  };
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

const QUICK_CONTROL_MODULES = new Set(["context", "operations", "dashboard", "brain"]);

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

function routePermissionAllowed(permissions: PermissionMatrix, permission: { moduleId: string; action: string } | null) {
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
  if (allowed === 0) return { label: "Invisível", tone: "border-rose-200 bg-rose-50 text-rose-700", allowed, total, baseAllowed };
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
  onToggle: (moduleId: string, action: string, checked: boolean) => void;
}) {
  const { moduleId, action, systemDefaults, effectivePermissions, disabled, onToggle } = props;
  const checked = hasPermissionAccess(effectivePermissions, moduleId, action);
  const baseChecked = hasPermissionAccess(systemDefaults, moduleId, action);
  const changed = checked !== baseChecked;

  return (
    <label
      className={[
        "flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition",
        checked
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-white text-slate-600",
        changed ? "ring-1 ring-blue-300" : "",
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-blue-300",
      ].join(" ")}
    >
      <input
        type="checkbox"
        className="h-4 w-4 accent-[#011848]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onToggle(moduleId, action, event.target.checked)}
      />
      <span className="min-w-0 flex-1">{getActionLabel(action)}</span>
      {changed ? <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] uppercase text-blue-700">ajuste</span> : null}
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
        const response = await fetch(`/api/admin/profile-permissions/${selectedRole}`, { credentials: "include" });
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

  const filteredModules = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return PERMISSION_MODULES;
    return PERMISSION_MODULES.filter((permissionModule) => {
      const haystack = normalizeText(`${permissionModule.id} ${permissionModule.label} ${permissionModule.description} ${permissionModule.category}`);
      return haystack.includes(normalizedQuery);
    });
  }, [query]);

  const groupedModules = useMemo(() => {
    const groups = new Map<string, PermissionModule[]>();
    for (const permissionModule of filteredModules) {
      const list = groups.get(permissionModule.category) ?? [];
      list.push(permissionModule);
      groups.set(permissionModule.category, list);
    }
    return Array.from(groups.entries());
  }, [filteredModules]);

  const screenRows = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return SYSTEM_ROUTES.map((route) => {
      const permission = route.requiredPermission;
      const visible = routePermissionAllowed(effectivePermissions, permission);
      const moduleLabel =
        PERMISSION_MODULES.find((permissionModule) => permissionModule.id === permission?.moduleId)?.label ??
        permission?.moduleId ??
        "Sem permissão granular";
      return { route, permission, visible, moduleLabel };
    }).filter((row) => {
      if (!normalizedQuery) return true;
      const haystack = normalizeText(`${row.route.label} ${row.route.path} ${row.route.moduleId} ${row.moduleLabel}`);
      return haystack.includes(normalizedQuery);
    });
  }, [effectivePermissions, query]);

  const visibleScreenCount = screenRows.filter((row) => row.visible).length;
  const hiddenScreenCount = screenRows.length - visibleScreenCount;
  const quickModules = PERMISSION_MODULES.filter((module) => QUICK_CONTROL_MODULES.has(module.id));

  function handleToggle(moduleId: string, action: string, checked: boolean) {
    setDraftOverride((current) => toggleOverrideAction(current, systemDefaults, moduleId, action, checked));
  }

  async function handleSave() {
    if (!canEdit) return;
    setSaving(true);
    setNotice({ type: "idle" });
    try {
      const body = {
        allow: normalizePermissionMatrix(draftOverride.allow),
        deny: normalizePermissionMatrix(draftOverride.deny),
        reason: "Ajuste pela Gestao de Perfis",
      };
      const response = await fetch(`/api/admin/profile-permissions/${selectedRole}`, {
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
      setNotice({ type: "success", message: "Perfil salvo. Líder TC recebeu notificação da alteração." });
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
      const response = await fetch(`/api/admin/profile-permissions/${selectedRole}`, {
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
      setNotice({ type: "success", message: "Perfil restaurado para o padrão do sistema." });
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
    <main className="min-h-screen bg-[#f6f8fb] px-3 py-4 text-[#0b1a3c] sm:px-5 lg:px-7">
      <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-5">
        <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Gestão de Perfis" }]} />

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#011848] text-white">
                <FiShield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ef0001]">Governança de acesso</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-[#0b1a3c] sm:text-3xl">
                  Gestão de Perfis
                </h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                  Central para definir módulos, funções, telas, contexto de empresa/projeto e exibição do Operacional por tipo de perfil.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold text-slate-500">Permissões</div>
                <div className="mt-1 text-2xl font-black">{countPermissionActions(effectivePermissions)}</div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                <div className="text-xs font-semibold">Telas visíveis</div>
                <div className="mt-1 text-2xl font-black">{visibleScreenCount}</div>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
                <div className="text-xs font-semibold">Bloqueadas</div>
                <div className="mt-1 text-2xl font-black">{hiddenScreenCount}</div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800">
                <div className="text-xs font-semibold">Sobrescritas</div>
                <div className="mt-1 text-2xl font-black">
                  {countPermissionActions(draftOverride.allow) + countPermissionActions(draftOverride.deny)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap gap-2">
              {PROFILE_ORDER.map((profile) => {
                const selected = selectedRole === profile;
                return (
                  <button
                    key={profile}
                    type="button"
                    onClick={() => setSelectedRole(profile)}
                    className={[
                      "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition",
                      selected
                        ? "border-[#011848] bg-[#011848] text-white"
                        : `${getFixedProfileTone(profile)} hover:border-[#011848]`,
                    ].join(" ")}
                  >
                    {selected ? <FiCheck className="h-4 w-4" /> : null}
                    {getFixedProfileLabel(profile, { short: true })}
                  </button>
                );
              })}
            </div>

            <label className="flex min-h-10 w-full items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 xl:max-w-md">
              <FiSearch className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar módulo, tela, função ou escopo..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                aria-label="Buscar módulo, tela ou função"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-[#0b1a3c]">{getFixedProfileLabel(selectedRole)}</h2>
              <p className="mt-1 text-sm text-slate-600">{getFixedProfileHint(selectedRole)}</p>
              <p className="mt-1 text-xs text-slate-500">
                Última alteração: {formatDateTime(draftOverride.updatedAt)} {draftOverride.updatedBy ? `por ${draftOverride.updatedBy}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={!canEdit || saving || loadingProfile}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiRefreshCw className="h-4 w-4" />
                Restaurar padrão
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canEdit || saving || loadingProfile || !hasDraftChanges}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#011848] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiSave className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>

          {notice.type !== "idle" ? (
            <div
              className={[
                "mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-semibold",
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
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
              Seu perfil pode consultar esta central, mas não possui permissão para editar a matriz.
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <FiSliders className="h-4 w-4 text-[#ef0001]" />
            <h2 className="text-lg font-black">Contexto, Visão Geral, Brain e Operacional</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Controles mais sensíveis da troca de empresa/projeto, visão global e exibição do módulo Operacional.
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {quickModules.map((module) => (
              <div key={module.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-[#0b1a3c]">{module.label}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{module.description}</p>
                  </div>
                  <span className={`shrink-0 rounded-lg border px-2 py-1 text-xs font-bold ${getModulePermissionState(module, systemDefaults, effectivePermissions).tone}`}>
                    {getModulePermissionState(module, systemDefaults, effectivePermissions).label}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <FiGrid className="h-4 w-4 text-[#ef0001]" />
            <h2 className="text-lg font-black">Módulos e funções</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Cada ação marcada fica disponível para o perfil. Ações desmarcadas deixam módulos, atalhos ou funções invisíveis quando dependem dessa permissão.
          </p>

          <div className="mt-5 space-y-5">
            {groupedModules.map(([category, modules]) => (
              <div key={category} className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
                <div className="mb-3 flex items-center gap-2">
                  <FiLayers className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">{category}</h3>
                </div>
                <div className="grid gap-3">
                  {modules.map((module) => {
                    const state = getModulePermissionState(module, systemDefaults, effectivePermissions);
                    return (
                      <div key={module.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="grid gap-3 lg:grid-cols-[minmax(220px,360px)_minmax(0,1fr)]">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-black text-[#0b1a3c]">{module.label}</h4>
                              <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${state.tone}`}>
                                {state.allowed}/{state.total}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{module.description}</p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-400">{module.id}</p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FiFilter className="h-4 w-4 text-[#ef0001]" />
                <h2 className="text-lg font-black">Telas disponíveis e invisíveis</h2>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                A visibilidade abaixo é calculada a partir das permissões atuais do perfil selecionado.
              </p>
            </div>
            <div className="flex gap-2 text-xs font-bold">
              <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
                <FiEye className="h-3.5 w-3.5" /> {visibleScreenCount} visíveis
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-rose-800">
                <FiEyeOff className="h-3.5 w-3.5" /> {hiddenScreenCount} invisíveis
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[980px] w-full border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-3 py-2">Tela</th>
                  <th className="px-3 py-2">Permissão</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Controle</th>
                </tr>
              </thead>
              <tbody>
                {screenRows.map(({ route, permission, visible, moduleLabel }) => (
                  <tr key={route.id} className="bg-slate-50">
                    <td className="rounded-l-lg px-3 py-3 align-top">
                      <div className="font-black text-[#0b1a3c]">{route.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{route.path}</div>
                      <div className="mt-1 text-[11px] font-semibold text-slate-400">{route.mainFile}</div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {permission ? (
                        <div>
                          <div className="font-bold text-slate-700">{moduleLabel}</div>
                          <div className="mt-1 text-xs text-slate-500">{permission.moduleId}:{ACTION_LABELS[permission.action] ?? permission.action}</div>
                        </div>
                      ) : (
                        <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-500">
                          Sem permissão granular
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span
                        className={[
                          "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold",
                          visible
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-rose-200 bg-rose-50 text-rose-800",
                        ].join(" ")}
                      >
                        {visible ? <FiEye className="h-3.5 w-3.5" /> : <FiEyeOff className="h-3.5 w-3.5" />}
                        {visible ? "Visível" : "Invisível"}
                      </span>
                    </td>
                    <td className="rounded-r-lg px-3 py-3 align-top">
                      {permission ? (
                        <PermissionToggle
                          moduleId={permission.moduleId}
                          action={permission.action}
                          systemDefaults={systemDefaults}
                          effectivePermissions={effectivePermissions}
                          disabled={!canEdit || loadingProfile || saving}
                          onToggle={handleToggle}
                        />
                      ) : (
                        <span className="text-xs text-slate-500">Controlada pelo produto</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
