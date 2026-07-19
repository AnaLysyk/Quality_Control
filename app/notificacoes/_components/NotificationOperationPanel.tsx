"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import useSWR from "swr";
import { FiActivity, FiBell, FiCheckCircle, FiCpu, FiExternalLink, FiInbox, FiLayers, FiMessageCircle, FiRefreshCw, FiSave, FiShield, FiSliders, FiUsers } from "react-icons/fi";

import { fetchApi } from "@/backend/api";

type Workflow = {
  id: string;
  eventType: string;
  label: string;
  category: string;
  description: string;
  criticality: string;
  mandatory: boolean;
  defaultChannels: string[];
  audienceScopes: string[];
  recipientRules: string[];
  preferenceRules: string[];
};

type NotificationEventRecord = {
  id: string;
  eventType: string;
  workflowId: string;
  title: string;
  description: string;
  category: string;
  criticality: string;
  mandatory: boolean;
  companySlug: string | null;
  companyName: string | null;
  projectSlug: string | null;
  actorName: string | null;
  sourceType: string;
  sourceId: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
};

type NotificationDeliveryRecord = {
  id: string;
  eventId: string;
  channel: string;
  recipientId: string;
  recipientName: string | null;
  profileKind: string | null;
  status: string;
  decision: string;
  decisionReason: string;
  createdAt: string;
};

type NotificationPreferenceRecord = {
  id: string;
  target: "company" | "profile" | "user";
  targetId: string;
  workflowId: string;
  channel: string;
  decision: "enabled" | "disabled";
  updatedAt: string;
  updatedBy: string | null;
};

type NotificationBrianInsight = {
  id: string;
  eventId: string;
  eventType: string;
  title: string;
  summary: string;
  severity: "info" | "warning" | "critical";
  delivered: number;
  suppressed: number;
  explanations: string[];
  recommendedActions: string[];
};

type NotificationModelPayload = {
  generatedAt: string;
  channels: string[];
  preferenceLayers: Array<{ id: string; label: string; priority: number; description: string; examples: string[] }>;
  workflows: Workflow[];
  backlog: Array<{ id: string; title: string; area: string; priority: string; acceptanceCriteria: string[] }>;
  rules: string[];
  summary: { workflows: number; mandatory: number; configurable: number; channels: number; backlogItems: number; criticalBacklog: number };
  preferenceSummary: { total: number; disabled: number; enabled: number; company: number; profile: number; user: number };
  preferences: NotificationPreferenceRecord[];
  notificationEventsSummary: { events: number; deliveries: number; delivered: number; suppressed: number; critical: number; releaseCalendar: number };
  notificationEvents: { events: NotificationEventRecord[]; deliveries: NotificationDeliveryRecord[] };
  notificationBrianInsights: NotificationBrianInsight[];
};

type PreferenceFormState = {
  target: "company" | "profile" | "user";
  targetId: string;
  workflowId: string;
  channel: string;
  decision: "enabled" | "disabled";
};

const initialPreferenceForm: PreferenceFormState = {
  target: "company",
  targetId: "testing-company",
  workflowId: "ticket-created",
  channel: "in_app",
  decision: "disabled",
};

async function fetcher(path: string) {
  const response = await fetchApi(path, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || payload?.message || "Nao foi possivel carregar modelo de notificacoes.");

  const catalogResponse = await fetchApi("/api/notification-catalog", { cache: "no-store" });
  const catalog = await catalogResponse.json().catch(() => null);
  if (catalogResponse.ok && Array.isArray(catalog?.workflows)) {
    payload.workflows = catalog.workflows;
    payload.summary = { ...payload.summary, ...(catalog.summary ?? {}) };
  }

  return payload as NotificationModelPayload;
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--tc-text-muted,#6b7280)]">{children}</span>;
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

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--tc-text-muted,#6b7280)]">{children}</label>;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function payloadText(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function shortPayload(payload: Record<string, unknown>) {
  const releaseName = payloadText(payload, "releaseName");
  const releaseId = payloadText(payload, "releaseId");
  const calendarStatus = payloadText(payload, "calendarStatus");
  const notificationType = payloadText(payload, "notificationType");
  return [releaseName, releaseId, calendarStatus, notificationType].filter(Boolean).join(" · ");
}

function operationalFacts(event?: NotificationEventRecord | null) {
  if (!event) return [] as Array<{ label: string; value: string }>;
  const payload = event.payload ?? {};
  const area = payloadText(payload, "operationalArea");
  const entity = payloadText(payload, "entityType");
  const action = payloadText(payload, "sourceAction");
  const sourceId = payloadText(payload, "sourceId") ?? event.sourceId;
  const trackingKey = payloadText(payload, "trackingKey");
  const route = payloadText(payload, "route") ?? payloadText(payload, "link");
  const company = event.companyName ?? event.companySlug ?? payloadText(payload, "companySlug");
  const project = event.projectSlug ?? payloadText(payload, "projectSlug");

  return [
    area ? { label: "Área", value: area } : null,
    entity ? { label: "Entidade", value: entity } : null,
    action ? { label: "Ação", value: action } : null,
    sourceId ? { label: "ID fonte", value: sourceId } : null,
    route ? { label: "Rota", value: route } : null,
    company ? { label: "Empresa", value: company } : null,
    project ? { label: "Projeto", value: project } : null,
    trackingKey ? { label: "Tracking", value: trackingKey } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
}

function OperationalMeta({ event, compact = false }: { event?: NotificationEventRecord | null; compact?: boolean }) {
  const facts = operationalFacts(event);
  if (!facts.length) return null;

  const visibleFacts = compact ? facts.slice(0, 5) : facts;
  const route = facts.find((fact) => fact.label === "Rota")?.value;

  return (
    <div className="mt-3 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white p-3">
      <div className="flex flex-wrap gap-2">
        {visibleFacts.map((fact) =>
          fact.label === "Rota" && route ? (
            <a key={`${fact.label}:${fact.value}`} href={route} className="inline-flex items-center gap-1 rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-2.5 py-1 text-[11px] font-black text-[var(--tc-text,#0b1a3c)]">
              <FiExternalLink className="h-3 w-3" /> Abrir rota
            </a>
          ) : (
            <span key={`${fact.label}:${fact.value}`} className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-2.5 py-1 text-[11px] font-black text-[var(--tc-text,#0b1a3c)]">
              {fact.label}: {fact.value}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

export function NotificationOperationPanel() {
  const [preferenceForm, setPreferenceForm] = useState<PreferenceFormState>(initialPreferenceForm);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [preferenceSaved, setPreferenceSaved] = useState<string | null>(null);
  const [savingPreference, setSavingPreference] = useState(false);

  const { data, error, isLoading, mutate } = useSWR("/api/notification-model?limit=80", fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
  });

  const deliveriesByEvent = new Map<string, NotificationDeliveryRecord[]>();
  for (const delivery of data?.notificationEvents.deliveries ?? []) {
    deliveriesByEvent.set(delivery.eventId, [...(deliveriesByEvent.get(delivery.eventId) ?? []), delivery]);
  }

  const eventById = new Map<string, NotificationEventRecord>();
  for (const event of data?.notificationEvents.events ?? []) {
    eventById.set(event.id, event);
  }

  async function handlePreferenceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreferenceError(null);
    setPreferenceSaved(null);

    if (!preferenceForm.targetId.trim() || !preferenceForm.workflowId.trim() || !preferenceForm.channel.trim()) {
      setPreferenceError("Informe alvo, workflow e canal.");
      return;
    }

    setSavingPreference(true);
    try {
      const response = await fetchApi("/api/notification-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferenceForm),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || "Nao foi possivel salvar preferencia.");
      setPreferenceSaved("Preferencia salva. Eventos futuros passam por essa regra.");
      await mutate();
    } catch (err) {
      setPreferenceError(err instanceof Error ? err.message : "Nao foi possivel salvar preferencia.");
    } finally {
      setSavingPreference(false);
    }
  }

  return (
    <main className="space-y-5">
      <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">
              <FiBell className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Central de notificações
            </span>
            <h1 className="mt-3 text-2xl font-black text-[var(--tc-text,#0b1a3c)]">Evento sempre registrado, recebimento configurável</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">Eventos críticos não podem ser desativados; eventos operacionais podem ser suprimidos, mas continuam auditáveis e visíveis para o Brain.</p>
          </div>
          <button type="button" onClick={() => void mutate()} className="inline-flex items-center gap-2 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-4 py-2 text-sm font-bold text-[var(--tc-text,#0b1a3c)]">
            <FiRefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>
        {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error.message}</div> : null}
        <div className="mt-5 grid gap-3 md:grid-cols-6 xl:grid-cols-10">
          <StatCard label="Workflows" value={isLoading ? "..." : data?.summary.workflows ?? 0} note="Catálogo" />
          <StatCard label="Obrigatórios" value={isLoading ? "..." : data?.summary.mandatory ?? 0} note="Sem opt-out" />
          <StatCard label="Canais" value={isLoading ? "..." : data?.summary.channels ?? 0} note="Entrega" />
          <StatCard label="Preferências" value={isLoading ? "..." : data?.preferenceSummary.total ?? 0} note="Store" />
          <StatCard label="Desativadas" value={isLoading ? "..." : data?.preferenceSummary.disabled ?? 0} note="Supressão" />
          <StatCard label="Eventos" value={isLoading ? "..." : data?.notificationEventsSummary.events ?? 0} note="Auditáveis" />
          <StatCard label="Entregas" value={isLoading ? "..." : data?.notificationEventsSummary.deliveries ?? 0} note="Por canal" />
          <StatCard label="Delivered" value={isLoading ? "..." : data?.notificationEventsSummary.delivered ?? 0} note="Recebidas" />
          <StatCard label="Suppressed" value={isLoading ? "..." : data?.notificationEventsSummary.suppressed ?? 0} note="Bloqueadas" />
          <StatCard label="Brian" value={isLoading ? "..." : data?.notificationBrianInsights?.length ?? 0} note="Explicações" />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-4">
          <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]"><FiSliders className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Configurar recebimento</div>
            <p className="mt-2 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">Use para desligar ou religar um canal por empresa, perfil ou usuário. A lista abaixo já inclui agenda, tickets, docs, acesso e segurança.</p>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handlePreferenceSubmit}>
              {preferenceError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 md:col-span-2">{preferenceError}</div> : null}
              {preferenceSaved ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 md:col-span-2">{preferenceSaved}</div> : null}
              <div className="space-y-1"><FieldLabel>Alvo</FieldLabel><select value={preferenceForm.target} onChange={(event) => setPreferenceForm((current) => ({ ...current, target: event.target.value as PreferenceFormState["target"] }))} className="w-full rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]"><option value="company">Empresa</option><option value="profile">Perfil</option><option value="user">Usuário</option></select></div>
              <div className="space-y-1"><FieldLabel>ID do alvo</FieldLabel><input value={preferenceForm.targetId} onChange={(event) => setPreferenceForm((current) => ({ ...current, targetId: event.target.value }))} className="w-full rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]" placeholder="testing-company / qa-lead / user-id" /></div>
              <div className="space-y-1"><FieldLabel>Workflow</FieldLabel><select value={preferenceForm.workflowId} onChange={(event) => setPreferenceForm((current) => ({ ...current, workflowId: event.target.value }))} className="w-full rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]">{(data?.workflows ?? []).map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.label} · {workflow.id}</option>)}</select></div>
              <div className="space-y-1"><FieldLabel>Canal</FieldLabel><select value={preferenceForm.channel} onChange={(event) => setPreferenceForm((current) => ({ ...current, channel: event.target.value }))} className="w-full rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]">{(data?.channels ?? ["in_app", "email", "push", "chat", "brain"]).map((channel) => <option key={channel} value={channel}>{channel}</option>)}</select></div>
              <div className="space-y-1"><FieldLabel>Decisão</FieldLabel><select value={preferenceForm.decision} onChange={(event) => setPreferenceForm((current) => ({ ...current, decision: event.target.value as PreferenceFormState["decision"] }))} className="w-full rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]"><option value="disabled">Desativar recebimento</option><option value="enabled">Ativar recebimento</option></select></div>
              <div className="flex items-end"><button type="submit" disabled={savingPreference} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--tc-accent,#ef0001)] px-4 py-2 text-sm font-black text-white disabled:opacity-60"><FiSave className="h-4 w-4" /> {savingPreference ? "Salvando..." : "Salvar preferência"}</button></div>
            </form>
          </section>

          <section className="space-y-4 rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]"><FiMessageCircle className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Brian explica</div>
            {data?.notificationBrianInsights?.length ? data.notificationBrianInsights.map((insight) => {
              const event = eventById.get(insight.eventId);
              return <article key={insight.id} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">{insight.eventType}</p><h2 className="mt-1 text-base font-black text-[var(--tc-text,#0b1a3c)]">{insight.title}</h2></div><div className="flex flex-wrap gap-2"><Badge>{insight.severity}</Badge><Badge>delivered {insight.delivered}</Badge><Badge>suppressed {insight.suppressed}</Badge></div></div><OperationalMeta event={event} /><p className="mt-2 text-sm font-semibold leading-6 text-[var(--tc-text-secondary,#4b5563)]">{insight.summary}</p><ul className="mt-3 space-y-1 text-xs leading-5 text-[var(--tc-text-secondary,#4b5563)]">{insight.explanations.map((item) => <li key={item}>• {item}</li>)}</ul><ul className="mt-3 space-y-1 text-xs font-semibold leading-5 text-[var(--tc-text,#0b1a3c)]">{insight.recommendedActions.map((item) => <li key={item}>→ {item}</li>)}</ul></article>;
            }) : <div className="rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-6 text-sm font-semibold text-[var(--tc-text-muted,#6b7280)]">Nenhuma explicação do Brian disponível ainda.</div>}
          </section>

          <section className="space-y-4 rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]"><FiActivity className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Eventos reais gerados</div>
            {data?.notificationEvents.events.length ? data.notificationEvents.events.map((event) => {
              const deliveries = deliveriesByEvent.get(event.id) ?? [];
              return <article key={event.id} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">{event.eventType} · {event.sourceType}</p><h2 className="mt-1 text-base font-black text-[var(--tc-text,#0b1a3c)]">{event.title}</h2><p className="mt-1 text-xs font-semibold text-[var(--tc-text-muted,#6b7280)]">{formatDate(event.createdAt)}</p></div><div className="flex flex-wrap gap-2"><Badge>{event.criticality}</Badge><Badge>{event.mandatory ? "Obrigatório" : "Configurável"}</Badge></div></div><p className="mt-2 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">{event.description}</p><div className="mt-3 flex flex-wrap gap-2">{event.companyName || event.companySlug ? <Badge>{event.companyName ?? event.companySlug}</Badge> : null}{event.projectSlug ? <Badge>{event.projectSlug}</Badge> : null}{event.actorName ? <Badge>ator: {event.actorName}</Badge> : null}{shortPayload(event.payload) ? <Badge>{shortPayload(event.payload)}</Badge> : null}</div><OperationalMeta event={event} compact /><div className="mt-4 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white p-3"><p className="flex items-center gap-2 text-xs font-black text-[var(--tc-text,#0b1a3c)]"><FiInbox /> Entregas geradas</p>{deliveries.length ? <div className="mt-3 space-y-2">{deliveries.map((delivery) => <div key={delivery.id} className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-2"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black text-[var(--tc-text,#0b1a3c)]">{delivery.recipientName ?? delivery.recipientId}</p><div className="flex flex-wrap gap-2"><Badge>{delivery.channel}</Badge><Badge>{delivery.status}</Badge><Badge>{delivery.decision}</Badge></div></div><p className="mt-1 text-xs leading-5 text-[var(--tc-text-muted,#6b7280)]">{delivery.decisionReason}</p></div>)}</div> : <p className="mt-2 text-xs font-semibold text-[var(--tc-text-muted,#6b7280)]">Evento registrado sem destinatário calculado ainda.</p>}</div></article>;
            }) : <div className="rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-6 text-sm font-semibold text-[var(--tc-text-muted,#6b7280)]">Nenhum evento gerado ainda.</div>}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm"><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]"><FiUsers className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Preferências cadastradas</div><div className="mt-4 grid gap-3 sm:grid-cols-3"><StatCard label="Empresa" value={data?.preferenceSummary.company ?? 0} note="Regras por empresa" /><StatCard label="Perfil" value={data?.preferenceSummary.profile ?? 0} note="Regras por perfil" /><StatCard label="Usuário" value={data?.preferenceSummary.user ?? 0} note="Regras individuais" /></div><div className="mt-4 space-y-2">{data?.preferences?.length ? data.preferences.map((preference) => <article key={preference.id} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">{preference.target}: {preference.targetId}</h2><div className="flex flex-wrap gap-2"><Badge>{preference.workflowId}</Badge><Badge>{preference.channel}</Badge><Badge>{preference.decision}</Badge></div></div><p className="mt-1 text-xs font-semibold text-[var(--tc-text-muted,#6b7280)]">Atualizado em {formatDate(preference.updatedAt)}</p></article>) : <p className="text-sm font-semibold text-[var(--tc-text-muted,#6b7280)]">Nenhuma preferência cadastrada ainda.</p>}</div></section>
          <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm"><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]"><FiLayers className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Workflows de notificação</div><div className="mt-4 space-y-3">{data?.workflows.map((workflow) => <article key={workflow.id} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">{workflow.eventType} · {workflow.category}</p><h2 className="mt-1 text-base font-black text-[var(--tc-text,#0b1a3c)]">{workflow.label}</h2></div><div className="flex flex-wrap gap-2"><Badge>{workflow.criticality}</Badge><Badge>{workflow.mandatory ? "Obrigatório" : "Configurável"}</Badge></div></div><p className="mt-2 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">{workflow.description}</p><div className="mt-3 flex flex-wrap gap-2">{workflow.defaultChannels.map((channel) => <Badge key={channel}>{channel}</Badge>)}</div></article>)}</div></section>
          <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm"><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]"><FiSliders className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Prioridade das preferências</div><div className="mt-4 space-y-3">{data?.preferenceLayers.map((layer) => <article key={layer.id} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">{layer.priority}. {layer.label}</h2><FiShield className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /></div><p className="mt-2 text-xs leading-5 text-[var(--tc-text-secondary,#4b5563)]">{layer.description}</p></article>)}</div></section>
          <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm"><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]"><FiCheckCircle className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Regras duras</div><ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">{data?.rules.map((rule) => <li key={rule}>• {rule}</li>)}</ul></section>
          <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm"><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]"><FiCpu className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Backlog de implementação</div><div className="mt-4 space-y-3">{data?.backlog.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">{item.title}</h2><div className="flex gap-2"><Badge>{item.area}</Badge><Badge>{item.priority}</Badge></div></div><ul className="mt-3 space-y-1 text-xs leading-5 text-[var(--tc-text-secondary,#4b5563)]">{item.acceptanceCriteria.map((criteria) => <li key={criteria}>• {criteria}</li>)}</ul></article>)}</div></section>
        </div>
      </section>
    </main>
  );
}

