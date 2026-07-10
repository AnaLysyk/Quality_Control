import { buildBrainSystemPrompt } from "@/lib/brain/modelProvider";

describe("buildBrainSystemPrompt com perfil de comportamento", () => {
  it("sem perfil, mantem o prompt padrao sem secao de modo de conversa", () => {
    const prompt = buildBrainSystemPrompt(null);
    expect(prompt).not.toContain("Modo de conversa selecionado");
  });

  it("com perfil, inclui nome, instrucoes e nunca remove as regras de seguranca", () => {
    const prompt = buildBrainSystemPrompt({
      name: "QA especialista",
      instructions: "Foque em riscos, casos de teste e evidências.",
      formality: "neutral",
      responseLength: "short",
    });

    expect(prompt).toContain("Modo de conversa selecionado: QA especialista.");
    expect(prompt).toContain("Foque em riscos, casos de teste e evidências.");
    expect(prompt).toContain("Nivel de formalidade: neutral.");
    expect(prompt).toContain("Priorize respostas curtas.");
    // As regras de seguranca/permissao do prompt base continuam presentes mesmo com perfil aplicado.
    expect(prompt).toContain("Nunca exponha senha, token, segredo, cookie, credencial ou dado sensível.");
    expect(prompt).toContain("Respeite empresa, usuário, perfil, permissão e escopo.");
  });
});
