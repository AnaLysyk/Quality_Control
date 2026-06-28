import { useEffect, useMemo, useRef } from "react";
import type {
  AccessRequestCommentView,
  AccessRequestComparisonRow,
  AccessRequestProfilePreview,
  AdjustmentFieldOptionView,
  AvatarChoice,
} from "../../_types/accessRequests.types";
import { AdjustmentFieldsPanel } from "./AdjustmentFieldsPanel";
import { ChangesShowcase } from "./ChangesShowcase";
import { ConversationPanel } from "./ConversationPanel";
import { DecisionPanel } from "./DecisionPanel";
import { FinalProfilePreview } from "./FinalProfilePreview";
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
  onCommentDraftChange: (value: string) => void;

  internalNotesDraft: string;
  onInternalNotesChange: (value: string) => void;
  onSaveInternalNotes: () => void;

  adjustmentFieldOptions: AdjustmentFieldOptionView[];
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
  onCommentDraftChange,
  internalNotesDraft,
  onInternalNotesChange,
  onSaveInternalNotes,
  adjustmentFieldOptions,
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

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-4 bg-[radial-gradient(circle_at_top_right,rgba(239,0,1,0.07),transparent_28%),radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_30%)] p-3 sm:p-4 xl:p-5 2xl:p-6"
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

      <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.78fr)]">
        <ChangesShowcase rows={comparisonRows} />
        <FinalProfilePreview profile={previewProfile} />
      </div>

      <NotesPanel
        value={internalNotesDraft}
        locked={readOnly || commentsLocked}
        onChange={onInternalNotesChange}
        onSave={onSaveInternalNotes}
      />

      <ConversationPanel
        comments={comments}
        loading={commentLoading}
        error={commentError}
        locked={readOnly || commentsLocked}
        value={commentDraft}
        onChange={onCommentDraftChange}
      />

      {!readOnly && !commentsLocked ? (
        <AdjustmentFieldsPanel
          options={adjustmentFieldOptions}
          selectedFields={adjustmentFieldsDraft}
          comments={adjustmentFieldComments}
          onToggle={onToggleAdjustmentField}
          onCommentChange={onAdjustmentFieldCommentChange}
        />
      ) : null}

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
