import "server-only";

import type { AutomationCaseDefinition } from "@/data/automationCases";
import type { Release } from "@/app/types/release";
import { readManualReleaseCases, readManualReleases } from "@/lib/manualReleaseStore";
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";
import { listManualTestPlans, type ManualTestPlanRecord } from "@/lib/testPlansStore";
import type { TestPlanCase } from "@/lib/testPlanCases";
import {
  aggregateAutomationWorkflowStatus,
  type AutomationWorkflowStatus,
} from "@/lib/automations/workflowStatus";

export type ManualAutomationLinkedCase = AutomationCaseDefinition & {
  linkedPlanId: string | null;
  manualCaseId: string | null;
  workflowUpdatedAt: string | null;
};

export type ManualAutomationPlanCaseSummary = {
  id: string;
  title: string;
  status: AutomationWorkflowStatus;
  flowId: string;
  scriptTemplateId: string;
  priority: AutomationCaseDefinition["priority"];
  enabled: boolean;
  externalCaseRef: string | null;
  workflowUpdatedAt: string | null;
};

export type ManualAutomationPlanSummary = {
  id: string;
  title: string;
  description: string | null;
  companySlug: string;
  applicationId: string;
  applicationName: string;
  applicationSlug: string;
  projectCode: string | null;
  totalCases: number;
  linkedCasesCount: number;
  executionCount: number;
  lastExecutionAt: string | null;
  status: AutomationWorkflowStatus;
  visibleInAutomation: boolean;
  automationEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  cases: ManualAutomationPlanCaseSummary[];
};

export type ManualAutomationExecutionCaseSummary = {
  id: string;
  title: string;
  status: string | null;
  bug: string | null;
};

export type ManualAutomationExecutionSummary = {
  id: string;
  slug: string;
  title: string;
  status: string;
  companySlug: string | null;
  planId: string | null;
  planName: string | null;
  applicationName: string;
  createdAt: string;
  updatedAt: string;
  responsibleLabel: string | null;
  metrics: Release["stats"];
  caseResults: ManualAutomationExecutionCaseSummary[];
};

export type ManualAutomationIndex = {
  plans: ManualAutomationPlanSummary[];
  cases: ManualAutomationLinkedCase[];
  executions: ManualAutomationExecutionSummary[];
};

function trimText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function inferPriority(testCase: TestPlanCase): AutomationCaseDefinition["priority"] {
  const severity = trimText(testCase.severity)?.toLowerCase();
  if (severity === "critical") return "critical";
  if (severity === "high") return "high";
  return "medium";
}

function inferFlowId(plan: ManualTestPlanRecord, testCase: TestPlanCase) {
  const automationFlowId = trimText(testCase.automation?.flowId);
  if (automationFlowId) return automationFlowId;

  const haystack = [
    plan.applicationName,
    plan.applicationSlug,
    plan.title,
    testCase.title,
    testCase.description,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  if (haystack.includes("biometr")) return "griaule-biometrics";
  if (haystack.includes("smart") || haystack.includes("ui") || haystack.includes("tela")) {
    return "smart-browser";
  }
  if (haystack.includes("cpf") || haystack.includes("rfb")) return "cpf-rfb";
  if (haystack.includes("token") || haystack.includes("processo")) return "token-processo";
  if (haystack.includes("painel") || haystack.includes("qa")) return "qc-automation-ide";
  return "api-smoke-base";
}

function inferScriptTemplateId(flowId: string, testCase: TestPlanCase) {
  const automationScriptTemplateId = trimText(testCase.automation?.scriptTemplateId);
  if (automationScriptTemplateId) return automationScriptTemplateId;

  if (flowId === "griaule-biometrics") return "conditional-loop";
  if (flowId === "smart-browser") return "playwright-pom";
  if (flowId.startsWith("qc-")) return "playwright-pom";
  return "playwright-api";
}

function buildCaseSummary(plan: ManualTestPlanRecord, testCase: TestPlanCase, index: number) {
  return trimText(testCase.description) ?? `Caso manual ${index + 1} importado do plano ${plan.title}.`;
}

function buildCaseObjective(plan: ManualTestPlanRecord, testCase: TestPlanCase) {
  return trimText(testCase.description) ?? trimText(plan.description) ?? "Cobrir o fluxo funcional mapeado no plano manual.";
}

function buildExpectedResult(testCase: TestPlanCase) {
  return trimText(testCase.postconditions) ?? "Fluxo concluido conforme esperado no caso manual.";
}

function buildInputBindings(testCase: TestPlanCase) {
  return (testCase.steps ?? [])
    .map((step, index) => trimText(step.data) ?? trimText(step.action) ?? `step_${index + 1}`)
    .filter((value): value is string => Boolean(value));
}

function buildTags(plan: ManualTestPlanRecord, testCase: TestPlanCase) {
  const tokens = [plan.applicationSlug, plan.applicationName, plan.title, testCase.title]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) =>
      value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 3),
    );
  return Array.from(new Set(tokens)).slice(0, 8);
}

function resolveCaseStatus(testCase: TestPlanCase): AutomationWorkflowStatus {
  if (!testCase.automation?.enabled) return "not_started";
  return testCase.automation.status;
}

function resolvePlanStatus(plan: ManualTestPlanRecord) {
  return aggregateAutomationWorkflowStatus([
    plan.automation.enabled ? plan.automation.status : null,
    ...plan.cases
      .filter((testCase) => testCase.automation?.enabled)
      .map((testCase) => testCase.automation?.status),
  ]);
}

function toLinkedCase(plan: ManualTestPlanRecord, testCase: TestPlanCase, index: number): ManualAutomationLinkedCase {
  const flowId = inferFlowId(plan, testCase);
  const scriptTemplateId = inferScriptTemplateId(flowId, testCase);
  const title = trimText(testCase.title) ?? `${plan.title} - caso ${index + 1}`;

  return {
    id: `manual:${plan.id}:${testCase.id}`,
    title,
    application: plan.applicationName,
    domain: "Plano manual",
    summary: buildCaseSummary(plan, testCase, index),
    objective: buildCaseObjective(plan, testCase),
    expectedResult: buildExpectedResult(testCase),
    flowId,
    scriptTemplateId,
    source: "manual",
    status: resolveCaseStatus(testCase),
    priority: inferPriority(testCase),
    coverage: "hybrid",
    linkedPlanName: plan.title,
    linkedPlanId: plan.id,
    externalCaseRef: testCase.id,
    manualCaseId: testCase.id,
    workflowUpdatedAt: testCase.automation?.updatedAt ?? null,
    companyScope: plan.companySlug,
    preconditions: trimText(testCase.preconditions) ? [trimText(testCase.preconditions) as string] : [],
    inputBindings: buildInputBindings(testCase),
    tags: buildTags(plan, testCase),
    assetIds: [],
  };
}

function toPlanCaseSummary(plan: ManualTestPlanRecord, testCase: TestPlanCase): ManualAutomationPlanCaseSummary {
  const flowId = inferFlowId(plan, testCase);
  return {
    id: testCase.id,
    title: trimText(testCase.title) ?? testCase.id,
    status: resolveCaseStatus(testCase),
    flowId,
    scriptTemplateId: inferScriptTemplateId(flowId, testCase),
    priority: inferPriority(testCase),
    enabled: Boolean(testCase.automation?.enabled),
    externalCaseRef: testCase.id,
    workflowUpdatedAt: testCase.automation?.updatedAt ?? null,
  };
}

function buildExecutionSummary(
  release: Release,
  plan: ManualAutomationPlanSummary,
  caseLookup: Map<string, ManualAutomationPlanCaseSummary>,
  storedCases: Awaited<ReturnType<typeof readManualReleaseCases>>[string] | undefined,
): ManualAutomationExecutionSummary {
  const caseResults = (storedCases ?? []).map((item) => {
    const linkedCase = caseLookup.get(item.id);
    return {
      id: item.id,
      title: trimText(item.title) ?? linkedCase?.title ?? item.id,
      status: trimText(item.status),
      bug: trimText(item.bug),
    };
  });

  return {
    id: release.slug,
    slug: release.slug,
    title: release.name,
    status: release.status,
    companySlug: release.clientSlug ?? null,
    planId: plan.id,
    planName: plan.title,
    applicationName: plan.applicationName,
    createdAt: release.createdAt,
    updatedAt: release.updatedAt,
    responsibleLabel: trimText(release.assignedToName) ?? trimText(release.createdByName),
    metrics: release.stats,
    caseResults,
  };
}

export async function buildManualAutomationIndex(companySlug: string): Promise<ManualAutomationIndex> {
  const normalizedCompanySlug = companySlug.trim().toLowerCase();
  const [plans, releases, releaseCasesStore] = await Promise.all([
    listManualTestPlans({ companySlug: normalizedCompanySlug }),
    readManualReleases(),
    readManualReleaseCases(),
  ]);

  const visiblePlans: ManualAutomationPlanSummary[] = [];
  const linkedCases: ManualAutomationLinkedCase[] = [];
  const visiblePlanIds = new Set<string>();

  for (const plan of plans) {
    const linkedPlanCases = plan.cases.filter((testCase) => testCase.automation?.enabled);
    const visibleInAutomation = plan.automation.enabled || linkedPlanCases.length > 0;
    if (!visibleInAutomation) continue;

    const planCaseSummaries = linkedPlanCases.map((testCase) => toPlanCaseSummary(plan, testCase));
    const executions = releases.filter(
      (release) =>
        resolveManualReleaseKind(release) === "run" &&
        (release.clientSlug ?? "").trim().toLowerCase() === normalizedCompanySlug &&
        trimText(release.testPlanId) === plan.id,
    );

    visiblePlans.push({
      id: plan.id,
      title: plan.title,
      description: trimText(plan.description),
      companySlug: plan.companySlug,
      applicationId: plan.applicationId,
      applicationName: plan.applicationName,
      applicationSlug: plan.applicationSlug,
      projectCode: trimText(plan.projectCode),
      totalCases: plan.cases.length,
      linkedCasesCount: linkedPlanCases.length,
      executionCount: executions.length,
      lastExecutionAt:
        executions
          .map((execution) => execution.updatedAt)
          .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null,
      status: resolvePlanStatus(plan),
      visibleInAutomation,
      automationEnabled: plan.automation.enabled,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      cases: planCaseSummaries,
    });

    visiblePlanIds.add(plan.id);
    linkedCases.push(...linkedPlanCases.map((testCase, index) => toLinkedCase(plan, testCase, index)));
  }

  const executions = releases
    .filter(
      (release) =>
        resolveManualReleaseKind(release) === "run" &&
        (release.clientSlug ?? "").trim().toLowerCase() === normalizedCompanySlug &&
        Boolean(trimText(release.testPlanId)) &&
        visiblePlanIds.has(trimText(release.testPlanId) as string),
    )
    .map((release) => {
      const plan = visiblePlans.find((item) => item.id === release.testPlanId);
      if (!plan) return null;
      const caseLookup = new Map(plan.cases.map((item) => [item.id, item]));
      return buildExecutionSummary(release, plan, caseLookup, releaseCasesStore[release.slug]);
    })
    .filter((item): item is ManualAutomationExecutionSummary => item !== null)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

  return {
    plans: visiblePlans.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
    cases: linkedCases.sort((left, right) => {
      const leftTime = Date.parse(left.workflowUpdatedAt ?? "") || 0;
      const rightTime = Date.parse(right.workflowUpdatedAt ?? "") || 0;
      if (rightTime !== leftTime) return rightTime - leftTime;
      return left.title.localeCompare(right.title);
    }),
    executions,
  };
}
