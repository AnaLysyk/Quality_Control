"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiArrowRight,
  FiBarChart2,
  FiBriefcase,
  FiClipboard,
  FiColumns,
  FiGrid,
  FiList,
  FiSearch,
  FiShield,
} from "react-icons/fi";

import { CompanySelector } from "../components/CompanySelector";
import { useClientContext } from "@/context/ClientContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useI18n } from "@/hooks/useI18n";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";

type OperationContextItem = {
  key: string;
  route: string;
  label: string;
  description: string;
  icon: typeof FiGrid;
};

type CompanyRouteInput = {
  isGlobalAdmin: boolean;
  permissionRole: string | null;
  role: string | null;
  companyRole: string | null;
  userOrigin: string | null;
  companyCount: number;
  clientSlug: string | null;
  defaultClientSlug: string | null;
};

export default function RunsIndexPage() {
  const { t } = useI18n();
  const { user } = useAuthUser();
  const { clients, activeClientSlug } = useClientContext();
  const searchParams = useSearchParams();
  const [contextQuery, setContextQuery] = useState("");

  const selectedCompanySlug =
    searchParams.get("companySlug") ?? activeClientSlug ?? user?.clientSlug ?? user?.defaultClientSlug ?? null;
  const selectedCompany = clients.find((company) => company.slug === selectedCompanySlug) ?? null;

  const companyRouteInput: CompanyRouteInput = {
    isGlobalAdmin: user?.isGlobalAdmin === true,
    permissionRole: user?.permissionRole ?? null,
    role: user?.role ?? null,
    companyRole: user?.companyRole ?? null,
    userOrigin:
      (user as { userOrigin?: string | null } | null)?.userOrigin ??
      (user as { user_origin?: string | null } | null)?.user_origin ??
      null,
    companyCount: clients.length,
    clientSlug: user?.clientSlug ?? null,
    defaultClientSlug: user?.defaultClientSlug ?? null,
  };

  const operationContexts: OperationContextItem[] = [
    {
      key: "dashboard",
      route: "dashboard",
      label: t("nav.dashboard"),
      description: t("operationsPage.contexts.dashboard"),
      icon: FiGrid,
    },
    {
      key: "applications",
      route: "aplicacoes",
      label: t("nav.apps"),
      description: t("operationsPage.contexts.apps"),
      icon: FiBriefcase,
    },
    {
      key: "runs",
      route: "runs",
      label: t("nav.runs"),
      description: t("operationsPage.contexts.runs"),
      icon: FiList,
    },
    {
      key: "test-plans",
      route: "planos-de-teste",
      label: t("nav.testPlans"),
      description: t("operationsPage.contexts.testPlans"),
      icon: FiClipboard,
    },
    {
      key: "defects",
      route: "defeitos",
      label: t("nav.defects"),
      description: t("operationsPage.contexts.defects"),
      icon: FiAlertTriangle,
    },
    {
      key: "support",
      route: "chamados",
      label: t("nav.support"),
      description: t("operationsPage.contexts.support"),
      icon: FiColumns,
    },
    {
      key: "metrics",
      route: "metrics",
      label: t("nav.metrics"),
      description: t("operationsPage.contexts.metrics"),
      icon: FiBarChart2,
    },
  ];

  const visibleContexts = useMemo(() => {
    const normalizedQuery = contextQuery.trim().toLowerCase();
    if (!normalizedQuery) return operationContexts;
    return operationContexts.filter((context) => {
      const haystack = `${context.label} ${context.description}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [contextQuery, operationContexts]);

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) px-4 py-8 text-(--page-text,#0b1a3c) sm:px-6 md:px-10 md:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="overflow-hidden rounded-4xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-accent,#ef0001)">
            <FiGrid className="h-4 w-4" />
            {t("operationsPage.kicker")}
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
            <div className="space-y-4">
              <h1 className="text-3xl font-black tracking-tight text-(--tc-text,#0b1a3c) md:text-4xl">
                {t("operationsPage.title")}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-(--tc-text-secondary,#4b5563) md:text-base">
                {t("operationsPage.subtitle")}
              </p>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-(--tc-text,#0b1a3c)">
                  Empresa + contexto
                </span>
                <span className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-(--tc-text,#0b1a3c)">
                  Abre a tela real
                </span>
                <span className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-(--tc-text,#0b1a3c)">
                  Sem duplicar conteúdo
                </span>
              </div>

              <label className="mt-5 grid max-w-2xl gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                Buscar contexto
                <span className="relative">
                  <FiSearch className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-(--tc-text-muted,#6b7280)" />
                  <input
                    value={contextQuery}
                    onChange={(event) => setContextQuery(event.target.value)}
                    placeholder="Aplicações, Runs ou Planos de teste"
                    className="min-h-11 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) pr-4 pl-11 text-sm outline-none transition focus:border-(--tc-accent,#ef0001)"
                  />
                </span>
              </label>
            </div>

            <div className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">Como funciona</p>
              <p className="mt-3 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                Operação não recria conteúdo. Ela só escolhe empresa + contexto e abre a tela real correspondente.
              </p>
              <div className="mt-4 grid gap-2 text-sm font-medium text-(--tc-text,#0b1a3c)">
                <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-3 py-2">1. Selecione a empresa</div>
                <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-3 py-2">2. Selecione o contexto</div>
                <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-3 py-2">3. O sistema abre a tela existente</div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-4xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-sm sm:p-6">
          <CompanySelector
            title={t("operationsPage.companySelectorTitle")}
            description={t("operationsPage.companySelectorDescription")}
            buildHref={(company) => `/operacao?companySlug=${encodeURIComponent(company.clientSlug)}`}
            ctaLabel={t("operationsPage.selectCompanyCta")}
          />
        </section>

        <section className="space-y-4 rounded-4xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-accent,#ef0001)">
                {t("operationsPage.contextSectionTitle")}
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-(--tc-text,#0b1a3c)">
                {t("operationsPage.contextSectionTitle")}
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-(--tc-text-secondary,#4b5563)">
                {t("operationsPage.contextSectionDescription")}
              </p>
            </div>

            {selectedCompanySlug ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                <FiShield className="h-4 w-4 text-(--tc-accent,#ef0001)" />
                {selectedCompany?.name ?? selectedCompanySlug}
              </div>
            ) : null}
          </div>

          {selectedCompanySlug ? (
            visibleContexts.length > 0 ? (
              <div data-testid="operation-context-grid" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleContexts.map((context) => {
                const href = buildCompanyPathForAccess(selectedCompanySlug, context.route, companyRouteInput);

                return (
                  <Link
                    key={context.key}
                    href={href}
                    className="group flex h-full flex-col rounded-3xl border border-(--tc-border,#d7deea) bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-(--tc-accent,#ef0001)/50 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) text-(--tc-accent,#ef0001)">
                        <context.icon className="h-5 w-5" />
                      </span>
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-(--tc-text,#0b1a3c)">{context.label}</h3>
                        <p className="text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{context.description}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm font-semibold text-(--tc-accent,#ef0001)">
                      <span>{t("operationsPage.openContext")}</span>
                      <FiArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </div>

                    <p className="mt-2 break-all text-xs text-(--tc-text-muted,#6b7280)">{href}</p>
                  </Link>
                );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-5 py-6 text-sm text-(--tc-text-secondary,#4b5563)">
                Nenhum contexto encontrado para a busca atual.
              </div>
            )
          ) : (
            <div
              data-testid="operation-context-empty"
              className="rounded-3xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-5 py-6 text-sm text-(--tc-text-secondary,#4b5563)"
            >
              {t("operationsPage.noCompany")}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
