"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiActivity,
  FiArrowRight,
  FiBookOpen,
  FiCpu,
  FiLayers,
  FiLock,
  FiServer,
  FiShield,
  FiTarget,
  FiUsers,
  FiZap,
} from "react-icons/fi";

import { useAppShellCoverSlot } from "@/components/AppShellCoverSlotContext";
import { RequireAuth } from "@/components/RequireAuth";
import { useClientContext } from "@/context/ClientContext";
import {
  AUTOMATION_DOMAIN_TOTAL,
  AUTOMATION_REQUEST_TOTAL,
} from "@/data/automationCatalog";
import { useAuthUser } from "@/hooks/useAuthUser";
import { resolveAutomationAccess } from "@/lib/automations/access";
import AutomationStudio from "./AutomationStudio";

const BiometricAutomationRunner = dynamic(() => import("./BiometricAutomationRunner"), {
  loading: () => <RunnerSectionSkeleton />,
  ssr: false,
});

const AutomationWorkbenchCatalog = dynamic(() => import("./AutomationWorkbenchCatalog"), {
  loading: () => <CatalogSkeleton />,
  ssr: false,
});

function SkeletonBlocks() {
  return (
    <div className="w-full bg-(--page-bg,#f3f6fb) px-4 pt-4 pb-8 sm:px-6 lg:px-10 xl:px-12 2xl:px-14">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
        <div className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6">
          <div className="h-3 w-32 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 h-12 w-2/3 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-100" />
          <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-slate-100" />
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
        <div className="grid gap-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff)" />
          ))}
        </div>
      </div>
    </div>
  );
}

function RunnerSectionSkeleton() {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
      <div className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
        <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-10 w-64 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-100" />
        <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="h-64 animate-pulse rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff)" />
        ))}
      </div>
    </section>
  );
}

function CatalogSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
        <div className="h-3 w-32 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-10 w-72 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-100" />
        <div className="mt-2 h-4 w-5/6 animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-72 animate-pulse rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff)" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="h-80 animate-pulse rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff)" />
        ))}
      </div>
    </div>
  );
}

function DeferredRunnerPlaceholder({ onLoad }: { onLoad: () => void }) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
      <article className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent,#ef0001)">Runner sob demanda</p>
        <h3 className="mt-2 text-3xl font-black tracking-[-0.04em] text-(--tc-text,#0b1a3c)">Biometria Griaule</h3>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-(--tc-text-secondary,#4b5563)">
          O runner foi movido para carga tardia para não disputar renderização com a abertura da tela. Ele sobe automaticamente
          quando a seção entra na área útil ou pode ser carregado agora.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onLoad}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-(--tc-primary,#011848) px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Carregar runner agora
            <FiArrowRight className="h-4 w-4" />
          </button>
          <div className="inline-flex min-h-11 items-center justify-center rounded-full border border-(--tc-border,#d7deea) px-4 py-2 text-sm font-semibold text-(--tc-text-muted,#6b7280)">
            Metadata e chunk do runner só entram quando necessário
          </div>
        </div>
      </article>

      <aside className="rounded-[30px] border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
        <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-10 w-48 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-100" />
        <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </aside>
    </section>
  );
}

export default function AutomationWorkbenchClient() {
  const { user } = useAuthUser();
  const { clients, activeClient } = useClientContext();
  const runnerAnchorRef = useRef<HTMLDivElement | null>(null);
  const catalogAnchorRef = useRef<HTMLDivElement | null>(null);
  const access = useMemo(() => resolveAutomationAccess(user, clients.length), [user, clients.length]);
  const [shouldRenderRunner, setShouldRenderRunner] = useState(false);
  const [shouldRenderCatalog, setShouldRenderCatalog] = useState(false);
  const visibleCompanies = useMemo(() => clients.slice(0, 6).map((company) => company.name), [clients]);

  useEffect(() => {
    if (shouldRenderRunner) return;

    const target = runnerAnchorRef.current;
    if (!target) return;

    const timeoutId = window.setTimeout(() => setShouldRenderRunner(true), 1200);
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setShouldRenderRunner(true);
      },
      { rootMargin: "280px 0px" },
    );

    observer.observe(target);

    return () => {
      window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [shouldRenderRunner]);

  useEffect(() => {
    if (shouldRenderCatalog) return;

    const target = catalogAnchorRef.current;
    if (!target) return;

    const timeoutId = window.setTimeout(() => setShouldRenderCatalog(true), 1800);
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setShouldRenderCatalog(true);
      },
      { rootMargin: "360px 0px" },
    );

    observer.observe(target);

    return () => {
      window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [shouldRenderCatalog]);

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

  const skeleton = <SkeletonBlocks />;
  const openRunnerSection = () => {
    setShouldRenderRunner(true);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        runnerAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  return (
    <RequireAuth fallback={skeleton}>
      <div className="w-full bg-(--page-bg,#f3f6fb) px-4 pt-4 pb-8 text-(--page-text,#0b1a3c) sm:px-6 lg:px-10 xl:px-12 2xl:px-14">
        {!access.canOpen ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <section className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#011848,#ef0001)] text-white">
                <FiLock className="h-6 w-6" />
              </div>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent,#ef0001)">Acesso restrito</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">Módulo interno de automações</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-(--tc-text-secondary,#4b5563)">
                Esse workspace foi desenhado para operação técnica da Testing Company. Perfis de empresa e usuário da empresa
                continuam usando os próprios documentos, repositórios e telas da organização sem acesso aos fluxos internos.
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

            <aside className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Perfis habilitados</p>
              <div className="mt-4 space-y-3">
                {[
                  "Líder TC: gestão completa de ambientes, presets e histórico.",
                  "Suporte técnico: operação completa e leitura global.",
                  "Usuário TC: leitura operacional apenas das empresas vinculadas.",
                  "Empresa e usuário da empresa: mesma visão operacional, restrita à própria empresa.",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-3 text-sm leading-6 text-(--tc-text-secondary,#4b5563)"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(340px,0.82fr)]">
              <section className="rounded-[30px] bg-[linear-gradient(135deg,#011848_0%,#1b2563_54%,#ef0001_100%)] p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/72">Quality Control • automações</p>
                    <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                      Orquestrador visual por empresa para API, navegador e fluxos guiados
                    </h2>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-white/82">
                      O módulo deixa de ser um agrupador de requests e passa a virar studio operacional. O front recebe fluxo,
                      assets e script editável; o backend executa com segurança; e cada perfil enxerga a mesma identidade visual
                      respeitando o escopo de empresa, vínculo e operação técnica.
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {["Front em React", "Studio low-code", "Script editável no front", "Playwright só onde houver browser"].map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center rounded-full border border-white/16 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90"
                        >
                          {item}
                        </span>
                      ))}
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/14 bg-white/8 p-4 backdrop-blur">
                        <FiTarget className="h-5 w-5 text-white/88" />
                        <h3 className="mt-3 text-sm font-bold">Entrada simplificada</h3>
                        <p className="mt-2 text-xs leading-6 text-white/72">O operador preenche só o essencial e o sistema monta o fluxo.</p>
                      </div>
                      <div className="rounded-2xl border border-white/14 bg-white/8 p-4 backdrop-blur">
                        <FiServer className="h-5 w-5 text-white/88" />
                        <h3 className="mt-3 text-sm font-bold">Ambientes controlados</h3>
                        <p className="mt-2 text-xs leading-6 text-white/72">Base URL, segredos e headers ficam centralizados fora do front.</p>
                      </div>
                      <div className="rounded-2xl border border-white/14 bg-white/8 p-4 backdrop-blur">
                        <FiActivity className="h-5 w-5 text-white/88" />
                        <h3 className="mt-3 text-sm font-bold">Histórico rastreável</h3>
                        <p className="mt-2 text-xs leading-6 text-white/72">Cada execução deixa rastro suficiente para auditoria e onboarding.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-3xl border border-white/14 bg-white/10 p-4 backdrop-blur">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/68">
                        <FiLayers className="h-4 w-4" />
                        Coleção atual
                      </div>
                      <div className="mt-3 text-4xl font-black">{AUTOMATION_REQUEST_TOTAL}</div>
                      <p className="mt-2 text-sm text-white/76">requests mapeados para virar catálogo profissional.</p>
                    </div>
                    <div className="rounded-3xl border border-white/14 bg-white/10 p-4 backdrop-blur">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/68">
                        <FiZap className="h-4 w-4" />
                        Domínios
                      </div>
                      <div className="mt-3 text-4xl font-black">{AUTOMATION_DOMAIN_TOTAL}</div>
                      <p className="mt-2 text-sm text-white/76">blocos separados para priorizar MVP, expansão e observabilidade.</p>
                    </div>
                    <div className="rounded-3xl border border-white/14 bg-white/10 p-4 backdrop-blur">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/68">
                        <FiShield className="h-4 w-4" />
                        Perfil ativo
                      </div>
                      <div className="mt-3 text-2xl font-black">{access.visibilityLabel}</div>
                      <p className="mt-2 text-sm text-white/76">{access.helperText}</p>
                    </div>
                  </div>
                </div>
              </section>

              <aside className="space-y-4">
                <article className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
                    <FiUsers className="h-4 w-4" />
                    Escopo atual
                  </div>
                  <h3 className="mt-3 text-2xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{access.scopeLabel}</h3>
                  <p className="mt-3 text-sm leading-7 text-(--tc-text-secondary,#4b5563)">
                    {activeClient?.name
                      ? `Empresa ativa da sessão: ${activeClient.name}.`
                      : "Nenhuma empresa ativa foi fixada na sessão até agora."}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {visibleCompanies.length > 0 ? (
                      visibleCompanies.map((company) => (
                        <span
                          key={company}
                          className="inline-flex items-center rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)"
                        >
                          {company}
                        </span>
                      ))
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-dashed border-(--tc-border,#d7deea) px-3 py-1 text-xs font-semibold text-(--tc-text-muted,#6b7280)">
                        Nenhuma empresa visível na sessão
                      </span>
                    )}
                  </div>
                </article>

                <article className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
                    <FiCpu className="h-4 w-4" />
                    Regra de produto
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
                      <p className="text-sm font-bold text-(--tc-text,#0b1a3c)">Mesmo layout interno</p>
                      <p className="mt-1 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                        Líder TC, suporte, usuário TC, empresa e usuário da empresa usam a mesma identidade visual do módulo.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
                      <p className="text-sm font-bold text-(--tc-text,#0b1a3c)">Escopo controlado por vínculo</p>
                      <p className="mt-1 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                        Líder TC e suporte veem tudo. Usuário TC vê apenas empresas vinculadas. Empresa e usuário da empresa veem apenas a própria automação.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
                      <p className="text-sm font-bold text-(--tc-text,#0b1a3c)">
                        {access.canConfigure ? "Configuração global liberada" : access.canManageFlows ? "Edição da própria empresa" : "Execução sem edição"}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                        {access.canConfigure
                          ? "Ambientes, presets, logs técnicos e segredos operacionais podem ser administrados por este perfil."
                          : access.canManageFlows
                            ? "Esse perfil edita, inativa e executa apenas automações do próprio escopo, sem mexer em segredos globais."
                            : "Esse perfil executa e acompanha fluxos do próprio escopo, mas não altera blueprint, ambiente nem segredos."}
                      </p>
                    </div>
                  </div>
                </article>
              </aside>
            </div>

            <AutomationStudio
              access={access}
              activeCompanySlug={activeClient?.slug ?? null}
              companies={clients.map((company) => ({ name: company.name, slug: company.slug }))}
              onOpenRealRunner={openRunnerSection}
            />

            <div ref={runnerAnchorRef}>
              {shouldRenderRunner ? (
                <BiometricAutomationRunner
                  activeCompanySlug={activeClient?.slug ?? null}
                  canConfigure={access.canConfigure}
                  companies={clients.map((company) => ({ name: company.name, slug: company.slug }))}
                />
              ) : (
                <DeferredRunnerPlaceholder onLoad={openRunnerSection} />
              )}
            </div>
            <div ref={catalogAnchorRef}>{shouldRenderCatalog ? <AutomationWorkbenchCatalog /> : <CatalogSkeleton />}</div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
