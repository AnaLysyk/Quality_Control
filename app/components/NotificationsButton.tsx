"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiBell } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  status: "unread" | "closed";
  createdAt: string;
  updatedAt: string;
  link?: string | null;
};

export default function NotificationsButton() {
  const { user } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

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
        prev.map((item) => (item.id === id ? { ...item, status: "closed", updatedAt: json?.item?.updatedAt ?? item.updatedAt } : item)),
      );
      listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar notificacao";
      setError(msg);
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
          <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-(--tc-accent,#ef0001) px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-[0_6px_16px_rgba(239,0,1,0.35)]">
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
                onClick={() => closeNotification(item.id)}
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
    </div>
  );
}
