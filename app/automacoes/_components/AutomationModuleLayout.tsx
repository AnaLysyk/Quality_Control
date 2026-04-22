"use client";

import { useMemo } from "react";
import Link from "next/link";
import { FiArrowRight, FiChevronDown, FiGlobe, FiGrid, FiLayers, FiLock } from "react-icons/fi";

import { RequireAuth } from "@/components/RequireAuth";
import { useClientContext } from "@/context/ClientContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { resolveAutomationAccess } from "@/lib/automations/access";

import { AutomationModuleProvider } from "./AutomationModuleContext";
import AutomationModuleSidebar from "./AutomationModuleSidebar";

function Skeleton() {
  return (
    <div className="h-full w-full space-y-4 p-6">
      <div className="h-10 animate-pulse rounded-2xl bg-(--tc-surface,#ffffff)" />
      <div className="h-64 animate-pulse rounded-2xl bg-(--tc-surface,#ffffff)" />
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <section className="max-w-lg rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-8 shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#011848,#ef0001)] text-white">
          <FiLock className="h-6 w-6" />
        </div>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent,#ef0001)">
          Acesso restrito
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">
          Modulo interno de automacoes
        </h2>
        <p className="mt-3 text-sm leading-7 text-(--tc-text-secondary,#4b5563)">
          Esse workspace foi desenhado para operacao tecnica da Testing Company.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/documentos"
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-(--tc-primary,#011848) px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Abrir documentos
            <FiArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function AutomationModuleLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthUser();
  const { clients, activeClient, activeClientSlug, loading: clientsLoading, setActiveClientSlug } = useClientContext();
  const access = useMemo(() => resolveAutomationAccess(user, clients.length), [user, clients.length]);

  return (
    <RequireAuth fallback={<Skeleton />}>
      <AutomationModuleProvider value={{ access, activeClient, clients }}>
        <main className="relative h-full min-h-0 w-full flex flex-col overflow-hidden bg-[#f3f6fb] dark:bg-[#08111d]">
          <div className="shrink-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-slate-950/90">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#ef0001]">
                  Automacao
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    <FiGrid className="h-3.5 w-3.5 text-[#ef0001]" />
                    {access.profileLabel}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    <FiLayers className="h-3.5 w-3.5 text-[#ef0001]" />
                    {access.scopeLabel}
                  </span>
                </div>
              </div>

              <div className="flex min-w-0 flex-wrap items-start justify-end gap-2 sm:gap-3">
                <label className="flex min-w-0 flex-col gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400 sm:w-[18rem] sm:flex-none">
                    Empresa ativa
                    <div className="relative w-full">
                      <FiGlobe className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                      <select
                        value={activeClientSlug ?? ""}
                        onChange={(event) => setActiveClientSlug(event.target.value || null)}
                        disabled={clientsLoading || clients.length === 0}
                        className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-9 pr-8 text-sm font-semibold leading-none text-slate-800 outline-none transition focus:border-[#ef0001] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:focus:border-red-500"
                      >
                        {access.hasGlobalCompanyVisibility ? <option value="">Todas as empresas</option> : null}
                        {clients.length === 0 ? (
                          <option value="">Nenhuma empresa disponivel</option>
                        ) : (
                          clients.map((company) => (
                            <option key={company.slug} value={company.slug}>
                              {company.name}
                            </option>
                          ))
                        )}
                      </select>
                      <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                    </div>
                </label>
              </div>
            </div>
          </div>
          {!access.canOpen ? (
            <AccessDenied />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {children}
            </div>
          )}
          <AutomationModuleSidebar />
        </main>
      </AutomationModuleProvider>
    </RequireAuth>
  );
}
