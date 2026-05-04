"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiArrowDown,
  FiArrowUp,
  FiCheckCircle,
  FiClock,
  FiCode,
  FiCopy,
  FiDatabase,
  FiEye,
  FiFolderPlus,
  FiGitBranch,
  FiLayers,
  FiPauseCircle,
  FiPlay,
  FiPlus,
  FiRefreshCw,
  FiRotateCcw,
  FiSave,
  FiShield,
  FiShuffle,
  FiTrash2,
  FiUploadCloud,
  FiX,
  FiZap,
} from "react-icons/fi";

import {
  AUTOMATION_STUDIO_ACTION_LIBRARY,
  AUTOMATION_STUDIO_ASSETS,
  AUTOMATION_STUDIO_BLUEPRINTS,
  AUTOMATION_STUDIO_SCRIPT_API,
  AUTOMATION_STUDIO_SCRIPT_TEMPLATES,
  AUTOMATION_STUDIO_SUBFLOW_LIBRARY,
  AUTOMATION_STUDIO_TRIGGER_MODES,
  type AutomationStudioActionPreset,
  type AutomationStudioBlueprint,
  type AutomationStudioRunnerType,
  type AutomationStudioScriptTemplate,
  type AutomationStudioStepKind,
  type AutomationStudioStepTemplate,
  type AutomationStudioSubflowTemplate,
  type AutomationStudioTriggerMode,
} from "@/data/automationStudio";
import { AUTOMATION_ENVIRONMENTS } from "@/data/automationCatalog";
import { isTestingCompanyScope, matchesAutomationCompanyScope, normalizeAutomationCompanyScope } from "@/lib/automations/companyScope";

type CompanyOption = {
  name: string;
  slug: string;
};

type AutomationStudioAccess = {
  canConfigure: boolean;
  canManageFlows: boolean;
  canViewTechnicalLogs: boolean;
  helperText: string;
  profileLabel: string;
  scopeLabel: string;
  visibilityLabel: string;
};

type FlowDefinition = AutomationStudioBlueprint & {
  companySlug?: string;
  createdAt?: string;
  source: "catalog" | "custom";
  templateId?: string;
  updatedAt?: string;
};

type FlowVariable = {
  description: string;
  id: string;
  key: string;
  scope: "global" | "local";
  source: "manual" | "environment" | "step_output" | "api" | "csv" | "database";
  value: string;
};

type FlowTriggerConfig = {
  enabled: boolean;
  eventName: string;
  mode: AutomationStudioTriggerMode;
  requireApproval: boolean;
  cron: string;
  watchPath: string;
  webhookPath: string;
};

type FlowRuntimeConfig = {
  allowProductionWrite: boolean;
  debugMode: boolean;
  maxParallel: number;
  notifyOnFailure: boolean;
  retryAttempts: number;
  retryBackoffMs: number;
  simulationMode: "safe" | "step" | "full";
  uploadStrategy: "standard" | "stream" | "base64-stream";
};

type FlowVersion = {
  author: string;
  id: string;
  label: string;
  note: string;
  savedAt: string;
  script: string;
  status: "active" | "inactive";
  stepCount: number;
  triggerMode: AutomationStudioTriggerMode;
  variableCount: number;
};

type FlowAuditEntry = {
  actor: string;
  createdAt: string;
  id: string;
  summary: string;
};

type DraftStep = AutomationStudioStepTemplate & {
  approvalRole: string;
  condition: string;
  enabled: boolean;
  fallbackTarget: string;
  id: string;
  loopLimit: number;
  onError: "stop" | "continue" | "fallback";
  outputVariable: string;
  parallelKey: string;
  retryAttempts: number;
  retryBackoffMs: number;
  script: string;
  subflowId: string;
  timeoutMs: number;
};

type DraftUpload = {
  id: string;
  name: string;
  size: number;
  type: string;
};

type FlowDraft = {
  auditTrail: FlowAuditEntry[];
  base64Sample: string;
  boundAssetIds: string[];
  notes: string;
  script: string;
  scriptTemplateId: string;
  status: "active" | "inactive";
  steps: DraftStep[];
  trigger: FlowTriggerConfig;
  runtime: FlowRuntimeConfig;
  uploads: DraftUpload[];
  variables: FlowVariable[];
  versions: FlowVersion[];
};

type RunPreviewMetric = {
  detail: string;
  label: string;
  value: string;
};

type RunPreview = {
  generatedAt: string;
  lines: string[];
  metrics: RunPreviewMetric[];
  technicalLines: string[];
};

type Props = {
  access: AutomationStudioAccess;
  activeCompanySlug: string | null;
  companies: CompanyOption[];
  initialFlowId?: string | null;
  onOpenRealRunner: () => void;
  mode?: "flows" | "scripts" | "files" | "results";
};

const STORAGE_PREFIX = "qc:automation-studio:v3";
const MAX_STORED_VERSIONS = 12;
const BUILT_IN_FLOWS: FlowDefinition[] = AUTOMATION_STUDIO_BLUEPRINTS.map((flow) => ({
  ...flow,
  source: "catalog",
}));

function getVisibleBuiltInFlows(companySlug: string | null | undefined) {
  return BUILT_IN_FLOWS.filter((flow) => matchesAutomationCompanyScope(flow.companyScope, companySlug));
}
const DEFAULT_TRIGGER: FlowTriggerConfig = {
  cron: "0 8 * * 1-5",
  enabled: false,
  eventName: "automation.requested",
  mode: "manual",
  requireApproval: false,
  watchPath: "C:\\imports\\empresa",
  webhookPath: "/api/automations/webhook",
};
const DEFAULT_RUNTIME: FlowRuntimeConfig = {
  allowProductionWrite: false,
  debugMode: true,
  maxParallel: 2,
  notifyOnFailure: true,
  retryAttempts: 2,
  retryBackoffMs: 800,
  simulationMode: "step",
  uploadStrategy: "standard",
};

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function draftStorageKey(companySlug: string, flowId: string) {
  return `${STORAGE_PREFIX}:draft:${companySlug}:${flowId}`;
}

function customFlowsStorageKey(companySlug: string) {
  return `${STORAGE_PREFIX}:flows:${companySlug}`;
}

function readRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function nowLabel() {
  return new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}

function buildAuditEntry(actor: string, summary: string): FlowAuditEntry {
  return {
    actor,
    createdAt: nowLabel(),
    id: createClientId(),
    summary,
  };
}

function buildVersionSnapshot(actor: string, draft: FlowDraft, note: string): FlowVersion {
  return {
    author: actor,
    id: createClientId(),
    label: `v${draft.versions.length + 1}`,
    note,
    savedAt: nowLabel(),
    script: draft.script,
    status: draft.status,
    stepCount: draft.steps.length,
    triggerMode: draft.trigger.mode,
    variableCount: draft.variables.length,
  };
}

function defaultVariables(): FlowVariable[] {
  return [
    {
      description: "Empresa ativa da sessão.",
      id: createClientId(),
      key: "companySlug",
      scope: "global",
      source: "environment",
      value: "session.companySlug",
    },
    {
      description: "Ambiente selecionado para a execução.",
      id: createClientId(),
      key: "environmentId",
      scope: "global",
      source: "environment",
      value: "environment.id",
    },
  ];
}

function buildStepScript(step: AutomationStudioStepTemplate) {
  return `step("${step.kind}", {\n  selector: "${step.selector}",\n  binding: "${step.inputBinding}",\n  expected: "${step.expectedResult}",\n});`;
}

function toDraftStep(step: AutomationStudioStepTemplate): DraftStep {
  return {
    ...step,
    approvalRole: "analista-qa",
    condition: "",
    enabled: true,
    fallbackTarget: "",
    id: createClientId(),
    loopLimit: 3,
    onError: "stop",
    outputVariable: "",
    parallelKey: "",
    retryAttempts: 1,
    retryBackoffMs: 0,
    script: buildStepScript(step),
    subflowId: "",
    timeoutMs: 5000,
  };
}

function createBlankStep(): DraftStep {
  return toDraftStep({
    description: "Etapa em branco para começar um novo fluxo do zero.",
    expectedResult: "Resultado esperado definido pelo analista.",
    inputBinding: "payload.value",
    kind: "custom_script",
    selector: "stepContext",
    title: "Nova etapa",
  });
}

function buildDefaultDraft(flow: FlowDefinition, access: AutomationStudioAccess): FlowDraft {
  return {
    auditTrail: [buildAuditEntry(access.profileLabel, `Fluxo base ${flow.title} preparado no studio.`)],
    base64Sample: "",
    boundAssetIds: AUTOMATION_STUDIO_ASSETS.filter((asset) => asset.flowIds.includes(flow.id))
      .slice(0, 2)
      .map((asset) => asset.id),
    notes: flow.defaultNotes,
    script: flow.defaultScript,
    scriptTemplateId: "blank-js",
    status: flow.defaultStatus,
    steps: flow.steps.length > 0 ? flow.steps.map(toDraftStep) : [createBlankStep()],
    trigger: { ...DEFAULT_TRIGGER },
    runtime: { ...DEFAULT_RUNTIME },
    uploads: [],
    variables: defaultVariables(),
    versions: [],
  };
}

function readStoredDraft(companySlug: string, flow: FlowDefinition, access: AutomationStudioAccess): FlowDraft {
  if (typeof window === "undefined") return buildDefaultDraft(flow, access);

  try {
    const raw = window.localStorage.getItem(draftStorageKey(companySlug, flow.id));
    if (!raw) return buildDefaultDraft(flow, access);
    const parsed = JSON.parse(raw) as Partial<FlowDraft>;
    const base = buildDefaultDraft(flow, access);

    return {
      auditTrail: Array.isArray(parsed.auditTrail)
        ? parsed.auditTrail
            .map((entry) => readRecord(entry))
            .filter((entry): entry is Record<string, unknown> => Boolean(entry))
            .map((entry) => ({
              actor: readString(entry.actor, access.profileLabel),
              createdAt: readString(entry.createdAt, nowLabel()),
              id: readString(entry.id, createClientId()),
              summary: readString(entry.summary, "Atualização registrada."),
            }))
        : base.auditTrail,
      base64Sample: readString(parsed.base64Sample),
      boundAssetIds: Array.isArray(parsed.boundAssetIds)
        ? parsed.boundAssetIds.filter((value): value is string => typeof value === "string")
        : base.boundAssetIds,
      notes: readString(parsed.notes, base.notes),
      script: readString(parsed.script, base.script),
      scriptTemplateId: readString(parsed.scriptTemplateId, base.scriptTemplateId),
      status: parsed.status === "inactive" ? "inactive" : "active",
      steps:
        Array.isArray(parsed.steps) && parsed.steps.length > 0
          ? parsed.steps
              .map((item) => readRecord(item))
              .filter((item): item is Record<string, unknown> => Boolean(item))
              .map((step) => ({
                approvalRole: readString(step.approvalRole, "analista-qa"),
                condition: readString(step.condition),
                description: readString(step.description, ""),
                enabled: readBoolean(step.enabled, true),
                expectedResult: readString(step.expectedResult, ""),
                fallbackTarget: readString(step.fallbackTarget),
                id: readString(step.id, createClientId()),
                inputBinding: readString(step.inputBinding, ""),
                kind: (readString(step.kind, "custom_script") as AutomationStudioStepKind) || "custom_script",
                loopLimit: readNumber(step.loopLimit, 3),
                onError: (readString(step.onError, "stop") as DraftStep["onError"]) || "stop",
                outputVariable: readString(step.outputVariable),
                parallelKey: readString(step.parallelKey),
                retryAttempts: readNumber(step.retryAttempts, 1),
                retryBackoffMs: readNumber(step.retryBackoffMs, 0),
                script: readString(step.script, ""),
                selector: readString(step.selector, ""),
                subflowId: readString(step.subflowId),
                timeoutMs: readNumber(step.timeoutMs, 5000),
                title: readString(step.title, "Etapa customizada"),
              }))
          : base.steps,
      trigger: {
        cron: readString(parsed.trigger?.cron, DEFAULT_TRIGGER.cron),
        enabled: readBoolean(parsed.trigger?.enabled, DEFAULT_TRIGGER.enabled),
        eventName: readString(parsed.trigger?.eventName, DEFAULT_TRIGGER.eventName),
        mode: (readString(parsed.trigger?.mode, DEFAULT_TRIGGER.mode) as AutomationStudioTriggerMode) || DEFAULT_TRIGGER.mode,
        requireApproval: readBoolean(parsed.trigger?.requireApproval, DEFAULT_TRIGGER.requireApproval),
        watchPath: readString(parsed.trigger?.watchPath, DEFAULT_TRIGGER.watchPath),
        webhookPath: readString(parsed.trigger?.webhookPath, DEFAULT_TRIGGER.webhookPath),
      },
      runtime: {
        allowProductionWrite: readBoolean(parsed.runtime?.allowProductionWrite, DEFAULT_RUNTIME.allowProductionWrite),
        debugMode: readBoolean(parsed.runtime?.debugMode, DEFAULT_RUNTIME.debugMode),
        maxParallel: readNumber(parsed.runtime?.maxParallel, DEFAULT_RUNTIME.maxParallel),
        notifyOnFailure: readBoolean(parsed.runtime?.notifyOnFailure, DEFAULT_RUNTIME.notifyOnFailure),
        retryAttempts: readNumber(parsed.runtime?.retryAttempts, DEFAULT_RUNTIME.retryAttempts),
        retryBackoffMs: readNumber(parsed.runtime?.retryBackoffMs, DEFAULT_RUNTIME.retryBackoffMs),
        simulationMode:
          (readString(parsed.runtime?.simulationMode, DEFAULT_RUNTIME.simulationMode) as FlowRuntimeConfig["simulationMode"]) ||
          DEFAULT_RUNTIME.simulationMode,
        uploadStrategy:
          (readString(parsed.runtime?.uploadStrategy, DEFAULT_RUNTIME.uploadStrategy) as FlowRuntimeConfig["uploadStrategy"]) ||
          DEFAULT_RUNTIME.uploadStrategy,
      },
      uploads: Array.isArray(parsed.uploads)
        ? parsed.uploads
            .map((item) => readRecord(item))
            .filter((item): item is Record<string, unknown> => Boolean(item))
            .map((upload) => ({
              id: readString(upload.id, createClientId()),
              name: readString(upload.name, "Arquivo local"),
              size: readNumber(upload.size, 0),
              type: readString(upload.type, "application/octet-stream"),
            }))
        : [],
      variables: Array.isArray(parsed.variables)
        ? parsed.variables
            .map((item) => readRecord(item))
            .filter((item): item is Record<string, unknown> => Boolean(item))
            .map((variable) => ({
              description: readString(variable.description),
              id: readString(variable.id, createClientId()),
              key: readString(variable.key, "variable"),
              scope: readString(variable.scope, "global") === "local" ? "local" : "global",
              source: (readString(variable.source, "manual") as FlowVariable["source"]) || "manual",
              value: readString(variable.value),
            }))
        : base.variables,
      versions: Array.isArray(parsed.versions)
        ? parsed.versions
            .map((item) => readRecord(item))
            .filter((item): item is Record<string, unknown> => Boolean(item))
            .map((version) => ({
              author: readString(version.author, access.profileLabel),
              id: readString(version.id, createClientId()),
              label: readString(version.label, "v1"),
                note: readString(version.note),
                savedAt: readString(version.savedAt, nowLabel()),
                script: readString(version.script),
                status: (readString(version.status, "active") === "inactive" ? "inactive" : "active") as FlowVersion["status"],
                stepCount: readNumber(version.stepCount, 0),
              triggerMode:
                (readString(version.triggerMode, DEFAULT_TRIGGER.mode) as AutomationStudioTriggerMode) || DEFAULT_TRIGGER.mode,
              variableCount: readNumber(version.variableCount, 0),
            }))
            .slice(0, MAX_STORED_VERSIONS)
        : [],
    };
  } catch {
    return buildDefaultDraft(flow, access);
  }
}

function persistDraft(companySlug: string, flowId: string, draft: FlowDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(draftStorageKey(companySlug, flowId), JSON.stringify(draft));
}

function readCustomFlows(companySlug: string): FlowDefinition[] {
  if (typeof window === "undefined") return [] as FlowDefinition[];

  try {
    const raw = window.localStorage.getItem(customFlowsStorageKey(companySlug));
    if (!raw) return [] as FlowDefinition[];
    const parsed = JSON.parse(raw) as unknown[];

    if (!Array.isArray(parsed)) return [] as FlowDefinition[];

    return parsed
      .map((item) => readRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((flow) => ({
        companyScope: normalizeAutomationCompanyScope(companySlug) ?? "all",
        companySlug,
        createdAt: readString(flow.createdAt, nowLabel()),
        defaultNotes: readString(flow.defaultNotes, "Fluxo customizado criado no studio."),
        defaultScript: readString(
          flow.defaultScript,
          AUTOMATION_STUDIO_SCRIPT_TEMPLATES[0]?.code ?? "export default async function run() { return { ok: true }; }",
        ),
        defaultStatus: readString(flow.defaultStatus, "active") === "inactive" ? "inactive" : "active",
        description: readString(flow.description, "Fluxo customizado"),
        id: readString(flow.id, createClientId()),
        objective: readString(flow.objective, "Automação configurável por empresa."),
        realRunnerId: readString(flow.realRunnerId) || null,
        runnerType: (readString(flow.runnerType, "hybrid") as AutomationStudioRunnerType) || "hybrid",
        source: "custom" as const,
        stack: readString(flow.stack, "Studio customizado"),
        steps: Array.isArray(flow.steps)
          ? flow.steps
              .map((item) => readRecord(item))
              .filter((item): item is Record<string, unknown> => Boolean(item))
              .map((step) => ({
                description: readString(step.description, "Etapa criada no studio."),
                expectedResult: readString(step.expectedResult, "Resultado configurado pela empresa."),
                inputBinding: readString(step.inputBinding, "payload.value"),
                kind: (readString(step.kind, "custom_script") as AutomationStudioStepKind) || "custom_script",
                selector: readString(step.selector, "stepContext"),
                title: readString(step.title, "Etapa customizada"),
              }))
          : [createBlankStep()],
        templateId: readString(flow.templateId),
        title: readString(flow.title, "Novo fluxo"),
        updatedAt: readString(flow.updatedAt, nowLabel()),
      }));
  } catch {
    return [] as FlowDefinition[];
  }
}

function persistCustomFlows(companySlug: string, flows: FlowDefinition[]) {
  if (typeof window === "undefined") return;

  const serializable = flows.map((flow) => ({
    companyScope: flow.companyScope,
    companySlug,
    createdAt: flow.createdAt ?? nowLabel(),
    defaultNotes: flow.defaultNotes,
    defaultScript: flow.defaultScript,
    defaultStatus: flow.defaultStatus,
    description: flow.description,
    id: flow.id,
    objective: flow.objective,
    realRunnerId: flow.realRunnerId,
    runnerType: flow.runnerType,
    stack: flow.stack,
    steps: flow.steps,
    templateId: flow.templateId ?? "",
    title: flow.title,
    updatedAt: flow.updatedAt ?? nowLabel(),
  }));

  window.localStorage.setItem(customFlowsStorageKey(companySlug), JSON.stringify(serializable));
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function kindTone(kind: AutomationStudioStepKind) {
  if (kind === "http_request" || kind === "graphql_request") return "border-sky-200 bg-sky-50 text-sky-700";
  if (kind === "upload_file" || kind === "paste_base64") return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700";
  if (kind === "capture_evidence" || kind === "assert_text") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (kind === "conditional_branch" || kind === "loop_until") return "border-amber-200 bg-amber-50 text-amber-700";
  if (kind === "parallel_group" || kind === "subflow_call") return "border-violet-200 bg-violet-50 text-violet-700";
  if (kind === "approval_gate") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function kindLabel(kind: AutomationStudioStepKind) {
  return kind.replaceAll("_", " ");
}

function metricTone(active: boolean) {
  return active
    ? "border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"
    : "border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) text-(--tc-text-muted,#6b7280)";
}

function buildRunPreview(input: {
  access: AutomationStudioAccess;
  companyName: string;
  draft: FlowDraft;
  environmentTitle: string;
  flow: FlowDefinition;
}) {
  const generatedAt = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const enabledSteps = input.draft.steps.filter((step) => step.enabled);
  const conditionalCount = enabledSteps.filter((step) => step.kind === "conditional_branch" || step.kind === "loop_until").length;
  const parallelCount = enabledSteps.filter((step) => step.kind === "parallel_group").length;
  const subflowCount = enabledSteps.filter((step) => step.kind === "subflow_call").length;
  const lines = [
    `[${generatedAt}] Empresa ${input.companyName} carregada no studio.`,
    `[${generatedAt}] Fluxo "${input.flow.title}" preparado no ambiente ${input.environmentTitle}.`,
    `[${generatedAt}] Trigger ${input.draft.trigger.mode} ${input.draft.trigger.enabled ? "habilitado" : "desligado"} e modo ${input.draft.runtime.simulationMode}.`,
    `[${generatedAt}] ${enabledSteps.length} etapa(s) habilitada(s), ${input.draft.variables.length} variável(is) e ${input.draft.boundAssetIds.length + input.draft.uploads.length} recurso(s).`,
    `[${generatedAt}] Retry global ${input.draft.runtime.retryAttempts}x com backoff ${input.draft.runtime.retryBackoffMs} ms.`,
    `[${generatedAt}] Perfil ${input.access.profileLabel} pronto para ${input.draft.status === "active" ? "execução" : "revisão"} do fluxo.`,
  ];
  const technicalLines = enabledSteps.map(
    (step, index) =>
      `step[${index}] kind=${step.kind} selector=${step.selector || "n/a"} binding=${step.inputBinding || "n/a"} condition=${step.condition || "none"} retry=${step.retryAttempts} timeout=${step.timeoutMs}`,
  );
  const metrics: RunPreviewMetric[] = [
    {
      detail: "Etapas habilitadas para a próxima execução",
      label: "Pipeline",
      value: `${enabledSteps.length} passos`,
    },
    {
      detail: "Condições, loops e fallbacks modelados no front",
      label: "Controle",
      value: `${conditionalCount} regras`,
    },
    {
      detail: "Blocos de paralelismo e componentes reutilizáveis",
      label: "Reuso",
      value: `${parallelCount + subflowCount} blocos`,
    },
    {
      detail: "Snapshots versionados desta definição",
      label: "Versões",
      value: `${input.draft.versions.length}`,
    },
  ];

  return { generatedAt, lines, metrics, technicalLines };
}

function findTemplate(id: string) {
  return AUTOMATION_STUDIO_SCRIPT_TEMPLATES.find((template) => template.id === id) || AUTOMATION_STUDIO_SCRIPT_TEMPLATES[0];
}

function findSubflow(id: string) {
  return AUTOMATION_STUDIO_SUBFLOW_LIBRARY.find((subflow) => subflow.id === id) || null;
}

type AutomationStudioPanelId = "overview" | "steps" | "mappings" | "results" | "scripts" | "files";

function resolveDefaultPanel(mode: NonNullable<Props["mode"]>): AutomationStudioPanelId {
  if (mode === "scripts") return "scripts";
  if (mode === "files") return "files";
  if (mode === "results") return "results";
  return "overview";
}

export default function AutomationStudio({
  access,
  activeCompanySlug,
  companies,
  initialFlowId,
  onOpenRealRunner,
  mode = "flows",
}: Props) {
  const initialCompanySlug = activeCompanySlug || companies[0]?.slug || "";
  const initialBuiltInFlows = useMemo(() => getVisibleBuiltInFlows(initialCompanySlug), [initialCompanySlug]);
  const bootstrapFlow = useMemo(
    () => initialBuiltInFlows.find((flow) => flow.id === initialFlowId) || initialBuiltInFlows[0] || BUILT_IN_FLOWS[0],
    [initialBuiltInFlows, initialFlowId],
  );
  const initialDraft = useMemo(() => buildDefaultDraft(bootstrapFlow, access), [access, bootstrapFlow]);
  const [selectedCompanySlug, setSelectedCompanySlug] = useState(initialCompanySlug);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(isTestingCompanyScope(initialCompanySlug) ? "qc-local" : (AUTOMATION_ENVIRONMENTS[0]?.id ?? "local"));
  const [customFlowsRevision, setCustomFlowsRevision] = useState(0);
  const [selectedFlowId, setSelectedFlowId] = useState(bootstrapFlow?.id ?? BUILT_IN_FLOWS[0]?.id ?? "griaule-biometrics");
  const [draft, setDraft] = useState<FlowDraft>(initialDraft);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(initialDraft.steps[0]?.id ?? null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(AUTOMATION_STUDIO_SCRIPT_TEMPLATES[0]?.id ?? "blank-js");
  const [newFlowTitle, setNewFlowTitle] = useState("");
  const [versionNote, setVersionNote] = useState("Snapshot manual do studio");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [runPreview, setRunPreview] = useState<RunPreview | null>(null);
  const [debugCursor, setDebugCursor] = useState(0);
  const [activePanel, setActivePanel] = useState<AutomationStudioPanelId>(() => resolveDefaultPanel(mode));
  const [scriptTarget, setScriptTarget] = useState<"flow" | "step">("flow");
  const [showScriptStepsPanel, setShowScriptStepsPanel] = useState(true);
  const [showScriptToolkitPanel, setShowScriptToolkitPanel] = useState(true);
  const [isFileLibraryOpen, setIsFileLibraryOpen] = useState(false);
  const [fileLibraryQuery, setFileLibraryQuery] = useState("");
  const scriptEditorRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setActivePanel(resolveDefaultPanel(mode));
  }, [mode]);
  useEffect(() => {
    setSelectedEnvironmentId((current) => {
      if (isTestingCompanyScope(selectedCompanySlug)) {
        return current === "qc-local" ? current : "qc-local";
      }

      return current === "qc-local" ? (AUTOMATION_ENVIRONMENTS[0]?.id ?? "local") : current;
    });
  }, [selectedCompanySlug]);
  const customFlows = useMemo(() => {
    const revision = customFlowsRevision;
    void revision;
    return selectedCompanySlug ? readCustomFlows(selectedCompanySlug) : [];
  }, [selectedCompanySlug, customFlowsRevision]);
  const visibleBuiltInFlows = useMemo(() => getVisibleBuiltInFlows(selectedCompanySlug), [selectedCompanySlug]);
  const flowCatalog = useMemo(() => [...visibleBuiltInFlows, ...customFlows], [customFlows, visibleBuiltInFlows]);
  const effectiveSelectedFlowId = flowCatalog.some((flow) => flow.id === selectedFlowId)
    ? selectedFlowId
    : (flowCatalog[0]?.id ?? selectedFlowId);
  const selectedFlow = useMemo(
    () => flowCatalog.find((flow) => flow.id === effectiveSelectedFlowId) || flowCatalog[0] || bootstrapFlow,
    [bootstrapFlow, effectiveSelectedFlowId, flowCatalog],
  );
  const selectedCompany = useMemo(
    () => companies.find((company) => company.slug === selectedCompanySlug) || companies[0] || null,
    [companies, selectedCompanySlug],
  );
  const selectedEnvironment = useMemo(
    () => AUTOMATION_ENVIRONMENTS.find((environment) => environment.id === selectedEnvironmentId) || AUTOMATION_ENVIRONMENTS[0],
    [selectedEnvironmentId],
  );
  const selectedStep = useMemo(
    () => draft.steps.find((step) => step.id === selectedStepId) || draft.steps[0] || null,
    [draft.steps, selectedStepId],
  );
  const visibleAssets = useMemo(
    () => AUTOMATION_STUDIO_ASSETS.filter((asset) => asset.flowIds.includes(selectedFlow.id)),
    [selectedFlow.id],
  );
  const enabledSteps = useMemo(() => draft.steps.filter((step) => step.enabled), [draft.steps]);
  const canEditFlow = access.canManageFlows || access.canConfigure;
  const canSeeLogs = access.canViewTechnicalLogs;
  const isCustomFlow = selectedFlow.source === "custom";
  const selectedTemplate = findTemplate(selectedTemplateId);
  const boundAssetCount = draft.boundAssetIds.length + draft.uploads.length + (draft.base64Sample.trim() ? 1 : 0);
  const debugStep = enabledSteps[Math.min(debugCursor, Math.max(enabledSteps.length - 1, 0))] || null;
  const flowStatusLabel = draft.status === "active" ? "Ativo" : "Em revisão";
  const flowStatusTone =
    draft.status === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  const compactOverviewCards = [
    {
      label: "Status",
      value: flowStatusLabel,
      hint: draft.trigger.enabled ? "trigger ligado" : "manual",
      icon: draft.status === "active" ? FiCheckCircle : FiPauseCircle,
      tone: flowStatusTone,
    },
    {
      label: "Edição",
      value: canEditFlow ? "Liberada" : "Execução",
      hint: access.profileLabel,
      icon: FiCode,
      tone: metricTone(canEditFlow),
    },
    {
      label: "Etapas",
      value: `${enabledSteps.length}/${draft.steps.length}`,
      hint: "ativas no fluxo",
      icon: FiGitBranch,
      tone: "border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)",
    },
    {
      label: "Arquivos",
      value: `${boundAssetCount}`,
      hint: "vínculos",
      icon: FiFolderPlus,
      tone: "border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)",
    },
    {
      label: "Versões",
      value: `${draft.versions.length}`,
      hint: lastSavedAt ? `salvo ${lastSavedAt}` : "sem salvar",
      icon: FiClock,
      tone: "border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)",
    },
  ];

  function replaceCustomFlows(updater: (current: FlowDefinition[]) => FlowDefinition[]) {
    if (!selectedCompanySlug) return;
    const next = updater(customFlows);
    persistCustomFlows(selectedCompanySlug, next);
    setCustomFlowsRevision((current) => current + 1);
  }

  const commitDraft = useCallback((nextDraft: FlowDraft, companySlug = selectedCompanySlug, flowId = effectiveSelectedFlowId) => {
    setDraft(nextDraft);

    if (companySlug && flowId) {
      persistDraft(companySlug, flowId, nextDraft);
      setLastSavedAt(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    }
  }, [effectiveSelectedFlowId, selectedCompanySlug]);

  function updateDraft(updater: (current: FlowDraft) => FlowDraft) {
    const nextDraft = updater(draft);
    commitDraft(nextDraft);
  }

  const activateFlow = useCallback((nextCompanySlug: string, nextFlowId: string) => {
    const nextCustomFlows = readCustomFlows(nextCompanySlug);
    const nextCatalog = [...getVisibleBuiltInFlows(nextCompanySlug), ...nextCustomFlows];
    const nextFlow = nextCatalog.find((flow) => flow.id === nextFlowId) || nextCatalog[0] || BUILT_IN_FLOWS[0];
    const nextDraft = readStoredDraft(nextCompanySlug, nextFlow, access);

    setSelectedCompanySlug(nextCompanySlug);
    setCustomFlowsRevision((current) => current + 1);
    setSelectedFlowId(nextFlow.id);
    commitDraft(nextDraft, nextCompanySlug, nextFlow.id);
    setSelectedStepId(nextDraft.steps[0]?.id ?? null);
    setDebugCursor(0);
    setRunPreview(null);
  }, [access, commitDraft]);

  useEffect(() => {
    if (!initialFlowId || initialFlowId === effectiveSelectedFlowId) return;
    if (!flowCatalog.some((flow) => flow.id === initialFlowId)) return;
    activateFlow(selectedCompanySlug, initialFlowId);
  }, [activateFlow, effectiveSelectedFlowId, flowCatalog, initialFlowId, selectedCompanySlug]);

  function updateSelectedFlowMeta(
    field: keyof Pick<FlowDefinition, "title" | "description" | "objective" | "stack" | "runnerType" | "defaultNotes">,
    value: string,
  ) {
    if (!isCustomFlow || !canEditFlow || !selectedCompanySlug) return;

    replaceCustomFlows((current) =>
      current.map((flow) =>
        flow.id === selectedFlow.id
          ? {
              ...flow,
              [field]: field === "runnerType" ? (value as AutomationStudioRunnerType) : value,
              updatedAt: nowLabel(),
            }
          : flow,
      ),
    );
  }

  function updateDraftStep(stepId: string, updater: (step: DraftStep) => DraftStep) {
    updateDraft((current) => ({
      ...current,
      steps: current.steps.map((step) => (step.id === stepId ? updater(step) : step)),
    }));
  }

  function updateVariable(variableId: string, field: keyof FlowVariable, value: string) {
    updateDraft((current) => ({
      ...current,
      variables: current.variables.map((variable) =>
        variable.id === variableId
          ? {
              ...variable,
              [field]:
                field === "scope"
                  ? value === "local"
                    ? "local"
                    : "global"
                  : field === "source"
                    ? (value as FlowVariable["source"])
                    : value,
            }
          : variable,
      ),
    }));
  }

  function appendVariable() {
    if (!canEditFlow) return;
    updateDraft((current) => ({
      ...current,
      variables: [
        ...current.variables,
        {
          description: "Nova variável configurada no studio.",
          id: createClientId(),
          key: `var_${current.variables.length + 1}`,
          scope: "local",
          source: "manual",
          value: "",
        },
      ],
    }));
  }

  function removeVariable(variableId: string) {
    if (!canEditFlow) return;
    updateDraft((current) => ({
      ...current,
      variables: current.variables.filter((variable) => variable.id !== variableId),
    }));
  }

  function appendStep(preset: AutomationStudioActionPreset) {
    if (!canEditFlow) return;
    const nextStep = toDraftStep(preset);
    updateDraft((current) => ({ ...current, steps: [...current.steps, nextStep] }));
    setSelectedStepId(nextStep.id);
  }

  function duplicateStep(stepId: string) {
    if (!canEditFlow) return;
    updateDraft((current) => {
      const index = current.steps.findIndex((step) => step.id === stepId);
      if (index === -1) return current;
      const copy = {
        ...current.steps[index],
        id: createClientId(),
        title: `${current.steps[index].title} (cópia)`,
      };
      const steps = [...current.steps];
      steps.splice(index + 1, 0, copy);
      return { ...current, steps };
    });
  }

  function moveStep(stepId: string, direction: -1 | 1) {
    if (!canEditFlow) return;
    updateDraft((current) => {
      const index = current.steps.findIndex((step) => step.id === stepId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.steps.length) return current;
      const steps = [...current.steps];
      const [item] = steps.splice(index, 1);
      steps.splice(nextIndex, 0, item);
      return { ...current, steps };
    });
  }

  function removeStep(stepId: string) {
    if (!canEditFlow || draft.steps.length === 1) return;
    const fallbackStep = draft.steps.find((step) => step.id !== stepId) || null;
    updateDraft((current) => ({
      ...current,
      steps: current.steps.filter((step) => step.id !== stepId),
    }));
    setSelectedStepId(fallbackStep?.id ?? null);
  }

  function toggleAsset(assetId: string) {
    if (!canEditFlow) return;
    updateDraft((current) => ({
      ...current,
      boundAssetIds: current.boundAssetIds.includes(assetId)
        ? current.boundAssetIds.filter((currentAssetId) => currentAssetId !== assetId)
        : [...current.boundAssetIds, assetId],
    }));
  }

  function addUploads(files: FileList | null) {
    if (!files || files.length === 0 || !canEditFlow) return;
    const nextUploads: DraftUpload[] = Array.from(files).map((file) => ({
      id: createClientId(),
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
    }));
    updateDraft((current) => ({
      ...current,
      uploads: [...current.uploads, ...nextUploads],
    }));
  }

  function removeUpload(uploadId: string) {
    if (!canEditFlow) return;
    updateDraft((current) => ({
      ...current,
      uploads: current.uploads.filter((upload) => upload.id !== uploadId),
    }));
  }

  function applyScriptTemplate(template: AutomationStudioScriptTemplate) {
    if (!canEditFlow) return;
    updateDraft((current) => ({
      ...current,
      auditTrail: [buildAuditEntry(access.profileLabel, `Template ${template.title} aplicado ao script.`), ...current.auditTrail].slice(0, 20),
      script: template.code,
      scriptTemplateId: template.id,
    }));
  }

  function saveVersion() {
    if (!canEditFlow) return;
    updateDraft((current) => {
      const nextVersion = buildVersionSnapshot(access.profileLabel, current, versionNote.trim() || "Snapshot manual");
      return {
        ...current,
        auditTrail: [buildAuditEntry(access.profileLabel, `Versão ${nextVersion.label} salva.`), ...current.auditTrail].slice(0, 20),
        versions: [nextVersion, ...current.versions].slice(0, MAX_STORED_VERSIONS),
      };
    });
  }

  function restoreVersion(versionId: string) {
    if (!canEditFlow) return;
    const version = draft.versions.find((item) => item.id === versionId);
    if (!version) return;
    updateDraft((current) => ({
      ...current,
      auditTrail: [buildAuditEntry(access.profileLabel, `Versão ${version.label} restaurada no editor.`), ...current.auditTrail].slice(0, 20),
      script: version.script,
      status: version.status,
    }));
  }

  function updateTrigger(field: keyof FlowTriggerConfig, value: string | boolean) {
    updateDraft((current) => ({
      ...current,
      trigger: {
        ...current.trigger,
        [field]:
          field === "enabled" || field === "requireApproval"
            ? Boolean(value)
            : field === "mode"
              ? (value as AutomationStudioTriggerMode)
              : String(value),
      },
    }));
  }

  function updateRuntime(field: keyof FlowRuntimeConfig, value: string | boolean | number) {
    updateDraft((current) => ({
      ...current,
      runtime: {
        ...current.runtime,
        [field]:
          field === "debugMode" || field === "notifyOnFailure" || field === "allowProductionWrite"
            ? Boolean(value)
            : field === "simulationMode" || field === "uploadStrategy"
              ? String(value)
              : Number(value),
      } as FlowRuntimeConfig,
    }));
  }

  function createCustomFlow(mode: "blank" | "clone") {
    if (!canEditFlow || !selectedCompanySlug) return;
    const title = newFlowTitle.trim() || (mode === "clone" ? `${selectedFlow.title} custom` : "Novo fluxo customizado");
    const template = findTemplate(selectedTemplateId);
    const flowId = `custom-${selectedCompanySlug}-${createClientId()}`;
    const newFlow: FlowDefinition = {
      companyScope: normalizeAutomationCompanyScope(selectedCompanySlug) ?? "all",
      companySlug: selectedCompanySlug,
      createdAt: nowLabel(),
      defaultNotes:
        mode === "clone"
          ? `Clone criado a partir de ${selectedFlow.title}.`
          : "Fluxo criado do zero no studio com script editável e versionamento.",
      defaultScript: mode === "clone" ? draft.script : template.code,
      defaultStatus: "active",
      description:
        mode === "clone"
          ? `Clone do fluxo ${selectedFlow.title} adaptado para a empresa ${selectedCompany?.name ?? selectedCompanySlug}.`
          : "Fluxo criado do zero para cenários complexos, com passos, variáveis, triggers e scripts editáveis.",
      id: flowId,
      objective:
        mode === "clone"
          ? `Customizar o fluxo ${selectedFlow.title} sem mexer na base global.`
          : "Permitir automação low-code + pro-code editável no front sem depender do repositório.",
      realRunnerId: null,
      runnerType: mode === "clone" ? selectedFlow.runnerType : "hybrid",
      source: "custom",
      stack: mode === "clone" ? selectedFlow.stack : "Studio customizado + editor inline",
      steps:
        mode === "clone"
          ? draft.steps.map((step) => ({
              description: step.description,
              expectedResult: step.expectedResult,
              inputBinding: step.inputBinding,
              kind: step.kind,
              selector: step.selector,
              title: step.title,
            }))
          : [
              {
                description: "Ponto inicial do novo fluxo.",
                expectedResult: "Contexto preparado para evoluir a automação.",
                inputBinding: "payload.input",
                kind: "custom_script",
                selector: "stepContext",
                title: "Bootstrap do fluxo",
              },
            ],
      templateId: template.id,
      title,
      updatedAt: nowLabel(),
    };

    replaceCustomFlows((current) => [...current, newFlow]);
    const nextDraft: FlowDraft =
      mode === "clone"
        ? {
            ...draft,
            auditTrail: [buildAuditEntry(access.profileLabel, `Fluxo customizado ${title} criado por clone.`), ...draft.auditTrail].slice(0, 20),
            versions: [],
          }
        : buildDefaultDraft(newFlow, access);

    setSelectedFlowId(flowId);
    commitDraft(nextDraft, selectedCompanySlug, flowId);
    setSelectedStepId(nextDraft.steps[0]?.id ?? null);
    setDebugCursor(0);
    setNewFlowTitle("");
    setRunPreview(null);
  }

  function deleteCustomFlow() {
    if (!isCustomFlow || !canEditFlow || !selectedCompanySlug) return;
    replaceCustomFlows((current) => current.filter((flow) => flow.id !== selectedFlow.id));
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(draftStorageKey(selectedCompanySlug, selectedFlow.id));
    }
    activateFlow(selectedCompanySlug, visibleBuiltInFlows[0]?.id ?? selectedFlow.id);
  }

  function runPreparation() {
    if (!selectedCompany || !selectedEnvironment) return;
    setRunPreview(
      buildRunPreview({
        access,
        companyName: selectedCompany.name,
        draft,
        environmentTitle: selectedEnvironment.title,
        flow: selectedFlow,
      }),
    );
  }

  const filteredLibraryAssets = useMemo(() => {
    const query = fileLibraryQuery.trim().toLowerCase();
    if (!query) return visibleAssets;
    return visibleAssets.filter((asset) =>
      `${asset.title} ${asset.summary} ${asset.id} ${asset.type} ${asset.category}`.toLowerCase().includes(query),
    );
  }, [fileLibraryQuery, visibleAssets]);

  const filteredLibraryUploads = useMemo(() => {
    const query = fileLibraryQuery.trim().toLowerCase();
    if (!query) return draft.uploads;
    return draft.uploads.filter((upload) => `${upload.name} ${upload.type}`.toLowerCase().includes(query));
  }, [draft.uploads, fileLibraryQuery]);

  function insertSnippet(snippet: string) {
    if (!canEditFlow) return;
    const editor = scriptEditorRef.current;

    if (scriptTarget === "flow") {
      const currentText = draft.script;
      const start = editor?.selectionStart ?? currentText.length;
      const end = editor?.selectionEnd ?? start;
      updateDraft((current) => ({
        ...current,
        script: current.script.slice(0, start) + snippet + current.script.slice(end),
      }));

      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          try {
            editor?.focus();
            const nextPos = start + snippet.length;
            editor?.setSelectionRange(nextPos, nextPos);
          } catch {}
        });
      }

      return;
    }

    if (!selectedStep) return;
    const currentText = selectedStep.script || "";
    const start = editor?.selectionStart ?? currentText.length;
    const end = editor?.selectionEnd ?? start;

    updateDraftStep(selectedStep.id, (step) => {
      const base = step.script || "";
      return {
        ...step,
        script: base.slice(0, start) + snippet + base.slice(end),
      };
    });

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        try {
          editor?.focus();
          const nextPos = start + snippet.length;
          editor?.setSelectionRange(nextPos, nextPos);
        } catch {}
      });
    }
  }

  if (mode === "scripts") {
    const scriptValue = scriptTarget === "step" ? selectedStep?.script ?? "" : draft.script;
    const breadcrumbCompany = selectedCompany?.name || selectedCompanySlug || "Empresa";

    return (
      <section className="space-y-4 rounded-[32px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            <span className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)">
              <FiShield className="h-4 w-4 text-(--tc-accent,#ef0001)" />
              {breadcrumbCompany}
            </span>
            <span className="text-(--tc-text-muted,#6b7280)">›</span>
            <span className="truncate font-black">{selectedFlow.title}</span>
            <span className="text-(--tc-text-muted,#6b7280)">›</span>
            <span className="text-(--tc-text-muted,#6b7280)">Scripts</span>
            <span className="text-(--tc-text-muted,#6b7280)">›</span>
            <span className="text-(--tc-text-muted,#6b7280)">Editor</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowScriptStepsPanel((current) => !current)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
            >
              <FiGitBranch className="h-4 w-4" />
              Etapas
            </button>
            <button
              type="button"
              onClick={() => setShowScriptToolkitPanel((current) => !current)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
            >
              <FiCode className="h-4 w-4" />
              Toolbox
            </button>
            <button
              type="button"
              onClick={() => setIsFileLibraryOpen(true)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white"
            >
              <FiFolderPlus className="h-4 w-4" />
              Biblioteca de arquivos
            </button>
          </div>
        </div>

        <article className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(180px,0.86fr)_minmax(160px,0.62fr)_minmax(260px,1fr)_auto]">
            <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              Empresa
              <select
                value={selectedCompanySlug}
                onChange={(event) => activateFlow(event.target.value, effectiveSelectedFlowId)}
                className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-medium outline-none transition focus:border-(--tc-accent,#ef0001)"
              >
                {companies.map((company) => (
                  <option key={company.slug} value={company.slug}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              Ambiente
              <select
                value={selectedEnvironmentId}
                onChange={(event) => setSelectedEnvironmentId(event.target.value)}
                className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-medium outline-none transition focus:border-(--tc-accent,#ef0001)"
              >
                {AUTOMATION_ENVIRONMENTS.map((environment) => (
                  <option key={environment.id} value={environment.id}>
                    {environment.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              Fluxo
              <select
                value={effectiveSelectedFlowId}
                onChange={(event) => activateFlow(selectedCompanySlug, event.target.value)}
                className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-medium outline-none transition focus:border-(--tc-accent,#ef0001)"
              >
                {flowCatalog.map((flow) => (
                  <option key={flow.id} value={flow.id}>
                    {flow.title} {flow.source === "custom" ? "• custom" : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap items-end gap-2">
              <button
                type="button"
                onClick={runPreparation}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-(--tc-primary,#011848) px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <FiPlay className="h-4 w-4" />
                Preparar execução
              </button>
              {selectedFlow.realRunnerId ? (
                <button
                  type="button"
                  onClick={onOpenRealRunner}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-5 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                >
                  <FiZap className="h-4 w-4" />
                  Abrir runner real
                </button>
              ) : null}
            </div>
          </div>
        </article>

        <div
          className={`grid gap-4 ${showScriptStepsPanel && showScriptToolkitPanel ? "2xl:grid-cols-[minmax(280px,0.38fr)_minmax(0,1fr)_minmax(320px,0.48fr)]" : showScriptStepsPanel ? "2xl:grid-cols-[minmax(280px,0.38fr)_minmax(0,1fr)]" : showScriptToolkitPanel ? "2xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.48fr)]" : ""}`}
        >
          {showScriptStepsPanel ? (
            <aside className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Etapas</p>
                <span className="inline-flex rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
                  {draft.steps.length}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {draft.steps.map((step, index) => {
                  const selected = selectedStep?.id === step.id;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setSelectedStepId(step.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        selected
                          ? "border-(--tc-accent,#ef0001) bg-[#fff5f5]"
                          : "border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) hover:border-(--tc-accent,#ef0001)"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                            Etapa {index + 1}
                          </p>
                          <p className="mt-1 break-words text-sm font-black tracking-[-0.02em] text-(--tc-text,#0b1a3c)">{step.title}</p>
                        </div>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${kindTone(step.kind)}`}>
                          {kindLabel(step.kind)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>
          ) : null}

          <article className="min-w-0 rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-1">
                <button
                  type="button"
                  onClick={() => setScriptTarget("flow")}
                  className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${scriptTarget === "flow" ? "bg-white text-(--tc-accent,#ef0001)" : "text-(--tc-text-muted,#6b7280)"}`}
                >
                  Script do fluxo
                </button>
                <button
                  type="button"
                  onClick={() => setScriptTarget("step")}
                  disabled={!selectedStep}
                  className={`min-h-10 rounded-full px-4 text-sm font-semibold transition disabled:opacity-50 ${scriptTarget === "step" ? "bg-white text-(--tc-accent,#ef0001)" : "text-(--tc-text-muted,#6b7280)"}`}
                >
                  Script da etapa
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveVersion}
                  disabled={!canEditFlow}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiSave className="h-4 w-4" />
                  Salvar versão
                </button>
              </div>
            </div>

            <textarea
              ref={scriptEditorRef}
              value={scriptValue}
              onChange={(event) => {
                if (!canEditFlow) return;
                if (scriptTarget === "step") {
                  if (!selectedStep) return;
                  updateDraftStep(selectedStep.id, (step) => ({ ...step, script: event.target.value }));
                  return;
                }

                updateDraft((current) => ({ ...current, script: event.target.value }));
              }}
              readOnly={!canEditFlow}
              rows={26}
              className="mt-4 w-full rounded-[24px] border border-(--tc-border,#d7deea) bg-[#081227] px-4 py-3 font-mono text-sm leading-7 text-white outline-none"
            />
          </article>

          {showScriptToolkitPanel ? (
            <aside className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
                <FiCode className="h-4 w-4" />
                Toolbox do script
              </div>

              <div className="mt-4 space-y-4">
                <div className="rounded-[24px] border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                  <p className="text-sm font-black text-(--tc-text,#0b1a3c)">Templates</p>
                  <select
                    value={selectedTemplateId}
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                    className="mt-3 min-h-11 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-semibold text-(--tc-text,#0b1a3c) outline-none"
                  >
                    {AUTOMATION_STUDIO_SCRIPT_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                  </select>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applyScriptTemplate(selectedTemplate)}
                      disabled={!canEditFlow}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiRefreshCw className="h-4 w-4" />
                      Aplicar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!canEditFlow) return;
                        updateDraft((current) => ({
                          ...current,
                          script: findTemplate("blank-js")?.code ?? current.script,
                          scriptTemplateId: "blank-js",
                        }));
                      }}
                      disabled={!canEditFlow}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiRotateCcw className="h-4 w-4" />
                      Limpar
                    </button>
                  </div>
                </div>

                <div className="rounded-[24px] border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                  <p className="text-sm font-black text-(--tc-text,#0b1a3c)">Biblioteca de funções</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {AUTOMATION_STUDIO_SCRIPT_API.map((item) => (
                      <span
                        key={item}
                        className="inline-flex rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                  <p className="text-sm font-black text-(--tc-text,#0b1a3c)">Versionamento</p>
                  <label className="mt-3 grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                    Nota da versão
                    <input
                      value={versionNote}
                      onChange={(event) => setVersionNote(event.target.value)}
                      className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={saveVersion}
                    disabled={!canEditFlow}
                    className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiSave className="h-4 w-4" />
                    Salvar snapshot
                  </button>
                </div>
              </div>
            </aside>
          ) : null}
        </div>

        {isFileLibraryOpen ? (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              onClick={() => setIsFileLibraryOpen(false)}
              className="absolute inset-0 bg-black/40"
              aria-label="Fechar biblioteca de arquivos"
            />
            <div className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-(--tc-surface,#ffffff) p-5 shadow-[0_24px_70px_rgba(15,23,42,0.35)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Biblioteca de arquivos</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">Selecionar asset</h2>
                  <p className="mt-2 text-sm leading-7 text-(--tc-text-secondary,#4b5563)">
                    Busque e insira referências de `assets.resolve()` diretamente no editor, sem poluir a tela principal.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFileLibraryOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </div>

              <label className="mt-4 grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                Buscar
                <input
                  value={fileLibraryQuery}
                  onChange={(event) => setFileLibraryQuery(event.target.value)}
                  placeholder="Nome, id, tipo..."
                  className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
                />
              </label>

              <div className="mt-4 space-y-3">
                {filteredLibraryAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between gap-3 rounded-[22px] border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-(--tc-text,#0b1a3c)">{asset.title}</p>
                      <p className="mt-1 truncate text-xs text-(--tc-text-muted,#6b7280)">
                        {asset.type} • {asset.id}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        insertSnippet(`assets.resolve('${asset.id}')`);
                        setIsFileLibraryOpen(false);
                      }}
                      className="inline-flex min-h-10 items-center justify-center rounded-full bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white"
                    >
                      Selecionar
                    </button>
                  </div>
                ))}

                {filteredLibraryAssets.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-4 text-sm text-(--tc-text-muted,#6b7280)">
                    Nenhum asset encontrado para esse filtro.
                  </div>
                ) : null}
              </div>

              {filteredLibraryUploads.length > 0 ? (
                <div className="mt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Uploads do fluxo</p>
                  <div className="mt-3 space-y-2">
                    {filteredLibraryUploads.map((upload) => (
                      <div
                        key={upload.id}
                        className="flex items-center justify-between gap-3 rounded-[22px] border border-(--tc-border,#e5e7eb) bg-white px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-(--tc-text,#0b1a3c)">{upload.name}</p>
                          <p className="mt-1 truncate text-xs text-(--tc-text-muted,#6b7280)">{upload.type}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            insertSnippet(`'${upload.name}'`);
                            setIsFileLibraryOpen(false);
                          }}
                          className="inline-flex min-h-10 items-center justify-center rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
                        >
                          Selecionar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  const showOverviewHero = mode === "flows" && activePanel === "overview";
  const showFlowSidebar = activePanel === "overview" || activePanel === "steps";
  const showAssetSidebar = mode === "files" || activePanel === "mappings";
  const splitExecutionLayout = activePanel === "steps";

  return (
    <section className="space-y-3 rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
          <span className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)">
            <FiShield className="h-4 w-4 text-(--tc-accent,#ef0001)" />
            {selectedCompany?.name || selectedCompanySlug || "Empresa"}
          </span>
          <span className="text-(--tc-text-muted,#6b7280)">›</span>
          <span className="truncate font-black">{selectedFlow.title}</span>
          <span className="text-(--tc-text-muted,#6b7280)">›</span>
          <span className="text-(--tc-text-muted,#6b7280)">
            {mode === "files"
              ? "Biblioteca de arquivos"
              : activePanel === "overview"
                ? "Visão geral"
                : activePanel === "steps"
                  ? "Etapas"
                  : activePanel === "mappings"
                    ? "Mapeamentos"
                    : activePanel === "results"
                      ? "Resultados"
                      : "Fluxos"}
          </span>
        </div>
        <Link
          href="/automacoes/scripts"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
        >
          <FiCode className="h-4 w-4" />
          Abrir scripts
        </Link>
      </div>
      {showOverviewHero ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <article className="rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Resumo rápido</p>
                <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{selectedFlow.title}</h2>
                <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">{selectedFlow.objective}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  access.profileLabel,
                  access.scopeLabel,
                  selectedEnvironment.title,
                  canSeeLogs ? "Log técnico" : "Sem log técnico",
                ].map((item) => (
                  <span
                    key={item}
                    className="inline-flex min-h-9 items-center rounded-full border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-xs font-semibold text-(--tc-text,#0b1a3c)"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
              {compactOverviewCards.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className={`rounded-2xl border px-4 py-3 ${item.tone}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em]">{item.label}</p>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="mt-2 text-lg font-black tracking-[-0.03em]">{item.value}</p>
                    <p className="mt-1 text-xs opacity-80">{item.hint}</p>
                  </div>
                );
              })}
            </div>
          </article>

          <aside className="rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
              <FiShield className="h-4 w-4" />
              Acesso atual
            </div>
            <div className="mt-4 grid gap-3">
              <div className={`rounded-2xl border px-4 py-3 ${metricTone(canEditFlow)}`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em]">Fluxo</p>
                <p className="mt-2 text-base font-black">{canEditFlow ? "Editável" : "Execução assistida"}</p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 ${metricTone(access.canConfigure)}`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em]">Configuração</p>
                <p className="mt-2 text-base font-black">{access.canConfigure ? "Global liberada" : "Somente empresa"}</p>
              </div>
              <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Escopo</p>
                <p className="mt-2 text-base font-black text-(--tc-text,#0b1a3c)">{access.visibilityLabel}</p>
                <p className="mt-1 text-xs text-(--tc-text-secondary,#4b5563)">{access.helperText}</p>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <article className="rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(180px,0.78fr)_minmax(160px,0.56fr)_minmax(260px,1fr)_auto]">
          <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            Empresa
            <select
              value={selectedCompanySlug}
              onChange={(event) => activateFlow(event.target.value, effectiveSelectedFlowId)}
              className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-medium outline-none transition focus:border-(--tc-accent,#ef0001)"
            >
              {companies.map((company) => (
                <option key={company.slug} value={company.slug}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            Ambiente
            <select
              value={selectedEnvironmentId}
              onChange={(event) => setSelectedEnvironmentId(event.target.value)}
              className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-medium outline-none transition focus:border-(--tc-accent,#ef0001)"
            >
              {AUTOMATION_ENVIRONMENTS.map((environment) => (
                <option key={environment.id} value={environment.id}>
                  {environment.title}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            Fluxo
            <select
              value={effectiveSelectedFlowId}
              onChange={(event) => activateFlow(selectedCompanySlug, event.target.value)}
              className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-medium outline-none transition focus:border-(--tc-accent,#ef0001)"
            >
              {flowCatalog.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.title} {flow.source === "custom" ? "• custom" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={runPreparation}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-(--tc-primary,#011848) px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <FiPlay className="h-4 w-4" />
              Preparar execução
            </button>
            {selectedFlow.realRunnerId ? (
              <button
                type="button"
                onClick={onOpenRealRunner}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-5 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
              >
                <FiZap className="h-4 w-4" />
                Abrir runner real
              </button>
            ) : null}
          </div>
        </div>
      </article>

      {mode === "flows" ? (
        <div className="flex flex-wrap gap-2 rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-2">
          {[
            { id: "overview" as const, label: "Visão geral", icon: FiLayers },
            { id: "steps" as const, label: "Etapas", icon: FiGitBranch },
            { id: "mappings" as const, label: "Mapeamentos", icon: FiDatabase },
            { id: "results" as const, label: "Resultados", icon: FiActivity },
          ].map((tab) => {
            const active = activePanel === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivePanel(tab.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-(--tc-accent,#ef0001) bg-white text-(--tc-accent,#ef0001) shadow-[0_10px_24px_rgba(239,0,1,0.08)]"
                    : "border-transparent bg-transparent text-(--tc-text,#0b1a3c) hover:border-(--tc-border,#d7deea) hover:bg-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={showAssetSidebar ? "grid gap-4 2xl:grid-cols-[minmax(0,1.22fr)_minmax(360px,0.78fr)]" : "grid gap-4"}>
        <article className="min-w-0 rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent,#ef0001)">Fluxo selecionado</p>
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${flowStatusTone}`}>
                  {flowStatusLabel}
                </span>
              </div>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{selectedFlow.title}</h3>
              <p className="mt-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">{selectedFlow.objective}</p>
              <p className="mt-1 max-w-4xl text-xs text-(--tc-text-secondary,#4b5563)">{selectedFlow.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)">
                {selectedFlow.stack}
              </span>
              <span className="inline-flex items-center rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)">
                {selectedFlow.runnerType}
              </span>
              <span className="inline-flex items-center rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)">
                {selectedFlow.source === "custom" ? "Custom" : "Catálogo"}
              </span>
              <span className="inline-flex items-center rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)">
                {lastSavedAt ? `Salvo ${lastSavedAt}` : "Sem salvar"}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
            <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Empresa</p>
              <p className="mt-2 text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{selectedCompany?.name || "Sem empresa"}</p>
            </div>
            <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Etapas</p>
              <p className="mt-2 text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{draft.steps.length}</p>
            </div>
            <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Assets</p>
              <p className="mt-2 text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{boundAssetCount}</p>
            </div>
            <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Salvo localmente</p>
              <p className="mt-2 text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{lastSavedAt || "aguardando"}</p>
            </div>
          </div>

          <div
            className={
              activePanel === "overview"
                ? "mt-4 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_320px]"
                : "mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]"
            }
          >
            <div className="space-y-4">
              {activePanel === "overview" ? (
                <div className="grid gap-3 lg:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Título
                  <input
                    value={selectedFlow.title}
                    onChange={(event) => updateSelectedFlowMeta("title", event.target.value)}
                    readOnly={!isCustomFlow || !canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm font-medium outline-none read-only:cursor-default"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Runner
                  <select
                    value={selectedFlow.runnerType}
                    onChange={(event) => updateSelectedFlowMeta("runnerType", event.target.value)}
                    disabled={!isCustomFlow || !canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm font-medium outline-none disabled:cursor-not-allowed"
                  >
                    <option value="http">http</option>
                    <option value="browser">browser</option>
                    <option value="hybrid">hybrid</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c) sm:col-span-2">
                  Descrição
                  <textarea
                    value={selectedFlow.description}
                    onChange={(event) => updateSelectedFlowMeta("description", event.target.value)}
                    readOnly={!isCustomFlow || !canEditFlow}
                    rows={3}
                    className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3 text-sm leading-7 outline-none read-only:cursor-default"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c) sm:col-span-2">
                  Objetivo
                  <textarea
                    value={selectedFlow.objective}
                    onChange={(event) => updateSelectedFlowMeta("objective", event.target.value)}
                    readOnly={!isCustomFlow || !canEditFlow}
                    rows={3}
                    className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3 text-sm leading-7 outline-none read-only:cursor-default"
                  />
                </label>
                </div>
              ) : null}

              {activePanel === "steps" ? (
                <div className="grid gap-3 lg:grid-cols-2">
                {draft.steps.map((step, index) => {
                  const selected = selectedStep?.id === step.id;
                  const subflow = findSubflow(step.subflowId);

                  return (
                    <article
                      key={step.id}
                      className={`rounded-[24px] border p-4 transition ${
                        selected
                          ? "border-(--tc-accent,#ef0001) bg-[#fff5f5] shadow-[0_12px_30px_rgba(239,0,1,0.08)]"
                          : "border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff)"
                      }`}
                    >
                      <button type="button" onClick={() => setSelectedStepId(step.id)} className="block w-full text-left">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                              Etapa {index + 1}
                            </p>
                            <h4 className="mt-2 break-words text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{step.title}</h4>
                          </div>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${kindTone(step.kind)}`}>
                            {kindLabel(step.kind)}
                          </span>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{step.description}</p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Binding</p>
                            <p className="mt-1 break-words text-sm font-semibold text-(--tc-text,#0b1a3c)">{step.inputBinding || "Não definido"}</p>
                          </div>
                          <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Controle</p>
                            <p className="mt-1 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                              {step.condition ? "condicional" : step.kind === "loop_until" ? `loop ${step.loopLimit}x` : `${step.retryAttempts} retry`}
                            </p>
                          </div>
                        </div>
                        {subflow ? (
                          <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">
                            Subfluxo: {subflow.title}
                          </div>
                        ) : null}
                      </button>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => moveStep(step.id, -1)}
                          disabled={!canEditFlow || index === 0}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c) disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <FiArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStep(step.id, 1)}
                          disabled={!canEditFlow || index === draft.steps.length - 1}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c) disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <FiArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateStep(step.id)}
                          disabled={!canEditFlow}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c) disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <FiCopy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStep(step.id)}
                          disabled={!canEditFlow || draft.steps.length === 1}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white text-(--tc-accent,#ef0001) disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  );
                })}
                </div>
              ) : null}
            </div>

            {showFlowSidebar ? (
              <aside className="space-y-4">
              {activePanel === "overview" ? (
                <article className="rounded-[22px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Novo fluxo</p>
                    <h4 className="mt-2 text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">Criar ou clonar</h4>
                  </div>
                  <FiPlus className="h-5 w-5 text-(--tc-accent,#ef0001)" />
                </div>
                <label className="mt-4 grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Nome do fluxo
                  <input
                    value={newFlowTitle}
                    onChange={(event) => setNewFlowTitle(event.target.value)}
                    placeholder="Ex.: Smart - onboarding docs"
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  />
                </label>
                <label className="mt-4 grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Template de script
                  <select
                    value={selectedTemplateId}
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  >
                    {AUTOMATION_STUDIO_SCRIPT_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => createCustomFlow("blank")}
                    disabled={!canEditFlow}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiCode className="h-4 w-4" />
                    Novo do zero
                  </button>
                  <button
                    type="button"
                    onClick={() => createCustomFlow("clone")}
                    disabled={!canEditFlow}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiCopy className="h-4 w-4" />
                    Clonar atual
                  </button>
                </div>
                {isCustomFlow ? (
                  <button
                    type="button"
                    onClick={deleteCustomFlow}
                    disabled={!canEditFlow}
                    className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiTrash2 className="h-4 w-4" />
                    Remover fluxo custom
                  </button>
                ) : null}
                </article>
              ) : null}

              {activePanel === "steps" ? (
                <article className="rounded-[22px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Biblioteca de ações</p>
                    <h4 className="mt-2 text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">Adicionar etapa</h4>
                  </div>
                  <FiLayers className="h-5 w-5 text-(--tc-accent,#ef0001)" />
                </div>
                <div className="mt-4 space-y-2">
                  {AUTOMATION_STUDIO_ACTION_LIBRARY.slice(0, 10).map((action) => (
                    <button
                      key={action.title}
                      type="button"
                      onClick={() => appendStep(action)}
                      disabled={!canEditFlow}
                      className="flex w-full items-start gap-3 rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-3 text-left transition hover:border-(--tc-accent,#ef0001) disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-(--tc-primary,#011848)">
                        <FiPlus className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-black tracking-[-0.02em] text-(--tc-text,#0b1a3c)">{action.title}</p>
                        <p className="mt-1 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{action.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
                </article>
              ) : null}
              </aside>
            ) : null}
          </div>
        </article>

        {showAssetSidebar ? (
          <aside className="space-y-4">
            <article className="rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
              <FiFolderPlus className="h-4 w-4" />
              Biblioteca de assets
            </div>
            <div className="mt-4 space-y-3">
              {visibleAssets.map((asset) => {
                const active = draft.boundAssetIds.includes(asset.id);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => toggleAsset(asset.id)}
                    disabled={!canEditFlow}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-(--tc-accent,#ef0001) bg-[#fff5f5]"
                        : "border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc)"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black tracking-[-0.02em] text-(--tc-text,#0b1a3c)">{asset.title}</p>
                      <span className="inline-flex rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
                        {asset.type}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{asset.summary}</p>
                  </button>
                );
              })}
            </div>

            <label className="mt-4 block text-sm font-semibold text-(--tc-text,#0b1a3c)">
              Upload rápido
              <input
                type="file"
                multiple
                onChange={(event) => {
                  addUploads(event.target.files);
                  event.currentTarget.value = "";
                }}
                disabled={!canEditFlow}
                className="mt-2 block w-full cursor-pointer rounded-2xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3 text-sm text-(--tc-text-secondary,#4b5563)"
              />
            </label>

            {draft.uploads.length > 0 ? (
              <div className="mt-4 space-y-2">
                {draft.uploads.map((upload) => (
                  <div
                    key={upload.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-(--tc-text,#0b1a3c)">{upload.name}</p>
                      <p className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">
                        {upload.type} • {formatBytes(upload.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeUpload(upload.id)}
                      disabled={!canEditFlow}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white text-(--tc-accent,#ef0001) disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
          </aside>
        ) : null}
      </div>

      {activePanel !== "files" ? (
        <div className={splitExecutionLayout ? "grid gap-4 2xl:grid-cols-[minmax(0,1.14fr)_minmax(380px,0.86fr)]" : "grid gap-4"}>
        {activePanel === "steps" ? (
          <article className="min-w-0 rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
            <FiCode className="h-4 w-4" />
            Configuração da etapa e do fluxo
          </div>
          {selectedStep ? (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Título
                  <input
                    value={selectedStep.title}
                    onChange={(event) => updateDraftStep(selectedStep.id, (step) => ({ ...step, title: event.target.value }))}
                    readOnly={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none read-only:cursor-default"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Tipo
                  <select
                    value={selectedStep.kind}
                    onChange={(event) =>
                      updateDraftStep(selectedStep.id, (step) => ({
                        ...step,
                        kind: event.target.value as AutomationStudioStepKind,
                      }))
                    }
                    disabled={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none disabled:cursor-not-allowed"
                  >
                    {AUTOMATION_STUDIO_ACTION_LIBRARY.map((action) => (
                      <option key={`${action.kind}-${action.title}`} value={action.kind}>
                        {action.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Selector / rota
                  <input
                    value={selectedStep.selector}
                    onChange={(event) => updateDraftStep(selectedStep.id, (step) => ({ ...step, selector: event.target.value }))}
                    readOnly={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none read-only:cursor-default"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Binding
                  <input
                    value={selectedStep.inputBinding}
                    onChange={(event) => updateDraftStep(selectedStep.id, (step) => ({ ...step, inputBinding: event.target.value }))}
                    readOnly={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none read-only:cursor-default"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Condição / if
                  <input
                    value={selectedStep.condition}
                    onChange={(event) => updateDraftStep(selectedStep.id, (step) => ({ ...step, condition: event.target.value }))}
                    readOnly={!canEditFlow}
                    placeholder="ex.: response.status === 202"
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none read-only:cursor-default"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Output para variável
                  <input
                    value={selectedStep.outputVariable}
                    onChange={(event) => updateDraftStep(selectedStep.id, (step) => ({ ...step, outputVariable: event.target.value }))}
                    readOnly={!canEditFlow}
                    placeholder="ex.: nextToken"
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none read-only:cursor-default"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Retry da etapa
                  <input
                    type="number"
                    min={0}
                    value={selectedStep.retryAttempts}
                    onChange={(event) =>
                      updateDraftStep(selectedStep.id, (step) => ({ ...step, retryAttempts: Number(event.target.value) || 0 }))
                    }
                    readOnly={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none read-only:cursor-default"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Backoff (ms)
                  <input
                    type="number"
                    min={0}
                    value={selectedStep.retryBackoffMs}
                    onChange={(event) =>
                      updateDraftStep(selectedStep.id, (step) => ({ ...step, retryBackoffMs: Number(event.target.value) || 0 }))
                    }
                    readOnly={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none read-only:cursor-default"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Loop máximo
                  <input
                    type="number"
                    min={1}
                    value={selectedStep.loopLimit}
                    onChange={(event) =>
                      updateDraftStep(selectedStep.id, (step) => ({ ...step, loopLimit: Number(event.target.value) || 1 }))
                    }
                    readOnly={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none read-only:cursor-default"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Grupo paralelo
                  <input
                    value={selectedStep.parallelKey}
                    onChange={(event) => updateDraftStep(selectedStep.id, (step) => ({ ...step, parallelKey: event.target.value }))}
                    readOnly={!canEditFlow}
                    placeholder="ex.: upload-lote-1"
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none read-only:cursor-default"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Subfluxo
                  <select
                    value={selectedStep.subflowId}
                    onChange={(event) => updateDraftStep(selectedStep.id, (step) => ({ ...step, subflowId: event.target.value }))}
                    disabled={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none disabled:cursor-not-allowed"
                  >
                    <option value="">Sem subfluxo</option>
                    {AUTOMATION_STUDIO_SUBFLOW_LIBRARY.map((subflow) => (
                      <option key={subflow.id} value={subflow.id}>
                        {subflow.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Fallback
                  <select
                    value={selectedStep.onError}
                    onChange={(event) =>
                      updateDraftStep(selectedStep.id, (step) => ({ ...step, onError: event.target.value as DraftStep["onError"] }))
                    }
                    disabled={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none disabled:cursor-not-allowed"
                  >
                    <option value="stop">Parar fluxo</option>
                    <option value="continue">Continuar</option>
                    <option value="fallback">Ir para fallback</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Etapa fallback
                  <input
                    value={selectedStep.fallbackTarget}
                    onChange={(event) => updateDraftStep(selectedStep.id, (step) => ({ ...step, fallbackTarget: event.target.value }))}
                    readOnly={!canEditFlow}
                    placeholder="ID ou nome da etapa"
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none read-only:cursor-default"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Aprovação
                  <input
                    value={selectedStep.approvalRole}
                    onChange={(event) => updateDraftStep(selectedStep.id, (step) => ({ ...step, approvalRole: event.target.value }))}
                    readOnly={!canEditFlow}
                    placeholder="analista-qa"
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none read-only:cursor-default"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Timeout (ms)
                  <input
                    type="number"
                    min={100}
                    value={selectedStep.timeoutMs}
                    onChange={(event) =>
                      updateDraftStep(selectedStep.id, (step) => ({ ...step, timeoutMs: Number(event.target.value) || 100 }))
                    }
                    readOnly={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none read-only:cursor-default"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c) md:col-span-2">
                  Resultado esperado
                  <input
                    value={selectedStep.expectedResult}
                    onChange={(event) => updateDraftStep(selectedStep.id, (step) => ({ ...step, expectedResult: event.target.value }))}
                    readOnly={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none read-only:cursor-default"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c) md:col-span-2">
                  Descrição operacional
                  <textarea
                    value={selectedStep.description}
                    onChange={(event) => updateDraftStep(selectedStep.id, (step) => ({ ...step, description: event.target.value }))}
                    readOnly={!canEditFlow}
                    rows={3}
                    className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3 text-sm leading-7 outline-none read-only:cursor-default"
                  />
                </label>
              </div>

              <div className="mt-5 rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Edição de script</p>
                    <p className="mt-2 text-sm leading-7 text-(--tc-text-secondary,#4b5563)">
                      Para não misturar configuração, mapeamentos e código, o editor completo fica na área Scripts.
                    </p>
                  </div>
                  <Link
                    href="/automacoes/scripts"
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white"
                  >
                    <FiCode className="h-4 w-4" />
                    Abrir editor
                  </Link>
                </div>
              </div>

            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-(--tc-border,#d7deea) px-4 py-6 text-sm text-(--tc-text-muted,#6b7280)">
              Nenhuma etapa disponível no fluxo atual.
            </div>
          )}
          </article>
        ) : null}

        {activePanel === "overview" || activePanel === "mappings" || activePanel === "results" ? (
          <aside className="space-y-4">
          {activePanel === "overview" ? (
            <article className="rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
              <FiUploadCloud className="h-4 w-4" />
              Triggers e runtime
            </div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                Trigger
                <select
                  value={draft.trigger.mode}
                  onChange={(event) => updateTrigger("mode", event.target.value)}
                  disabled={!canEditFlow}
                  className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none disabled:cursor-not-allowed"
                >
                  {AUTOMATION_STUDIO_TRIGGER_MODES.map((mode) => (
                    <option key={mode.id} value={mode.id}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-3 text-sm leading-7 text-(--tc-text-secondary,#4b5563)">
                {AUTOMATION_STUDIO_TRIGGER_MODES.find((mode) => mode.id === draft.trigger.mode)?.summary}
              </div>
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
                <span className="text-sm font-semibold text-(--tc-text,#0b1a3c)">Trigger habilitado</span>
                <input
                  type="checkbox"
                  checked={draft.trigger.enabled}
                  onChange={(event) => updateTrigger("enabled", event.target.checked)}
                  disabled={!canEditFlow}
                  className="h-4 w-4 accent-[#ef0001]"
                />
              </label>
              {draft.trigger.mode === "webhook" ? (
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Path do webhook
                  <input
                    value={draft.trigger.webhookPath}
                    onChange={(event) => updateTrigger("webhookPath", event.target.value)}
                    readOnly={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
                  />
                </label>
              ) : null}
              {draft.trigger.mode === "schedule" ? (
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Cron
                  <input
                    value={draft.trigger.cron}
                    onChange={(event) => updateTrigger("cron", event.target.value)}
                    readOnly={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
                  />
                </label>
              ) : null}
              {draft.trigger.mode === "file_watch" ? (
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Pasta monitorada
                  <input
                    value={draft.trigger.watchPath}
                    onChange={(event) => updateTrigger("watchPath", event.target.value)}
                    readOnly={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
                  />
                </label>
              ) : null}
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
                <span className="text-sm font-semibold text-(--tc-text,#0b1a3c)">Exigir aprovação humana no trigger</span>
                <input
                  type="checkbox"
                  checked={draft.trigger.requireApproval}
                  onChange={(event) => updateTrigger("requireApproval", event.target.checked)}
                  disabled={!canEditFlow}
                  className="h-4 w-4 accent-[#ef0001]"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Retry global
                  <input
                    type="number"
                    min={0}
                    value={draft.runtime.retryAttempts}
                    onChange={(event) => updateRuntime("retryAttempts", Number(event.target.value) || 0)}
                    readOnly={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Backoff global
                  <input
                    type="number"
                    min={0}
                    value={draft.runtime.retryBackoffMs}
                    onChange={(event) => updateRuntime("retryBackoffMs", Number(event.target.value) || 0)}
                    readOnly={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Paralelismo máximo
                  <input
                    type="number"
                    min={1}
                    value={draft.runtime.maxParallel}
                    onChange={(event) => updateRuntime("maxParallel", Number(event.target.value) || 1)}
                    readOnly={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Upload strategy
                  <select
                    value={draft.runtime.uploadStrategy}
                    onChange={(event) => updateRuntime("uploadStrategy", event.target.value)}
                    disabled={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none disabled:cursor-not-allowed"
                  >
                    <option value="standard">standard</option>
                    <option value="stream">stream</option>
                    <option value="base64-stream">base64-stream</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
                  <span className="text-sm font-semibold text-(--tc-text,#0b1a3c)">Modo debug</span>
                  <input
                    type="checkbox"
                    checked={draft.runtime.debugMode}
                    onChange={(event) => updateRuntime("debugMode", event.target.checked)}
                    disabled={!canEditFlow}
                    className="h-4 w-4 accent-[#ef0001]"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
                  <span className="text-sm font-semibold text-(--tc-text,#0b1a3c)">Notificar falha</span>
                  <input
                    type="checkbox"
                    checked={draft.runtime.notifyOnFailure}
                    onChange={(event) => updateRuntime("notifyOnFailure", event.target.checked)}
                    disabled={!canEditFlow}
                    className="h-4 w-4 accent-[#ef0001]"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Simulação
                  <select
                    value={draft.runtime.simulationMode}
                    onChange={(event) => updateRuntime("simulationMode", event.target.value)}
                    disabled={!canEditFlow}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none disabled:cursor-not-allowed"
                  >
                    <option value="safe">safe</option>
                    <option value="step">step</option>
                    <option value="full">full</option>
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
                  <span className="text-sm font-semibold text-(--tc-text,#0b1a3c)">Permitir escrita em produção</span>
                  <input
                    type="checkbox"
                    checked={draft.runtime.allowProductionWrite}
                    onChange={(event) => updateRuntime("allowProductionWrite", event.target.checked)}
                    disabled={!canEditFlow}
                    className="h-4 w-4 accent-[#ef0001]"
                  />
                </label>
              </div>
            </div>
            </article>
          ) : null}

          {activePanel === "mappings" ? (
            <article className="rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Variáveis e subfluxos</p>
                <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">Parâmetros dinâmicos</h3>
              </div>
              <button
                type="button"
                onClick={appendVariable}
                disabled={!canEditFlow}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-(--tc-border,#d7deea) bg-white text-(--tc-primary,#011848) disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiPlus className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {draft.variables.map((variable) => (
                <div key={variable.id} className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={variable.key}
                        onChange={(event) => updateVariable(variable.id, "key", event.target.value)}
                        readOnly={!canEditFlow}
                        className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                      />
                      <input
                        value={variable.value}
                        onChange={(event) => updateVariable(variable.id, "value", event.target.value)}
                        readOnly={!canEditFlow}
                        className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        value={variable.scope}
                        onChange={(event) => updateVariable(variable.id, "scope", event.target.value)}
                        disabled={!canEditFlow}
                        className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                      >
                        <option value="global">global</option>
                        <option value="local">local</option>
                      </select>
                      <select
                        value={variable.source}
                        onChange={(event) => updateVariable(variable.id, "source", event.target.value)}
                        disabled={!canEditFlow}
                        className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                      >
                        <option value="manual">manual</option>
                        <option value="environment">environment</option>
                        <option value="step_output">step_output</option>
                        <option value="api">api</option>
                        <option value="csv">csv</option>
                        <option value="database">database</option>
                      </select>
                    </div>
                    <textarea
                      value={variable.description}
                      onChange={(event) => updateVariable(variable.id, "description", event.target.value)}
                      readOnly={!canEditFlow}
                      rows={2}
                      className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm leading-6 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeVariable(variable.id)}
                      disabled={!canEditFlow}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiTrash2 className="h-4 w-4" />
                      Remover variável
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-violet-700">
                <FiShuffle className="h-4 w-4" />
                Biblioteca de subfluxos
              </div>
              <div className="mt-3 space-y-2">
                {AUTOMATION_STUDIO_SUBFLOW_LIBRARY.map((subflow: AutomationStudioSubflowTemplate) => (
                  <div key={subflow.id} className="rounded-2xl border border-violet-200 bg-white px-4 py-3">
                    <p className="text-sm font-black text-(--tc-text,#0b1a3c)">{subflow.title}</p>
                    <p className="mt-1 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{subflow.summary}</p>
                  </div>
                ))}
              </div>
            </div>
            </article>
          ) : null}

          {activePanel === "results" ? (
            <article className="rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Depuração e histórico</p>
                <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">Preview operacional</h3>
              </div>
              <button
                type="button"
                onClick={runPreparation}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white"
              >
                <FiPlay className="h-4 w-4" />
                Atualizar
              </button>
            </div>

            {runPreview ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {runPreview.metrics.map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">{metric.label}</p>
                    <p className="mt-2 text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{metric.value}</p>
                    <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{metric.detail}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-4 space-y-2 rounded-[24px] border border-(--tc-border,#e5e7eb) bg-[#071227] p-4 text-white">
              {(runPreview?.lines || [
                "Clique em Preparar execução para gerar um preview do fluxo atual.",
                "O preview usa empresa, ambiente, etapas habilitadas, variáveis, trigger e runtime configurados.",
              ]).map((line) => (
                <div key={line} className="flex items-start gap-2 text-sm leading-7 text-white/80">
                  <FiCheckCircle className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{line}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[24px] border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-black text-(--tc-text,#0b1a3c)">
                  <FiEye className="h-4 w-4 text-(--tc-accent,#ef0001)" />
                  Debug passo a passo
                </div>
                <span className="inline-flex rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
                  {draft.runtime.simulationMode}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDebugCursor((current) => Math.max(current - 1, 0))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"
                >
                  <FiArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDebugCursor((current) => Math.min(current + 1, Math.max(enabledSteps.length - 1, 0)))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"
                >
                  <FiArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDebugCursor(0)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
                >
                  <FiRotateCcw className="h-4 w-4" />
                  Reiniciar
                </button>
              </div>
              {debugStep ? (
                <div className="mt-4 rounded-2xl border border-(--tc-border,#d7deea) bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                    Passo {debugCursor + 1} de {enabledSteps.length}
                  </p>
                  <h4 className="mt-2 text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{debugStep.title}</h4>
                  <p className="mt-2 text-sm leading-7 text-(--tc-text-secondary,#4b5563)">{debugStep.description}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                      binding: {debugStep.inputBinding || "n/a"}
                    </div>
                    <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                      output: {debugStep.outputVariable || "n/a"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-(--tc-border,#d7deea) px-4 py-4 text-sm text-(--tc-text-muted,#6b7280)">
                  Nenhuma etapa habilitada para o modo debug.
                </div>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                <div className="flex items-center gap-2 text-sm font-black text-(--tc-text,#0b1a3c)">
                  <FiClock className="h-4 w-4 text-(--tc-accent,#ef0001)" />
                  Versões salvas
                </div>
                <div className="mt-3 space-y-2">
                  {draft.versions.length > 0 ? (
                    draft.versions.map((version) => (
                      <div key={version.id} className="rounded-2xl border border-(--tc-border,#d7deea) bg-white p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-(--tc-text,#0b1a3c)">{version.label}</p>
                            <p className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">
                              {version.savedAt} • {version.author}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => restoreVersion(version.id)}
                            disabled={!canEditFlow}
                            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c) disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FiRotateCcw className="h-3.5 w-3.5" />
                            Restaurar
                          </button>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{version.note}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-(--tc-border,#d7deea) px-4 py-4 text-sm text-(--tc-text-muted,#6b7280)">
                      Nenhuma versão manual salva ainda.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                <div className="flex items-center gap-2 text-sm font-black text-(--tc-text,#0b1a3c)">
                  <FiAlertCircle className="h-4 w-4 text-(--tc-accent,#ef0001)" />
                  Auditoria local
                </div>
                <div className="mt-3 space-y-2">
                  {draft.auditTrail.slice(0, 6).map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3">
                      <p className="text-sm font-semibold text-(--tc-text,#0b1a3c)">{entry.summary}</p>
                      <p className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">
                        {entry.createdAt} • {entry.actor}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                <div className="flex items-center gap-2 text-sm font-black text-(--tc-text,#0b1a3c)">
                  <FiPauseCircle className="h-4 w-4 text-(--tc-accent,#ef0001)" />
                  Regras críticas
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    draft.trigger.requireApproval
                      ? "O trigger exige aprovação humana antes de continuar o fluxo."
                      : "O trigger pode seguir automaticamente conforme o runtime.",
                    draft.runtime.uploadStrategy === "base64-stream"
                      ? "Uploads grandes estão configurados para estratégia base64-stream."
                      : `Uploads usam estratégia ${draft.runtime.uploadStrategy}.`,
                    draft.runtime.allowProductionWrite
                      ? "Escrita em produção está habilitada e exige revisão de escopo."
                      : "Produção segue protegida para evitar escrita destrutiva.",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm leading-7 text-(--tc-text,#0b1a3c)">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {canSeeLogs ? (
              <div className="rounded-[24px] border border-(--tc-border,#e5e7eb) bg-[#071227] p-4 text-white">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/58">
                  <FiEye className="h-4 w-4" />
                  Observabilidade avançada
                </div>
                <div className="mt-3 space-y-2">
                  {(runPreview?.technicalLines || [
                    "Aguardando preview para gerar log técnico detalhado.",
                    "Suporte técnico e líder TC recebem selectors, bindings, timeout e retries por etapa.",
                  ]).map((line) => (
                    <div key={line} className="flex items-start gap-2 text-sm leading-7 text-white/80">
                      <FiZap className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />
                      <span className="break-words font-mono text-[12px]">{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                <p className="text-sm font-semibold text-(--tc-text,#0b1a3c)">Logs técnicos, selectors internos e brain operacional ficam restritos a suporte técnico e líder TC.</p>
                <p className="mt-2 text-sm leading-7 text-(--tc-text-secondary,#4b5563)">
                  A identidade do studio permanece igual, mas a telemetria avançada não é exibida fora do escopo técnico.
                </p>
              </div>
            )}
            </article>
          ) : null}
          </aside>
        ) : null}
        </div>
      ) : null}
    </section>
  );
}
