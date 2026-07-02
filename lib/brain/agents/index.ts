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
 * Prioridade: playwright > debug > memory > qa (qa Ã© o padrÃ£o mais abrangente).
 */
export function detectAgentMode(message: string): AgentMode {
  const lower = message.toLowerCase();

  const playwrightTerms = [
    "playwright", "teste automatizado", "testes automatizados", "spec", "locator",
    "selector", "pom", "e2e", "gerar teste", "gerar spec", "automatizar", "automation",
    "test file", "page object", "end to end", "escrever teste", "criar teste",
    "cobertura automatizada", "suite de teste",
  ];

  const debugTerms = [
    "erro", "bug", "falha", "error", "exception", "crash", "causa raiz",
    "porque falhou", "por que falhou", "log", "stack trace", "debug",
    "nÃ£o funciona", "nao funciona", "quebrou", "quebrando", "regressÃ£o", "regressao",
    "incidente", "postmortem", "rastrear", "rastreamento", "investigar",
    "o que mudou", "quando parou", "por que estÃ¡ errado",
  ];

  const memoryTerms = [
    "decisÃ£o", "decisao", "memÃ³ria", "memoria", "histÃ³rico", "historico",
    "regra", "padrÃ£o", "padrao", "por que foi feito", "arquitetura",
    "contexto", "documentar", "registrar decisÃ£o", "o que foi decidido",
    "por que existe", "origem", "motivaÃ§Ã£o", "motivacao", "knowledge",
    "base de conhecimento", "o que sabemos", "o que aprendi",
  ];

  if (playwrightTerms.some((t) => lower.includes(t))) return "playwright";
  if (debugTerms.some((t) => lower.includes(t))) return "debug";
  if (memoryTerms.some((t) => lower.includes(t))) return "memory";
  return "qa";
}

