export type InternalQcProject = {
  id: string;
  name: string;
  slug: string;
  area: string;
  goal: string;
  priority: "alta" | "media";
  suites: string[];
  indicators: string[];
};

export type InternalQcCompany = {
  id: string;
  name: string;
  slug: string;
  status: "active";
  automationFramework: "Playwright";
  summary: string;
  projects: InternalQcProject[];
};

export const internalQualityControlCompany: InternalQcCompany = {
  id: "cmp_qc_internal",
  name: "Quality Control",
  slug: "quality-control",
  status: "active",
  automationFramework: "Playwright",
  summary: "Empresa interna usada para organizar os projetos, automacoes, runs, metricas e relatorios do proprio produto Quality Control.",
  projects: [
    {
      id: "qc-platform",
      name: "Plataforma Quality Control",
      slug: "plataforma-quality-control",
      area: "Plataforma",
      goal: "Validar navegacao, login, layout, experiencia base e fluxos principais.",
      priority: "alta",
      suites: ["quality-smoke", "quality-ui", "quality-access"],
      indicators: ["smoke", "layout", "acessos", "navegacao"],
    },
    {
      id: "qc-brain",
      name: "Brain",
      slug: "brain",
      area: "Brain",
      goal: "Validar chat, grafo, anexos, utilitarios, respostas e permissao por perfil.",
      priority: "alta",
      suites: ["quality-ai", "brain-contracts"],
      indicators: ["contador", "conversor", "grafo", "comandos"],
    },
    {
      id: "qc-automation",
      name: "Automacao",
      slug: "automacao",
      area: "Automacao",
      goal: "Padronizar criacao, edicao e execucao de testes com Playwright.",
      priority: "alta",
      suites: ["quality-automation", "api-lab", "playwright-builder"],
      indicators: ["api lab", "builder", "execucao", "logs"],
    },
    {
      id: "qc-runs-reports",
      name: "Runs e Relatorios",
      slug: "runs-e-relatorios",
      area: "Runs",
      goal: "Acompanhar execucoes, resultados, indicadores, exportacao e historico.",
      priority: "alta",
      suites: ["quality-runs", "quality-dashboards"],
      indicators: ["runs", "relatorios", "score", "gate"],
    },
    {
      id: "qc-profiles-access",
      name: "Gestao de Perfis e Acessos",
      slug: "gestao-de-perfis-e-acessos",
      area: "Acessos",
      goal: "Validar perfis, permissoes, visibilidade de telas, empresa e projeto.",
      priority: "alta",
      suites: ["quality-access", "profile-cycle"],
      indicators: ["perfil", "permissao", "empresa", "projeto"],
    },
    {
      id: "qc-quality-central",
      name: "Central de Qualidade",
      slug: "central-de-qualidade",
      area: "Qualidade",
      goal: "Consolidar saude do projeto, saude da empresa, score, riscos e nota executiva.",
      priority: "media",
      suites: ["quality-dashboards", "quality-reports"],
      indicators: ["score", "risco", "tendencia", "nota executiva"],
    },
    {
      id: "qc-dashboards",
      name: "Dashboards e Indicadores",
      slug: "dashboards-e-indicadores",
      area: "Dashboards",
      goal: "Validar cards, graficos, filtros, visao geral e comparativos.",
      priority: "media",
      suites: ["quality-dashboards", "quality-ui"],
      indicators: ["cards", "graficos", "filtros", "comparativos"],
    },
  ],
};

export const playwrightQualityControlRules = [
  "Usar Playwright como padrao para testes de interface, API, smoke, regressao e acessibilidade quando aplicavel.",
  "Vincular cada automacao a empresa Quality Control, projeto, modulo, suite e caso quando existir.",
  "Transformar execucao automatizada em run rastreavel para alimentar relatorios e visao geral.",
  "Manter resultado, log e anexos importantes associados a execucao.",
  "Alimentar Brain e Central de Qualidade com os sinais gerados pelas runs.",
];

