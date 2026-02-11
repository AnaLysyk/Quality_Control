"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiFilter, FiRefreshCw } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { getTicketStatusLabel, type TicketStatus } from "@/lib/ticketsStatus";
import TicketDetailsModal from "@/components/TicketDetailsModal";

type TicketItem = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
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

type NotificationItem = {
  id: string;
  ticketId?: string | null;
  status: "unread" | "closed";
};

const COLUMNS: Array<{ key: TicketStatus; label: string }> = [
  { key: "backlog", label: "Backlog" },
  { key: "refining", label: "Refinando" },
  { key: "ticket", label: "Ticket" },
  { key: "in_progress", label: "Em andamento" },
  { key: "in_review", label: "Em revisão" },
  { key: "ready_deploy", label: "Pronto p/ deploy" },
  { key: "done", label: "Concluído" },
];

export default function KanbanItPage() {
  const { user, loading } = useAuthUser();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; from: TicketStatus } | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [filters, setFilters] = useState({
    company: "",
    priority: "",
    tags: "",
    assignedTo: "",
    search: "",
  });
  const [unreadByTicket, setUnreadByTicket] = useState<Record<string, number>>({});

  const isAllowed = useMemo(() => {
    const role = (user?.role ?? "").toLowerCase();
    return role === "it_dev" || role === "dev" || role === "developer";
  }, [user]);

  const grouped = useMemo(() => {
    const map: Record<TicketStatus, TicketItem[]> = {
      backlog: [],
      refining: [],
      ticket: [],
      in_progress: [],
      in_review: [],
      ready_deploy: [],
      done: [],
    };
    for (const ticket of tickets) {
      map[ticket.status]?.push(ticket);
    }
    return map;
  }, [tickets]);

  const loadTickets = useCallback(async () => {
    if (!isAllowed) return;
    setLoadingTickets(true);
    setError(null);
    try {
      const params = new URLSearchParams({ scope: "all" });
      if (filters.company) params.set("companyId", filters.company);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.tags) params.set("tags", filters.tags);
      if (filters.assignedTo) params.set("assignedTo", filters.assignedTo);
      if (filters.search) params.set("search", filters.search);
      const res = await fetch(`/api/tickets?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { items?: TicketItem[]; error?: string };
      if (!res.ok) {
        setTickets([]);
        setError(json?.error || "Erro ao carregar tickets");
        return;
      }
      setTickets(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar tickets";
      setError(msg);
    } finally {
      setLoadingTickets(false);
    }
  }, [filters, isAllowed]);

  const loadUnread = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/notifications?unread=true", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { items?: NotificationItem[] };
      if (!res.ok) return;
      const items = Array.isArray(json.items) ? json.items : [];
      const counts: Record<string, number> = {};
      for (const item of items) {
        if (!item.ticketId) continue;
        counts[item.ticketId] = (counts[item.ticketId] ?? 0) + 1;
      }
      setUnreadByTicket(counts);
    } catch {
      setUnreadByTicket({});
    }
  }, [user]);

  useEffect(() => {
    if (!isAllowed) return;
    loadTickets();
  }, [loadTickets, isAllowed]);

  useEffect(() => {
    if (!user) return;
    loadUnread();
    const timer = setInterval(loadUnread, 20000);
    return () => clearInterval(timer);
  }, [user, loadUnread]);

  useEffect(() => {
    const timer = setInterval(() => loadTickets(), 30000);
    return () => clearInterval(timer);
  }, [loadTickets]);

  function handleDragStart(ticket: TicketItem) {
    setDragging({ id: ticket.id, from: ticket.status });
  }

  async function handleDrop(toStatus: TicketStatus) {
    if (!dragging) return;
    if (dragging.from === toStatus) {
      setDragging(null);
      return;
    }
    const previous = tickets;
    const next = tickets.map((ticket) =>
      ticket.id === dragging.id ? { ...ticket, status: toStatus } : ticket,
    );
    setTickets(next);
    setDragging(null);
    try {
      const res = await fetch(`/api/tickets/${dragging.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: toStatus }),
      });
      const json = (await res.json().catch(() => ({}))) as { item?: TicketItem; error?: string };
      if (!res.ok || !json.item) {
        setTickets(previous);
        setError(json?.error || "Falha ao mover ticket");
        return;
      }
      setTickets((current) =>
        current.map((ticket) => (ticket.id === json.item?.id ? json.item : ticket)),
      );
      loadUnread();
    } catch {
      setTickets(previous);
      setError("Falha ao mover ticket");
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Carregando...</div>;
  }

  if (!isAllowed) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Acesso restrito.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Kanban IT</h1>
        <p className="text-sm text-(--tc-text-muted,#6b7280)">Fluxo de chamados para equipe de desenvolvimento.</p>
      </header>

      <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-(--tc-text-muted,#6b7280)">
          <FiFilter size={14} /> Filtros
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <input
            className="rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-sm"
            placeholder="Empresa"
            value={filters.company}
            onChange={(e) => setFilters((prev) => ({ ...prev, company: e.target.value }))}
          />
          <input
            className="rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-sm"
            placeholder="Prioridade (low|medium|high|urgent)"
            value={filters.priority}
            onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}
          />
          <input
            className="rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-sm"
            placeholder="Tags (separadas por virgula)"
            value={filters.tags}
            onChange={(e) => setFilters((prev) => ({ ...prev, tags: e.target.value }))}
          />
          <input
            className="rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-sm"
            placeholder="Atribuido para (user id)"
            value={filters.assignedTo}
            onChange={(e) => setFilters((prev) => ({ ...prev, assignedTo: e.target.value }))}
          />
          <input
            className="rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-sm"
            placeholder="Busca"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadTickets}
            className="inline-flex items-center gap-2 rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
          >
            <FiRefreshCw size={14} /> Atualizar
          </button>
          {loadingTickets && <span className="text-xs text-(--tc-text-muted,#6b7280)">Carregando...</span>}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      <section className="grid gap-4 lg:grid-cols-7">
        {COLUMNS.map((column) => (
          <div
            key={column.key}
            className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-3 min-h-[18rem]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(column.key)}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">
                {column.label}
              </h2>
              <span className="text-xs text-(--tc-text-muted,#6b7280)">
                {grouped[column.key]?.length ?? 0}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {(grouped[column.key] ?? []).map((ticket) => {
                const unread = unreadByTicket[ticket.id] ?? 0;
                const assigneeLabel = ticket.assignedToName || ticket.assignedToEmail || "";
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    draggable
                    onDragStart={() => handleDragStart(ticket)}
                    onClick={() => setSelectedTicket(ticket)}
                    className="w-full rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-3 text-left shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{ticket.title}</p>
                        <p className="text-xs text-(--tc-text-muted,#6b7280)">
                          {ticket.companySlug || "Sem empresa"}
                        </p>
                      </div>
                      {unread > 0 && (
                        <span className="rounded-full bg-(--tc-accent,#ef0001) px-2 py-0.5 text-[10px] font-semibold text-white">
                          {unread}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                      <span>{getTicketStatusLabel(ticket.status)}</span>
                      {ticket.priority && <span>{ticket.priority}</span>}
                    </div>
                    <p className="mt-2 text-[11px] text-(--tc-text-muted,#6b7280)">
                      {assigneeLabel ? `Dev: ${assigneeLabel}` : "Sem responsavel"}
                    </p>
                    {ticket.tags && ticket.tags.length > 0 && (
                      <p className="mt-2 text-[11px] text-(--tc-text-muted,#6b7280)">
                        {ticket.tags.join(", ")}
                      </p>
                    )}
                  </button>
                );
              })}
              {(grouped[column.key] ?? []).length === 0 && (
                <p className="text-xs text-(--tc-text-muted,#6b7280)">Sem tickets</p>
              )}
            </div>
          </div>
        ))}
      </section>

      <TicketDetailsModal
        open={Boolean(selectedTicket)}
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        canEditStatus={true}
        onTicketUpdated={(updated) => {
          setSelectedTicket(updated);
          setTickets((current) =>
            current.map((ticket) => (ticket.id === updated.id ? updated : ticket)),
          );
        }}
      />
    </div>
  );
}
