export type TestCaseSource = "manual" | "integration" | "qase" | "playwright" | "import";
export type TestCaseType = "manual" | "automated" | "hybrid";
export type TestCaseStatus = "draft" | "active" | "review" | "obsolete" | "archived";
export type TestCasePriority = "low" | "medium" | "high" | "critical";
export type TestCaseExecutionStatus = "passed" | "failed" | "blocked" | "skipped" | "not_run";
export type TestCaseAutomationStatus = "none" | "linked" | "broken" | "pending";
export type TestEvidenceType = "screenshot" | "video" | "trace" | "log" | "attachment" | "note";

export type TestCase = {
  id: string;
  key?: string;
  externalId?: string;
  externalKey?: string;
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
  testTitle?: string | null;
  tag?: string | null;
  command?: string | null;
  environment?: string | null;
  status: "active" | "broken" | "pending" | "disabled";
  lastRunId?: string | null;
  lastStatus?: TestCaseExecutionStatus;
  lastExecutedAt?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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

export type TestCaseFilters = {
  query?: string | null;
  companyId?: string | null;
  applicationId?: string | null;
  moduleId?: string | null;
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
  featureId?: string | null;
  tags?: string[];
  steps?: Array<{
    action: string;
    expectedResult: string;
    data?: string | null;
    notes?: string | null;
  }>;
};
