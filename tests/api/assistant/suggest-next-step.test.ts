jest.mock("@/database/prismaClient", () => ({
  prisma: {
    brainMemory: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("@/backend/permissionMatrix", () => ({
  hasPermissionAccess: jest.fn(),
}));

jest.mock("@/backend/assistant/data", () => ({
  isEmpresaUser: jest.fn(),
}));

import { toolSuggestNextStep } from "@/backend/assistant/tools/suggestNextStep";
import { hasPermissionAccess } from "@/backend/permissionMatrix";
import { prisma } from "@/database/prismaClient";
import { isEmpresaUser } from "@/backend/assistant/data";

const memoryFindMany = prisma.brainMemory.findMany as jest.Mock;
const permission = hasPermissionAccess as jest.MockedFunction<typeof hasPermissionAccess>;
const empresaUser = isEmpresaUser as jest.MockedFunction<typeof isEmpresaUser>;

const user = { permissions: [] } as never;

function context(module: string, route = `/${module}`) {
  return { module, route } as never;
}

describe("toolSuggestNextStep", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    memoryFindMany.mockResolvedValue([]);
    permission.mockReturnValue(false);
    empresaUser.mockReturnValue(false);
  });

  it("prioriza sugestões da fila de solicitações", async () => {
    const result = await toolSuggestNextStep(
      user,
      context("dashboard", "/admin/access-requests/pending"),
    );

    expect(result.actions).toHaveLength(4);
    expect(result.actions[0]).toMatchObject({
      label: "Buscar uma pessoa na fila de solicitações",
      prompt: "Buscar uma pessoa na fila de solicitações",
    });
  });

  it("inclui ações de criação no suporte quando há permissão", async () => {
    permission.mockImplementation((_permissions, module) => module === "tickets");

    const result = await toolSuggestNextStep(user, context("support"));

    expect(result.actions.map((action) => action.label)).toEqual([
      "Buscar tickets de alta prioridade sem responsável",
      "Resumir um chamado pelo ID para acelerar triagem",
      "Transformar um relato em chamado estruturado",
      "Criar novo ticket a partir de descrição",
    ]);
  });

  it("limita o suporte às sugestões de leitura sem permissão", async () => {
    const result = await toolSuggestNextStep(user, context("support"));

    expect(result.actions.map((action) => action.label)).toEqual([
      "Buscar tickets de alta prioridade sem responsável",
      "Resumir um chamado pelo ID para acelerar triagem",
    ]);
  });

  it("usa sugestões empresariais para usuário de empresa", async () => {
    empresaUser.mockReturnValue(true);

    const result = await toolSuggestNextStep(user, context("company"));

    expect(result.actions[0]?.label).toBe("Resumir status atual da minha empresa");
    expect(result.actions[3]?.label).toBe("Checar status dos planos de release");
  });

  it("adiciona dicas do Brain e mantém fallback genérico", async () => {
    memoryFindMany.mockResolvedValue([
      { memoryType: "PATTERN", title: "Revalidar regressão" },
      { memoryType: "RULE", title: "Ignorada como dica" },
    ]);

    const result = await toolSuggestNextStep(user, context("unknown", "/unknown"));

    expect(result.actions[0]?.label).toBe("Mostrar o contexto atual da tela");
    expect(result.reply).toContain("Dicas do Brain");
    expect(result.reply).toContain("Revalidar regressão");
  });

  it("continua funcionando quando o Brain opcional falha", async () => {
    memoryFindMany.mockRejectedValue(new Error("database unavailable"));

    const result = await toolSuggestNextStep(user, context("permissions"));

    expect(result.success).toBe(true);
    expect(result.actions[0]?.label).toBe("Explicar por que um perfil não vê um módulo");
  });
});
