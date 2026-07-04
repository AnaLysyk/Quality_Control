import type { AgentMode } from "@/lib/brain/agents";

<<<<<<< HEAD
export type AutoBrainSource = "brain" | "rag" | "database" | "web" | "local-model";

=======
>>>>>>> origin/main
export type AutoBrainRoute = {
  agentMode: AgentMode;
  useBrain: boolean;
  useRag: boolean;
  useDatabase: boolean;
  useWeb: boolean;
<<<<<<< HEAD
  useLocalModel: boolean;
  label: string;
  reason: string;
  sources: AutoBrainSource[];
=======
  useQaCopilot: boolean;
  label: string;
  reason: string;
  sources: Array<"brain" | "rag" | "database" | "web">;
>>>>>>> origin/main
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
<<<<<<< HEAD
  const raw = String(message ?? "");
  const text = normalize(raw);

  const wantsWeb =
    /https?:\/\//i.test(raw) ||
=======
  const text = normalize(String(message ?? ""));

  const wantsWeb =
    /https?:\/\//i.test(message) ||
>>>>>>> origin/main
    hasAny(text, [
      "internet",
      "web",
      "google",
      "pesquisa",
      "pesquisar",
      "buscar online",
      "noticia",
<<<<<<< HEAD
      "noticias",
=======
      "notícias",
>>>>>>> origin/main
      "hoje",
      "agora",
      "atual",
      "ultima",
<<<<<<< HEAD
      "latest",
      "documentacao oficial",
      "docs oficiais",
      "site oficial",
      "versao atual",
=======
      "última",
      "latest",
      "documentacao oficial",
      "documentação oficial",
      "docs oficiais",
      "site oficial",
      "versao atual",
      "versão atual",
>>>>>>> origin/main
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
<<<<<<< HEAD
=======
    "automação",
>>>>>>> origin/main
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
<<<<<<< HEAD
=======
    "não funciona",
>>>>>>> origin/main
    "500",
    "401",
    "403",
    "404",
    "422",
  ]);

  const wantsMemory = hasAny(text, [
    "memoria",
<<<<<<< HEAD
    "historico",
    "decisao",
=======
    "memória",
    "historico",
    "histórico",
    "decisao",
    "decisão",
>>>>>>> origin/main
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
<<<<<<< HEAD
    "caso",
    "regressao",
    "evidencia",
    "release",
    "aceite",
    "homologacao",
=======
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
>>>>>>> origin/main
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
<<<<<<< HEAD
    reason = "Pedido relacionado a automação e teste E2E";
=======
    reason = "Pedido relacionado a automação/teste E2E";
>>>>>>> origin/main
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
<<<<<<< HEAD
  const sources: AutoBrainSource[] = ["database", "brain", "rag", "local-model"];

=======
  const sources: AutoBrainRoute["sources"] = ["brain", "rag", "database"];
>>>>>>> origin/main
  if (wantsWeb) sources.push("web");

  return {
    agentMode,
    useBrain,
    useRag: useBrain,
<<<<<<< HEAD
    useDatabase: true,
    useWeb: wantsWeb,
    useLocalModel: true,
=======
    useDatabase: useBrain,
    useWeb: wantsWeb,
    useQaCopilot: true,
>>>>>>> origin/main
    label,
    reason,
    sources,
  };
}
