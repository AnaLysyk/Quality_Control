import "server-only";

import type { AuthUser } from "@/backend/jwtAuth";
import {
  createManualTestCaseRecord,
  listTestCaseRecords,
} from "@/backend/test-cases/testCaseRepository";
import { canCreateTestCaseForCompany } from "@/backend/test-cases/testCasePermissions";
import type {
  CreateTestCaseInput,
  TestCasePriority,
  TestCaseRecord,
  TestCaseStatus,
  TestCaseType,
} from "@/backend/test-cases/types";
import type { AssistantScreenContext, AssistantToolAction } from "../types";
import { compactMultiline, formatValidationIssues, normalizeSearch, normalizeText } from "../helpers";
import type { AssistantExecutorResult } from "./types";

type StepInput = NonNullable<CreateTestCaseInput["steps"]>[number];

const DEFAULT_STATUS: TestCaseStatus = "draft";
const DEFAULT_TYPE: TestCaseType = "manual";
const DEFAULT_PRIORITY: TestCasePriority = "medium";

function cleanText(value: unknown, max = 1000) {
  return normalizeText(value, max);
}

function normalizePriority(value: unknown): TestCasePriority {
  const normalized = normalizeSearch(cleanText(value, 40));
  if (normalized === "critical" || normalized === "critica" || normalized === "critico") return "critical";
  if (normalized === "high" || normalized === "alta" || normalized === "urgente") return "high";
  if (normalized === "low" || normalized === "baixa") return "low";
  return DEFAULT_PRIORITY;
}

function normalizeStatus(value: unknown): TestCaseStatus {
  const normalized = normalizeSearch(cleanText(value, 40));
  if (normalized === "active" || normalized === "ativo") return "active";
  if (normalized === "review" || normalized === "revisao") return "review";
  if (normalized === "obsolete" || normalized === "obsoleto") return "obsolete";
  if (normalized === "archived" || normalized === "arquivado") return "archived";
  return DEFAULT_STATUS;
}

function normalizeType(value: unknown): TestCaseType {
  const normalized = normalizeSearch(cleanText(value, 40));
  if (normalized === "automated" || normalized === "automatizado") return "automated";
  if (normalized === "hybrid" || normalized === "hibrido") return "hybrid";
  return DEFAULT_TYPE;
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => cleanText(item, 60)).filter(Boolean))).slice(0, 12);
  }
  return cleanText(value, 300)
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeSteps(value: unknown) {
  if (!Array.isArray(value)) return [] as StepInput[];

  return value
    .map((item) => {
      const raw = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        action: cleanText(raw.action, 500),
        expectedResult: cleanText(raw.expectedResult, 500),
        data: cleanText(raw.data, 500) || null,
        notes: cleanText(raw.notes, 500) || null,
      };
    })
    .filter((step) => step.action || step.expectedResult)
    .slice(0, 12);
}

function validateCreatePayload(
  input: Record<string, unknown>,
  context: AssistantScreenContext,
  companySlug: string | null,
) {
  const title = cleanText(input.title, 120);
  const description = cleanText(input.description, 2000);
  const objective = cleanText(input.objective, 600);
  const preconditions = cleanText(input.preconditions, 1000);
  const postconditions = cleanText(input.postconditions, 1000);
  const steps = normalizeSteps(input.steps);
  const issues: string[] = [];

  if (title.length < 3) issues.push("Titulo do caso obrigatorio, com pelo menos 3 caracteres.");
  if (objective.length < 12) issues.push("Objetivo obrigatorio e precisa explicar o que sera validado.");
  if (!steps.length) issues.push("Inclua pelo menos um passo com acao e resultado esperado.");

  steps.forEach((step, index) => {
    if (!step.action) issues.push(`Passo ${index + 1}: acao obrigatoria.`);
    if (!step.expectedResult) issues.push(`Passo ${index + 1}: resultado esperado obrigatorio.`);
  });

  const payload: CreateTestCaseInput = {
    title,
    description: description || undefined,
    objective,
    preconditions: preconditions || undefined,
    postconditions: postconditions || undefined,
    type: normalizeType(input.type),
    status: normalizeStatus(input.status),
    priority: normalizePriority(input.priority),
    companyId: companySlug,
    applicationId: cleanText(input.applicationId, 120) || undefined,
    moduleId: cleanText(input.moduleId, 120) || context.module,
    testProjectCode: cleanText(input.testProjectCode, 40) || undefined,
    testProjectName: cleanText(input.testProjectName, 120) || undefined,
    suiteId: cleanText(input.suiteId, 120) || undefined,
    suiteName: cleanText(input.suiteName, 120) || undefined,
    featureId: cleanText(input.featureId, 120) || undefined,
    tags: normalizeTags(input.tags),
    steps,
  };

  return { ok: issues.length === 0, issues, payload };
}

function formatTestCaseCard(record: TestCaseRecord) {
  const testCase = record.testCase;
  const key = testCase.key ?? testCase.id;
  return [
    `${key} - ${testCase.title}`,
    `status: ${testCase.status} | prioridade: ${testCase.priority} | tipo: ${testCase.type}`,
    `empresa: ${testCase.companyId ?? "global"} | modulo: ${testCase.moduleId ?? "nao informado"}`,
    `passos: ${record.steps.length}`,
  ].join("\n");
}

async function findDuplicateTitle(title: string, companySlug: string | null) {
  const records = await listTestCaseRecords({
    companyId: companySlug,
  });
  const normalizedTitle = normalizeSearch(title);
  return records.find((record) => normalizeSearch(record.testCase.title) === normalizedTitle) ?? null;
}

export async function executeCreateTestCase(
  user: AuthUser,
  context: AssistantScreenContext,
  action: AssistantToolAction,
): Promise<AssistantExecutorResult> {
  const companySlug =
    cleanText(action.input.companySlug, 120) ||
    context.companySlug ||
    user.companySlug ||
    null;

  if (!canCreateTestCaseForCompany(user, companySlug)) {
    return {
      tool: "create_test_case",
      success: false,
      summary: "criacao bloqueada",
      reply: "Seu perfil atual nao pode criar casos de teste nesse contexto de empresa.",
    };
  }

  const validation = validateCreatePayload(action.input, context, companySlug);
  if (!validation.ok) {
    return {
      tool: "create_test_case",
      success: false,
      summary: "validacao do caso falhou",
      reply: compactMultiline([
        "Nao criei o caso porque o rascunho nao passou nas validacoes do repositorio.",
        "",
        formatValidationIssues(validation.issues),
      ].join("\n")),
    };
  }

  const duplicate = await findDuplicateTitle(validation.payload.title, companySlug);
  if (duplicate) {
    return {
      tool: "create_test_case",
      success: false,
      summary: "caso duplicado bloqueado",
      actions: [
        {
          kind: "prompt",
          label: "Resumir caso existente",
          prompt: `Resumir o caso de teste ${duplicate.testCase.key ?? duplicate.testCase.id}`,
        },
      ],
      reply: compactMultiline([
        "Nao criei outro caso porque ja existe um caso com o mesmo titulo nesse contexto.",
        "",
        formatTestCaseCard(duplicate),
      ].join("\n")),
    };
  }

  const record = await createManualTestCaseRecord(validation.payload, user.id);

  return {
    tool: "create_test_case",
    success: true,
    summary: record.testCase.key ?? record.testCase.id,
    actions: [
      {
        kind: "prompt",
        label: "Gerar automacao Playwright",
        prompt: `Gerar automacao Playwright para o caso ${record.testCase.key ?? record.testCase.id}`,
      },
      {
        kind: "prompt",
        label: "Resumir caso criado",
        prompt: `Resumir o caso de teste ${record.testCase.key ?? record.testCase.id}`,
      },
    ],
    reply: compactMultiline([
      "Caso de teste criado com sucesso no repositorio central.",
      "",
      formatTestCaseCard(record),
      "",
      "Ele ficou como rascunho para revisao antes de entrar no ciclo de execucao.",
    ].join("\n")),
  };
}

