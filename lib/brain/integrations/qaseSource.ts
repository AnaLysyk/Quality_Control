import "server-only";

import type { BrainAccessContext } from "@/lib/brain/access";
import type { BrainGraphSource } from "@/lib/brain/sources";
import { getQaseIntegrationSettings } from "@/lib/integrations";
import { listQaseRuns } from "@/lib/qaseRuns";
import { canUseExternalProvider } from "@/lib/brain/integrations/permissions";
import type { BrainExternalNode } from "@/lib/brain/integrations/types";

type QaseSourceContext = {
  access: BrainAccessContext;
  companySlug?: string | null;
  includeRuns?: boolean;
};

function qaseProjectNode(projectCode: string, syncedAt: string): BrainExternalNode {
  return {
    id: `qase:project:${projectCode}`,
    type: "QaseProject",
    label: `Qase ${projectCode}`,
    description: `Projeto Qase/Kase ${projectCode} sincronizado como fonte externa do Brain.`,
    source: { type: "integration", provider: "qase", externalId: projectCode, syncedAt },
    permissions: [{ moduleId: "qase", action: "view_projects" }],
    actions: ["open_external", "summarize", "inspect", "create_run", "explain"],
    metadata: {
      provider: "qase",
      externalId: projectCode,
      tags: ["qase", "kase", "projeto", "suite", "casos", "runs"],
      source: { type: "integration", provider: "qase", externalId: projectCode, syncedAt },
    },
  };
}

export async function buildQaseExternalNodes(context: QaseSourceContext): Promise<BrainExternalNode[]> {
  if (!context.companySlug) return [];
  if (!canUseExternalProvider(context.access, "qase", "view")) return [];

  const settings = await getQaseIntegrationSettings(context.companySlug);
  if (!settings?.token || !settings.projects?.length) return [];

  const syncedAt = new Date().toISOString();
  const nodes: BrainExternalNode[] = settings.projects.map((projectCode) => qaseProjectNode(projectCode, syncedAt));

  if (context.includeRuns && canUseExternalProvider(context.access, "qase", "view_runs")) {
    for (const projectCode of settings.projects) {
      const runs = await listQaseRuns(projectCode, settings.token);
      for (const run of runs.data.slice(0, 50)) {
        nodes.push({
          id: `qase:run:${run.id}`,
          type: "QaseRun",
          label: run.name ?? `Run Qase ${run.id}`,
          description: `Run Qase/Kase ${run.id} no projeto ${projectCode}.`,
          source: { type: "integration", provider: "qase", externalId: String(run.id), syncedAt },
          permissions: [{ moduleId: "qase", action: "view_runs" }],
          actions: ["open_external", "summarize", "inspect", "link_defect", "explain"],
          metadata: {
            provider: "qase",
            projectCode,
            status: run.status ?? null,
            externalId: String(run.id),
            syncedAt,
            tags: ["qase", "kase", "run", "execucao", "resultado"],
            source: { type: "integration", provider: "qase", externalId: String(run.id), syncedAt },
          },
        });
      }
    }
  }

  return nodes;
}

export const qaseBrainSource: BrainGraphSource<QaseSourceContext> = {
  id: "qase",
  label: "Qase/Kase",
  enabled: true,
  requiredPermissions: [{ moduleId: "qase", action: "view" }],
  buildNodes: buildQaseExternalNodes,
  async buildEdges() {
    return [];
  },
  async healthCheck(context) {
    if (!context.companySlug) {
      return { id: "qase", label: "Qase/Kase", status: "empty", nodes: 0, edges: 0, message: "Sem empresa selecionada." };
    }
    if (!canUseExternalProvider(context.access, "qase", "view")) {
      return { id: "qase", label: "Qase/Kase", status: "blocked_by_permission", nodes: 0, edges: 0, message: "Perfil sem permissao Qase." };
    }
    const settings = await getQaseIntegrationSettings(context.companySlug);
    if (!settings?.token || !settings.projects?.length) {
      return { id: "qase", label: "Qase/Kase", status: "disabled", nodes: 0, edges: 0, message: "Integracao sem token/projeto configurado." };
    }
    return { id: "qase", label: "Qase/Kase", status: "ok", nodes: settings.projects.length, edges: 0 };
  },
};
