import type { BrainAccessContext } from "@/backend/brain/access";
import type { BrainIntegrationProvider } from "@/backend/brain/integrations/types";
import type { SystemPermission } from "@/backend/navigation/navigation.types";
import { canAccess } from "@/backend/permissions/can-access";

export const QASE_BRAIN_PERMISSIONS = [
  "qase:view",
  "qase:view_projects",
  "qase:view_suites",
  "qase:view_cases",
  "qase:view_runs",
  "qase:view_results",
  "qase:view_defects",
  "qase:create_case",
  "qase:update_case",
  "qase:create_run",
  "qase:update_run",
  "qase:sync",
  "qase:link_defect",
] as const;

export const JIRA_BRAIN_PERMISSIONS = [
  "jira:view",
  "jira:view_projects",
  "jira:view_issues",
  "jira:view_bugs",
  "jira:view_epics",
  "jira:view_sprints",
  "jira:create_issue",
  "jira:update_issue",
  "jira:transition_issue",
  "jira:comment_issue",
  "jira:link_issue",
  "jira:sync",
] as const;

export const BRAIN_EXTERNAL_ASSISTANT_PERMISSIONS = [
  "brain:view_external_sources",
  "brain:use_qase_data",
  "brain:use_jira_data",
  "assistant:query_qase",
  "assistant:query_jira",
  "assistant:create_external_ticket",
  "assistant:update_external_ticket",
] as const;

export function parseBrainPermission(permission: string): SystemPermission {
  const [moduleId, action] = permission.split(":");
  return { moduleId, action };
}

export function providerViewPermission(provider: BrainIntegrationProvider): SystemPermission {
  return provider === "qase" ? { moduleId: "qase", action: "view" } : { moduleId: "jira", action: "view" };
}

export function canUseExternalProvider(
  access: BrainAccessContext,
  provider: BrainIntegrationProvider,
  action = "view",
) {
  if (access.user.isGlobalAdmin) return true;

  const providerPermission = { moduleId: provider, action };
  const brainPermission = provider === "qase"
    ? { moduleId: "brain", action: "use_qase_data" }
    : { moduleId: "brain", action: "use_jira_data" };
  const assistantPermission = provider === "qase"
    ? { moduleId: "assistant", action: "query_qase" }
    : { moduleId: "assistant", action: "query_jira" };

  return (
    canAccess(access.userAccess, providerPermission) ||
    canAccess(access.userAccess, providerViewPermission(provider)) ||
    canAccess(access.userAccess, brainPermission) ||
    canAccess(access.userAccess, assistantPermission)
  );
}

