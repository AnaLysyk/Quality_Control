"use client";

import Link from "next/link";
import { useMemo } from "react";
import { FiArrowRight, FiBookOpen, FiLayers, FiLock, FiShield } from "react-icons/fi";

import { useAppShellCoverSlot } from "@/components/AppShellCoverSlotContext";
import { RequireAuth } from "@/components/RequireAuth";
import { useClientContext } from "@/context/ClientContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { resolveAutomationAccess } from "@/lib/automations/access";

import { AutomationModuleProvider } from "./AutomationModuleContext";
import AutomationModuleSidebar from "./AutomationModuleSidebar";

function Skeleton() {
  return (
    <div className="w-full bg-(--page-bg,#f3f6fb) px-4 pt-4 pb-8 sm:px-6 lg:px-10 xl:px-12 2xl:px-14">
      <div className="space-y-4 2xl:grid 2xl:grid-cols-[240px_minmax(0,1fr)] 2xl:gap-4 2xl:space-y-0">
        <div className="h-40 animate-pulse rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) 2xl:h-64" />
        <div className="h-[520px] animate-pulse rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff)" />
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="space-y-4 2xl:grid 2xl:grid-cols-[240px_minmax(0,1fr)] 2xl:gap-4 2xl:space-y-0">
      <aside className="hidden 2xl:block">
        <div className="h-64 rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff)" />
      </aside>
      <section className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#011848,#ef0001)] text-white">
          <FiLock className="h-6 w-6" />
        </div>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent,#ef0001)">Acesso restrito</p>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">Módulo interno de automações</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-(--tc-text-secondary,#4b5563)">
          Esse workspace foi desenhado para operação técnica da Testing Company. Perfis de empresa e usuário da empresa continuam usando os próprios
          documentos, repositórios e telas da organização sem acesso aos fluxos internos.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/documentos"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-(--tc-primary,#011848) px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Abrir documentos
            <FiArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/docs"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-5 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
          >
            Ver base documental
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function AutomationModuleLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthUser();
  const { clients, activeClient } = useClientContext();
  const access = useMemo(() => resolveAutomationAccess(user, clients.length), [user, clients.length]);

  const coverContent = useMemo(
    () => (
      <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
        <Link
          href="/docs"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#ffffff] px-5 py-2 text-center text-sm font-bold text-[#011848] shadow-[0_2px_12px_rgba(0,0,0,0.18)] transition-colors hover:bg-[#f0f4ff] sm:justify-start"
        >
          <FiBookOpen className="h-4 w-4 shrink-0" />
          Abrir documentação do código
        </Link>
        <div className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-center text-sm font-semibold leading-5 text-white/92">
          <FiShield className="h-4 w-4 shrink-0" />
          <span className="wrap-break-word">
            {access.profileLabel}: {access.scopeLabel}
          </span>
        </div>
        <div className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-center text-sm font-semibold leading-5 text-white/92">
          <FiLayers className="h-4 w-4 shrink-0" />
          <span>{clients.length} empresa{clients.length === 1 ? "" : "s"} visíveis</span>
        </div>
      </div>
    ),
    [access.profileLabel, access.scopeLabel, clients.length],
  );

  useAppShellCoverSlot(coverContent);

  return (
    <RequireAuth fallback={<Skeleton />}>
      <AutomationModuleProvider value={{ access, activeClient, clients }}>
        <div className="w-full bg-(--page-bg,#f3f6fb) px-4 pt-4 pb-8 text-(--page-text,#0b1a3c) sm:px-6 lg:px-10 xl:px-12 2xl:px-14">
          {!access.canOpen ? (
            <AccessDenied />
          ) : (
            <div className="space-y-4 2xl:grid 2xl:grid-cols-[240px_minmax(0,1fr)] 2xl:items-start 2xl:gap-4 2xl:space-y-0">
              <AutomationModuleSidebar />
              <main className="min-w-0 w-full">{children}</main>
            </div>
          )}
        </div>
      </AutomationModuleProvider>
    </RequireAuth>
  );
}
