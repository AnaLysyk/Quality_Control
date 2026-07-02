import type { TestCase, TestCaseSnapshot, TestCaseStep, TestCaseVersion } from "./types";

export function buildTestCaseSnapshot(testCase: TestCase, steps: TestCaseStep[]): TestCaseSnapshot {
  return {
    title: testCase.title,
    description: testCase.description,
    preconditions: testCase.preconditions,
    postconditions: testCase.postconditions,
    steps: steps
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((step) => ({
        order: step.order,
        action: step.action,
        expectedResult: step.expectedResult,
        data: step.data ?? null,
      })),
    tags: [...testCase.tags],
    priority: testCase.priority,
    status: testCase.status,
  };
}

export function createTestCaseVersion(
  testCase: TestCase,
  steps: TestCaseStep[],
  version: number,
  createdBy: string,
): TestCaseVersion {
  return {
    id: `${testCase.id}-v${version}`,
    testCaseId: testCase.id,
    version,
    snapshot: buildTestCaseSnapshot(testCase, steps),
    createdBy,
    createdAt: new Date().toISOString(),
  };
}

