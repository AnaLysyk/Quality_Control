"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiArrowRight, FiBookOpen, FiFolder, FiShield, FiUsers, FiEdit3 } from "react-icons/fi";

import { useAppShellCoverSlot } from "@/components/AppShellCoverSlotContext";
import { RequireAuth } from "@/components/RequireAuth";
import { useClientContext } from "@/context/ClientContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { buildCompanyPathForAccess, resolveCompanyRouteAccessInput } from "@/lib/companyRoutes";
import { fetchApi } from "@/lib/api";

function normalizeRole(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function resolveScopePresentation(user: ReturnType<typeof useAuthUser>["user"], companyCount: number) {
  const roles = [user?.permissionRole, user?.role, user?.companyRole].map(normalizeRole);
  const isLeader = roles.includes("leader_tc") || user?.isGlobalAdmin === true || user?.is_global_admin === true;
  const isSupport = roles.includes("technical_support");
  const isCompany = roles.includes("empresa") || roles.includes("company_user") || (user?.userOrigin ?? user?.user_origin) === "client_company";

  if (isLeader) return { profile: "Lider TC", scope: "Todas as empresas" };
  if (isSupport) return { profile: "Suporte tecnico", scope: "Todas as empresas" };
  if (isCompany) return { profile: "Empresa", scope: "Propria empresa" };
  return { profile: "Usuario TC", scope: "Empresas vinculadas" };
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

const SkeletonGrid = () => (
  <div className="grid w-full auto-rows-fr grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="rounded-[26px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-5">
        <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-5 h-6 w-2/3 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-3 h-4 w-24 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-6 h-20 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    ))}
  </div>
);

export default function DocumentosPage() {
  const { user, normalizedUser } = useAuthUser();
  const { clients, activeClientSlug, loading, setActiveClientSlug } = useClientContext();

  // Wiki docs state — company-scoped for company users, platform for others
  const isCompanyUser = ((): boolean => {
    const roles = [user?.permissionRole, user?.role, user?.companyRole].map((v) => (v ?? "").trim().toLowerCase());
    const isLeader = roles.includes("leader_tc") || user?.isGlobalAdmin === true || user?.is_global_admin === true;
    const isSupport = roles.includes("technical_support");
    if (isLeader || isSupport) return false;
    return roles.includes("empresa") || roles.includes("company_user") || (user?.userOrigin ?? user?.user_origin) === "client_company";
  })();

  const companySlug =
    activeClientSlug ??
    normalizedUser.primaryCompanySlug ??
    normalizedUser.defaultCompanySlug ??
    (clients.length === 1 ? clients[0]?.slug : null);
  const wikiApiPath = isCompanyUser && companySlug
    ? `/api/company-docs/${companySlug}`
    : null; // null = show overview link, no count fetch

  const [wikiDocCount, setWikiDocCount] = useState<number | null>(null);
  const [wikiCategoryCount, setWikiCategoryCount] = useState<number>(0);

  useEffect(() => {
    if (!wikiApiPath) return;
    fetchApi(wikiApiPath)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setWikiDocCount((d.docs as unknown[]).length);
          setWikiCategoryCount((d.categories as unknown[]).length);
        }
      })
      .catch(() => {/* ignore */});
  }, [wikiApiPath]);

  const routeInput = resolveCompanyRouteAccessInput({
    user,
    normalizedUser,
    companyCount: clients.length,
    clientSlug: companySlug,
  });

  const scope = resolveScopePresentation(user, clients.length);

  const wikiHref = isCompanyUser && companySlug
    ? `/empresas/${companySlug}/docs`
    : "/docs";

  const hasWikiContent = wikiDocCount !== null && wikiDocCount > 0;
  const wikiButtonLabel = isCompanyUser
    ? wikiDocCount === null
      ? "Repositório da empresa"
      : hasWikiContent
      ? `Repositório  •  ${wikiDocCount} doc${wikiDocCount === 1 ? "" : "s"}`
      : "Criar documentação"
    : "Repositórios das empresas";

  const coverContent = useMemo(
    () => (
      <div className="grid w-full max-w-full gap-2 lg:max-w-md lg:justify-items-end xl:max-w-none xl:grid-cols-[auto_auto] xl:items-start">
        <Link
          href={wikiHref}
          className="inline-flex items-center gap-2 min-h-10 px-5 py-2 rounded-xl bg-[#ffffff] text-[#011848] text-sm font-bold shadow-[0_2px_12px_rgba(0,0,0,0.18)] hover:bg-[#f0f4ff] transition-colors w-full max-w-full sm:w-auto xl:w-auto"
        >
          <FiBookOpen className="h-4 w-4 shrink-0" />
          {wikiButtonLabel}
        </Link>
        <div className="inline-flex min-h-10 w-full max-w-full items-center justify-center rounded-full border border-white/18 bg-white/10 px-4 py-2 text-center text-sm font-semibold leading-5 text-white/92 sm:w-auto xl:max-w-88">
          <FiShield className="mr-2 h-4 w-4 shrink-0" />
          <span className="wrap-break-word">{scope.profile}: {scope.scope}</span>
        </div>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope.profile, scope.scope, wikiButtonLabel],
  );

  useAppShellCoverSlot(coverContent);

  const cardsSkeleton = (
    <div className="w-full bg-(--page-bg,#f3f6fb) text-(--page-text,#0b1a3c) px-4 pt-4 pb-6 sm:px-6 lg:px-10 xl:px-12 2xl:px-14">
      <SkeletonGrid />
    </div>
  );

  return (
    <RequireAuth fallback={cardsSkeleton}>
      <div className="w-full bg-(--page-bg,#f3f6fb) text-(--page-text,#0b1a3c) px-4 pt-4 pb-6 sm:px-6 lg:px-10 xl:px-12 2xl:px-14">
        {loading ? (
          <SkeletonGrid />
        ) : (
          <div className="grid w-full auto-rows-fr grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">

            {/* ── Card fixo: Repositório de Documentação ────────────────── */}
            <article className="relative flex min-w-0 flex-col rounded-[26px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) shadow-sm transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <div className="h-1.5 w-full rounded-t-[26px] bg-[linear-gradient(90deg,#011848_0%,#6366f1_100%)]" />
              <div className="flex flex-1 flex-col gap-5 p-5">
                <div className="flex flex-col items-start gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#011848,#6366f1)] text-white">
                      <FiBookOpen className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
                        {isCompanyUser ? "Empresa" : "Plataforma"}
                      </p>
                      <h3 className="text-lg leading-7 font-extrabold text-(--tc-text,#0b1a3c)">
                        {isCompanyUser ? "Repositório da Empresa" : "Repositórios das Empresas"}
                      </h3>
                    </div>
                  </div>
                  <span className="inline-flex min-h-8 w-fit items-center rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6366f1]">
                    {isCompanyUser ? "Sua empresa" : "Todas as empresas"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Conteúdo</p>
                    <p className="mt-1.5 text-sm font-bold text-(--tc-text,#0b1a3c)">
                      {isCompanyUser
                        ? wikiDocCount === null
                          ? "Carregando..."
                          : wikiDocCount === 0
                          ? "Nenhum documento ainda"
                          : `${wikiDocCount} doc${wikiDocCount === 1 ? "" : "s"} em ${wikiCategoryCount} categoria${wikiCategoryCount === 1 ? "" : "s"}`
                        : "Ver por empresa"}
                    </p>
                  </div>
                </div>

                <div className="mt-auto flex flex-col gap-3 border-t border-(--tc-border,#e5e7eb) pt-4">
                  <div className="flex min-w-0 items-center gap-1.5 text-xs text-(--tc-text-muted,#6b7280)">
                    <FiUsers className="h-3.5 w-3.5" />
                    <span>{isCompanyUser && companySlug ? `/${companySlug}/docs` : "/docs"}</span>
                  </div>
                  <Link
                    href={wikiHref}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,#011848,#6366f1)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    {isCompanyUser
                      ? hasWikiContent
                        ? <><FiBookOpen className="h-4 w-4" /> Acessar repositório</>
                        : <><FiEdit3 className="h-4 w-4" /> Criar documentação</>
                      : <><FiBookOpen className="h-4 w-4" /> Ver repositórios</>
                    }
                    <FiArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </article>

            {/* ── Cards de empresas ─────────────────────────────────────── */}
            {clients.length === 0 ? (
              <div className="col-span-full mt-0 flex min-h-60 flex-col items-center justify-center gap-4 rounded-[26px] border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-6 py-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text-muted,#6b7280)">
                  <FiFolder className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-(--tc-text-primary,#0b1a3c)">Nenhuma empresa vinculada</h3>
                  <p className="max-w-xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                    Quando houver vínculos ativos, os repositórios aparecerão aqui automaticamente.
                  </p>
                </div>
              </div>
            ) : (
              clients.map((company) => {
                const href = buildCompanyPathForAccess(company.slug, "documentos", routeInput);
                const isActive = company.slug === activeClientSlug;
                const createdAtLabel =
                  company.createdAt && !Number.isNaN(Date.parse(company.createdAt))
                    ? new Date(company.createdAt).toLocaleDateString("pt-BR")
                    : "Nao informado";
                const initials = getInitials(company.name);

                return (
                  <article
                    key={company.slug}
                    className="relative flex min-w-0 flex-col rounded-[26px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) shadow-sm transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                  >
                    <div className="h-1.5 w-full rounded-t-[26px] bg-[linear-gradient(90deg,#011848_0%,#ef0001_100%)]" />

                    <div className="flex flex-1 flex-col gap-5 p-5">
                      <div className="flex flex-col items-start gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#011848,#082457)] text-sm font-extrabold tracking-[0.18em] text-white">
                            <span className="select-none">{initials}</span>
                            {company.logoUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={company.logoUrl}
                                alt={company.name}
                                className="absolute inset-0 h-full w-full bg-white object-contain"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Empresa</p>
                            <h3 className="wrap-break-word text-lg leading-7 font-extrabold text-(--tc-text,#0b1a3c)">{company.name}</h3>
                          </div>
                        </div>
                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => setActiveClientSlug(company.slug)}
                            className="inline-flex min-h-8 w-fit max-w-full items-center rounded-full border border-(--tc-accent,#ef0001) bg-(--tc-accent,#ef0001)/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-accent,#ef0001)"
                          >
                            Atual
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveClientSlug(company.slug)}
                            className="inline-flex min-h-8 w-fit max-w-full items-center rounded-full border border-(--tc-border,#d7deea) px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                          >
                            Ativar
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Acesso</p>
                          <p className="mt-1.5 wrap-break-word text-sm font-bold text-(--tc-text,#0b1a3c)">{scope.profile}</p>
                        </div>
                        <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Inicio do projeto</p>
                          <p className="mt-1.5 text-sm font-bold text-(--tc-text,#0b1a3c)">{createdAtLabel}</p>
                        </div>
                      </div>

                      <div className="mt-auto flex flex-col gap-3 border-t border-(--tc-border,#e5e7eb) pt-4">
                        <div className="flex min-w-0 items-center gap-1.5 text-xs text-(--tc-text-muted,#6b7280)">
                          <FiUsers className="h-3.5 w-3.5" />
                          <span className="break-all">/{company.slug}</span>
                        </div>
                        <Link
                          href={href}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-(--tc-primary,#0b1a3c) px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                        >
                          Abrir documentos <FiArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
