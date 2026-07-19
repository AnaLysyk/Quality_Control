import { buildBrianContextSummary } from "./contextBuilder";
import { sanitizeBrianImpulse, validateBrianImpulseContract } from "./governance";
import { buildBrianIdempotencyKey, createBrianDeadLetterImpulse } from "./outbox";
import { processBrianImpulse } from "./pipeline";
import { applyBrianQualityGates, BRIAN_MIN_TRUSTED_NEURON_SCORE } from "./quality";
import { stableId } from "./normalizer";
import type {
  BrianActivityResult,
  BrianAnswerTrace,
  BrianImpulseEnvelope,
  BrianProcessingResult,
  BrianSemanticTelemetryEvent,
  BrianWorkflowResult,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

function activity<T>(input: {
  name: string;
  impulseId: string;
  retryable?: boolean;
  run: () => T;
}): { value?: T; result: BrianActivityResult } {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  try {
    const value = input.run();
    const finished = Date.now();
    return {
      value,
      result: {
        success: true,
        status: "success",
        activity: input.name,
        impulseId: input.impulseId,
        startedAt,
        finishedAt: new Date(finished).toISOString(),
        durationMs: finished - started,
        output: typeof value === "object" ? { ok: true } : value,
        retryable: false,
      },
    };
  } catch (error) {
    const finished = Date.now();
    return {
      result: {
        success: false,
        status: "failed",
        activity: input.name,
        impulseId: input.impulseId,
        startedAt,
        finishedAt: new Date(finished).toISOString(),
        durationMs: finished - started,
        error: error instanceof Error ? error.message : String(error),
        retryable: input.retryable ?? true,
      },
    };
  }
}

function telemetry(
  name: BrianSemanticTelemetryEvent["name"],
  attributes: BrianSemanticTelemetryEvent["attributes"],
): BrianSemanticTelemetryEvent {
  return { name, timestamp: nowIso(), attributes };
}

function assertPolicy(decision: ReturnType<typeof validateBrianImpulseContract>) {
  if (!decision.allowed) throw new Error(decision.reason);
  return decision;
}

export function runBrianWorkflow(
  impulse: BrianImpulseEnvelope,
  options?: { applyRbac?: boolean; minQualityScore?: number },
): BrianWorkflowResult {
  const workflowId = stableId("brian_workflow", [impulse.id, impulse.type, impulse.subject]);
  const activities: BrianActivityResult[] = [];
  const telemetryEvents: BrianSemanticTelemetryEvent[] = [
    telemetry("brian.impulse.received", {
      impulseId: impulse.id,
      type: impulse.type,
      source: impulse.source,
      subject: impulse.subject,
      companyId: impulse.context.companyId ?? null,
      companySlug: impulse.context.companySlug ?? null,
      moduleKey: impulse.context.moduleKey ?? null,
      role: impulse.context.role,
    }),
  ];

  let currentImpulse = impulse;
  const idempotencyKey = buildBrianIdempotencyKey(impulse);

  const sanitized = activity({
    name: "sanitizePayload",
    impulseId: impulse.id,
    retryable: false,
    run: () => sanitizeBrianImpulse(currentImpulse),
  });
  activities.push(sanitized.result);
  if (!sanitized.result.success || !sanitized.value) {
    const deadLetter = createBrianDeadLetterImpulse({ impulse, error: sanitized.result.error ?? "sanitize failed" });
    telemetryEvents.push(telemetry("brian.workflow.failed", { impulseId: impulse.id, reason: deadLetter.errorMessage }));
    return { success: false, workflowId, impulseId: impulse.id, idempotencyKey, activities, deadLetter, telemetry: telemetryEvents };
  }
  currentImpulse = sanitized.value.impulse;
  if (sanitized.value.report.blockedFields.length || sanitized.value.report.redactedFields.length || sanitized.value.report.maskedFields.length) {
    telemetryEvents.push(telemetry("brian.redaction.applied", {
      impulseId: impulse.id,
      blockedFields: sanitized.value.report.blockedFields.length,
      redactedFields: sanitized.value.report.redactedFields.length,
      maskedFields: sanitized.value.report.maskedFields.length,
      promptInjectionSignals: sanitized.value.report.promptInjectionSignals.length,
    }));
  }

  const validated = activity({
    name: "validateImpulse",
    impulseId: impulse.id,
    retryable: false,
    run: () => assertPolicy(validateBrianImpulseContract(currentImpulse)),
  });
  activities.push(validated.result);
  if (!validated.result.success) {
    const deadLetter = createBrianDeadLetterImpulse({ impulse: currentImpulse, error: validated.result.error ?? "contract invalid" });
    telemetryEvents.push(telemetry("brian.workflow.failed", { impulseId: currentImpulse.id, reason: deadLetter.errorMessage }));
    return { success: false, workflowId, impulseId: currentImpulse.id, idempotencyKey, activities, deadLetter, telemetry: telemetryEvents };
  }

  const processed = activity<BrianProcessingResult>({
    name: "processBrainImpulse",
    impulseId: currentImpulse.id,
    run: () => processBrianImpulse(currentImpulse, { applyRbac: options?.applyRbac }),
  });
  activities.push(processed.result);
  if (!processed.result.success || !processed.value) {
    const deadLetter = createBrianDeadLetterImpulse({ impulse: currentImpulse, error: processed.result.error ?? "processing failed" });
    telemetryEvents.push(telemetry("brian.workflow.failed", { impulseId: currentImpulse.id, reason: deadLetter.errorMessage }));
    return { success: false, workflowId, impulseId: currentImpulse.id, idempotencyKey, activities, deadLetter, telemetry: telemetryEvents };
  }

  const qualityChecked = activity<BrianProcessingResult>({
    name: "applyQualityGates",
    impulseId: currentImpulse.id,
    retryable: false,
    run: () => applyBrianQualityGates(processed.value!, options?.minQualityScore ?? BRIAN_MIN_TRUSTED_NEURON_SCORE),
  });
  activities.push(qualityChecked.result);
  if (!qualityChecked.result.success || !qualityChecked.value) {
    const deadLetter = createBrianDeadLetterImpulse({ impulse: currentImpulse, error: qualityChecked.result.error ?? "quality gate failed" });
    telemetryEvents.push(telemetry("brian.workflow.failed", { impulseId: currentImpulse.id, reason: deadLetter.errorMessage }));
    return { success: false, workflowId, impulseId: currentImpulse.id, idempotencyKey, activities, deadLetter, telemetry: telemetryEvents };
  }

  const summarized = activity({
    name: "buildContextSummary",
    impulseId: currentImpulse.id,
    retryable: false,
    run: () => buildBrianContextSummary(qualityChecked.value!),
  });
  activities.push(summarized.result);

  telemetryEvents.push(
    telemetry("brian.impulse.processed", {
      impulseId: currentImpulse.id,
      neuronCount: qualityChecked.value.neurons.length,
      synapseCount: qualityChecked.value.synapses.length,
      evidenceCount: qualityChecked.value.evidences.length,
      projectionCount: qualityChecked.value.projections.length,
    }),
    telemetry("brian.context.built", {
      impulseId: currentImpulse.id,
      contextSize: typeof summarized.value === "string" ? summarized.value.length : 0,
      snapshotId: qualityChecked.value.snapshot.id,
    }),
  );

  for (const activation of qualityChecked.value.activations) {
    telemetryEvents.push(telemetry("brian.neuron.activated", {
      impulseId: currentImpulse.id,
      neuronId: activation.neuronId,
      activationScore: activation.activationScore,
    }));
  }
  for (const synapse of qualityChecked.value.synapses) {
    telemetryEvents.push(telemetry("brian.synapse.created", {
      impulseId: currentImpulse.id,
      synapseId: synapse.id,
      confidence: synapse.confidence,
      relation: synapse.relation,
    }));
  }

  return {
    success: true,
    workflowId,
    impulseId: currentImpulse.id,
    idempotencyKey,
    activities,
    processing: {
      ...qualityChecked.value,
      redactions: sanitized.value.report,
    },
    telemetry: telemetryEvents,
  };
}

export function buildBrianAnswerTrace(input: {
  answerId?: string;
  question: string;
  result: BrianProcessingResult;
  blockedByPermission?: string[];
}): BrianAnswerTrace {
  return {
    answerId: input.answerId ?? stableId("brian_answer", [input.result.snapshot.id, input.question]),
    userId: input.result.snapshot.userId,
    question: input.question,
    contextSnapshotId: input.result.snapshot.id,
    usedNeuronIds: input.result.snapshot.activeNeuronIds,
    usedSynapseIds: input.result.snapshot.activeSynapseIds,
    usedEvidenceIds: input.result.snapshot.evidenceIds,
    blockedByPermission: input.blockedByPermission ?? [],
    createdAt: nowIso(),
  };
}

