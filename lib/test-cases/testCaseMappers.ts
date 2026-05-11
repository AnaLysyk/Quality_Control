import { AUTOMATION_CASES, type AutomationCaseDefinition } from "@/data/automationCases";
import { AUTOMATION_STUDIO_BLUEPRINTS } from "@/data/automationStudio";
import type { TestAutomationLink, TestCase, TestCaseExternalSync, TestCaseRecord, TestCaseStep } from "./types";
import { createTestCaseVersion } from "./testCaseSnapshots";

function nowSeed() {
  return "2026-01-01T00:00:00.000Z";
}

function mapCompanyScope(scope: AutomationCaseDefinition["companyScope"]) {
  return scope === "all" ? null : scope;
}

function mapType(coverage: AutomationCaseDefinition["coverage"]): TestCase["type"] {
  if (coverage === "automation") return "automated";
  if (coverage === "hybrid") return "hybrid";
  return "manual";
}

function mapStatus(status: AutomationCaseDefinition["status"]): TestCase["status"] {
  if (status === "draft") return "draft";
  if (status === "review") return "review";
  return "active";
}

function mapPriority(priority: AutomationCaseDefinition["priority"]): TestCase["priority"] {
  return priority === "medium" ? "medium" : priority;
}

function mapAutomationStatus(testCase: AutomationCaseDefinition): TestCase["automationStatus"] {
  if (testCase.playwrightSpecPath) return "linked";
  if (testCase.coverage === "automation" || testCase.coverage === "hybrid") return "pending";
  return "none";
}

function findBlueprint(testCase: AutomationCaseDefinition) {
  return AUTOMATION_STUDIO_BLUEPRINTS.find((blueprint) => blueprint.id === testCase.flowId) ?? null;
}

export function mapAutomationCaseToCentralRecord(testCase: AutomationCaseDefinition): TestCaseRecord {
  const createdAt = nowSeed();
  const automationStatus = mapAutomationStatus(testCase);
  const id = testCase.id;
  const steps = mapAutomationCaseSteps(testCase, createdAt);
  const centralCase: TestCase = {
    id,
    key: testCase.externalCaseRef ?? id.toUpperCase().replace(/[^A-Z0-9]+/g, "-"),
    externalKey: testCase.externalCaseRef ?? undefined,
    source: testCase.source === "catalog" ? "import" : testCase.source,
    title: testCase.title,
    description: testCase.summary,
    objective: testCase.objective,
    preconditions: testCase.preconditions.join("\n"),
    type: mapType(testCase.coverage),
    status: mapStatus(testCase.status),
    priority: mapPriority(testCase.priority),
    companyId: mapCompanyScope(testCase.companyScope),
    applicationId: testCase.application,
    moduleId: testCase.domain,
    testProjectCode: testCase.externalCaseRef?.split("-")[0] ?? testCase.application.toUpperCase(),
    testProjectName: testCase.application,
    suiteId: testCase.domain,
    suiteName: testCase.domain,
    tags: [...testCase.tags],
    lastRunId: testCase.linkedRunName ?? null,
    lastExecutionStatus: testCase.lastExecutionStatus ?? "not_run",
    lastExecutedAt: testCase.lastExecutionAt ?? null,
    automationStatus,
    automationId: automationStatus === "linked" ? `${id}-automation` : null,
    createdBy: "automation-catalog",
    createdAt,
    updatedAt: createdAt,
  };

  const automationLink: TestAutomationLink | null = testCase.playwrightSpecPath
    ? {
        id: `${id}-automation`,
        testCaseId: id,
        provider: "playwright",
        repository: null,
        branch: null,
        specFile: testCase.playwrightSpecPath,
        tags: [...testCase.tags],
        fixtureNames: [],
        status: "active",
        lastRunId: testCase.linkedRunName ?? null,
        lastStatus: testCase.lastExecutionStatus ?? "not_run",
        lastExecutedAt: testCase.lastExecutionAt ?? null,
        createdBy: "automation-catalog",
        createdAt,
        updatedAt: createdAt,
      }
    : null;

  const externalSync: TestCaseExternalSync | null = testCase.externalCaseRef
    ? {
        id: `${id}-sync`,
        testCaseId: id,
        provider: testCase.source === "qase" ? "qase" : "import",
        externalId: testCase.externalCaseRef,
        externalKey: testCase.externalCaseRef,
        lastSyncedAt: createdAt,
        syncStatus: "synced",
        createdAt,
        updatedAt: createdAt,
      }
    : null;

  return {
    testCase: centralCase,
    steps,
    versions: [createTestCaseVersion(centralCase, steps, 1, "automation-catalog")],
    automationLink,
    externalSync,
  };
}

export function mapAutomationCaseSteps(testCase: AutomationCaseDefinition, createdAt = nowSeed()): TestCaseStep[] {
  const blueprint = findBlueprint(testCase);
  const blueprintSteps = blueprint?.steps ?? [];
  const fallbackSteps = [
    {
      title: "Preparar contexto",
      expectedResult: testCase.preconditions.join("; ") || "Contexto pronto para execucao.",
      inputBinding: "",
    },
    {
      title: testCase.objective,
      expectedResult: testCase.expectedResult,
      inputBinding: testCase.inputBindings.join(", "),
    },
  ];

  return (blueprintSteps.length ? blueprintSteps : fallbackSteps).map((step, index) => ({
    id: `${testCase.id}-step-${index + 1}`,
    testCaseId: testCase.id,
    order: index + 1,
    action: step.title,
    expectedResult: step.expectedResult,
    data: step.inputBinding || null,
    notes: "Seed inicial do repositorio central.",
    createdAt,
    updatedAt: createdAt,
  }));
}

export function listSeedTestCaseRecords(): TestCaseRecord[] {
  return AUTOMATION_CASES.map(mapAutomationCaseToCentralRecord);
}
