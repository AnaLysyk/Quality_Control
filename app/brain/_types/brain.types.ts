export type BrainNodeType =
  | "module"
  | "company"
  | "project"
  | "screen"
  | "entity"
  | "person"
  | "access_request"
  | "requester"
  | "profile"
  | "status"
  | "action"
  | "integration"
  | "event"
  | "permission"
  | "log"
  | "email"
  | "comment"
  | "document"
  | "defect"
  | "automation"
  | "test_case"
  | "execution"
  | "pdf"
  | "adjustment"
  | "decision";

export type BrainNodeStatus = "ok" | "warning" | "missing" | "pending" | "error" | "orphan";
export type BrainNodeLifecycleStatus =
  | "created"
  | "active"
  | "updated"
  | "archived"
  | "deleted"
  | "hidden"
  | "blocked_by_permission"
  | "orphan"
  | "stale";

export type BrainEdgeType =
  | "belongs_to_company"
  | "belongs_to_project"
  | "belongs_to_module"
  | "created_by"
  | "generated_by"
  | "has_status"
  | "has_log"
  | "has_comment"
  | "has_document"
  | "has_email"
  | "has_pdf"
  | "has_decision"
  | "has_adjustment"
  | "depends_on"
  | "mentions"
  | "forms_information"
  | "permission_allows"
  | "permission_blocks"
  | "relation"
  | "action"
  | "history"
  | "event"
  | "contains"
  | "permission"
  | "generates";

export type BrainNode = {
  id: string;
  type: BrainNodeType;
  module: string;
  companyId?: string;
  companyName?: string;
  projectId?: string;
  projectName?: string;
  label: string;
  description?: string;
  status: BrainNodeStatus;
  size?: "sm" | "md" | "lg";
  information?: string;
  createdBy?: string;
  createdByEmail?: string;
  createdAt?: string;
  updatedAt?: string;
  generatedBy?: "user" | "system" | "brain" | "automation";
  entityType?: string;
  entityId?: string;
  connectionCount?: number;
  incomingCount?: number;
  outgoingCount?: number;
  missingKnowledge?: string[];
  actions?: string[];
  tags?: string[];
  aliases?: string[];
  requiredPermissions?: string[];
  visibleByPermission?: boolean;
  lifecycleStatus?: BrainNodeLifecycleStatus;
  source?: {
    type?: string;
    table?: string;
    route?: string;
    provider?: string;
    externalId?: string;
    generatedBy?: string;
    generatedAt?: string;
    updatedAt?: string;
  };
  metadata?: Record<string, unknown>;
};

export type BrainEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  type?: BrainEdgeType | "belongs_to";
  status?: BrainNodeStatus;
  companyId?: string;
  projectId?: string;
  module?: string;
  metadata?: Record<string, unknown>;
};

export type BrainGraphSummary = {
  totalNodes: number;
  totalEdges: number;
  totalModules: number;
  companies?: number;
  projects?: number;
  modules?: number;
  accessRequestNodes: number;
  requestsWithoutNode: number;
  orphanNodes: number;
  pendingNodes?: number;
  missingKnowledge?: number;
  eventsToday?: number;
  generatedByBrain?: number;
  generatedByAutomation?: number;
  generatedByUsers?: number;
  logsLinked: number;
  pendingMappings: string[];
};

export type BrainVisibleContext = {
  userId: string;
  userEmail: string;
  userName?: string;
  role?: string;
  companyRole?: string;
  allowedCompanyIds: string[];
  allowedProjectIds: string[];
  allowedModules: string[];
  canViewGlobalBrain: boolean;
  canViewLogs: boolean;
  canViewAudit: boolean;
  canExecuteActions: boolean;
};

export type BrainContextCompany = {
  id: string;
  name: string;
  slug?: string | null;
};

export type BrainContextProject = {
  id: string;
  name: string;
  companyId?: string | null;
};

export type BrainContextResponse = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    role?: string | null;
    companyRole?: string | null;
  } | null;
  companies: BrainContextCompany[];
  projects: BrainContextProject[];
  modules: string[];
  permissions: {
    canViewGlobalBrain: boolean;
    canViewLogs: boolean;
    canViewAudit: boolean;
    canExecuteActions: boolean;
  };
  defaultContext: {
    companyId: string | null;
    projectId: string | null;
    module: string | null;
  };
  source: "database" | "fallback";
  warning?: string;
};

export type BrainEvent = {
  id: string;
  companyId?: string;
  projectId?: string;
  module: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  createdAt: string;
  generatedBy: "user" | "system" | "brain" | "automation";
  summary: string;
  metadata?: Record<string, unknown>;
};

export type BrainContextFilters = {
  companyId?: string;
  projectId?: string;
  module?: string;
  nodeType?: BrainNodeType | "all";
  status?: BrainNodeStatus | "all";
  period?: "all" | "today" | "7d" | "30d";
  q?: string;
  onlyOrphans?: boolean;
  onlyPending?: boolean;
  depth?: number;
  focusNodeId?: string | null;
};

export type BrainGraphFilter =
  | "all"
  | "access_requests"
  | "defects"
  | "automation"
  | "documents"
  | "users"
  | "permissions"
  | "requesters"
  | "profiles"
  | "integrations"
  | "status"
  | "logs"
  | "emails"
  | "pending"
  | "orphans";

export type BrainAccessRequestRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  statusLabel: string;
  accessType: string;
  company: string;
  createdAt: string;
  message?: string;
  adminNotes?: string | null;
  adjustmentRound?: number;
  lastAdjustmentAt?: string | null;
  lastAdjustmentDiffCount?: number;
};

export type BrainAccessRequestRemovalHistoryItem = {
  id: string;
  requestId: string;
  requesterEmail: string;
  requesterName?: string | null;
  requestStatus?: string | null;
  requestType?: string | null;
  requestedRole?: string | null;
  requestedCompanyId?: string | null;
  requestedCompanySlug?: string | null;
  removedAt: string;
  removedByUserId?: string | null;
  removedByEmail?: string | null;
  source: string;
};

export type BrainAuditLogItem = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  metadata: unknown;
};

export type BrainGraphBuildInput = {
  requests: BrainAccessRequestRow[];
  removalHistory?: BrainAccessRequestRemovalHistoryItem[];
  auditLogs?: BrainAuditLogItem[];
  domainNodes?: BrainNode[];
  domainEdges?: BrainEdge[];
  realBrainNodes?: Array<{
    id: string;
    label: string;
    type: string;
    refType?: string | null;
    refId?: string | null;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
  realBrainEdges?: Array<{
    id: string;
    source: string;
    target: string;
    type?: string | null;
  }>;
};

export type BuiltBrainGraph = {
  nodes: BrainNode[];
  edges: BrainEdge[];
  summary: BrainGraphSummary;
  requests: BrainAccessRequestRow[];
  removalHistory: BrainAccessRequestRemovalHistoryItem[];
  auditLogs: BrainAuditLogItem[];
};

