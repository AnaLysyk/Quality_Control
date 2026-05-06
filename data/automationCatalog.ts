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
    title: "Tokens e sessão",
    requestCount: 5,
    summary: "Bootstrap de autenticação, renovação e token web para fluxos guiados.",
    highlights: ["/api/tokens", "/api/tokens/web", "/api/tokens/renew"],
    maturity: "priority",
  },
  {
    id: "processos",
    title: "Processos",
    requestCount: 34,
    summary: "Núcleo operacional da coleção, com consulta, biometria, captura, status e pagamentos.",
    highlights: ["/api/processos/:id", "/api/processos/:id/verify", "/api/processos/:id/payment"],
    maturity: "priority",
  },
  {
    id: "pessoas",
    title: "Pessoas",
    requestCount: 5,
    summary: "Busca de pessoa, laudo e listagens para análise rápida de dados civis.",
    highlights: ["/api/pessoas", "/api/pessoas/list", "/api/laudo/generate"],
    maturity: "mapped",
  },
  {
    id: "cardscan",
    title: "Cardscan",
    requestCount: 9,
    summary: "Perfis, processamento e layouts de leitura documental para cenários visuais.",
    highlights: ["/api/cardscan/profile/:profileId", "/api/cardscan/process", "/api/cardscan/layout"],
    maturity: "priority",
  },
  {
    id: "rfb",
    title: "RFB / BCadastro",
    requestCount: 4,
    summary: "Validação de CPF e consultas externas que têm maior valor para automação guiada.",
    highlights: ["/api/bcadastro/cpf/:cpf", "/cpf/:cpf"],
    maturity: "priority",
  },
  {
    id: "config",
    title: "Configuração",
    requestCount: 2,
    summary: "Propriedades, unidades e base operacional para montar presets por ambiente.",
    highlights: ["/api/config/properties", "/api/config/unidades"],
    maturity: "mapped",
  },
  {
    id: "attention",
    title: "Attention",
    requestCount: 3,
    summary: "Gestão de atenção operacional para fila, histórico e investigação de processo.",
    highlights: ["/api/processos/attention", "/api/processos/attention/list"],
    maturity: "next",
  },
  {
    id: "sefaz-package",
    title: "Sefaz e Package",
    requestCount: 3,
    summary: "Integrações auxiliares que entram depois do runner principal estar sólido.",
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
    note: "Já compatível com Newman e com o setup atual do repositório.",
  },
  {
    id: "qc-local",
    title: "Painel QA local",
    baseUrl: "http://127.0.0.1:3000",
    status: "ready",
    note: "Usado pela Testing Company para smoke de telas e fluxos do proprio sistema.",
  },
  {
    id: "staging",
    title: "Homologação",
    baseUrl: "Definir por ambiente",
    status: "planned",
    note: "Separar credenciais, presets e smoke tests por aplicação.",
  },
  {
    id: "machines",
    title: "Máquinas dedicadas",
    baseUrl: "Mapear hosts 146 e demais nós",
    status: "planned",
    note: "Ideal para rodar fluxos com dependências locais e drivers instalados.",
  },
  {
    id: "prod-safe",
    title: "Produção segura",
    baseUrl: "Somente leitura / whitelist",
    status: "restricted",
    note: "Liberar apenas cenários auditáveis, sem escrita destrutiva.",
  },
];

export const AUTOMATION_FLOWS: AutomationFlow[] = [
  {
    id: "griaule-biometrics",
    title: "Anexo biométrico Griaule",
    audience: "Suporte técnico / Líder TC / Usuário TC",
    objective: "Executar a cadeia real de biometria com digital e face, controlando o limite Base64 antes do PUT.",
    steps: ["Escolher empresa visível", "Selecionar fixture", "Resolver processo", "Executar GET/PUT/GET e salvar evidência"],
    stack: "HTTP runner + fixtures locais",
  },
  {
    id: "cpf-rfb",
    title: "Consulta CPF na RFB",
    audience: "Suporte técnico / Líder TC",
    objective: "Transformar a consulta de CPF em um fluxo visual, validando payload, resposta e erros frequentes.",
    steps: ["Selecionar ambiente", "Informar CPF", "Executar endpoint", "Exibir resultado e histórico"],
    stack: "HTTP runner",
  },
  {
    id: "token-processo",
    title: "Token + consulta de processo",
    audience: "QA técnico",
    objective: "Encadear autenticação, renovação e consulta principal sem depender do Postman.",
    steps: ["Gerar token", "Persistir sessão segura", "Consultar processo", "Salvar evidência"],
    stack: "HTTP runner + histórico",
  },
  {
    id: "cardscan-layout",
    title: "Validação de cardscan",
    audience: "QA funcional",
    objective: "Executar perfis e layouts por cenário para reduzir erro manual e acelerar análise visual.",
    steps: ["Escolher perfil", "Enviar entrada", "Processar layout", "Comparar saída esperada"],
    stack: "HTTP runner + comparador visual",
  },
  {
    id: "browser-fallback",
    title: "Fluxos de navegador",
    audience: "QA automação",
    objective: "Usar Playwright apenas onde houver interface, autenticação web ou dependência de navegador.",
    steps: ["Preparar estado", "Executar fluxo", "Capturar evidência", "Anexar resultado"],
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
    title: "Operação guiada",
    summary: "O usuário não monta request manualmente; ele escolhe um fluxo e preenche apenas o necessário.",
    bullets: ["Presets por ambiente", "Formulários orientados", "Mensagens de erro legíveis"],
  },
  {
    id: "runner",
    title: "Orquestração simples",
    summary: "Backend centraliza autenticação, variáveis, execução e normalização de resposta.",
    bullets: ["Segredos fora do front", "Logs de execução", "Reuso de adapters por domínio"],
  },
  {
    id: "observability",
    title: "Histórico profissional",
    summary: "Cada execução precisa deixar rastro suficiente para auditoria, depuração e onboarding.",
    bullets: ["Payload mascarado", "Duração", "Status final e evidências"],
  },
  {
    id: "docs",
    title: "Documentação viva",
    summary: "Cada fluxo novo deve nascer com descrição operacional e critérios claros de uso.",
    bullets: ["Objetivo", "Pré-condições", "Exemplos", "Restrições de ambiente"],
  },
];
