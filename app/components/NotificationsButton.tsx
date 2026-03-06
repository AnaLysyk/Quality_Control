"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiBell } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { getSuporteStatusLabel, SUPORTE_STATUS_OPTIONS, type SuporteStatus } from "@/lib/suportesStatus";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  status: "unread" | "closed";
  createdAt: string;
  updatedAt: string;
  link?: string | null;
  companySlug?: string | null;
  requestId?: string | null;
  ticketId?: string | null;
};

type TicketItem = {
  id: string;
  title: string;
  description: string;
  status: SuporteStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  companySlug?: string | null;
};

export default function NotificationsButton() {
  const router = useRouter();
  const { user } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const [ticketInfo, setTicketInfo] = useState<TicketItem | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [ticketUpdating, setTicketUpdating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (containerRef.current?.contains(e.target as Node)) return;
      if (detailsOpen) {
        setDetailsOpen(false);
        return;
      }
      setOpen(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (detailsOpen) {
        setDetailsOpen(false);
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [detailsOpen]);

  useEffect(() => {
    if (!open) {
      setDetailsOpen(false);
      setSelected(null);
      setTicketInfo(null);
      setTicketError(null);
      setTicketLoading(false);
      setTicketUpdating(false);
    }
  }, [open]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications", { credentials: "include", cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { items?: NotificationItem[]; error?: string };
      if (!res.ok) {
        setItems([]);
        setError(json?.error || "Erro ao carregar notificacoes");
        return;
      }
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar notificacoes";
      setItems([]);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user, loadNotifications]);

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open, loadNotifications]);

  const unreadCount = useMemo(
    () => items.filter((item) => item.status !== "closed").length,
    [items],
  );

  const [canManageTickets, setCanManageTickets] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!user) return;
    // Global admin or legacy roleGlobal ADMIN should manage tickets
    if (user?.isGlobalAdmin === true || user?.roleGlobal === "ADMIN") {
      setCanManageTickets(true);
      return () => {
        mounted = false;
      };
    }
    import("@/lib/rbac/devAccess")
      .then((mod) => {
        if (!mounted) return;
        setCanManageTickets(Boolean(mod.isDevRole?.(user?.role)));
      })
      .catch(() => {
        if (!mounted) return;
        setCanManageTickets(false);
      });
    return () => {
      mounted = false;
    };
  }, [user?.role, user]);

  const loadTicketDetails = useCallback(
    async (ticketId: string) => {
      if (!canManageTickets || !ticketId) return;
      setTicketLoading(true);
      setTicketError(null);
      try {
        const res = await fetch(`/api/tickets/${ticketId}`, {
          credentials: "include",
          cache: "no-store",
        });
        const json = (await res.json().catch(() => ({}))) as { item?: TicketItem; error?: string };
        if (!res.ok) {
          setTicketInfo(null);
          setTicketError(json?.error || "Erro ao carregar chamado");
          return;
        }
        setTicketInfo(json.item ?? null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao carregar chamado";
        setTicketInfo(null);
        setTicketError(msg);
      } finally {
        setTicketLoading(false);
      }
    },
    [canManageTickets],
  );

  function openDetails(item: NotificationItem) {
    setSelected(item);
    setDetailsOpen(true);
    setTicketInfo(null);
    setTicketError(null);
    setTicketLoading(false);
    setTicketUpdating(false);
    const isTicketNotification =
      item.type === "TICKET_CREATED" ||
      item.type === "TICKET_STATUS_CHANGED" ||
      item.type === "TICKET_COMMENT_ADDED" ||
      item.type === "TICKET_REACTION_ADDED" ||
      item.type === "TICKET_ASSIGNED";
    if (canManageTickets && isTicketNotification && item.ticketId) {
      loadTicketDetails(item.ticketId);
    }
  }

  async function closeNotification(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "closed" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Erro ao atualizar notificacao");
        return;
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: "closed", updatedAt: json?.item?.updatedAt ?? item.updatedAt }
            : item,
        ),
      );
      setSelected((prev) =>
        prev && prev.id === id
          ? { ...prev, status: "closed", updatedAt: json?.item?.updatedAt ?? prev.updatedAt }
          : prev,
      );
      listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar notificacao";
      setError(msg);
    }
  }

  async function updateTicketStatus(nextStatus: SuporteStatus) {
    if (!selected?.ticketId) return;
    setTicketUpdating(true);
    setTicketError(null);
    try {
      const res = await fetch(`/api/tickets/${selected.ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = (await res.json().catch(() => ({}))) as { item?: TicketItem; error?: string };
      if (!res.ok) {
        setTicketError(json?.error || "Erro ao atualizar status");
        return;
      }
      setTicketInfo(json.item ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar status";
      setTicketError(msg);
    } finally {
      setTicketUpdating(false);
    }
  }

  if (!user) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir notificacoes"
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-(--tc-border,#e5e7eb)/70 bg-(--tc-surface,#ffffff) text-(--tc-text,#0f172a) shadow-[0_8px_20px_rgba(15,23,42,0.12)] transition hover:border-(--tc-accent,#ef0001)/60 hover:text-(--tc-accent,#ef0001)"
      >
        <FiBell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-(--tc-accent,#ef0001) px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-[0_6px_16px_rgba(239,0,1,0.35)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) shadow-[0_20px_45px_rgba(15,23,42,0.2)]">
          <div className="flex items-center justify-between gap-3 border-b border-(--tc-border,#e5e7eb) px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">
                Notificacoes
              </p>
              <p className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">
                {unreadCount > 0 ? `${unreadCount} nao lida(s)` : "Tudo em dia"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadNotifications()}
              className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text,#0f172a) hover:border-(--tc-accent,#ef0001)/50"
            >
              Atualizar
            </button>
          </div>

          <div
            ref={listRef}
            className="max-h-[70vh] overflow-auto px-4 py-3 space-y-3"
          >
            {loading && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando...</p>}
            {!loading && items.length === 0 && (
              <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhuma notificacao por aqui.</p>
            )}

            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openDetails(item)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  item.status === "closed"
                    ? "border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) text-(--tc-text-muted,#6b7280)"
                    : "border-(--tc-accent,#ef0001)/40 bg-(--tc-accent,#ef0001)/5 text-(--tc-text,#0f172a) hover:bg-(--tc-accent,#ef0001)/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.title}</p>
                    {item.description && (
                      <p className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">{item.description}</p>
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                    {item.status === "closed" ? "Fechada" : "Nova"}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-(--tc-text-muted,#6b7280)">
                  {new Date(item.createdAt).toLocaleString("pt-BR")}
                </p>
              </button>
            ))}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
      )}

      {detailsOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) shadow-[0_30px_60px_rgba(15,23,42,0.35)]">
            <div className="flex items-start justify-between gap-4 border-b border-(--tc-border,#e5e7eb) px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Notificacao</p>
                <p className="text-lg font-semibold text-(--tc-text-primary,#0b1a3c)">{selected.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
              >
                Fechar
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {selected.description && (
                <p className="text-sm whitespace-pre-wrap text-(--tc-text-secondary,#4b5563)">
                  {selected.description}
                </p>
              )}

              <div className="grid gap-2 text-xs text-(--tc-text-muted,#6b7280)">
                <p>
                  <span className="font-semibold text-(--tc-text,#0f172a)">Status:</span>{" "}
                  {selected.status === "closed" ? "Fechada" : "Nova"}
                </p>
                <p>
                  <span className="font-semibold text-(--tc-text,#0f172a)">Criada:</span>{" "}
                  {new Date(selected.createdAt).toLocaleString("pt-BR")}
                </p>
                {selected.companySlug && (
                  <p>
                    <span className="font-semibold text-(--tc-text,#0f172a)">Empresa:</span>{" "}
                    {selected.companySlug}
                  </p>
                )}
              {canManageTickets && (
                <>
                  <p>
                    <span className="font-semibold text-(--tc-text,#0f172a)">Tipo:</span> {selected.type}
                  </p>
                    <p>
                      <span className="font-semibold text-(--tc-text,#0f172a)">ID:</span> {selected.id}
                    </p>
                    {selected.ticketId && (
                      <p>
                        <span className="font-semibold text-(--tc-text,#0f172a)">Chamado ID:</span>{" "}
                        {selected.ticketId}
                      </p>
                    )}
                  </>
                )}
              </div>

              {selected.link && (
                <button
                  type="button"
                  onClick={() => {
                    if (selected.link) router.push(selected.link);
                    setDetailsOpen(false);
                    setOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-(--tc-surface-dark,#0b1a3c) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
                >
                  Abrir link
                </button>
              )}

              {canManageTickets && selected.ticketId && (
                <div className="rounded-xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4 space-y-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Chamado</p>
                  {ticketLoading && (
                    <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando chamado...</p>
                  )}
                  {!ticketLoading && ticketInfo && (
                    <>
                      <div>
                        <p className="text-sm font-semibold text-(--tc-text,#0f172a)">{ticketInfo.title}</p>
                        <p className="text-xs text-(--tc-text-muted,#6b7280)">
                          Criado em {new Date(ticketInfo.createdAt).toLocaleString("pt-BR")}
                          {ticketInfo.createdByName || ticketInfo.createdByEmail
                            ? ` por ${ticketInfo.createdByName || ticketInfo.createdByEmail}`
                            : ""}
                        </p>
                      </div>
                      <p className="text-sm whitespace-pre-wrap text-(--tc-text-secondary,#4b5563)">
                        {ticketInfo.description || "Sem descricao."}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <label
                          htmlFor={`notification-ticket-status-${selected.ticketId ?? "current"}`}
                          className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)"
                        >
                          Status
                        </label>
                        <select
                          id={`notification-ticket-status-${selected.ticketId ?? "current"}`}
                          className="rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-xs"
                          value={ticketInfo.status}
                          onChange={(e) => updateTicketStatus(e.target.value as SuporteStatus)}
                          disabled={ticketUpdating || !canManageTickets}
                        >
                          {SUPORTE_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-(--tc-text-muted,#6b7280)">
                          Atual: {getSuporteStatusLabel(ticketInfo.status)}
                        </span>
                      </div>
                    </>
                  )}
                  {!ticketLoading && !ticketInfo && !ticketError && (
                    <p className="text-sm text-(--tc-text-muted,#6b7280)">Chamado nao encontrado.</p>
                  )}
                  {ticketError && <p className="text-sm text-red-600">{ticketError}</p>}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => closeNotification(selected.id)}
                  disabled={selected.status === "closed"}
                  className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] disabled:opacity-60"
                >
                  {selected.status === "closed" ? "Ja marcada" : "Marcar como lida"}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(false)}
                  className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
                >
                  Voltar
                </button>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
