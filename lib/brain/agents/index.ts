import "server-only";

import { qaAgentConfig } from "./qaAgent";
import { debugAgentConfig } from "./debugAgent";
import { playwrightAgentConfig } from "./playwrightAgent";
import { memoryAgentConfig } from "./memoryAgent";

export type AgentMode = "qa" | "debug" | "playwright" | "memory";

export type AgentConfig = {
  mode: AgentMode;
  name: string;
  icon: string;
  label: string;
  color: string;
  tools: string[];
  buildSystemPrompt: (metrics: string, nodeCtx: string) => string;
};

export const AGENT_REGISTRY: Record<AgentMode, AgentConfig> = {
  qa: qaAgentConfig,
  debug: debugAgentConfig,
  playwright: playwrightAgentConfig,
  memory: memoryAgentConfig,
};

/**
 * Detecta automaticamente o agente mais adequado para uma pergunta.
 * Usa palavras-chave simples — pode ser melhorado com classificador futuro.
 */
export function detectAgentMode(message: string): AgentMode {
  const lower = message.toLowerCase();

  const playwrightTerms = ["playwright", "teste automatizado", "spec", "locator", "selector", "pom", "e2e", "gerar teste", "automatizar", "automation"];
  const debugTerms = ["erro", "bug", "falha", "error", "exception", "crash", "causa raiz", "porque falhou", "log", "stack trace", "debug"];
  const memoryTerms = ["decisão", "decisao", "memória", "memoria", "histórico", "historico", "regra", "padrão", "padrao", "por que foi feito", "arquitetura"];

  if (playwrightTerms.some((t) => lower.includes(t))) return "playwright";
  if (debugTerms.some((t) => lower.includes(t))) return "debug";
  if (memoryTerms.some((t) => lower.includes(t))) return "memory";
  return "qa";
}
