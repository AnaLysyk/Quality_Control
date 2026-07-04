import type { AgentMode } from "@/lib/brain/agents";

export type AutoBrainSource = "brain" | "rag" | "database" | "web" | "local-model";

export type AutoBrainRoute = {
  agentMode: AgentMode;
  useBrain: boolean;
  useRag: boolean;
  useDatabase: boolean;
  useWeb: boolean;
  useLocalModel: boolean;
  useQaCopilot: boolean;
  label: string;
  reason: string;
  sources: AutoBrainSource[];
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
  const raw = String(message ?? "");
  const text = normalize(raw);

  const wantsWeb =
    /https?:\/\//i.test(raw) ||
    hasAny(text, [
      "internet",
      "web",
      "google",
      "pesquisa",
      "pesquisar",
      "buscar online",
      "noticia",
      "notícias",
      "noticias",
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
  const sources: AutoBrainSource[] = ["database", "brain", "rag", "local-model"];

  if (wantsWeb) sources.push("web");

  return {
    agentMode,
    useBrain,
    useRag: useBrain,
    useDatabase: true,
    useWeb: wantsWeb,
    useLocalModel: true,
    useQaCopilot: true,
    label,
    reason,
    sources,
  };
}
