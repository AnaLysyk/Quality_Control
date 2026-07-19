"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiBell, FiExternalLink, FiRefreshCw, FiX } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { fetchApi } from "@/backend/api";
import { getTicketStatusLabel, TICKET_STATUS_OPTIONS, type TicketStatus } from "@/backend/ticketsStatus";

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
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  companySlug?: string | null;
};

type NotificationsButtonProps = {
  defaultOpen?: boolean;
  initialUnreadCount?: number;
};

export default function NotificationsButton({
  defaultOpen = false,
  initialUnreadCount = 0,
}: NotificationsButtonProps) {
  const router = useRouter();
  const { user } = useAuthUser();
  const [open, setOpen] = useState(defaultOpen);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [fallbackUnreadCount, setFallbackUnreadCount] = useState(initialUnreadCount);
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
    if (!open && !detailsOpen) return undefined;

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
  }, [detailsOpen, open]);

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
      const res = await fetchApi("/api/notifications", { credentials: "include", cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { items?: NotificationItem[]; error?: string };
      if (!res.ok) {
        setItems([]);
        setError(json?.error || "Erro ao carregar notificações");
        return;
      }
      const nextItems = Array.isArray(json.items) ? json.items : [];
      setItems(nextItems);
      setFallbackUnreadCount(nextItems.filter((item) => item.status !== "closed").length);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar notificações";
      setItems([]);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!open || !user) return;
    void loadNotifications();
  }, [open, user, loadNotifications]);

  useEffect(() => {
    setFallbackUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  const unreadCount = useMemo(() => {
    if (items.length > 0 || open) {
      return items.filter((item) => item.status !== "closed").length;
    }
    return fallbackUnreadCount;
  }, [fallbackUnreadCount, items, open]);

  const [canManageTickets, setCanManageTickets] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!user) return;
    import("@/backend/rbac/devAccess")
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
        const res = await fetchApi(`/api/tickets/${ticketId}`, {
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
      const res = await fetchApi(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "closed" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Erro ao atualizar notificação");
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
      const msg = err instanceof Error ? err.message : "Erro ao atualizar notificação";
      setError(msg);
    }
  }

  async function updateTicketStatus(nextStatus: TicketStatus) {
    if (!selected?.ticketId) return;
    setTicketUpdating(true);
    setTicketError(null);
    try {
      const res = await fetchApi(`/api/tickets/${selected.ticketId}/status`, {
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
        aria-label="Abrir notificações"
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white text-[var(--tc-primary,#011848)] shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:border-[var(--tc-accent,#ef0001)]/60 hover:text-[var(--tc-accent,#ef0001)]"
      >
        <FiBell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--tc-accent,#ef0001)] px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-[0_6px_16px_rgba(239,0,1,0.35)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[110] mt-2 w-[min(30rem,calc(100vw-2rem))] overflow-hidden rounded-[26px] border border-white/80 bg-[var(--tc-surface,#ffffff)] shadow-[0_26px_70px_rgba(15,23,42,0.24)]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[linear-gradient(135deg,var(--tc-primary,#011848)_0%,#071a44_52%,rgba(239,0,1,0.78)_150%)] px-4 py-4 text-white">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/65">
                Notificações
              </p>
              <p className="text-sm font-semibold text-white">
                {unreadCount > 0 ? `${unreadCount} não lida(s)` : "Tudo em dia"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadNotifications()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.22em] text-white transition hover:bg-white/20"
            >
              <FiRefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </button>
          </div>

          <div
            ref={listRef}
            className="max-h-[70vh] space-y-3 overflow-auto px-4 py-3"
          >
            {loading && <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">Carregando...</p>}
            {!loading && items.length === 0 && (
              <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">Nenhuma notificação por aqui.</p>
            )}

            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openDetails(item)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  item.status === "closed"
                    ? "border-[var(--tc-border,#e5e7eb)] bg-[var(--tc-surface-2,#f8fafc)] text-[var(--tc-text-muted,#6b7280)]"
                    : "border-[var(--tc-accent,#ef0001)]/40 bg-[var(--tc-accent,#ef0001)]/5 text-[var(--tc-text,#0f172a)] hover:bg-[var(--tc-accent,#ef0001)]/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.title}</p>
                    {item.description && (
                      <p className="mt-1 text-xs text-[var(--tc-text-muted,#6b7280)]">{item.description}</p>
                    )}
                  </div>
                  {item.status === "closed" ? (
                    <span
                      className="inline-flex h-7 shrink-0 items-center justify-center self-start rounded-full border border-[var(--tc-border,#e5e7eb)] bg-[var(--tc-surface,#ffffff)] px-2.5 text-[10px] leading-none font-medium uppercase tracking-[0.14em] whitespace-nowrap text-[var(--tc-text-muted,#6b7280)]"
                      aria-label="Lida"
                      title="Lida"
                    >
                      Lida
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">
                      Nova
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-[var(--tc-text-muted,#6b7280)]">
                  {new Date(item.createdAt).toLocaleString("pt-BR")}
                </p>
              </button>
            ))}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
      )}

      {detailsOpen && selected && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[30px] border border-white/80 bg-[var(--tc-surface,#ffffff)] shadow-[0_34px_90px_rgba(15,23,42,0.36)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(239,0,1,0.34),transparent_34%),linear-gradient(135deg,var(--tc-primary,#011848)_0%,#071a44_58%,rgba(239,0,1,0.82)_150%)] px-5 py-5 text-white">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--tc-text-muted,#6b7280)]">Notificação</p>
                <p className="text-lg font-semibold text-[var(--tc-text-primary,#0b1a3c)]">{selected.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Fechar"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(100dvh-13rem)] space-y-4 overflow-y-auto px-5 py-5">
              {selected.description && (
                <p className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-[var(--tc-surface-2,#f8fafc)] px-4 py-3 text-sm leading-6 whitespace-pre-wrap text-[var(--tc-text-secondary,#4b5563)]">
                  {selected.description}
                </p>
              )}

              <div className="grid gap-2 text-xs text-[var(--tc-text-muted,#6b7280)]">
                <p>
                  <span className="font-semibold text-[var(--tc-text,#0f172a)]">Status:</span>{" "}
                  {selected.status === "closed" ? "Fechada" : "Nova"}
                </p>
                <p>
                  <span className="font-semibold text-[var(--tc-text,#0f172a)]">Criada:</span>{" "}
                  {new Date(selected.createdAt).toLocaleString("pt-BR")}
                </p>
                {selected.companySlug && (
                  <p>
                    <span className="font-semibold text-[var(--tc-text,#0f172a)]">Empresa:</span>{" "}
                    {selected.companySlug}
                  </p>
                )}
              {canManageTickets && (
                <>
                  <p>
                    <span className="font-semibold text-[var(--tc-text,#0f172a)]">Tipo:</span> {selected.type}
                  </p>
                    <p>
                      <span className="font-semibold text-[var(--tc-text,#0f172a)]">ID:</span> {selected.id}
                    </p>
                    {selected.ticketId && (
                      <p>
                        <span className="font-semibold text-[var(--tc-text,#0f172a)]">Chamado ID:</span>{" "}
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
                  className="inline-flex items-center gap-2 rounded-2xl border-2 border-[var(--tc-accent,#ef0001)] bg-[var(--tc-accent,#ef0001)] px-4 py-3 text-xs font-black uppercase tracking-[0.22em] text-white shadow-[0_16px_34px_rgba(239,0,1,0.22)] transition hover:-translate-y-0.5 hover:bg-[var(--tc-accent-hover,#d00001)]"
                >
                  <FiExternalLink className="h-4 w-4" />
                  Abrir link
                </button>
              )}

              {canManageTickets && selected.ticketId && (
                <div className="rounded-xl border border-[var(--tc-border,#e5e7eb)] bg-[var(--tc-surface-2,#f8fafc)] p-4 space-y-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--tc-text-muted,#6b7280)]">Chamado</p>
                  {ticketLoading && (
                    <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">Carregando chamado...</p>
                  )}
                  {!ticketLoading && ticketInfo && (
                    <>
                      <div>
                        <p className="text-sm font-semibold text-[var(--tc-text,#0f172a)]">{ticketInfo.title}</p>
                        <p className="text-xs text-[var(--tc-text-muted,#6b7280)]">
                          Criado em {new Date(ticketInfo.createdAt).toLocaleString("pt-BR")}
                          {ticketInfo.createdByName || ticketInfo.createdByEmail
                            ? ` por ${ticketInfo.createdByName || ticketInfo.createdByEmail}`
                            : ""}
                        </p>
                      </div>
                      <p className="text-sm whitespace-pre-wrap text-[var(--tc-text-secondary,#4b5563)]">
                        {ticketInfo.description || "Sem descrição."}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <label
                          htmlFor={`notification-ticket-status-${selected.ticketId ?? "current"}`}
                          className="text-xs uppercase tracking-[0.3em] text-[var(--tc-text-muted,#6b7280)]"
                        >
                          Status
                        </label>
                        <select
                          id={`notification-ticket-status-${selected.ticketId ?? "current"}`}
                          className="rounded-lg border border-[var(--tc-border,#e5e7eb)] bg-white px-3 py-2 text-xs"
                          value={ticketInfo.status}
                          onChange={(e) => updateTicketStatus(e.target.value as TicketStatus)}
                          disabled={ticketUpdating || !canManageTickets}
                        >
                          {TICKET_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-[var(--tc-text-muted,#6b7280)]">
                          Atual: {getTicketStatusLabel(ticketInfo.status)}
                        </span>
                      </div>
                    </>
                  )}
                  {!ticketLoading && !ticketInfo && !ticketError && (
                    <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">Chamado não encontrado.</p>
                  )}
                  {ticketError && <p className="text-sm text-red-600">{ticketError}</p>}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => closeNotification(selected.id)}
                  disabled={selected.status === "closed"}
                  className="rounded-lg border border-[var(--tc-border,#e5e7eb)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] disabled:opacity-60"
                >
                  {selected.status === "closed" ? "Já marcada" : "Marcar como lida"}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(false)}
                  className="rounded-lg border border-[var(--tc-border,#e5e7eb)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
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

