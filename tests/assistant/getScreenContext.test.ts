jest.mock("@/lib/auth/localStore", () => ({
  getLocalUserById: jest.fn().mockResolvedValue({
    id: "u1",
    name: "Ana Silva",
    email: "ana@test.com",
  }),
}));

jest.mock("@/lib/assistant/data", () => ({
  buildPromptActions: (context: { suggestedPrompts: string[] }) =>
    context.suggestedPrompts.slice(0, 4).map((prompt) => ({ kind: "prompt", label: prompt, prompt })),
  displayName: (user: { name?: string | null; email?: string | null } | null | undefined) =>
    user?.name?.trim() || user?.email?.trim() || "usuario",
  displayRole: (user: { permissionRole?: string | null; role?: string | null; companyRole?: string | null }) =>
    user.permissionRole ?? user.role ?? user.companyRole ?? "usuario",
  summarizePermissionMatrix: () => "tickets: create, read | users: view",
}));

import type { AuthUser } from "@/lib/jwtAuth";
import { toolGetScreenContext } from "@/lib/assistant/tools/getScreenContext";
import type { AssistantScreenContext } from "@/lib/assistant/types";

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    email: "ana@test.com",
    name: "Ana",
    role: "admin",
    companySlug: "acme",
    permissions: { tickets: ["create", "read"] },
    ...overrides,
  } as AuthUser;
}

function makeContext(overrides: Partial<AssistantScreenContext> = {}): AssistantScreenContext {
  return {
    route: "/admin/support",
    module: "support",
    screenLabel: "Kanban global de suporte",
    screenSummary: "Voce esta em: Kanban global de suporte. Aqui voce prioriza e acompanha chamados. Dica: cite o codigo do ticket.",
    entityType: "screen",
    entityId: null,
    companySlug: "acme",
    suggestedPrompts: [
      "Buscar chamado por codigo",
      "Atribuir responsavel ao chamado",
      "Avancar status do chamado",
      "Listar chamados pendentes",
      "Explicar bloqueio do ticket",
    ],
    ...overrides,
  };
}

describe("toolGetScreenContext", () => {
  it("returns an action-oriented reply without exposing login details", async () => {
    const result = await toolGetScreenContext(makeUser(), makeContext());

    expect(result.tool).toBe("get_screen_context");
    expect(result.reply).toContain("Voce esta em Kanban global de suporte.");
    expect(result.reply).toContain("O que voce pode fazer agora:");
    expect(result.reply).toContain("Sugestoes de prompt:");
    expect(result.reply).toContain("Contexto atual:");
    expect(result.reply).toContain("Permissoes relevantes:");
    expect(result.reply).toContain("Perfil: admin");
    expect(result.reply).not.toContain("ana@test.com");
    expect(result.reply).not.toContain("Rota:");
    expect(result.actions).toHaveLength(4);
  });

  it("uses the current company scope and keeps the intro line non-duplicated", async () => {
    const result = await toolGetScreenContext(
      makeUser({ companySlug: "globex" }),
      makeContext({
        route: "/empresas/globex",
        module: "company",
        screenLabel: "Empresas e contexto da conta",
        screenSummary: "Voce esta em: Empresas e contexto da conta. Aqui voce consulta registros e vinculos da empresa atual. Dica: informe o slug da empresa.",
        companySlug: "globex",
      }),
    );

    expect(result.reply).toContain("Escopo: globex");
    expect(result.reply).toContain("Resumir a empresa atual e os registros ligados a ela.");
    expect(result.reply.match(/Voce esta em/g)).toHaveLength(1);
  });
});
