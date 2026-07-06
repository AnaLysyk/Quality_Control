"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiBriefcase, FiCalendar, FiRefreshCw, FiSearch, FiUser, FiUsers } from "react-icons/fi";
import AccessDeniedState from "@/components/access/AccessDeniedState";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import MeetingScheduler, { type AgendaCompanyOption } from "./_components/MeetingScheduler";

type AgendaViewMode = "mine" | "company" | "management";
type CalendarEvent = { id: string; title: string; description?: string | null; companyName?: string | null; companySlug?: string | null; status?: string | null; startAt?: string | null; endAt?: string | null; participantNames?: string[]; markerLabel?: string | null; criticality?: string | null };
type CalendarPayload = { events?: CalendarEvent[]; calendarSummary?: { companies?: number } };
type UserLike = { role?: string | null; permissionRole?: string | null; companyRole?: string | null; isGlobalAdmin?: boolean | null; is_global_admin?: boolean | null };

function normalizeRole(value: unknown) { return typeof value === "string" ? value.trim().toLowerCase() : ""; }
function normalizeText(value: string) { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function isAgendaManager(roles: string[], user: UserLike | null | undefined) { return user?.isGlobalAdmin === true || user?.is_global_admin === true || roles.some((role) => ["leader_tc", "technical_support", "testing_company_user"].includes(role)); }
function formatTime(value?: string | null) { const parsed = value ? Date.parse(value) : NaN; return Number.isFinite(parsed) ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(parsed) : "Sem data"; }
function statusLabel(value?: string | null) { return ({ planned: "Vai acontecer", at_risk: "Atenção", blocked: "Bloqueada", done: "Realizada", cancelled: "Não realizada" } as Record<string, string>)[value ?? ""] ?? "Sem status"; }
function requestUrl(view: AgendaViewMode, companySlug: string) { const params = new URLSearchParams(); params.set("scope", view === "management" ? "all" : view); if ((view === "management" || view === "company") && companySlug !== "all") params.set("companySlug", companySlug); return `/api/release-calendar?${params.toString()}`; }

export default function AgendaPage() {
  const { loading, can, normalizedUser, user, accessContext } = usePermissionAccess();
  const [view, setView] = useState<AgendaViewMode>("mine");
  const [companySlug, setCompanySlug] = useState("all");
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [companiesCount, setCompaniesCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userLike = user as UserLike | null | undefined;
  const roles = useMemo(() => Array.from(new Set([accessContext?.role, userLike?.permissionRole, userLike?.role, userLike?.companyRole, ...normalizedUser.roles].map(normalizeRole).filter(Boolean))), [accessContext?.role, normalizedUser.roles, userLike?.companyRole, userLike?.permissionRole, userLike?.role]);
  const manager = isAgendaManager(roles, userLike);
  const isCompanyProfile = roles.some((role) => role === "empresa" || role === "company_user");
  const canViewAgenda = can("release_calendar", "view");

  const loadEvents = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const response = await fetch(requestUrl(view, companySlug), { credentials: "include", cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as CalendarPayload | { error?: string } | null;
      if (!response.ok) throw new Error((payload as { error?: string } | null)?.error ?? "Falha ao carregar agenda");
      setEvents((payload as CalendarPayload)?.events ?? []);
      setCompaniesCount((payload as CalendarPayload)?.calendarSummary?.companies ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar agenda"); setEvents([]); setCompaniesCount(0);
    } finally { setBusy(false); }
  }, [view, companySlug]);

  useEffect(() => { if (!loading && canViewAgenda) void loadEvents(); }, [loading, canViewAgenda, loadEvents]);

  const companies = useMemo<AgendaCompanyOption[]>(() => {
    const map = new Map<string, string>();
    normalizedUser.companies.forEach((company) => { if (company.slug) map.set(company.slug, company.name ?? company.slug); });
    normalizedUser.companySlugs.forEach((slug) => { if (slug) map.set(slug, map.get(slug) ?? slug); });
    events.forEach((event) => { if (event.companySlug) map.set(event.companySlug, event.companyName ?? event.companySlug); });
    return Array.from(map.entries()).map(([slug, label]) => ({ slug, label }));
  }, [events, normalizedUser.companies, normalizedUser.companySlugs]);

  const filtered = useMemo(() => { const search = normalizeText(query); if (!search) return events; return events.filter((event) => normalizeText([event.title, event.markerLabel, event.description, event.companyName, event.companySlug, event.status, event.criticality, ...(event.participantNames ?? [])].filter(Boolean).join(" ")).includes(search)); }, [events, query]);

  if (loading) return <main className="min-h-screen bg-slate-50 p-4 text-[#011848] dark:bg-slate-950 dark:text-white">Validando acesso...</main>;
  if (!canViewAgenda) return <main className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950"><AccessDeniedState title="Agenda não disponível" description="Seu usuário não possui release_calendar:view." /></main>;

  return (
    <main className="min-h-screen bg-slate-50 p-3 text-[#011848] dark:bg-[#030712] dark:text-white sm:p-4">
      <section className="mx-auto flex max-w-7xl flex-col gap-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#0b1220]">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ef0001]">Agenda</p><h1 className="text-2xl font-black">Calendário em tela cheia</h1><p className="text-sm text-slate-500 dark:text-slate-400">Reuniões, ligações e agendamentos por usuário, empresa e gestão.</p></div><button onClick={loadEvents} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black"><FiRefreshCw className={busy ? "animate-spin" : ""} />Atualizar</button></div>
          <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto_auto]"><label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-white/10 dark:bg-slate-950"><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><select value={view} onChange={(event) => setView(event.target.value as AgendaViewMode)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-black dark:border-white/10 dark:bg-slate-950"><option value="mine">Meus agendamentos</option>{manager ? <option value="management">Agendamentos gerais</option> : null}<option value="company">Empresa</option></select>{view !== "mine" ? <select value={companySlug} onChange={(event) => setCompanySlug(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-black dark:border-white/10 dark:bg-slate-950">{manager ? <option value="all">Todas visíveis</option> : null}{companies.map((company) => <option key={company.slug} value={company.slug}>{company.label}</option>)}</select> : null}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs font-bold sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950">Visíveis<br /><strong>{filtered.length}/{events.length}</strong></div><div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950">Empresas<br /><strong>{companiesCount || companies.length}</strong></div><div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950">Futuras<br /><strong>{events.filter((event) => event.status === "planned").length}</strong></div><div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950">Realizadas<br /><strong>{events.filter((event) => event.status === "done").length}</strong></div></div>
        </section>
        <MeetingScheduler view={view} companies={companies} canSeeAllCompanies={manager} isCompanyProfile={isCompanyProfile} onCreated={loadEvents} />
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-100">{error}</div> : null}
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((event) => <article key={event.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0b1220]"><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-bold text-slate-500"><FiClock className="text-[#ef0001]" />{formatTime(event.startAt)} - {formatTime(event.endAt)}</p><h2 className="mt-2 text-lg font-black">{event.title}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{event.companyName || event.companySlug || "Agenda pessoal"}</p></div><span className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-black dark:border-white/10">{statusLabel(event.status)}</span></div><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{event.description || event.releaseName || "Evento de agenda."}</p><p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-slate-500"><FiMessageCircle className="text-[#ef0001]" />Vinculado ao Chat/Brain quando nascer de conversa.</p></article>)}
          {!busy && filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 dark:border-white/15 dark:bg-[#0b1220]"><FiCheckCircle className="mx-auto h-7 w-7 text-emerald-500" /><p className="mt-3 font-bold">Nenhum agendamento encontrado.</p></div> : null}
        </section>
      </section>
    </main>
  );
}
