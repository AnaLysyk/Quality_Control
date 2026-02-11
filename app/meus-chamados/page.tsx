"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";
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
  assignedToUserId?: string | null;
};

type NotificationItem = {
  id: string;
  ticketId?: string | null;
  status: "unread" | "closed";
};

export default function MeusChamadosPage() {
  const { user, loading } = useAuthUser();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [unreadByTicket, setUnreadByTicket] = useState<Record<string, number>>({});

  const loadTickets = useCallback(async () => {
    if (!user) return;
    setLoadingTickets(true);
    setError(null);
    try {
      const res = await fetch("/api/tickets?scope=mine", { credentials: "include", cache: "no-store" });
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

  const loadUnread = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/notifications?unread=true", { credentials: "include", cache: "no-store" });
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
    if (!user) return;
    loadTickets();
    loadUnread();
  }, [user, loadTickets, loadUnread]);

  useEffect(() => {
    if (!user) return;
    const timer = setInterval(loadUnread, 20000);
    return () => clearInterval(timer);
  }, [user, loadUnread]);

  const emptyLabel = useMemo(() => {
    if (loadingTickets) return "Carregando...";
    if (!tickets.length) return "Nenhum chamado encontrado.";
    return "";
  }, [loadingTickets, tickets.length]);

  if (loading) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Carregando...</div>;
  }

  if (!user) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Acesso restrito.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Meus Chamados</h1>
        <p className="text-sm text-(--tc-text-muted,#6b7280)">Acompanhe o andamento e converse com o time.</p>
      </header>

      <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Lista</p>
            <p className="text-sm font-semibold">{tickets.length} chamado(s)</p>
          </div>
          <button
            type="button"
            onClick={loadTickets}
            className="inline-flex items-center gap-2 rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
          >
            <FiRefreshCw size={14} /> Atualizar
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {emptyLabel && <p className="text-sm text-(--tc-text-muted,#6b7280)">{emptyLabel}</p>}

        <div className="grid gap-3 md:grid-cols-2">
          {tickets.map((ticket) => {
            const unread = unreadByTicket[ticket.id] ?? 0;
            return (
              <button
                key={ticket.id}
                type="button"
                onClick={() => setSelectedTicket(ticket)}
                className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 text-left shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{ticket.title}</p>
                    <p className="text-xs text-(--tc-text-muted,#6b7280)">
                      Atualizado em {new Date(ticket.updatedAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {unread > 0 && (
                    <span className="rounded-full bg-(--tc-accent,#ef0001) px-2 py-0.5 text-[10px] font-semibold text-white">
                      {unread}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                  {getTicketStatusLabel(ticket.status)}
                </p>
                {ticket.tags && ticket.tags.length > 0 && (
                  <p className="mt-2 text-xs text-(--tc-text-muted,#6b7280)">
                    {ticket.tags.join(", ")}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <TicketDetailsModal
        open={Boolean(selectedTicket)}
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        canEditStatus={false}
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
