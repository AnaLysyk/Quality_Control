import { buildNeuralActivationFromImpulse } from "./activation";
import { sanitizeBrianImpulse, validateBrianImpulseContract } from "./governance";
import { normalizeContextCarrier, normalizeImpulseType, stableId } from "./normalizer";
import { generateImpulseNarrative, generateWhySeeingThis } from "./narrative";
import { applyBrianQualityGates } from "./quality";
import { filterBrianProcessingResultByRBAC } from "./rbac";
import type {
  BrianContextCarrier,
  BrianImpulseEnvelope,
  BrianNodeProjection,
  BrianProcessingResult,
  BrianTriple,
} from "./types";

function nodeTypeForImpulse(type: BrianImpulseEnvelope["type"]): BrianNodeProjection["nodeType"] {
  if (type.includes("failed")) return "failure";
  if (type.includes("created")) return "creation";
  if (type.includes("updated") || type.includes("status_changed")) return "update";
  if (type.includes("approved")) return "approval";
  if (type.includes("automation")) return "automation";
  if (type.includes("test_run")) return "execution";
  return "movement";
}

function statusForImpulse(type: BrianImpulseEnvelope["type"]): BrianNodeProjection["status"] {
  if (type.includes("failed") || type.includes("blocked")) return "danger";
  if (type.includes("reopened")) return "warning";
  if (type.includes("approved")) return "success";
  return "info";
}

function buildTriples(result: ReturnType<typeof buildNeuralActivationFromImpulse>): BrianTriple[] {
  const firstEvidence = result.evidences[0];
  return result.synapses.flatMap((synapse) => {
    const evidenceId = synapse.evidenceIds[0] ?? firstEvidence?.id;
    if (!evidenceId) return [];
    return [{
      subjectNeuronId: synapse.fromNeuronId,
      predicate: synapse.relation,
      objectNeuronId: synapse.toNeuronId,
      evidenceId,
      confidence: synapse.confidence,
    }];
  });
}

function buildProjections(result: ReturnType<typeof buildNeuralActivationFromImpulse>): BrianNodeProjection[] {
  const relationIdsByNeuron = new Map<string, string[]>();
  for (const synapse of result.synapses) {
    relationIdsByNeuron.set(synapse.fromNeuronId, [...(relationIdsByNeuron.get(synapse.fromNeuronId) ?? []), synapse.id]);
    relationIdsByNeuron.set(synapse.toNeuronId, [...(relationIdsByNeuron.get(synapse.toNeuronId) ?? []), synapse.id]);
  }

  return result.neurons.map((neuron) => {
    const related = result.synapses.filter((synapse) => synapse.fromNeuronId === neuron.id || synapse.toNeuronId === neuron.id);
    return {
      id: stableId("projection", [neuron.id, result.impulse.id]),
      neuronId: neuron.id,
      impulseId: result.impulse.id,
      title: neuron.label,
      subtitle: `${neuron.kind} · ativado por ${result.impulse.actor.name}`,
      summary: neuron.context.summary ?? generateImpulseNarrative(result.impulse),
      explanation: `${neuron.narrative.whyThisExists} ${generateWhySeeingThis({ neuron, synapses: related, impulse: result.impulse })}`,
      nodeType: nodeTypeForImpulse(result.impulse.type),
      companyId: neuron.companyId ?? null,
      moduleKey: neuron.moduleKey ?? null,
      status: statusForImpulse(result.impulse.type),
      occurredAt: result.impulse.time,
      actorName: result.impulse.actor.name,
      entityLabel: neuron.label,
      relationIds: relationIdsByNeuron.get(neuron.id) ?? [],
      permissions: {
        canView: neuron.visibility.allowedRoles ?? [],
        canOpen: neuron.visibility.requiredPermissions ?? [],
        canAct: [],
      },
      actions: [
        { label: "Ver por que apareceu", action: "explain_neuron", targetId: neuron.id },
      ],
    };
  });
}

export function buildBrianImpulseEnvelope(input: {
  id?: string;
  type: string;
  source?: string | null;
  subject: string;
  schemaVersion?: number;
  time?: string | null;
  actor: { id?: string | null; name?: string | null; role?: string | null };
  context?: Partial<BrianContextCarrier>;
  data?: Record<string, unknown>;
}): BrianImpulseEnvelope {
  const context = normalizeContextCarrier({
    ...(input.context ?? {}),
    pathname: input.source ?? input.context?.pathname ?? "/",
    userId: input.actor.id ?? input.context?.userId ?? "anonymous",
    role: input.actor.role ?? input.context?.role ?? "company_user",
  });
  const type = normalizeImpulseType(input.type);
  return {
    id: input.id ?? stableId("impulse", [type, input.subject, input.time ?? new Date().toISOString()]),
    specversion: "brian.v1",
    schemaVersion: input.schemaVersion ?? 1,
    type,
    source: input.source ?? context.pathname,
    subject: input.subject,
    time: input.time ?? new Date().toISOString(),
    actor: {
      id: input.actor.id ?? "anonymous",
      name: input.actor.name ?? "Usuário",
      role: input.actor.role ?? context.role,
    },
    context,
    data: sanitizeBrianImpulse({
      id: "sanitize_preview",
      specversion: "brian.v1",
      schemaVersion: input.schemaVersion ?? 1,
      type,
      source: input.source ?? context.pathname,
      subject: input.subject,
      time: input.time ?? new Date().toISOString(),
      actor: {
        id: input.actor.id ?? "anonymous",
        name: input.actor.name ?? "UsuÃ¡rio",
        role: input.actor.role ?? context.role,
      },
      context,
      data: input.data ?? {},
    }).impulse.data,
  };
}

export function processBrianImpulse(
  impulse: BrianImpulseEnvelope,
  options?: { applyRbac?: boolean; applyQualityGates?: boolean; enforceContract?: boolean; minQualityScore?: number },
): BrianProcessingResult {
  const sanitized = sanitizeBrianImpulse(impulse);
  const safeImpulse = sanitized.impulse;
  const contract = validateBrianImpulseContract(safeImpulse);
  if (options?.enforceContract && !contract.allowed) {
    throw new Error(contract.reason);
  }
  const activation = buildNeuralActivationFromImpulse(safeImpulse);
  const triples = buildTriples(activation);
  const projections = buildProjections(activation);
  const snapshot = {
    id: stableId("snapshot", [safeImpulse.context.userId, safeImpulse.context.sessionId, safeImpulse.id]),
    userId: safeImpulse.context.userId,
    companyId: safeImpulse.context.companyId ?? null,
    companySlug: safeImpulse.context.companySlug ?? null,
    moduleKey: safeImpulse.context.moduleKey ?? null,
    route: safeImpulse.context.pathname,
    activeNeuronIds: activation.activations.map((item) => item.neuronId),
    activeSynapseIds: activation.synapses.map((item) => item.id),
    recentImpulseIds: [safeImpulse.id],
    evidenceIds: activation.evidences.map((item) => item.id),
    permissions: safeImpulse.context.permissions,
    createdAt: new Date().toISOString(),
  };

  const result: BrianProcessingResult = {
    impulse: safeImpulse,
    evidences: activation.evidences,
    neurons: activation.neurons,
    synapses: activation.synapses,
    triples,
    activations: activation.activations,
    projections,
    snapshot,
    narrative: generateImpulseNarrative(safeImpulse),
    warnings: [
      ...activation.warnings,
      ...(contract.allowed ? [] : [`Contrato em modo permissivo: ${contract.reason}`]),
      ...sanitized.report.promptInjectionSignals.map((field) => `Prompt firewall sinalizou conteúdo externo em ${field}.`),
    ],
    redactions: sanitized.report,
  };

  const qualityResult = options?.applyQualityGates === false
    ? result
    : applyBrianQualityGates(result, options?.minQualityScore);
  return options?.applyRbac === false ? qualityResult : filterBrianProcessingResultByRBAC(qualityResult);
}
