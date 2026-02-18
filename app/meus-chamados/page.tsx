
// ...existing code...

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiPlus, FiRefreshCw } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useTicketKanbanColumns } from "@/hooks/useTicketKanbanColumns";
import { getTicketStatusLabel, normalizeKanbanStatus, type TicketStatus } from "@/lib/ticketsStatus";
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

type ColumnKey = string;

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

function isDevRole(role: string | null | undefined) {
  const value = (role ?? "").toLowerCase();
  return (
    value === "admin" ||
    value === "global_admin" ||
    value === "it_dev" ||
    value === "itdev" ||
    value === "developer" ||
    value === "dev"
  );
}

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
  // Cards horizontais, sem colunas, drag ou statusOptions
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSaving, setCreateSaving] = useState(false);

  // Função para recarregar tickets
  const reloadTickets = useCallback(async () => {
    setLoadingTickets(true);
    setError(null);
    try {
      const res = await fetch("/api/chamados", {
        credentials: "include",
        cache: "no-store",
      });
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
  }, []);

  async function handleCreateTicket() {
    if (!createDraft.title.trim()) return;
    setCreateSaving(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: createDraft.title.trim(),
          description: createDraft.description.trim(),
          type: createDraft.type,
          priority: createDraft.priority,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Erro ao criar chamado");
      }
      setCreateOpen(false);
      setCreateDraft({ title: "", description: "", type: "tarefa", priority: "medium" });
      setCreateSaving(false);
      // Atualiza lista sem reload
      await reloadTickets();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Erro ao criar chamado");
      setCreateSaving(false);
    }
  }

  async function updateStatus(ticketId: string, nextStatus: TicketStatus) {
    const previous = tickets;
    setTickets((current) =>
      current.map((ticket) => (ticket.id === ticketId ? { ...ticket, status: nextStatus } : ticket)),
    );
    try {
      const res = await fetch(`/api/chamados/${ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = (await res.json().catch(() => ({}))) as { item?: TicketItem; error?: string };
      if (!res.ok || !json.item) {
        setTickets(previous);
        setError(json?.error || "Falha ao atualizar status");
        return;
      }
      setTickets((current) =>
        current.map((ticket) => (ticket.id === json.item?.id ? json.item : ticket)),
      );
    } catch {
      setTickets(previous);
      setError("Falha ao atualizar status");
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Carregando...</div>;
  }

  if (!user) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Acesso restrito.</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 min-h-[80vh] bg-(--page-bg)">
      <header className="flex flex-col sm:flex-row flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Chamados</h1>
          <p className="text-sm text-(--tc-text-muted,#6b7280)">
            Acompanhe seus chamados e converse com o time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Criar chamado"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-(--tc-accent,#ef0001) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
          >
            <FiPlus size={14} /> Chamado
          </button>
        </div>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loadingTickets && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando...</p>}


      {/* Responsivo: grid em telas médias/grandes, carrossel horizontal em mobile */}
      <div className="w-full py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="w-80 shrink-0 rounded-3xl border-2 border-(--tc-border,#e5e7eb) shadow-[0_8px_32px_rgba(15,23,42,0.10)] p-5 min-h-80 flex flex-col bg-(--tc-surface,#f9fafb) transition hover:shadow-[0_16px_48px_rgba(15,23,42,0.13)]"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-bold uppercase tracking-[0.25em] text-(--tc-accent,#ef0001)">
                  {ticket.code || `CH-${ticket.id.slice(0, 6).toUpperCase()}`}
                </p>
                <span className="text-[13px] uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                  {getTicketStatusLabel(normalizeKanbanStatus(ticket.status), [])}
                </span>
                <button
                  type="button"
                  className="ml-2 rounded-full border border-(--tc-accent,#ef0001) px-2 py-1 text-xs font-semibold uppercase tracking-[0.2em] bg-(--tc-accent,#ef0001) text-white hover:bg-(--tc-accent-dark,#c20000)"
                  aria-label={`Abrir detalhes do chamado ${ticket.title}`}
                  title="Abrir detalhes"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  Detalhes
                </button>
              </div>
              <p className="mt-2 text-lg font-semibold wrap-break-word">{ticket.title || 'Sem titulo'}</p>
              <p className="mt-1 text-[14px] text-(--tc-text-muted,#6b7280) wrap-break-word">{shortText(ticket.description, 100)}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                <span className="bg-(--tc-accent,#ef0001)/10 px-2 py-1 rounded">Tipo: {ticket.type || 'tarefa'}</span>
                <span className="bg-(--tc-accent,#ef0001)/10 px-2 py-1 rounded">Prioridade: {ticket.priority || 'medium'}</span>
              </div>
              <div className="mt-2 text-[11px] text-(--tc-text-muted,#6b7280) space-y-1">
                <p>Criador: <span className="font-semibold text-(--tc-accent,#ef0001)">{ticket.createdByName || ticket.createdByEmail || ticket.createdBy || '-'}</span></p>
                <p>Criado: <span className="font-semibold">{formatDate(ticket.createdAt)}</span></p>
                <p>Atualizado: <span className="font-semibold">{formatDate(ticket.updatedAt)}</span></p>
              </div>
              <div className="mt-3">
                <label className="sr-only" htmlFor={`status-${ticket.id}`}>Status</label>
                <select
                  id={`status-${ticket.id}`}
                  aria-label="Status do chamado"
                  title="Status do chamado"
                  className="w-full rounded-lg border-2 border-(--tc-accent,#ef0001) bg-(--tc-surface,#f9fafb) px-2 py-1 text-[11px] text-(--tc-accent,#ef0001) font-bold cursor-not-allowed"
                  value={normalizeKanbanStatus(ticket.status)}
                  disabled
                  tabIndex={-1}
                >
                  <option value={normalizeKanbanStatus(ticket.status)}>{getTicketStatusLabel(normalizeKanbanStatus(ticket.status), [])}</option>
                </select>
                <p className="mt-2 text-xs font-semibold text-(--tc-accent,#ef0001) bg-(--tc-accent,#ef0001)/10 rounded px-2 py-1 border border-(--tc-accent,#ef0001)">Você não tem permissão para mover o chamado</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <TicketDetailsModal
        key={selectedTicket?.id || 'empty'}
        open={Boolean(selectedTicket)}
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        canEditStatus={isDevRole(user.role)}
        statusOptions={[]}
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
                  title="Tipo do chamado"
                  aria-label="Tipo do chamado"
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
                  title="Prioridade do chamado"
                  aria-label="Prioridade do chamado"
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
              {/* Erro de criação removido, pois createError não existe */}
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
                onClick={handleCreateTicket}
                disabled={createSaving || !createDraft.title.trim()}
                className="rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
              >
                {createSaving ? "Salvando..." : "Criar"}
              </button>
              {createError && (
                <span className="ml-4 text-xs text-red-600">{createError}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



