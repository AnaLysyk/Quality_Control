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
import { NotesPanel } from "./NotesPanel";
import { OutcomeBanner } from "./OutcomeBanner";
import { ProfileHero } from "./ProfileHero";
import { StatusBubbles } from "./StatusBubbles";
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
  missingRequiredFields,
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

  const changedCount = useMemo(
    () => comparisonRows.filter((row) => row.changed).length,
    [comparisonRows],
  );
  const hasAdjustmentComment = useMemo(
    () =>
      adjustmentFieldsDraft.some((field) => (adjustmentFieldComments[field] ?? "").trim().length > 0) ||
      commentDraft.trim().length > 0,
    [adjustmentFieldComments, adjustmentFieldsDraft, commentDraft],
  );
  const hasAdjustmentFieldsWithoutNotes = useMemo(
    () =>
      adjustmentFieldsDraft.some((field) => (adjustmentFieldComments[field] ?? "").trim().length === 0) &&
      commentDraft.trim().length === 0,
    [adjustmentFieldComments, adjustmentFieldsDraft, commentDraft],
  );

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-4 bg-slate-50 p-3 sm:p-4 xl:p-5 2xl:p-6"
    >
      <ProfileHero
        profile={previewProfile}
        avatarValue={profileEmoji}
        avatarKind={profileAvatarKind}
        saving={saving}
        readOnly={readOnly}
        onSaveVisual={onSaveVisualProfile}
        onAvatarChange={onAvatarChange}
      />

      <StatusBubbles
        profile={previewProfile}
        missingRequiredFields={missingRequiredFields}
        requiresCompany={requiresCompany}
        changedCount={changedCount}
        commentsLocked={commentsLocked}
      />

      <OutcomeBanner
        status={selected.status}
        accepting={accepting}
        requestingAdjustment={requestingAdjustment}
      />

      <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.42fr)]">
        <ChangesShowcase
          rows={comparisonRows}
          selectedFields={adjustmentFieldsDraft}
          fieldComments={adjustmentFieldComments}
          readOnly={readOnly || commentsLocked}
          submittedAt={selected.createdAt}
          onToggleField={onToggleAdjustmentField}
          onFieldCommentChange={onAdjustmentFieldCommentChange}
        />
        <NotesPanel
          value={internalNotesDraft}
          locked={readOnly || commentsLocked}
          saving={saving}
          onChange={onInternalNotesChange}
          onSave={onSaveInternalNotes}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Ação com solicitante</p>
            <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Conversa e decisão</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Use o chat para conversa avulsa. A devolucao de campos ja foi preparada no formulario acima.
            </p>
          </div>

          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">
            {adjustmentFieldsDraft.length} campo(s) para ajuste
          </span>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="grid items-start gap-4">
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
          </div>

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
            adjustmentReady={hasAdjustmentComment}
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
      </section>
    </div>
  );
}
