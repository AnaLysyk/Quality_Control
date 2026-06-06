export type TestPlanCaseStep = {
  id: string;
  action?: string | null;
  expectedResult?: string | null;
  data?: string | null;
};

export type TestPlanAutomationState = {
  enabled: boolean;
  status: "not_started" | "draft" | "published";
  source?: TestPlanSource | null;
  linkedAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
};

export type TestPlanCaseAutomation = {
  enabled: boolean;
  status: "not_started" | "draft" | "published";
  flowId: string | null;
  scriptTemplateId: string | null;
  linkedAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
};

export type TestPlanSource = "qase" | "local" | "automation" | "manual";

export type TestPlanCase = {
  id: string;
  title?: string | null;
  description?: string | null;
  preconditions?: string | null;
  postconditions?: string | null;
  severity?: string | null;
  link?: string | null;
  steps?: TestPlanCaseStep[];
  automation?: TestPlanCaseAutomation;
};

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeStep(raw: unknown, fallbackIndex = 0): TestPlanCaseStep | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const action =
    normalizeOptionalString(record.action) ??
    normalizeOptionalString(record.text) ??
    normalizeOptionalString(record.step) ??
    null;
  const expectedResult =
    normalizeOptionalString(record.expectedResult) ??
    normalizeOptionalString(record.expected_result) ??
    normalizeOptionalString(record.expected) ??
    null;
  const data = normalizeOptionalString(record.data);
  if (!action && !expectedResult && !data) return null;
  return {
    id: normalizeOptionalString(record.id) ?? `step_${fallbackIndex + 1}`,
    action,
    expectedResult,
    data,
  };
}

export function normalizeTestPlanCase(raw: unknown, fallbackId?: string | null): TestPlanCase | null {
  if (typeof raw === "number" || typeof raw === "string") {
    const id = String(raw).trim();
    return id ? { id } : null;
  }

  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id =
    normalizeOptionalString(record.id) ??
    normalizeOptionalString(record.caseId) ??
    normalizeOptionalString(record.case_id) ??
    (fallbackId ? fallbackId.trim() : null);
  if (!id) return null;

  const steps = Array.isArray(record.steps)
    ? record.steps
        .map((item, index) => normalizeStep(item, index))
        .filter((item): item is TestPlanCaseStep => item !== null)
    : [];

  return {
    id,
    title: normalizeOptionalString(record.title),
    description: normalizeOptionalString(record.description),
    preconditions:
      normalizeOptionalString(record.preconditions) ??
      normalizeOptionalString(record.precondition),
    postconditions:
      normalizeOptionalString(record.postconditions) ??
      normalizeOptionalString(record.postcondition),
    severity: normalizeOptionalString(record.severity),
    link: normalizeOptionalString(record.link) ?? normalizeOptionalString(record.url),
    steps: steps.length ? steps : undefined,
    automation: record.automation ? normalizeTestPlanCaseAutomation(record.automation) : undefined,
  };
}

export function parseTestPlanCases(value: unknown): TestPlanCase[] {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => normalizeTestPlanCase(item, `case_${index + 1}`))
      .filter((item): item is TestPlanCase => item !== null);
  }

  const raw = String(value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

  return raw
    .map((item) => {
      const pipeIndex = item.indexOf("|");
      if (pipeIndex > 0) {
        const id = item.slice(0, pipeIndex).trim();
        const title = item.slice(pipeIndex + 1).trim();
        return id ? { id, title: title || null } : null;
      }

      const dashMatch = item.match(/^([^\-]+?)\s+-\s+(.+)$/);
      if (dashMatch) {
        return {
          id: dashMatch[1].trim(),
          title: dashMatch[2].trim() || null,
        };
      }

      return { id: item };
    })
    .filter((item): item is TestPlanCase => item !== null);
}

export function extractNumericCaseIds(cases: TestPlanCase[]) {
  return Array.from(
    new Set(
      cases
        .map((item) => Number(item.id))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  );
}

export function getNextManualCaseId(cases: Array<Pick<TestPlanCase, "id">>) {
  const max = cases.reduce((highest, item) => {
    const match = item.id.match(/^TC-(\d+)$/i);
    if (!match) return highest;
    return Math.max(highest, Number(match[1]) || 0);
  }, 0);
  return `TC-${String(max + 1).padStart(3, "0")}`;
}

export function createEmptyManualCase(cases: Array<Pick<TestPlanCase, "id">>): TestPlanCase {
  return {
    id: getNextManualCaseId(cases),
    title: "",
    description: "",
    preconditions: "",
    postconditions: "",
    severity: "",
    steps: [],
  };
}

export function createEmptyCaseStep(existingSteps?: TestPlanCaseStep[]): TestPlanCaseStep {
  const max = (existingSteps ?? []).reduce((highest, item) => {
    const match = item.id.match(/^step_(\d+)$/i);
    if (!match) return highest;
    return Math.max(highest, Number(match[1]) || 0);
  }, 0);
  return {
    id: `step_${max + 1}`,
    action: "",
    expectedResult: "",
    data: "",
  };
}

export function parseQaseCaseIdsInput(
  value: string,
  existingCases: TestPlanCase[] = [],
) {
  const ids = String(value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^#/, ""))
    .filter((item) => /^\d+$/.test(item));

  const byId = new Map(existingCases.map((item) => [item.id, item]));
  for (const id of ids) {
    if (!byId.has(id)) {
      byId.set(id, { id });
    }
  }
  return Array.from(byId.values());
}

export function buildQaseCaseLink(projectCode: string, caseId: string) {
  const normalizedProjectCode = String(projectCode ?? "").trim().toUpperCase();
  const normalizedCaseId = String(caseId ?? "").trim();
  if (!normalizedProjectCode || !normalizedCaseId) return null;
  return `https://app.qase.io/case/${normalizedProjectCode}-${normalizedCaseId}`;
}

export function normalizeTestPlanAutomationState(
  raw: unknown,
  defaultEnabled = false,
): TestPlanAutomationState {
  const now = new Date().toISOString();

  if (!raw || typeof raw !== "object") {
    return {
      enabled: defaultEnabled,
      status: "not_started",
      linkedAt: null,
      updatedAt: now,
      publishedAt: null,
    };
  }

  const record = raw as Record<string, unknown>;
  const enabled = record.enabled === true || record.enabled === "true";
  const status = ["draft", "published"].includes(String(record.status))
    ? (String(record.status) as "draft" | "published")
    : "not_started";
  const source = ["qase", "local", "automation", "manual"].includes(String(record.source))
    ? (String(record.source) as TestPlanSource)
    : null;

  return {
    enabled,
    status: enabled ? status : "not_started",
    source,
    linkedAt: typeof record.linkedAt === "string" ? record.linkedAt : null,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : now,
    publishedAt: typeof record.publishedAt === "string" ? record.publishedAt : null,
  };
}

export function normalizeTestPlanSource(raw: unknown, fallback: TestPlanSource = "local"): TestPlanSource {
  const normalized = String(raw ?? "").trim().toLowerCase();

  if (normalized === "qase") return "qase";
  if (normalized === "manual") return "manual";
  if (normalized === "automation" || normalized === "playwright") return "automation";
  if (normalized === "local" || normalized === "integration" || normalized === "import") return "local";

  return fallback;
}
export function normalizeTestPlanCaseAutomation(
  raw: unknown,
  defaultEnabled = false,
): TestPlanCaseAutomation {
  const now = new Date().toISOString();

  if (!raw || typeof raw !== "object") {
    return {
      enabled: defaultEnabled,
      status: "not_started",
      flowId: null,
      scriptTemplateId: null,
      linkedAt: null,
      updatedAt: now,
      publishedAt: null,
    };
  }

  const record = raw as Record<string, unknown>;
  const enabled = record.enabled === true || record.enabled === "true";
  const status = ["draft", "published"].includes(String(record.status))
    ? (String(record.status) as "draft" | "published")
    : "not_started";

  return {
    enabled,
    status: enabled ? status : "not_started",
    flowId: typeof record.flowId === "string" ? record.flowId : null,
    scriptTemplateId: typeof record.scriptTemplateId === "string" ? record.scriptTemplateId : null,
    linkedAt: typeof record.linkedAt === "string" ? record.linkedAt : null,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : now,
    publishedAt: typeof record.publishedAt === "string" ? record.publishedAt : null,
  };
}

export function isCaseEffectivelyEmpty(testCase: TestPlanCase) {
  return !(
    normalizeOptionalString(testCase.title) ||
    normalizeOptionalString(testCase.description) ||
    normalizeOptionalString(testCase.preconditions) ||
    normalizeOptionalString(testCase.postconditions) ||
    normalizeOptionalString(testCase.severity) ||
    (Array.isArray(testCase.steps) &&
      testCase.steps.some(
        (step) =>
          normalizeOptionalString(step.action) ||
          normalizeOptionalString(step.expectedResult) ||
          normalizeOptionalString(step.data),
      ))
  );
}

