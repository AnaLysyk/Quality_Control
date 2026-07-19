import type { BrianProcessingResult } from "./types";

export function buildBrianContextSummary(result: BrianProcessingResult) {
  const topNeurons = [...result.activations]
    .sort((left, right) => right.activationScore - left.activationScore)
    .slice(0, 6)
    .map((activation) => {
      const neuron = result.neurons.find((item) => item.id === activation.neuronId);
      return neuron ? `- ${neuron.label} (${neuron.kind}) · score ${activation.activationScore.toFixed(2)}` : null;
    })
    .filter(Boolean);

  const evidenceLines = result.evidences
    .filter((item) => item.excerpt)
    .slice(0, 4)
    .map((item) => `- ${item.sourceType}${item.field ? `/${item.field}` : ""}: ${item.excerpt}`);

  return [
    "## Contexto Brian",
    result.narrative,
    "",
    topNeurons.length ? "Neurônios ativados:" : "",
    ...topNeurons,
    "",
    evidenceLines.length ? "Evidências:" : "",
    ...evidenceLines,
    "",
    result.warnings.length ? "Avisos:" : "",
    ...result.warnings.map((warning) => `- ${warning}`),
  ].filter((line) => line !== "").join("\n");
}

