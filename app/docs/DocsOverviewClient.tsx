"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiArrowRight, FiBookOpen, FiEdit3, FiFolder, FiShield, FiUsers } from "react-icons/fi";

import { useAppShellCoverSlot } from "@/components/AppShellCoverSlotContext";
import { RequireAuth } from "@/components/RequireAuth";
import { useClientContext } from "@/context/ClientContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { fetchApi } from "@/lib/api";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function normalizeRole(v?: string | null) {
  return (v ?? "").trim().toLowerCase();
}

function resolveProfile(user: ReturnType<typeof useAuthUser>["user"]) {
  const roles = [user?.permissionRole, user?.role, user?.companyRole].map(normalizeRole);
  const isLeader = roles.includes("leader_tc") || user?.isGlobalAdmin === true || user?.is_global_admin === true;
  const isSupport = roles.includes("technical_support");
  if (isLeader) return "leader";
  if (isSupport) return "support";
  if (roles.includes("empresa") || roles.includes("company_user") || (user?.userOrigin ?? user?.user_origin) === "client_company") return "company";
  return "tc_user";
}

type WikiSummary = { docCount: number; categoryCount: number; canEdit: boolean } | null;

const SkeletonGrid = () => (
  <div className="w-full bg-(--page-bg,#f3f6fb) px-4 pt-4 pb-6 sm:px-6 lg:px-10 xl:px-12 2xl:px-14">
    <div className="grid w-full auto-rows-fr grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-[26px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-5">
          <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-5 h-6 w-2/3 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-3 h-4 w-24 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-6 h-20 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ))}
    </div>
  </div>
);

export default function DocsOverviewClient() {
  const { user } = useAuthUser();
  const { clients, loading } = useClientContext();
  const profile = resolveProfile(user);
  const showPlatformWiki = profile !== "company";
  const routeInput = {
    isGlobalAdmin: user?.isGlobalAdmin === true || user?.is_global_admin === true,
    permissionRole: user?.permissionRole ?? null,
    role: user?.role ?? null,
    companyRole: user?.companyRole ?? null,
    userOrigin: user?.userOrigin ?? user?.user_origin ?? null,
    companyCount: clients.length,
    clientSlug: user?.clientSlug ?? null,
    defaultClientSlug: user?.defaultClientSlug ?? null,
  };

  // wiki summaries keyed by company slug
  const [summaries, setSummaries] = useState<Record<string, WikiSummary>>({});
  const [summariesLoading, setSummariesLoading] = useState(false);
  // platform (internal) wiki summary — only shown to leader/support
  const [platformSummary, setPlatformSummary] = useState<WikiSummary>(null);

  useEffect(() => {
    if (!showPlatformWiki) {
      setPlatformSummary(null);
      return;
    }

    let cancelled = false;
    fetchApi("/api/platform-docs")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d || cancelled) return;
        setPlatformSummary({
          docCount: (d.docs as unknown[]).length,
          categoryCount: (d.categories as unknown[]).length,
          canEdit: d.canEdit === true,
        });
      })
      .catch(() => {
        if (!cancelled) setPlatformSummary(null);
      });

    return () => {
      cancelled = true;
    };
  }, [showPlatformWiki]);

  useEffect(() => {
    if (loading) return;
    if (clients.length === 0) {
      setSummaries({});
      setSummariesLoading(false);
      return;
    }

    let cancelled = false;
    setSummariesLoading(true);

    Promise.all(
      clients.map(async (company) => {
        try {
          const response = await fetchApi(`/api/company-docs/${company.slug}`);
          if (!response.ok) return [company.slug, null] as const;

          const data = await response.json() as { docs: unknown[]; categories: unknown[]; canEdit: boolean };
          return [company.slug, {
            docCount: data.docs.length,
            categoryCount: data.categories.length,
            canEdit: data.canEdit === true,
          }] as const;
        } catch {
          return [company.slug, null] as const;
        }
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setSummaries(Object.fromEntries(entries));
      })
      .finally(() => {
        if (!cancelled) setSummariesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, clients]);

  const visibleCompanies = useMemo(() => {
    if (profile === "company") return clients;
    return clients.filter((company) => (summaries[company.slug]?.docCount ?? 0) > 0);
  }, [clients, profile, summaries]);

  const scopeLabel = useMemo(() => {
    if (profile === "leader") return "Todas as empresas";
    if (profile === "support") return "Todas as empresas";
    if (profile === "company") return "Sua empresa";
    return "Empresas vinculadas";
  }, [profile]);

  const coverContent = useMemo(
    () => (
      <div className="inline-flex min-h-10 w-full max-w-full items-center justify-center rounded-full border border-white/18 bg-white/10 px-4 py-2 text-center text-sm font-semibold leading-5 text-white/92 sm:w-auto xl:max-w-88">
        <FiShield className="mr-2 h-4 w-4 shrink-0" />
        <span className="wrap-break-word">{scopeLabel}</span>
      </div>
    ),
    [scopeLabel],
  );

  useAppShellCoverSlot(coverContent);

  const skeleton = <SkeletonGrid />;

  return (
    <RequireAuth fallback={skeleton}>
      <div className="w-full bg-(--page-bg,#f3f6fb) text-(--page-text,#0b1a3c) px-4 pt-4 pb-6 sm:px-6 lg:px-10 xl:px-12 2xl:px-14">
        {loading ? (
          <div className="grid w-full auto-rows-fr grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-[26px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-5">
                <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-5 h-6 w-2/3 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-3 h-4 w-24 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-6 h-20 animate-pulse rounded-2xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid w-full auto-rows-fr grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">

            {/* ── Platform wiki card (only leader/support) ──────────────── */}
            {showPlatformWiki && (
              <article className="relative flex min-w-0 flex-col rounded-[26px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) shadow-sm transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                <div className="h-1.5 w-full rounded-t-[26px] bg-[linear-gradient(90deg,#011848_0%,#6366f1_100%)]" />
                <div className="flex flex-1 flex-col gap-5 p-5">
                  <div className="flex flex-col items-start gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#011848,#6366f1)] text-white">
                        <FiBookOpen className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Plataforma</p>
                        <h3 className="text-lg leading-7 font-extrabold text-(--tc-text,#0b1a3c)">Repositório da Testing Company</h3>
                      </div>
                    </div>
                    <span className="inline-flex min-h-8 w-fit items-center rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6366f1]">
                      Sempre disponivel
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Conteúdo</p>
                      <p className="mt-1.5 text-sm font-bold text-(--tc-text,#0b1a3c)">
                        {platformSummary === null
                          ? "Carregando..."
                          : platformSummary.docCount === 0
                          ? "Nenhum documento ainda"
                          : `${platformSummary.docCount} doc${platformSummary.docCount === 1 ? "" : "s"} em ${platformSummary.categoryCount} categoria${platformSummary.categoryCount === 1 ? "" : "s"}`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-col gap-3 border-t border-(--tc-border,#e5e7eb) pt-4">
                    <div className="flex min-w-0 items-center gap-1.5 text-xs text-(--tc-text-muted,#6b7280)">
                      <FiUsers className="h-3.5 w-3.5" /><span>/docs/platform</span>
                    </div>
                    <Link
                      href="/docs/platform"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,#011848,#6366f1)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                      {platformSummary?.docCount === 0 && platformSummary?.canEdit
                        ? <><FiEdit3 className="h-4 w-4" /> Criar documentação</>
                        : <><FiBookOpen className="h-4 w-4" /> Acessar repositório</>
                      }
                      <FiArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            )}

            {/* ── Empty state ──────────────────────────────────────────── */}
            {clients.length === 0 && (
              <div className="col-span-full mt-0 flex min-h-60 flex-col items-center justify-center gap-4 rounded-[26px] border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-6 py-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text-muted,#6b7280)">
                  <FiFolder className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-(--tc-text-primary,#0b1a3c)">Nenhuma empresa vinculada</h3>
                  <p className="max-w-xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                    Quando houver vínculos ativos, os repositórios das empresas aparecerão aqui.
                  </p>
                </div>
              </div>
            )}

            {clients.length > 0 && profile !== "company" && !summariesLoading && visibleCompanies.length === 0 && (
              <div className="col-span-full mt-0 flex min-h-60 flex-col items-center justify-center gap-4 rounded-[26px] border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-6 py-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text-muted,#6b7280)">
                  <FiFolder className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-(--tc-text-primary,#0b1a3c)">Nenhum repositório com conteúdo</h3>
                  <p className="max-w-xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                    Quando alguma empresa vinculada publicar conteúdo no repositório, ela aparecerá aqui automaticamente.
                  </p>
                </div>
              </div>
            )}

            {/* ── Company wiki cards ───────────────────────────────────── */}
            {visibleCompanies.map((company) => {
              const summary = summaries[company.slug] ?? null;
              const docCount = summary?.docCount ?? null;
              const catCount = summary?.categoryCount ?? 0;
              const canEdit = summary?.canEdit === true;
              const initials = getInitials(company.name);
              const href = buildCompanyPathForAccess(company.slug, "docs", routeInput);

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
                      <span className="inline-flex min-h-8 w-fit items-center rounded-full border border-(--tc-border,#d7deea) px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
                        Repositório
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Conteúdo</p>
                        <p className="mt-1.5 text-sm font-bold text-(--tc-text,#0b1a3c)">
                          {docCount === null
                            ? "Carregando..."
                            : docCount === 0
                            ? "Nenhum documento ainda"
                            : `${docCount} doc${docCount === 1 ? "" : "s"} em ${catCount} categoria${catCount === 1 ? "" : "s"}`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-auto flex flex-col gap-3 border-t border-(--tc-border,#e5e7eb) pt-4">
                      <div className="flex min-w-0 items-center gap-1.5 text-xs text-(--tc-text-muted,#6b7280)">
                        <FiUsers className="h-3.5 w-3.5" />
                        <span className="break-all">/{company.slug}/docs</span>
                      </div>
                      <Link
                        href={href}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-(--tc-primary,#0b1a3c) px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                      >
                        {docCount === 0 && canEdit ? <><FiEdit3 className="h-4 w-4" /> Criar documentação</> : <><FiBookOpen className="h-4 w-4" /> Acessar repositório</>}
                        <FiArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
