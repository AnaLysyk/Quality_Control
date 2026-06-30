"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { FiCheckCircle, FiCpu, FiGrid, FiLayers, FiLock, FiSearch, FiShield, FiUsers } from "react-icons/fi";
import Breadcrumb from "@/components/Breadcrumb";
import AccessDeniedState from "@/components/access/AccessDeniedState";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import { getFixedProfileLabel, getFixedProfileHint, getFixedProfileTone } from "@/lib/fixedProfilePresentation";

type ProfileAccess = "all" | "linked" | "company" | "project" | "own" | "none";

type ProfileModule = {
  id: string;
  name: string;
  description: string;
  scope: "Global" | "Empresa" | "Projeto" | "Usuário";
  access: Record<SystemRole, ProfileAccess>;
};

const PROFILE_ORDER: SystemRole[] = [
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
  SYSTEM_ROLES.TESTING_COMPANY_USER,
  SYSTEM_ROLES.EMPRESA,
  SYSTEM_ROLES.COMPANY_USER,
];

const PROFILE_MODULES: ProfileModule[] = [
  {
    id: "dashboard-global",
    name: "Visão geral global",
    description: "Dashboard consolidado da plataforma. Aparece sem empresa selecionada.",
    scope: "Global",
    access: {
      leader_tc: "all",
      technical_support: "all",
      testing_company_user: "none",
      empresa: "none",
      company_user: "none",
    },
  },
  {
    id: "dashboard-company",
    name: "Dashboard da empresa",
    description: "Indicadores da empresa ativa. O menu Dashboard muda para a empresa selecionada.",
    scope: "Empresa",
    access: {
      leader_tc: "all",
      technical_support: "all",
      testing_company_user: "linked",
      empresa: "company",
      company_user: "company",
    },
  },
  {
    id: "companies",
    name: "Empresas",
    description: "Seleção e consulta de empresas disponíveis para o perfil.",
    scope: "Empresa",
    access: {
      leader_tc: "all",
      technical_support: "all",
      testing_company_user: "linked",
      empresa: "company",
      company_user: "company",
    },
  },
  {
    id: "projects",
    name: "Projetos",
    description: "Projetos carregados depois da empresa selecionada.",
    scope: "Projeto",
    access: {
      leader_tc: "all",
      technical_support: "all",
      testing_company_user: "linked",
      empresa: "company",
      company_user: "company",
    },
  },
  {
    id: "quality",
    name: "Repositório de Testes",
    description: "Casos, planos, runs e defeitos. Só aparece com empresa ativa; casos usam projeto ativo.",
    scope: "Projeto",
    access: {
      leader_tc: "all",
      technical_support: "all",
      testing_company_user: "linked",
      empresa: "company",
      company_user: "company",
    },
  },
  {
    id: "documents",
    name: "Documentos",
    description: "Documentação contextual por projeto selecionado.",
    scope: "Projeto",
    access: {
      leader_tc: "all",
      technical_support: "all",
      testing_company_user: "linked",
      empresa: "company",
      company_user: "company",
    },
  },
  {
    id: "automation",
    name: "Automação",
    description: "Módulos operacionais de automação após selecionar empresa.",
    scope: "Empresa",
    access: {
      leader_tc: "all",
      technical_support: "all",
      testing_company_user: "linked",
      empresa: "company",
      company_user: "company",
    },
  },
  {
    id: "brain",
    name: "Brain",
    description: "Por perfil: liderança/suporte veem mapa; empresa e usuários veem Brain contextual.",
    scope: "Empresa",
    access: {
      leader_tc: "all",
      technical_support: "all",
      testing_company_user: "linked",
      empresa: "company",
      company_user: "company",
    },
  },
  {
    id: "requests",
    name: "Solicitações públicas",
    description: "Fila pública de solicitação de acesso, aceite, recusa e pedido de ajuste.",
    scope: "Global",
    access: {
      leader_tc: "all",
      technical_support: "all",
      testing_company_user: "none",
      empresa: "company",
      company_user: "none",
    },
  },
  {
    id: "users",
    name: "Gestão de usuários",
    description: "Criação e consulta de usuários conforme regra fixa de perfil.",
    scope: "Usuário",
    access: {
      leader_tc: "all",
      technical_support: "linked",
      testing_company_user: "none",
      empresa: "company",
      company_user: "none",
    },
  },
  {
    id: "audit",
    name: "Audit Logs",
    description: "Auditoria interna da plataforma para liderança e suporte técnico.",
    scope: "Global",
    access: {
      leader_tc: "all",
      technical_support: "all",
      testing_company_user: "none",
      empresa: "none",
      company_user: "none",
    },
  },
  {
    id: "support-chat-profile",
    name: "Suporte, Chat e Meu Perfil",
    description: "Áreas próprias do usuário autenticado.",
    scope: "Usuário",
    access: {
      leader_tc: "own",
      technical_support: "own",
      testing_company_user: "own",
      empresa: "own",
      company_user: "own",
    },
  },
];

const ACCESS_META: Record<ProfileAccess, { label: string; className: string }> = {
  all: { label: "Tudo", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  linked: { label: "Vinculado", className: "border-sky-200 bg-sky-50 text-sky-700" },
  company: { label: "Próprio", className: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700" },
  project: { label: "Projeto", className: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  own: { label: "Próprio", className: "border-slate-200 bg-slate-50 text-slate-700" },
  none: { label: "Não vê", className: "border-red-100 bg-red-50 text-red-600" },
};

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function AccessBadge({ access }: { access: ProfileAccess }) {
  const meta = ACCESS_META[access];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>;
}

function resolveCurrentRole(user: ReturnType<typeof usePermissionAccess>["user"], accessRole?: string | null) {
  return (
    normalizeLegacyRole(typeof user?.permissionRole === "string" ? user.permissionRole : null) ??
    normalizeLegacyRole(typeof user?.role === "string" ? user.role : null) ??
    normalizeLegacyRole(typeof user?.companyRole === "string" ? user.companyRole : null) ??
    normalizeLegacyRole(accessRole ?? null)
  );
}

export default function ProfileManagementPage() {
  const { user, accessContext, loading } = usePermissionAccess();
  const [query, setQuery] = useState("");
  const currentRole = resolveCurrentRole(user, accessContext?.role ?? null);
  const canView =
    user?.isGlobalAdmin === true ||
    currentRole === SYSTEM_ROLES.LEADER_TC ||
    currentRole === SYSTEM_ROLES.TECHNICAL_SUPPORT;

  const filteredModules = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return PROFILE_MODULES;
    return PROFILE_MODULES.filter((module) => {
      const haystack = normalizeText(`${module.name} ${module.description} ${module.scope}`);
      return haystack.includes(normalizedQuery);
    });
  }, [query]);

  if (loading) return <AccessDeniedState state="loading" />;

  if (!canView) {
    return (
      <AccessDeniedState
        moduleName="Gestão de Perfis"
        requiredPermission="leader_tc ou technical_support"
        title="Acesso restrito"
        description="A gestão de perfis é apenas para Líder TC e Suporte Técnico."
      />
    );
  }

  return (
    <main className="min-h-screen bg-(--page-bg,#f8fafc) px-3 py-4 text-(--page-text,#0b1a3c) sm:px-5 lg:px-7">
      <div className="mx-auto flex w-full max-w-550 flex-col gap-5">
        <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Gestão de Perfis" }]} />

        <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--tc-primary,#011848) text-white">
                <FiShield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-accent,#ef0001)">
                  Governança de acesso
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-[-0.03em] text-(--tc-text-primary,#0b1a3c) sm:text-3xl">
                  Gestão de Perfis
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                  Esta tela substitui a matriz livre de permissões. O comportamento passa a ser fixo por perfil,
                  empresa selecionada e projeto ativo.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-3">
                <div className="text-xs font-semibold text-(--tc-text-muted,#64748b)">Perfis</div>
                <div className="mt-1 text-2xl font-black">{PROFILE_ORDER.length}</div>
              </div>
              <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-3">
                <div className="text-xs font-semibold text-(--tc-text-muted,#64748b)">Módulos</div>
                <div className="mt-1 text-2xl font-black">{PROFILE_MODULES.length}</div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                <div className="text-xs font-semibold">Regra</div>
                <div className="mt-1 text-lg font-black">Fixa</div>
              </div>
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-indigo-800">
                <div className="text-xs font-semibold">Escopo</div>
                <div className="mt-1 text-lg font-black">Empresa</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-5">
          {PROFILE_ORDER.map((profile) => (
            <article key={profile} className={`rounded-3xl border p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] ${getFixedProfileTone(profile)}`}>
              <div className="flex items-center gap-2 text-sm font-black">
                <FiUsers className="h-4 w-4" />
                <span>{getFixedProfileLabel(profile, { short: true })}</span>
              </div>
              <p className="mt-2 text-xs leading-5 opacity-80">{getFixedProfileHint(profile)}</p>
            </article>
          ))}
        </section>

        <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-(--tc-text-primary,#0b1a3c)">Módulos por perfil</h2>
              <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">
                Visualização oficial do que cada perfil pode ver com a lógica atual.
              </p>
            </div>
            <label className="flex w-full items-center gap-3 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-3 lg:max-w-md">
              <FiSearch className="h-4 w-4 shrink-0 text-(--tc-text-muted,#64748b)" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar módulo, escopo ou regra..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-(--tc-text-muted,#94a3b8)"
                aria-label="Buscar módulo"
              />
            </label>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[980px] w-full border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.16em] text-(--tc-text-muted,#64748b)">
                  <th className="px-3 py-2">Módulo</th>
                  <th className="px-3 py-2">Escopo</th>
                  {PROFILE_ORDER.map((profile) => (
                    <th key={profile} className="px-3 py-2 text-center">{getFixedProfileLabel(profile, { short: true })}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredModules.map((module) => (
                  <tr key={module.id} className="rounded-2xl bg-(--tc-surface-alt,#f8fafc)">
                    <td className="rounded-l-2xl px-3 py-3 align-top">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-(--tc-primary,#011848)">
                          {module.id === "brain" ? <FiCpu /> : module.scope === "Projeto" ? <FiLayers /> : <FiGrid />}
                        </span>
                        <div>
                          <div className="font-black text-(--tc-text-primary,#0b1a3c)">{module.name}</div>
                          <div className="mt-1 max-w-xl text-xs leading-5 text-(--tc-text-secondary,#4b5563)">{module.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
                        {module.scope}
                      </span>
                    </td>
                    {PROFILE_ORDER.map((profile) => (
                      <td key={`${module.id}-${profile}`} className="px-3 py-3 text-center align-top">
                        <AccessBadge access={module.access[profile]} />
                      </td>
                    ))}
                    <td className="rounded-r-2xl p-0" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[24px] border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
          <div className="flex items-start gap-3">
            <FiCheckCircle className="mt-1 h-4 w-4 shrink-0" />
            <div>
              <strong>Regra de produto:</strong> não existe mais gestão livre de permissões. Líder TC e Suporte Técnico
              consultam a gestão de perfis para entender e validar a regra fixa. Ajustes de acesso devem ser feitos na lógica
              de perfil, vínculo de empresa e projeto selecionado.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
