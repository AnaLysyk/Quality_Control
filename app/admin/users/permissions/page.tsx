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
import { ACTION_LABELS, PERMISSION_MODULES, getActionLabel, type PermissionModule, type PermissionModuleCategory } from "@/lib/permissionCatalog";
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

type ModuleStateFilter = "all" | "visible" | "partial" | "hidden" | "changed";
type ScreenStateFilter = "all" | "visible" | "hidden" | "controlled" | "uncontrolled";

const PROFILE_ORDER: SystemRole[] = [
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
  SYSTEM_ROLES.TESTING_COMPANY_USER,
  SYSTEM_ROLES.EMPRESA,
  SYSTEM_ROLES.COMPANY_USER,
];

const QUICK_CONTROL_MODULES = new Set(["context", "operations", "dashboard", "release_calendar", "brain", "ai"]);
const ALL_CATEGORIES = "Todas as categorias";

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
  if (allowed === 0) return { key: "hidden" as const, label: "Invisível", tone: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200", allowed, total, baseAllowed };
  if (allowed === total) return { key: "visible" as const, label: "Completo", tone: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200", allowed, total, baseAllowed };
  return { key: "partial" as const, label: "Parcial", tone: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200", allowed, total, baseAllowed };
}

function moduleHasChange(module: PermissionModule, systemDefaults: PermissionMatrix, effectivePermissions: PermissionMatrix) {
  return module.actions.some((action) =>
    hasPermissionAccess(systemDefaults, module.id, action) !== hasPermissionAccess(effectivePermissions, module.id, action),
  );
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
        "flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition",
        checked
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
          : "border-(--tc-border) bg-(--tc-surface) text-(--tc-text-secondary)",
        changed ? "ring-2 ring-(--tc-accent,#ef0001)/25" : "",
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-(--tc-accent,#ef0001)/50",
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
      {changed ? <span className="rounded-lg border border-(--tc-accent,#ef0001)/30 bg-(--tc-accent-soft) px-1.5 py-0.5 text-[10px] uppercase text-(--tc-accent,#ef0001)">ajuste</span> : null}
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-(--tc-text-muted)">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border border-(--tc-border) bg-(--tc-input-bg) px-3 text-sm font-semibold normal-case tracking-normal text-(--tc-text-primary) outline-none transition focus:border-(--tc-accent,#ef0001)"
      >
        {children}
      </select>
    </label>
  );
}

export default function ProfileManagementPage() {
  const { user, accessContext, loading, can, refreshUser } = usePermissionAccess();
  const [selectedRole, setSelectedRole] = useState<SystemRole>(SYSTEM_ROLES.LEADER_TC);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  const [moduleStateFilter, setModuleStateFilter] = useState<ModuleStateFilter>("all");
  const [screenStateFilter, setScreenStateFilter] = useState<ScreenStateFilter>("all");
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

  const categories = useMemo(() => {
    const values = new Set<PermissionModuleCategory>();
    for (const item of PERMISSION_MODULES) values.add(item.category);
    return [ALL_CATEGORIES, ...Array.from(values)];
  }, []);

  const filteredModules = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return PERMISSION_MODULES.filter((permissionModule) => {
      const state = getModulePermissionState(permissionModule, systemDefaults, effectivePermissions);
      const changed = moduleHasChange(permissionModule, systemDefaults, effectivePermissions);
      const haystack = normalizeText(`${permissionModule.id} ${permissionModule.label} ${permissionModule.description} ${permissionModule.category} ${permissionModule.actions.join(" ")}`);
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesCategory = categoryFilter === ALL_CATEGORIES || permissionModule.category === categoryFilter;
      const matchesState =
        moduleStateFilter === "all" ||
        (moduleStateFilter === "changed" ? changed : state.key === moduleStateFilter);
      return matchesQuery && matchesCategory && matchesState;
    });
  }, [categoryFilter, effectivePermissions, moduleStateFilter, query, systemDefaults]);

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
      const controlled = Boolean(permission);
      const moduleLabel =
        PERMISSION_MODULES.find((permissionModule) => permissionModule.id === permission?.moduleId)?.label ??
        permission?.moduleId ??
        "Sem permissão granular";
      return { route, permission, visible, controlled, moduleLabel };
    }).filter((row) => {
      const haystack = normalizeText(`${row.route.label} ${row.route.path} ${row.route.moduleId} ${row.moduleLabel}`);
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesState =
        screenStateFilter === "all" ||
        (screenStateFilter === "visible" && row.visible) ||
        (screenStateFilter === "hidden" && !row.visible) ||
        (screenStateFilter === "controlled" && row.controlled) ||
        (screenStateFilter === "uncontrolled" && !row.controlled);
      return matchesQuery && matchesState;
    });
  }, [effectivePermissions, query, screenStateFilter]);

  const allScreenRows = useMemo(() => {
    return SYSTEM_ROUTES.map((route) => ({
      route,
      visible: routePermissionAllowed(effectivePermissions, route.requiredPermission),
      controlled: Boolean(route.requiredPermission),
    }));
  }, [effectivePermissions]);

  const visibleScreenCount = allScreenRows.filter((row) => row.visible).length;
  const hiddenScreenCount = allScreenRows.length - visibleScreenCount;
  const uncontrolledScreenCount = allScreenRows.filter((row) => !row.controlled).length;
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
        reason: "Ajuste pela Gestão de Perfis",
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
      setNotice({ type: "success", message: "Perfil salvo. Menu, rotas e Brain passam a respeitar esta matriz." });
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
    <main className="min-h-screen text-(--tc-text-primary)">
      <div className="mx-auto flex w-full max-w-[1640px] flex-col gap-4 px-2 py-3 sm:px-3 lg:px-4">
        <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Gestão de Perfis" }]} />

        <section className="overflow-hidden rounded-3xl border border-(--tc-border) bg-[linear-gradient(135deg,color-mix(in_srgb,var(--tc-primary)_92%,#000)_0%,color-mix(in_srgb,var(--tc-primary)_72%,var(--tc-accent))_58%,var(--tc-accent)_100%)] p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/70">Matriz real do sistema</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Gestão de Perfis</h1>
              <p className="mt-3 text-sm leading-6 text-white/78 sm:text-base">
                O que estiver ligado aqui aparece no menu, nas rotas e no Brain. O que for desligado e salvo fica invisível para o perfil selecionado.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[620px]">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">Permissões</div>
                <div className="mt-1 text-2xl font-black">{countPermissionActions(effectivePermissions)}</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">Telas visíveis</div>
                <div className="mt-1 text-2xl font-black">{visibleScreenCount}</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">Invisíveis</div>
                <div className="mt-1 text-2xl font-black">{hiddenScreenCount}</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">Sem controle</div>
                <div className="mt-1 text-2xl font-black">{uncontrolledScreenCount}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-(--tc-border) bg-(--tc-surface) p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,520px)]">
            <div className="flex min-w-0 flex-wrap gap-2">
              {PROFILE_ORDER.map((profile) => {
                const selected = selectedRole === profile;
                return (
                  <button
                    key={profile}
                    type="button"
                    onClick={() => setSelectedRole(profile)}
                    className={[
                      "inline-flex min-h-11 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-black transition",
                      selected
                        ? "border-[#011848] bg-[#011848] text-white shadow-[0_16px_32px_rgba(1,24,72,0.22)]"
                        : `${getFixedProfileTone(profile)} hover:border-(--tc-accent,#ef0001) dark:bg-(--tc-surface-2)`,
                    ].join(" ")}
                  >
                    {selected ? <FiCheck className="h-4 w-4" /> : null}
                    {getFixedProfileLabel(profile, { short: true })}
                  </button>
                );
              })}
            </div>

            <label className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-(--tc-border) bg-(--tc-input-bg) px-3">
              <FiSearch className="h-4 w-4 shrink-0 text-(--tc-text-muted)" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar módulo, tela, função, ação, rota..."
                className="w-full bg-transparent text-sm font-semibold text-(--tc-text-primary) outline-none placeholder:text-(--tc-text-muted)"
                aria-label="Buscar módulo, tela ou função"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-3 border-t border-(--tc-border) pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <h2 className="text-xl font-black text-(--tc-text-primary)">{getFixedProfileLabel(selectedRole)}</h2>
              <p className="mt-1 text-sm leading-6 text-(--tc-text-secondary)">{getFixedProfileHint(selectedRole)}</p>
              <p className="mt-1 text-xs font-semibold text-(--tc-text-muted)">
                Última alteração: {formatDateTime(draftOverride.updatedAt)} {draftOverride.updatedBy ? `por ${draftOverride.updatedBy}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={!canEdit || saving || loadingProfile}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-(--tc-border) bg-(--tc-surface) px-4 text-sm font-bold text-(--tc-text-primary) disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiRefreshCw className="h-4 w-4" />
                Restaurar padrão
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canEdit || saving || loadingProfile || !hasDraftChanges}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#011848] px-4 text-sm font-bold text-white shadow-[0_14px_30px_rgba(1,24,72,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiSave className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>

          {notice.type !== "idle" ? (
            <div
              className={[
                "mt-4 flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold",
                notice.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
                  : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100",
              ].join(" ")}
              role="status"
            >
              {notice.type === "success" ? <FiCheck className="mt-0.5 h-4 w-4" /> : <FiAlertTriangle className="mt-0.5 h-4 w-4" />}
              {notice.message}
            </div>
          ) : null}

          {!canEdit ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              Seu perfil pode consultar esta central, mas não possui permissão para editar a matriz.
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-(--tc-border) bg-(--tc-surface) p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-2">
            <FiSliders className="h-4 w-4 text-(--tc-accent,#ef0001)" />
            <h2 className="text-lg font-black">Controles críticos</h2>
          </div>
          <p className="mt-1 text-sm text-(--tc-text-secondary)">
            Atalhos do que mais afeta visibilidade: contexto, Operacional, Agenda, Brain e assistente operacional.
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {quickModules.map((module) => {
              const state = getModulePermissionState(module, systemDefaults, effectivePermissions);
              return (
                <div key={module.id} className="rounded-2xl border border-(--tc-border) bg-(--tc-surface-2) p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-(--tc-text-primary)">{module.label}</h3>
                      <p className="mt-1 text-xs leading-5 text-(--tc-text-secondary)">{module.description}</p>
                    </div>
                    <span className={`shrink-0 rounded-xl border px-2 py-1 text-xs font-bold ${state.tone}`}>
                      {state.label}
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
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-(--tc-border) bg-(--tc-surface) p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FiGrid className="h-4 w-4 text-(--tc-accent,#ef0001)" />
                <h2 className="text-lg font-black">Módulos e funções</h2>
              </div>
              <p className="mt-1 text-sm text-(--tc-text-secondary)">
                Filtre para achar rápido o que está completo, parcial, invisível ou alterado neste perfil.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FilterSelect label="Categoria" value={categoryFilter} onChange={setCategoryFilter}>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </FilterSelect>
              <FilterSelect label="Status" value={moduleStateFilter} onChange={(value) => setModuleStateFilter(value as ModuleStateFilter)}>
                <option value="all">Todos</option>
                <option value="visible">Completos</option>
                <option value="partial">Parciais</option>
                <option value="hidden">Invisíveis</option>
                <option value="changed">Alterados</option>
              </FilterSelect>
              <div className="rounded-2xl border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-xs font-bold text-(--tc-text-secondary)">
                <div className="uppercase tracking-[0.14em] text-(--tc-text-muted)">Resultado</div>
                <div className="mt-1 text-lg font-black text-(--tc-text-primary)">{filteredModules.length} módulos</div>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-5">
            {groupedModules.map(([category, modules]) => (
              <details key={category} open className="rounded-2xl border border-(--tc-border) bg-(--tc-surface-2) p-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-(--tc-text-muted)">
                  <FiLayers className="h-4 w-4" />
                  {category} <span className="normal-case tracking-normal">({modules.length})</span>
                </summary>
                <div className="mt-3 grid gap-3">
                  {modules.map((module) => {
                    const state = getModulePermissionState(module, systemDefaults, effectivePermissions);
                    const changed = moduleHasChange(module, systemDefaults, effectivePermissions);
                    return (
                      <div key={module.id} className="rounded-2xl border border-(--tc-border) bg-(--tc-surface) p-3">
                        <div className="grid gap-3 lg:grid-cols-[minmax(220px,360px)_minmax(0,1fr)]">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-black text-(--tc-text-primary)">{module.label}</h4>
                              <span className={`rounded-xl border px-2 py-1 text-xs font-bold ${state.tone}`}>
                                {state.allowed}/{state.total}
                              </span>
                              {changed ? <span className="rounded-xl border border-(--tc-accent,#ef0001)/30 bg-(--tc-accent-soft) px-2 py-1 text-xs font-bold text-(--tc-accent,#ef0001)">alterado</span> : null}
                            </div>
                            <p className="mt-1 text-xs leading-5 text-(--tc-text-secondary)">{module.description}</p>
                            <p className="mt-1 text-[11px] font-semibold text-(--tc-text-muted)">{module.id}</p>
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
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-(--tc-border) bg-(--tc-surface) p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FiFilter className="h-4 w-4 text-(--tc-accent,#ef0001)" />
                <h2 className="text-lg font-black">Telas disponíveis para Menu e Brain</h2>
              </div>
              <p className="mt-1 text-sm text-(--tc-text-secondary)">
                Esta lista é calculada a partir das permissões efetivas. Tela invisível aqui não deve aparecer no menu nem no Brain do perfil.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <FilterSelect label="Telas" value={screenStateFilter} onChange={(value) => setScreenStateFilter(value as ScreenStateFilter)}>
                <option value="all">Todas</option>
                <option value="visible">Visíveis</option>
                <option value="hidden">Invisíveis</option>
                <option value="controlled">Com permissão</option>
                <option value="uncontrolled">Sem permissão granular</option>
              </FilterSelect>
              <span className="inline-flex items-center gap-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                <FiEye className="h-3.5 w-3.5" /> {visibleScreenCount} visíveis
              </span>
              <span className="inline-flex items-center gap-1 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                <FiEyeOff className="h-3.5 w-3.5" /> {hiddenScreenCount} invisíveis
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[980px] w-full border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.14em] text-(--tc-text-muted)">
                  <th className="px-3 py-2">Tela</th>
                  <th className="px-3 py-2">Permissão</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Controle</th>
                </tr>
              </thead>
              <tbody>
                {screenRows.map(({ route, permission, visible, controlled, moduleLabel }) => (
                  <tr key={route.id} className="bg-(--tc-surface-2)">
                    <td className="rounded-l-2xl px-3 py-3 align-top">
                      <div className="font-black text-(--tc-text-primary)">{route.label}</div>
                      <div className="mt-1 text-xs text-(--tc-text-muted)">{route.path}</div>
                      <div className="mt-1 text-[11px] font-semibold text-(--tc-text-muted)">{route.mainFile}</div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {permission ? (
                        <div>
                          <div className="font-bold text-(--tc-text-primary)">{moduleLabel}</div>
                          <div className="mt-1 text-xs text-(--tc-text-muted)">{permission.moduleId}:{ACTION_LABELS[permission.action] ?? permission.action}</div>
                        </div>
                      ) : (
                        <span className="rounded-xl border border-(--tc-border) bg-(--tc-surface) px-2 py-1 text-xs font-bold text-(--tc-text-muted)">
                          Sem permissão granular
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span
                        className={[
                          "inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs font-bold",
                          visible
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
                            : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100",
                        ].join(" ")}
                      >
                        {visible ? <FiEye className="h-3.5 w-3.5" /> : <FiEyeOff className="h-3.5 w-3.5" />}
                        {visible ? "Visível" : "Invisível"}
                      </span>
                    </td>
                    <td className="rounded-r-2xl px-3 py-3 align-top">
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
                        <span className="text-xs font-semibold text-(--tc-text-muted)">{controlled ? "Controlada" : "Mapeamento pendente"}</span>
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
