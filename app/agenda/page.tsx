"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FiBriefcase, FiCalendar, FiCheckCircle, FiClock, FiFilter, FiMessageCircle, FiRefreshCw, FiSearch, FiUser, FiUsers } from "react-icons/fi";
import AccessDeniedState from "@/components/access/AccessDeniedState";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";

const VIEW_MODES = ["mine", "company", "management"] as const;
type AgendaViewMode = (typeof VIEW_MODES)[number];
type AgendaStatus = "planned" | "at_risk" | "blocked" | "done" | "cancelled";

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  releaseName?: string | null;
  companyName?: string | null;
  companySlug?: string | null;
  projectSlug?: string | null;
  ownerName?: string | null;
  status?: string | null;
  context?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  participantNames?: string[];
};

type CalendarPayload = { events?: CalendarEvent[]; calendarSummary?: { companies?: number } };
type UserLike = { role?: string | null; permissionRole?: string | null; companyRole?: string | null; isGlobalAdmin?: boolean | null; is_global_admin?: boolean | null };
type ViewOption = { id: AgendaViewMode; label: string; description: string; icon: typeof FiCalendar };

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function normalizeText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizeRole(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isAgendaManager(roles: string[], user: UserLike | null | undefined) {
  return user?.isGlobalAdmin === true || user?.is_global_admin === true || roles.some((role) => ["leader_tc", "technical_support", "testing_company_user"].includes(role));
}

function readInitialView(value: string | null): AgendaViewMode {
  return VIEW_MODES.includes(value as AgendaViewMode) ? (value as AgendaViewMode) : "mine";
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function eventDayKey(value?: string | null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? toDateKey(date) : "sem-data";
}

function todayKey() {
  return toDateKey(new Date());
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

function formatDay(value: string) {
  if (value === "sem-data") return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatTime(value?: string | null) {
  const parsed = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed)) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(parsed);
}

function duration(startAt?: string | null, endAt?: string | null) {
  const start = startAt ? Date.parse(startAt) : NaN;
  const end = endAt ? Date.parse(endAt) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "tempo não definido";
  const minutes = Math.round((end - start) / 60000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ""}`;
}

function statusLabel(status?: string | null) {
  return ({ planned: "Vai acontecer", at_risk: "Atenção", blocked: "Bloqueada", done: "Realizada", cancelled: "Não realizada" } as Record<string, string>)[status ?? ""] ?? "Sem status";
}

function statusClass(status?: string | null) {
  const classes: Record<string, string> = {
    planned: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-100",
    at_risk: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100",
    blocked: "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-100",
    done: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100",
    cancelled: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  };
  return classes[status ?? ""] ?? classes.planned;
}

function contextLabel(value?: string | null) {
  return ({ company: "Empresa", project: "Projeto", user: "Usuário", tc: "TC", support: "Suporte", release: "Release", delivery: "Entrega" } as Record<string, string>)[value ?? ""] ?? "Agenda";
}

function viewCopy(mode: AgendaViewMode) {
  if (mode === "management") return { eyebrow: "Agendamentos gerais", title: "Calendário geral", description: "Visão por empresa, projeto, usuário, reunião e status." };
  if (mode === "company") return { eyebrow: "Agendamentos da empresa", title: "Calendário da empresa", description: "Somente reuniões da empresa vinculada." };
  return { eyebrow: "Meus agendamentos", title: "Meu calendário", description: "Sua agenda pessoal de reuniões futuras, realizadas e não realizadas." };
}

function buildRequestUrl(mode: AgendaViewMode, selectedCompany: string) {
  const params = new URLSearchParams();
  params.set("scope", mode === "management" ? "all" : mode);
  if ((mode === "management" || mode === "company") && selectedCompany !== "all") params.set("companySlug", selectedCompany);
  return `/api/release-calendar?${params.toString()}`;
}

function buildMonthDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, key: toDateKey(date), inMonth: date.getMonth() === month, isToday: toDateKey(date) === todayKey() };
  });
}

export default function AgendaPage() {
  const searchParams = useSearchParams();
  const { loading, can, normalizedUser, user, accessContext } = usePermissionAccess();
  const [activeView, setActiveView] = useState<AgendaViewMode>(() => readInitialView(searchParams.get("view")));
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [companiesCount, setCompaniesCount] = useState(0);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  useEffect(() => {
    setActiveView(readInitialView(searchParams.get("view")));
  }, [searchParams]);

  const userLike = user as UserLike | null | undefined;
  const roleNames = useMemo(() => Array.from(new Set([accessContext?.role, userLike?.permissionRole, userLike?.role, userLike?.companyRole, ...normalizedUser.roles].map(normalizeRole).filter(Boolean))), [accessContext?.role, normalizedUser.roles, userLike?.companyRole, userLike?.permissionRole, userLike?.role]);
  const agendaManager = isAgendaManager(roleNames, userLike);
  const canViewAgenda = can("release_calendar", "view");
  const canUpdateStatus = can("release_calendar", "status") || can("release_calendar", "edit") || agendaManager;

  const viewOptions = useMemo<ViewOption[]>(() => {
    const options: ViewOption[] = [{ id: "mine", label: "Meus agendamentos", description: "Pessoal", icon: FiUser }];
    if (agendaManager) options.push({ id: "management", label: "Agendamentos gerais", description: "Empresas e equipe", icon: FiUsers });
    if (normalizedUser.companySlugs.length > 0 || !agendaManager) options.push({ id: "company", label: "Empresa", description: "Empresa vinculada", icon: FiBriefcase });
    return options;
  }, [agendaManager, normalizedUser.companySlugs.length]);

  const currentView = viewOptions.some((option) => option.id === activeView) ? activeView : viewOptions[0]?.id ?? "mine";
  const currentCopy = viewCopy(currentView);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    setError(null);
    try {
      const response = await fetch(buildRequestUrl(currentView, selectedCompany), { credentials: "include", cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as CalendarPayload | { error?: string } | null;
      if (!response.ok) throw new Error((payload as { error?: string } | null)?.error ?? "Falha ao carregar agenda");
      setEvents((payload as CalendarPayload)?.events ?? []);
      setCompaniesCount((payload as CalendarPayload)?.calendarSummary?.companies ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar agenda");
      setEvents([]);
      setCompaniesCount(0);
    } finally {
      setLoadingEvents(false);
    }
  }, [currentView, selectedCompany]);

  useEffect(() => { if (!loading && canViewAgenda) void loadEvents(); }, [loading, canViewAgenda, loadEvents]);

  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    normalizedUser.companies.forEach((company) => { if (company.slug) map.set(company.slug, company.name ?? company.slug); });
    events.forEach((event) => { if (event.companySlug) map.set(event.companySlug, event.companyName ?? event.companySlug); });
    return Array.from(map.entries()).map(([slug, label]) => ({ slug, label }));
  }, [events, normalizedUser.companies]);

  const filteredEvents = useMemo(() => {
    const search = normalizeText(query);
    if (!search) return events;
    return events.filter((event) => normalizeText([event.title, event.description, event.companyName, event.companySlug, event.projectSlug, event.ownerName, event.status, ...(event.participantNames ?? [])].filter(Boolean).join(" ")).includes(search));
  }, [events, query]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((event) => {
      const key = eventDayKey(event.startAt);
      map.set(key, [...(map.get(key) ?? []), event]);
    });
    return map;
  }, [filteredEvents]);

  const monthDays = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);
  const selectedDayEvents = (eventsByDay.get(selectedDay) ?? []).sort((a, b) => (a.startAt ?? "").localeCompare(b.startAt ?? ""));

  const counters = useMemo(() => {
    const soon = Date.now() + 5 * 60 * 1000;
    return { total: events.length, visible: filteredEvents.length, planned: events.filter((event) => event.status === "planned").length, done: events.filter((event) => event.status === "done").length, notDone: events.filter((event) => event.status === "cancelled").length, reminder: events.filter((event) => { const start = event.startAt ? Date.parse(event.startAt) : NaN; return Number.isFinite(start) && start >= Date.now() && start <= soon; }).length };
  }, [events, filteredEvents.length]);

  function changeMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  async function updateStatus(id: string, status: AgendaStatus) {
    const response = await fetch("/api/release-calendar", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) { setError(payload?.error ?? "Falha ao atualizar status"); return; }
    await loadEvents();
  }

  if (loading) return <main className="min-h-[calc(100vh-5rem)] bg-slate-50 p-3 text-[#011848] dark:bg-slate-950 dark:text-white"><section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-slate-900">Validando acesso...</section></main>;
  if (!canViewAgenda) return <main className="min-h-[calc(100vh-5rem)] bg-slate-50 p-3 dark:bg-slate-950"><section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-slate-900"><AccessDeniedState title="Agenda não disponível" description="Seu usuário não possui release_calendar:view." /></section></main>;

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-slate-50 p-3 text-[#011848] dark:bg-[#030712] dark:text-white sm:p-4">
      <section className="flex min-h-[calc(100vh-7rem)] w-full flex-col gap-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#0b1220]">
          <div className="grid gap-3 xl:grid-cols-[minmax(220px,360px)_1fr] xl:items-center">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ef0001]">{currentCopy.eyebrow}</p>
              <h1 className="text-xl font-black tracking-tight text-[#011848] dark:text-white sm:text-2xl">{currentCopy.title}</h1>
              <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{currentCopy.description}</p>
            </div>
            <div className="grid gap-2 lg:grid-cols-[minmax(180px,1fr)_auto_auto]">
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"><FiSearch className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar reunião, empresa, projeto ou pessoa..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" /></label>
              {currentView === "company" || currentView === "management" ? <label className="flex min-h-11 min-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"><FiFilter className="h-4 w-4 text-slate-400" /><select value={selectedCompany} onChange={(event) => setSelectedCompany(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none">{agendaManager ? <option value="all">Todas visíveis</option> : null}{companyOptions.map((company) => <option key={company.slug} value={company.slug}>{company.label}</option>)}</select></label> : null}
              <div className="flex flex-wrap gap-2">
                {viewOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = option.id === currentView;
                  return <button key={option.id} type="button" onClick={() => setActiveView(option.id)} className={["inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-xs font-black transition", selected ? "border-[#ef0001] bg-[#ef0001] text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-[#ef0001]/30 hover:text-[#ef0001] dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"].join(" ")}><Icon className="h-4 w-4" />{option.label}</button>;
                })}
                <button type="button" onClick={loadEvents} disabled={loadingEvents} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:border-[#ef0001]/30 hover:text-[#ef0001] dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"><FiRefreshCw className={loadingEvents ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Atualizar</button>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px] font-bold sm:grid-cols-3 xl:grid-cols-6">
            {[["Visíveis", `${counters.visible}/${counters.total}`], ["Futuras", counters.planned], ["Realizadas", counters.done], ["Não realizadas", counters.notDone], ["Empresas", companiesCount || companyOptions.length], ["5 min", counters.reminder]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-slate-950"><span className="block text-slate-500 dark:text-slate-400">{label}</span><strong className="mt-0.5 block text-sm text-[#011848] dark:text-white">{value}</strong></div>)}
          </div>
        </section>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-100">{error}</div> : null}

        <section className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
          <section className="flex min-h-[calc(100vh-17rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0b1220]">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#0b1220] md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ef0001]">Calendário do ano</p>
                <h2 className="text-2xl font-black capitalize text-[#011848] dark:text-white">{monthTitle(visibleMonth)}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => changeMonth(-1)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 hover:border-[#ef0001]/30 hover:text-[#ef0001] dark:border-white/10 dark:bg-slate-950 dark:text-slate-200">← Mês anterior</button>
                <button type="button" onClick={() => { const now = new Date(); setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDay(todayKey()); }} className="rounded-xl border border-[#ef0001] bg-[#ef0001] px-4 py-2 text-sm font-black text-white">Hoje</button>
                <button type="button" onClick={() => changeMonth(1)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 hover:border-[#ef0001]/30 hover:text-[#ef0001] dark:border-white/10 dark:bg-slate-950 dark:text-slate-200">Próximo mês →</button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-400">
              {WEEK_DAYS.map((day) => <div key={day} className="p-3">{day}</div>)}
            </div>

            <div className="grid flex-1 grid-cols-7 grid-rows-6 overflow-hidden bg-slate-100 dark:bg-slate-950/60">
              {monthDays.map((day) => {
                const dayEvents = eventsByDay.get(day.key) ?? [];
                const selected = selectedDay === day.key;
                return (
                  <button key={day.key} type="button" onClick={() => { setSelectedDay(day.key); setExpandedEventId(null); }} className={["min-h-[104px] border-b border-r border-slate-200 p-2 text-left transition dark:border-white/10", day.inMonth ? "bg-white text-[#011848] dark:bg-[#111827] dark:text-white" : "bg-slate-50 text-slate-400 dark:bg-slate-900/50 dark:text-slate-500", selected ? "ring-2 ring-inset ring-[#ef0001]" : "hover:bg-red-50 dark:hover:bg-red-400/10"].join(" ")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={["grid h-7 w-7 place-items-center rounded-full text-sm font-black", day.isToday ? "bg-[#ef0001] text-white" : ""].join(" ")}>{day.date.getDate()}</span>
                      {dayEvents.length ? <span className="rounded-full bg-[#011848] px-2 py-0.5 text-[10px] font-black text-white dark:bg-white dark:text-[#011848]">{dayEvents.length}</span> : null}
                    </div>
                    <div className="mt-2 space-y-1">
                      {dayEvents.slice(0, 3).map((event) => <span key={event.id} className={["block truncate rounded-lg border px-2 py-1 text-[11px] font-bold", statusClass(event.status)].join(" ")}>{formatTime(event.startAt)} · {event.title}</span>)}
                      {dayEvents.length > 3 ? <span className="block rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-950 dark:text-slate-300">+{dayEvents.length - 3} outros</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="min-h-[calc(100vh-17rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0b1220]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ef0001]">Dia selecionado</p>
                <h3 className="text-xl font-black text-[#011848] dark:text-white">{formatDay(selectedDay)}</h3>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-[#011848] dark:border-white/10 dark:bg-slate-950 dark:text-white">{selectedDayEvents.length}</span>
            </div>

            <div className="grid max-h-[calc(100vh-23rem)] gap-3 overflow-y-auto pr-1">
              {selectedDayEvents.map((event) => {
                const expanded = expandedEventId === event.id;
                return <article key={event.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/70"><button type="button" onClick={() => setExpandedEventId(expanded ? null : event.id)} className="w-full p-3 text-left"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400"><FiClock className="text-[#ef0001]" />{formatTime(event.startAt)} - {formatTime(event.endAt)} · {duration(event.startAt, event.endAt)}</p><h4 className="mt-1 truncate text-sm font-black text-[#011848] dark:text-white">{event.title}</h4><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{event.companyName || event.companySlug || contextLabel(event.context)}</p></div><span className={["shrink-0 rounded-full border px-2 py-1 text-[10px] font-black", statusClass(event.status)].join(" ")}>{statusLabel(event.status)}</span></div></button>{expanded ? <div className="border-t border-slate-200 p-3 text-sm dark:border-white/10"><p className="text-slate-600 dark:text-slate-300">{event.description || event.releaseName || "Evento de agenda operacional."}</p><div className="mt-3 grid gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300"><span><strong>Projeto:</strong> {event.projectSlug || "Sem projeto"}</span><span><strong>Responsável:</strong> {event.ownerName || "Sem responsável"}</span><span><strong>Participantes:</strong> {(event.participantNames?.length ? event.participantNames : ["Não informados"]).join(", ")}</span><span className="inline-flex items-center gap-1"><FiMessageCircle className="text-[#ef0001]" />Registro vinculado ao Chat/Brain quando a reunião nascer de conversa.</span></div>{canUpdateStatus ? <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => updateStatus(event.id, "planned")} className="rounded-xl border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-black text-sky-700">Vai acontecer</button><button onClick={() => updateStatus(event.id, "done")} className="rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">Realizada</button><button onClick={() => updateStatus(event.id, "cancelled")} className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-black text-slate-600">Não realizada</button><button onClick={() => updateStatus(event.id, "blocked")} className="rounded-xl border border-red-200 bg-red-50 px-2 py-1 text-xs font-black text-red-700">Bloquear</button></div> : null}</div> : null}</article>;
              })}

              {!loadingEvents && selectedDayEvents.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500 dark:border-white/15 dark:bg-slate-950 dark:text-slate-400"><FiCheckCircle className="mx-auto h-7 w-7 text-emerald-500" /><p className="mt-3 font-bold">Nenhum agendamento neste dia.</p><p className="mt-1 text-sm">Troque o mês, selecione outro dia ou ajuste os filtros.</p></div> : null}
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
