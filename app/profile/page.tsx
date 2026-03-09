"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiArrowRight, FiClock, FiSettings } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";

type NormalizedDefect = {
  id: string;
  runSlug: string;
  title: string;
  app: string;
  status: string;
  kanbanStatus?: "aberto" | "bloqueado" | "reteste" | "aprovado" | "backlog";
  severity: string;
  link: string;
  created_at?: string;
};

const STATUS_OVERVIEW = [
  { key: "aberto", label: "Em falha", description: "Necessita atenção imediata", tone: "rose" },
  { key: "bloqueado", label: "Bloqueado", description: "Dependente de outro time", tone: "amber" },
  { key: "reteste", label: "Aguardando teste", description: "Pronto para validação", tone: "sky" },
  { key: "aprovado", label: "Concluído", description: "Ciclo encerrado", tone: "emerald" },
];

const TONE_CLASSES: Record<string, string> = {
  rose: "border-rose-400/60 bg-rose-500/10 text-rose-500",
  amber: "border-amber-400/60 bg-amber-500/10 text-amber-500",
  sky: "border-sky-400/60 bg-sky-500/10 text-sky-500",
  emerald: "border-emerald-400/60 bg-emerald-500/10 text-emerald-500",
  slate: "border-slate-400/60 bg-slate-500/10 text-slate-500",
};

const ACTION_LABELS: Record<string, string> = {
  aberto: "Reportou um defeito",
  bloqueado: "Bloqueou uma execução",
  reteste: "Pediu reteste",
  aprovado: "Concluiu o ciclo",
  backlog: "Inseriu no backlog",
};

const formatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const formatDateTime = (value?: string) => (value ? formatter.format(new Date(value)) : "Sem data");

export default function ProfilePage() {
  const { user } = useAuthUser();
  const { activeClient } = useClientContext();

  const userCompany = (() => {
    if (!user) return null;
    const raw = (user as Record<string, unknown> & { company?: unknown }).company;
    if (raw && typeof raw === "object" && raw !== null) {
      const { slug, name } = raw as { slug?: unknown; name?: unknown };
      return {
        slug: typeof slug === "string" ? slug : undefined,
        name: typeof name === "string" ? name : undefined,
      };
    }
    return null;
  })();

  const slug = activeClient?.slug ?? userCompany?.slug ?? "";
  const companyName = activeClient?.name ?? userCompany?.name ?? "Empresa";
  const companyType = user?.roleGlobal === "ADMIN" ? "Testing Company" : "Empresa cliente";
  const isAdmin = Boolean(user?.isGlobalAdmin || user?.roleGlobal === "ADMIN");
  const companyHref = slug ? `/empresas/${encodeURIComponent(slug)}/home` : "/empresas";

  const [defects, setDefects] = useState<NormalizedDefect[]>([]);
  const [defectsLoading, setDefectsLoading] = useState(false);
  const [defectsError, setDefectsError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setDefects([]);
      return;
    }
    let canceled = false;
    async function loadDefects() {
      setDefectsLoading(true);
      setDefectsError(null);
      try {
        const res = await fetch(`/api/empresas/${encodeURIComponent(slug)}/defeitos?me=true`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (canceled) return;
        if (!res.ok) {
          setDefectsError(typeof data?.error === "string" ? data.error : "Erro ao carregar defeitos");
          return;
        }
        if (Array.isArray(data?.defects)) {
          setDefects(data.defects as NormalizedDefect[]);
        } else if (Array.isArray(data?.items)) {
          setDefects(data.items as NormalizedDefect[]);
        } else {
          setDefects([]);
        }
      } catch (err) {
        if (canceled) return;
        const message = err instanceof Error ? err.message : "Erro ao carregar defeitos";
        setDefectsError(message);
        setDefects([]);
      } finally {
        if (!canceled) setDefectsLoading(false);
      }
    }
    loadDefects();
    return () => {
      canceled = true;
    };
  }, [slug]);

  const statusSummary = useMemo(() => {
    const totals = STATUS_OVERVIEW.map((item) => {
      const count = defects.filter((defect) => defect.kanbanStatus === item.key).length;
      return { ...item, count };
    });
    const total = defects.length;
    return { totals, total };
  }, [defects]);

  const timeline = useMemo(() => {
    return defects.slice(0, 3).map((defect) => {
      const action = defect.kanbanStatus ? ACTION_LABELS[defect.kanbanStatus] ?? ACTION_LABELS.backlog : "Registrou um defeito";
      const location = defect.runSlug ? `${defect.app} · Run ${defect.runSlug}` : defect.app;
      return {
        id: defect.id,
        title: defect.title,
        action,
        timestamp: defect.created_at,
        location,
        link: defect.link,
      };
    });
  }, [defects]);

  const initials = useMemo(() => {
    const name = user?.name?.trim() || "";
    if (!name) return "US";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    const last = parts[parts.length - 1];
    return `${parts[0][0]}${last?.[0] ?? ""}`.toUpperCase();
  }, [user?.name]);

  const fullRole =
    user?.role && user.role.trim().length > 0
      ? user.role
      : isAdmin
        ? "Administrador"
        : "Usuário";

  return (
    <div className="min-h-screen w-full bg-(--page-bg,#0b1220) text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-4xl border border-white/10 bg-linear-to-br from-[#0f1528] via-[#11152c] to-[#121a32] p-8 shadow-[0_30px_80px_rgba(9,14,32,0.5)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-white/10 text-3xl font-semibold tracking-[0.38em] text-white">
                {initials}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-white/60">Perfil</p>
                <h1 className="text-4xl font-bold leading-tight text-white">{user?.name ?? "Nome de usuário"}</h1>
                <p className="text-sm text-white/70">{user?.email ?? "email@email.com"}</p>
                <p className="mt-1 text-sm text-white/70">Cargo: {fullRole}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.3em]">
              {isAdmin && (
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-white/80">Admin</span>
              )}
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-white/80">Empresa</span>
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-white/80">Usuário</span>
            </div>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">Empresa ativa</p>
              <p className="text-lg font-semibold text-white">{companyName}</p>
              <p className="text-sm text-white/70">Tipo: {companyType}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <Link
                  href={companyHref}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase text-slate-900"
                >
                  Acessar empresa
                  <FiArrowRight size={12} />
                </Link>
                {slug && (
                  <Link
                    href={`/empresas/${encodeURIComponent(slug)}/defeitos?me=true`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-white/90"
                  >
                    Meus defeitos
                  </Link>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">Identidade</p>
              <p className="text-lg font-semibold text-white">{user?.name ?? "USUARIO"}</p>
              <p className="text-sm text-white/70">{user?.email ?? "email@email.com"}</p>
              <p className="mt-2 text-sm text-white/70">Cargo ativo: {fullRole}</p>
              <p className="text-sm text-white/70">Contexto visual: {companyName}</p>
            </div>
          </div>
        </header>

        <section className="space-y-6 rounded-4xl bg-white/5 p-6 backdrop-blur shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">Fluxo rápido</p>
              <h2 className="text-2xl font-bold text-white">Navegação pessoal</h2>
              <p className="text-sm text-white/70">
                Acesse painéis, reporte defeitos e ajuste preferências sem se perder no menu.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/settings/profile"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-white/10"
              >
                Meu perfil
              </Link>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: "Visão geral", description: "Indicadores-chave para sua operação", href: "/applications-panel" },
              { title: "Runs do cliente", description: "Apps e runs ativos para o contexto atual", href: `/empresas/${encodeURIComponent(slug)}/runs` },
              { title: "Meu perfil", description: "Dados, preferencias e seguranca da conta", href: "/settings/profile" },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="flex flex-col gap-2 rounded-2xl border border-white/20 bg-white/5 p-4 text-sm text-white transition hover:border-[#ef0001] hover:bg-white/10"
              >
                <span className="text-xs uppercase tracking-[0.4em] text-white/60">{item.description}</span>
                <span className="text-lg font-semibold text-white">{item.title}</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.4em] text-white/80">Ir para</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">Meus defeitos</p>
              <h3 className="text-2xl font-semibold text-(--tc-text-primary,#0b1a3c)">Monitoramento pessoal</h3>
            </div>
            <Link
              href={slug ? `/empresas/${encodeURIComponent(slug)}/defeitos?me=true` : "/empresas"}
              className="text-sm font-semibold text-(--tc-accent,#ef0001) hover:underline"
            >
              Ver todos os meus defeitos
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {statusSummary.totals.map((item) => (
              <div
                key={item.key}
                className={`rounded-2xl border px-4 py-3 ${TONE_CLASSES[item.tone] ?? TONE_CLASSES.slate}`}
              >
                <p className="text-xs uppercase tracking-[0.3em]">{item.label}</p>
                <p className="text-3xl font-semibold">{item.count}</p>
                <p className="text-xs text-white/70">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {defectsLoading ? (
              <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando defeitos relacionados...</p>
            ) : defectsError ? (
              <p className="text-sm text-rose-500">{defectsError}</p>
            ) : defects.length === 0 ? (
              <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhum defeito específico foi identificado ainda.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {defects.slice(0, 4).map((defect) => {
                  const tone =
                    STATUS_OVERVIEW.find((item) => item.key === defect.kanbanStatus)?.tone ?? "slate";
                  const origin = defect.link?.includes("/release/") ? "Manual" : "Automático";
                  return (
                    <article
                      key={defect.id}
                      className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f7f8fb) p-4 shadow-sm"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-secondary,#4b5563)">
                        {origin}
                      </p>
                      <h4 className="mt-1 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) truncate">
                        {defect.title}
                      </h4>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-(--tc-text-muted,#6b7280)">
                        <span className={`rounded-full border px-3 py-1 ${TONE_CLASSES[tone] ?? TONE_CLASSES.slate}`}>
                          {STATUS_OVERVIEW.find((item) => item.tone === tone)?.label ?? "Defeito"}
                        </span>
                        <span>{formatDateTime(defect.created_at)}</span>
                      </div>
                      {defect.link && (
                        <a
                          href={defect.link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-(--tc-accent,#ef0001) hover:underline"
                        >
                          Ver caso
                          <FiArrowRight size={12} />
                        </a>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">Atividade recente</p>
                <h3 className="text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Meus logs</h3>
              </div>
              <FiClock size={20} className="text-(--tc-text-muted,#6b7280)" />
            </div>
            <div className="space-y-3">
              {timeline.length === 0 ? (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhuma atividade detectada recentemente.</p>
              ) : (
                timeline.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f7f8fb) p-4"
                  >
                    <div className="flex items-center justify-between text-xs text-(--tc-text-muted,#6b7280)">
                      <span>{item.action}</span>
                      <span>{formatDateTime(item.timestamp)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{item.title}</p>
                    <p className="text-xs text-(--tc-text-muted,#6b7280)">{item.location}</p>
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-(--tc-accent,#ef0001) hover:underline"
                      >
                        Detalhes
                        <FiArrowRight size={12} />
                      </a>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">Meu perfil</p>
                <h3 className="text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Minha conta</h3>
              </div>
              <FiSettings size={20} className="text-(--tc-text-muted,#6b7280)" />
            </div>
            <div className="space-y-3 text-sm text-(--tc-text-muted,#4b5563)">
              <p>Dados, preferencias e seguranca ficam centralizados no Meu perfil.</p>
              <p>Sem tokens, sem permissões administrativas, apenas identidade.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/settings/profile"
                className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f7f8fb) px-4 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) hover:bg-(--tc-surface-hover,#edf2ff)"
              >
                Abrir Meu perfil
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

