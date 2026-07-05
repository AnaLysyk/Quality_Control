"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFilter,
  FiGrid,
  FiRefreshCw,
  FiSearch,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import AccessDeniedState from "@/components/access/AccessDeniedState";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";

const VIEW_MODES = ["mine", "company", "management"] as const;
type AgendaViewMode = (typeof VIEW_MODES)[number];

type ReleaseCalendarEvent = {
  id: string;
  title: string;
  type?: string | null;
  markerLabel?: string | null;
  description?: string | null;
  releaseName?: string | null;
  companyName?: string | null;
  companySlug?: string | null;
  projectSlug?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  status?: string | null;
  criticality?: string | null;
  context?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  audienceProfiles?: string[];
  participantNames?: string[];
};

type ReleaseCalendarSummary = {
  total?: number;
  planned?: number;
  atRisk?: number;
  blocked?: number;
  done?: number;
  critical?: number;
  companies?: number;
  users?: number;
};

type ReleaseCalendarPayload = {
  events?: ReleaseCalendarEvent[];
  calendarSummary?: ReleaseCalendarSummary;
};

type UserLike = {
  id?: string | null;
  name?: string | null;
  user?: string | null;
  email?: string | null;
  role?: string | null;
  permissionRole?: string | null;
  companyRole?: string | null;
  isGlobalAdmin?: boolean | null;
  is_global_admin?: boolean | null;
};

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeRole(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isAgendaManager(roles: string[], user: UserLike | null | undefined) {
  return (
    user?.isGlobalAdmin === true ||
    user?.is_global_admin === true ||
    roles.some((role) => ["leader_tc", "technical_support", "testing_company_user"].includes(role))
  );
}

function readInitialView(value: string | null): AgendaViewMode {
  return VIEW_MODES.includes(value as AgendaViewMode) ? (value as AgendaViewMode) : "mine";
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sem data";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    planned: "Planejado",
    at_risk: "Em risco",
    blocked: "Bloqueado",
    done: "Concluído",
    cancelled: "Cancelado",
  };

  return labels[status ?? ""] ?? status ?? "Sem status";
}

function statusClass(status?: string | null) {
  const classes: Record<string, string> = {
    planned: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-100",
    at_risk: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100",
    blocked: "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-100",
    done: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100",
    cancelled: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  };

  return classes[status ?? ""] ?? classes.planned;
}

function criticalityLabel(value?: string | null) {
  const labels: Record<string, string> = {
    critical: "Crítico",
    high: "Alto",
    normal: "Normal",
    low: "Baixo",
  };
  return labels[value ?? ""] ?? value ?? "Normal";
}

function contextLabel(value?: string | null) {
  const labels: Record<string, string> = {
    company: "Empresa",
    project: "Projeto",
    user: "Usuário",
    tc: "TC",
    support: "Suporte",
    release: "Release",
    delivery: "Entrega",
  };
  return labels[value ?? ""] ?? value ?? "Agenda";
}

function viewCopy(mode: AgendaViewMode) {
  if (mode === "management") {
    return {
      eyebrow: "Gestão de agendamentos",
      title: "Agenda por empresa",
      description: "Visão operacional para Líder TC, Suporte Técnico e Usuário TC acompanharem entregas por empresa, projeto e responsável.",
    };
  }

  if (mode === "company") {
    return {
      eyebrow: "Agendamentos da empresa",
      title: "Agenda da empresa",
      description: "Mostra os agendamentos gerais da empresa vinculada, sem expor eventos de outras empresas.",
    };
  }

  return {
    eyebrow: "Meus agendamentos",
    title: "Minha agenda",
    description: "Compromissos onde você aparece como responsável ou participante.",
  };
}

function buildRequestUrl(mode: AgendaViewMode, selectedCompany: string) {
  const params = new URLSearchParams();
  params.set("scope", mode === "management" ? "all" : mode);
  if ((mode === "management" || mode === "company") && selectedCompany !== "all") {
    params.set("companySlug", selectedCompany);
  }
  return `/api/release-calendar?${params.toString()}`;
}

function formatCompanyLabel(slug: string, events: ReleaseCalendarEvent[]) {
  const match = events.find((event) => event.companySlug === slug && event.companyName);
  return match?.companyName ?? slug;
}

export default function AgendaPage() {
  const searchParams = useSearchParams();
  const { loading, can, normalizedUser, user, accessContext } = usePermissionAccess();
  const [activeView, setActiveView] = useState<AgendaViewMode>(() => readInitialView(searchParams.get("view")));
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<ReleaseCalendarEvent[]>([]);
  const [summary, setSummary] = useState<ReleaseCalendarSummary | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userLike = user as UserLike | null | undefined;
  const roleNames = useMemo(() => {
    return Array.from(
      new Set(
        [
          accessContext?.role,
          userLike?.permissionRole,
          userLike?.role,
          userLike?.companyRole,
          ...normalizedUser.roles,
        ]
          .map(normalizeRole)
          .filter(Boolean),
      ),
    );
  }, [accessContext?.role, normalizedUser.roles, userLike?.companyRole, userLike?.permissionRole, userLike?.role]);

  const agendaManager = isAgendaManager(roleNames, userLike);
  const hasCompanyScope = normalizedUser.companySlugs.length > 0;
  const canViewAgenda = can("release_calendar", "view");

  const viewOptions = useMemo(() => {
    const options: Array<{
      id: AgendaViewMode;
      label: string;
      description: string;
      icon: typeof FiCalendar;
    }> = [
      {
        id: "mine",
        label: "Meus agendamentos",
        description: "Somente itens ligados ao meu usuário",
        icon: FiUser,
      },
    ];

    if (agendaManager) {
      options.push({
        id: "management",
        label: "Gestão de agendamentos",
        description: "Por empresa, projeto, usuário e suporte",
        icon: FiUsers,
      });
    }

    if (hasCompanyScope || !agendaManager) {
      options.push({
        id: "company",
        label: "Agendamentos da empresa",
        description: "Visão geral da empresa vinculada",
        icon: FiBriefcase,
      });
    }

    return options;
  }, [agendaManager, hasCompanyScope]);

  const currentView = viewOptions.some((option) => option.id === activeView)
    ? activeView
    : viewOptions[0]?.id ?? "mine";
  const currentCopy = viewCopy(currentView);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    setError(null);

    try {
      const response = await fetch(buildRequestUrl(currentView, selectedCompany), {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as ReleaseCalendarPayload | { error?: string } | null;

      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error ?? "Falha ao carregar agenda");
      }

      setEvents((payload as ReleaseCalendarPayload)?.events ?? []);
      setSummary((payload as ReleaseCalendarPayload)?.calendarSummary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar agenda");
      setEvents([]);
      setSummary(null);
    } finally {
      setLoadingEvents(false);
    }
  }, [currentView, selectedCompany]);

  useEffect(() => {
    if (!loading && canViewAgenda) {
      void loadEvents();
    }
  }, [loading, canViewAgenda, loadEvents]);

  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();

    for (const company of normalizedUser.companies) {
      if (company.slug) map.set(company.slug, company.name ?? company.slug);
    }

    for (const event of events) {
      if (event.companySlug) map.set(event.companySlug, event.companyName ?? formatCompanyLabel(event.companySlug, events));
    }

    return Array.from(map.entries()).map(([slug, label]) => ({ slug, label }));
  }, [events, normalizedUser.companies]);

  const filteredEvents = useMemo(() => {
    const search = normalizeText(query);
    if (!search) return events;

    return events.filter((event) =>
      normalizeText(
        [
          event.title,
          event.markerLabel,
          event.description,
          event.releaseName,
          event.companyName,
          event.companySlug,
          event.projectSlug,
          event.ownerName,
          event.status,
          event.criticality,
          event.context,
          event.type,
          ...(event.audienceProfiles ?? []),
          ...(event.participantNames ?? []),
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(search),
    );
  }, [events, query]);

  const counters = useMemo(() => {
    return {
      total: events.length,
      visible: filteredEvents.length,
      risk: events.filter((event) => event.status === "at_risk").length,
      blocked: events.filter((event) => event.status === "blocked").length,
      done: events.filter((event) => event.status === "done").length,
      critical: events.filter((event) => event.criticality === "critical").length,
    };
  }, [events, filteredEvents.length]);

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-6rem)] px-4 py-5 text-[#011848] dark:text-white sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-8 shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-950/70">
          Validando acesso...
        </section>
      </main>
    );
  }

  if (!canViewAgenda) {
    return (
      <main className="min-h-[calc(100vh-6rem)] px-4 py-5 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-8 shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-950/70">
          <AccessDeniedState
            title="Agenda não disponível"
            description="Seu usuário não possui release_calendar:view. Quando essa permissão é removida, a Agenda some do menu e a rota fica bloqueada."
          />
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-6rem)] px-4 py-5 text-[#011848] dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="overflow-hidden rounded-[2rem] border border-white/20 bg-[linear-gradient(135deg,#011848_0%,#06235f_48%,#8f0000_78%,#ef0001_100%)] p-5 text-white shadow-2xl shadow-slate-950/20 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl border border-white/25 bg-white/95 text-[#ef0001] shadow-xl shadow-black/20">
                <FiCalendar className="h-8 w-8" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/65">{currentCopy.eyebrow}</p>
                <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Agenda</h1>
                <p className="mt-2 max-w-3xl text-sm text-white/78 sm:text-base">{currentCopy.description}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadEvents}
              disabled={loadingEvents}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/12 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRefreshCw className={loadingEvents ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Atualizar
            </button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          {viewOptions.map((option) => {
            const Icon = option.icon;
            const selected = option.id === currentView;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setActiveView(option.id)}
                className={[
                  "group rounded-3xl border p-4 text-left shadow-sm transition",
                  selected
                    ? "border-[#ef0001]/40 bg-white text-[#011848] shadow-xl shadow-red-950/10 dark:border-red-400/35 dark:bg-slate-900 dark:text-white"
                    : "border-slate-200 bg-white/70 text-slate-700 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-slate-900/55 dark:text-slate-200 dark:hover:bg-slate-900",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <span className={selected ? "grid h-11 w-11 place-items-center rounded-2xl bg-[#ef0001] text-white" : "grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <strong className="block text-sm font800 sm:text-base">{option.label}</strong>
                    <small className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{option.description}</small>
                  </span>
                </div>
              </button>
            );
          })}
        </section>

        <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-4 shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-950/70 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#ef0001]">{currentCopy.eyebrow}</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[#011848] dark:text-white">{currentCopy.title}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Filtre por empresa, projeto, responsável, status, criticidade ou contexto.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_minmax(190px,auto)] xl:min-w-[620px]">
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
                <FiSearch className="h-4 w-4" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por release, empresa, projeto, responsável..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#011848] outline-none placeholder:text-slate-400 dark:text-white"
                />
              </label>

              {(currentView === "company" || currentView === "management") ? (
                <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-500 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
                  <FiFilter className="h-4 w-4" />
                  <select
                    value={selectedCompany}
                    onChange={(event) => setSelectedCompany(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#011848] outline-none dark:text-white"
                  >
                    <option value="all">Todas visíveis</option>
                    {companyOptions.map((company) => (
                      <option key={company.slug} value={company.slug}>{company.label}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900/80">
              <small className="text-xs font-semibold text-slate-500 dark:text-slate-400">Visíveis</small>
              <strong className="mt-1 block text-xl text-[#011848] dark:text-white">{counters.visible}/{counters.total}</strong>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
              <small className="text-xs font-semibold">Em risco</small>
              <strong className="mt-1 block text-xl">{counters.risk}</strong>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">
              <small className="text-xs font-semibold">Bloqueados</small>
              <strong className="mt-1 block text-xl">{counters.blocked}</strong>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
              <small className="text-xs font-semibold">Concluídos</small>
              <strong className="mt-1 block text-xl">{counters.done}</strong>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900/80">
              <small className="text-xs font-semibold text-slate-500 dark:text-slate-400">Empresas</small>
              <strong className="mt-1 block text-xl text-[#011848] dark:text-white">{summary?.companies ?? companyOptions.length}</strong>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4">
          {loadingEvents ? (
            <div className="rounded-[2rem] border border-slate-200 bg-white/80 p-8 text-center text-sm font-semibold text-slate-500 shadow-lg dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-300">
              Carregando agenda...
            </div>
          ) : null}

          {!loadingEvents && filteredEvents.map((event) => (
            <article key={event.id} className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-lg shadow-slate-900/8 transition hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10 dark:bg-slate-950/80 dark:shadow-black/20">
              <div className="grid gap-0 lg:grid-cols-[240px,1fr]">
                <div className="border-b border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-900/70 lg:border-b-0 lg:border-r">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#011848] dark:text-white">
                    <FiClock className="h-4 w-4 text-[#ef0001]" />
                    {formatDateTime(event.startAt)}
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Fim: {formatDateTime(event.endAt)}</p>
                  <span className={["mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-bold", statusClass(event.status)].join(" ")}>{statusLabel(event.status)}</span>
                </div>

                <div className="p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ef0001]">{contextLabel(event.context)}</p>
                      <h3 className="mt-1 text-xl font-black tracking-tight text-[#011848] dark:text-white">{event.title}</h3>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {event.description || event.releaseName || "Evento de agenda operacional."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
                        <FiGrid className="h-3.5 w-3.5" /> {criticalityLabel(event.criticality)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-900">{event.companyName || event.companySlug || "Testing Company"}</span>
                    {event.projectSlug ? <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-900">Projeto: {event.projectSlug}</span> : null}
                    {event.ownerName ? <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-900">Responsável: {event.ownerName}</span> : null}
                    {event.releaseName ? <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-900">Release: {event.releaseName}</span> : null}
                    {(event.participantNames ?? []).slice(0, 3).map((participant) => (
                      <span key={participant} className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-900">{participant}</span>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}

          {!loadingEvents && filteredEvents.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-500 dark:border-white/15 dark:bg-slate-950/50 dark:text-slate-300">
              <FiCheckCircle className="mx-auto h-7 w-7 text-emerald-500" />
              <p className="mt-3 font-bold">Nenhum agendamento encontrado para este filtro.</p>
              <p className="mt-1 text-sm">Troque a visão, limpe a busca ou atualize a agenda.</p>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
