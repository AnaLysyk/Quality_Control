"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiMessageSquare, FiPlus, FiEdit2, FiTrash2, FiX, FiSave, FiSearch } from "react-icons/fi";
import ticketsStyles from "./TicketsButton.module.css";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import TicketDetailsModal from "@/components/TicketDetailsModal";
import {
  canAccessGlobalSupportScope,
  canCreateSupportTickets,
  canManageSupportWorkflow,
  canViewSupportBoard,
} from "@/lib/supportAccess";
import { getTicketStatusLabel, TICKET_STATUS_OPTIONS, type TicketStatus } from "@/lib/ticketsStatus";
import type { TicketType, TicketPriority } from "@/lib/ticketsStore";

type TicketItem = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  type?: TicketType | null;
  priority?: TicketPriority | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  companySlug?: string | null;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
};

type DraftTicket = {
  title: string;
  description: string;
  type: TicketType;
  priority: TicketPriority;
};

const TICKET_TYPE_OPTIONS: { value: TicketType; label: string }[] = [
  { value: "tarefa", label: "Tarefa" },
  { value: "bug", label: "Bug" },
  { value: "melhoria", label: "Melhoria" },
];

const TICKET_PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];

type TicketFilterStatus = "all" | "open" | TicketStatus;
type TicketFilterPriority = "all" | TicketPriority;

type TicketsButtonProps = {
  defaultOpen?: boolean;
};

function statusTone(status: TicketStatus) {
  if (status === "done") return "positive";
  if (status === "review") return "progress";
  if (status === "doing") return "warning";
  return "neutral";
}

function priorityTone(priority?: TicketPriority | null) {
  if (priority === "high") return "danger";
  if (priority === "medium") return "warning";
  if (priority === "low") return "positive";
  return "neutral";
}

function getPriorityLabel(priority?: TicketPriority | null) {
  return TICKET_PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? "Média";
}

export default function TicketsButton({ defaultOpen = false }: TicketsButtonProps) {
  const { user } = usePermissionAccess();
  const [open, setOpen] = useState(defaultOpen);
  const [items, setItems] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [draft, setDraft] = useState<DraftTicket | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TicketFilterStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<TicketFilterPriority>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const createCardRef = useRef<HTMLDivElement>(null);
  const createTitleInputRef = useRef<HTMLInputElement>(null);
  const canOpenSupport = canViewSupportBoard(user);
  const canCreateSupport = canCreateSupportTickets(user);
  const canManageAll = canAccessGlobalSupportScope(user);
  const canManageWorkflow = canManageSupportWorkflow(user);

  const isCreating = editingId === "new";

  const syncPanelAnchor = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect || !panelRef.current) return;

    panelRef.current.style.top = `${rect.bottom + 10}px`;
    panelRef.current.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
  }, []);

  useEffect(() => {
    if (!open) return undefined;

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
  }, [open]);

  const loadTickets = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const scope = canManageAll ? "all" : "mine";
      const res = await fetch(`/api/tickets?scope=${scope}`, { credentials: "include", cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { items?: TicketItem[]; error?: string };
      if (!res.ok) {
        setItems([]);
        setError(json?.error || "Erro ao carregar tickets");
        return;
      }
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar tickets";
      setItems([]);
      setError(msg);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [user, canManageAll]);

  useEffect(() => {
    if (open) {
      syncPanelAnchor();
      loadTickets();
    }
  }, [open, loadTickets, syncPanelAnchor]);

  useEffect(() => {
    if (!open) return;

    const interval = window.setInterval(() => {
      void loadTickets({ silent: true });
    }, 8000);

    function handleFocusRefresh() {
      void loadTickets({ silent: true });
    }

    function handleVisibilityRefresh() {
      if (document.visibilityState === "visible") {
        void loadTickets({ silent: true });
      }
    }

    window.addEventListener("focus", handleFocusRefresh);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocusRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, [open, loadTickets]);

  useEffect(() => {
    if (!open) return;

    function handleViewportChange() {
      syncPanelAnchor();
    }

    window.addEventListener("resize", handleViewportChange);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [open, syncPanelAnchor]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 3500);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    if (!open || !isCreating) return;
    const frame = window.requestAnimationFrame(() => {
      createCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const focusFrame = window.requestAnimationFrame(() => {
        createTitleInputRef.current?.focus();
        createTitleInputRef.current?.select();
      });
      return () => window.cancelAnimationFrame(focusFrame);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isCreating, open]);

  const totalLabel = useMemo(() => {
    if (!items.length) return "Nenhum ticket no total";
    if (items.length === 1) return "1 ticket no total";
    return `${items.length} tickets no total`;
  }, [items.length]);

  const statusFilterTone = useMemo(() => {
    if (statusFilter === "all") return "neutral";
    if (statusFilter === "open") return "warning";
    return statusTone(statusFilter);
  }, [statusFilter]);

  const priorityFilterTone = useMemo(() => {
    if (priorityFilter === "all") return "neutral";
    return priorityTone(priorityFilter);
  }, [priorityFilter]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return items.filter((ticket) => {
      const statusMatches =
        statusFilter === "all"
          ? true
          : statusFilter === "open"
            ? ticket.status !== "done"
            : ticket.status === statusFilter;

      const priorityMatches = priorityFilter === "all" ? true : ticket.priority === priorityFilter;

      if (!statusMatches || !priorityMatches) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        ticket.title,
        ticket.description,
        ticket.createdByName,
        ticket.createdByEmail,
        ticket.createdBy,
        getTicketStatusLabel(ticket.status),
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return haystack.includes(normalizedSearch);
    });
  }, [items, priorityFilter, searchTerm, statusFilter]);

  function startCreate() {
    setMessage(null);
    setError(null);
    setEditingId("new");
    setExpandedId(null);
    setDraft({ title: "", description: "", type: "tarefa", priority: "medium" });
  }

  function startEdit(ticket: TicketItem) {
    setMessage(null);
    setError(null);
    setEditingId(ticket.id);
    setExpandedId(ticket.id);
    setDraft({ title: ticket.title, description: ticket.description, type: ticket.type ?? "tarefa", priority: ticket.priority ?? "medium" });
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
        // Basic client-side validation to avoid empty posts
        const title = String(draft.title ?? "").trim();
        const description = String(draft.description ?? "").trim();
        if (!title && !description) {
          setError("Informe título ou descrição");
          return;
        }
        const res = await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(draft),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json?.error || "Erro ao criar ticket");
          return;
        }
        setMessage("Ticket criado com sucesso.");
      } else if (editingId) {
        const res = await fetch(`/api/tickets/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(draft),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json?.error || "Erro ao atualizar ticket");
          return;
        }
        setMessage("Ticket atualizado.");
      }
      setEditingId(null);
      setDraft(null);
      await loadTickets();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar ticket";
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
        setError(json?.error || "Erro ao excluir ticket");
        return;
      }
      setMessage("Ticket excluido.");
      if (expandedId === ticketId) setExpandedId(null);
      if (editingId === ticketId) cancelEdit();
      await loadTickets();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir ticket";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!user || !canOpenSupport) return null;

  return (
    <div className="relative shrink-0" ref={boxRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir suporte"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-(--tc-border,#e5e7eb)/70 bg-(--tc-surface,#ffffff) text-(--tc-text,#0f172a) shadow-[0_8px_20px_rgba(15,23,42,0.12)] transition hover:border-(--tc-accent,#ef0001)/60 hover:text-(--tc-accent,#ef0001)"
      >
        <FiMessageSquare size={18} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className={`tickets-widget notes-widget w-[min(30rem,calc(100vw-2rem))] ${ticketsStyles.panel}`}
        >
          <div className="tickets-widget-header notes-widget-header">
            <div className="tickets-widget-header-main">
              <div className="tickets-widget-headline">
                <p className="tickets-widget-title">Suporte</p>
                <p className="tickets-widget-description">
                  Abra um ticket para reportar bugs, pedir ajuda tecnica ou enviar sugestoes de melhoria.
                </p>
                <div className="tickets-widget-toolbar">
                  <label className="tickets-widget-search-shell" htmlFor="tickets-search">
                    <FiSearch size={15} className="tickets-widget-search-icon" />
                    <input
                      id="tickets-search"
                      type="search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="tickets-widget-search-input"
                      placeholder="Buscar ticket"
                    />
                  </label>
                  {canCreateSupport ? (
                    <button
                      type="button"
                      onClick={startCreate}
                      className="notes-widget-new-btn tickets-widget-create-btn"
                    >
                      <FiPlus size={14} /> Criar
                    </button>
                  ) : null}
                </div>
                <div className="tickets-widget-status-row">
                  <div className="tickets-widget-filter-group">
                    <label htmlFor="tickets-status-filter" className="tickets-widget-filter-label">
                      Status
                    </label>
                    <select
                      id="tickets-status-filter"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as TicketFilterStatus)}
                      className="tickets-widget-filter-select"
                      data-tone={statusFilterTone}
                    >
                      <option value="all">Todos os status</option>
                      <option value="open">Tickets abertos</option>
                      {TICKET_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="tickets-widget-filter-group">
                    <label htmlFor="tickets-priority-filter" className="tickets-widget-filter-label">
                      Prioridade
                    </label>
                    <select
                      id="tickets-priority-filter"
                      value={priorityFilter}
                      onChange={(event) => setPriorityFilter(event.target.value as TicketFilterPriority)}
                      className="tickets-widget-filter-select"
                      data-tone={priorityFilterTone}
                    >
                      <option value="all">Todas as prioridades</option>
                      {TICKET_PRIORITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="tickets-widget-total">{totalLabel}</p>
              </div>
            </div>
          </div>

          <div className="tickets-widget-scroll notes-widget-scroll max-h-[70vh] px-4 py-3 space-y-3">
            {isCreating && draft && (
              <div ref={createCardRef} className="tickets-card tickets-card-editor">
                <p className="tickets-card-eyebrow">
                  Novo ticket
                </p>
                <div className="mt-3 space-y-3">
                  <input
                    ref={createTitleInputRef}
                    className="notes-input tickets-input"
                    placeholder="Título"
                    value={draft.title}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                  />
                  <div className="tickets-draft-selects">
                    <select
                      className="tickets-draft-select"
                      value={draft.type}
                      data-value={draft.type}
                      aria-label="Tipo do ticket"
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, type: e.target.value as TicketType } : prev))}
                    >
                      {TICKET_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <select
                      className="tickets-draft-select"
                      value={draft.priority}
                      data-value={draft.priority}
                      aria-label="Prioridade do ticket"
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, priority: e.target.value as TicketPriority } : prev))}
                    >
                      {TICKET_PRIORITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    rows={4}
                    className="notes-input notes-textarea tickets-textarea"
                    placeholder="Descreva o ticket..."
                    value={draft.description}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                  />
                </div>
                <div className="tickets-card-actions mt-4">
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={saving}
                    className="notes-btn-primary"
                  >
                    <FiSave size={14} /> {saving ? "Salvando" : "Salvar"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="notes-btn-ghost"
                  >
                    <FiX size={14} /> Fechar
                  </button>
                </div>
              </div>
            )}

            {loading && <p className="tickets-empty-state">Carregando...</p>}
            {!loading && items.length === 0 && (
              <p className="tickets-empty-state">Nenhum ticket criado ainda.</p>
            )}
            {!loading && items.length > 0 && filteredItems.length === 0 && (
              <p className="tickets-empty-state">Nenhum ticket encontrado com os filtros atuais.</p>
            )}

            {filteredItems.map((ticket) => {
              const isExpanded = expandedId === ticket.id;
              const isEditing = editingId === ticket.id;
              const localDraft = isEditing && draft ? draft : null;
              const canEdit = canManageWorkflow;
              const canDelete = canManageWorkflow;
              const creatorLabel = ticket.createdByName || ticket.createdByEmail || ticket.createdBy || "";
              const ticketPriorityTone = priorityTone(ticket.priority);
              const ticketPriorityLabel = getPriorityLabel(ticket.priority);

              return (
                <div
                  key={ticket.id}
                  className="tickets-card tickets-ticket"
                  data-tone={statusTone(ticket.status)}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedTicket(ticket)}
                    className="tickets-ticket-trigger"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="tickets-ticket-title">{ticket.title || "Sem título"}</p>
                      <p className="tickets-ticket-meta">
                        Atualizado em {new Date(ticket.updatedAt).toLocaleString("pt-BR")}
                      </p>
                      {user?.isGlobalAdmin && creatorLabel && (
                        <p className="tickets-ticket-meta">
                          Criado por {creatorLabel}
                          {ticket.companySlug ? ` · ${ticket.companySlug}` : ""}
                        </p>
                      )}
                    </div>
                    <span className="tickets-ticket-status" data-tone={statusTone(ticket.status)}>
                      {getTicketStatusLabel(ticket.status)}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="tickets-ticket-body mt-3 space-y-3">
                      <div className="tickets-ticket-body-head">
                        {!canEdit ? (
                          <p className="tickets-ticket-readonly">
                            Somente o time de suporte pode editar ou excluir tickets.
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={isEditing ? cancelEdit : () => setExpandedId(null)}
                          className="notes-icon-action tickets-ticket-close"
                          aria-label={isEditing ? "Fechar edição" : "Fechar ticket"}
                          title={isEditing ? "Fechar edição" : "Fechar ticket"}
                        >
                          <FiX size={15} />
                        </button>
                      </div>
                      {isEditing && localDraft ? (
                        <>
                          <input
                            className="notes-input tickets-input"
                            placeholder="Título"
                            aria-label="Editar título do ticket"
                            value={localDraft.title}
                            onChange={(e) =>
                              setDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                            }
                          />
                          <div className="tickets-draft-selects">
                            <select
                              className="tickets-draft-select"
                              value={localDraft.type}
                              data-value={localDraft.type}
                              aria-label="Tipo do ticket"
                              onChange={(e) =>
                                setDraft((prev) => (prev ? { ...prev, type: e.target.value as TicketType } : prev))
                              }
                            >
                              {TICKET_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <select
                              className="tickets-draft-select"
                              value={localDraft.priority}
                              data-value={localDraft.priority}
                              aria-label="Prioridade do ticket"
                              onChange={(e) =>
                                setDraft((prev) => (prev ? { ...prev, priority: e.target.value as TicketPriority } : prev))
                              }
                            >
                              {TICKET_PRIORITY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <textarea
                            rows={4}
                            className="notes-input notes-textarea tickets-textarea"
                            placeholder="Descreva o ticket..."
                            aria-label="Editar descrição do ticket"
                            value={localDraft.description}
                            onChange={(e) =>
                              setDraft((prev) => (prev ? { ...prev, description: e.target.value } : prev))
                            }
                          />
                          <div className="tickets-card-actions">
                            <button
                              type="button"
                              onClick={saveDraft}
                              disabled={saving}
                              className="notes-btn-primary"
                            >
                              <FiSave size={14} /> {saving ? "Salvando" : "Salvar"}
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => deleteTicket(ticket.id)}
                                className="notes-icon-action notes-icon-action-danger"
                                aria-label="Excluir ticket"
                                title="Excluir ticket"
                              >
                                <FiTrash2 size={15} />
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="tickets-ticket-signals">
                            <span className="tickets-ticket-badge" data-tone={statusTone(ticket.status)}>
                              {getTicketStatusLabel(ticket.status)}
                            </span>
                            <span className="tickets-ticket-badge" data-tone={ticketPriorityTone}>
                              {ticketPriorityLabel}
                            </span>
                          </div>
                          {ticket.assignedToName || ticket.assignedToEmail ? (
                            <p className="tickets-ticket-meta">
                              Responsável: {ticket.assignedToName || ticket.assignedToEmail}
                            </p>
                          ) : null}
                          <p className="tickets-ticket-description">
                            {ticket.description || "Sem descrição."}
                          </p>
                          <div className="tickets-card-actions">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => startEdit(ticket)}
                                className="notes-note-edit-btn"
                              >
                                <FiEdit2 size={14} /> Editar
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => deleteTicket(ticket.id)}
                                className="notes-icon-action notes-icon-action-danger"
                                aria-label="Excluir ticket"
                                title="Excluir ticket"
                              >
                                <FiTrash2 size={15} />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

          </div>

          {(error || message) && (
            <div className="tickets-toast-overlay" aria-live="polite">
              {error && (
                <p className="tickets-toast tickets-toast-error" role="alert">{error}</p>
              )}
              {message && (
                <p className="tickets-toast tickets-toast-success">{message}</p>
              )}
            </div>
          )}
        </div>
      )}

      <TicketDetailsModal
        open={Boolean(selectedTicket)}
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onTicketUpdated={(updated) => {
          setSelectedTicket(updated as TicketItem);
          setItems((current) =>
            current.map((item) => (item.id === updated.id ? { ...item, ...updated } as TicketItem : item)),
          );
        }}
      />
    </div>
  );
}
