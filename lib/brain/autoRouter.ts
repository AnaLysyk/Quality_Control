import type { AgentMode } from "@/lib/brain/agents";

export type AutoBrainRoute = {
  agentMode: AgentMode;
  useBrain: boolean;
  useRag: boolean;
  useDatabase: boolean;
  useWeb: boolean;
  useQaCopilot: boolean;
  label: string;
  reason: string;
  sources: Array<"brain" | "rag" | "database" | "web">;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normalize(term)));
}

function isCasual(text: string) {
  return /^(oi|ola|olá|bom dia|boa tarde|boa noite|obrigad|valeu|ok|blz|beleza|show|top)$/i.test(text.trim());
}

export function buildAutoBrainRoute(message: string): AutoBrainRoute {
  const text = normalize(String(message ?? ""));

  const wantsWeb =
    /https?:\/\//i.test(message) ||
    hasAny(text, [
      "internet",
      "web",
      "google",
      "pesquisa",
      "pesquisar",
      "buscar online",
      "noticia",
      "notícias",
      "hoje",
      "agora",
      "atual",
      "ultima",
      "última",
      "latest",
      "documentacao oficial",
      "documentação oficial",
      "docs oficiais",
      "site oficial",
      "versao atual",
      "versão atual",
    ]);

  const wantsPlaywright = hasAny(text, [
    "playwright",
    "teste automatizado",
    "testes automatizados",
    "e2e",
    "spec",
    "locator",
    "selector",
    "automatizar",
    "automacao",
    "automação",
    "script",
  ]);

  const wantsDebug = hasAny(text, [
    "erro",
    "bug",
    "falha",
    "exception",
    "crash",
    "log",
    "stack",
    "debug",
    "quebrou",
    "nao funciona",
    "não funciona",
    "500",
    "401",
    "403",
    "404",
    "422",
  ]);

  const wantsMemory = hasAny(text, [
    "memoria",
    "memória",
    "historico",
    "histórico",
    "decisao",
    "decisão",
    "regra",
    "contexto",
    "documentar",
    "registrar",
    "o que sabemos",
  ]);

  const wantsQa = hasAny(text, [
    "qa",
    "teste",
    "testes",
    "cenario",
    "cenário",
    "caso",
    "regressao",
    "regressão",
    "evidencia",
    "evidência",
    "release",
    "aceite",
    "homologacao",
    "homologação",
    "risco",
    "impacto",
    "jira",
    "qase",
    "postman",
    "endpoint",
    "api",
    "payload",
  ]);

  let agentMode: AgentMode = "qa";
  let label = "Brain QA";
  let reason = "Apoio geral de QA";

  if (wantsPlaywright) {
    agentMode = "playwright";
    label = "Brain Playwright";
    reason = "Pedido relacionado a automação/teste E2E";
  } else if (wantsDebug) {
    agentMode = "debug";
    label = "Brain Debug";
    reason = "Pedido relacionado a erro, log, bug ou investigação";
  } else if (wantsMemory) {
    agentMode = "memory";
    label = "Brain Memory";
    reason = "Pedido relacionado a contexto, regra, histórico ou decisão";
  } else if (wantsQa) {
    agentMode = "qa";
    label = "Brain QA";
    reason = "Pedido relacionado a qualidade, teste, release ou validação";
  }

  const useBrain = !isCasual(text) || wantsWeb || wantsQa || wantsDebug || wantsPlaywright || wantsMemory;
  const sources: AutoBrainRoute["sources"] = ["brain", "rag", "database"];
  if (wantsWeb) sources.push("web");

  return {
    agentMode,
    useBrain,
    useRag: useBrain,
    useDatabase: useBrain,
    useWeb: wantsWeb,
    useQaCopilot: true,
    label,
    reason,
    sources,
  };
}
