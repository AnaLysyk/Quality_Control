export const TEST_CASE_SOURCES = ["manual", "integration", "qase", "playwright", "import"] as const;
export const TEST_CASE_TYPES = ["manual", "automated", "hybrid"] as const;
export const TEST_CASE_STATUSES = ["draft", "active", "review", "obsolete", "archived"] as const;
export const TEST_CASE_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export type TestCaseSource = (typeof TEST_CASE_SOURCES)[number];
export type TestCaseType = (typeof TEST_CASE_TYPES)[number];
export type TestCaseStatus = (typeof TEST_CASE_STATUSES)[number];
export type TestCasePriority = (typeof TEST_CASE_PRIORITIES)[number];
export type TestCaseExecutionStatus = "passed" | "failed" | "blocked" | "skipped" | "not_run";
export const TEST_CASE_AUTOMATION_STATUSES = [
  "none",
  "planned",
  "ai_generated",
  "review",
  "approved",
  "linked",
  "published",
  "running",
  "stable",
  "broken",
  "disabled",
  "pending",
] as const;
export type TestCaseAutomationStatus = (typeof TEST_CASE_AUTOMATION_STATUSES)[number];
export type TestEvidenceType = "screenshot" | "video" | "trace" | "log" | "attachment" | "note";

export type AutomationApprovalState =
  | "none"
  | "awaiting_qa_review"
  | "approved_for_publish"
  | "approved_for_execution"
  | "approved_for_healing";

export type AutomationQualityScore = {
  totalScore: number;
  locators: "good" | "medium" | "poor";
  assertions: "sufficient" | "weak";
  pom: "yes" | "not_required" | "missing";
  fixtures: "yes" | "no";
  traceability: "ok" | "missing";
  flakinessRisk: "low" | "medium" | "high";
  security: "ok" | "risk";
  reviewedAt: string;
  reviewedBy?: string | null;
};

export type AutomationEnvironment = {
  id: string;
  name: "local" | "dev" | "homolog" | "staging" | "production_controlled";
  baseUrl: string;
  companySlug: string;
  project: string;
  allowWrite: boolean;
  allowDestructive: boolean;
  featureFlags?: Record<string, boolean>;
};

export type AutomationGuardrailEvent = {
  id: string;
  testCaseId: string;
  draftId?: string | null;
  guardrail:
    | "PermissionGuardrail"
    | "SecretGuardrail"
    | "ScopeGuardrail"
    | "DestructiveActionGuardrail"
    | "CodeQualityGuardrail"
    | "GitHubPublishGuardrail"
    | "CommandGuardrail"
    | "StorageStateGuardrail";
  status: "allowed" | "blocked";
  message: string;
  createdBy: string;
  createdAt: string;
};

export type TestCase = {
  id: string;
  key?: string;
  externalId?: string;
  externalKey?: string;
  externalUrl?: string;
  source: TestCaseSource;
  title: string;
  description?: string;
  objective?: string;
  preconditions?: string;
  postconditions?: string;
  type: TestCaseType;
  status: TestCaseStatus;
  priority: TestCasePriority;
  severity?: TestCasePriority;
  risk?: TestCasePriority;
  companyId?: string | null;
  applicationId?: string | null;
  moduleId?: string | null;
  testProjectId?: string | null;
  testProjectCode?: string | null;
  testProjectName?: string | null;
  suiteId?: string | null;
  suiteName?: string | null;
  featureId?: string | null;
  tags: string[];
  ownerId?: string | null;
  lastRunId?: string | null;
  lastExecutionStatus?: TestCaseExecutionStatus;
  lastExecutedAt?: string | null;
  automationStatus: TestCaseAutomationStatus;
  automationId?: string | null;
  createdBy: string;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TestCaseStep = {
  id: string;
  testCaseId: string;
  order: number;
  action: string;
  expectedResult: string;
  data?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TestCaseSnapshot = {
  title: string;
  description?: string;
  preconditions?: string;
  postconditions?: string;
  steps: Array<{
    order: number;
    action: string;
    expectedResult: string;
    data?: string | null;
  }>;
  tags: string[];
  priority: string;
  status: string;
};

export type TestCaseVersion = {
  id: string;
  testCaseId: string;
  version: number;
  snapshot: TestCaseSnapshot;
  createdBy: string;
  createdAt: string;
};

export type TestAutomationLink = {
  id: string;
  testCaseId: string;
  provider: "playwright";
  repository?: string | null;
  branch?: string | null;
  specFile: string;
  testDescribe?: string | null;
  testTitle?: string | null;
  playwrightProject?: string | null;
  tags: string[];
  command?: string | null;
  pomPath?: string | null;
  fixtureNames: string[];
  locatorStrategy?: string | null;
  environment?: string | null;
  status: "active" | "broken" | "pending" | "disabled";
  lastRunId?: string | null;
  lastStatus?: TestCaseExecutionStatus;
  lastExecutedAt?: string | null;
  lastDurationMs?: number | null;
  lastTraceUrl?: string | null;
  lastVideoUrl?: string | null;
  lastScreenshotUrl?: string | null;
  lastErrorMessage?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateTestAutomationLinkInput = {
  repository?: string | null;
  branch?: string | null;
  specFile: string;
  testDescribe?: string | null;
  testTitle?: string | null;
  playwrightProject?: string | null;
  environment?: string | null;
  tags?: string[];
  command?: string | null;
  pomPath?: string | null;
  fixtureNames?: string[];
  locatorStrategy?: string | null;
  status?: TestAutomationLink["status"];
  allowDuplicate?: boolean;
};

export type TestCaseExternalSync = {
  id: string;
  testCaseId: string;
  provider: "qase" | "integration" | "import";
  externalId: string;
  externalKey?: string | null;
  externalUrl?: string | null;
  lastSyncedAt: string;
  syncStatus: "synced" | "pending" | "conflict" | "failed";
  rawPayload?: unknown;
  createdAt: string;
  updatedAt: string;
};

export type TestCaseRecord = {
  testCase: TestCase;
  steps: TestCaseStep[];
  versions: TestCaseVersion[];
  automationLink?: TestAutomationLink | null;
  externalSync?: TestCaseExternalSync | null;
};

export type AutomationDraftStatus = "draft" | "approved" | "linked" | "discarded";

export type AutomationDraft = {
  id: string;
  testCaseId: string;
  generatedBy: "ai" | "user";
  status: AutomationDraftStatus;
  maturityStatus?: TestCaseAutomationStatus;
  approvalState?: AutomationApprovalState;
  qualityScore?: AutomationQualityScore | null;
  linkedTestCaseVersion?: number | null;
  linkedAutomationVersion?: number | null;
  isOutdated?: boolean;
  specFile?: string | null;
  specCode?: string | null;
  pomPath?: string | null;
  pomCode?: string | null;
  fixturePath?: string | null;
  fixtureCode?: string | null;
  command?: string | null;
  reviewNotes?: string | null;
  githubPublication?: {
    status: "pending" | "published" | "failed";
    repository?: string | null;
    branch?: string | null;
    commitSha?: string | null;
    pullRequestUrl?: string | null;
    publishedAt?: string | null;
    errorMessage?: string | null;
  } | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type AutomationAgentRun = {
  id: string;
  testCaseId: string;
  agentName: string;
  inputContext: unknown;
  output: unknown;
  status: "completed" | "failed";
  errorMessage?: string | null;
  createdBy: string;
  createdAt: string;
};

export type TestCaseFilters = {
  query?: string | null;
  companyId?: string | null;
  applicationId?: string | null;
  moduleId?: string | null;
  projectCode?: string | null;
  suiteId?: string | null;
  type?: TestCaseType | "all" | null;
  source?: TestCaseSource | "all" | null;
  status?: TestCaseStatus | "all" | null;
  priority?: TestCasePriority | "all" | null;
  automationStatus?: TestCaseAutomationStatus | "all" | null;
  tag?: string | null;
};

export type CreateTestCaseInput = {
  title: string;
  description?: string;
  objective?: string;
  preconditions?: string;
  postconditions?: string;
  type?: TestCaseType;
  status?: TestCaseStatus;
  priority?: TestCasePriority;
  severity?: TestCasePriority;
  risk?: TestCasePriority;
  companyId?: string | null;
  applicationId?: string | null;
  moduleId?: string | null;
  testProjectCode?: string | null;
  testProjectName?: string | null;
  suiteId?: string | null;
  suiteName?: string | null;
  featureId?: string | null;
  tags?: string[];
  steps?: Array<{
    action: string;
    expectedResult: string;
    data?: string | null;
    notes?: string | null;
  }>;
};
