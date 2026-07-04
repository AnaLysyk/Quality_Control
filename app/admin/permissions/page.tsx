"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiEye,
  FiEyeOff,
  FiRotateCcw,
  FiSave,
  FiSearch,
  FiShield,
  FiSliders,
  FiUsers,
} from "react-icons/fi";
import AccessDeniedState from "@/components/access/AccessDeniedState";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import { getFixedProfileLabel } from "@/lib/fixedProfilePresentation";
import { SYSTEM_ROUTES } from "@/lib/navigation/route-map";
import { PERMISSION_MODULES, getActionLabel, type PermissionModule } from "@/lib/permissionCatalog";
import {
  applyPermissionOverride,
  hasPermissionAccess,
  normalizePermissionMatrix,
  type PermissionMatrix,
} from "@/lib/permissionMatrix";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";

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

type SortKey = "module" | "status" | "actions" | "routes" | "changes";
type SortDirection = "asc" | "desc";

const PROFILE_ORDER: SystemRole[] = [
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
  SYSTEM_ROLES.TESTING_COMPANY_USER,
  SYSTEM_ROLES.EMPRESA,
  SYSTEM_ROLES.COMPANY_USER,
];

const PROFILE_DETAILS: Partial<
  Record<
    SystemRole,
    {
      title: string;
      scope: string;
      description: string;
      tone: string;
    }
  >
> = {
  [SYSTEM_ROLES.LEADER_TC]: {
    title: "Líder TC",
    scope: "Visão geral da operação",
    description: "Perfil base para acompanhar empresas, projetos, usuários, indicadores e gestão operacional.",
    tone: "border-blue-200 bg-blue-50 text-blue-900",
  },
  [SYSTEM_ROLES.TECHNICAL_SUPPORT]: {
    title: "Suporte Técnico",
    scope: "Suporte e atendimento",
    description: "Perfil para suporte, chamados, leitura operacional e apoio técnico entre empresas e projetos.",
    tone: "border-cyan-200 bg-cyan-50 text-cyan-900",
  },
  [SYSTEM_ROLES.TESTING_COMPANY_USER]: {
    title: "Usuário TC",
    scope: "Atuação por contexto",
    description: "Perfil de usuário interno que alterna empresa/projeto conforme a operação selecionada.",
    tone: "border-violet-200 bg-violet-50 text-violet-900",
  },
  [SYSTEM_ROLES.EMPRESA]: {
    title: "Empresa",
    scope: "Gestão da própria empresa",
    description: "Perfil com visão restrita ao próprio escopo empresarial, seus usuários e dados vinculados.",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  },
  [SYSTEM_ROLES.COMPANY_USER]: {
    title: "Usuário da Empresa",
    scope: "Uso operacional da empresa",
    description: "Perfil final com acesso controlado ao que a empresa liberou para execução diária.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
};

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
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

function resolveCurrentRole(user: ReturnType<typeof usePermissionAccess>["user"], accessRole?: string | null) {
  return (
    normalizeLegacyRole(typeof user?.permissionRole === "string" ? user.permissionRole : null) ??
    normalizeLegacyRole(typeof user?.role === "string" ? user.role : null) ??
    normalizeLegacyRole(typeof user?.companyRole === "string" ? user.companyRole : null) ??
    normalizeLegacyRole(accessRole ?? null)
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sem registro";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Sem registro";

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

  try {
    window.localStorage.setItem("qc:permissions-changed", String(Date.now()));
  } catch {
    // Mantém apenas o evento.
  }
}

function getRoutePermission(route: unknown) {
  const record = toRecord(route);
  const permission = toRecord(record.requiredPermission);

  return {
    moduleId: typeof permission.moduleId === "string" ? permission.moduleId : null,
    action: typeof permission.action === "string" ? permission.action : null,
  };
}

function getRouteValue(route: unknown, key: string) {
  const value = toRecord(route)[key];
  return typeof value === "string" ? value : "";
}

function getRoutesForModule(module: PermissionModule) {
  return SYSTEM_ROUTES.filter((route) => {
    const record = toRecord(route);
    const requiredPermission = getRoutePermission(route);
    const routeModuleId = typeof record.moduleId === "string" ? record.moduleId : null;

    return requiredPermission.moduleId === permissionModule.id || routeModuleId === permissionModule.id;
  });
}

function getProfileDetails(role: SystemRole) {
  return (
    PROFILE_DETAILS[role] ?? {
      title: getFixedProfileLabel(role, { short: true }),
      scope: "Perfil do sistema",
      description: "Perfil com permissões configuradas conforme o mapa de acesso.",
      tone: "border-slate-200 bg-slate-50 text-slate-900",
    }
  );
}

function getModuleState(
  module: PermissionModule,
  systemDefaults: PermissionMatrix,
  effectivePermissions: PermissionMatrix,
) {
  const total = permissionModule.actions.length;
  const allowed = permissionModule.actions.filter((action) => hasPermissionAccess(effectivePermissions, permissionModule.id, action)).length;
  const baseAllowed = permissionModule.actions.filter((action) => hasPermissionAccess(systemDefaults, permissionModule.id, action)).length;

  if (allowed === 0) {
    return {
      label: "Oculto",
      explanation: "Não aparece no menu e deve bloquear rota direta quando a tela exigir este módulo.",
      tone: "border-rose-200 bg-rose-50 text-rose-700",
      icon: FiEyeOff,
      allowed,
      total,
      baseAllowed,
      weight: 0,
    };
  }

  if (allowed === total) {
    return {
      label: "Ativo",
      explanation: "Aparece no menu e libera todas as ações previstas para o perfil.",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: FiEye,
      allowed,
      total,
      baseAllowed,
      weight: 2,
    };
  }

  return {
    label: "Parcial",
    explanation: "Aparece parcialmente. Algumas ações, botões ou rotas podem ficar ocultas.",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    icon: FiSliders,
    allowed,
    total,
    baseAllowed,
    weight: 1,
  };
}

export default function AdminPermissionsPage() {
  const { user, accessContext, loading, can, refreshUser } = usePermissionAccess();

  const [selectedRole, setSelectedRole] = useState<SystemRole>(SYSTEM_ROLES.LEADER_TC);
  const [profileState, setProfileState] = useState<ProfilePermissionsResponse | null>(null);
  const [draftOverride, setDraftOverride] = useState<ProfileOverride>({ allow: {}, deny: {} });
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("module");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
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
  const canReset = profileState?.canEdit === true && can("permissions", "reset");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoadingProfile(true);
      setNotice({ type: "idle" });

      try {
        const response = await fetch(`/api/admin/profile-permissions/${selectedRole}`, {
          credentials: "include",
        });

        const payload = (await response.json().catch(() => null)) as
          | ProfilePermissionsResponse
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error((payload as { error?: string } | null)?.error ?? "Falha ao carregar perfil.");
        }

        if (cancelled) return;

        const data = payload as ProfilePermissionsResponse;
        setProfileState(data);
        setDraftOverride(data.override ?? { role: data.role ?? selectedRole, allow: {}, deny: {} });
        setExpandedModuleId(null);
        setPage(1);
      } catch (error) {
        if (!cancelled) {
          setProfileState(null);
          setDraftOverride({ role: selectedRole, allow: {}, deny: {} });
          setNotice({
            type: "error",
            message: error instanceof Error ? error.message : "Falha ao carregar perfil.",
          });
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

  const roleCards = useMemo(
    () =>
      PROFILE_ORDER.map((role) => {
        const defaults = normalizePermissionMatrix(resolveRoleDefaults(role));
        const permissions = role === selectedRole ? effectivePermissions : defaults;
        const visibleModules = PERMISSION_MODULES.filter((module) =>
          permissionModule.actions.some((action) => hasPermissionAccess(permissions, permissionModule.id, action)),
        ).length;
        const activeActions = countPermissionActions(permissions);
        const details = getProfileDetails(role);

        return {
          role,
          details,
          activeActions,
          visibleModules,
        };
      }),
    [effectivePermissions, selectedRole],
  );

  const moduleRows = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return PERMISSION_MODULES.map((module) => {
      const routes = getRoutesForModule(permissionModule);
      const state = getModuleState(module, systemDefaults, effectivePermissions);
      const changedActions = permissionModule.actions.filter(
        (action) =>
          hasPermissionAccess(effectivePermissions, permissionModule.id, action) !==
          hasPermissionAccess(systemDefaults, permissionModule.id, action),
      ).length;

      const content = normalizeText(
        [
          permissionModule.label,
          permissionModule.description,
          permissionModule.category,
          permissionModule.id,
          permissionModule.actions.join(" "),
          routes.map((route) => `${getRouteValue(route, "path")} ${getRouteValue(route, "label")} ${getRouteValue(route, "description")}`).join(" "),
        ].join(" "),
      );

      return {
        module,
        routes,
        state,
        changedActions,
        content,
      };
    }).filter((row) => !normalizedQuery || row.content.includes(normalizedQuery));
  }, [effectivePermissions, query, systemDefaults]);

  const sortedRows = useMemo(() => {
    const rows = [...moduleRows];

    rows.sort((a, b) => {
      let left: number | string = "";
      let right: number | string = "";

      if (sortKey === "module") {
        left = a.permissionModule.label;
        right = b.permissionModule.label;
      }

      if (sortKey === "status") {
        left = a.state.weight;
        right = b.state.weight;
      }

      if (sortKey === "actions") {
        left = a.state.allowed;
        right = b.state.allowed;
      }

      if (sortKey === "routes") {
        left = a.routes.length;
        right = b.routes.length;
      }

      if (sortKey === "changes") {
        left = a.changedActions;
        right = b.changedActions;
      }

      const result =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), "pt-BR");

      return sortDirection === "asc" ? result : -result;
    });

    return rows;
  }, [moduleRows, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const visibleModuleCount = PERMISSION_MODULES.filter(
    (module) => getModuleState(module, systemDefaults, effectivePermissions).allowed > 0,
  ).length;

  const hiddenModuleCount = PERMISSION_MODULES.filter(
    (module) => getModuleState(module, systemDefaults, effectivePermissions).allowed === 0,
  ).length;

  const effectivePermissionCount = countPermissionActions(effectivePermissions);
  const overriddenCount = countPermissionActions(draftOverride.allow) + countPermissionActions(draftOverride.deny);

  const historyItems = useMemo(() => {
    const saved = profileState?.override;

    if (!saved?.updatedAt) {
      return [
        {
          title: "Sem alterações registradas",
          description: "Este perfil segue o padrão atual do sistema.",
          date: "Sem registro",
        },
      ];
    }

    return [
      {
        title: saved.reason || "Permissões do perfil alteradas",
        description: saved.updatedBy ? `Alterado por ${saved.updatedBy}` : "Alteração administrativa registrada.",
        date: formatDateTime(saved.updatedAt),
      },
    ];
  }, [profileState?.override]);

  const visibleHistoryItems = showFullHistory ? historyItems : historyItems.slice(0, 2);

  const searchSuggestions = useMemo(() => {
    const suggestions = new Set<string>();

    for (const permissionModule of PERMISSION_MODULES) {
      suggestions.add(permissionModule.label);
      suggestions.add(permissionModule.id);
      suggestions.add(permissionModule.category);

      if (permissionModule.description) suggestions.add(permissionModule.description);

      for (const action of permissionModule.actions) {
        suggestions.add(action);
        suggestions.add(getActionLabel(action));
      }

      for (const route of getRoutesForModule(permissionModule)) {
        const path = getRouteValue(route, "path");
        const label = getRouteValue(route, "label");
        const description = getRouteValue(route, "description");

        if (path) suggestions.add(path);
        if (label) suggestions.add(label);
        if (description) suggestions.add(description);
      }
    }

    return Array.from(suggestions)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 160);
  }, []);

  function handleSelectRole(role: SystemRole) {
    setSelectedRole(role);
    setQuery("");
    setExpandedModuleId(null);
    setPage(1);
    setNotice({ type: "idle" });
  }

  function handleToggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function handleToggle(moduleId: string, action: string, checked: boolean) {
    setDraftOverride((current) => toggleOverrideAction(current, systemDefaults, moduleId, action, checked));
  }

  function handleModuleToggle(module: PermissionModule, shouldAllow: boolean) {
    setDraftOverride((current) =>
      permissionModule.actions.reduce(
        (nextOverride, action) => toggleOverrideAction(nextOverride, systemDefaults, permissionModule.id, action, shouldAllow),
        current,
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
        reason: `Ajuste no perfil ${getFixedProfileLabel(selectedRole)}`,
      };

      const response = await fetch(`/api/admin/profile-permissions/${selectedRole}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const payload = (await response.json().catch(() => null)) as
        | { saved?: ProfileOverride; permissions?: PermissionMatrix; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao salvar permissões.");
      }

      const saved = payload?.saved ?? {
        role: selectedRole,
        ...body,
        updatedAt: new Date().toISOString(),
      };

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

      setNotice({
        type: "success",
        message: "Perfil salvo. O menu, os botões e as rotas protegidas devem refletir o novo padrão.",
      });

      await refreshUser();
      notifyPermissionRuntimeChanged();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Falha ao salvar permissões.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!canReset) return;

    const confirmed = window.confirm("Restaurar este perfil para o padrão do sistema?");
    if (!confirmed) return;

    setSaving(true);
    setNotice({ type: "idle" });

    try {
      const response = await fetch(`/api/admin/profile-permissions/${selectedRole}`, {
        method: "DELETE",
        credentials: "include",
      });

      const payload = (await response.json().catch(() => null)) as
        | { permissions?: PermissionMatrix; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao restaurar perfil.");
      }

      const permissions = payload?.permissions ?? systemDefaults;

      setDraftOverride({ role: selectedRole, allow: {}, deny: {} });
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

      setNotice({ type: "success", message: "Perfil restaurado para o padrão do sistema." });

      await refreshUser();
      notifyPermissionRuntimeChanged();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Falha ao restaurar perfil.",
      });
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
    document.body.classList.add("qc-permissions-profile-route");

    const hideShellPermissionsCover = () => {
      const nodes = Array.from(document.querySelectorAll("h1,h2,h3,span,p,div"));
      const titleNode = nodes.find((node) => {
        const text = node.textContent?.trim();
        if (text !== "Permissions") return false;
        return !node.closest(".profile-permissions-page");
      });

      const cover = titleNode?.closest("section,header,div");
      titleNode?.classList.add("qc-hidden-permissions-title");
      cover?.classList.add("qc-hidden-permissions-shell-cover");
    };

    hideShellPermissionsCover();
    const timer = window.setTimeout(hideShellPermissionsCover, 250);

    return () => {
      window.clearTimeout(timer);
      document.body.classList.remove("qc-permissions-profile-route");
      document.querySelectorAll(".qc-hidden-permissions-title").forEach((node) => {
        node.classList.remove("qc-hidden-permissions-title");
      });
      document.querySelectorAll(".qc-hidden-permissions-shell-cover").forEach((node) => {
        node.classList.remove("qc-hidden-permissions-shell-cover");
      });
    };
  }, []);
  useEffect(() => {
    const markerClass = "qc-permissions-remove-cover-actions";

    const removeCoverActions = () => {
      const roots = Array.from(
        document.querySelectorAll(".profile-permissions-page, .qc-profile-permissions-page")
      );

      for (const root of roots) {
        const actions = Array.from(root.querySelectorAll("button, a"));

        for (const action of actions) {
          const text = (action.textContent || "").trim().toLowerCase();
          const title = (action.getAttribute("title") || "").trim().toLowerCase();
          const aria = (action.getAttribute("aria-label") || "").trim().toLowerCase();

          const label = [text, title, aria].join(" ");

          const shouldHide =
            label.includes("permissões por usuário") ||
            label.includes("permissoes por usuario") ||
            label.includes("atualizar") ||
            label.includes("recarregar") ||
            label.includes("refresh");

          if (shouldHide) {
            action.classList.add(markerClass);
          }
        }
      }
    };

    removeCoverActions();

    const observer = new MutationObserver(removeCoverActions);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });

    return () => {
      observer.disconnect();
      document
        .querySelectorAll("." + markerClass)
        .forEach((node) => node.classList.remove(markerClass));
    };
  }, []);
  useEffect(() => {
    const markerClass = "qc-permissions-history-icon-modal";

    const syncHistoryButton = () => {
      const roots = Array.from(
        document.querySelectorAll(".profile-permissions-page, .qc-profile-permissions-page")
      );

      for (const root of roots) {
        const actions = Array.from(root.querySelectorAll("button, a"));

        const historyActions = actions.filter((action) => {
          const label = (action.textContent || "").trim().toLowerCase();
          const title = (action.getAttribute("title") || "").trim().toLowerCase();
          const aria = (action.getAttribute("aria-label") || "").trim().toLowerCase();

          return [label, title, aria].join(" ").includes("histórico");
        });

        const mainHistory = historyActions.find((action) =>
          action.closest(".permissions-profile-hero-unified, .permissions-profile-panel")
        ) ?? historyActions[0];

        for (const action of historyActions) {
          action.classList.remove("qc-permissions-history-icon-only");
          action.classList.remove("qc-permissions-history-extra-hidden");

          if (action === mainHistory) {
            action.classList.add("qc-permissions-history-icon-only");
            action.setAttribute("aria-label", "Histórico");
            action.setAttribute("title", "Histórico");
          } else {
            action.classList.add("qc-permissions-history-extra-hidden");
          }
        }
      }
    };

    syncHistoryButton();

    const observer = new MutationObserver(syncHistoryButton);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });

    return () => {
      observer.disconnect();

      document
        .querySelectorAll(".qc-permissions-history-icon-only, .qc-permissions-history-extra-hidden")
        .forEach((node) => {
          node.classList.remove("qc-permissions-history-icon-only");
          node.classList.remove("qc-permissions-history-extra-hidden");
        });
    };
  }, []);


  if (loading) return <AccessDeniedState state="loading" />;

  if (!canView) {
    return (
      <AccessDeniedState
        moduleName="Perfis e Permissões"
        requiredPermission="permissions:view"
        title="Acesso restrito"
        description="A visão de permissões por perfil exige permissão administrativa."
      />
    );
  }

  const sortMark = sortDirection === "asc" ? "?" : "?";

  return (
    <main data-history-open={historyPanelOpen ? "true" : "false"} className="profile-permissions-page qc-profile-permissions-page qc-profile-permissions-page profile-permissions-page min-h-screen bg-[#f8fafc] px-4 py-0 text-[#0f172a] lg:px-6">
      <div className="flex w-full max-w-none flex-col gap-4">
        <section className="permissions-profile-panel permissions-profile-hero-unified permissions-profile-hero-unified permissions-profile-cover-content rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#011848]">
                <FiShield className="h-4 w-4" />
                Gestão de permissões
              </div>

              <h1 className="text-2xl font-black tracking-tight text-[#0f172a] xl:text-3xl">
                Gestão de permissões por perfil
              </h1>

              <p className="mt-1 max-w-6xl text-sm font-semibold text-slate-500">
                Defina o padrão de acesso por perfil. Ajustes individuais ficam separados para não misturar regra global com exceção por usuário.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                  type="button"
                  onClick={() => setHistoryPanelOpen((current) => !current)}
                  className="permissions-hero-history-toggle inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:border-[#011848] hover:text-[#011848]"
                >
                  {historyPanelOpen ? "Fechar histórico" : "Histórico"}
                </button>

                <Link
                  href="/admin/users/permissions"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:border-[#011848] hover:text-[#011848]"
              >
                <FiUsers className="h-3.5 w-3.5" />
                Permissões por usuário
              </Link>

              <button
                type="button"
                onClick={handleReset}
                disabled={!canReset || saving || loadingProfile}
                title="Restaurar padrão" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700 transition hover:border-[#ef0001] hover:text-[#ef0001] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiRotateCcw className="h-3.5 w-3.5" />
                <span className="sr-only">Restaurar padrão</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={!canEdit || saving || loadingProfile || !hasDraftChanges}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#011848] px-4 text-xs font-black text-white transition hover:bg-[#0b245f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiSave className="h-3.5 w-3.5" />
                {saving ? "Salvando..." : hasDraftChanges ? "Salvar alterações" : "Tudo salvo"}
              </button>
            </div>
          </div>

          <div className="permissions-profile-metrics mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Permissões ativas", value: effectivePermissionCount },
              { label: "Módulos visíveis", value: visibleModuleCount },
              { label: "Módulos ocultos", value: hiddenModuleCount },
              { label: "Ajustes no padrão", value: overriddenCount },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-1 text-2xl font-black text-[#011848]">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {historyPanelOpen ? (
          <section className="profile-permissions-history permissions-history-panel permissions-history-panel rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              <FiClock className="h-4 w-4" />
              Histórico do perfil
            </div>

            <div className="mt-4 space-y-3">
              {visibleHistoryItems.map((item) => (
                <div key={`${item.title}-${item.date}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-black text-[#0f172a]">{item.title}</p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{item.description}</p>
                  <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-slate-400">{item.date}</p>
                </div>
              ))}
            </div>

            {historyItems.length > 2 ? (
              <button
                type="button"
                onClick={() => setShowFullHistory((current) => !current)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-[#011848] hover:text-[#011848]"
              >
                {showFullHistory ? "Ver menos" : "Ver mais histórico"}
              </button>
            ) : null}

            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold leading-relaxed text-[#011848]">
              <strong>Regra:</strong> esta tela define o padrão do perfil. Exceções individuais ficam em permissões por usuário e não alteram o padrão global.
            </div>
          </section>
        ) : null}

        <section className="permissions-profile-type-grid grid gap-3 xl:grid-cols-5">
          {roleCards.map((card) => {
            const selected = selectedRole === card.role;

            return (
              <button
                key={card.role}
                type="button"
                onClick={() => handleSelectRole(card.role)}
                className={[
                  "rounded-3xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                  selected ? `${card.details.tone} ring-2 ring-[#011848]/10` : "border-slate-200 bg-white text-slate-800",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide opacity-70">{card.details.scope}</p>
                    <h2 className="mt-1 text-lg font-black">{card.details.title}</h2>
                  </div>

                  {selected ? (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[#011848] text-white">
                      <FiCheck className="h-4 w-4" />
                    </span>
                  ) : (
                    <FiChevronRight className="mt-1 h-4 w-4 opacity-40" />
                  )}
                </div>

                <p className="mt-3 min-h-12 text-xs font-semibold leading-relaxed opacity-75">{card.details.description}</p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-white/60 bg-white/70 px-3 py-2">
                    <p className="text-[10px] font-black uppercase opacity-60">Módulos</p>
                    <p className="text-lg font-black">{card.visibleModules}</p>
                  </div>

                  <div className="rounded-2xl border border-white/60 bg-white/70 px-3 py-2">
                    <p className="text-[10px] font-black uppercase opacity-60">Ações</p>
                    <p className="text-lg font-black">{card.activeActions}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        {notice.type !== "idle" ? (
          <section
            className={[
              "rounded-2xl border px-4 py-3 text-sm font-semibold",
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800",
            ].join(" ")}
          >
            <div className="flex gap-2">
              {notice.type === "success" ? (
                <FiCheck className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{notice.message}</span>
            </div>
          </section>
        ) : null}

        <section className="permissions-profile-content-grid grid gap-4">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
                <div>
                  <h2 className="text-lg font-black text-[#0f172a]">
                    Gestão de permissões por perfil — {getFixedProfileLabel(selectedRole)}
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Controle das permissões padrão do perfil, com módulos, ações, rotas e ajustes.
                  </p>
                </div>

                <div className="permissions-list-toolbar flex w-full flex-col gap-2 2xl:max-w-none">
                  <label className="permissions-smart-search flex h-12 w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4">
                    <FiSearch className="h-4 w-4 shrink-0 text-slate-500" />
                    <input
                      type="search"
                      list="permissions-search-suggestions"
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Buscar módulo, rota, ação ou permissão..."
                      className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                    />
                  </label>

                  <datalist id="permissions-search-suggestions">
                    {searchSuggestions.map((suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ))}
                  </datalist>

                  <span className="text-xs font-semibold text-slate-500">
                    Ordene clicando nas colunas da listagem.
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left">
                <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 px-4 py-3"></th>
                    <th className="px-4 py-3">
                      <button type="button" onClick={() => handleToggleSort("module")}>
                        Módulo {sortKey === "module" ? sortMark : ""}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button type="button" onClick={() => handleToggleSort("status")}>
                        Status {sortKey === "status" ? sortMark : ""}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button type="button" onClick={() => handleToggleSort("actions")}>
                        Ações {sortKey === "actions" ? sortMark : ""}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button type="button" onClick={() => handleToggleSort("routes")}>
                        Rotas {sortKey === "routes" ? sortMark : ""}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button type="button" onClick={() => handleToggleSort("changes")}>
                        Ajustes {sortKey === "changes" ? sortMark : ""}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">Controle</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {pageRows.map((row) => {
                    const { module, state, routes, changedActions } = row;
                    const StateIcon = state.icon;
                    const expanded = expandedModuleId === permissionModule.id;

                    return (
                      <Fragment key={row.permissionModule.id}>
                        <tr key={permissionModule.id} className="bg-white align-top hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setExpandedModuleId(expanded ? null : permissionModule.id)}
                              className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-[#011848] hover:text-[#011848]"
                            >
                              {expanded ? <FiChevronDown className="h-4 w-4" /> : <FiChevronRight className="h-4 w-4" />}
                            </button>
                          </td>

                          <td className="px-4 py-3">
                            <p className="text-sm font-black text-[#0f172a]">{permissionModule.label}</p>
                            <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-slate-500">
                              {permissionModule.description}
                            </p>
                            <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
                              {permissionModule.id}
                            </p>
                          </td>

                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${state.tone}`}>
                              <StateIcon className="h-3.5 w-3.5" />
                              {state.label}
                            </span>
                            <p className="mt-2 max-w-56 text-[11px] font-semibold leading-relaxed text-slate-500">
                              {state.explanation}
                            </p>
                          </td>

                          <td className="px-4 py-3">
                            <p className="text-sm font-black text-slate-700">
                              {state.allowed}/{state.total}
                            </p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-400">ações liberadas</p>
                          </td>

                          <td className="px-4 py-3">
                            <p className="text-sm font-black text-slate-700">{routes.length}</p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-400">rotas mapeadas</p>
                          </td>

                          <td className="px-4 py-3">
                            {changedActions ? (
                              <span className="rounded-full border border-[#011848]/20 bg-[#011848]/5 px-2.5 py-1 text-xs font-black text-[#011848]">
                                {changedActions} ajuste{changedActions > 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                                Padrão
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleModuleToggle(module, true)}
                                disabled={!canEdit || loadingProfile || saving}
                                className="h-8 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Ativar
                              </button>

                              <button
                                type="button"
                                onClick={() => handleModuleToggle(module, false)}
                                disabled={!canEdit || loadingProfile || saving}
                                className="h-8 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Desativar
                              </button>
                            </div>
                          </td>
                        </tr>

                        {expanded ? (
                          <tr key={`${permissionModule.id}-details`} className="bg-slate-50">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <h3 className="text-sm font-black text-[#0f172a]">Permissões usadas pelo módulo</h3>
                                  <p className="mt-1 text-xs font-semibold text-slate-500">
                                    Controle fino das ações que aparecem como botão, rota, leitura ou operação.
                                  </p>

                                  <div className="mt-4 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                                    {permissionModule.actions.map((action) => {
                                      const checked = hasPermissionAccess(effectivePermissions, permissionModule.id, action);
                                      const baseChecked = hasPermissionAccess(systemDefaults, permissionModule.id, action);
                                      const changed = checked !== baseChecked;

                                      return (
                                        <button
                                          key={`${permissionModule.id}-${action}`}
                                          type="button"
                                          onClick={() => handleToggle(permissionModule.id, action, !checked)}
                                          disabled={!canEdit || loadingProfile || saving}
                                          className={[
                                            "flex min-h-10 items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 text-left text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50",
                                            checked ? "border-emerald-200 text-emerald-800" : "border-slate-200 text-slate-500",
                                            changed ? "ring-2 ring-[#011848]/10" : "",
                                          ].join(" ")}
                                        >
                                          <span className="truncate">{getActionLabel(action)}</span>
                                          <span
                                            className={[
                                              "shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase",
                                              checked ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
                                            ].join(" ")}
                                          >
                                            {checked ? "Ativo" : "Off"}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </section>

                                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <h3 className="text-sm font-black text-[#0f172a]">Rotas e telas impactadas</h3>
                                  <p className="mt-1 text-xs font-semibold text-slate-500">
                                    Onde este módulo aparece no mapa de navegação e qual permissão a rota usa.
                                  </p>

                                  <div className="mt-4 grid max-h-80 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                                    {routes.length ? (
                                      routes.map((route) => {
                                        const requiredPermission = getRoutePermission(route);
                                        const path = getRouteValue(route, "path");
                                        const label = getRouteValue(route, "label");
                                        const description = getRouteValue(route, "description");
                                        const mainFile = getRouteValue(route, "mainFile");
                                        const status = getRouteValue(route, "status");

                                        return (
                                          <div key={`${permissionModule.id}-${path}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                            <div className="flex items-center justify-between gap-2">
                                              <p className="truncate text-xs font-black text-[#0f172a]">{label || path}</p>
                                              {status ? (
                                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase text-slate-500">
                                                  {status}
                                                </span>
                                              ) : null}
                                            </div>

                                            <p className="mt-1 line-clamp-2 text-[11px] font-semibold text-slate-500">
                                              {description || "Sem descrição."}
                                            </p>

                                            <div className="mt-2 grid gap-1 text-[11px] font-semibold text-slate-500">
                                              <span>
                                                <strong className="text-slate-700">Rota:</strong> {path || "-"}
                                              </span>
                                              <span>
                                                <strong className="text-slate-700">Permissão:</strong>{" "}
                                                {requiredPermission.moduleId || permissionModule.id}:{requiredPermission.action || "view"}
                                              </span>
                                              <span className="truncate">
                                                <strong className="text-slate-700">Arquivo:</strong> {mainFile || "Não mapeado"}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-500">
                                        Nenhuma rota direta mapeada. Componentes e botões que usam <strong>{permissionModule.id}</strong> devem respeitar o perfil.
                                      </div>
                                    )}
                                  </div>
                                </section>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}

                  {!pageRows.length ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                        Nenhum módulo encontrado.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="permissions-pagination-footer flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-xs font-bold text-slate-500 md:flex-row md:items-center md:justify-center">
              <span>
                Exibindo {pageRows.length ? (currentPage - 1) * pageSize + 1 : 0}–
                {Math.min(currentPage * pageSize, sortedRows.length)} de {sortedRows.length} módulos
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

          
        </section>
      </div>
    </main>
  );
}













