"use client";

import { useEffect, useMemo, useState } from "react";
import { FiMessageSquare, FiPlus, FiSearch } from "react-icons/fi";

type ConversationType = "decisao" | "incidente" | "release" | "automacao" | "ticket" | "sistema";

type ConversationEvent = {
  id: string;
  type: ConversationType;
  title: string;
  message: string;
  createdAt: string;
};

const STORAGE_KEY = "qc:internal-conversations:v1";

const INITIAL_EVENTS: ConversationEvent[] = [
  {
    id: "runs-foundation",
    type: "decisao",
    title: "Runs antes de novas features",
    message: "Prioridade operacional definida: estabilizar acesso por empresa e detalhe de runs antes de puxar novos modulos.",
    createdAt: "2026-04-29T09:00:00.000Z",
  },
  {
    id: "qase-kanban",
    type: "incidente",
    title: "Kanban integrado inconsistente",
    message: "Resumo da run carregava, mas casos nao acompanhavam na tela completa. Fluxo passou a reutilizar painel compartilhado.",
    createdAt: "2026-04-29T10:30:00.000Z",
  },
];

const TYPES: Array<{ value: ConversationType | "todos"; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "decisao", label: "Decisao" },
  { value: "incidente", label: "Incidente" },
  { value: "release", label: "Release" },
  { value: "automacao", label: "Automacao" },
  { value: "ticket", label: "Ticket" },
  { value: "sistema", label: "Sistema" },
];

export default function InternalConversationsPage() {
  const [events, setEvents] = useState<ConversationEvent[]>(() => {
    if (typeof window === "undefined") return INITIAL_EVENTS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return INITIAL_EVENTS;
      const parsed = JSON.parse(stored) as ConversationEvent[];
      return Array.isArray(parsed) ? parsed : INITIAL_EVENTS;
    } catch {
      return INITIAL_EVENTS;
    }
  });
  const [filter, setFilter] = useState<ConversationType | "todos">("todos");
  const [query, setQuery] = useState("");
  const [draftType, setDraftType] = useState<ConversationType>("decisao");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftMessage, setDraftMessage] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {
      /* ignore */
    }
  }, [events]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events
      .filter((event) => filter === "todos" || event.type === filter)
      .filter((event) => !needle || `${event.title} ${event.message} ${event.type}`.toLowerCase().includes(needle))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [events, filter, query]);

  function addEvent() {
    const title = draftTitle.trim();
    const message = draftMessage.trim();
    if (!title || !message) return;
    setEvents((current) => [
      {
        id: crypto.randomUUID(),
        type: draftType,
        title,
        message,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setDraftTitle("");
    setDraftMessage("");
  }

  return (
    <main className="min-h-screen bg-(--tc-page-bg,#f5f7fb) px-4 py-6 text-(--tc-text,#0b1a3c) lg:px-8">
      <section className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[380px_1fr]">
        <aside className="rounded-[28px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#fff) p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-(--tc-accent,#ef0001)">Operacao</p>
          <h1 className="mt-2 text-2xl font-black">Conversa interna</h1>
          <p className="mt-2 text-sm text-(--tc-text-muted,#64748b)">Registro local de decisoes, incidentes e contexto de retomada.</p>

          <div className="mt-5 space-y-3">
            <select value={draftType} onChange={(event) => setDraftType(event.target.value as ConversationType)} className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface-2,#eef4ff) px-3 py-2 text-sm">
              {TYPES.filter((type) => type.value !== "todos").map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface-2,#eef4ff) px-3 py-2 text-sm" placeholder="Titulo do registro" />
            <textarea value={draftMessage} onChange={(event) => setDraftMessage(event.target.value)} className="min-h-32 w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface-2,#eef4ff) px-3 py-2 text-sm" placeholder="Contexto, decisao ou proximo passo" />
            <button type="button" onClick={addEvent} disabled={!draftTitle.trim() || !draftMessage.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-(--tc-accent,#ef0001) px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50">
              <FiPlus className="h-4 w-4" />
              Registrar comentario
            </button>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="rounded-[24px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#fff) p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--tc-text-muted,#64748b)" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface-2,#eef4ff) py-2.5 pr-4 pl-11 text-sm" placeholder="Buscar no historico" />
              </div>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((type) => (
                  <button key={type.value} type="button" onClick={() => setFilter(type.value)} className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] ${filter === type.value ? "bg-(--tc-accent,#ef0001) text-white" : "bg-(--tc-surface-2,#eef4ff) text-(--tc-text-secondary,#475569)"}`}>
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-(--tc-border,#dfe5f1) bg-(--tc-surface,#fff) p-8 text-sm text-(--tc-text-muted,#64748b)">Nenhum registro encontrado.</div>
          ) : (
            filtered.map((event) => (
              <article key={event.id} className="rounded-[24px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#fff) p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-(--tc-accent-soft,#fee2e2) px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-(--tc-accent,#ef0001)">
                    <FiMessageSquare className="h-3.5 w-3.5" />
                    {event.type}
                  </span>
                  <time className="text-xs text-(--tc-text-muted,#64748b)">{new Date(event.createdAt).toLocaleString("pt-BR")}</time>
                </div>
                <h2 className="mt-3 text-lg font-black">{event.title}</h2>
                <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary,#475569)">{event.message}</p>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}
