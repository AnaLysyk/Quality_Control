import "server-only";

import type { Prisma } from "@prisma/client";
import { upsertNode, connectNodes } from "@/lib/brain";
import { prisma } from "@/lib/prismaClient";
import { processBrianImpulse } from "./pipeline";
import type { BrianImpulseEnvelope, BrianProcessingResult } from "./types";

function legacyNodeType(kind: string) {
  const map: Record<string, string> = {
    company: "Company",
    application: "Application",
    module: "Module",
    user: "User",
    defect: "Defect",
    ticket: "Ticket",
    test_case: "TestCase",
    test_run: "TestRun",
    automation: "AutomationScript",
    release: "Release",
    environment: "Environment",
    flow: "Flow",
    decision: "Decision",
    risk: "Risk",
    blocker: "Blocker",
    comment: "Comment",
    attachment: "Artifact",
    integration: "Integration",
    role: "Profile",
  };
  return map[kind] ?? "Note";
}

function legacyEdgeType(relation: string) {
  const map: Record<string, string> = {
    belongs_to: "BELONGS_TO",
    created_by: "CREATED_BY",
    updated_by: "UPDATED_BY",
    impacts: "IMPACTED_BY",
    blocks: "BLOCKS",
    depends_on: "DEPENDS_ON",
    generated_by: "GENERATED_BY_AI",
    tested_by: "TESTED_BY",
    automated_by: "AUTOMATED_BY",
    approved_by: "APPROVED_BY",
    reopened_by: "REOPENED_BY",
    resolved_by: "RESOLVED_BY",
    linked_to: "LINKED_TO",
    originated_from: "GENERATED_EVENT",
    mentioned_in: "MENTIONED_IN",
    visible_to: "VISIBLE_TO",
    failed_in: "FAILED_IN",
  };
  return map[relation] ?? "RELATES_TO";
}

export type PublishBrianImpulseOptions = {
  shadowMode?: boolean;
  projectToLegacyBrain?: boolean;
  applyRbac?: boolean;
};

async function persistShadowAudit(result: BrianProcessingResult) {
  await prisma.brainAuditLog.create({
    data: {
      action: `BRIAN_IMPULSE:${result.impulse.type}`,
      entityType: "BrianImpulse",
      entityId: result.impulse.id,
      userId: result.impulse.actor.id,
      reason: result.narrative,
      after: {
        envelope: result.impulse,
        evidenceCount: result.evidences.length,
        neuronCount: result.neurons.length,
        synapseCount: result.synapses.length,
        activationCount: result.activations.length,
        warnings: result.warnings,
        shadowMode: true,
      } as Prisma.InputJsonValue,
    },
  });
}

async function projectToLegacyBrain(result: BrianProcessingResult) {
  const legacyIds = new Map<string, string>();

  for (const neuron of result.neurons) {
    const node = await upsertNode({
      type: legacyNodeType(neuron.kind),
      label: neuron.label,
      refType: "BrianNeuron",
      refId: neuron.id,
      description: neuron.narrative.whyThisExists,
      metadata: {
        contextualBrain: true,
        neuronKind: neuron.kind,
        entityType: neuron.entityType ?? null,
        entityId: neuron.entityId ?? null,
        companyId: neuron.companyId ?? null,
        companySlug: neuron.companySlug ?? null,
        moduleKey: neuron.moduleKey ?? null,
        aliases: neuron.aliases,
        context: neuron.context,
        memory: neuron.memory,
        visibility: neuron.visibility,
        narrative: neuron.narrative,
      } as Prisma.InputJsonValue,
      enforceOntology: false,
    });
    legacyIds.set(neuron.id, node.id);
  }

  for (const synapse of result.synapses) {
    const fromId = legacyIds.get(synapse.fromNeuronId);
    const toId = legacyIds.get(synapse.toNeuronId);
    if (!fromId || !toId) continue;
    await connectNodes(fromId, toId, legacyEdgeType(synapse.relation), {
      contextualBrain: true,
      synapseId: synapse.id,
      relation: synapse.relation,
      reason: synapse.reason,
      confidence: synapse.confidence,
      evidenceIds: synapse.evidenceIds,
      evidence: synapse.evidence,
      source: "brian_contextual_pipeline",
    } as Prisma.InputJsonValue);
  }
}

export async function publishBrianImpulse(
  impulse: BrianImpulseEnvelope,
  options: PublishBrianImpulseOptions = {},
) {
  const result = processBrianImpulse(impulse, { applyRbac: options.applyRbac ?? false });
  if (options.shadowMode ?? true) {
    await persistShadowAudit(result);
  }
  if (options.projectToLegacyBrain) {
    await projectToLegacyBrain(result);
  }
  return result;
}

