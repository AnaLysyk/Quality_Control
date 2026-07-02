import { useEffect, useMemo, useRef } from "react";
import type {
  AccessRequestCommentView,
  AccessRequestComparisonRow,
  AccessRequestProfilePreview,
  AvatarChoice,
} from "../../_types/accessRequests.types";
import { ChangesShowcase } from "./ChangesShowcase";
import { ConversationPanel } from "./ConversationPanel";
import { DecisionPanel } from "./DecisionPanel";
import { ProfileHero, type ProfileTimelineItem } from "./ProfileHero";
import { buildPreviewProfile } from "./workspace.helpers";

type RejectionReasonOption = {
  value: string;
  label: string;
};

type AccessRequestProfileWorkspaceProps = {
  selected: AccessRequestProfilePreview;
  draft: Partial<AccessRequestProfilePreview>;
  comparisonRows: AccessRequestComparisonRow[];

  profileEmoji: string;
  profileAvatarKind?: AvatarChoice["avatarKind"];
  saving: boolean;
  onSaveVisualProfile?: () => void;
  readOnly?: boolean;
  onAvatarChange: (choice: AvatarChoice) => void;

  missingRequiredFields: boolean;
  requiresCompany: boolean;
  acceptDisabled: boolean;
  accepting: boolean;
  requestingAdjustment: boolean;
  selectedIsPasswordReset: boolean;
  commentsLocked: boolean;

  comments: AccessRequestCommentView[];
  commentLoading: boolean;
  commentError: string | null;
  commentDraft: string;
  sendingComment: boolean;
  onCommentDraftChange: (value: string) => void;
  onSendComment: () => void;

  internalNotesDraft: string;
  onInternalNotesChange: (value: string) => void;
  onSaveInternalNotes: (value: string) => void;

  adjustmentFieldsDraft: string[];
  adjustmentFieldComments: Record<string, string>;
  onToggleAdjustmentField: (field: string) => void;
  onAdjustmentFieldCommentChange: (field: string, value: string) => void;

  rejectionReasons: readonly RejectionReasonOption[];
  rejectionReasonDraft: string;
  onRejectionReasonChange: (value: string) => void;

  onRequestAdjustment: () => void;
  onReject: () => void;
  onApprove: () => void;
};

function safeTimelineDate(value: string) {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return date.toLocaleString("pt-BR");
}

export function AccessRequestProfileWorkspace({
  selected,
  draft,
  comparisonRows,
  profileEmoji,
  profileAvatarKind,
  saving,
  onSaveVisualProfile,
  readOnly = false,
  onAvatarChange,
  requiresCompany,
  acceptDisabled,
  accepting,
  requestingAdjustment,
  selectedIsPasswordReset,
  commentsLocked,
  comments,
  commentLoading,
  commentError,
  commentDraft,
  sendingComment,
  onCommentDraftChange,
  onSendComment,
  internalNotesDraft,
  onInternalNotesChange,
  onSaveInternalNotes,
  adjustmentFieldsDraft,
  adjustmentFieldComments,
  onToggleAdjustmentField,
  onAdjustmentFieldCommentChange,
  rejectionReasons,
  rejectionReasonDraft,
  onRejectionReasonChange,
  onRequestAdjustment,
  onReject,
  onApprove,
}: AccessRequestProfileWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [selected.id]);

  const previewProfile = useMemo(
    () => buildPreviewProfile(selected, draft),
    [selected, draft],
  );

  const adjustmentReady = useMemo(
    () =>
      adjustmentFieldsDraft.length > 0 &&
      adjustmentFieldsDraft.every((field) => (adjustmentFieldComments[field] ?? "").trim().length > 0),
    [adjustmentFieldComments, adjustmentFieldsDraft],
  );

  const hasAdjustmentFieldsWithoutNotes = useMemo(
    () => adjustmentFieldsDraft.some((field) => (adjustmentFieldComments[field] ?? "").trim().length === 0),
    [adjustmentFieldComments, adjustmentFieldsDraft],
  );

  const timelineItems = useMemo<ProfileTimelineItem[]>(() => {
    const events: ProfileTimelineItem[] = [
      {
        id: "created",
        title: "SolicitaÃ§Ã£o recebida",
        side: "Solicitante",
        date: safeTimelineDate(selected.createdAt),
        summary: "Pedido entrou na fila de anÃ¡lise.",
        details: `SolicitaÃ§Ã£o de ${previewProfile.fullName || previewProfile.name || previewProfile.email}.`,
        tone: "neutral",
      },
    ];

    adjustmentFieldsDraft.forEach((field) => {
      const row = comparisonRows.find((item) => item.field === field);
      events.push({
        id: "adjustment-" + field,
        title: "Ajuste solicitado",
        side: "Revisor",
        date: "Agora",
        summary: row?.label ?? field,
        details: adjustmentFieldComments[field] || "Campo marcado para ajuste, ainda sem orientaÃ§Ã£o.",
        tone: "warn",
      });
    });

    comparisonRows
      .filter((row) => row.changed)
      .forEach((row) => {
        events.push({
          id: "changed-" + row.field,
          title: row.label + " alterado",
          side: "Cadastro",
          date: "Durante anÃ¡lise",
          summary: `${row.originalText || "NÃ£o informado"} â†’ ${row.currentText || "NÃ£o informado"}`,
          details: `Valor recebido: ${row.originalText || "NÃ£o informado"}\nValor atual: ${row.currentText || "NÃ£o informado"}`,
          tone: "ok",
        });
      });

    comments.forEach((comment) => {
      events.push({
        id: "comment-" + comment.id,
        title: comment.authorRole === "leader_tc" ? "Mensagem do revisor" : "Mensagem do solicitante",
        side: comment.authorRole === "leader_tc" ? "Revisor" : "Solicitante",
        date: safeTimelineDate(comment.createdAt),
        summary: comment.body,
        details: comment.body,
        tone: "neutral",
      });
    });

    return events;
  }, [adjustmentFieldComments, adjustmentFieldsDraft, comments, comparisonRows, previewProfile.email, previewProfile.fullName, previewProfile.name, selected.createdAt]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col gap-3 bg-slate-50 p-3 transition-colors dark:bg-[#071426] sm:p-4 xl:p-5"
    >
      <ProfileHero
        profile={previewProfile}
        avatarValue={profileEmoji}
        avatarKind={profileAvatarKind}
        saving={saving}
        readOnly={readOnly}
        onSaveVisual={onSaveVisualProfile}
        onAvatarChange={onAvatarChange}
        internalNotesValue={internalNotesDraft}
        notesLocked={readOnly || commentsLocked}
        onInternalNotesChange={onInternalNotesChange}
        onSaveInternalNotes={onSaveInternalNotes}
        timelineItems={timelineItems}
      />

      <ChangesShowcase
        rows={comparisonRows}
        selectedFields={adjustmentFieldsDraft}
        fieldComments={adjustmentFieldComments}
        readOnly={readOnly || commentsLocked}
        submittedAt={selected.createdAt}
        onToggleField={onToggleAdjustmentField}
        onFieldCommentChange={onAdjustmentFieldCommentChange}
      />

      <ConversationPanel
        comments={comments}
        loading={commentLoading}
        error={commentError}
        locked={readOnly || commentsLocked}
        value={commentDraft}
        sending={sendingComment}
        onChange={onCommentDraftChange}
        onSend={onSendComment}
      />

      <DecisionPanel
        status={selected.status}
        passwordProvided={Boolean(previewProfile.passwordProvided)}
        requiresCompany={requiresCompany}
        hasCompany={Boolean(previewProfile.clientId)}
        accepting={accepting}
        requestingAdjustment={requestingAdjustment}
        commentsLocked={readOnly || commentsLocked}
        acceptDisabled={acceptDisabled}
        selectedIsPasswordReset={selectedIsPasswordReset}
        adjustmentFieldCount={adjustmentFieldsDraft.length}
        adjustmentReady={adjustmentReady}
        hasAdjustmentFieldsWithoutNotes={hasAdjustmentFieldsWithoutNotes}
        commentDraft={commentDraft}
        rejectionReasonDraft={rejectionReasonDraft}
        rejectionReasons={rejectionReasons}
        onRejectionReasonChange={onRejectionReasonChange}
        onRequestAdjustment={onRequestAdjustment}
        onReject={onReject}
        onApprove={onApprove}
      />
    </div>
  );
}



