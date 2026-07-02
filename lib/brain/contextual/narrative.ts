import type { BrianEvidence, BrianImpulseEnvelope, BrianNeuron, BrianSynapse } from "./types";

function entityLabel(impulse: BrianImpulseEnvelope) {
  return String(impulse.data.title ?? impulse.data.label ?? impulse.subject);
}

function moduleLabel(impulse: BrianImpulseEnvelope) {
  return impulse.context.moduleKey ?? String(impulse.data.module ?? "módulo não informado");
}

function companyLabel(impulse: BrianImpulseEnvelope) {
  return impulse.context.companySlug ?? impulse.context.companyId ?? "empresa não informada";
}

export function generateImpulseNarrative(impulse: BrianImpulseEnvelope): string {
  const actor = impulse.actor.name || "Usuário";
  const entity = entityLabel(impulse);
  const moduleName = moduleLabel(impulse);
  const company = companyLabel(impulse);

  switch (impulse.type) {
    case "defect.created":
      return `${actor} criou o defeito ${entity} no módulo ${moduleName}, dentro de ${company}.`;
    case "defect.status_changed":
      return `${actor} alterou o status do defeito ${entity} no módulo ${moduleName}.`;
    case "test_run.failed":
      return `A execução ${entity} falhou no módulo ${moduleName}, dentro de ${company}.`;
    case "automation.generated":
      return `${actor} gerou uma automação relacionada a ${entity} no módulo ${moduleName}.`;
    case "release.approved":
      return `${actor} aprovou a release ${entity} dentro de ${company}.`;
    case "release.blocked":
      return `${actor} bloqueou a release ${entity} dentro de ${company}.`;
    case "ticket.created":
      return `${actor} criou o chamado ${entity} dentro de ${company}.`;
    case "ticket.reopened":
      return `${actor} reabriu o chamado ${entity} dentro de ${company}.`;
    case "comment.added":
      return `${actor} adicionou comentário em ${entity}.`;
    case "file.attached":
      return `${actor} anexou arquivo em ${entity}.`;
    case "permission.granted":
      return `${actor} concedeu permissão relacionada a ${entity}.`;
    default:
      return `${actor} realizou ${impulse.type} em ${entity}.`;
  }
}

export function generateWhyNeuronExists(input: {
  neuron: Pick<BrianNeuron, "label" | "kind">;
  impulse: BrianImpulseEnvelope;
  evidences: BrianEvidence[];
}) {
  const evidence = input.evidences.find((item) => item.excerpt) ?? input.evidences[0];
  const proof = evidence?.excerpt ? ` Evidência: ${evidence.excerpt}` : "";
  return `Este neurônio existe porque o impulso ${input.impulse.type} ativou ${input.neuron.label} como contexto ${input.neuron.kind}.${proof}`;
}

export function generateNeuronNarrative(input: {
  neuron: Pick<BrianNeuron, "label" | "kind" | "context">;
  impulse: BrianImpulseEnvelope;
  evidences: BrianEvidence[];
}) {
  const short = `${input.neuron.label} · ${input.neuron.kind}`;
  const detailed = [
    generateImpulseNarrative(input.impulse),
    input.neuron.context.summary ?? "",
  ].filter(Boolean).join(" ");
  return {
    short,
    detailed,
    whyThisExists: generateWhyNeuronExists({ neuron: input.neuron, impulse: input.impulse, evidences: input.evidences }),
  };
}

export function generateWhySeeingThis(input: {
  neuron: BrianNeuron;
  synapses: BrianSynapse[];
  impulse: BrianImpulseEnvelope;
}) {
  const reasons = [
    `perfil ${input.impulse.context.role}`,
    input.impulse.context.companySlug ? `empresa ${input.impulse.context.companySlug}` : null,
    input.impulse.context.moduleKey ? `módulo ${input.impulse.context.moduleKey}` : null,
    `${input.synapses.length} sinapse${input.synapses.length === 1 ? "" : "s"} com evidência`,
    `último impulso ${input.impulse.type}`,
  ].filter(Boolean);
  return `Você está vendo ${input.neuron.label} porque: ${reasons.join("; ")}.`;
}

