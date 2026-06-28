export type AccessRequestVisualProfile = {
  avatarKind?: "emoji" | "gif" | "default" | "image";
  avatarValue?: string;
  avatarLabel?: string;
} | null;

export type AccessRequestReviewSummary = {
  internalNotes?: string;
  visualStatus?: string;
  lastReviewedAt?: string;
  lastReviewedBy?: string;
  changedCount?: number;
  pendingFieldCount?: number;
  requiredFieldsOk?: boolean;
  passwordDefined?: boolean;
  companyDefined?: boolean;
} | null;

export type AccessRequestProfilePreview = {
  id: string;
  createdAt: string;
  status: string;
  email: string;
  fullName: string;
  name: string;
  username: string | null;
  phone: string;
  jobRole: string;
  accessType: string;
  company: string;
  clientId: string | null;
  title: string;
  description: string;
  notes: string;
  adminNotes: string | null;
  passwordProvided: boolean;
  visualProfile?: AccessRequestVisualProfile;
  reviewSummary?: AccessRequestReviewSummary;
};

export type AccessRequestComparisonRow = {
  field: string;
  label: string;
  originalText: string;
  currentText: string;
  changed: boolean;
};

export type AccessRequestCommentView = {
  id: string;
  requestId: string;
  authorRole: "leader_tc" | "requester";
  authorName: string;
  authorEmail?: string | null;
  body: string;
  createdAt: string;
};

export type AdjustmentFieldOptionView = {
  field: string;
  label: string;
  hint: string;
};

export type AvatarChoice = {
  avatarKind: "emoji" | "gif" | "default" | "image";
  avatarValue: string;
  avatarLabel: string;
};
