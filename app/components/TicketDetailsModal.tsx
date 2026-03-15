"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FiEdit2, FiMessageSquare, FiSave, FiSend, FiX } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { TICKET_STATUS_OPTIONS } from "@/lib/ticketsStatus";
import type { TicketPriority, TicketType } from "@/lib/ticketsStore";

type TicketStatusOption = { value: string; label: string };
type TicketAssigneeOption = {
  id: string;
  label: string;
  email?: string | null;
  role?: string | null;
};

type TicketComment = {
  id: string;
  authorUserId: string;
  authorName?: string | null;
  authorLogin?: string | null;
  authorEmail?: string | null;
  authorAvatarUrl?: string | null;
  body: string;
  createdAt: string;
  deletedAt?: string | null;
};

type TicketShape = {
  id: string;
  title?: string | null;
  subject?: string | null;
  description?: string | null;
  body?: string | null;
  status?: string | null;
  type?: TicketType | null;
  priority?: TicketPriority | null;
  code?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  createdByLogin?: string | null;
  createdByAvatarUrl?: string | null;
  companySlug?: string | null;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
};

type TicketCapabilities = {
  canEditContent: boolean;
  canAssign: boolean;
  canMoveStatus: boolean;
};

type TicketDraft = {
  title: string;
  description: string;
  type: TicketType;
  priority: TicketPriority;
  status: string;
};

type TicketDetailsModalProps = {
  open: boolean;
  ticket: TicketShape | null;
  onClose: () => void;
  canEditStatus?: boolean;
  statusOptions?: TicketStatusOption[];
  onTicketUpdated?: (updated: TicketShape) => void;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleString("pt-BR");
}

function getTicketCode(ticket: TicketShape | null | undefined) {
  if (!ticket?.id) return "-";
  const code = typeof ticket.code === "string" ? ticket.code.trim().toUpperCase() : "";
  if (code) return code;
  return `SP-${ticket.id.slice(0, 6).toUpperCase()}`;
}

function getAuthorLabel(ticket: TicketShape | null | undefined) {
  return ticket?.createdByName || ticket?.createdByEmail || ticket?.createdBy || "-";
}

function getAssigneeLabel(ticket: TicketShape | null | undefined) {
  return ticket?.assignedToName || ticket?.assignedToEmail || (ticket?.assignedToUserId ? "Responsavel vinculado" : "Aguardando atendimento");
}

function sortComments(items: TicketComment[]) {
  return [...items]
    .filter((item) => !item.deletedAt)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function getCommentInitials(entry: TicketComment, mine: boolean) {
  const source = entry.authorName || entry.authorLogin || entry.authorEmail || (mine ? "Voce" : "Suporte");
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";
}

function getCommentHandle(entry: TicketComment) {
  return entry.authorLogin || entry.authorEmail || null;
}

function getLabelInitials(label?: string | null) {
  const source = (label ?? "").trim();
  if (!source) return "?";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getStatusTone(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "done") return "positive";
  if (normalized === "review") return "progress";
  if (normalized === "doing") return "warning";
  return "neutral";
}

function getTypeTone(type?: TicketType | null) {
  if (type === "bug") return "danger";
  if (type === "melhoria") return "progress";
  return "neutral";
}

const TICKET_TYPE_OPTIONS: { value: TicketType; label: string }[] = [
  { value: "tarefa", label: "Tarefa" },
  { value: "bug", label: "Bug" },
  { value: "melhoria", label: "Melhoria" },
];

const TICKET_PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
];
const COMMENT_MAX_LENGTH = 2000;

function getPriorityTone(priority?: TicketPriority | null) {
  if (priority === "high") return "danger";
  if (priority === "medium") return "warning";
  if (priority === "low") return "positive";
  return "neutral";
}

function toDraft(ticket: TicketShape | null): TicketDraft {
  return {
    title: ticket?.title || ticket?.subject || "",
    description: ticket?.description || ticket?.body || "",
    type: ticket?.type ?? "tarefa",
    priority: ticket?.priority ?? "medium",
    status: ticket?.status ?? "backlog",
  };
}

export default function TicketDetailsModal({
  open,
  ticket,
  onClose,
  canEditStatus,
  statusOptions = TICKET_STATUS_OPTIONS,
  onTicketUpdated,
}: TicketDetailsModalProps) {
  const { user } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<TicketShape | null>(ticket);
  const [draft, setDraft] = useState<TicketDraft>(toDraft(ticket));
  const [capabilities, setCapabilities] = useState<TicketCapabilities>({
    canEditContent: false,
    canAssign: false,
    canMoveStatus: false,
  });
  const [assigneeOptions, setAssigneeOptions] = useState<TicketAssigneeOption[]>([]);
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [savingAssignee, setSavingAssignee] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTicket = useCallback(async () => {
    if (!ticket?.id) return;
    setLoadingTicket(true);
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(ticket.id)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        item?: TicketShape;
        assigneeOptions?: TicketAssigneeOption[];
        capabilities?: Partial<TicketCapabilities>;
        error?: string;
      };
      if (!res.ok || !json.item) {
        throw new Error(json?.error || "Erro ao carregar chamado");
      }
      setCurrentTicket(json.item);
      setDraft(toDraft(json.item));
      setAssigneeOptions(Array.isArray(json.assigneeOptions) ? json.assigneeOptions : []);
      setAssigneeDraft(json.item.assignedToUserId ?? "");
      setCapabilities({
        canEditContent: Boolean(json.capabilities?.canEditContent),
        canAssign: Boolean(json.capabilities?.canAssign),
        canMoveStatus: canEditStatus === true || Boolean(json.capabilities?.canMoveStatus),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar chamado";
      setError(message);
    } finally {
      setLoadingTicket(false);
    }
  }, [canEditStatus, ticket?.id]);

  const loadComments = useCallback(async () => {
    if (!ticket?.id) return;
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(ticket.id)}/comments`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { items?: TicketComment[]; error?: string };
      if (!res.ok) {
        throw new Error(json?.error || "Erro ao carregar comentarios");
      }
      setComments(sortComments(Array.isArray(json.items) ? json.items : []));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar comentarios";
      setError(message);
    } finally {
      setCommentsLoading(false);
    }
  }, [ticket?.id]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !ticket?.id) return;
    setCurrentTicket(ticket);
    setAssigneeDraft(ticket.assignedToUserId ?? "");
    setDraft(toDraft(ticket));
    setAssigneeOptions([]);
    setCommentDraft("");
    setEditingAssignee(false);
    setError(null);
    void loadTicket();
    void loadComments();
  }, [open, ticket, loadTicket, loadComments]);

  useEffect(() => {
    if (!mounted || !open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, open]);

  const title = useMemo(
    () => currentTicket?.title || currentTicket?.subject || `#${currentTicket?.id ?? "-"}`,
    [currentTicket],
  );
  const description = useMemo(
    () => currentTicket?.description || currentTicket?.body || "Sem descricao.",
    [currentTicket],
  );
  const canEditContent = capabilities.canEditContent;
  const canMoveStatus = capabilities.canMoveStatus;
  const canEditTicket = canEditContent || canMoveStatus;
  const commentLength = commentDraft.length;
  const hasAssigneeSaved = Boolean(currentTicket?.assignedToUserId);
  const assigneeChanged = assigneeDraft !== (currentTicket?.assignedToUserId ?? "");
  const canSaveAssignee = Boolean(assigneeDraft) && assigneeChanged && !savingAssignee;
  const draftChanged = useMemo(() => {
    if (!currentTicket) return false;
    return (
      draft.title !== (currentTicket.title || currentTicket.subject || "") ||
      draft.description !== (currentTicket.description || currentTicket.body || "") ||
      draft.type !== (currentTicket.type ?? "tarefa") ||
      draft.priority !== (currentTicket.priority ?? "medium") ||
      draft.status !== (currentTicket.status ?? "backlog")
    );
  }, [currentTicket, draft]);

  async function handleSaveDraft() {
    if (!ticket?.id || !currentTicket) return;
    setSavingDraft(true);
    setError(null);
    try {
      let nextTicket: TicketShape = currentTicket;

      if (canEditContent) {
        const res = await fetch(`/api/tickets/${encodeURIComponent(ticket.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: draft.title,
            description: draft.description,
            type: draft.type,
            priority: draft.priority,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { item?: TicketShape; error?: string };
        if (!res.ok || !json.item) {
          throw new Error(json?.error || "Erro ao salvar chamado");
        }
        nextTicket = json.item;
      }

      if (canMoveStatus && draft.status !== (nextTicket.status ?? "backlog")) {
        const res = await fetch(`/api/tickets/${encodeURIComponent(ticket.id)}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: draft.status }),
        });
        const json = (await res.json().catch(() => ({}))) as { item?: TicketShape; error?: string };
        if (!res.ok || !json.item) {
          throw new Error(json?.error || "Erro ao atualizar status");
        }
        nextTicket = json.item;
      }

      setCurrentTicket(nextTicket);
      setDraft(toDraft(nextTicket));
      onTicketUpdated?.(nextTicket);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar chamado";
      setError(message);
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSaveAssignee() {
    if (!ticket?.id) return;
    setSavingAssignee(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(ticket.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assignedToUserId: assigneeDraft || null }),
      });
      const json = (await res.json().catch(() => ({}))) as { item?: TicketShape; error?: string };
      if (!res.ok || !json.item) {
        throw new Error(json?.error || "Erro ao salvar responsavel");
      }
      setCurrentTicket(json.item);
      setAssigneeDraft(json.item.assignedToUserId ?? "");
      setEditingAssignee(false);
      onTicketUpdated?.(json.item);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar responsavel";
      setError(message);
    } finally {
      setSavingAssignee(false);
    }
  }

  async function handleSendComment() {
    if (!ticket?.id || !commentDraft.trim()) return;
    setSendingComment(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(ticket.id)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: commentDraft }),
      });
      const json = (await res.json().catch(() => ({}))) as { item?: TicketComment; error?: string };
      if (!res.ok || !json.item) {
        throw new Error(json?.error || "Erro ao enviar comentario");
      }
      setComments((current) => sortComments([...current, json.item as TicketComment]));
      setCommentDraft("");
      await loadTicket();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar comentario";
      setError(message);
    } finally {
      setSendingComment(false);
    }
  }

  if (!open || !ticket || !mounted) return null;

  return createPortal(
    <div
      className="ticket-detail-modal-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 12000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.5rem",
      }}
    >
      <div
        className="ticket-detail-modal-shell"
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          position: "relative",
          display: "flex",
          width: "min(100%, 86rem)",
          maxHeight: "calc(100vh - 0.5rem)",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div className="ticket-detail-modal-header">
          <div className="ticket-detail-modal-heading">
            <div className="ticket-detail-modal-icon">
              <FiMessageSquare size={20} />
            </div>
            <div className="min-w-0">
              <p className="tc-panel-kicker">Atendimento</p>
              <h2 className="tc-panel-title">Chamado em acompanhamento</h2>
              <p className="tc-panel-description">
              Dados do chamado fixos na esquerda e conversa ativa com o suporte na direita.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ticket-detail-modal-close"
            aria-label="Fechar detalhes do chamado"
            title="Fechar"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="ticket-detail-modal-grid">
          <section className="ticket-detail-panel ticket-detail-panel-primary">
            <div className="ticket-detail-stack">
              <div className="ticket-detail-requester-shell">
                <div className="ticket-detail-requester-avatar" aria-hidden="true">
                  {currentTicket?.createdByAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentTicket.createdByAvatarUrl} alt="" className="ticket-detail-requester-avatar-image" />
                  ) : (
                    <span>{getLabelInitials(getAuthorLabel(currentTicket))}</span>
                  )}
                </div>
                <div className="ticket-detail-requester-main">
                  <p className="ticket-detail-requester-name">{getAuthorLabel(currentTicket)}</p>
                  <div className="ticket-detail-requester-meta">
                    {currentTicket?.createdByLogin ? (
                      <span>@{currentTicket.createdByLogin.replace(/^@+/, "")}</span>
                    ) : null}
                    {currentTicket?.companySlug ? <span>{currentTicket.companySlug}</span> : null}
                  </div>
                </div>
              </div>

              <div className="ticket-detail-edit-panel ticket-detail-edit-panel-flat">
                {canEditContent ? (
                  <>
                    <div className="ticket-detail-field-shell">
                      <p className="tc-kv-label">Titulo</p>
                      <input
                        value={draft.title}
                        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                        className="ticket-detail-input"
                        placeholder="Titulo do chamado"
                      />
                    </div>

                    <div className="ticket-detail-edit-grid">
                      <div className="ticket-detail-field-shell">
                        <p className="tc-kv-label">Tipo</p>
                        <select
                          value={draft.type}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, type: event.target.value as TicketType }))
                          }
                          className="ticket-detail-select"
                          data-kind="type"
                          data-value={draft.type}
                          data-tone={getTypeTone(draft.type)}
                        >
                          {TICKET_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="ticket-detail-field-shell">
                        <p className="tc-kv-label">Prioridade</p>
                        <select
                          value={draft.priority}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, priority: event.target.value as TicketPriority }))
                          }
                          className="ticket-detail-select"
                          data-kind="priority"
                          data-value={draft.priority}
                          data-tone={getPriorityTone(draft.priority)}
                        >
                          {TICKET_PRIORITY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {canMoveStatus ? (
                        <div className="ticket-detail-field-shell">
                          <p className="tc-kv-label">Status</p>
                          <select
                            value={draft.status}
                            onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
                            className="ticket-detail-select"
                            data-kind="status"
                            data-value={draft.status}
                            data-tone={getStatusTone(draft.status)}
                          >
                            {statusOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>

                    <div className="ticket-detail-field-shell">
                      <p className="tc-kv-label">Descricao</p>
                      <textarea
                        value={draft.description}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, description: event.target.value }))
                        }
                        rows={4}
                        className="ticket-detail-textarea"
                        placeholder="Descreva o chamado"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="ticket-detail-field-shell ticket-detail-field-shell-readonly ticket-detail-field-inline">
                      <p className="tc-kv-label">Titulo</p>
                      <p className="ticket-detail-main-title">{title}</p>
                    </div>
                    <div className="ticket-detail-field-shell ticket-detail-field-shell-readonly ticket-detail-field-inline">
                      <p className="tc-kv-label">Descricao</p>
                      <div className="ticket-detail-copy-card whitespace-pre-wrap">
                        {description}
                      </div>
                    </div>
                  </>
                )}

                <div className="ticket-detail-inline-meta">
                  <span><strong>Chamado:</strong> {getTicketCode(currentTicket)}</span>
                  <span><strong>Criado em:</strong> {formatDateTime(currentTicket?.createdAt)}</span>
                  <span><strong>Atualizado:</strong> {formatDateTime(currentTicket?.updatedAt)}</span>
                  {loadingTicket ? <span>Atualizando dados...</span> : null}
                </div>

                {canEditTicket ? (
                  <div className="ticket-detail-form-actions">
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={savingDraft || !draftChanged}
                      className="ticket-detail-primary-btn"
                    >
                      <FiSave size={14} />
                      {savingDraft ? "Salvando..." : "Salvar alteracoes"}
                    </button>
                  </div>
                ) : null}
              </div>

              {assigneeOptions.length > 0 ? (
                <div className="ticket-detail-assign-panel ticket-detail-section-shell">
                  {!editingAssignee && hasAssigneeSaved ? (
                    <div className="ticket-detail-assignee-readonly">
                      <div className="ticket-detail-assignee-copy">
                        <p className="tc-kv-label">Responsavel</p>
                        <p className="ticket-detail-assignee-name">{getAssigneeLabel(currentTicket)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingAssignee(true)}
                        className="ticket-detail-icon-btn"
                        aria-label="Editar responsavel"
                        title="Editar responsavel"
                      >
                        <FiEdit2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="ticket-detail-assign-grid">
                      <div className="flex-1">
                        <p className="tc-kv-label">Selecionar responsavel</p>
                        <select
                          value={assigneeDraft}
                          onChange={(event) => setAssigneeDraft(event.target.value)}
                          className="ticket-detail-select"
                          aria-label="Selecionar responsavel pelo chamado"
                          title="Selecionar responsavel pelo chamado"
                        >
                          <option value="">Selecione um responsavel</option>
                          {assigneeOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                              {option.email ? ` - ${option.email}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveAssignee}
                        disabled={!canSaveAssignee}
                        className="ticket-detail-primary-btn"
                      >
                        {savingAssignee ? "Salvando..." : "Salvar responsavel"}
                      </button>
                    </div>
                  )}
                  <p className="ticket-detail-note">
                    O chamado so pode ser movido no kanban depois que o responsavel estiver salvo.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="ticket-detail-panel ticket-detail-panel-secondary">
            <div className="ticket-detail-chat-header">
              <div className="ticket-detail-chat-icon">
                <FiMessageSquare size={18} />
              </div>
              <div>
                <p className="ticket-detail-chat-title">Comentarios do chamado</p>
                <p className="ticket-detail-chat-description">
                  Perfis globais acompanham e respondem todos. Perfis de empresa respondem apenas os proprios chamados.
                </p>
              </div>
            </div>

            <div className="ticket-detail-comments">
            <div className="comments-chat">
              <div
                className={`comments-chat-list${!commentsLoading && comments.length === 0 ? " comments-chat-list-empty" : ""}`}
                aria-live="polite"
              >
                {commentsLoading ? (
                  <p className="comments-chat-empty">Carregando conversa...</p>
                ) : comments.length === 0 ? (
                  <p className="comments-chat-empty">Nenhum comentario ainda.</p>
                ) : (
                  comments.map((entry) => {
                    const mine = entry.authorUserId === user?.id;
                    const handle = getCommentHandle(entry);
                    return (
                      <div key={entry.id} className={`comments-chat-message ${mine ? "mine" : "other"}`}>
                        <div className="comments-chat-author-row">
                          <div className="comments-chat-avatar" aria-hidden="true">
                            {entry.authorAvatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={entry.authorAvatarUrl} alt="" className="comments-chat-avatar-image" />
                            ) : (
                              <span>{getCommentInitials(entry, mine)}</span>
                            )}
                          </div>
                          <div className="comments-chat-author-stack">
                            <div className="comments-chat-author">
                              {entry.authorName || (mine ? "Voce" : "Atendimento")}
                            </div>
                            {handle ? (
                              <div className="comments-chat-handle">
                                @{handle.replace(/^@+/, "")}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="comments-chat-bubble whitespace-pre-wrap">{entry.body}</div>
                        <div className="comments-chat-meta">{formatDateTime(entry.createdAt)}</div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="comments-chat-input">
                <textarea
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  className="ticket-detail-textarea"
                  rows={4}
                  maxLength={COMMENT_MAX_LENGTH}
                  placeholder="Escreva uma resposta ou atualizacao para este chamado"
                />
                <div className="comments-chat-actions">
                  <div className="comments-chat-status">
                    {error ? <span className="ticket-detail-chat-error">{error}</span> : <span className="ticket-detail-chat-note">Os comentarios ficam visiveis para quem tem acesso a este chamado.</span>}
                    <span className="ticket-detail-chat-counter" data-limit={commentLength >= COMMENT_MAX_LENGTH ? "max" : commentLength >= COMMENT_MAX_LENGTH * 0.9 ? "warning" : "ok"}>
                      {commentLength}/{COMMENT_MAX_LENGTH} caracteres
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendComment}
                    disabled={sendingComment || !commentDraft.trim()}
                    className="ticket-detail-primary-btn"
                  >
                    <FiSend size={15} />
                    {sendingComment ? "Enviando..." : "Responder"}
                  </button>
                </div>
              </div>
            </div>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
