"use client";

import type { ReactNode } from "react";
import useSWR from "swr";
import { FiAlertTriangle, FiBell, FiCalendar, FiCheckCircle, FiClock, FiFlag, FiRefreshCw, FiTarget } from "react-icons/fi";

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
  const { data, error, isLoading, mutate } = useSWR("/api/release-calendar", fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
  });

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

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
            <FiClock className="h-4 w-4 text-(--tc-accent,#ef0001)" /> Linha do tempo
          </div>

          <div className="mt-4 space-y-4">
            {data?.events.map((event) => (
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
            ))}
          </div>
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
