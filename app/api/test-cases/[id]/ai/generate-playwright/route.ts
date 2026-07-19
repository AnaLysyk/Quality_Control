import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { canAccessTestCaseRecord } from "@/backend/test-cases/testCasePermissions";
import { getTestCaseRecord } from "@/backend/test-cases/testCaseRepository";
import { createAutomationDraft, recordAutomationAgentRun } from "@/backend/test-cases/automationDraftsStore";

type GeneratedDraftOutput = {
  specFile: string;
  testTitle: string;
  playwrightProject: string;
  environment: string;
  tags: string[];
  command: string;
  specCode: string;
  pomPath: string;
  pomCode: string;
  fixturePath: string;
  fixtureCode: string;
  review: {
    assertions: string;
    locators: string;
    risks: string[];
  };
};

function validateGeneratedOutput(output: GeneratedDraftOutput, caseTag: string) {
  const errors: string[] = [];
  if (!output.specFile?.trim()) errors.push("specFile obrigatório.");
  if (!output.specCode?.trim()) errors.push("specCode obrigatório.");
  if (!output.command?.trim()) errors.push("command obrigatório.");
  if (output.command && !output.command.trim().startsWith("npx playwright test")) {
    errors.push("command deve iniciar com 'npx playwright test'.");
  }
  if (!Array.isArray(output.tags) || !output.tags.includes(caseTag)) {
    errors.push(`tags deve conter ${caseTag}.`);
  }
  if (!output.review || typeof output.review !== "object") {
    errors.push("review obrigatório.");
  }
  return errors;
}

function sanitizeTag(tag: string) {
  return tag.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-");
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const record = await getTestCaseRecord(id);
  if (!record) return NextResponse.json({ message: "Caso não encontrado" }, { status: 404 });
  if (!canAccessTestCaseRecord(user, record)) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const project = typeof body.playwrightProject === "string" && body.playwrightProject.trim() ? body.playwrightProject.trim() : "chromium";
  const environment = typeof body.environment === "string" && body.environment.trim() ? body.environment.trim() : "homolog";
  const describeLabel = typeof body.testDescribe === "string" && body.testDescribe.trim() ? body.testDescribe.trim() : "Repositório de Casos";
  const caseKey = record.testCase.key || "tc-sem-chave";
  const caseTag = `@${sanitizeTag(caseKey)}`;
  const baseTitle = record.testCase.title || "caso sem título";
  const specFile = typeof body.specFile === "string" && body.specFile.trim()
    ? body.specFile.trim()
    : `tests-e2e/repository/${sanitizeTag(caseKey)}.spec.ts`;
  const testTitle = typeof body.testTitle === "string" && body.testTitle.trim()
    ? body.testTitle.trim()
    : `deve validar ${baseTitle.toLowerCase()}`;

  const stepsCode = (record.steps || [])
    .map((step) => `    await test.step(${JSON.stringify(step.action)}, async () => {\n      // Esperado: ${step.expectedResult}\n    });`)
    .join("\n\n");

  const specCode = `import { expect, test } from "../fixtures/test";\n\ntest.describe(${JSON.stringify(describeLabel)}, () => {\n  test(${JSON.stringify(`${caseTag} ${testTitle}`)}, async ({ page }) => {\n${stepsCode || "    await expect(page).toBeTruthy();"}\n  });\n});\n`;

  const pomPath = `tests-e2e/pages/${sanitizeTag(caseKey)}.page.ts`;
  const pomCode = `import type { Page } from "@playwright/test";\n\nexport class ${sanitizeTag(caseKey).replace(/(^|-)([a-z])/g, (_, p1, p2) => `${p2.toUpperCase()}`)}Page {\n  constructor(readonly page: Page) {}\n}\n`;

  const fixturePath = "tests-e2e/fixtures/generated.fixture.ts";
  const fixtureCode = `export const generatedFixture = {\n  environment: ${JSON.stringify(environment)},\n};\n`;

  const command = `npx playwright test ${specFile} --grep ${caseTag} --project=${project}`;

  const generated: GeneratedDraftOutput = {
    specFile,
    testTitle,
    playwrightProject: project,
    environment,
    tags: [caseTag, "@ai-generated"],
    command,
    specCode,
    pomPath,
    pomCode,
    fixturePath,
    fixtureCode,
    review: {
      assertions: "Adicionar expects específicos por passo antes de publicar.",
      locators: "Preferir getByRole/getByTestId no refinamento.",
      risks: [],
    },
  };

  const schemaErrors = validateGeneratedOutput(generated, caseTag);
  if (schemaErrors.length > 0) {
    await recordAutomationAgentRun(
      record.testCase.id,
      user.id,
      "PlaywrightSpecAgent",
      {
        testCaseId: record.testCase.id,
        key: caseKey,
        steps: record.steps.length,
        project,
        environment,
      },
      {
        generated,
        schemaErrors,
      },
      "failed",
      `Output schema inválido: ${schemaErrors.join(" ")}`,
    );

    return NextResponse.json(
      {
        message: "Output schema inválido para draft de automação.",
        errors: schemaErrors,
      },
      { status: 422 },
    );
  }

  const draft = await createAutomationDraft(record.testCase.id, user.id, {
    generatedBy: "ai",
    status: "draft",
    maturityStatus: "ai_generated",
    approvalState: "awaiting_qa_review",
    specFile,
    specCode,
    pomPath,
    pomCode,
    fixturePath,
    fixtureCode,
    command,
    reviewNotes: "Draft gerado por IA. Revisar locators/assertions antes de vincular.",
  });

  await recordAutomationAgentRun(
    record.testCase.id,
    user.id,
    "PlaywrightSpecAgent",
    {
      testCaseId: record.testCase.id,
      key: caseKey,
      steps: record.steps.length,
      project,
      environment,
    },
    generated,
    "completed",
  );

  return NextResponse.json({
    testCaseId: record.testCase.id,
    generated,
    draft,
  });
}
