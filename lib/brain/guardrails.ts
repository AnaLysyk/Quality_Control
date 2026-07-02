export type GuardrailDecision = {
  allowed: boolean;
  guardrail: string;
  reason?: string;
  severity?: "low" | "medium" | "high";
};

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|system)\s+instructions/i,
  /override\s+(security|policy|guardrail)/i,
  /reveal\s+(all\s+)?(users|tokens|secrets|passwords)/i,
  /act\s+as\s+system/i,
];

const SENSITIVE_DATA_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /authorization\s*:/i,
  /-----begin\s+(rsa|ec|private)\s+key-----/i,
];

const DANGEROUS_TOOL_ACTIONS = [
  "database.raw",
  "github.publish",
  "filesystem.delete",
  "mcp.external_publish",
];

export function promptInjectionGuardrail(input: string): GuardrailDecision {
  const text = String(input ?? "").trim();
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        allowed: false,
        guardrail: "PromptInjectionGuardrail",
        reason: "Entrada contÃ©m padrÃ£o de prompt injection e foi bloqueada.",
        severity: "high",
      };
    }
  }
  return { allowed: true, guardrail: "PromptInjectionGuardrail" };
}

export function sensitiveDataGuardrail(input: string): GuardrailDecision {
  const text = String(input ?? "").trim();
  for (const pattern of SENSITIVE_DATA_PATTERNS) {
    if (pattern.test(text)) {
      return {
        allowed: false,
        guardrail: "SensitiveDataGuardrail",
        reason: "Comando solicita dado sensÃ­vel sem fluxo autorizado.",
        severity: "high",
      };
    }
  }
  return { allowed: true, guardrail: "SensitiveDataGuardrail" };
}

export function toolUseGuardrail(toolAction: string): GuardrailDecision {
  const normalized = String(toolAction ?? "").trim().toLowerCase();
  if (DANGEROUS_TOOL_ACTIONS.includes(normalized)) {
    return {
      allowed: false,
      guardrail: "ToolUseGuardrail",
      reason: `AÃ§Ã£o de ferramenta nÃ£o permitida: ${toolAction}`,
      severity: "high",
    };
  }
  return { allowed: true, guardrail: "ToolUseGuardrail" };
}

export function scopeGuardrail(options: {
  requestedCompanySlug?: string | null;
  allowedCompanySlugs: Set<string>;
  hasGlobalVisibility: boolean;
}): GuardrailDecision {
  const requested = options.requestedCompanySlug?.trim().toLowerCase();
  if (!requested) return { allowed: true, guardrail: "ScopeGuardrail" };
  if (options.hasGlobalVisibility) return { allowed: true, guardrail: "ScopeGuardrail" };
  if (!options.allowedCompanySlugs.has(requested)) {
    return {
      allowed: false,
      guardrail: "ScopeGuardrail",
      reason: `Escopo nÃ£o permitido para empresa ${requested}.`,
      severity: "high",
    };
  }
  return { allowed: true, guardrail: "ScopeGuardrail" };
}

export function outputValidationGuardrail(options: {
  hasEvidence: boolean;
  evidenceCount: number;
  confidence: number;
}): GuardrailDecision {
  if (!options.hasEvidence || options.evidenceCount <= 0) {
    return {
      allowed: false,
      guardrail: "OutputValidationGuardrail",
      reason: "Sem evidÃªncia suficiente no Brain para resposta segura.",
      severity: "medium",
    };
  }
  if (options.confidence < 0.3) {
    return {
      allowed: false,
      guardrail: "OutputValidationGuardrail",
      reason: "ConfianÃ§a baixa para resposta conclusiva.",
      severity: "medium",
    };
  }
  return { allowed: true, guardrail: "OutputValidationGuardrail" };
}

export function runAllGuardrails(input: string) {
  const checks = [promptInjectionGuardrail(input), sensitiveDataGuardrail(input)];
  const blocked = checks.find((item) => !item.allowed);
  return {
    allowed: !blocked,
    blocked,
    checks,
  };
}

