export type AccessRequestsBrainStatusFilter = "all" | "open" | "in_progress" | "closed" | "rejected";
export type AccessRequestsBrainDateFilter = "all" | "today" | "week" | "month" | "two_hours";
export type AccessRequestsBrainActionType =
  | "view"
  | "pdf"
  | "remove"
  | "approve"
  | "reject"
  | "request_adjustment";

export type AccessRequestsBrainFilters = {
  searchTerm?: string;
  statusFilter?: AccessRequestsBrainStatusFilter;
  dateFilter?: AccessRequestsBrainDateFilter;
};

export type AccessRequestsBrainVisibleRow = {
  index: number;
  id: string;
  name: string;
  email: string;
  status: string;
  statusValue: AccessRequestsBrainStatusFilter | "";
  profile: string;
  company: string;
  changes: number;
};

export type AccessRequestsBrainPendingAction = {
  type: Exclude<AccessRequestsBrainActionType, "view" | "pdf">;
  targetRequestId: string;
  targetLabel: string;
  requiredFields?: string[];
  reason?: string;
  createdAt: number;
};

export type AccessRequestsBrainCommand =
  | { kind: "none" }
  | { kind: "greeting" }
  | { kind: "follow_up" }
  | { kind: "confirm_pending" }
  | { kind: "cancel_pending" }
  | { kind: "analyze" }
  | { kind: "explain" }
  | { kind: "filter"; filters: AccessRequestsBrainFilters; actionText: string }
  | { kind: "action"; action: AccessRequestsBrainActionType; term: string; reason?: string; fields?: string[] };

export type AccessRequestsBrainResult = {
  handled: boolean;
  reply?: string;
  pendingAction?: AccessRequestsBrainPendingAction | null;
};
