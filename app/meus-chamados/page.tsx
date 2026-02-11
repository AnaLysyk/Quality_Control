"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiPlus, FiRefreshCw } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  KANBAN_STATUS_OPTIONS,
  getTicketStatusLabel,
  normalizeKanbanStatus,
  type TicketStatus,
} from "@/lib/ticketsStatus";
import TicketDetailsModal from "@/components/TicketDetailsModal";

type TicketItem = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  type?: string | null;
  code?: string | null;
  priority?: string | null;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  companySlug?: string | null;
  companyId?: string | null;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
};

type ColumnKey = "backlog" | "doing" | "review" | "done";

const COLUMN_LABELS: Record<ColumnKey, string> = {
  backlog: "Backlog",
  doing: "Em andamento",
  review: "Em revisão",
  done: "Concluído",
};

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];

const TYPE_OPTIONS = [
  { value: "bug", label: "Bug" },
  { value: "melhoria", label: "Melhoria" },
  { value: "tarefa", label: "Tarefa" },
];

function shortText(value?: string | null, max = 120) {
  if (!value) return "Sem descricao.";
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 3))}...`;
}

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "-";
  return new Date(time).toLocaleDateString("pt-BR");
}

export default function MeusChamadosPage() {
  const { user, loading } = useAuthUser();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    title: "",
    description: "",
    type: "tarefa",
    priority: "medium",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<ColumnKey, TicketItem[]> = {
      backlog: [],
      doing: [],
      review: [],
      done: [],
    };
    for (const ticket of tickets) {
      const normalized = normalizeKanbanStatus(ticket.status) as ColumnKey;
      if (map[normalized]) map[normalized].push(ticket);
    }
    return map;
  }, [tickets]);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    setLoadingTickets(true);
    setError(null);
    try {
      const res = await fetch("/api/chamados?scope=mine", { credentials: "include", cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { items?: TicketItem[]; error?: string };
      if (!res.ok) {
        setTickets([]);
        setError(json?.error || "Erro ao carregar chamados");
        return;
      }
      setTickets(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar chamados";
      setError(msg);
    } finally {
      setLoadingTickets(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadTickets();
  }, [user, loadTickets]);

  async function submitCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: createDraft.title,
          description: createDraft.description,
          type: createDraft.type,
          priority: createDraft.priority,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { item?: TicketItem; error?: string };
      if (!res.ok || !json.item) {
        setCreateError(json?.error || "Erro ao criar chamado");
        return;
      }
      setCreateOpen(false);
      setCreateDraft({ title: "", description: "", type: "tarefa", priority: "medium" });
      setTickets((current) => [json.item as TicketItem, ...current]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar chamado";
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Carregando...</div>;
  }

  if (!user) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Acesso restrito.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Chamados</h1>
          <p className="text-sm text-(--tc-text-muted,#6b7280)">
            Acompanhe seus chamados e converse com o time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadTickets}
            className="inline-flex items-center gap-2 rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
          >
            <FiRefreshCw size={14} /> Atualizar
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-(--tc-accent,#ef0001) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
          >
            <FiPlus size={14} /> Chamado
          </button>
        </div>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loadingTickets && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando...</p>}

      <section className="grid gap-4 lg:grid-cols-4">
        {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((columnKey) => (
          <div
            key={columnKey}
            className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-3 min-h-[20rem]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">
                {COLUMN_LABELS[columnKey]}
              </h2>
              <span className="text-xs text-(--tc-text-muted,#6b7280)">
                {grouped[columnKey]?.length ?? 0}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {(grouped[columnKey] ?? []).map((ticket) => {
                const creatorLabel = ticket.createdByName || ticket.createdByEmail || ticket.createdBy || "-";
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicket(ticket)}
                    className="w-full rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-3 text-left shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                        {ticket.code || `CH-${ticket.id.slice(0, 6).toUpperCase()}`}
                      </p>
                      <span className="text-[10px] uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                        {getTicketStatusLabel(normalizeKanbanStatus(ticket.status))}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold">{ticket.title || "Sem titulo"}</p>
                    <p className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">
                      {shortText(ticket.description, 100)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                      <span>Tipo: {ticket.type || "tarefa"}</span>
                      <span>Prioridade: {ticket.priority || "medium"}</span>
                    </div>
                    <div className="mt-2 text-[11px] text-(--tc-text-muted,#6b7280) space-y-1">
                      <p>Criador: {creatorLabel}</p>
                      <p>Data: {formatDate(ticket.createdAt)}</p>
                    </div>
                  </button>
                );
              })}
              {(grouped[columnKey] ?? []).length === 0 && (
                <p className="text-xs text-(--tc-text-muted,#6b7280)">Sem chamados</p>
              )}
            </div>
          </div>
        ))}
      </section>

      <TicketDetailsModal
        open={Boolean(selectedTicket)}
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        canEditStatus={false}
        statusOptions={KANBAN_STATUS_OPTIONS}
        onTicketUpdated={(updated) => {
          setSelectedTicket(updated);
          setTickets((current) =>
            current.map((ticket) => (ticket.id === updated.id ? updated : ticket)),
          );
        }}
      />

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between border-b border-(--tc-border,#e5e7eb) px-6 py-4">
              <h2 className="text-lg font-semibold">Novo chamado</h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-full border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
              >
                Fechar
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <input
                className="w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-sm"
                placeholder="Titulo"
                value={createDraft.title}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, title: e.target.value }))}
              />
              <textarea
                rows={4}
                className="w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-sm"
                placeholder="Descreva o chamado..."
                value={createDraft.description}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, description: e.target.value }))}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-sm"
                  value={createDraft.type}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, type: e.target.value }))}
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-sm"
                  value={createDraft.priority}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, priority: e.target.value }))}
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-(--tc-border,#e5e7eb) px-6 py-4">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-(--tc-border,#e5e7eb) px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitCreate}
                disabled={creating}
                className="rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
              >
                {creating ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



