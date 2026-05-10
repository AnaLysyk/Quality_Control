export const BrainModuleEvents = {
  testCase: {
    created: "test_case.created",
    updated: "test_case.updated",
    archived: "test_case.archived",
    linkedToPlan: "test_plan.case_linked",
  },
  automation: {
    scriptPublished: "automation.script.published",
    scriptFailed: "automation.script.failed",
    runFinished: "automation.run.finished",
  },
  quality: {
    defectCreated: "defect.created",
    defectLinkedToRun: "defect.linked_to_run",
    runFailed: "run.failed",
  },
  permissions: {
    changed: "permission.changed",
  },
} as const;

const allowedEvents = new Set<string>(
  Object.values(BrainModuleEvents)
    .flatMap((group) => Object.values(group)),
);

export function isAllowedBrainEvent(eventType: string) {
  return allowedEvents.has(eventType);
}

export type BrainAssistantResponseContract = {
  answer: string;
  confidence: number;
  evidence: Array<{
    sourceType: "node" | "edge" | "memory" | "document" | "event";
    sourceId: string;
    label?: string;
    reason: string;
  }>;
  insufficientEvidence: boolean;
};
