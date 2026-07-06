"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FiBriefcase, FiCalendar, FiCheckCircle, FiChevronDown, FiClock, FiFilter, FiMessageCircle, FiPlus, FiRefreshCw, FiSearch, FiUser, FiUsers } from "react-icons/fi";
import AccessDeniedState from "@/components/access/AccessDeniedState";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";

const VIEW_MODES = ["mine", "company", "management"] as const;
type AgendaViewMode = (typeof VIEW_MODES)[number];
type AgendaStatus = "planned" | "at_risk" | "blocked" | "done" | "cancelled";

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
  ownerName?: string | null;
  status?: string | null;
  criticality?: string | null;
  context?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  audienceProfiles?: string[];
  participantNames?: string[];
  notificationRules?: string[];
  brianRules?: string[];
};

type ReleaseCalendarSummary = { companies?: number; users?: number };
type ReleaseCalendarPayload = { events?: ReleaseCalendarEvent[]; calendarSummary?: ReleaseCalendarSummary };
type UserLike = { role?: string | null; permissionRole?: string | null; companyRole?: string | null; isGlobalAdmin?: boolean | null; is_global_admin?: boolean | null };

type MeetingForm = { title: string; date: string; start: string; end: string; companySlug: string; projectSlug: string; participants: string; description: string; source: "manual" | "chat" };

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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function toDateKey(value?: string | null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "sem-data";
}

function formatDay(value: string) {
  if (value === "sem-data") return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value?: string | null) {
  const parsed = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed)) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(parsed);
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
  const map: Record<string, string> = {
    planned: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-100",
    at_risk: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100",
    blocked: "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-100",
    done: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100",
    cancelled: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  };
  return map[status ?? ""] ?? map.planned;
}

function contextLabel(value?: string | null) {
  return ({ company: "Empresa", project: "Projeto", user: "Usuário", tc: "TC", support: "Suporte", release: "Release", delivery: "Entrega" } as Record<string, string>)[value ?? ""] ?? "Agenda";
}

function viewCopy(mode: AgendaViewMode) {
  if (mode === "management") return { eyebrow: "Agendamento geral", title: "Calendário geral por empresa", description: "Líder TC, Suporte Técnico e Usuário TC filtram por empresa, projeto, usuário, reunião e status." };
  if (mode === "company") return { eyebrow: "Agendamentos da empresa", title: "Calendário da empresa", description: "A empresa visualiza somente os próprios agendamentos e reuniões." };
  return { eyebrow: "Meus agendamentos", title: "Meu calendário", description: "Calendário pessoal para criar, acompanhar e fechar agendamentos futuros ou realizados." };
}

function buildRequestUrl(mode: AgendaViewMode, selectedCompany: string) {
  const params = new URLSearchParams();
  params.set("scope", mode === "management" ? "all" : mode);
  if ((mode === "management" || mode === "company") && selectedCompany !== "all") params.set("companySlug", selectedCompany);
  return `/api/release-calendar?${params.toString()}`;
}

function emptyForm(companySlug = ""): MeetingForm {
  return { title: "Reunião com a equipe", date: todayKey(), start: "09:00", end: "09:30", companySlug, projectSlug: "", participants: "", description: "", source: "manual" };
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
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<MeetingForm>(() => emptyForm());

  const userLike = user as UserLike | null | undefined;
  const roleNames = useMemo(() => Array.from(new Set([accessContext?.role, userLike?.permissionRole, userLike?.role, userLike?.companyRole, ...normalizedUser.roles].map(normalizeRole).filter(Boolean))), [accessContext?.role, normalizedUser.roles, userLike?.companyRole, userLike?.permissionRole, userLike?.role]);
  const agendaManager = isAgendaManager(roleNames, userLike);
  const canViewAgenda = can("release_calendar", "view");
  const canCreateAgenda = can("release_calendar", "create") || agendaManager;
  const canUpdateStatus = can("release_calendar", "status") || can("release_calendar", "edit") || agendaManager;

  const viewOptions = useMemo(() => {
    const options = [{ id: "mine" as const, label: "Meus agendamentos", description: "Calendário pessoal", icon: FiUser }];
    if (agendaManager) options.push({ id: "management", label: "Agendamento geral", description: "Empresa, projeto e equipe", icon: FiUsers });
    if (normalizedUser.companySlugs.length > 0 || !agendaManager) options.push({ id: "company", label: "Agendamentos da empresa", description: "Somente empresa vinculada", icon: FiBriefcase });
    return options;
  }, [agendaManager, normalizedUser.companySlugs.length]);

  const currentView = viewOptions.some((option) => option.id === activeView) ? activeView : viewOptions[0]?.id ?? "mine";
  const currentCopy = viewCopy(currentView);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    setError(null);
    try {
      const response = await fetch(buildRequestUrl(currentView, selectedCompany), { credentials: "include", cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as ReleaseCalendarPayload | { error?: string } | null;
      if (!response.ok) throw new Error((payload as { error?: string } | null)?.error ?? "Falha ao carregar agenda");
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
    const map = new Map<string, ReleaseCalendarEvent[]>();
    filteredEvents.forEach((event) => map.set(toDateKey(event.startAt), [...(map.get(toDateKey(event.startAt)) ?? []), event]));
    return Array.from(map.entries()).map(([key, dayEvents]) => ({ key, events: dayEvents.sort((a, b) => (a.startAt ?? "").localeCompare(b.startAt ?? "")) })).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredEvents]);

  useEffect(() => { if (eventsByDay.length && !eventsByDay.some((day) => day.key === selectedDay)) setSelectedDay(eventsByDay[0].key); }, [eventsByDay, selectedDay]);

  const selectedDayEvents = eventsByDay.find((day) => day.key === selectedDay)?.events ?? [];
  const counters = useMemo(() => {
    const soon = Date.now() + 5 * 60 * 1000;
    return { visible: filteredEvents.length, total: events.length, planned: events.filter((event) => event.status === "planned").length, done: events.filter((event) => event.status === "done").length, blocked: events.filter((event) => event.status === "blocked").length, notDone: events.filter((event) => event.status === "cancelled").length, reminder: events.filter((event) => { const start = event.startAt ? Date.parse(event.startAt) : NaN; return Number.isFinite(start) && start >= Date.now() && start <= soon; }).length };
  }, [events, filteredEvents.length]);

  async function createMeeting() {
    if (!form.title.trim() || !form.date || !form.start || !form.end) { setError("Preencha título, data, início e fim."); return; }
    const company = companyOptions.find((item) => item.slug === form.companySlug);
    const response = await fetch("/api/release-calendar", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.title.trim(), type: form.source === "chat" ? "uat" : "discovery", status: "planned", criticality: "normal", context: currentView === "mine" ? "user" : form.projectSlug ? "project" : "company", markerLabel: form.source === "chat" ? "Chat" : "Reunião", audienceProfiles: currentView === "company" ? ["empresa", "company_user", "release_actor", "brain"] : ["leader_tc", "technical_support", "testing_company_user", "release_actor", "brain"], companySlug: form.companySlug || null, companyName: company?.label ?? null, projectSlug: form.projectSlug.trim() || null, releaseId: `agenda-${Date.now()}`, releaseName: form.title.trim(), startAt: `${form.date}T${form.start}:00.000-03:00`, endAt: `${form.date}T${form.end}:00.000-03:00`, participantNames: form.participants.split(/\n|,/g).map((item) => item.trim()).filter(Boolean), description: form.description.trim() || "Reunião registrada pela Agenda.", notificationRules: ["Notificar 5 minutos antes", "Registrar realizada ou não realizada"], brianRules: ["Vincular conversa quando nascer do Chat", "Guardar resumo, duração e participantes"] }) });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) { setError(payload?.error ?? "Falha ao criar agendamento"); return; }
    setShowCreate(false); setForm(emptyForm(selectedCompany === "all" ? "" : selectedCompany)); setSelectedDay(form.date); await loadEvents();
  }

  async function updateStatus(id: string, status: AgendaStatus) {
    const response = await fetch("/api/release-calendar", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) { setError(payload?.error ?? "Falha ao atualizar status"); return; }
    await loadEvents();
  }

  if (loading) return <main className="min-h-[calc(100vh-6rem)] px-4 py-5 text-[#011848] dark:text-white sm:px-6 lg:px-8"><section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-8 shadow-xl dark:border-white/10 dark:bg-slate-950/70">Validando acesso...</section></main>;
  if (!canViewAgenda) return <main className="min-h-[calc(100vh-6rem)] px-4 py-5 sm:px-6 lg:px-8"><section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-8 shadow-xl dark:border-white/10 dark:bg-slate-950/70"><AccessDeniedState title="Agenda não disponível" description="Seu usuário não possui release_calendar:view." /></section></main>;

  return (
    <main className="min-h-[calc(100vh-6rem)] px-4 py-5 text-[#011848] dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="overflow-hidden rounded-[2rem] border border-white/20 bg-[linear-gradient(135deg,#011848_0%,#06235f_48%,#8f0000_78%,#ef0001_100%)] p-5 text-white shadow-2xl shadow-slate-950/20 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4"><div className="grid h-16 w-16 place-items-center rounded-3xl border border-white/25 bg-white/95 text-[#ef0001]"><FiCalendar className="h-8 w-8" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/65">{currentCopy.eyebrow}</p><h1 className="mt-1 text-3xl font-black sm:text-4xl">Agenda</h1><p className="mt-2 max-w-3xl text-sm text-white/78 sm:text-base">{currentCopy.description}</p></div></div>
            <div className="flex flex-wrap gap-2">{canCreateAgenda ? <button type="button" onClick={() => setShowCreate((value) => !value)} className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white px-4 py-3 text-sm font-bold text-[#011848]"><FiPlus /> Novo agendamento</button> : null}<button type="button" onClick={loadEvents} disabled={loadingEvents} className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/12 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"><FiRefreshCw className={loadingEvents ? "animate-spin" : ""} /> Atualizar</button></div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">{viewOptions.map((option) => { const Icon = option.icon; const selected = option.id === currentView; return <button key={option.id} type="button" onClick={() => setActiveView(option.id)} className={["rounded-3xl border p-4 text-left shadow-sm transition", selected ? "border-[#ef0001]/40 bg-white text-[#011848] shadow-xl dark:border-red-400/35 dark:bg-slate-900 dark:text-white" : "border-slate-200 bg-white/70 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-slate-900/55 dark:text-slate-200"].join(" ")}><div className="flex items-center gap-3"><span className={selected ? "grid h-11 w-11 place-items-center rounded-2xl bg-[#ef0001] text-white" : "grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"}><Icon className="h-5 w-5" /></span><span><strong className="block text-sm font-black sm:text-base">{option.label}</strong><small className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{option.description}</small></span></div></button>; })}</section>

        {showCreate ? <section className="rounded-[2rem] border border-red-200/70 bg-white p-5 shadow-xl dark:border-red-400/20 dark:bg-slate-950/80"><p className="text-xs font-bold uppercase tracking-[0.28em] text-[#ef0001]">Criar reunião</p><h2 className="text-2xl font-black">Novo agendamento</h2><div className="mt-4 grid gap-3 lg:grid-cols-4"><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-slate-900 lg:col-span-2" /><input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-slate-900" /><select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as MeetingForm["source"] }))} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-slate-900"><option value="manual">Manual</option><option value="chat">Chat/conversa</option></select><input type="time" value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-slate-900" /><input type="time" value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-slate-900" /><select value={form.companySlug} onChange={(e) => setForm((f) => ({ ...f, companySlug: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-slate-900"><option value="">Sem empresa</option>{companyOptions.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}</select><input value={form.projectSlug} onChange={(e) => setForm((f) => ({ ...f, projectSlug: e.target.value }))} placeholder="Projeto" className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-slate-900" /><input value={form.participants} onChange={(e) => setForm((f) => ({ ...f, participants: e.target.value }))} placeholder="Participantes por vírgula" className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-slate-900 lg:col-span-2" /><textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Pauta, objetivo e detalhes" className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-slate-900 lg:col-span-2" /></div><div className="mt-4 flex justify-end gap-2"><button onClick={() => setShowCreate(false)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold dark:border-white/10">Cancelar</button><button onClick={createMeeting} className="rounded-2xl bg-[#ef0001] px-5 py-3 text-sm font-black text-white">Salvar</button></div></section> : null}

        <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-4 shadow-xl dark:border-white/10 dark:bg-slate-950/70 sm:p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.28em] text-[#ef0001]">{currentCopy.eyebrow}</p><h2 className="mt-1 text-2xl font-black">{currentCopy.title}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Clique no dia para expandir reuniões; clique na reunião para ver participantes, detalhes, duração e status.</p></div><div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_minmax(190px,auto)] xl:min-w-[620px]"><label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-900"><FiSearch /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por empresa, projeto, pessoa..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>{currentView === "company" || currentView === "management" ? <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-900"><FiFilter /><select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none">{agendaManager ? <option value="all">Todas visíveis</option> : null}{companyOptions.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}</select></label> : null}</div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{[["Visíveis", `${counters.visible}/${counters.total}`], ["Vai acontecer", counters.planned], ["Realizadas", counters.done], ["Não realizadas", counters.notDone], ["Empresas", summary?.companies ?? companyOptions.length], ["Lembrete 5 min", counters.reminder]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900/80"><small className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</small><strong className="mt-1 block text-xl">{value}</strong></div>)}</div></section>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-100">{error}</div> : null}

        <section className="grid gap-4 xl:grid-cols-[420px,1fr]"><div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-4 shadow-xl dark:border-white/10 dark:bg-slate-950/70"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ef0001]">Calendário</p><h3 className="text-xl font-black">Dias com reuniões</h3></div>{loadingEvents ? <FiRefreshCw className="animate-spin" /> : null}</div><div className="grid gap-3">{eventsByDay.map((day) => { const selected = day.key === selectedDay; return <button key={day.key} type="button" onClick={() => setSelectedDay(day.key)} className={["rounded-3xl border p-4 text-left transition", selected ? "border-[#ef0001]/45 bg-red-50 dark:border-red-400/30 dark:bg-red-400/10" : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900/60"].join(" ")}><div className="flex items-start justify-between gap-3"><div><strong className="block text-sm font-black">{formatDay(day.key)}</strong><span className="mt-1 block text-xs text-slate-500">{day.events.length} reunião(ões)</span></div><FiChevronDown className={selected ? "rotate-180 text-[#ef0001]" : "text-slate-400"} /></div><div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold"><span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">{day.events.filter((e) => e.status === "planned").length} futuras</span><span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">{day.events.filter((e) => e.status === "done").length} realizadas</span></div></button>; })}{!loadingEvents && !eventsByDay.length ? <div className="rounded-[2rem] border border-dashed border-slate-300 p-8 text-center text-slate-500"><FiCheckCircle className="mx-auto h-7 w-7 text-emerald-500" /><p className="mt-3 font-bold">Nenhum dia encontrado.</p></div> : null}</div></div>

          <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-4 shadow-xl dark:border-white/10 dark:bg-slate-950/70"><div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ef0001]">Detalhes do dia</p><h3 className="text-xl font-black">{formatDay(selectedDay)}</h3></div><span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold dark:border-white/10 dark:bg-slate-900">{selectedDayEvents.length} reunião(ões)</span></div><div className="grid gap-3">{selectedDayEvents.map((event) => { const expanded = expandedEventId === event.id; return <article key={event.id} className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900/60"><button type="button" onClick={() => setExpandedEventId(expanded ? null : event.id)} className="w-full p-4 text-left"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500"><span className="inline-flex items-center gap-1"><FiClock className="text-[#ef0001]" />{formatDateTime(event.startAt)}</span><span>{duration(event.startAt, event.endAt)}</span><span>{contextLabel(event.context)}</span></div><h4 className="mt-2 text-lg font-black">{event.title}</h4><p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{event.description || event.releaseName || "Evento de agenda operacional."}</p></div><span className={["inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold", statusClass(event.status)].join(" ")}>{statusLabel(event.status)}</span></div></button>{expanded ? <div className="border-t border-slate-200 p-4 dark:border-white/10"><div className="grid gap-3 md:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/60"><small className="font-bold text-slate-500">Empresa e projeto</small><p className="mt-1 text-sm font-semibold">{event.companyName || event.companySlug || "Sem empresa"}</p><p className="text-xs text-slate-500">{event.projectSlug ? `Projeto: ${event.projectSlug}` : "Sem projeto"}</p></div><div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/60"><small className="font-bold text-slate-500">Responsável</small><p className="mt-1 text-sm font-semibold">{event.ownerName || "Sem responsável"}</p><p className="text-xs text-slate-500">Fim: {formatDateTime(event.endAt)}</p></div></div><div className="mt-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/60"><small className="font-bold text-slate-500">Participantes</small><div className="mt-2 flex flex-wrap gap-2">{(event.participantNames?.length ? event.participantNames : ["Participantes não informados"]).map((p) => <span key={p} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-300">{p}</span>)}</div></div><div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-950/60 dark:text-slate-300"><FiMessageCircle className="mb-2 text-[#ef0001]" />Registro de Chat/Brain: quando a conversa gerar reunião, a agenda guarda horário, participantes, empresa, duração, status e histórico.</div>{canUpdateStatus ? <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => updateStatus(event.id, "planned")} className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">Vai acontecer</button><button onClick={() => updateStatus(event.id, "done")} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">Realizada</button><button onClick={() => updateStatus(event.id, "cancelled")} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600">Não realizada</button><button onClick={() => updateStatus(event.id, "blocked")} className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700">Bloquear</button></div> : null}</div> : null}</article>; })}{!loadingEvents && selectedDayEvents.length === 0 ? <div className="rounded-[2rem] border border-dashed border-slate-300 p-8 text-center text-slate-500"><FiMessageCircle className="mx-auto h-7 w-7 text-[#ef0001]" /><p className="mt-3 font-bold">Nenhuma reunião neste dia.</p></div> : null}</div></div></section>
      </section>
    </main>
  );
}
