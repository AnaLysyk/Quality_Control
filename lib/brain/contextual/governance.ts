import { BRIAN_SPEC_VERSION, isBrianImpulseType } from "./contracts";
import { stableId } from "./normalizer";
import type {
  BrianCapability,
  BrianContextCarrier,
  BrianDataClassification,
  BrianDataPolicyAction,
  BrianDomainDefinition,
  BrianEventSchema,
  BrianImpulseEnvelope,
  BrianPolicyDecision,
  BrianRedactionReport,
  BrianRiskLevel,
  BrianVisibilityScope,
} from "./types";

const BROAD_ROLES = new Set(["admin", "global_admin", "leader_tc", "lider_tc", "technical_support", "suporte_tecnico"]);

const SECRET_FIELD_PATTERN = /(api[_-]?key|token|secret|password|senha|cookie|authorization|client[_-]?secret|private[_-]?key)/i;
const SENSITIVE_FIELD_PATTERN = /(cpf|cnpj|document|telefone|phone|email|birth|nascimento)/i;
const PROMPT_INJECTION_PATTERN = /(ignore|ignorar|desconsidere|bypass|revele|mostre todos|show all|system prompt|developer message|sem permissÃ£o|without permission)/i;

export const BRIAN_DOMAIN_MAP: BrianDomainDefinition[] = [
  {
    id: "company",
    label: "Empresa",
    description: "Limite de tenant, cliente e dados organizacionais.",
    ownsNeuronTypes: ["company", "user", "role"],
    emitsImpulseTypes: ["permission.granted"],
  },
  {
    id: "defects",
    label: "Defeitos",
    description: "Defeitos, falhas funcionais, prioridade, severidade e impacto.",
    ownsNeuronTypes: ["defect", "flow", "release", "module"],
    emitsImpulseTypes: ["defect.created", "defect.updated", "defect.status_changed", "comment.added", "file.attached"],
  },
  {
    id: "support",
    label: "Suporte",
    description: "Chamados, comentÃ¡rios, reaberturas e relaÃ§Ã£o com defeitos.",
    ownsNeuronTypes: ["ticket", "comment", "attachment", "user"],
    emitsImpulseTypes: ["ticket.created", "ticket.updated", "ticket.reopened", "comment.added", "file.attached"],
  },
  {
    id: "test_repository",
    label: "RepositÃ³rio de testes",
    description: "Casos de teste, planos, execuÃ§Ãµes e evidÃªncias de qualidade.",
    ownsNeuronTypes: ["test_case", "test_run", "flow", "environment"],
    emitsImpulseTypes: ["test_case.created", "test_case.updated", "test_run.started", "test_run.failed"],
  },
  {
    id: "automation",
    label: "AutomaÃ§Ã£o",
    description: "GeraÃ§Ã£o, revisÃ£o e vÃ­nculo de automaÃ§Ãµes com casos de teste.",
    ownsNeuronTypes: ["automation", "test_case", "integration"],
    emitsImpulseTypes: ["automation.generated"],
  },
  {
    id: "release",
    label: "Release",
    description: "AprovaÃ§Ãµes, bloqueios, regressÃµes e risco de entrega.",
    ownsNeuronTypes: ["release", "risk", "blocker", "test_run"],
    emitsImpulseTypes: ["release.approved", "release.blocked", "test_run.failed"],
  },
  {
    id: "brian",
    label: "Brian",
    description: "Feedback, revisÃ£o, replay, polÃ­ticas e saÃºde do cÃ©rebro contextual.",
    ownsNeuronTypes: ["decision", "risk", "integration"],
    emitsImpulseTypes: ["neuron.feedback_created"],
  },
];

export const BRIAN_EVENT_SCHEMAS: BrianEventSchema[] = [
  {
    type: "defect.created",
    version: 1,
    producer: "defects",
    consumer: "brian_processing_pipeline",
    requiredFields: ["title"],
    optionalFields: ["id", "entityId", "description", "companyId", "moduleKey", "release", "priority", "severity", "tags"],
    activates: ["defect", "user", "company", "module", "release", "flow"],
    createsRelations: ["belongs_to", "created_by", "linked_to", "impacts"],
    requiredEvidence: ["route", "payload"],
    compatibility: "backward",
  },
  {
    type: "ticket.created",
    version: 1,
    producer: "support",
    consumer: "brian_processing_pipeline",
    requiredFields: ["title"],
    optionalFields: ["id", "entityId", "description", "companyId", "moduleKey", "priority", "status"],
    activates: ["ticket", "user", "company", "module"],
    createsRelations: ["belongs_to", "created_by"],
    requiredEvidence: ["route", "payload"],
    compatibility: "backward",
  },
  {
    type: "ticket.reopened",
    version: 1,
    producer: "support",
    consumer: "brian_processing_pipeline",
    requiredFields: ["title"],
    optionalFields: ["reason", "description", "status", "companyId", "moduleKey"],
    activates: ["ticket", "user", "company", "module", "risk"],
    createsRelations: ["belongs_to", "reopened_by"],
    requiredEvidence: ["route", "payload"],
    compatibility: "backward",
  },
  {
    type: "test_run.failed",
    version: 1,
    producer: "test_repository",
    consumer: "brian_processing_pipeline",
    requiredFields: ["title"],
    optionalFields: ["environment", "release", "description", "project", "application"],
    activates: ["test_run", "environment", "release", "company", "module"],
    createsRelations: ["belongs_to", "failed_in", "linked_to"],
    requiredEvidence: ["route", "payload"],
    compatibility: "backward",
  },
  {
    type: "automation.generated",
    version: 1,
    producer: "automation",
    consumer: "brian_processing_pipeline",
    requiredFields: ["title"],
    optionalFields: ["testCaseId", "description", "language", "framework"],
    activates: ["automation", "test_case", "user", "company", "module"],
    createsRelations: ["generated_by", "automated_by", "belongs_to"],
    requiredEvidence: ["route", "payload"],
    compatibility: "backward",
  },
  {
    type: "release.approved",
    version: 1,
    producer: "release",
    consumer: "brian_processing_pipeline",
    requiredFields: ["title"],
    optionalFields: ["release", "description", "approvedBy", "qualitySummary"],
    activates: ["release", "user", "company", "module"],
    createsRelations: ["belongs_to", "approved_by"],
    requiredEvidence: ["route", "payload"],
    compatibility: "backward",
  },
];

export const BRIAN_CAPABILITIES: BrianCapability[] = [
  {
    id: "summarize_screen",
    label: "Resumir tela",
    description: "Resume o contexto autorizado da tela atual.",
    module: "brian",
    requiredPermissions: ["brain:read"],
    allowedRoles: ["admin", "leader_tc", "technical_support", "testing_company_user", "company_user"],
    requiresConfirmation: false,
    requiresApproval: false,
    riskLevel: "low",
    inputSchema: { pathname: "string" },
    outputSchema: { summary: "string", contextSnapshotId: "string" },
  },
  {
    id: "explain_node",
    label: "Explicar neurÃ´nio",
    description: "Explica por que um neurÃ´nio existe e por que estÃ¡ visÃ­vel.",
    module: "brian",
    requiredPermissions: ["brain:read"],
    allowedRoles: ["admin", "leader_tc", "technical_support", "testing_company_user", "company_user"],
    requiresConfirmation: false,
    requiresApproval: false,
    riskLevel: "low",
    inputSchema: { neuronId: "string" },
    outputSchema: { explanation: "string", evidenceIds: "string[]" },
  },
  {
    id: "create_defect",
    label: "Criar defeito",
    description: "Cria um defeito apÃ³s validaÃ§Ã£o de empresa, mÃ³dulo e confirmaÃ§Ã£o humana.",
    module: "defects",
    requiredPermissions: ["defects:create"],
    allowedRoles: ["admin", "leader_tc", "technical_support", "testing_company_user"],
    requiresConfirmation: true,
    requiresApproval: false,
    riskLevel: "medium",
    inputSchema: { title: "string", companyId: "string?", moduleKey: "string?" },
    outputSchema: { defectId: "string", impulseId: "string" },
  },
  {
    id: "generate_automation",
    label: "Gerar automaÃ§Ã£o",
    description: "Gera automaÃ§Ã£o a partir de caso de teste autorizado.",
    module: "automation",
    requiredPermissions: ["automation:create"],
    allowedRoles: ["admin", "leader_tc", "testing_company_user"],
    requiresConfirmation: true,
    requiresApproval: false,
    riskLevel: "medium",
    inputSchema: { testCaseId: "string" },
    outputSchema: { automationId: "string", impulseId: "string" },
  },
  {
    id: "replay_context",
    label: "Reprocessar contexto",
    description: "Reprocessa impulsos antigos e reconstrÃ³i projeÃ§Ãµes.",
    module: "brian",
    requiredPermissions: ["brain:admin", "brain:replay"],
    allowedRoles: ["admin", "global_admin"],
    requiresConfirmation: true,
    requiresApproval: true,
    riskLevel: "critical",
    inputSchema: { from: "date?", to: "date?", companyId: "string?", moduleKey: "string?" },
    outputSchema: { replayId: "string", accepted: "boolean" },
  },
];

export const BRIAN_FEATURE_FLAGS = {
  "brian.enabled": false,
  "brian.shadow-mode.enabled": true,
  "brian.impulses.enabled": true,
  "brian.neurons.enabled": true,
  "brian.synapses.enabled": true,
  "brian.narratives.enabled": true,
  "brian.graph.enabled": false,
  "brian.chat-context.enabled": false,
  "brian.review-queue.enabled": true,
  "brian.health.enabled": true,
} as const;

export const BRIAN_CONTEXT_BUDGETS = {
  admin: { maxNeurons: 80, maxSynapses: 140, maxEvidenceSnippets: 40, maxRecentImpulses: 50, maxTokensApprox: 9000 },
  leader_tc: { maxNeurons: 48, maxSynapses: 90, maxEvidenceSnippets: 28, maxRecentImpulses: 35, maxTokensApprox: 6500 },
  technical_support: { maxNeurons: 44, maxSynapses: 80, maxEvidenceSnippets: 30, maxRecentImpulses: 40, maxTokensApprox: 6000 },
  testing_company_user: { maxNeurons: 32, maxSynapses: 52, maxEvidenceSnippets: 20, maxRecentImpulses: 24, maxTokensApprox: 4500 },
  company_user: { maxNeurons: 20, maxSynapses: 32, maxEvidenceSnippets: 12, maxRecentImpulses: 16, maxTokensApprox: 3200 },
} as const;

export const BRIAN_DATA_POLICIES: Array<{
  fieldPattern: RegExp;
  classification: BrianDataClassification;
  action: BrianDataPolicyAction;
}> = [
  { fieldPattern: SECRET_FIELD_PATTERN, classification: "secret", action: "block" },
  { fieldPattern: /cpf|document/i, classification: "sensitive", action: "redact" },
  { fieldPattern: /email/i, classification: "sensitive", action: "mask" },
  { fieldPattern: /telefone|phone/i, classification: "sensitive", action: "mask" },
];

function normalize(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function hasPermission(context: BrianContextCarrier, required: string[]) {
  if (!required.length) return true;
  const permissions = new Set(context.permissions.map(normalize));
  return required.every((permission) => permissions.has(normalize(permission)));
}

function roleAllowed(role: string, allowedRoles: string[]) {
  const normalizedRole = normalize(role);
  return BROAD_ROLES.has(normalizedRole) || allowedRoles.map(normalize).includes(normalizedRole);
}

export function getBrianEventSchema(type: string, version = 1) {
  return BRIAN_EVENT_SCHEMAS.find((schema) => schema.type === type && schema.version === version) ?? null;
}

export function validateBrianImpulseContract(impulse: BrianImpulseEnvelope): BrianPolicyDecision {
  if (impulse.specversion !== BRIAN_SPEC_VERSION) {
    return { allowed: false, reason: `VersÃ£o de envelope invÃ¡lida: ${impulse.specversion}` };
  }
  if (!isBrianImpulseType(impulse.type)) {
    return { allowed: false, reason: `Tipo de impulso nÃ£o registrado: ${impulse.type}` };
  }
  const schema = getBrianEventSchema(impulse.type, impulse.schemaVersion);
  if (!schema) {
    return { allowed: false, reason: `Schema nÃ£o registrado para ${impulse.type}.v${impulse.schemaVersion}` };
  }
  const missing = schema.requiredFields.filter((field) => impulse.data[field] == null || impulse.data[field] === "");
  if (missing.length) {
    return {
      allowed: false,
      reason: `Payload sem campos obrigatÃ³rios: ${missing.join(", ")}`,
      requiredPermissions: missing,
    };
  }
  return { allowed: true, reason: "Contrato do impulso validado." };
}

export function resolveBrianCapability(id: string) {
  return BRIAN_CAPABILITIES.find((capability) => capability.id === id) ?? null;
}

export function decideBrianCapabilityAccess(context: BrianContextCarrier, capabilityId: string): BrianPolicyDecision {
  const capability = resolveBrianCapability(capabilityId);
  if (!capability) return { allowed: false, reason: `Capacidade nÃ£o registrada: ${capabilityId}` };
  if (!roleAllowed(context.role, capability.allowedRoles)) {
    return {
      allowed: false,
      reason: `Perfil ${context.role} nÃ£o pode executar ${capabilityId}.`,
      requiredPermissions: capability.requiredPermissions,
    };
  }
  if (!hasPermission(context, capability.requiredPermissions)) {
    return {
      allowed: false,
      reason: `PermissÃµes insuficientes para ${capabilityId}.`,
      requiredPermissions: capability.requiredPermissions,
    };
  }
  return {
    allowed: true,
    reason: `Capacidade ${capabilityId} autorizada pelo Control Plane.`,
    requiredPermissions: capability.requiredPermissions,
    requiresConfirmation: capability.requiresConfirmation,
    requiresApproval: capability.requiresApproval,
  };
}

export function decideBrianVisibility(context: BrianContextCarrier, scope: BrianVisibilityScope): BrianPolicyDecision {
  if (!roleAllowed(context.role, scope.allowedRoles)) {
    return { allowed: false, reason: "Perfil fora do escopo de visibilidade.", requiredPermissions: scope.requiredPermissions };
  }
  if (!hasPermission(context, scope.requiredPermissions)) {
    return { allowed: false, reason: "PermissÃµes insuficientes para ativar contexto.", requiredPermissions: scope.requiredPermissions };
  }
  const contextCompany = normalize(context.companyId ?? context.companySlug);
  const scopeCompany = normalize(scope.companyId ?? scope.companySlug);
  if (scopeCompany && contextCompany && scopeCompany !== contextCompany && !BROAD_ROLES.has(normalize(context.role))) {
    return { allowed: false, reason: "Tenant/company boundary bloqueou contexto de outra empresa." };
  }
  if (scope.dataClassification === "secret") {
    return { allowed: false, reason: "Dados secretos nunca entram no contexto do Brian." };
  }
  return { allowed: true, reason: "Visibilidade autorizada." };
}

function maskEmail(value: string) {
  const [name, domain] = value.split("@");
  if (!domain) return "***";
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskGeneric(value: string) {
  if (value.length <= 4) return "***";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function redactCpfLike(value: string) {
  return value.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "***.***.***-**");
}

function classifyField(field: string) {
  return BRIAN_DATA_POLICIES.find((policy) => policy.fieldPattern.test(field)) ?? null;
}

function sanitizeValue(field: string, value: unknown, report: BrianRedactionReport): unknown {
  const policy = classifyField(field);
  if (policy?.action === "block") {
    report.blockedFields.push(field);
    return "[blocked]";
  }

  if (typeof value === "string") {
    const promptSignal = PROMPT_INJECTION_PATTERN.test(value);
    if (promptSignal) report.promptInjectionSignals.push(field);

    if (policy?.action === "mask") {
      report.maskedFields.push(field);
      return field.toLowerCase().includes("email") ? maskEmail(value) : maskGeneric(value);
    }
    if (policy?.action === "redact" || SENSITIVE_FIELD_PATTERN.test(field)) {
      report.redactedFields.push(field);
      return redactCpfLike(value);
    }
    return redactCpfLike(value);
  }

  if (Array.isArray(value)) return value.map((item, index) => sanitizeValue(`${field}[${index}]`, item, report));

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        sanitizeValue(`${field}.${key}`, nested, report),
      ]),
    );
  }

  return value;
}

export function sanitizeBrianData(data: Record<string, unknown>) {
  const report: BrianRedactionReport = {
    redactedFields: [],
    maskedFields: [],
    blockedFields: [],
    promptInjectionSignals: [],
  };
  const sanitized = Object.fromEntries(
    Object.entries(data).map(([field, value]) => [field, sanitizeValue(field, value, report)]),
  );
  return { data: sanitized, report };
}

export function sanitizeBrianImpulse(impulse: BrianImpulseEnvelope) {
  const sanitized = sanitizeBrianData(impulse.data);
  return {
    impulse: { ...impulse, data: sanitized.data },
    report: sanitized.report,
  };
}

export function buildBrianChangeId(targetType: string, targetId: string, changedAt = new Date().toISOString()) {
  return stableId("brian_config_change", [targetType, targetId, changedAt]);
}

export function riskRequiresHumanOversight(riskLevel: BrianRiskLevel) {
  return riskLevel === "high" || riskLevel === "critical";
}

