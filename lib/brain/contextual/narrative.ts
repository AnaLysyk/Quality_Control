import type { BrianEvidence, BrianImpulseEnvelope, BrianNeuron, BrianSynapse } from "./types";

function entityLabel(impulse: BrianImpulseEnvelope) {
  return String(impulse.data.title ?? impulse.data.label ?? impulse.subject);
}

function moduleLabel(impulse: BrianImpulseEnvelope) {
  return impulse.context.moduleKey ?? String(impulse.data.module ?? "mÃ³dulo nÃ£o informado");
}

function companyLabel(impulse: BrianImpulseEnvelope) {
  return impulse.context.companySlug ?? impulse.context.companyId ?? "empresa nÃ£o informada";
}

export function generateImpulseNarrative(impulse: BrianImpulseEnvelope): string {
  const actor = impulse.actor.name || "UsuÃ¡rio";
  const entity = entityLabel(impulse);
  const moduleName = moduleLabel(impulse);
  const company = companyLabel(impulse);

  switch (impulse.type) {
    case "defect.created":
      return `${actor} criou o defeito ${entity} no mÃ³dulo ${moduleName}, dentro de ${company}.`;
    case "defect.status_changed":
      return `${actor} alterou o status do defeito ${entity} no mÃ³dulo ${moduleName}.`;
    case "test_run.failed":
      return `A execuÃ§Ã£o ${entity} falhou no mÃ³dulo ${moduleName}, dentro de ${company}.`;
    case "automation.generated":
      return `${actor} gerou uma automaÃ§Ã£o relacionada a ${entity} no mÃ³dulo ${moduleName}.`;
    case "release.approved":
      return `${actor} aprovou a release ${entity} dentro de ${company}.`;
    case "release.blocked":
      return `${actor} bloqueou a release ${entity} dentro de ${company}.`;
    case "ticket.created":
      return `${actor} criou o chamado ${entity} dentro de ${company}.`;
    case "ticket.reopened":
      return `${actor} reabriu o chamado ${entity} dentro de ${company}.`;
    case "comment.added":
      return `${actor} adicionou comentÃ¡rio em ${entity}.`;
    case "file.attached":
      return `${actor} anexou arquivo em ${entity}.`;
    case "permission.granted":
      return `${actor} concedeu permissÃ£o relacionada a ${entity}.`;
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
  const proof = evidence?.excerpt ? ` EvidÃªncia: ${evidence.excerpt}` : "";
  return `Este neurÃ´nio existe porque o impulso ${input.impulse.type} ativou ${input.neuron.label} como contexto ${input.neuron.kind}.${proof}`;
}

export function generateNeuronNarrative(input: {
  neuron: Pick<BrianNeuron, "label" | "kind" | "context">;
  impulse: BrianImpulseEnvelope;
  evidences: BrianEvidence[];
}) {
  const short = `${input.neuron.label} Â· ${input.neuron.kind}`;
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
    input.impulse.context.moduleKey ? `mÃ³dulo ${input.impulse.context.moduleKey}` : null,
    `${input.synapses.length} sinapse${input.synapses.length === 1 ? "" : "s"} com evidÃªncia`,
    `Ãºltimo impulso ${input.impulse.type}`,
  ].filter(Boolean);
  return `VocÃª estÃ¡ vendo ${input.neuron.label} porque: ${reasons.join("; ")}.`;
}

