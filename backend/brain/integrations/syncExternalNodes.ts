import "server-only";

import type { BrainAccessContext } from "@/backend/brain/access";
import { buildJiraExternalNodes } from "@/backend/brain/integrations/jiraSource";
import { buildQaseExternalNodes } from "@/backend/brain/integrations/qaseSource";
import type { BrainExternalNode } from "@/backend/brain/integrations/types";

export async function syncExternalBrainNodes(input: {
  access: BrainAccessContext;
  companySlug?: string | null;
  includeQaseRuns?: boolean;
  includeJiraIssues?: boolean;
}): Promise<BrainExternalNode[]> {
  const [qaseNodes, jiraNodes] = await Promise.all([
    buildQaseExternalNodes({
      access: input.access,
      companySlug: input.companySlug,
      includeRuns: input.includeQaseRuns,
    }),
    buildJiraExternalNodes({
      access: input.access,
      companySlug: input.companySlug,
      includeIssues: input.includeJiraIssues,
    }),
  ]);

  return [...qaseNodes, ...jiraNodes];
}

