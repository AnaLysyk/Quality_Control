"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiMessageSquare, FiPlus, FiEdit2, FiTrash2, FiX, FiSave } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";

type TicketStatus = "open" | "in_progress" | "closed";

type TicketItem = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
};

type DraftTicket = {
  title: string;
  description: string;
};

function statusLabel(status: TicketStatus) {
  if (status === "in_progress") return "Em andamento";
  if (status === "closed") return "Fechado";
  return "Aberto";
}

function statusStyle(status: TicketStatus) {
  if (status === "closed") return "bg-emerald-100 text-emerald-700";
  if (status === "in_progress") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default function TicketsButton() {
  const { user } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftTicket | null>(null);
  const [saving, setSaving] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);

  const isCreating = editingId === "new";

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
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

  const loadTickets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tickets", { credentials: "include", cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { items?: TicketItem[]; error?: string };
      if (!res.ok) {
        setItems([]);
        setError(json?.error || "Erro ao carregar chamados");
        return;
      }
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar chamados";
      setItems([]);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      loadTickets();
    }
  }, [open, loadTickets]);

  const countLabel = useMemo(() => {
    if (!items.length) return "Sem chamados";
    if (items.length === 1) return "1 chamado";
    return `${items.length} chamados`;
  }, [items.length]);

  function startCreate() {
    setMessage(null);
    setError(null);
    setEditingId("new");
    setExpandedId(null);
    setDraft({ title: "", description: "" });
  }

  function startEdit(ticket: TicketItem) {
    setMessage(null);
    setError(null);
    setEditingId(ticket.id);
    setExpandedId(ticket.id);
    setDraft({ title: ticket.title, description: ticket.description });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (isCreating) {
        const res = await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(draft),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json?.error || "Erro ao criar chamado");
          return;
        }
        setMessage("Chamado criado com sucesso.");
      } else if (editingId) {
        const res = await fetch(`/api/tickets/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(draft),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json?.error || "Erro ao atualizar chamado");
          return;
        }
        setMessage("Chamado atualizado.");
      }
      setEditingId(null);
      setDraft(null);
      await loadTickets();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar chamado";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTicket(ticketId: string) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.error || "Erro ao excluir chamado");
        return;
      }
      setMessage("Chamado excluido.");
      if (expandedId === ticketId) setExpandedId(null);
      if (editingId === ticketId) cancelEdit();
      await loadTickets();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir chamado";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir chamados"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-(--tc-border,#e5e7eb)/70 bg-(--tc-surface,#ffffff) text-(--tc-text,#0f172a) shadow-[0_8px_20px_rgba(15,23,42,0.12)] transition hover:border-(--tc-accent,#ef0001)/60 hover:text-(--tc-accent,#ef0001)"
      >
        <FiMessageSquare size={18} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) shadow-[0_20px_45px_rgba(15,23,42,0.2)]">
          <div className="flex items-center justify-between gap-3 border-b border-(--tc-border,#e5e7eb) px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Chamados</p>
              <p className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{countLabel}</p>
            </div>
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-(--tc-accent,#ef0001) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white hover:bg-(--tc-accent-hover,#c80001)"
            >
              <FiPlus size={14} /> Criar
            </button>
          </div>

          <div className="max-h-[70vh] overflow-auto px-4 py-3 space-y-3">
            {isCreating && draft && (
              <div className="rounded-xl border border-(--tc-border,#e5e7eb) p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">
                  Novo chamado
                </p>
                <div className="mt-2 space-y-2">
                  <input
                    className="form-control-user w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                    placeholder="Titulo"
                    value={draft.title}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                  />
                  <textarea
                            rows={4}
                            className="form-control-user w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                    placeholder="Descreva o chamado..."
                    value={draft.description}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-(--tc-surface-dark,#0b1a3c) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
                  >
                    <FiSave size={14} /> {saving ? "Salvando" : "Salvar"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="inline-flex items-center gap-2 rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
                  >
                    <FiX size={14} /> Fechar
                  </button>
                </div>
              </div>
            )}

            {loading && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando...</p>}
            {!loading && items.length === 0 && (
              <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhum chamado criado ainda.</p>
            )}

            {items.map((ticket) => {
              const isExpanded = expandedId === ticket.id;
              const isEditing = editingId === ticket.id;
              const localDraft = isEditing && draft ? draft : null;

              return (
                <div
                  key={ticket.id}
                  className="rounded-xl border border-(--tc-border,#e5e7eb) p-3 transition"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId((prev) => (prev === ticket.id ? null : ticket.id))}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{ticket.title || "Sem titulo"}</p>
                      <p className="text-xs text-(--tc-text-muted,#6b7280)">
                        Atualizado em {new Date(ticket.updatedAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-[0.25em] px-2 py-1 rounded ${statusStyle(ticket.status)}`}>
                      {statusLabel(ticket.status)}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-3">
                      {isEditing && localDraft ? (
                        <>
                          <input
                            className="w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                            placeholder="Titulo"
                            aria-label="Editar titulo do chamado"
                            value={localDraft.title}
                            onChange={(e) =>
                              setDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                            }
                          />
                          <textarea
                            rows={4}
                            className="w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
                            placeholder="Descreva o chamado..."
                            aria-label="Editar descricao do chamado"
                            value={localDraft.description}
                            onChange={(e) =>
                              setDraft((prev) => (prev ? { ...prev, description: e.target.value } : prev))
                            }
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={saveDraft}
                              disabled={saving}
                              className="inline-flex items-center gap-2 rounded-lg bg-(--tc-surface-dark,#0b1a3c) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
                            >
                              <FiSave size={14} /> {saving ? "Salvando" : "Salvar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTicket(ticket.id)}
                              className="inline-flex items-center gap-2 rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
                            >
                              <FiTrash2 size={14} /> Excluir
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="inline-flex items-center gap-2 rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
                            >
                              <FiX size={14} /> Fechar
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-wrap text-(--tc-text-secondary,#4b5563)">
                            {ticket.description || "Sem descricao."}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(ticket)}
                              className="inline-flex items-center gap-2 rounded-lg bg-(--tc-surface-dark,#0b1a3c) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
                            >
                              <FiEdit2 size={14} /> Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTicket(ticket.id)}
                              className="inline-flex items-center gap-2 rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
                            >
                              <FiTrash2 size={14} /> Excluir
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedId(null)}
                              className="inline-flex items-center gap-2 rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
                            >
                              <FiX size={14} /> Fechar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="text-sm text-green-600">{message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
