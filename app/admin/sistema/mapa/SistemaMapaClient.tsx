"use client";

import { useMemo, useState } from "react";
import { FiMap, FiSearch, FiX } from "react-icons/fi";

import Breadcrumb from "@/components/Breadcrumb";
import AccessDeniedState from "@/components/access/AccessDeniedState";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import type { SystemRole } from "@/lib/auth/roles";
import type {
  SystemMapStatus,
  SystemModuleDefinition,
  SystemPermission,
  SystemRouteDefinition,
} from "@/lib/navigation/navigation.types";
import { canAccess } from "@/lib/permissions/can-access";

type SistemaMapaClientProps = {
  modules: readonly SystemModuleDefinition[];
  routes: readonly SystemRouteDefinition[];
};

const STATUS_OPTIONS: Array<{ value: SystemMapStatus; label: string }> = [
  { value: "ativo", label: "Ativo" },
  { value: "parcial", label: "Parcial" },
  { value: "legado", label: "Legado" },
  { value: "oculto", label: "Oculto" },
  { value: "quebrado", label: "Quebrado" },
];

const STATUS_META: Record<SystemMapStatus, { label: string; className: string }> = {
  ativo: {
    label: "Ativo",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  parcial: {
    label: "Parcial",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  legado: {
    label: "Legado",
    className: "border-slate-300 bg-slate-100 text-slate-700",
  },
  oculto: {
    label: "Oculto",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  quebrado: {
    label: "Quebrado",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  disabled: { label: "Desativado", className: "border-slate-300 bg-slate-100 text-slate-600" },
};

const PROFILE_LABELS: Record<SystemRole, string> = {
  leader_tc: "LÃ­der TC",
  technical_support: "Suporte TÃ©cnico",
  testing_company_user: "UsuÃ¡rio TC",
  empresa: "Empresa",
  company_user: "UsuÃ¡rio da Empresa",
};

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatPermission(permission: SystemPermission | null) {
  return permission ? `${permission.moduleId}.${permission.action}` : "NÃ£o centralizada";
}

function StatusBadge({ status }: { status: SystemMapStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

export default function SistemaMapaClient({ modules, routes }: SistemaMapaClientProps) {
  const { accessContext, loading: accessLoading } = usePermissionAccess();
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");

  const moduleById = useMemo(
    () => new Map(modules.map((moduleDefinition) => [moduleDefinition.id, moduleDefinition])),
    [modules],
  );

  const filteredRoutes = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return routes.filter((routeDefinition) => {
      const moduleDefinition = moduleById.get(routeDefinition.moduleId);
      if (moduleFilter !== "todos" && routeDefinition.moduleId !== moduleFilter) return false;
      if (statusFilter !== "todos" && routeDefinition.status !== statusFilter) return false;
      if (!normalizedQuery) return true;

      const searchableContent = [
        moduleDefinition?.name ?? routeDefinition.moduleId,
        routeDefinition.label,
        routeDefinition.path,
        routeDefinition.description,
        formatPermission(routeDefinition.requiredPermission),
        routeDefinition.mainFile,
        routeDefinition.notes ?? "",
        ...routeDefinition.expectedProfiles.map((profile) => PROFILE_LABELS[profile]),
      ]
        .map(normalizeText)
        .join(" ");

      return searchableContent.includes(normalizedQuery);
    });
  }, [moduleById, moduleFilter, query, routes, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<SystemMapStatus, number> = {
      ativo: 0,
      parcial: 0,
      legado: 0,
      oculto: 0,
      quebrado: 0,
      disabled: 0,
    };
    for (const routeDefinition of routes) counts[routeDefinition.status] += 1;
    return counts;
  }, [routes]);

  const hasFilters = query.trim() || moduleFilter !== "todos" || statusFilter !== "todos";

  function clearFilters() {
    setQuery("");
    setModuleFilter("todos");
    setStatusFilter("todos");
  }

  if (accessLoading) {
    return <AccessDeniedState state="loading" />;
  }

  if (!canAccess(accessContext, "permissions.view")) {
    return (
      <AccessDeniedState
        moduleName="Mapa do Sistema"
        requiredPermission="permissions.view"
        title="Acesso negado"
        description="Seu perfil nÃ£o possui permissÃ£o para visualizar o mapa do sistema."
      />
    );
  }

  return (
    <main className="min-h-screen bg-(--page-bg,#f8fafc) px-3 py-4 text-(--page-text,#0b1a3c) sm:px-5 lg:px-7">
      <div className="mx-auto flex w-full max-w-550 flex-col gap-5">
        <Breadcrumb
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Sistema" },
            { label: "Mapa" },
          ]}
        />

        <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--tc-primary,#011848) text-[#011848] dark:text-white">
                <FiMap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-accent,#ef0001)">
                  GovernanÃ§a interna
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-[-0.03em] text-(--tc-text-primary,#0b1a3c) sm:text-3xl">
                  Mapa do Sistema
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                  Fonte de verdade inicial para mÃ³dulos, rotas, permissÃµes, perfis esperados e estado tÃ©cnico das telas.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-3">
                <div className="text-xs font-semibold text-(--tc-text-muted,#64748b)">MÃ³dulos</div>
                <div className="mt-1 text-2xl font-black">{modules.length}</div>
              </div>
              <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-3">
                <div className="text-xs font-semibold text-(--tc-text-muted,#64748b)">Rotas</div>
                <div className="mt-1 text-2xl font-black">{routes.length}</div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                <div className="text-xs font-semibold">Ativas</div>
                <div className="mt-1 text-2xl font-black">{statusCounts.ativo}</div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                <div className="text-xs font-semibold">Pendentes</div>
                <div className="mt-1 text-2xl font-black">
                  {routes.length - statusCounts.ativo}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_240px_200px_auto]">
            <label className="flex items-center gap-3 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-3">
              <FiSearch className="h-4 w-4 shrink-0 text-(--tc-text-muted,#64748b)" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar rota, arquivo, permissÃ£o..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-(--tc-text-muted,#94a3b8)"
                aria-label="Buscar no mapa do sistema"
              />
            </label>

            <select
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value)}
              className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-3 text-sm font-semibold outline-none"
              aria-label="Filtrar por mÃ³dulo"
            >
              <option value="todos">Todos os mÃ³dulos</option>
              {modules.map((moduleDefinition) => (
                <option key={moduleDefinition.id} value={moduleDefinition.id}>
                  {moduleDefinition.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-3 text-sm font-semibold outline-none"
              aria-label="Filtrar por status"
            >
              <option value="todos">Todos os status</option>
              {STATUS_OPTIONS.map((statusOption) => (
                <option key={statusOption.value} value={statusOption.value}>
                  {statusOption.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) px-4 py-3 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001) disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FiX className="h-4 w-4" />
              Limpar
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-(--tc-text-secondary,#4b5563)">
            <span>
              Exibindo <strong className="text-(--tc-text-primary,#0b1a3c)">{filteredRoutes.length}</strong> de{" "}
              {routes.length} rotas.
            </span>
            <span>Este mapa governa as rotas e permissÃµes usadas pelo menu.</span>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          {filteredRoutes.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <h2 className="text-lg font-bold">Nenhuma rota encontrada</h2>
              <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
                Ajuste os filtros ou limpe a busca para voltar ao mapa completo.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-400 w-full border-collapse text-left text-sm">
                <thead className="bg-(--tc-primary,#011848) text-[#011848] dark:text-white">
                  <tr>
                    <th className="px-4 py-4 font-semibold">MÃ³dulo</th>
                    <th className="px-4 py-4 font-semibold">Rota</th>
                    <th className="px-4 py-4 font-semibold">Nome</th>
                    <th className="px-4 py-4 font-semibold">PermissÃ£o</th>
                    <th className="px-4 py-4 font-semibold">Perfis esperados</th>
                    <th className="px-4 py-4 font-semibold">Status</th>
                    <th className="px-4 py-4 font-semibold">Arquivo</th>
                    <th className="px-4 py-4 font-semibold">ObservaÃ§Ã£o</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--tc-border,#e2e8f0)">
                  {filteredRoutes.map((routeDefinition) => {
                    const moduleDefinition = moduleById.get(routeDefinition.moduleId);
                    return (
                      <tr
                        key={routeDefinition.id}
                        className="align-top transition hover:bg-(--tc-surface-alt,#f8fafc)"
                      >
                        <td className="px-4 py-4">
                          <div className="font-bold text-(--tc-text-primary,#0b1a3c)">
                            {moduleDefinition?.name ?? routeDefinition.moduleId}
                          </div>
                          <div className="mt-1 text-xs text-(--tc-text-muted,#64748b)">
                            {routeDefinition.id}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <code className="break-all rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-800">
                            {routeDefinition.path}
                          </code>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-(--tc-text-primary,#0b1a3c)">
                            {routeDefinition.label}
                          </div>
                          <p className="mt-1 min-w-60 leading-5 text-(--tc-text-secondary,#4b5563)">
                            {routeDefinition.description}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <code
                            className={`rounded-lg px-2 py-1 text-xs ${
                              routeDefinition.requiredPermission
                                ? "bg-blue-50 text-blue-800"
                                : "bg-amber-50 text-amber-800"
                            }`}
                          >
                            {formatPermission(routeDefinition.requiredPermission)}
                          </code>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex min-w-52 flex-wrap gap-1.5">
                            {routeDefinition.expectedProfiles.map((profile) => (
                              <span
                                key={profile}
                                className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-2 py-1 text-xs font-medium"
                              >
                                {PROFILE_LABELS[profile]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={routeDefinition.status} />
                        </td>
                        <td className="px-4 py-4">
                          <code className="block min-w-64 break-all text-xs leading-5 text-(--tc-text-secondary,#4b5563)">
                            {routeDefinition.mainFile}
                          </code>
                        </td>
                        <td className="px-4 py-4">
                          <p className="min-w-64 leading-5 text-(--tc-text-secondary,#4b5563)">
                            {routeDefinition.notes ?? "Sem observaÃ§Ã£o."}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

