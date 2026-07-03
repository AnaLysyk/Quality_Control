"use client";

import Link from "next/link";
import { FiArrowRight, FiChevronRight, FiGrid, FiHome, FiLayers } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";
import { CompanySelector } from "@/components/CompanySelector";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";
import { useNavigationItems } from "@/app/hooks/navigation/useNavigationItems";

function resolveModuleDescription(label: string, itemCount: number) {
  if (itemCount > 0) {
    return `${itemCount} opção${itemCount === 1 ? "" : "ões"} disponível${itemCount === 1 ? "" : "eis"} conforme suas permissões.`;
  }
  return `Acesso direto disponível conforme suas permissões.`;
}

function resolveModuleBadge(index: number) {
  if (index === 0) return "Principal";
  if (index === 1) return "Atalho";
  return "Menu";
}

export default function HomeContent() {
  const { user, loading: authLoading } = useAuthUser();
  const { clients, loading: clientsLoading } = useClientContext();
  const { modules, loading: navLoading, companySlug, effectiveRole } = useNavigationItems();
  const isLoggedOut = !user;
  const loading = authLoading || clientsLoading || navLoading;
  const visibleModules = modules.filter((module) => module.href || module.items.length > 0);
  const totalOptions = visibleModules.reduce((total, module) => total + (module.href ? 1 : 0) + module.items.length, 0);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-(--page-bg,#f8f8fb) to-(--page-bg,#f0f4ff) text-xl text-[var(--tc-text-muted,#6b7280)]">
        Carregando painel...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-(--page-bg,#f8f8fb) to-(--page-bg,#f0f4ff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-4xl border border-[var(--tc-border,#e5e7eb)] bg-white/85 p-6 shadow-xl backdrop-blur md:p-8 dark:border-white/10 dark:bg-slate-950/80">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#e5e7eb)] bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-[var(--tc-accent,#ef0001)] dark:border-white/10 dark:bg-white/5">
                <FiHome size={14} />
                Home
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-tight md:text-5xl">
                Painel das opções disponíveis
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)] dark:text-white/70">
                Esta tela espelha o menu lateral: aparece aqui somente o que está liberado para seu perfil, empresa e contexto atual.
              </p>
            </div>

            {!isLoggedOut && (
              <div className="grid min-w-64 gap-3 rounded-3xl border border-[var(--tc-border,#e5e7eb)] bg-white/70 p-4 text-sm shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--tc-text-muted,#6b7280)] dark:text-white/50">Perfil</span>
                  <strong className="text-right uppercase tracking-[0.16em]">{effectiveRole ?? user?.role ?? "usuário"}</strong>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--tc-text-muted,#6b7280)] dark:text-white/50">Empresa ativa</span>
                  <strong className="text-right">{companySlug ?? "sem empresa"}</strong>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--tc-text-muted,#6b7280)] dark:text-white/50">Opções</span>
                  <strong>{totalOptions}</strong>
                </div>
              </div>
            )}
          </div>

          {isLoggedOut && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl bg-[var(--tc-accent,#ef0001)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.32em] text-white shadow-[0_14px_30px_rgba(239,0,1,0.25)] transition hover:-translate-y-0.5 hover:bg-[var(--tc-accent-hover,#c80001)]"
              >
                Entrar
              </Link>
              <Link
                href="/login/access-request"
                className="inline-flex items-center justify-center rounded-xl border border-[var(--tc-border,#e5e7eb)] bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.32em] text-(--page-text,#0b1a3c) shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--tc-accent,#ef0001)] hover:text-[var(--tc-accent,#ef0001)]"
              >
                Solicitar acesso
              </Link>
            </div>
          )}
        </header>

        {!isLoggedOut && clients.length > 1 && (
          <section className="rounded-4xl border border-[var(--tc-border,#e5e7eb)] bg-white/85 p-6 shadow-xl dark:border-white/10 dark:bg-slate-950/80">
            <CompanySelector
              title="Trocar empresa ativa"
              description="A home muda junto com o contexto selecionado e mostra as opções disponíveis para aquela empresa."
              buildHref={(company) =>
                buildCompanyPathForAccess(company.clientSlug, "home", {
                  isGlobalAdmin: user?.isGlobalAdmin === true,
                  permissionRole: user?.permissionRole ?? null,
                  role: user?.role ?? null,
                  companyRole: user?.companyRole ?? null,
                  userOrigin:
                    (user as { userOrigin?: string | null } | null)?.userOrigin ??
                    (user as { user_origin?: string | null } | null)?.user_origin ??
                    null,
                  companyCount: clients.length,
                  clientSlug: company.clientSlug,
                })
              }
              ctaLabel={() => "Usar contexto"}
            />
          </section>
        )}

        <section className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-4xl border border-[var(--tc-border,#e5e7eb)] bg-white/85 p-6 shadow-xl dark:border-white/10 dark:bg-slate-950/80 lg:col-span-1">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-[var(--tc-accent,#ef0001)] text-white shadow-lg">
                <FiGrid size={20} />
              </span>
              <div>
                <h2 className="text-lg font-bold">Resumo do menu</h2>
                <p className="text-sm text-[var(--tc-text-muted,#6b7280)] dark:text-white/55">Tudo que aparece ao lado aparece aqui.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {visibleModules.map((module) => (
                <Link
                  key={module.id}
                  href={module.href ?? module.items[0]?.href ?? "#"}
                  className="group flex items-center justify-between rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white/75 px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-[var(--tc-accent,#ef0001)] hover:text-[var(--tc-accent,#ef0001)] dark:border-white/10 dark:bg-white/5"
                >
                  <span>{module.label}</span>
                  <FiChevronRight className="transition group-hover:translate-x-1" size={16} />
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:col-span-2">
            {visibleModules.map((module, index) => {
              const primaryHref = module.href ?? module.items[0]?.href ?? "#";
              return (
                <article
                  key={module.id}
                  className="flex min-h-72 flex-col rounded-4xl border border-[var(--tc-border,#e5e7eb)] bg-white/90 p-6 shadow-xl transition hover:-translate-y-1 hover:shadow-[0_30px_60px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-slate-950/80"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--tc-accent,#ef0001)]">
                        {resolveModuleBadge(index)}
                      </span>
                      <h2 className="mt-3 text-2xl font-black tracking-tight">{module.label}</h2>
                    </div>
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white text-[var(--tc-accent,#ef0001)] dark:border-white/10 dark:bg-white/5">
                      <FiLayers size={20} />
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)] dark:text-white/65">
                    {resolveModuleDescription(module.label, module.items.length)}
                  </p>

                  {module.items.length > 0 && (
                    <div className="mt-5 grid gap-2">
                      {module.items.slice(0, 5).map((item) => (
                        <Link
                          key={item.id}
                          href={item.href ?? primaryHref}
                          className="group flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-[var(--tc-text-secondary,#4b5563)] transition hover:bg-[var(--tc-accent,#ef0001)] hover:text-white dark:bg-white/5 dark:text-white/70"
                        >
                          <span>{item.label}</span>
                          <FiArrowRight className="transition group-hover:translate-x-1" size={15} />
                        </Link>
                      ))}
                      {module.items.length > 5 && (
                        <span className="px-4 pt-1 text-xs font-semibold text-[var(--tc-text-muted,#6b7280)] dark:text-white/45">
                          + {module.items.length - 5} opção{module.items.length - 5 === 1 ? "" : "ões"} no menu lateral
                        </span>
                      )}
                    </div>
                  )}

                  <Link
                    href={primaryHref}
                    className="mt-auto inline-flex items-center gap-2 pt-6 text-xs font-black uppercase tracking-[0.32em] text-[var(--tc-accent,#ef0001)] transition hover:gap-3"
                  >
                    Abrir módulo
                    <FiArrowRight size={15} />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        {!isLoggedOut && visibleModules.length === 0 && (
          <section className="rounded-4xl border border-dashed border-[var(--tc-border,#e5e7eb)] bg-white/85 p-8 text-center shadow-xl dark:border-white/10 dark:bg-slate-950/80">
            <h2 className="text-2xl font-bold">Nenhuma opção liberada</h2>
            <p className="mt-2 text-sm text-[var(--tc-text-secondary,#4b5563)] dark:text-white/65">
              Assim que a Gestão de Perfis liberar módulos para seu usuário, eles aparecerão aqui e no menu lateral.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
