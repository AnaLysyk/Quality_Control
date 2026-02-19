"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiPlus, FiRefreshCw } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useTicketKanbanColumns } from "@/hooks/useTicketKanbanColumns";
import {
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


function isPrivilegedRole(role: string | null | undefined) {
  const value = (role ?? "").toLowerCase();
  return (
    value === "it_dev" ||
    value === "itdev" ||
    value === "developer" ||
    value === "dev" ||
    value === "admin" ||
    value === "empresa" ||
    value === "company"
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

export default function KanbanItPage() {
  const { user, loading } = useAuthUser();
  // DEBUG: log do perfil do usuário
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("[KANBAN] user?.role:", user?.role);
  }
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; from: TicketStatus } | null>(null);
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

  const [editingColumnKey, setEditingColumnKey] = useState<string | null>(null);
  const [editingColumnLabel, setEditingColumnLabel] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState("");

  // Só DEV pode editar/remover/adicionar colunas
  const isPrivileged = isPrivilegedRole(user?.role);
  const isAllowed = true; // Todos podem ver chamados, mas só dev pode mexer nas colunas
  const statusKeys = useMemo(
    () => tickets.map((ticket) => normalizeKanbanStatus(ticket.status)),
    [tickets],
  );
  const { columns, statusOptions, addColumn, renameColumn, removeColumn } = useTicketKanbanColumns(statusKeys);

  const grouped = useMemo(() => {
    const map: Record<ColumnKey, TicketItem[]> = {};
    columns.forEach((col) => {
      map[col.key] = [];
    });
    for (const ticket of tickets) {
      const normalized = normalizeKanbanStatus(ticket.status) as ColumnKey;
      if (map[normalized]) map[normalized].push(ticket);
    }
    return map;
  }, [tickets, columns]);

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    setError(null);
    try {
      // Só dev/admin vê todos; demais só os próprios
      const isPrivileged = isPrivilegedRole(user?.role);
      const url = isPrivileged ? "/api/chamados?scope=all" : "/api/chamados";
      const res = await fetch(url, {
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
  }, [user]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    const timer = setInterval(loadTickets, 30000);
    return () => clearInterval(timer);
  }, [loadTickets]);

  function handleDragStart(ticket: TicketItem) {
    if (!(isPrivileged && (user?.id === ticket.createdBy || isPrivilegedRole(user?.role)))) return;
    setDragging({ id: ticket.id, from: ticket.status });
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

  async function handleDrop(toStatus: TicketStatus) {
    if (!dragging || !isPrivileged) return;
    if (dragging.from === toStatus) {
      setDragging(null);
      return;
    }
    const ticketId = dragging.id;
    setDragging(null);
    await updateStatus(ticketId, toStatus);
  }

  async function submitCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/tickets", {
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

  function startEditColumn(key: string, label: string) {
    if (!isPrivileged) return;
    setEditingColumnKey(key);
    setEditingColumnLabel(label);
  }

  function commitEditColumn() {
    if (!editingColumnKey) return;
    // Se o label estiver vazio, remove a coluna (exceto as locked)
    if (!editingColumnLabel.trim()) {
      removeColumn(editingColumnKey);
      setEditingColumnKey(null);
      setEditingColumnLabel("");
      return;
    }
    renameColumn(editingColumnKey, editingColumnLabel);
    setEditingColumnKey(null);
    setEditingColumnLabel("");
  }

  function cancelEditColumn() {
    setEditingColumnKey(null);
    setEditingColumnLabel("");
  }

  function startAddColumn() {
    if (!isPrivileged) return;
    setAddingColumn(true);
    setNewColumnLabel("");
  }

  function commitAddColumn() {
    const created = addColumn(newColumnLabel);
    setAddingColumn(false);
    setNewColumnLabel("");
    return created;
  }

  if (loading) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Carregando...</div>;
  }

  if (!isAllowed) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Acesso restrito.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Chamados</h1>
          <p className="text-sm text-(--tc-text-muted,#6b7280)">
            Visão completa do fluxo de chamados para desenvolvimento.
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
            className="flex items-center gap-2 rounded-full bg-(--tc-accent,#ef0001) px-5 py-3 text-base font-semibold shadow-lg text-white hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/60"
            aria-label="Criar chamado"
          >
            <FiPlus size={20} />
            <span className="hidden sm:inline">Novo chamado</span>
          </button>
        </div>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loadingTickets && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando...</p>}


      {user?.id && (
        <div className="flex flex-wrap items-center gap-2">
          {!addingColumn && (
            <button
              type="button"
              onClick={startAddColumn}
              className="rounded-full border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
            >
              + Coluna
            </button>
          )}
          {addingColumn && (
            <input
              value={newColumnLabel}
              autoFocus
              onChange={(e) => setNewColumnLabel(e.target.value)}
              onBlur={commitAddColumn}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitAddColumn();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setAddingColumn(false);
                  setNewColumnLabel("");
                }
              }}
              className="w-56 rounded-full border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-xs"
              placeholder="Nome da coluna"
            />
          )}
        </div>
      )}

      <section className="w-full py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-4">
          {columns.map((column, idx) => {
            // Paleta de cores pastel para colunas
            const pastel = [
              'bg-pink-100 border-pink-300',
              'bg-blue-100 border-blue-300',
              'bg-green-100 border-green-300',
              'bg-yellow-100 border-yellow-300',
              'bg-purple-100 border-purple-300',
              'bg-orange-100 border-orange-300',
              'bg-cyan-100 border-cyan-300',
              'bg-lime-100 border-lime-300',
              'bg-fuchsia-100 border-fuchsia-300',
              'bg-rose-100 border-rose-300',
            ];
            const color = pastel[idx % pastel.length];
            return (
              <div
                key={column.key}
                className={`rounded-2xl border shadow-lg p-3 min-h-80 flex flex-col ${color}`}
                onDragOver={isPrivilegedRole(user?.role) ? (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                } : undefined}
                onDrop={isPrivilegedRole(user?.role) ? () => handleDrop(column.key) : undefined}
              >
            <div className="flex items-center justify-between">
              {editingColumnKey === column.key ? (
                <input
                  value={editingColumnLabel}
                  autoFocus
                  onChange={(e) => setEditingColumnLabel(e.target.value)}
                  onBlur={commitEditColumn}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitEditColumn();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEditColumn();
                    }
                  }}
                  placeholder="Nome da coluna"
                  title="Editar nome da coluna"
                  aria-label="Editar nome da coluna"
                  className="w-full rounded-md border border-(--tc-border,#e5e7eb) bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)"
                />
              ) :
                isPrivileged ? (
                  <button
                    type="button"
                    onClick={() => startEditColumn(column.key, column.label)}
                    className="text-left text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)"
                  >
                    {column.label}
                  </button>
                ) : (
                  <span className="text-left text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">{column.label}</span>
                )
              }
              <span className="text-xs text-(--tc-text-muted,#6b7280)">
                {grouped[column.key]?.length ?? 0}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {(grouped[column.key] ?? []).map((ticket) => {
                const creatorLabel = ticket.createdByName || ticket.createdByEmail || ticket.createdBy || "-";
                return (
                  <div key={ticket.id} className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-3 text-left shadow-sm">
                    <button
                      type="button"
                      draggable={isPrivileged && (user?.id === ticket.createdBy || isPrivilegedRole(user?.role))}
                      onDragStart={isPrivileged && (user?.id === ticket.createdBy || isPrivilegedRole(user?.role)) ? (event) => {
                        event.dataTransfer.setData("text/plain", ticket.id);
                        event.dataTransfer.effectAllowed = "move";
                        handleDragStart(ticket);
                      } : undefined}
                      onDragEnd={isPrivileged && (user?.id === ticket.createdBy || isPrivilegedRole(user?.role)) ? () => setDragging(null) : undefined}
                      onClick={() => setSelectedTicket(ticket)}
                      className="w-full text-left"
                      disabled={!(isPrivileged && (user?.id === ticket.createdBy || isPrivilegedRole(user?.role)))}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                          {ticket.code || `CH-${ticket.id.slice(0, 6).toUpperCase()}`}
                        </p>
                        <span className="text-[10px] uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                          {getTicketStatusLabel(normalizeKanbanStatus(ticket.status), statusOptions)}
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
                        <p>Criado: {formatDate(ticket.createdAt)}</p>
                        <p>Atualizado: {formatDate(ticket.updatedAt)}</p>
                      </div>
                    </button>
                    <div className="mt-3">
                      <label className="sr-only" htmlFor={`status-${ticket.id}`}>
                        Status
                      </label>
                      {(isPrivileged && (user?.id === ticket.createdBy || isPrivilegedRole(user?.role))) ? (
                        <select
                          id={`status-${ticket.id}`}
                          aria-label="Status do chamado"
                          title="Status do chamado"
                          className="w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-2 py-1 text-[11px]"
                          value={normalizeKanbanStatus(ticket.status)}
                          onChange={(e) => updateStatus(ticket.id, e.target.value as TicketStatus)}
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <select
                            id={`status-${ticket.id}`}
                            aria-label="Status do chamado"
                            title="Status do chamado"
                            className="w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-gray-100 px-2 py-1 text-[11px] text-gray-400 cursor-not-allowed"
                            value={normalizeKanbanStatus(ticket.status)}
                            disabled
                            tabIndex={-1}
                          >
                            <option value={normalizeKanbanStatus(ticket.status)}>{getTicketStatusLabel(normalizeKanbanStatus(ticket.status), statusOptions)}</option>
                          </select>
                          <p className="mt-1 text-xs text-red-500">Você não tem permissão para mover o chamado</p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {(grouped[column.key] ?? []).length === 0 && (
                <p className="text-xs text-(--tc-text-muted,#6b7280)">Sem chamados</p>
              )}
            </div>
          </div>
            );
          })}
        </div>
      </section>

      <TicketDetailsModal
        open={Boolean(selectedTicket)}
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        canEditStatus={true}
        statusOptions={statusOptions}
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
                <label className="sr-only" htmlFor="create-ticket-type">
                  Tipo do chamado
                </label>
                <select
                  id="create-ticket-type"
                  aria-label="Tipo do chamado"
                  title="Tipo do chamado"
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
                <label className="sr-only" htmlFor="create-ticket-priority">
                  Prioridade do chamado
                </label>
                <select
                  id="create-ticket-priority"
                  aria-label="Prioridade do chamado"
                  title="Prioridade do chamado"
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



