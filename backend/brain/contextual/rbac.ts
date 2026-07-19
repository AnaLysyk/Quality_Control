import type { BrianContextCarrier, BrianNeuron, BrianProcessingResult, BrianSynapse } from "./types";

const BROAD_ROLES = new Set(["admin", "global_admin", "technical_support"]);

function normalize(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function hasIntersection(left?: string[], right?: string[]) {
  if (!left?.length || !right?.length) return false;
  const rightSet = new Set(right.map(normalize));
  return left.some((item) => rightSet.has(normalize(item)));
}

export function canSeeBrianNeuron(context: BrianContextCarrier, neuron: BrianNeuron) {
  const role = normalize(context.role);
  if (BROAD_ROLES.has(role)) return true;

  const allowedRoles = neuron.visibility.allowedRoles ?? [];
  const requiredPermissions = neuron.visibility.requiredPermissions ?? [];
  const companyId = normalize(context.companyId);
  const companySlug = normalize(context.companySlug);
  const neuronCompanyIds = (neuron.visibility.companyIds ?? []).map(normalize);
  const neuronCompanySlugs = (neuron.visibility.companySlugs ?? []).map(normalize);
  const hasCompanyRestriction = neuronCompanyIds.length > 0 || neuronCompanySlugs.length > 0;
  const companyMatches =
    (companyId.length > 0 && neuronCompanyIds.includes(companyId)) ||
    (companySlug.length > 0 && neuronCompanySlugs.includes(companySlug));

  if (hasCompanyRestriction && !companyMatches) return false;
  if (allowedRoles.length > 0 && allowedRoles.map(normalize).includes(role)) return true;
  if (requiredPermissions.length > 0 && hasIntersection(requiredPermissions, context.permissions)) return true;

  if (companyMatches) return true;

  return !neuronCompanyIds.length && !neuronCompanySlugs.length && !requiredPermissions.length;
}

export function filterSynapsesByVisibleNeurons(synapses: BrianSynapse[], visibleNeurons: BrianNeuron[]) {
  const visibleIds = new Set(visibleNeurons.map((item) => item.id));
  return synapses.filter((item) => visibleIds.has(item.fromNeuronId) && visibleIds.has(item.toNeuronId));
}

export function filterBrianProcessingResultByRBAC(result: BrianProcessingResult): BrianProcessingResult {
  const visibleNeurons = result.neurons.filter((neuron) => canSeeBrianNeuron(result.impulse.context, neuron));
  const visibleSynapses = filterSynapsesByVisibleNeurons(result.synapses, visibleNeurons);
  const visibleNeuronIds = new Set(visibleNeurons.map((item) => item.id));
  const visibleSynapseIds = new Set(visibleSynapses.map((item) => item.id));
  return {
    ...result,
    neurons: visibleNeurons,
    synapses: visibleSynapses,
    triples: result.triples.filter(
      (item) => visibleNeuronIds.has(item.subjectNeuronId) && visibleNeuronIds.has(item.objectNeuronId),
    ),
    activations: result.activations.filter((item) => visibleNeuronIds.has(item.neuronId)),
    projections: result.projections.filter((item) => visibleNeuronIds.has(item.neuronId)),
    snapshot: {
      ...result.snapshot,
      activeNeuronIds: result.snapshot.activeNeuronIds.filter((id) => visibleNeuronIds.has(id)),
      activeSynapseIds: result.snapshot.activeSynapseIds.filter((id) => visibleSynapseIds.has(id)),
    },
  };
}
