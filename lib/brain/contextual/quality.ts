import type {
  BrianActivation,
  BrianNeuron,
  BrianNeuronQualityScore,
  BrianProcessingResult,
  BrianQualityGateReport,
  BrianSynapse,
} from "./types";

export const BRIAN_MIN_TRUSTED_NEURON_SCORE = 70;
export const BRIAN_REVIEW_NEURON_SCORE = 85;

function hasText(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0;
}

export function scoreBrianNeuronQuality(input: {
  neuron: BrianNeuron;
  synapses: BrianSynapse[];
  activations: BrianActivation[];
}): BrianNeuronQualityScore {
  const relatedSynapses = input.synapses.filter(
    (synapse) => synapse.fromNeuronId === input.neuron.id || synapse.toNeuronId === input.neuron.id,
  );
  const activation = input.activations.find((item) => item.neuronId === input.neuron.id);
  const hasTitle = hasText(input.neuron.label);
  const hasContext = Object.values(input.neuron.context).some((value) => hasText(value));
  const hasEvidence = relatedSynapses.some((synapse) => synapse.evidenceIds.length > 0);
  const hasNarrative =
    hasText(input.neuron.narrative.short)
    && hasText(input.neuron.narrative.detailed)
    && hasText(input.neuron.narrative.whyThisExists);
  const hasRelations = relatedSynapses.length > 0;
  const hasPermissionRule =
    Boolean(input.neuron.visibility.allowedRoles?.length)
    || Boolean(input.neuron.visibility.requiredPermissions?.length)
    || Boolean(input.neuron.visibility.companyIds?.length)
    || Boolean(input.neuron.visibility.companySlugs?.length);
  const hasRecentActivation = Boolean(activation?.createdAt || input.neuron.memory.lastActivatedAt);

  const checks = [
    hasTitle,
    hasContext,
    hasEvidence,
    hasNarrative,
    hasRelations,
    hasPermissionRule,
    hasRecentActivation,
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return {
    neuronId: input.neuron.id,
    hasTitle,
    hasContext,
    hasEvidence,
    hasNarrative,
    hasRelations,
    hasPermissionRule,
    hasRecentActivation,
    state: input.neuron.memory.state,
    score,
  };
}

export function buildBrianQualityGateReport(result: BrianProcessingResult, minScore = BRIAN_MIN_TRUSTED_NEURON_SCORE): BrianQualityGateReport {
  const scores = result.neurons.map((neuron) => scoreBrianNeuronQuality({
    neuron,
    synapses: result.synapses,
    activations: result.activations,
  }));
  const acceptedNeuronIds = scores.filter((item) => item.score >= minScore).map((item) => item.neuronId);
  const reviewNeuronIds = scores
    .filter((item) => item.score >= minScore && item.score < BRIAN_REVIEW_NEURON_SCORE)
    .map((item) => item.neuronId);
  const rejectedNeuronIds = scores.filter((item) => item.score < minScore).map((item) => item.neuronId);
  const warnings = [
    ...rejectedNeuronIds.map((id) => `NeurÃ´nio bloqueado pelo quality gate: ${id}`),
    ...reviewNeuronIds.map((id) => `NeurÃ´nio aceito com revisÃ£o recomendada: ${id}`),
  ];

  return {
    minScore,
    acceptedNeuronIds,
    rejectedNeuronIds,
    reviewNeuronIds,
    scores,
    warnings,
  };
}

export function applyBrianQualityGates(result: BrianProcessingResult, minScore = BRIAN_MIN_TRUSTED_NEURON_SCORE): BrianProcessingResult {
  const quality = buildBrianQualityGateReport(result, minScore);
  const accepted = new Set(quality.acceptedNeuronIds);
  const visibleSynapses = result.synapses.filter(
    (synapse) => accepted.has(synapse.fromNeuronId) && accepted.has(synapse.toNeuronId),
  );
  const visibleSynapseIds = new Set(visibleSynapses.map((item) => item.id));

  return {
    ...result,
    neurons: result.neurons.filter((neuron) => accepted.has(neuron.id)),
    synapses: visibleSynapses,
    triples: result.triples.filter(
      (triple) => accepted.has(triple.subjectNeuronId) && accepted.has(triple.objectNeuronId),
    ),
    activations: result.activations.filter((activation) => accepted.has(activation.neuronId)),
    projections: result.projections.filter((projection) => accepted.has(projection.neuronId)),
    snapshot: {
      ...result.snapshot,
      activeNeuronIds: result.snapshot.activeNeuronIds.filter((id) => accepted.has(id)),
      activeSynapseIds: result.snapshot.activeSynapseIds.filter((id) => visibleSynapseIds.has(id)),
    },
    quality,
    warnings: [...result.warnings, ...quality.warnings],
  };
}

export function explainQualityScore(score: BrianNeuronQualityScore) {
  const missing = [
    !score.hasTitle ? "tÃ­tulo" : null,
    !score.hasContext ? "contexto" : null,
    !score.hasEvidence ? "evidÃªncia" : null,
    !score.hasNarrative ? "narrativa" : null,
    !score.hasRelations ? "relaÃ§Ãµes" : null,
    !score.hasPermissionRule ? "regra de permissÃ£o" : null,
    !score.hasRecentActivation ? "ativaÃ§Ã£o recente" : null,
  ].filter(Boolean);

  return missing.length
    ? `Score ${score.score}. Faltam: ${missing.join(", ")}.`
    : `Score ${score.score}. NeurÃ´nio pronto para projeÃ§Ã£o confiÃ¡vel.`;
}

