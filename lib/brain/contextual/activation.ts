import { findAllowedRelation, resolveActivationPolicy } from "./contracts";
import { extractEvidenceFromImpulse, evidenceConfidence, findEvidenceForField } from "./evidence";
import { canonicalNeuronId, normalizeEntity, normalizeText, stableId } from "./normalizer";
import { generateImpulseNarrative, generateNeuronNarrative } from "./narrative";
import type {
  BrianActivation,
  BrianEvidence,
  BrianImpulseEnvelope,
  BrianNeuron,
  BrianNeuronKind,
  BrianSynapse,
  BrianSynapseRelation,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

function subjectParts(subject: string) {
  const [rawType, ...rest] = subject.split("/");
  return {
    type: rawType || "ticket",
    id: rest.join("/") || subject,
  };
}

function fieldString(data: Record<string, unknown>, ...fields: string[]) {
  for (const field of fields) {
    const value = data[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function entityKindFromImpulse(impulse: BrianImpulseEnvelope): BrianNeuronKind {
  const explicit = fieldString(impulse.data, "entityType", "type", "kind");
  const subject = subjectParts(impulse.subject);
  return normalizeEntity({ type: explicit ?? subject.type, id: subject.id }).canonicalType;
}

function defaultVisibility(impulse: BrianImpulseEnvelope) {
  return {
    companyIds: impulse.context.companyId ? [impulse.context.companyId] : [],
    companySlugs: impulse.context.companySlug ? [impulse.context.companySlug] : [],
    allowedRoles: ["admin", "global_admin", "leader_tc", "technical_support", "testing_company_user"],
    requiredPermissions: [],
  };
}

function createNeuron(input: {
  kind: BrianNeuronKind;
  label: string;
  entityId: string;
  impulse: BrianImpulseEnvelope;
  evidences: BrianEvidence[];
  description?: string | null;
  aliases?: string[];
  context?: BrianNeuron["context"];
}): BrianNeuron {
  const id = canonicalNeuronId(input.kind, input.entityId, input.impulse.context.companyId ?? input.impulse.context.companySlug);
  const narrative = generateNeuronNarrative({
    neuron: {
      label: input.label,
      kind: input.kind,
      context: input.context ?? {},
    },
    impulse: input.impulse,
    evidences: input.evidences,
  });
  return {
    id,
    kind: input.kind,
    label: input.label,
    description: input.description ?? undefined,
    companyId: input.impulse.context.companyId ?? null,
    companySlug: input.impulse.context.companySlug ?? null,
    moduleKey: input.impulse.context.moduleKey ?? null,
    entityType: input.kind,
    entityId: input.entityId,
    aliases: [...new Set([...(input.aliases ?? []), input.label].filter(Boolean))],
    context: {
      origin: input.impulse.source,
      lastRelevantMovement: input.impulse.type,
      ...input.context,
    },
    memory: {
      createdAt: input.impulse.time,
      updatedAt: input.impulse.time,
      lastActivatedAt: input.impulse.time,
      activationCount: 1,
      lastImpulseIds: [input.impulse.id],
      state: "active",
    },
    visibility: defaultVisibility(input.impulse),
    narrative,
  };
}

function inferFlowNeuron(impulse: BrianImpulseEnvelope, evidences: BrianEvidence[]) {
  const description = fieldString(impulse.data, "description", "reason", "summary")?.toLowerCase() ?? "";
  const candidates = [
    { needle: "cadastro", label: "Fluxo de cadastro" },
    { needle: "cep", label: "Fluxo de cadastro / CEP" },
    { needle: "login", label: "Fluxo de login" },
    { needle: "email", label: "Fluxo de e-mail" },
    { needle: "pagamento", label: "Fluxo de pagamento" },
    { needle: "regress", label: "Fluxo de regressÃ£o" },
  ];
  const match = candidates.find((candidate) => description.includes(candidate.needle));
  if (!match) return null;
  return createNeuron({
    kind: "flow",
    label: match.label,
    entityId: match.label,
    impulse,
    evidences,
    context: {
      summary: `Fluxo inferido do texto do impulso ${impulse.type}.`,
      technicalImpact: "InferÃªncia textual com confianÃ§a mÃ©dia; precisa de evidÃªncia explÃ­cita para virar fato forte.",
    },
  });
}

function createSynapse(input: {
  from: BrianNeuron;
  to: BrianNeuron;
  relation: BrianSynapseRelation;
  impulse: BrianImpulseEnvelope;
  evidence: BrianEvidence | null;
  reason: string;
  weight?: number;
  confidence?: number;
  warnings: string[];
}): BrianSynapse | null {
  const allowed = findAllowedRelation(input.from.kind, input.relation, input.to.kind);
  if (!allowed) {
    input.warnings.push(`RelaÃ§Ã£o nÃ£o permitida pela ontologia: ${input.from.kind}.${input.relation}.${input.to.kind}`);
    return null;
  }
  if (allowed.requiredEvidence && !input.evidence) {
    input.warnings.push(`Sinapse bloqueada por falta de evidÃªncia: ${input.from.label} ${input.relation} ${input.to.label}`);
    return null;
  }
  const confidence = Math.max(0, Math.min(1, input.confidence ?? evidenceConfidence(input.evidence)));
  return {
    id: stableId("synapse", [input.from.id, input.relation, input.to.id, input.impulse.id]),
    fromNeuronId: input.from.id,
    toNeuronId: input.to.id,
    relation: input.relation,
    weight: Math.max(0, Math.min(1, input.weight ?? confidence)),
    confidence,
    reason: input.reason,
    evidenceIds: input.evidence ? [input.evidence.id] : [],
    evidence: {
      eventId: input.impulse.id,
      sourceRoute: input.impulse.source,
      sourceEntity: input.impulse.subject,
      createdAt: input.impulse.time,
    },
  };
}

function dedupeNeurons(neurons: BrianNeuron[]) {
  const byId = new Map<string, BrianNeuron>();
  for (const neuron of neurons) byId.set(neuron.id, neuron);
  return [...byId.values()];
}

function dedupeSynapses(synapses: BrianSynapse[]) {
  const byId = new Map<string, BrianSynapse>();
  for (const synapse of synapses) byId.set(synapse.id, synapse);
  return [...byId.values()];
}

function statusFromImpulse(impulse: BrianImpulseEnvelope): BrianNeuron["context"]["currentStatus"] {
  return fieldString(impulse.data, "status", "toStatus", "priority", "severity") ?? undefined;
}

export function buildNeuralActivationFromImpulse(impulse: BrianImpulseEnvelope) {
  const evidences = extractEvidenceFromImpulse(impulse);
  const warnings: string[] = [];
  const subject = subjectParts(impulse.subject);
  const entityKind = entityKindFromImpulse(impulse);
  const entity = normalizeEntity({
    type: entityKind,
    id: fieldString(impulse.data, "entityId", "id") ?? subject.id,
    title: fieldString(impulse.data, "title", "label", "name") ?? impulse.subject,
    sourceModule: impulse.context.moduleKey ?? entityKind,
  });

  const entityNeuron = createNeuron({
    kind: entity.canonicalType,
    label: entity.title,
    entityId: entity.entityId,
    impulse,
    evidences,
    description: fieldString(impulse.data, "description", "summary", "reason"),
    aliases: [entity.originalType, impulse.subject],
    context: {
      summary: generateImpulseNarrative(impulse),
      currentStatus: statusFromImpulse(impulse),
      businessImpact: fieldString(impulse.data, "businessImpact", "impact") ?? undefined,
      technicalImpact: fieldString(impulse.data, "technicalImpact") ?? undefined,
    },
  });

  const actorNeuron = createNeuron({
    kind: "user",
    label: impulse.actor.name || impulse.actor.id,
    entityId: impulse.actor.id,
    impulse,
    evidences,
    context: {
      summary: `Ator que gerou o impulso ${impulse.type}.`,
      currentStatus: impulse.actor.role,
    },
  });

  const neurons: BrianNeuron[] = [entityNeuron, actorNeuron];

  const companyLabel = impulse.context.companySlug ?? impulse.context.companyId;
  if (companyLabel) {
    neurons.push(createNeuron({
      kind: "company",
      label: companyLabel,
      entityId: impulse.context.companyId ?? companyLabel,
      impulse,
      evidences,
      context: { summary: `Empresa contextual do impulso ${impulse.type}.` },
    }));
  }

  if (impulse.context.applicationKey) {
    neurons.push(createNeuron({
      kind: "application",
      label: impulse.context.applicationKey,
      entityId: impulse.context.applicationKey,
      impulse,
      evidences,
      context: { summary: `AplicaÃ§Ã£o contextual da rota ${impulse.context.pathname}.` },
    }));
  }

  if (impulse.context.moduleKey) {
    neurons.push(createNeuron({
      kind: "module",
      label: impulse.context.moduleKey,
      entityId: impulse.context.moduleKey,
      impulse,
      evidences,
      context: { summary: `MÃ³dulo contextual da rota ${impulse.context.pathname}.` },
    }));
  }

  const release = fieldString(impulse.data, "release", "releaseId", "releaseSlug");
  if (release) {
    neurons.push(createNeuron({
      kind: "release",
      label: release,
      entityId: release,
      impulse,
      evidences,
      context: { summary: `Release informada no impulso ${impulse.type}.` },
    }));
  }

  const environment = fieldString(impulse.data, "environment", "env");
  if (environment) {
    neurons.push(createNeuron({
      kind: "environment",
      label: environment,
      entityId: environment,
      impulse,
      evidences,
      context: { summary: `Ambiente informado no impulso ${impulse.type}.` },
    }));
  }

  const flowNeuron = inferFlowNeuron(impulse, evidences);
  if (flowNeuron) neurons.push(flowNeuron);

  const uniqueNeurons = dedupeNeurons(neurons);
  const findKind = (kind: BrianNeuronKind) => uniqueNeurons.find((item) => item.kind === kind);
  const sourceEvidence = findEvidenceForField(evidences, "source");
  const actorEvidence = findEvidenceForField(evidences, "actor");
  const descriptionEvidence = findEvidenceForField(evidences, "description");
  const releaseEvidence = findEvidenceForField(evidences, "release");
  const environmentEvidence = findEvidenceForField(evidences, "environment");

  const synapses: BrianSynapse[] = [];
  const add = (from: BrianNeuron | undefined, relation: BrianSynapseRelation, to: BrianNeuron | undefined, evidence: BrianEvidence | null, reason: string, weight?: number) => {
    if (!from || !to) return;
    const synapse = createSynapse({ from, to, relation, impulse, evidence, reason, weight, warnings });
    if (synapse) synapses.push(synapse);
  };

  add(entityNeuron, "belongs_to", findKind("company"), sourceEvidence, `${entityNeuron.label} pertence Ã  empresa contextual do impulso.`, 0.9);
  add(entityNeuron, "belongs_to", findKind("module"), sourceEvidence, `${entityNeuron.label} pertence ao mÃ³dulo atual.`, 0.82);
  add(findKind("module"), "belongs_to", findKind("application"), sourceEvidence, "MÃ³dulo inferido da rota pertence Ã  aplicaÃ§Ã£o atual.", 0.76);
  add(findKind("application"), "belongs_to", findKind("company"), sourceEvidence, "AplicaÃ§Ã£o inferida da rota pertence Ã  empresa atual.", 0.76);

  const actorRelation: BrianSynapseRelation =
    impulse.type.includes("reopened") ? "reopened_by"
      : impulse.type.includes("approved") ? "approved_by"
        : impulse.type.includes("updated") || impulse.type.includes("status_changed") ? "updated_by"
          : "created_by";
  add(entityNeuron, actorRelation, actorNeuron, actorEvidence, `${impulse.actor.name} ativou ${entityNeuron.label} via ${impulse.type}.`, 0.9);
  add(entityNeuron, "linked_to", findKind("release"), releaseEvidence, `${entityNeuron.label} foi vinculado Ã  release informada.`, 0.78);
  add(entityNeuron, "failed_in", findKind("environment"), environmentEvidence, `${entityNeuron.label} falhou no ambiente informado.`, 0.78);
  add(entityNeuron, "impacts", findKind("flow"), descriptionEvidence, `${entityNeuron.label} impacta o fluxo inferido da descriÃ§Ã£o.`, 0.68);

  const policy = resolveActivationPolicy(impulse.context.role);
  const criticalTypes = new Set<BrianImpulseEnvelope["type"]>(["test_run.failed", "release.blocked"]);
  const highTypes = new Set<BrianImpulseEnvelope["type"]>(["defect.created", "ticket.reopened", "release.approved"]);
  const base = criticalTypes.has(impulse.type) ? 0.9 : highTypes.has(impulse.type) ? 0.75 : 0.58;
  const activations: BrianActivation[] = uniqueNeurons.map((neuron) => {
    const preferred = policy.preferredNeuronTypes.includes(neuron.kind) ? 0.15 : 0;
    const direct = neuron.id === entityNeuron.id ? 0.18 : 0;
    return {
      neuronId: neuron.id,
      activationScore: Math.min(1, base + preferred + direct),
      reason: neuron.id === entityNeuron.id
        ? `NeurÃ´nio principal ativado pelo impulso ${impulse.type}.`
        : `NeurÃ´nio conectado ativado por ${impulse.type}.`,
      impulseId: impulse.id,
      userId: impulse.context.userId,
      sessionId: impulse.context.sessionId,
      createdAt: nowIso(),
    };
  });

  return {
    impulse,
    evidences,
    neurons: uniqueNeurons,
    synapses: dedupeSynapses(synapses),
    activations,
    warnings,
  };
}

