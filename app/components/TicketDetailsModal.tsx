"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FiEdit2, FiMessageSquare, FiPaperclip, FiSave, FiSend, FiX } from "react-icons/fi";
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

type TicketEvidenceLink = {
  raw: string;
  label: string;
  href: string;
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

function getStatusLabel(status?: string | null, options: TicketStatusOption[] = TICKET_STATUS_OPTIONS) {
  if (!status) return "-";
  return options.find((option) => option.value === status)?.label ?? status;
}

function getTypeLabel(type?: TicketType | null) {
  if (!type) return "-";
  return TICKET_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

function getPriorityLabel(priority?: TicketPriority | null) {
  if (!priority) return "-";
  return TICKET_PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? priority;
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
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)/g;

function getPriorityTone(priority?: TicketPriority | null) {
  if (priority === "high") return "danger";
  if (priority === "medium") return "warning";
  if (priority === "low") return "positive";
  return "neutral";
}

function toDraft(ticket: TicketShape | null): TicketDraft {
  const parsedDescription = parseTicketDescription(ticket?.description || ticket?.body || "");
  return {
    title: ticket?.title || ticket?.subject || "",
    description: parsedDescription.text,
    type: ticket?.type ?? "tarefa",
    priority: ticket?.priority ?? "medium",
    status: ticket?.status ?? "backlog",
  };
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-120);
}

function buildEvidenceMarkdown(name: string, url: string) {
  return `[Evidencia: ${name}](${url})`;
}

function isEvidenceLabel(label: string) {
  return /^evid[eê]ncia:/i.test(label.trim());
}

function getEvidenceDisplayLabel(label: string) {
  return label.replace(/^evid[eê]ncia:\s*/i, "").trim() || label.trim();
}

function parseTicketDescription(body?: string | null): { text: string; evidence: TicketEvidenceLink[] } {
  const source = body ?? "";
  if (!source.trim()) {
    return { text: "", evidence: [] };
  }

  const evidence: TicketEvidenceLink[] = [];
  const text = source
    .replace(MARKDOWN_LINK_PATTERN, (raw, label, href) => {
      if (!isEvidenceLabel(label)) return raw;
      evidence.push({ raw, label, href });
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, evidence };
}

function renderCommentBody(body: string) {
  const lines = body.split("\n");
  return lines.map((line, lineIndex) => {
    const matches = Array.from(line.matchAll(MARKDOWN_LINK_PATTERN));
    if (matches.length === 0) {
      return (
        <Fragment key={`line-${lineIndex}`}>
          {line}
          {lineIndex < lines.length - 1 ? <br /> : null}
        </Fragment>
      );
    }

    const parts: ReactNode[] = [];
    let cursor = 0;
    matches.forEach((match, matchIndex) => {
      const [raw, label, href] = match;
      const start = match.index ?? 0;
      if (start > cursor) {
        parts.push(
          <span key={`text-${lineIndex}-${matchIndex}`}>{line.slice(cursor, start)}</span>,
        );
      }
      parts.push(
        <a
          key={`link-${lineIndex}-${matchIndex}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="ticket-detail-evidence-link"
        >
          {label}
        </a>,
      );
      cursor = start + raw.length;
    });
    if (cursor < line.length) {
      parts.push(<span key={`tail-${lineIndex}`}>{line.slice(cursor)}</span>);
    }

    return (
      <Fragment key={`line-${lineIndex}`}>
        {parts}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </Fragment>
    );
  });
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
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [editEvidenceFile, setEditEvidenceFile] = useState<File | null>(null);
  const [draftEvidence, setDraftEvidence] = useState<TicketEvidenceLink[]>([]);
  const [sendingComment, setSendingComment] = useState(false);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const evidenceInputRef = useRef<HTMLInputElement | null>(null);
  const editEvidenceInputRef = useRef<HTMLInputElement | null>(null);

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
        throw new Error(json?.error || "Erro ao carregar ticket");
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
      const message = err instanceof Error ? err.message : "Erro ao carregar ticket";
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
    setEvidenceFile(null);
    setEditEvidenceFile(null);
    if (evidenceInputRef.current) evidenceInputRef.current.value = "";
    if (editEvidenceInputRef.current) editEvidenceInputRef.current.value = "";
    setEditingAssignee(false);
    setError(null);
    void loadTicket();
    void loadComments();
  }, [open, ticket, loadTicket, loadComments]);

  useEffect(() => {
    setDraftEvidence(parseTicketDescription(currentTicket?.description || currentTicket?.body || "").evidence);
  }, [currentTicket?.description, currentTicket?.body]);

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
  const parsedDescription = useMemo(
    () => parseTicketDescription(currentTicket?.description || currentTicket?.body || ""),
    [currentTicket?.description, currentTicket?.body],
  );
  const description = useMemo(
    () => parsedDescription.text || "Sem descricao.",
    [parsedDescription.text],
  );
  const canEditContent = capabilities.canEditContent;
  const canMoveStatus = capabilities.canMoveStatus;
  const canEditTicket = canEditContent || canMoveStatus;
  const hasVisibleComments = !commentsLoading && comments.length > 0;
  const canSendComment = Boolean(commentDraft.trim() || evidenceFile) && !sendingComment;
  const canSaveEditEvidence = Boolean(editEvidenceFile) && !savingDraft;
  const hasAssigneeSaved = Boolean(currentTicket?.assignedToUserId);
  const assigneeChanged = assigneeDraft !== (currentTicket?.assignedToUserId ?? "");
  const canSaveAssignee = Boolean(assigneeDraft) && assigneeChanged && !savingAssignee;
  const evidenceChanged = useMemo(() => {
    const currentEvidence = parsedDescription.evidence.map((item) => item.raw).join("|");
    const nextEvidence = draftEvidence.map((item) => item.raw).join("|");
    return currentEvidence !== nextEvidence;
  }, [draftEvidence, parsedDescription.evidence]);
  const draftChanged = useMemo(() => {
    if (!currentTicket) return false;
    return (
      draft.title !== (currentTicket.title || currentTicket.subject || "") ||
      draft.description !== parsedDescription.text ||
      evidenceChanged ||
      Boolean(editEvidenceFile) ||
      draft.type !== (currentTicket.type ?? "tarefa") ||
      draft.priority !== (currentTicket.priority ?? "medium") ||
      draft.status !== (currentTicket.status ?? "backlog")
    );
  }, [currentTicket, draft, editEvidenceFile, evidenceChanged, parsedDescription.text]);
  const summaryStatusLabel = useMemo(
    () => getStatusLabel(currentTicket?.status, statusOptions),
    [currentTicket?.status, statusOptions],
  );
  const summaryTypeLabel = useMemo(() => getTypeLabel(currentTicket?.type), [currentTicket?.type]);
  const summaryPriorityLabel = useMemo(
    () => getPriorityLabel(currentTicket?.priority),
    [currentTicket?.priority],
  );

  async function handleSaveDraft() {
    if (!ticket?.id || !currentTicket) return;
    setSavingDraft(true);
    setError(null);
    try {
      let nextTicket: TicketShape = currentTicket;

      if (canEditContent) {
        const editEvidence = editEvidenceFile ? await uploadEvidence(editEvidenceFile) : null;
        const descriptionPayload = [
          draft.description.trim(),
          ...draftEvidence.map((item) => item.raw),
          editEvidence ? buildEvidenceMarkdown(editEvidence.name, editEvidence.url) : "",
        ]
          .filter(Boolean)
          .join("\n\n");

        const res = await fetch(`/api/tickets/${encodeURIComponent(ticket.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: draft.title,
            description: descriptionPayload,
            type: draft.type,
            priority: draft.priority,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { item?: TicketShape; error?: string };
        if (!res.ok || !json.item) {
          throw new Error(json?.error || "Erro ao salvar ticket");
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
      setEditEvidenceFile(null);
      if (editEvidenceInputRef.current) editEvidenceInputRef.current.value = "";
      onTicketUpdated?.(nextTicket);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar ticket";
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

  async function uploadEvidence(file: File) {
    if (!ticket?.id) throw new Error("Ticket invalido");
    const safeName = sanitizeFileName(file.name || `evidencia-${Date.now()}`);
    const key = `tickets/evidencias/${ticket.id}/${Date.now()}-${safeName}`;
    const form = new FormData();
    form.set("file", file);
    form.set("key", key);

    const res = await fetch("/api/s3/upload", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; key?: string; error?: string };
    if (!res.ok || !json.ok || !json.key) {
      throw new Error(json.error || "Erro ao anexar evidencia");
    }
    return {
      name: file.name,
      url: `/api/s3/object?key=${encodeURIComponent(json.key)}`,
    };
  }

  async function handleSendComment() {
    if (!ticket?.id || !commentDraft.trim() && !evidenceFile) return;
    setSendingComment(true);
    setError(null);
    try {
      const evidence = evidenceFile ? await uploadEvidence(evidenceFile) : null;
      const body = [
        commentDraft.trim(),
        evidence ? buildEvidenceMarkdown(evidence.name, evidence.url) : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const res = await fetch(`/api/tickets/${encodeURIComponent(ticket.id)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body }),
      });
      const json = (await res.json().catch(() => ({}))) as { item?: TicketComment; error?: string };
      if (!res.ok || !json.item) {
        throw new Error(json?.error || "Erro ao enviar comentario");
      }
      setComments((current) => sortComments([...current, json.item as TicketComment]));
      setCommentDraft("");
      setEvidenceFile(null);
      if (evidenceInputRef.current) evidenceInputRef.current.value = "";
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
    >
      <div
        className="ticket-detail-modal-shell"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ticket-detail-modal-header">
          <div className="ticket-detail-modal-heading">
            <div className="ticket-detail-modal-icon">
              <FiMessageSquare size={20} />
            </div>
            <div className="min-w-0">
              <p className="tc-panel-kicker">Atendimento</p>
              <h2 className="tc-panel-title">Ticket em acompanhamento</h2>
              <p className="tc-panel-description">
              Dados do ticket na esquerda e conversa ativa com o suporte na direita. Quem abriu o chamado pode corrigir o proprio ticket e anexar evidencia ao responder.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ticket-detail-modal-close"
            aria-label="Fechar detalhes do ticket"
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

              <div className="ticket-detail-summary-bar" aria-label="Resumo do ticket">
                <div className="ticket-detail-summary-grid">
                  <div className="ticket-detail-summary-item">
                    <p className="ticket-detail-summary-label">Ticket</p>
                    <p className="ticket-detail-summary-value">{getTicketCode(currentTicket)}</p>
                  </div>
                  <div className="ticket-detail-summary-item">
                    <p className="ticket-detail-summary-label">Status</p>
                    <span className="ticket-detail-badge" data-tone={getStatusTone(currentTicket?.status)}>
                      {summaryStatusLabel}
                    </span>
                  </div>
                  <div className="ticket-detail-summary-item">
                    <p className="ticket-detail-summary-label">Tipo</p>
                    <span className="ticket-detail-badge" data-tone={getTypeTone(currentTicket?.type)}>
                      {summaryTypeLabel}
                    </span>
                  </div>
                  <div className="ticket-detail-summary-item">
                    <p className="ticket-detail-summary-label">Prioridade</p>
                    <span className="ticket-detail-badge" data-tone={getPriorityTone(currentTicket?.priority)}>
                      {summaryPriorityLabel}
                    </span>
                  </div>
                  <div className="ticket-detail-summary-item">
                    <p className="ticket-detail-summary-label">Criado em</p>
                    <p className="ticket-detail-summary-value">{formatDateTime(currentTicket?.createdAt)}</p>
                  </div>
                  <div className="ticket-detail-summary-item">
                    <p className="ticket-detail-summary-label">Atualizado</p>
                    <p className="ticket-detail-summary-value">{formatDateTime(currentTicket?.updatedAt)}</p>
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
                        placeholder="Titulo do ticket"
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
                          aria-label="Tipo"
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
                          aria-label="Prioridade"
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
                            aria-label="Status"
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
                      <input
                        ref={editEvidenceInputRef}
                        type="file"
                        className="sr-only"
                        accept="image/*,.pdf,.txt,.log,.json,.zip,.csv,.xlsx,.doc,.docx"
                        onChange={(event) => setEditEvidenceFile(event.target.files?.[0] ?? null)}
                      />
                      <textarea
                        value={draft.description}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, description: event.target.value }))
                        }
                        rows={4}
                        className="ticket-detail-textarea"
                        placeholder="Descreva o ticket"
                      />
                      {draftEvidence.length > 0 || editEvidenceFile ? (
                        <div className="ticket-detail-evidence-bar">
                          {draftEvidence.map((item) => (
                            <div key={item.href} className="ticket-detail-evidence-chip">
                              <a
                                href={item.href}
                                target="_blank"
                                rel="noreferrer"
                                className="ticket-detail-evidence-chip-link"
                                title={item.label}
                              >
                                <FiPaperclip size={12} />
                                <span className="ticket-detail-evidence-name">
                                  {getEvidenceDisplayLabel(item.label)}
                                </span>
                              </a>
                              <button
                                type="button"
                                className="ticket-detail-evidence-remove"
                                onClick={() => setDraftEvidence((current) => current.filter((entry) => entry.href !== item.href))}
                                aria-label={`Remover evidencia ${getEvidenceDisplayLabel(item.label)}`}
                                title="Remover evidencia"
                              >
                                <FiX size={12} />
                              </button>
                            </div>
                          ))}
                          {editEvidenceFile ? (
                            <div className="ticket-detail-evidence-chip">
                              <span className="ticket-detail-evidence-name" title={editEvidenceFile.name}>
                                {editEvidenceFile.name}
                              </span>
                              <button
                                type="button"
                                className="ticket-detail-evidence-remove"
                                onClick={() => {
                                  setEditEvidenceFile(null);
                                  if (editEvidenceInputRef.current) editEvidenceInputRef.current.value = "";
                                }}
                                aria-label="Remover evidencia do ticket"
                                title="Remover evidencia do ticket"
                              >
                                <FiX size={12} />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
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
                      {parsedDescription.evidence.length > 0 ? (
                        <div className="ticket-detail-evidence-bar">
                          {parsedDescription.evidence.map((item) => (
                            <a
                              key={item.href}
                              href={item.href}
                              target="_blank"
                              rel="noreferrer"
                              className="ticket-detail-evidence-link"
                              title={item.label}
                            >
                              <FiPaperclip size={12} />
                              {getEvidenceDisplayLabel(item.label)}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </>
                )}

                <div className="ticket-detail-inline-meta">
                  <span><strong>Solicitante:</strong> {getAuthorLabel(currentTicket)}</span>
                  <span><strong>Responsavel:</strong> {getAssigneeLabel(currentTicket)}</span>
                  {loadingTicket ? <span>Atualizando dados...</span> : null}
                </div>

                {canEditTicket ? (
                  <div className="ticket-detail-form-actions">
                    {canEditContent ? (
                      <button
                        type="button"
                        className="ticket-detail-secondary-btn ticket-detail-secondary-btn-icon"
                        onClick={() => editEvidenceInputRef.current?.click()}
                        aria-label={editEvidenceFile ? "Trocar evidencia do ticket" : "Anexar evidencia ao ticket"}
                        title={editEvidenceFile ? "Trocar evidencia do ticket" : "Anexar evidencia ao ticket"}
                      >
                        <FiPaperclip size={14} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={(savingDraft && !canSaveEditEvidence) || !draftChanged}
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
                          aria-label="Selecionar responsavel pelo ticket"
                          title="Selecionar responsavel pelo ticket"
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
                    O ticket so pode ser movido no kanban depois que o responsavel estiver salvo.
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
                <p className="ticket-detail-chat-title">Comentarios do ticket</p>
                <p className="ticket-detail-chat-description">
                  O time de suporte acompanha todos. Os demais perfis acompanham, comentam e podem anexar evidencia apenas nos proprios tickets.
                </p>
              </div>
            </div>

            <div className="ticket-detail-comments">
            <div className={`comments-chat${hasVisibleComments ? "" : " comments-chat-compact"}`}>
              <div
                className={`comments-chat-list${commentsLoading || comments.length === 0 ? " comments-chat-list-empty" : ""}`}
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
                        <div className="comments-chat-bubble whitespace-pre-wrap">{renderCommentBody(entry.body)}</div>
                        <div className="comments-chat-meta">{formatDateTime(entry.createdAt)}</div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="comments-chat-input">
                <input
                  ref={evidenceInputRef}
                  type="file"
                  className="sr-only"
                  accept="image/*,.pdf,.txt,.log,.json,.zip,.csv,.xlsx,.doc,.docx"
                  onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)}
                />
                <textarea
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  className="ticket-detail-textarea"
                  rows={4}
                  maxLength={COMMENT_MAX_LENGTH}
                  placeholder="Escreva uma resposta ou atualizacao para este ticket"
                />
                <div className="ticket-detail-evidence-bar">
                  <button
                    type="button"
                    className="ticket-detail-secondary-btn ticket-detail-secondary-btn-icon"
                    onClick={() => evidenceInputRef.current?.click()}
                    aria-label={evidenceFile ? "Trocar evidencia" : "Anexar evidencia"}
                    title={evidenceFile ? "Trocar evidencia" : "Anexar evidencia"}
                  >
                    <FiPaperclip size={14} />
                  </button>
                  {evidenceFile ? (
                    <div className="ticket-detail-evidence-chip">
                      <span className="ticket-detail-evidence-name" title={evidenceFile.name}>
                        {evidenceFile.name}
                      </span>
                      <button
                        type="button"
                        className="ticket-detail-evidence-remove"
                        onClick={() => {
                          setEvidenceFile(null);
                          if (evidenceInputRef.current) evidenceInputRef.current.value = "";
                        }}
                        aria-label="Remover evidencia selecionada"
                        title="Remover evidencia"
                        >
                          <FiX size={12} />
                        </button>
                      </div>
                  ) : null}
                </div>
                <div className="comments-chat-actions">
                  {error ? <span className="ticket-detail-chat-error">{error}</span> : null}
                  <button
                    type="button"
                    onClick={handleSendComment}
                    disabled={!canSendComment}
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


