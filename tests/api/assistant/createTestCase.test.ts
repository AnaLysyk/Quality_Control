jest.mock("@/backend/test-cases/testCaseRepository", () => ({
  createManualTestCaseRecord: jest.fn().mockResolvedValue({
    testCase: {
      id: "tc-1",
      key: "TC-999",
      title: "Validar exportacao do dashboard",
      status: "draft",
      priority: "high",
      type: "manual",
      companyId: "acme",
      moduleId: "test_plans",
      tags: ["assistant-ai"],
    },
    steps: [
      { id: "s1", action: "Acessar dashboard", expectedResult: "Dashboard carregado" },
      { id: "s2", action: "Exportar CSV", expectedResult: "Arquivo gerado" },
    ],
    versions: [],
  }),
  listTestCaseRecords: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/backend/test-cases/testCasePermissions", () => ({
  canCreateTestCaseForCompany: jest.fn().mockReturnValue(true),
}));

import { executeCreateTestCase } from "@/backend/assistant/tools/createTestCase";
import { createManualTestCaseRecord, listTestCaseRecords } from "@/backend/test-cases/testCaseRepository";
import { canCreateTestCaseForCompany } from "@/backend/test-cases/testCasePermissions";
import type { AssistantScreenContext, AssistantToolAction } from "@/backend/assistant/types";
import type { AuthUser } from "@/backend/jwtAuth";

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    email: "ana@test.com",
    isGlobalAdmin: false,
    role: "empresa",
    companySlug: "acme",
    companyId: "c1",
    companySlugs: ["acme"],
    permissions: {},
    ...overrides,
  } as AuthUser;
}

function makeContext(overrides: Partial<AssistantScreenContext> = {}): AssistantScreenContext {
  return {
    route: "/empresas/acme/planos-de-teste",
    module: "test_plans",
    screenLabel: "Planos e casos de teste",
    screenSummary: "",
    companySlug: "acme",
    entityType: "screen",
    entityId: null,
    suggestedPrompts: [],
    ...overrides,
  };
}

function makeAction(overrides: Partial<AssistantToolAction["input"]> = {}): AssistantToolAction {
  return {
    kind: "tool",
    label: "Criar caso no repositorio",
    tool: "create_test_case",
    input: {
      title: "Validar exportacao do dashboard",
      objective: "Validar que o dashboard exporta CSV corretamente",
      description: "Fluxo criado pelo assistente.",
      priority: "alta",
      companySlug: "acme",
      tags: ["assistant-ai"],
      steps: [
        { action: "Acessar dashboard", expectedResult: "Dashboard carregado" },
        { action: "Exportar CSV", expectedResult: "Arquivo gerado" },
      ],
      ...overrides,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (canCreateTestCaseForCompany as jest.Mock).mockReturnValue(true);
  (listTestCaseRecords as jest.Mock).mockResolvedValue([]);
});

describe("executeCreateTestCase", () => {
  it("rejects users outside the company scope", async () => {
    (canCreateTestCaseForCompany as jest.Mock).mockReturnValue(false);

    const result = await executeCreateTestCase(makeUser(), makeContext(), makeAction());

    expect(result.success).toBe(false);
    expect(result.tool).toBe("create_test_case");
    expect(createManualTestCaseRecord).not.toHaveBeenCalled();
  });

  it("rejects invalid drafts before persisting", async () => {
    const result = await executeCreateTestCase(makeUser(), makeContext(), makeAction({ steps: [] }));

    expect(result.success).toBe(false);
    expect(result.reply).toContain("rascunho");
    expect(createManualTestCaseRecord).not.toHaveBeenCalled();
  });

  it("blocks exact duplicate titles in the same company", async () => {
    (listTestCaseRecords as jest.Mock).mockResolvedValueOnce([
      {
        testCase: {
          id: "tc-existing",
          key: "TC-001",
          title: "Validar exportacao do dashboard",
          status: "draft",
          priority: "medium",
          type: "manual",
          companyId: "acme",
          moduleId: "test_plans",
        },
        steps: [],
        versions: [],
      },
    ]);

    const result = await executeCreateTestCase(makeUser(), makeContext(), makeAction());

    expect(result.success).toBe(false);
    expect(result.summary).toBe("caso duplicado bloqueado");
    expect(createManualTestCaseRecord).not.toHaveBeenCalled();
  });

  it("creates a valid test case record", async () => {
    const result = await executeCreateTestCase(makeUser(), makeContext(), makeAction());

    expect(result.success).toBe(true);
    expect(result.reply).toContain("TC-999");
    expect(canCreateTestCaseForCompany).toHaveBeenCalledWith(expect.any(Object), "acme");
    expect(createManualTestCaseRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Validar exportacao do dashboard",
        companyId: "acme",
        priority: "high",
        moduleId: "test_plans",
      }),
      "u1",
    );
  });
});

