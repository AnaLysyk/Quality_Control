import "server-only";

import type { BrainAccessContext } from "@/backend/brain/access";
import type { BrainGraphSource } from "@/backend/brain/sources";
import { getCompanyIntegrationConfig } from "@/backend/integrations";
import { fetchJiraIssuesForCompany } from "@/backend/jiraSync";
import { canUseExternalProvider } from "@/backend/brain/integrations/permissions";
import type { BrainExternalNode } from "@/backend/brain/integrations/types";

type JiraSourceContext = {
  access: BrainAccessContext;
  companySlug?: string | null;
  includeIssues?: boolean;
};

export async function buildJiraExternalNodes(context: JiraSourceContext): Promise<BrainExternalNode[]> {
  if (!context.companySlug) return [];
  if (!canUseExternalProvider(context.access, "jira", "view")) return [];

  const config = await getCompanyIntegrationConfig(context.companySlug, "JIRA");
  if (!config) return [];

  const syncedAt = new Date().toISOString();
  const nodes: BrainExternalNode[] = [{
    id: `jira:project:${context.companySlug}`,
    type: "JiraProject",
    label: `Jira ${context.companySlug}`,
    description: "Projeto Jira preparado como fonte externa do Brain.",
    source: { type: "integration", provider: "jira", externalId: context.companySlug, syncedAt },
    permissions: [{ moduleId: "jira", action: "view_projects" }],
    actions: ["open_external", "summarize", "inspect", "explain"],
    metadata: {
      provider: "jira",
      source: { type: "integration", provider: "jira", externalId: context.companySlug, syncedAt },
      tags: ["jira", "issue", "bug", "sprint", "epico"],
    },
  }];

  if (context.includeIssues && canUseExternalProvider(context.access, "jira", "view_issues")) {
    const { issues } = await fetchJiraIssuesForCompany(context.companySlug, 50);
    for (const issue of issues) {
      nodes.push({
        id: `jira:issue:${issue.key}`,
        type: "JiraIssue",
        label: `${issue.key} ${issue.summary ?? ""}`.trim(),
        description: `Issue Jira ${issue.key}.`,
        source: { type: "integration", provider: "jira", externalId: issue.key, syncedAt },
        permissions: [{ moduleId: "jira", action: "view_issues" }],
        actions: ["open_external", "summarize", "inspect", "comment", "transition", "link_qase_case", "explain"],
        metadata: {
          provider: "jira",
          externalId: issue.key,
          status: issue.status,
          assignee: issue.assignee,
          created: issue.created,
          source: { type: "integration", provider: "jira", externalId: issue.key, syncedAt },
          tags: ["jira", "issue", "bug", "ticket externo"],
        },
      });
    }
  }

  return nodes;
}

export const jiraBrainSource: BrainGraphSource<JiraSourceContext> = {
  id: "jira",
  label: "Jira",
  enabled: true,
  requiredPermissions: [{ moduleId: "jira", action: "view" }],
  buildNodes: buildJiraExternalNodes,
  async buildEdges() {
    return [];
  },
  async healthCheck(context) {
    if (!context.companySlug) {
      return { id: "jira", label: "Jira", status: "empty", nodes: 0, edges: 0, message: "Sem empresa selecionada." };
    }
    if (!canUseExternalProvider(context.access, "jira", "view")) {
      return { id: "jira", label: "Jira", status: "blocked_by_permission", nodes: 0, edges: 0, message: "Perfil sem permissao Jira." };
    }
    const config = await getCompanyIntegrationConfig(context.companySlug, "JIRA");
    if (!config) return { id: "jira", label: "Jira", status: "disabled", nodes: 0, edges: 0, message: "Integracao Jira ainda nao configurada." };
    return { id: "jira", label: "Jira", status: "ok", nodes: 1, edges: 0 };
  },
};

