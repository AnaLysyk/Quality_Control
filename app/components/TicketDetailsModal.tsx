  // Funções stub para evitar erros de referência
  function submitComment() {}
  function loadComments() {}
  function toggleLike(comment?: any) {}
  function startEditComment(comment?: any) {}
  function deleteComment(comment?: any) {}
  function saveEditComment(comment?: any) {}
  function cancelEditComment() {}
  function loadEvents() {}
  function loadTimeline() {}
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiInfo, FiCheckCircle } from "react-icons/fi";
type TicketInsights = {
  daysSinceLastUpdate: number;
  hasAssignee: boolean;
  commentCount: number;
  lastCommentFromClient: boolean;
  statusAge: number;
  riskLevel: "low" | "medium" | "high";
};
import { isDevRole } from "@/lib/rbac/devAccess";
import { FiHeart, FiMessageSquare, FiRefreshCw, FiX } from "react-icons/fi";
import styles from "./TicketDetailsModal.module.css";
import { useAuthUser } from "@/hooks/useAuthUser";
import { TICKET_STATUS_OPTIONS, getTicketStatusLabel, type TicketStatus } from "@/lib/ticketsStatus";


type TicketItem = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  type?: string | null;
  code?: string | null;
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
};
const PRIORITY_OPTIONS = [
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];

// Simplificado: aceita qualquer tipo para event, retorna string básica
function formatEventLabel(event: any, options?: Array<{ value: TicketStatus; label: string }>) {
  const base = event?.type || "Evento";
  if (event?.type === "STATUS_CHANGED") {
    const from = event.payload?.from ? String(event.payload.from) : "";
    const to = event.payload?.to ? String(event.payload.to) : "";
    if (from && to) {
      return `${base}: ${getTicketStatusLabel(from as TicketStatus, options)} -> ${getTicketStatusLabel(to as TicketStatus, options)}`;
    }
  }
  return base;
}

type Props = {
  open: boolean;
  ticket: TicketItem | null;
  onClose: () => void;
  canEditStatus?: boolean;
  statusOptions?: Array<{ value: TicketStatus; label: string }>;
  onTicketUpdated?: (ticket: TicketItem) => void;
};

export default function TicketDetailsModal({ open, ticket, onClose, canEditStatus, statusOptions, onTicketUpdated }: Props) {
  const { user } = useAuthUser();
  const [tab, setTab] = useState<"details" | "comments" | "history" | "timeline">("details");
  const [comments, setComments] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
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
  const [timelineItems, setTimelineItems] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [assignees, setAssignees] = useState<any[]>([]);
  const [assigneesLoading, setAssigneesLoading] = useState(false);
  const [assigneeError, setAssigneeError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsDraft, setDetailsDraft] = useState({
    title: "",
    description: "",
    priority: "medium",
    type: "tarefa",
  });
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // ticketId precisa ser declarado antes do useEffect
  const ticketId = ticket?.id ?? null;

  // Ticket Insights
  const [insights, setInsights] = useState<TicketInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  // Carrega insights ao abrir modal
  useEffect(() => {
    if (!open || !ticketId) {
      setInsights(null);
      setInsightsError(null);
      return;
    }
    setLoadingInsights(true);
    setInsightsError(null);
    fetch(`/api/chamados/${ticketId}/insights`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.insights) setInsights(data.insights);
        else setInsightsError(data?.error || "Erro ao carregar insights");
      })
      .catch(() => setInsightsError("Erro ao carregar insights"))
      .finally(() => setLoadingInsights(false));
  }, [open, ticketId]);

  const codeLabel = ticket?.code ?? null;
  const assignedLabel =
    ticket?.assignedToName ||
    ticket?.assignedToEmail ||
    (ticket?.assignedToUserId ? `UID: ${ticket.assignedToUserId}` : "Nao atribuido");
  const isDev = isDevRole(user?.role);
  const canAssign = Boolean(user && isDev);
  const canEditDetails = Boolean(user && isDev);
  const selectableStatusOptions = statusOptions ?? TICKET_STATUS_OPTIONS;

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

  // Only reset tab to details if modal is closed, not when opening
  useEffect(() => {
    if (!open) {
      setEditingCommentId(null);
      setEditingCommentBody("");
      setCommentBody("");
      setTab("details");
      setEditingDetails(false);
      setDetailsError(null);
    }
  }, [open]);

  if (!open || !ticket) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div className={styles.modalResponsive}>
        {/* Botão de fechar no topo direito, sempre visível */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar modal"
          title="Fechar"
          className={[
            "absolute right-4 top-4 z-10 flex items-center justify-center rounded-full border border-(--tc-border,#e5e7eb) bg-white/90 text-(--tc-text,#0f172a) shadow hover:bg-red-100 hover:text-red-600 transition-colors w-9 h-9 p-0",
            styles.closeButton
          ].join(" ")}
        >
          <FiX size={22} />
        </button>
        <div className={styles.modalResponsiveContent + " space-y-4 pt-8"}>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Chamado</p>
            <h2 className="text-lg font-semibold text-(--tc-text,#0f172a)">{ticket.title}</h2>
          </div>
          {/* Bloco de Ticket Insights */}
          <div className="mb-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-(--tc-text-muted,#6b7280)">Ticket Insights</h3>
            {loadingInsights && <span className="text-xs text-(--tc-text-muted,#6b7280)">Carregando insights...</span>}
            {insightsError && <span className="text-xs text-red-600">{insightsError}</span>}
            {insights && (
              <>
                <div className="flex flex-wrap gap-2 mt-2">
                  {/* Dias sem atualização */}
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${insights.daysSinceLastUpdate > 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                    <FiInfo /> {insights.daysSinceLastUpdate}d sem atualização
                  </span>
                  {/* Responsável */}
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${insights.hasAssignee ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-700'}`}>
                    {insights.hasAssignee ? <FiCheckCircle /> : <FiAlertTriangle />} {insights.hasAssignee ? 'Com responsável' : 'Sem responsável'}
                  </span>
                  {/* Comentários */}
                  <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800">
                    <FiMessageSquare size={14} /> {insights.commentCount} comentários
                  </span>
                  {/* Último comentário do cliente */}
                  {insights.lastCommentFromClient && (
                    <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-orange-100 text-orange-800">
                      <FiAlertTriangle /> Último comentário do cliente
                    </span>
                  )}
                  {/* Risco */}
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${insights.riskLevel === 'high' ? 'bg-rose-200 text-rose-800' : insights.riskLevel === 'medium' ? 'bg-yellow-200 text-yellow-900' : 'bg-green-200 text-green-900'}`}>
                    <FiAlertTriangle /> Risco: {insights.riskLevel === 'high' ? 'Alto' : insights.riskLevel === 'medium' ? 'Médio' : 'Baixo'}
                  </span>
                </div>
                {/* Sugestão contextual */}
                <div className="mt-2">
                  {insights.riskLevel === 'high' && (
                    <div className="text-xs text-rose-700 font-semibold flex items-center gap-1"><FiAlertTriangle /> Este ticket está parado ou sem responsável. Priorize!</div>
                  )}
                  {insights.riskLevel === 'medium' && (
                    <div className="text-xs text-yellow-800 font-semibold flex items-center gap-1"><FiInfo /> Atenção: verifique atualização ou atribuição.</div>
                  )}
                  {insights.lastCommentFromClient && (
                    <div className="text-xs text-orange-800 font-semibold flex items-center gap-1"><FiMessageSquare /> Cliente aguarda resposta.</div>
                  )}
                </div>
              </>
            )}
          </div>

          {tab === "comments" && (
            <div className="space-y-4" data-testid="comments-tab-content">
              <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 space-y-2">
                <textarea
                  data-testid="comment-textarea"
                  rows={4}
                  className="w-full rounded-xl border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                  placeholder="Escreva um comentario..."
                  aria-label="Escreva um comentario"
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
                    aria-label="Recarregar comentarios"
                    title="Recarregar comentarios"
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
                          aria-label={comment.viewerHasLiked ? "Remover curtida" : "Curtir comentario"}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${
                            comment.viewerHasLiked
                              ? "border-rose-200 bg-rose-50 text-rose-600"
                              : "border-(--tc-border,#e5e7eb) text-(--tc-text-muted,#6b7280)"
                          }`}
                        >
                          <FiHeart size={12} />
                          {comment.reactions?.like ?? 0}
                        </button>
                        {(comment.authorUserId === user?.id || isDev) && !comment.deletedAt && (
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
                          aria-label="Editar comentario"
                          placeholder="Edite o comentario..."
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
                  aria-label="Recarregar historico"
                  title="Recarregar historico"
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
                    <p className="text-sm font-semibold text-(--tc-text,#0f172a)">{formatEventLabel(event, selectableStatusOptions)}</p>
                    <p className="text-[11px] text-(--tc-text-muted,#6b7280)">
                      {event.actorName || event.actorEmail || event.actorUserId || "Sistema"} •{" "}
                      {new Date(event.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "timeline" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Timeline</p>
                <button
                  type="button"
                  onClick={loadTimeline}
                  aria-label="Recarregar timeline"
                  title="Recarregar timeline"
                  className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em]"
                >
                  Atualizar
                </button>
              </div>
              {timelineLoading && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando...</p>}
              {!timelineLoading && timelineItems.length === 0 && (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhuma movimentacao registrada.</p>
              )}
              <div className="space-y-2">
                {timelineItems.map((item, idx) => (
                  <div key={`${item.at}-${idx}`} className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white p-3">
                    <p className="text-sm font-semibold text-(--tc-text,#0f172a)">
                      {getTicketStatusLabel(item.from, selectableStatusOptions)}{" -> "}{getTicketStatusLabel(item.to, selectableStatusOptions)}
                    </p>
                    <p className="text-[11px] text-(--tc-text-muted,#6b7280)">
                      {item.changedById} • {new Date(item.at).toLocaleString("pt-BR")}
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
