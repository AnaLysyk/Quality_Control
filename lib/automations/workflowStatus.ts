export type AutomationWorkflowStatus = "not_started" | "draft" | "published";

export function normalizeAutomationWorkflowStatus(
  value: unknown,
  fallback: AutomationWorkflowStatus = "not_started",
): AutomationWorkflowStatus {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "draft") return "draft";
  if (normalized === "published") return "published";
  if (normalized === "not_started" || normalized === "not-started" || normalized === "notstarted") {
    return "not_started";
  }
  return fallback;
}

export function aggregateAutomationWorkflowStatus(
  values: Array<AutomationWorkflowStatus | null | undefined>,
  fallback: AutomationWorkflowStatus = "not_started",
): AutomationWorkflowStatus {
  if (values.includes("published")) return "published";
  if (values.includes("draft")) return "draft";
  if (values.includes("not_started")) return "not_started";
  return fallback;
}
