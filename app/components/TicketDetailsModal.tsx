"use client";

import { useEffect, useMemo, useState } from "react";
import { FiHeart, FiMessageSquare, FiRefreshCw, FiX } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { TICKET_STATUS_OPTIONS, getTicketStatusLabel, type TicketStatus } from "@/lib/ticketsStatus";

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
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  companySlug?: string | null;
  companyId?: string | null;
};

type TicketComment = {
  id: string;
  ticketId: string;
  authorUserId: string;
  authorName?: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  reactions?: { like: number };
  viewerHasLiked?: boolean;
};

type TicketEvent = {
  id: string;
  ticketId: string;
  type: string;
  payload?: Record<string, unknown> | null;
  actorUserId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  createdAt: string;
};

type AssigneeItem = {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  active?: boolean;
};

type Props = {
  open: boolean;
  ticket: TicketItem | null;
  onClose: () => void;
  canEditStatus?: boolean;
  onTicketUpdated?: (ticket: TicketItem) => void;
};

const EVENT_LABELS: Record<string, string> = {
  CREATED: "Chamado criado",
  STATUS_CHANGED: "Status alterado",
  COMMENT_ADDED: "Comentario adicionado",
  COMMENT_UPDATED: "Comentario atualizado",
  COMMENT_DELETED: "Comentario removido",
  REACTION_ADDED: "Reacao adicionada",
  ASSIGNED: "Chamado atribuido",
  UPDATED: "Detalhes atualizados",
};

function formatEventLabel(event: TicketEvent) {
  const base = EVENT_LABELS[event.type] ?? event.type;
  if (event.type === "STATUS_CHANGED") {
    const from = event.payload?.from ? String(event.payload.from) : "";
    const to = event.payload?.to ? String(event.payload.to) : "";
    if (from && to) return `${base}: ${getTicketStatusLabel(from as TicketStatus)} → ${getTicketStatusLabel(to as TicketStatus)}`;
  }
  return base;
}

export default function TicketDetailsModal({ open, ticket, onClose, canEditStatus, onTicketUpdated }: Props) {
  const { user } = useAuthUser();
  const [tab, setTab] = useState<"details" | "comments" | "history">("details");
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSaving, setCommentSaving] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [editingSaving, setEditingSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<AssigneeItem[]>([]);
  const [assigneesLoading, setAssigneesLoading] = useState(false);
  const [assigneeError, setAssigneeError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState("");

  const ticketId = ticket?.id ?? null;
  const assignedLabel =
    ticket?.assignedToName ||
    ticket?.assignedToEmail ||
    (ticket?.assignedToUserId ? `UID: ${ticket.assignedToUserId}` : "Nao atribuido");
  const role = (user?.role ?? "").toLowerCase();
  const canAssign = Boolean(user && (user.isGlobalAdmin || role === "admin" || role === "it_dev" || role === "dev" || role === "developer"));

  const tagsLabel = useMemo(() => {
    const tags = Array.isArray(ticket?.tags) ? ticket?.tags : [];
    return tags.length ? tags.join(", ") : "Sem tags";
  }, [ticket?.tags]);

  useEffect(() => {
    if (!open || !ticketId) return;
    fetch("/api/notifications/read-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ticketId }),
    }).catch(() => null);
  }, [open, ticketId]);

  useEffect(() => {
    if (!open) {
      setEditingCommentId(null);
      setEditingCommentBody("");
      setCommentBody("");
      setTab("details");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSelectedAssignee(ticket?.assignedToUserId ?? "");
  }, [open, ticket?.assignedToUserId]);

  useEffect(() => {
    if (!open || !canAssign) return;
    let active = true;
    setAssigneesLoading(true);
    setAssigneeError(null);
    const endpoint = ticket?.companyId
      ? `/api/admin/users?client_id=${encodeURIComponent(ticket.companyId)}`
      : "/api/admin/users";
    fetch(endpoint, { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const items = Array.isArray(data?.items) ? (data.items as AssigneeItem[]) : [];
        const filtered = items.filter((item) => {
          const role = (item.role ?? "").toLowerCase();
          return role === "it_dev" || role === "dev" || role === "developer";
        });
        setAssignees(filtered);
      })
      .catch((err) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : "Erro ao carregar desenvolvedores";
        setAssignees([]);
        setAssigneeError(msg);
      })
      .finally(() => {
        if (!active) return;
        setAssigneesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, canAssign, ticket?.companyId]);

  async function loadComments() {
    if (!ticketId) return;
    setLoadingComments(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, { credentials: "include", cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { items?: TicketComment[]; error?: string };
      if (!res.ok) {
        setCommentError(json?.error || "Erro ao carregar comentarios");
        setComments([]);
        return;
      }
      setComments(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar comentarios";
      setCommentError(msg);
    } finally {
      setLoadingComments(false);
    }
  }

  async function loadEvents() {
    if (!ticketId) return;
    setLoadingEvents(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/events`, { credentials: "include", cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { items?: TicketEvent[] };
      if (!res.ok) {
        setEvents([]);
        return;
      }
      setEvents(Array.isArray(json.items) ? json.items : []);
    } finally {
      setLoadingEvents(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    loadComments();
    loadEvents();
  }, [open, ticketId]);

  async function submitComment() {
    if (!ticketId) return;
    setCommentSaving(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: commentBody }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCommentError(json?.error || "Erro ao salvar comentario");
        return;
      }
      setCommentBody("");
      await loadComments();
      await loadEvents();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar comentario";
      setCommentError(msg);
    } finally {
      setCommentSaving(false);
    }
  }

  async function toggleLike(comment: TicketComment) {
    if (!ticketId) return;
    const hasLiked = comment.viewerHasLiked;
    const endpoint = hasLiked
      ? `/api/comments/${comment.id}/reactions/like`
      : `/api/comments/${comment.id}/reactions`;
    const method = hasLiked ? "DELETE" : "POST";
    const body = hasLiked ? undefined : JSON.stringify({ type: "like" });
    await fetch(endpoint, {
      method,
      headers: hasLiked ? undefined : { "Content-Type": "application/json" },
      credentials: "include",
      body,
    });
    await loadComments();
  }

  function startEditComment(comment: TicketComment) {
    setEditingCommentId(comment.id);
    setEditingCommentBody(comment.body);
  }

  function cancelEditComment() {
    setEditingCommentId(null);
    setEditingCommentBody("");
  }

  async function saveEditComment(comment: TicketComment) {
    setEditingSaving(true);
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: editingCommentBody }),
      });
      if (!res.ok) return;
      await loadComments();
      await loadEvents();
      cancelEditComment();
    } finally {
      setEditingSaving(false);
    }
  }

  async function deleteComment(comment: TicketComment) {
    const res = await fetch(`/api/comments/${comment.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      await loadComments();
      await loadEvents();
    }
  }

  async function updateStatus(nextStatus: TicketStatus) {
    if (!ticketId) return;
    setStatusUpdating(true);
    setStatusError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusError(json?.error || "Erro ao atualizar status");
        return;
      }
      if (json?.item && onTicketUpdated) {
        onTicketUpdated(json.item);
      }
      await loadEvents();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar status";
      setStatusError(msg);
    } finally {
      setStatusUpdating(false);
    }
  }

  async function updateAssignment(nextAssignee: string) {
    if (!ticketId) return;
    setAssigning(true);
    setAssigneeError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assignedToUserId: nextAssignee || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.item) {
        setAssigneeError(json?.error || "Erro ao atribuir");
        return;
      }
      setSelectedAssignee(json.item.assignedToUserId ?? "");
      onTicketUpdated?.(json.item as TicketItem);
      await loadEvents();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao atribuir";
      setAssigneeError(msg);
    } finally {
      setAssigning(false);
    }
  }

  if (!open || !ticket) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
        <div className="flex items-start justify-between gap-4 border-b border-(--tc-border,#e5e7eb) px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Chamado</p>
            <h2 className="text-lg font-semibold text-(--tc-text,#0f172a)">{ticket.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
          >
            <FiX />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-(--tc-border,#e5e7eb) px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em]">
          {(["details", "comments", "history"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-full px-3 py-1 ${
                tab === key ? "bg-(--tc-accent,#ef0001) text-white" : "text-(--tc-text-muted,#6b7280)"
              }`}
            >
              {key === "details" ? "Detalhes" : key === "comments" ? "Comentarios" : "Historico"}
            </button>
          ))}
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-auto">
          {tab === "details" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Status</p>
                  <p className="text-sm font-semibold">{getTicketStatusLabel(ticket.status)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Prioridade</p>
                  <p className="text-sm font-semibold">{ticket.priority ?? "medium"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Atribuido</p>
                  <p className="text-sm font-semibold">{assignedLabel}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Tags</p>
                  <p className="text-sm font-semibold">{tagsLabel}</p>
                </div>
              </div>
              {canAssign && (
                <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4 space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">
                    Responsavel pelo ticket
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-xs"
                      value={selectedAssignee}
                      onChange={(e) => updateAssignment(e.target.value)}
                      disabled={assigning || assigneesLoading}
                    >
                      <option value="">Sem responsavel</option>
                      {assignees.map((assignee) => (
                        <option key={assignee.id} value={assignee.id}>
                          {assignee.name || assignee.email}
                        </option>
                      ))}
                    </select>
                    {user?.id && (
                      <button
                        type="button"
                        onClick={() => updateAssignment(user.id)}
                        disabled={assigning || selectedAssignee === user.id}
                        className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.3em]"
                      >
                        Assumir
                      </button>
                    )}
                    {assigneesLoading && <span className="text-xs text-(--tc-text-muted,#6b7280)">Carregando...</span>}
                  </div>
                  {assigneeError && <p className="text-xs text-red-600">{assigneeError}</p>}
                  {!assigneesLoading && assignees.length === 0 && (
                    <p className="text-xs text-(--tc-text-muted,#6b7280)">Nenhum desenvolvedor disponivel.</p>
                  )}
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Descricao</p>
                <p className="mt-2 text-sm whitespace-pre-wrap text-(--tc-text-secondary,#4b5563)">
                  {ticket.description || "Sem descricao."}
                </p>
              </div>
              <div className="grid gap-2 text-xs text-(--tc-text-muted,#6b7280)">
                <p>
                  Criado em {new Date(ticket.createdAt).toLocaleString("pt-BR")}
                  {ticket.createdByName || ticket.createdByEmail
                    ? ` por ${ticket.createdByName || ticket.createdByEmail}`
                    : ""}
                </p>
                <p>Atualizado em {new Date(ticket.updatedAt).toLocaleString("pt-BR")}</p>
                {ticket.companySlug && <p>Empresa: {ticket.companySlug}</p>}
              </div>
              {canEditStatus && (
                <div className="mt-4 rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4 space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">
                    Atualizar status
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-xs"
                      value={ticket.status}
                      onChange={(e) => updateStatus(e.target.value as TicketStatus)}
                      disabled={statusUpdating}
                    >
                      {TICKET_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {statusUpdating && <span className="text-xs text-(--tc-text-muted,#6b7280)">Salvando...</span>}
                  </div>
                  {statusError && <p className="text-xs text-red-600">{statusError}</p>}
                </div>
              )}
            </>
          )}

          {tab === "comments" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 space-y-2">
                <textarea
                  rows={4}
                  className="w-full rounded-xl border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                  placeholder="Escreva um comentario..."
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={submitComment}
                    disabled={commentSaving || !commentBody.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-(--tc-accent,#ef0001) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
                  >
                    <FiMessageSquare size={14} /> {commentSaving ? "Enviando" : "Comentar"}
                  </button>
                  <button
                    type="button"
                    onClick={loadComments}
                    className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
                  >
                    <FiRefreshCw size={14} />
                  </button>
                </div>
                {commentError && <p className="text-xs text-red-600">{commentError}</p>}
              </div>

              {loadingComments && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando...</p>}
              {!loadingComments && comments.length === 0 && (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhum comentario ainda.</p>
              )}

              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-(--tc-text,#0f172a)">
                          {comment.authorName || comment.authorUserId}
                        </p>
                        <p className="text-[11px] text-(--tc-text-muted,#6b7280)">
                          {new Date(comment.createdAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleLike(comment)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${
                            comment.viewerHasLiked
                              ? "border-rose-200 bg-rose-50 text-rose-600"
                              : "border-(--tc-border,#e5e7eb) text-(--tc-text-muted,#6b7280)"
                          }`}
                        >
                          <FiHeart size={12} />
                          {comment.reactions?.like ?? 0}
                        </button>
                        {(comment.authorUserId === user?.id || user?.isGlobalAdmin) && !comment.deletedAt && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditComment(comment)}
                              className="rounded-full border border-(--tc-border,#e5e7eb) px-2 py-1 text-[11px] text-(--tc-text-muted,#6b7280)"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteComment(comment)}
                              className="rounded-full border border-rose-200 px-2 py-1 text-[11px] text-rose-600"
                            >
                              Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {editingCommentId === comment.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          rows={3}
                          className="w-full rounded-xl border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                          value={editingCommentBody}
                          onChange={(e) => setEditingCommentBody(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveEditComment(comment)}
                            disabled={editingSaving}
                            className="rounded-lg bg-(--tc-surface-dark,#0b1a3c) px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditComment}
                            className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em]"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm whitespace-pre-wrap text-(--tc-text-secondary,#4b5563)">
                        {comment.deletedAt ? "Comentario removido." : comment.body}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Historico</p>
                <button
                  type="button"
                  onClick={loadEvents}
                  className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em]"
                >
                  Atualizar
                </button>
              </div>
              {loadingEvents && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando...</p>}
              {!loadingEvents && events.length === 0 && (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhum evento registrado.</p>
              )}
              <div className="space-y-2">
                {events.map((event) => (
                  <div key={event.id} className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-3">
                    <p className="text-sm font-semibold text-(--tc-text,#0f172a)">{formatEventLabel(event)}</p>
                    <p className="text-[11px] text-(--tc-text-muted,#6b7280)">
                      {event.actorName || event.actorEmail || event.actorUserId || "Sistema"} •{" "}
                      {new Date(event.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
