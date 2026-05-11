export type BrianImpulseType =
  | "defect.created"
  | "defect.updated"
  | "defect.status_changed"
  | "test_case.created"
  | "test_case.updated"
  | "test_run.started"
  | "test_run.failed"
  | "automation.generated"
  | "release.approved"
  | "release.blocked"
  | "ticket.created"
  | "ticket.reopened"
  | "ticket.updated"
  | "comment.added"
  | "file.attached"
  | "permission.granted"
  | "neuron.feedback_created";

export type BrianNeuronKind =
  | "company"
  | "application"
  | "module"
  | "user"
  | "role"
  | "defect"
  | "ticket"
  | "test_case"
  | "test_run"
  | "automation"
  | "release"
  | "environment"
  | "flow"
  | "decision"
  | "risk"
  | "blocker"
  | "comment"
  | "attachment"
  | "integration";

export type BrianSynapseRelation =
  | "belongs_to"
  | "created_by"
  | "updated_by"
  | "impacts"
  | "blocks"
  | "depends_on"
  | "generated_by"
  | "failed_in"
  | "tested_by"
  | "automated_by"
  | "approved_by"
  | "reopened_by"
  | "resolved_by"
  | "linked_to"
  | "originated_from"
  | "mentioned_in"
  | "visible_to";

export type BrianEvidenceSourceType =
  | "route"
  | "payload"
  | "database"
  | "audit_log"
  | "description"
  | "comment"
  | "test_execution"
  | "automation_run"
  | "ticket_description"
  | "user_action";

export type BrianMemoryState =
  | "active"
  | "warm"
  | "cold"
  | "stale"
  | "archived"
  | "blocked"
  | "hidden_by_permission"
  | "needs_review"
  | "deleted";

export type BrianDataClassification = "public" | "internal" | "restricted" | "sensitive" | "secret";

export type BrianDataPolicyAction = "allow" | "mask" | "redact" | "block";

export type BrianRiskLevel = "low" | "medium" | "high" | "critical";

export type BrianOutboxStatus = "pending" | "processing" | "processed" | "failed" | "dead_letter" | "ignored";

export type BrianActivityStatus = "success" | "failed" | "skipped";

export type BrianActor = {
  id: string;
  name: string;
  role: string;
};

export type BrianContextCarrier = {
  traceId: string;
  sessionId: string;
  pathname: string;
  companySlug?: string | null;
  companyId?: string | null;
  applicationKey?: string | null;
  moduleKey?: string | null;
  screenKey?: string | null;
  selectedEntityId?: string | null;
  userId: string;
  role: string;
  permissions: string[];
};

export type BrianImpulseEnvelope = {
  id: string;
  specversion: "brian.v1";
  schemaVersion: number;
  type: BrianImpulseType;
  source: string;
  subject: string;
  time: string;
  actor: BrianActor;
  context: BrianContextCarrier;
  data: Record<string, unknown>;
};

export type BrianVisibilityScope = {
  tenantId?: string | null;
  companyId?: string | null;
  companySlug?: string | null;
  moduleKey?: string | null;
  allowedRoles: string[];
  requiredPermissions: string[];
  dataClassification: BrianDataClassification;
};

export type BrianEvidence = {
  id: string;
  sourceType: BrianEvidenceSourceType;
  sourceId?: string;
  sourceRoute?: string;
  field?: string;
  excerpt?: string;
  capturedAt: string;
};

export type BrianNeuron = {
  id: string;
  kind: BrianNeuronKind;
  label: string;
  description?: string;
  companyId?: string | null;
  companySlug?: string | null;
  moduleKey?: string | null;
  entityType?: string;
  entityId?: string;
  aliases: string[];
  context: {
    summary?: string;
    purpose?: string;
    currentStatus?: string;
    lastRelevantMovement?: string;
    businessImpact?: string;
    technicalImpact?: string;
    origin?: string;
  };
  memory: {
    createdAt: string;
    updatedAt: string;
    lastActivatedAt?: string;
    activationCount: number;
    lastImpulseIds: string[];
    state: BrianMemoryState;
  };
  visibility: {
    companyIds?: string[];
    companySlugs?: string[];
    allowedRoles?: string[];
    requiredPermissions?: string[];
  };
  narrative: {
    short: string;
    detailed: string;
    whyThisExists: string;
  };
};

export type BrianSynapse = {
  id: string;
  fromNeuronId: string;
  toNeuronId: string;
  relation: BrianSynapseRelation;
  weight: number;
  confidence: number;
  reason: string;
  evidenceIds: string[];
  evidence: {
    eventId?: string;
    sourceRoute?: string;
    sourceEntity?: string;
    createdAt: string;
  };
};

export type BrianTriple = {
  subjectNeuronId: string;
  predicate: BrianSynapseRelation;
  objectNeuronId: string;
  evidenceId: string;
  confidence: number;
};

export type BrianActivation = {
  neuronId: string;
  activationScore: number;
  reason: string;
  impulseId?: string;
  userId?: string;
  sessionId?: string;
  createdAt: string;
};

export type BrianActivationPolicy = {
  profile: string;
  preferredNeuronTypes: BrianNeuronKind[];
  minConfidence: number;
  maxDepth: number;
  recencyWindowDays: number;
  includeArchived: boolean;
};

export type BrianNodeProjection = {
  id: string;
  neuronId: string;
  impulseId?: string;
  title: string;
  subtitle: string;
  summary: string;
  explanation: string;
  nodeType: "movement" | "decision" | "failure" | "creation" | "update" | "approval" | "automation" | "execution";
  companyId?: string | null;
  moduleKey?: string | null;
  status: "info" | "success" | "warning" | "danger" | "blocked";
  occurredAt: string;
  actorName: string;
  entityLabel: string;
  relationIds: string[];
  permissions: {
    canView: string[];
    canOpen: string[];
    canAct: string[];
  };
  actions: Array<{ label: string; action: string; targetId?: string }>;
};

export type BrianContextSnapshot = {
  id: string;
  userId: string;
  companyId?: string | null;
  companySlug?: string | null;
  moduleKey?: string | null;
  route: string;
  activeNeuronIds: string[];
  activeSynapseIds: string[];
  recentImpulseIds: string[];
  evidenceIds: string[];
  permissions: string[];
  createdAt: string;
};

export type BrianProcessingResult = {
  impulse: BrianImpulseEnvelope;
  evidences: BrianEvidence[];
  neurons: BrianNeuron[];
  synapses: BrianSynapse[];
  triples: BrianTriple[];
  activations: BrianActivation[];
  projections: BrianNodeProjection[];
  snapshot: BrianContextSnapshot;
  narrative: string;
  warnings: string[];
  quality?: BrianQualityGateReport;
  redactions?: BrianRedactionReport;
};

export type BrianRedactionReport = {
  redactedFields: string[];
  maskedFields: string[];
  blockedFields: string[];
  promptInjectionSignals: string[];
};

export type BrianPolicyDecision = {
  allowed: boolean;
  reason: string;
  requiredPermissions?: string[];
  maskedFields?: string[];
  requiresConfirmation?: boolean;
  requiresApproval?: boolean;
};

export type BrianCapability = {
  id: string;
  label: string;
  description: string;
  module: string;
  requiredPermissions: string[];
  allowedRoles: string[];
  requiresConfirmation: boolean;
  requiresApproval: boolean;
  riskLevel: BrianRiskLevel;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
};

export type BrianEventSchema = {
  type: BrianImpulseType;
  version: number;
  producer: string;
  consumer: "brian_processing_pipeline";
  requiredFields: string[];
  optionalFields: string[];
  activates: BrianNeuronKind[];
  createsRelations: BrianSynapseRelation[];
  requiredEvidence: BrianEvidenceSourceType[];
  compatibility: "backward" | "forward" | "full";
};

export type BrianDomainDefinition = {
  id: string;
  label: string;
  description: string;
  ownsNeuronTypes: BrianNeuronKind[];
  emitsImpulseTypes: BrianImpulseType[];
};

export type BrianNeuronQualityScore = {
  neuronId: string;
  hasTitle: boolean;
  hasContext: boolean;
  hasEvidence: boolean;
  hasNarrative: boolean;
  hasRelations: boolean;
  hasPermissionRule: boolean;
  hasRecentActivation: boolean;
  state: BrianMemoryState;
  score: number;
};

export type BrianQualityGateReport = {
  minScore: number;
  acceptedNeuronIds: string[];
  rejectedNeuronIds: string[];
  reviewNeuronIds: string[];
  scores: BrianNeuronQualityScore[];
  warnings: string[];
};

export type BrianActivityResult = {
  success: boolean;
  status: BrianActivityStatus;
  activity: string;
  impulseId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  output?: unknown;
  error?: string;
  retryable: boolean;
};

export type BrianOutboxRecord = {
  id: string;
  idempotencyKey: string;
  status: BrianOutboxStatus;
  impulse: BrianImpulseEnvelope;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  nextAttemptAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type BrianDeadLetterImpulse = {
  id: string;
  impulseId: string;
  type: BrianImpulseType;
  payload: BrianImpulseEnvelope;
  errorMessage: string;
  retryCount: number;
  status: "dead_letter" | "reprocessed" | "ignored";
  lastAttemptAt: string;
  createdAt: string;
};

export type BrianWorkflowResult = {
  success: boolean;
  workflowId: string;
  impulseId: string;
  idempotencyKey: string;
  activities: BrianActivityResult[];
  processing?: BrianProcessingResult;
  deadLetter?: BrianDeadLetterImpulse;
  telemetry: BrianSemanticTelemetryEvent[];
};

export type BrianContextBudget = {
  maxNeurons: number;
  maxSynapses: number;
  maxEvidenceSnippets: number;
  maxRecentImpulses: number;
  maxTokensApprox: number;
};

export type BrianAnswerTrace = {
  answerId: string;
  userId: string;
  question: string;
  contextSnapshotId: string;
  usedNeuronIds: string[];
  usedSynapseIds: string[];
  usedEvidenceIds: string[];
  blockedByPermission: string[];
  createdAt: string;
};

export type BrianSemanticTelemetryEvent = {
  name:
    | "brian.impulse.received"
    | "brian.impulse.processed"
    | "brian.neuron.activated"
    | "brian.synapse.created"
    | "brian.policy.denied"
    | "brian.context.built"
    | "brian.answer.generated"
    | "brian.capability.executed"
    | "brian.redaction.applied"
    | "brian.workflow.failed";
  timestamp: string;
  attributes: Record<string, string | number | boolean | null>;
};
