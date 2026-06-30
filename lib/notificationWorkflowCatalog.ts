import "server-only";

import { getNotificationOperationModel, type NotificationWorkflow } from "@/data/notificationOperationModel";
import { notificationWorkflowExtensions } from "@/data/notificationWorkflowExtensions";

export function getExtendedNotificationWorkflows(): NotificationWorkflow[] {
  const base = getNotificationOperationModel().workflows;
  const seen = new Set<string>();
  const workflows: NotificationWorkflow[] = [];

  for (const workflow of [...base, ...notificationWorkflowExtensions]) {
    if (seen.has(workflow.id)) continue;
    seen.add(workflow.id);
    workflows.push(workflow);
  }

  return workflows;
}

export function findExtendedNotificationWorkflow(workflowIdOrEventType: string) {
  return getExtendedNotificationWorkflows().find((item) => item.id === workflowIdOrEventType || item.eventType === workflowIdOrEventType) ?? null;
}

export function getExtendedNotificationOperationModel() {
  const model = getNotificationOperationModel();
  const workflows = getExtendedNotificationWorkflows();
  return {
    ...model,
    workflows,
    summary: {
      ...model.summary,
      workflows: workflows.length,
      mandatory: workflows.filter((item) => item.mandatory).length,
      configurable: workflows.filter((item) => !item.mandatory).length,
    },
  };
}
