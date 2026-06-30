"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import useSWR from "swr";
import { FiAlertTriangle, FiBell, FiCalendar, FiCheckCircle, FiClock, FiFilter, FiFlag, FiPlus, FiRefreshCw, FiTarget } from "react-icons/fi";

import { fetchApi } from "@/lib/api";

type CalendarEvent = {
  id: string;
  title: string;
  type: string;
  status: string;
  criticality: string;
  companyName: string | null;
  companySlug: string | null;
  projectSlug: string | null;
  releaseId: string;
  releaseName: string;
  startAt: string;
  endAt: string;
  ownerName: string | null;
  description: string;
  checklist: string[];
  notificationRules: string[];
  brianRules: string[];
};

type CalendarPayload = {
  generatedAt: string;
  events: CalendarEvent[];
  rules: Array<{ id: string; title: string; description: string; acceptanceCriteria: string[] }>;
  metrics: Array<{ id: string; label: string; formula: string; description: string }>;
  eventTypes: string[];
  statuses: string[];
  calendarSummary: {
    total: number;
    planned: number;
    atRisk: number;
    blocked: number;
    done: number;
    critical: number;
    releases: number;
    qaWindows: number;
  };
  summary: {
    rules: number;
    metrics: number;
    templates: number;
    eventTypes: number;
    statuses: number;
  };
};

type CalendarFormState = {
  title: string;
  type: string;
  status: string;
  criticality: string;
  companySlug: string;
  companyName: string;
  projectSlug: string;
  releaseId: string;
  releaseName: string;
  startAt: string;
  endAt: string;
  ownerName: string;
  description: string;
  checklist: string;
  notificationRules: string;
  brianRules: string;
};

const EVENT_TYPE_OPTIONS = [
  "discovery",
  "scope_cut",
  "dev_freeze",
  "qa_window",
  "bug_bash",
  "uat",
  "release_candidate",
  "release",
  "post_release",
];

const STATUS_OPTIONS = ["planned", "at_risk", "blocked", "done", "cancelled"];
const CRITICALITY_OPTIONS = ["critical", "high", "normal", "low"];

const initialForm: CalendarFormState = {
  title: "",
  type: "qa_window",
  status: "planned",
  criticality: "normal",
  companySlug: "",
  companyName: "",
  projectSlug: "",
  releaseId: "",
  releaseName: "",
  startAt: "",
  endAt: "",
  ownerName: "",
  description: "",
  checklist: "Plano de teste criado\nRuns abertas\nBugs críticos triados\nEvidências anexadas",
  notificationRules: "Avisar início\nAvisar bloqueios\nAvisar encerramento",
  brianRules: "Gerar resumo\nApontar riscos\nRelacionar bugs, runs e conversas",
};

async function fetcher(path: string) {
  const response = await fetchApi(path, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "Nao foi possivel carregar agenda de release.");
  }
  return payload as CalendarPayload;
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-(--tc-border,#d7deea) bg-white px-2.5 py-1 text-[11px] font-bold text-(--tc-text-muted,#6b7280)">{children}</span>;
}

function StatCard({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">{label}</p>
      <p className="mt-1 text-2xl font-black text-(--tc-text,#0b1a3c)">{value}</p>
      <p className="mt-1 text-xs leading-5 text-(--tc-text-muted,#6b7280)">{note}</p>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-[10px] font-black uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">{children}</label>;
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toApiDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ReleaseCalendarPanel() {
  const [filters, setFilters] = useState({ companySlug: "", projectSlug: "", releaseId: "", status: "" });
  const [form, setForm] = useState<CalendarFormState>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.companySlug.trim()) params.set("companySlug", filters.companySlug.trim());
    if (filters.projectSlug.trim()) params.set("projectSlug", filters.projectSlug.trim());
    if (filters.releaseId.trim()) params.set("releaseId", filters.releaseId.trim());
    if (filters.status.trim()) params.set("status", filters.status.trim());
    const query = params.toString();
    return query ? `/api/release-calendar?${query}` : "/api/release-calendar";
  }, [filters]);

  const { data, error, isLoading, mutate } = useSWR(endpoint, fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
  });

  async function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!form.title.trim() || !form.releaseId.trim() || !form.releaseName.trim() || !form.startAt || !form.endAt) {
      setFormError("Preencha título, release, nome da release, início e fim.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetchApi("/api/release-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          type: form.type,
          status: form.status,
          criticality: form.criticality,
          companySlug: form.companySlug || null,
          companyName: form.companyName || null,
          projectSlug: form.projectSlug || null,
          releaseId: form.releaseId,
          releaseName: form.releaseName,
          startAt: toApiDateTime(form.startAt),
          endAt: toApiDateTime(form.endAt),
          ownerName: form.ownerName || null,
          description: form.description,
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

  return (
    <main className="space-y-5">
      <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
              <FiCalendar className="h-4 w-4 text-(--tc-accent,#ef0001)" /> Agenda de release
            </span>
            <h1 className="mt-3 text-2xl font-black text-(--tc-text,#0b1a3c)">Calendário operacional de entrega</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
              Lugar único para enxergar corte de escopo, freeze, janela de QA, homologação, entrega, riscos, notificações e memória do Brain por empresa e projeto.
            </p>
          </div>
          <button type="button" onClick={() => void mutate()} className="inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-bold text-(--tc-text,#0b1a3c)">
            <FiRefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error.message}</div> : null}

        <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <StatCard label="Eventos" value={isLoading ? "..." : data?.calendarSummary.total ?? 0} note="Agenda total" />
          <StatCard label="Releases" value={isLoading ? "..." : data?.calendarSummary.releases ?? 0} note="Entregas mapeadas" />
          <StatCard label="QA" value={isLoading ? "..." : data?.calendarSummary.qaWindows ?? 0} note="Janelas de teste" />
          <StatCard label="Planejado" value={isLoading ? "..." : data?.calendarSummary.planned ?? 0} note="Dentro do fluxo" />
          <StatCard label="Risco" value={isLoading ? "..." : data?.calendarSummary.atRisk ?? 0} note="Atenção antes do atraso" />
          <StatCard label="Bloqueado" value={isLoading ? "..." : data?.calendarSummary.blocked ?? 0} note="Precisa ação" />
          <StatCard label="Crítico" value={isLoading ? "..." : data?.calendarSummary.critical ?? 0} note="Não pode sumir" />
          <StatCard label="Concluído" value={isLoading ? "..." : data?.calendarSummary.done ?? 0} note="Finalizados" />
        </div>
      </section>

      <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
          <FiFilter className="h-4 w-4 text-(--tc-accent,#ef0001)" /> Filtros
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <FieldLabel>Empresa slug</FieldLabel>
            <input value={filters.companySlug} onChange={(event) => setFilters((current) => ({ ...current, companySlug: event.target.value }))} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)" placeholder="testing-company" />
          </div>
          <div className="space-y-1">
            <FieldLabel>Projeto slug</FieldLabel>
            <input value={filters.projectSlug} onChange={(event) => setFilters((current) => ({ ...current, projectSlug: event.target.value }))} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)" placeholder="quality-control" />
          </div>
          <div className="space-y-1">
            <FieldLabel>Release ID</FieldLabel>
            <input value={filters.releaseId} onChange={(event) => setFilters((current) => ({ ...current, releaseId: event.target.value }))} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)" placeholder="release-2-3-0" />
          </div>
          <div className="space-y-1">
            <FieldLabel>Status</FieldLabel>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button type="button" onClick={() => setFilters({ companySlug: "", projectSlug: "", releaseId: "", status: "" })} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-black text-(--tc-text,#0b1a3c)">
              Limpar filtros
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-5">
          <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
              <FiPlus className="h-4 w-4 text-(--tc-accent,#ef0001)" /> Cadastrar evento de release
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleCreateEvent}>
              {formError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{formError}</div> : null}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2">
                  <FieldLabel>Título</FieldLabel>
                  <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)" placeholder="Janela de regressão CID 2.3.0" />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Tipo</FieldLabel>
                  <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                    {EVENT_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <FieldLabel>Status</FieldLabel>
                  <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                    {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <FieldLabel>Criticidade</FieldLabel>
                  <select value={form.criticality} onChange={(event) => setForm((current) => ({ ...current, criticality: event.target.value }))} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                    {CRITICALITY_OPTIONS.map((criticality) => <option key={criticality} value={criticality}>{criticality}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <FieldLabel>Release ID</FieldLabel>
                  <input value={form.releaseId} onChange={(event) => setForm((current) => ({ ...current, releaseId: event.target.value }))} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)" placeholder="cid-2-3-0" />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Nome da release</FieldLabel>
                  <input value={form.releaseName} onChange={(event) => setForm((current) => ({ ...current, releaseName: event.target.value }))} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)" placeholder="Cidadão Smart 2.3.0" />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Empresa slug</FieldLabel>
                  <input value={form.companySlug} onChange={(event) => setForm((current) => ({ ...current, companySlug: event.target.value }))} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)" placeholder="testing-company" />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Empresa nome</FieldLabel>
                  <input value={form.companyName} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)" placeholder="Testing Company" />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Projeto slug</FieldLabel>
                  <input value={form.projectSlug} onChange={(event) => setForm((current) => ({ ...current, projectSlug: event.target.value }))} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)" placeholder="cid" />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Responsável</FieldLabel>
                  <input value={form.ownerName} onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)" placeholder="QA / Release Manager" />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Início</FieldLabel>
                  <input type="datetime-local" value={form.startAt} onChange={(event) => setForm((current) => ({ ...current, startAt: event.target.value }))} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)" />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Fim</FieldLabel>
                  <input type="datetime-local" value={form.endAt} onChange={(event) => setForm((current) => ({ ...current, endAt: event.target.value }))} className="w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <FieldLabel>Descrição</FieldLabel>
                  <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="min-h-20 w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)" placeholder="O que precisa acontecer nessa janela." />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Checklist</FieldLabel>
                  <textarea value={form.checklist} onChange={(event) => setForm((current) => ({ ...current, checklist: event.target.value }))} className="min-h-28 w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)" />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Notificações</FieldLabel>
                  <textarea value={form.notificationRules} onChange={(event) => setForm((current) => ({ ...current, notificationRules: event.target.value }))} className="min-h-28 w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <FieldLabel>Brain</FieldLabel>
                  <textarea value={form.brianRules} onChange={(event) => setForm((current) => ({ ...current, brianRules: event.target.value }))} className="min-h-24 w-full rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)" />
                </div>
              </div>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-black text-white disabled:opacity-60">
                <FiPlus className="h-4 w-4" /> {saving ? "Salvando..." : "Criar evento"}
              </button>
            </form>
          </section>

          <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
              <FiClock className="h-4 w-4 text-(--tc-accent,#ef0001)" /> Linha do tempo
            </div>

            <div className="mt-4 space-y-4">
              {data?.events.length ? data.events.map((event) => (
                <article key={event.id} className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">{event.releaseName} · {event.type}</p>
                      <h2 className="mt-1 text-base font-black text-(--tc-text,#0b1a3c)">{event.title}</h2>
                      <p className="mt-1 text-xs font-semibold text-(--tc-text-muted,#6b7280)">{formatDate(event.startAt)} → {formatDate(event.endAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{event.status}</Badge>
                      <Badge>{event.criticality}</Badge>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{event.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {event.companyName || event.companySlug ? <Badge>{event.companyName ?? event.companySlug}</Badge> : null}
                    {event.projectSlug ? <Badge>{event.projectSlug}</Badge> : null}
                    {event.ownerName ? <Badge>{event.ownerName}</Badge> : null}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-(--tc-border,#d7deea) bg-white p-3">
                      <p className="flex items-center gap-2 text-xs font-black text-(--tc-text,#0b1a3c)"><FiCheckCircle /> Checklist</p>
                      <ul className="mt-2 space-y-1 text-xs leading-5 text-(--tc-text-secondary,#4b5563)">
                        {event.checklist.map((item) => <li key={item}>• {item}</li>)}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-(--tc-border,#d7deea) bg-white p-3">
                      <p className="flex items-center gap-2 text-xs font-black text-(--tc-text,#0b1a3c)"><FiBell /> Notificações</p>
                      <ul className="mt-2 space-y-1 text-xs leading-5 text-(--tc-text-secondary,#4b5563)">
                        {event.notificationRules.map((item) => <li key={item}>• {item}</li>)}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-(--tc-border,#d7deea) bg-white p-3">
                      <p className="flex items-center gap-2 text-xs font-black text-(--tc-text,#0b1a3c)"><FiTarget /> Brain</p>
                      <ul className="mt-2 space-y-1 text-xs leading-5 text-(--tc-text-secondary,#4b5563)">
                        {event.brianRules.map((item) => <li key={item}>• {item}</li>)}
                      </ul>
                    </div>
                  </div>
                </article>
              )) : (
                <div className="rounded-2xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-6 text-sm font-semibold text-(--tc-text-muted,#6b7280)">
                  Nenhum evento encontrado para os filtros atuais.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
              <FiFlag className="h-4 w-4 text-(--tc-accent,#ef0001)" /> Regras da agenda
            </div>
            <div className="mt-4 space-y-3">
              {data?.rules.map((rule) => (
                <article key={rule.id} className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                  <h2 className="text-sm font-black text-(--tc-text,#0b1a3c)">{rule.title}</h2>
                  <p className="mt-2 text-xs leading-5 text-(--tc-text-secondary,#4b5563)">{rule.description}</p>
                  <ul className="mt-3 space-y-1 text-xs leading-5 text-(--tc-text-muted,#6b7280)">
                    {rule.acceptanceCriteria.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
              <FiAlertTriangle className="h-4 w-4 text-(--tc-accent,#ef0001)" /> Métricas futuras
            </div>
            <div className="mt-4 space-y-3">
              {data?.metrics.map((metric) => (
                <article key={metric.id} className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                  <h2 className="text-sm font-black text-(--tc-text,#0b1a3c)">{metric.label}</h2>
                  <p className="mt-2 text-xs leading-5 text-(--tc-text-secondary,#4b5563)">{metric.description}</p>
                  <code className="mt-3 block rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-(--tc-text-muted,#6b7280)">{metric.formula}</code>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
