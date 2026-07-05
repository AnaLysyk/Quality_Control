import "server-only";

export type BrainModelProvider = "groq" | "gemini" | "openrouter" | "mock";

export type BrainModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type BrainModelInput = {
  messages: BrainModelMessage[];
  temperature?: number;
  maxTokens?: number;
};

type BrainModelResult = {
  provider: BrainModelProvider;
  model?: string;
  text: string;
};

function compactText(value: unknown, max = 9000) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function fallbackAnswer(messages: BrainModelMessage[]) {
  const lastUser = [...messages].reverse().find((item) => item.role === "user")?.content ?? "";

  return [
    "Brain respondeu em modo interno.",
    "",
    "Não usei API externa, modelo online, token pago, Groq, Gemini, OpenRouter ou Ollama.",
    "Base usada: banco, RAG e templates internos do Quality Control.",
    "",
    "Pedido recebido:",
    compactText(lastUser, 1200),
  ].join("\n");
}

export async function runBrainModel(input: BrainModelInput): Promise<BrainModelResult> {
  return {
    provider: "mock",
    model: "brain-internal-rag-template",
    text: fallbackAnswer(input.messages),
  };
}

export function buildBrainSystemPrompt() {
  return [
    "Você é o Brain do Quality Control.",
    "Você apoia QA, debug, automação, documentação, evidências, análise de risco, permissões, banco de dados, RAG e templates internos.",
    "O banco de dados é sempre a fonte principal da verdade.",
    "Use RAG e memória para contexto.",
    "Não chame Groq, Gemini, OpenRouter, Ollama ou qualquer modelo externo neste modo.",
    "Não use modelo pago.",
    "Responda em português brasileiro.",
    "Seja direto, prático e operacional.",
    "Respeite empresa, usuário, perfil, permissão e escopo.",
    "Nunca exponha senha, token, segredo, cookie, credencial ou dado sensível.",
    "Quando uma ação alterar dados reais, peça confirmação antes.",
  ].join("\n");
}
