"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import useSWR from "swr";
import { FiBell, FiCalendar, FiCheckCircle, FiClock, FiFilter, FiGrid, FiPlus, FiRefreshCw, FiTarget, FiUserCheck, FiUsers } from "react-icons/fi";

import { fetchApi } from "@/backend/api";

type CalendarEvent = {
  id: string;
  title: string;
  type: string;
  status: string;
  criticality: string;
  context: string;
  markerLabel: string;
  audienceProfiles: string[];
  companyName: string | null;
  companySlug: string | null;
  projectSlug: string | null;
  releaseId: string;
  releaseName: string;
  startAt: string;
  endAt: string;
  ownerName: string | null;
  participantNames: string[];
  description: string;
  checklist: string[];
  notificationRules: string[];
  brianRules: string[];
};

type CalendarPayload = {
  events: CalendarEvent[];
  rules: Array<{ id: string; title: string; description: string; acceptanceCriteria: string[] }>;
  metrics: Array<{ id: string; label: string; formula: string; description: string }>;
  calendarSummary: {
    total: number;
    planned: number;
    atRisk: number;
    blocked: number;
    done: number;
    critical: number;
    releases: number;
    qaWindows: number;
    companies?: number;
    users?: number;
    supportVisible?: number;
  };
};

type CalendarFormState = {
  title: string;
  type: string;
  status: string;
  criticality: string;
  context: string;
  markerLabel: string;
  audienceProfiles: string;
  companySlug: string;
  companyName: string;
  projectSlug: string;
  releaseId: string;
  releaseName: string;
  startAt: string;
  endAt: string;
  ownerName: string;
  participantNames: string;
  description: string;
  checklist: string;
  notificationRules: string;
  brianRules: string;
};

type FilterState = {
  companySlug: string;
  projectSlug: string;
  releaseId: string;
  status: string;
  criticality: string;
  context: string;
  audienceProfile: string;
  ownerName: string;
};

const EVENT_TYPE_OPTIONS = ["discovery", "scope_cut", "dev_freeze", "qa_window", "bug_bash", "uat", "release_candidate", "release", "post_release"];
const STATUS_OPTIONS = ["planned", "at_risk", "blocked", "done", "cancelled"];
const CRITICALITY_OPTIONS = ["critical", "high", "normal", "low"];
const CONTEXT_OPTIONS = ["company", "project", "user", "tc", "support", "release", "delivery"];
const AUDIENCE_PROFILE_OPTIONS = ["all", "empresa", "company_user", "testing_company_user", "leader_tc", "technical_support", "release_actor", "brain"];

const CONTEXT_LABELS: Record<string, string> = { company: "Empresa", project: "Projeto", user: "Usuario", tc: "TC", support: "Suporte", release: "Release", delivery: "Entrega" };
const AUDIENCE_LABELS: Record<string, string> = { all: "Todos", empresa: "Admin empresa", company_user: "Usuario empresa", testing_company_user: "Usuario TC", leader_tc: "Lider TC", technical_support: "Suporte tecnico", release_actor: "Responsavel", brain: "Brain" };
const STATUS_LABELS: Record<string, string> = { planned: "Planejado", at_risk: "Em risco", blocked: "Bloqueado", done: "Concluido", cancelled: "Cancelado" };

const inputClass = "w-full rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]";
const textareaClass = "w-full rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]";

const initialFilters: FilterState = { companySlug: "", projectSlug: "", releaseId: "", status: "", criticality: "", context: "", audienceProfile: "", ownerName: "" };

const initialForm: CalendarFormState = {
  title: "",
  type: "qa_window",
  status: "planned",
  criticality: "normal",
  context: "user",
  markerLabel: "",
  audienceProfiles: "leader_tc\ntechnical_support\nrelease_actor",
  companySlug: "",
  companyName: "",
  projectSlug: "",
  releaseId: "",
  releaseName: "",
  startAt: "",
  endAt: "",
  ownerName: "",
  participantNames: "",
  description: "",
  checklist: "Plano de teste criado\nRuns abertas\nBugs criticos triados\nEvidencias anexadas",
  notificationRules: "Avisar inicio\nAvisar bloqueios\nAvisar encerramento",
  brianRules: "Gerar resumo\nApontar riscos\nRelacionar bugs, runs e conversas",
};

async function fetcher(path: string) {
  const response = await fetchApi(path, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || payload?.message || "Nao foi possivel carregar agenda de release.");
  return payload as CalendarPayload;
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--tc-text-muted,#6b7280)]">{children}</span>;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--tc-text-muted,#6b7280)]">{children}</label>;
}

function splitLines(value: string) {
  return value.split(/\n|,/g).map((item) => item.trim()).filter(Boolean);
}

function toApiDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function dayKey(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) || "sem-data" : date.toISOString().slice(0, 10);
}

function formatDay(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).format(date);
}

function formatDayNumber(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(date);
}

function statusLabel(value: string) {
  return STATUS_LABELS[value] ?? value;
}

function contextLabel(value: string) {
  return CONTEXT_LABELS[value] ?? value;
}

function audienceLabel(value: string) {
  return AUDIENCE_LABELS[value] ?? value;
}

function statusTone(status: string) {
  if (status === "blocked") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "at_risk") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right));
}

function audienceSummary(event: CalendarEvent) {
  if (event.audienceProfiles.includes("all")) return "Todos";
  return event.audienceProfiles.map(audienceLabel).join(" + ");
}

function EventBadges({ event }: { event: CalendarEvent }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusTone(event.status)}`}>{statusLabel(event.status)}</span>
      <Badge>{event.criticality}</Badge>
      <Badge>{contextLabel(event.context)}</Badge>
      {event.companyName || event.companySlug ? <Badge>{event.companyName ?? event.companySlug}</Badge> : null}
      {event.projectSlug ? <Badge>{event.projectSlug}</Badge> : null}
      {event.ownerName ? <Badge>{event.ownerName}</Badge> : null}
      <Badge>{audienceSummary(event)}</Badge>
    </div>
  );
}

function StatCard({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">{label}</p>
      <p className="mt-1 text-2xl font-black text-[var(--tc-text,#0b1a3c)]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--tc-text-muted,#6b7280)]">{note}</p>
    </div>
  );
}

export function ReleaseCalendarPanel() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [form, setForm] = useState<CalendarFormState>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value.trim()) params.set(key, value.trim());
    });
    const query = params.toString();
    return query ? `/api/release-calendar?${query}` : "/api/release-calendar";
  }, [filters]);

  const { data, error, isLoading, mutate } = useSWR(endpoint, fetcher, { refreshInterval: 60000, revalidateOnFocus: false });
  const events = data?.events ?? [];

  const calendarDays = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const key = dayKey(event.startAt);
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    });
    return Array.from(grouped.entries())
      .map(([key, dayEvents]) => ({ key, events: dayEvents.sort((left, right) => left.startAt.localeCompare(right.startAt)) }))
      .sort((left, right) => left.key.localeCompare(right.key));
  }, [events]);

  const activeDayKey = calendarDays.some((day) => day.key === selectedDayKey) ? selectedDayKey : calendarDays[0]?.key ?? null;
  const selectedDayEvents = calendarDays.find((day) => day.key === activeDayKey)?.events ?? [];
  const companyOptions = useMemo(() => uniqueSorted(events.map((event) => event.companySlug ?? event.companyName)), [events]);
  const projectOptions = useMemo(() => uniqueSorted(events.map((event) => event.projectSlug)), [events]);
  const releaseOptions = useMemo(() => uniqueSorted(events.map((event) => event.releaseId)), [events]);
  const ownerOptions = useMemo(() => uniqueSorted(events.flatMap((event) => [event.ownerName, ...event.participantNames])), [events]);

  async function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!form.title.trim() || !form.releaseId.trim() || !form.releaseName.trim() || !form.startAt || !form.endAt) {
      setFormError("Preencha titulo, release, nome da release, inicio e fim.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetchApi("/api/release-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          markerLabel: form.markerLabel || form.title,
          companySlug: form.companySlug || null,
          companyName: form.companyName || null,
          projectSlug: form.projectSlug || null,
          startAt: toApiDateTime(form.startAt),
          endAt: toApiDateTime(form.endAt),
          ownerName: form.ownerName || null,
          audienceProfiles: splitLines(form.audienceProfiles),
          participantNames: splitLines(form.participantNames),
          checklist: splitLines(form.checklist),
          notificationRules: splitLines(form.notificationRules),
          brianRules: splitLines(form.brianRules),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Nao foi possivel criar evento.");
      setForm(initialForm);
      await mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Nao foi possivel criar evento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    setStatusError(null);
    setUpdatingId(id);
    try {
      const response = await fetchApi("/api/release-calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Nao foi possivel atualizar status.");
      await mutate();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Nao foi possivel atualizar status.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="space-y-5">
      <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">
              <FiCalendar className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Agenda de release
            </span>
            <h1 className="mt-3 text-2xl font-black text-[var(--tc-text,#0b1a3c)]">Calendario operacional de entrega</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">
              Calendario unico para Lider TC e Suporte Tecnico acompanharem marcacoes de empresas, projetos, usuarios, horarios, riscos e entregas sem poluir a tela.
            </p>
          </div>
          <button type="button" onClick={() => void mutate()} className="inline-flex items-center gap-2 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-4 py-2 text-sm font-bold text-[var(--tc-text,#0b1a3c)]">
            <FiRefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>
        {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error.message}</div> : null}
        {statusError ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">{statusError}</div> : null}
        <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <StatCard label="Eventos" value={isLoading ? "..." : data?.calendarSummary.total ?? 0} note="Agenda total" />
          <StatCard label="Releases" value={isLoading ? "..." : data?.calendarSummary.releases ?? 0} note="Entregas" />
          <StatCard label="QA" value={isLoading ? "..." : data?.calendarSummary.qaWindows ?? 0} note="Janelas" />
          <StatCard label="Risco" value={isLoading ? "..." : data?.calendarSummary.atRisk ?? 0} note="Atencao" />
          <StatCard label="Bloqueado" value={isLoading ? "..." : data?.calendarSummary.blocked ?? 0} note="Acao" />
          <StatCard label="Empresas" value={isLoading ? "..." : data?.calendarSummary.companies ?? 0} note="Contextos" />
          <StatCard label="Usuarios" value={isLoading ? "..." : data?.calendarSummary.users ?? 0} note="Pessoas" />
          <StatCard label="Suporte" value={isLoading ? "..." : data?.calendarSummary.supportVisible ?? 0} note="Visivel" />
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">
          <FiFilter className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Filtros de visao
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          <div className="space-y-1"><FieldLabel>Empresa</FieldLabel><input list="release-calendar-companies" value={filters.companySlug} onChange={(event) => setFilters((current) => ({ ...current, companySlug: event.target.value }))} className={inputClass} placeholder="testing-company" /></div>
          <div className="space-y-1"><FieldLabel>Projeto</FieldLabel><input list="release-calendar-projects" value={filters.projectSlug} onChange={(event) => setFilters((current) => ({ ...current, projectSlug: event.target.value }))} className={inputClass} placeholder="cid" /></div>
          <div className="space-y-1"><FieldLabel>Usuario</FieldLabel><input list="release-calendar-owners" value={filters.ownerName} onChange={(event) => setFilters((current) => ({ ...current, ownerName: event.target.value }))} className={inputClass} placeholder="QA / suporte" /></div>
          <div className="space-y-1"><FieldLabel>Release</FieldLabel><input list="release-calendar-releases" value={filters.releaseId} onChange={(event) => setFilters((current) => ({ ...current, releaseId: event.target.value }))} className={inputClass} placeholder="cid-2-3-0" /></div>
          <div className="space-y-1"><FieldLabel>Contexto</FieldLabel><select aria-label="Filtrar por contexto" value={filters.context} onChange={(event) => setFilters((current) => ({ ...current, context: event.target.value }))} className={inputClass}><option value="">Todos</option>{CONTEXT_OPTIONS.map((context) => <option key={context} value={context}>{contextLabel(context)}</option>)}</select></div>
          <div className="space-y-1"><FieldLabel>Perfil</FieldLabel><select aria-label="Filtrar por perfil" value={filters.audienceProfile} onChange={(event) => setFilters((current) => ({ ...current, audienceProfile: event.target.value }))} className={inputClass}><option value="">Todos</option>{AUDIENCE_PROFILE_OPTIONS.map((profile) => <option key={profile} value={profile}>{audienceLabel(profile)}</option>)}</select></div>
          <div className="space-y-1"><FieldLabel>Status</FieldLabel><select aria-label="Filtrar por status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className={inputClass}><option value="">Todos</option>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></div>
          <div className="flex items-end"><button type="button" onClick={() => setFilters(initialFilters)} className="w-full rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-sm font-black text-[var(--tc-text,#0b1a3c)]">Limpar</button></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setFilters((current) => ({ ...current, audienceProfile: "leader_tc" }))} className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700"><FiUserCheck /> Visao Lider TC</button>
          <button type="button" onClick={() => setFilters((current) => ({ ...current, audienceProfile: "technical_support" }))} className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-black text-cyan-700"><FiUsers /> Visao Suporte Tecnico</button>
        </div>
        <datalist id="release-calendar-companies">{companyOptions.map((option) => <option key={option} value={option} />)}</datalist>
        <datalist id="release-calendar-projects">{projectOptions.map((option) => <option key={option} value={option} />)}</datalist>
        <datalist id="release-calendar-releases">{releaseOptions.map((option) => <option key={option} value={option} />)}</datalist>
        <datalist id="release-calendar-owners">{ownerOptions.map((option) => <option key={option} value={option} />)}</datalist>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]"><FiGrid className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Calendario visual</div><p className="mt-2 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">Cada dia mostra ate tres marcacoes e esconde o excesso com contador.</p></div>
            <Badge>{calendarDays.length} dias</Badge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {calendarDays.length ? calendarDays.map((day) => {
              const visibleEvents = day.events.slice(0, 3);
              const hiddenCount = Math.max(day.events.length - visibleEvents.length, 0);
              const selected = day.key === activeDayKey;
              return (
                <button key={day.key} type="button" onClick={() => setSelectedDayKey(day.key)} className={`min-h-44 rounded-2xl border p-4 text-left transition ${selected ? "border-[var(--tc-accent,#ef0001)] bg-rose-50" : "border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] hover:bg-white"}`}>
                  <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">{formatDay(day.key)}</p><p className="mt-1 text-3xl font-black text-[var(--tc-text,#0b1a3c)]">{formatDayNumber(day.key)}</p></div><Badge>{day.events.length}</Badge></div>
                  <div className="mt-4 space-y-2">
                    {visibleEvents.map((event) => <div key={event.id} className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-black text-[var(--tc-text,#0b1a3c)]">{event.markerLabel}</span><span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${statusTone(event.status)}`}>{statusLabel(event.status)}</span></div><p className="mt-1 truncate text-[11px] font-semibold text-[var(--tc-text-muted,#6b7280)]">{contextLabel(event.context)} · {event.ownerName ?? event.releaseName}</p></div>)}
                    {hiddenCount ? <div className="rounded-xl border border-dashed border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-xs font-black text-[var(--tc-text-muted,#6b7280)]">+{hiddenCount} marcacoes</div> : null}
                  </div>
                </button>
              );
            }) : <div className="rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-6 text-sm font-semibold text-[var(--tc-text-muted,#6b7280)]">Nenhuma marcacao para os filtros atuais.</div>}
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]"><FiClock className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Marcacoes do dia</div>
          <h2 className="mt-2 text-xl font-black text-[var(--tc-text,#0b1a3c)]">{activeDayKey ? formatDay(activeDayKey) : "Selecione um dia"}</h2>
          <div className="mt-4 space-y-3">
            {selectedDayEvents.length ? selectedDayEvents.map((event) => (
              <article key={event.id} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">{formatDate(event.startAt)} → {formatDate(event.endAt)}</p><h3 className="mt-1 text-base font-black text-[var(--tc-text,#0b1a3c)]">{event.title}</h3></div><select aria-label={`Alterar status de ${event.title}`} value={event.status} disabled={updatingId === event.id} onChange={(changeEvent) => void handleStatusChange(event.id, changeEvent.target.value)} className="rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--tc-text,#0b1a3c)]">{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></div>
                <p className="mt-3 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">{event.description || "Sem descricao cadastrada."}</p>
                <EventBadges event={event} />
                {event.participantNames.length ? <p className="mt-3 text-xs font-semibold leading-5 text-[var(--tc-text-muted,#6b7280)]">Participantes: {event.participantNames.join(", ")}</p> : null}
              </article>
            )) : <div className="rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-6 text-sm font-semibold text-[var(--tc-text-muted,#6b7280)]">Clique em um dia do calendario para abrir as marcacoes.</div>}
          </div>
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-5">
          <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]"><FiPlus className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Cadastrar marcacao de calendario</div>
            <form className="mt-4 space-y-4" onSubmit={handleCreateEvent}>
              {formError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{formError}</div> : null}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2"><FieldLabel>Titulo</FieldLabel><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className={inputClass} placeholder="Janela de regressao CID 2.3.0" /></div>
                <div className="space-y-1"><FieldLabel>Marcacao curta</FieldLabel><input value={form.markerLabel} onChange={(event) => setForm((current) => ({ ...current, markerLabel: event.target.value }))} className={inputClass} placeholder="Regressao CID" /></div>
                <div className="space-y-1"><FieldLabel>Tipo</FieldLabel><select aria-label="Tipo do evento" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} className={inputClass}>{EVENT_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
                <div className="space-y-1"><FieldLabel>Status</FieldLabel><select aria-label="Status do evento" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className={inputClass}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></div>
                <div className="space-y-1"><FieldLabel>Criticidade</FieldLabel><select aria-label="Criticidade do evento" value={form.criticality} onChange={(event) => setForm((current) => ({ ...current, criticality: event.target.value }))} className={inputClass}>{CRITICALITY_OPTIONS.map((criticality) => <option key={criticality} value={criticality}>{criticality}</option>)}</select></div>
                <div className="space-y-1"><FieldLabel>Contexto</FieldLabel><select aria-label="Contexto do evento" value={form.context} onChange={(event) => setForm((current) => ({ ...current, context: event.target.value }))} className={inputClass}>{CONTEXT_OPTIONS.map((context) => <option key={context} value={context}>{contextLabel(context)}</option>)}</select></div>
                <div className="space-y-1"><FieldLabel>Release ID</FieldLabel><input value={form.releaseId} onChange={(event) => setForm((current) => ({ ...current, releaseId: event.target.value }))} className={inputClass} placeholder="cid-2-3-0" /></div>
                <div className="space-y-1"><FieldLabel>Nome da release</FieldLabel><input value={form.releaseName} onChange={(event) => setForm((current) => ({ ...current, releaseName: event.target.value }))} className={inputClass} placeholder="Cidadao Smart 2.3.0" /></div>
                <div className="space-y-1"><FieldLabel>Empresa slug</FieldLabel><input value={form.companySlug} onChange={(event) => setForm((current) => ({ ...current, companySlug: event.target.value }))} className={inputClass} placeholder="testing-company" /></div>
                <div className="space-y-1"><FieldLabel>Empresa nome</FieldLabel><input value={form.companyName} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} className={inputClass} placeholder="Testing Company" /></div>
                <div className="space-y-1"><FieldLabel>Projeto slug</FieldLabel><input value={form.projectSlug} onChange={(event) => setForm((current) => ({ ...current, projectSlug: event.target.value }))} className={inputClass} placeholder="cid" /></div>
                <div className="space-y-1"><FieldLabel>Responsavel</FieldLabel><input value={form.ownerName} onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))} className={inputClass} placeholder="QA / Release Manager" /></div>
                <div className="space-y-1"><FieldLabel>Inicio</FieldLabel><input aria-label="Inicio" type="datetime-local" value={form.startAt} onChange={(event) => setForm((current) => ({ ...current, startAt: event.target.value }))} className={inputClass} /></div>
                <div className="space-y-1"><FieldLabel>Fim</FieldLabel><input aria-label="Fim" type="datetime-local" value={form.endAt} onChange={(event) => setForm((current) => ({ ...current, endAt: event.target.value }))} className={inputClass} /></div>
                <div className="space-y-1"><FieldLabel>Perfis que enxergam</FieldLabel><textarea aria-label="Perfis que enxergam" value={form.audienceProfiles} onChange={(event) => setForm((current) => ({ ...current, audienceProfiles: event.target.value }))} className={`min-h-24 ${textareaClass}`} placeholder="leader_tc, technical_support" /></div>
                <div className="space-y-1"><FieldLabel>Participantes</FieldLabel><textarea aria-label="Participantes" value={form.participantNames} onChange={(event) => setForm((current) => ({ ...current, participantNames: event.target.value }))} className={`min-h-24 ${textareaClass}`} placeholder="Ana, Suporte" /></div>
                <div className="space-y-1 md:col-span-2"><FieldLabel>Descricao</FieldLabel><textarea aria-label="Descricao" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={`min-h-20 ${textareaClass}`} placeholder="O que precisa acontecer nessa janela." /></div>
                <div className="space-y-1"><FieldLabel>Checklist</FieldLabel><textarea aria-label="Checklist" value={form.checklist} onChange={(event) => setForm((current) => ({ ...current, checklist: event.target.value }))} className={`min-h-28 ${textareaClass}`} /></div>
                <div className="space-y-1"><FieldLabel>Notificacoes</FieldLabel><textarea aria-label="Notificacoes" value={form.notificationRules} onChange={(event) => setForm((current) => ({ ...current, notificationRules: event.target.value }))} className={`min-h-28 ${textareaClass}`} /></div>
                <div className="space-y-1 md:col-span-2"><FieldLabel>Brain</FieldLabel><textarea aria-label="Brain" value={form.brianRules} onChange={(event) => setForm((current) => ({ ...current, brianRules: event.target.value }))} className={`min-h-24 ${textareaClass}`} /></div>
              </div>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[var(--tc-accent,#ef0001)] px-4 py-2 text-sm font-black text-white disabled:opacity-60"><FiPlus className="h-4 w-4" /> {saving ? "Salvando..." : "Criar marcacao"}</button>
            </form>
          </section>

          <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]"><FiClock className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Linha do tempo detalhada</div>
            <div className="mt-4 space-y-4">
              {events.length ? events.map((event) => (
                <article key={event.id} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">{event.releaseName} · {event.type}</p><h2 className="mt-1 text-base font-black text-[var(--tc-text,#0b1a3c)]">{event.title}</h2><p className="mt-1 text-xs font-semibold text-[var(--tc-text-muted,#6b7280)]">{formatDate(event.startAt)} → {formatDate(event.endAt)}</p></div>
                    <div className="flex flex-wrap items-center gap-2"><select aria-label={`Status do evento ${event.title}`} value={event.status} disabled={updatingId === event.id} onChange={(changeEvent) => void handleStatusChange(event.id, changeEvent.target.value)} className="rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--tc-text,#0b1a3c)]">{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select><Badge>{event.criticality}</Badge></div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">{event.description}</p>
                  <EventBadges event={event} />
                  <div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-white p-3"><p className="flex items-center gap-2 text-xs font-black text-[var(--tc-text,#0b1a3c)]"><FiCheckCircle /> Checklist</p><ul className="mt-2 space-y-1 text-xs leading-5 text-[var(--tc-text-secondary,#4b5563)]">{event.checklist.map((item) => <li key={item}>• {item}</li>)}</ul></div><div className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-white p-3"><p className="flex items-center gap-2 text-xs font-black text-[var(--tc-text,#0b1a3c)]"><FiBell /> Notificacoes</p><ul className="mt-2 space-y-1 text-xs leading-5 text-[var(--tc-text-secondary,#4b5563)]">{event.notificationRules.map((item) => <li key={item}>• {item}</li>)}</ul></div><div className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-white p-3"><p className="flex items-center gap-2 text-xs font-black text-[var(--tc-text,#0b1a3c)]"><FiTarget /> Brain</p><ul className="mt-2 space-y-1 text-xs leading-5 text-[var(--tc-text-secondary,#4b5563)]">{event.brianRules.map((item) => <li key={item}>• {item}</li>)}</ul></div></div>
                </article>
              )) : <div className="rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-6 text-sm font-semibold text-[var(--tc-text-muted,#6b7280)]">Nenhum evento encontrado para os filtros atuais.</div>}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm"><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]"><FiCheckCircle className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Regras da agenda</div><div className="mt-4 space-y-3">{data?.rules.map((rule) => <article key={rule.id} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4"><h2 className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">{rule.title}</h2><p className="mt-2 text-xs leading-5 text-[var(--tc-text-secondary,#4b5563)]">{rule.description}</p><ul className="mt-3 space-y-1 text-xs leading-5 text-[var(--tc-text-muted,#6b7280)]">{rule.acceptanceCriteria.map((item) => <li key={item}>• {item}</li>)}</ul></article>)}</div></section>
        </div>
      </section>
    </main>
  );
}

