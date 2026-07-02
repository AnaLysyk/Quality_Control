export type AutomationDomain = {
  id: string;
  title: string;
  requestCount: number;
  summary: string;
  highlights: string[];
  maturity: "mapped" | "priority" | "next";
};

export type AutomationEnvironment = {
  id: string;
  title: string;
  baseUrl: string;
  status: "ready" | "planned" | "restricted";
  note: string;
};

export type AutomationEnvironmentVariable = {
  key: string;
  value: string;
  secret?: boolean;
};

export function getDefaultAutomationEnvironmentId(companyScope?: string | null) {
  const scope = (companyScope ?? "").trim().toLowerCase();
  if (scope === "griaule") return "griaule-hml-api-146";
  if (scope === "testing-company" || scope === "testing_company") return "qc-local";
  return "local";
}

export function getAutomationEnvironmentVariables(environmentId: string): AutomationEnvironmentVariable[] {
  // Defaults must be safe and non-secret; secrets should be injected at runtime by operators.
  if (environmentId.startsWith("griaule-hml-")) {
    return [
      { key: "smartEmail", value: "" },
      { key: "smartPassword", value: "", secret: true },
    ];
  }

  return [];
}

export type AutomationFlow = {
  id: string;
  title: string;
  audience: string;
  objective: string;
  steps: string[];
  stack: string;
};

export type AutomationPillar = {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
};

export const AUTOMATION_DOMAIN_TOTAL = 8;
export const AUTOMATION_REQUEST_TOTAL = 71;

export const AUTOMATION_DOMAINS: AutomationDomain[] = [
  {
    id: "tokens",
    title: "Tokens e sessÃ£o",
    requestCount: 5,
    summary: "Bootstrap de autenticaÃ§Ã£o, renovaÃ§Ã£o e token web para fluxos guiados.",
    highlights: ["/api/tokens", "/api/tokens/web", "/api/tokens/renew"],
    maturity: "priority",
  },
  {
    id: "processos",
    title: "Processos",
    requestCount: 34,
    summary: "NÃºcleo operacional da coleÃ§Ã£o, com consulta, biometria, captura, status e pagamentos.",
    highlights: ["/api/processos/:id", "/api/processos/:id/verify", "/api/processos/:id/payment"],
    maturity: "priority",
  },
  {
    id: "pessoas",
    title: "Pessoas",
    requestCount: 5,
    summary: "Busca de pessoa, laudo e listagens para anÃ¡lise rÃ¡pida de dados civis.",
    highlights: ["/api/pessoas", "/api/pessoas/list", "/api/laudo/generate"],
    maturity: "mapped",
  },
  {
    id: "cardscan",
    title: "Cardscan",
    requestCount: 9,
    summary: "Perfis, processamento e layouts de leitura documental para cenÃ¡rios visuais.",
    highlights: ["/api/cardscan/profile/:profileId", "/api/cardscan/process", "/api/cardscan/layout"],
    maturity: "priority",
  },
  {
    id: "rfb",
    title: "RFB / BCadastro",
    requestCount: 4,
    summary: "ValidaÃ§Ã£o de CPF e consultas externas que tÃªm maior valor para automaÃ§Ã£o guiada.",
    highlights: ["/api/bcadastro/cpf/:cpf", "/cpf/:cpf"],
    maturity: "priority",
  },
  {
    id: "config",
    title: "ConfiguraÃ§Ã£o",
    requestCount: 2,
    summary: "Propriedades, unidades e base operacional para montar presets por ambiente.",
    highlights: ["/api/config/properties", "/api/config/unidades"],
    maturity: "mapped",
  },
  {
    id: "attention",
    title: "Attention",
    requestCount: 3,
    summary: "GestÃ£o de atenÃ§Ã£o operacional para fila, histÃ³rico e investigaÃ§Ã£o de processo.",
    highlights: ["/api/processos/attention", "/api/processos/attention/list"],
    maturity: "next",
  },
  {
    id: "sefaz-package",
    title: "Sefaz e Package",
    requestCount: 3,
    summary: "IntegraÃ§Ãµes auxiliares que entram depois do runner principal estar sÃ³lido.",
    highlights: ["/api/package/:packageId", "/exemption/list"],
    maturity: "next",
  },
];

export const AUTOMATION_ENVIRONMENTS: AutomationEnvironment[] = [
  {
    id: "local",
    title: "Local",
    baseUrl: "http://127.0.0.1:8080",
    status: "ready",
    note: "JÃ¡ compatÃ­vel com Newman e com o setup atual do repositÃ³rio.",
  },
  {
    id: "qc-local",
    title: "Painel QA local",
    baseUrl: "http://127.0.0.1:3000",
    status: "ready",
    note: "Usado pela Testing Company para smoke de telas e fluxos do proprio sistema.",
  },
  {
    id: "griaule-hml-api-146",
    title: "Griaule HML API (146)",
    baseUrl: "http://172.16.1.146:8100",
    status: "ready",
    note: "Host homologaÃ§Ã£o Griaule (API principal). Sem segredos por padrÃ£o.",
  },
  {
    id: "griaule-hml-smart-146",
    title: "Griaule HML Smart (146)",
    baseUrl: "http://172.16.1.146:8128",
    status: "ready",
    note: "Host homologaÃ§Ã£o Griaule (Smart UI). Sem segredos por padrÃ£o.",
  },
  {
    id: "griaule-hml-api-201",
    title: "Griaule HML API (201)",
    baseUrl: "http://172.16.1.201:8100",
    status: "ready",
    note: "Host alternativo homologaÃ§Ã£o Griaule. Sem segredos por padrÃ£o.",
  },
  {
    id: "staging",
    title: "HomologaÃ§Ã£o",
    baseUrl: "Definir por ambiente",
    status: "planned",
    note: "Separar credenciais, presets e smoke tests por aplicaÃ§Ã£o.",
  },
  {
    id: "machines",
    title: "MÃ¡quinas dedicadas",
    baseUrl: "Mapear hosts 146 e demais nÃ³s",
    status: "planned",
    note: "Ideal para rodar fluxos com dependÃªncias locais e drivers instalados.",
  },
  {
    id: "prod-safe",
    title: "ProduÃ§Ã£o segura",
    baseUrl: "Somente leitura / whitelist",
    status: "restricted",
    note: "Liberar apenas cenÃ¡rios auditÃ¡veis, sem escrita destrutiva.",
  },
];

export const AUTOMATION_FLOWS: AutomationFlow[] = [
  {
    id: "griaule-biometrics",
    title: "Anexo biomÃ©trico Griaule",
    audience: "Suporte tÃ©cnico / LÃ­der TC / UsuÃ¡rio TC",
    objective: "Executar a cadeia real de biometria com digital e face, controlando o limite Base64 antes do PUT.",
    steps: ["Escolher empresa visÃ­vel", "Selecionar fixture", "Resolver processo", "Executar GET/PUT/GET e salvar evidÃªncia"],
    stack: "HTTP runner + fixtures locais",
  },
  {
    id: "cpf-rfb",
    title: "Consulta CPF na RFB",
    audience: "Suporte tÃ©cnico / LÃ­der TC",
    objective: "Transformar a consulta de CPF em um fluxo visual, validando payload, resposta e erros frequentes.",
    steps: ["Selecionar ambiente", "Informar CPF", "Executar endpoint", "Exibir resultado e histÃ³rico"],
    stack: "HTTP runner",
  },
  {
    id: "token-processo",
    title: "Token + consulta de processo",
    audience: "QA tÃ©cnico",
    objective: "Encadear autenticaÃ§Ã£o, renovaÃ§Ã£o e consulta principal sem depender do Postman.",
    steps: ["Gerar token", "Persistir sessÃ£o segura", "Consultar processo", "Salvar evidÃªncia"],
    stack: "HTTP runner + histÃ³rico",
  },
  {
    id: "cardscan-layout",
    title: "ValidaÃ§Ã£o de cardscan",
    audience: "QA funcional",
    objective: "Executar perfis e layouts por cenÃ¡rio para reduzir erro manual e acelerar anÃ¡lise visual.",
    steps: ["Escolher perfil", "Enviar entrada", "Processar layout", "Comparar saÃ­da esperada"],
    stack: "HTTP runner + comparador visual",
  },
  {
    id: "browser-fallback",
    title: "Fluxos de navegador",
    audience: "QA automaÃ§Ã£o",
    objective: "Usar Playwright apenas onde houver interface, autenticaÃ§Ã£o web ou dependÃªncia de navegador.",
    steps: ["Preparar estado", "Executar fluxo", "Capturar evidÃªncia", "Anexar resultado"],
    stack: "Playwright",
  },
  {
    id: "qc-screen-smoke",
    title: "Smoke de telas do Painel QA",
    audience: "Testing Company",
    objective: "Validar as telas principais do proprio produto com uma suite curta por contexto.",
    steps: ["Selecionar tela", "Abrir rota interna", "Validar shell", "Salvar evidencia"],
    stack: "Playwright + runner interno",
  },
];

export const AUTOMATION_PILLARS: AutomationPillar[] = [
  {
    id: "ux",
    title: "OperaÃ§Ã£o guiada",
    summary: "O usuÃ¡rio nÃ£o monta request manualmente; ele escolhe um fluxo e preenche apenas o necessÃ¡rio.",
    bullets: ["Presets por ambiente", "FormulÃ¡rios orientados", "Mensagens de erro legÃ­veis"],
  },
  {
    id: "runner",
    title: "OrquestraÃ§Ã£o simples",
    summary: "Backend centraliza autenticaÃ§Ã£o, variÃ¡veis, execuÃ§Ã£o e normalizaÃ§Ã£o de resposta.",
    bullets: ["Segredos fora do front", "Logs de execuÃ§Ã£o", "Reuso de adapters por domÃ­nio"],
  },
  {
    id: "observability",
    title: "HistÃ³rico profissional",
    summary: "Cada execuÃ§Ã£o precisa deixar rastro suficiente para auditoria, depuraÃ§Ã£o e onboarding.",
    bullets: ["Payload mascarado", "DuraÃ§Ã£o", "Status final e evidÃªncias"],
  },
  {
    id: "docs",
    title: "DocumentaÃ§Ã£o viva",
    summary: "Cada fluxo novo deve nascer com descriÃ§Ã£o operacional e critÃ©rios claros de uso.",
    bullets: ["Objetivo", "PrÃ©-condiÃ§Ãµes", "Exemplos", "RestriÃ§Ãµes de ambiente"],
  },
];

