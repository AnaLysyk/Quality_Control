export type DocumentationArea =
  | "Runs"
  | "Empresas"
  | "Automacao"
  | "API Lab"
  | "Playwright"
  | "Brain"
  | "Permissoes"
  | "Integracoes";

export type DocumentationEntry = {
  id: string;
  area: DocumentationArea;
  title: string;
  summary: string;
  content: string;
  updatedAt: string;
};

export const documentationEntries: DocumentationEntry[] = [
  {
    id: "runs-base",
    area: "Runs",
    title: "Fluxo de Runs",
    summary: "Como runs manuais e integradas entram no Quality Control.",
    updatedAt: "2026-04-29",
    content:
      "Runs integradas carregam estatisticas e casos via Qase. Runs manuais usam o quadro local editavel, com status, evidencias e bugs sincronizados nos totais.",
  },
  {
    id: "empresas-acesso",
    area: "Empresas",
    title: "Acesso por empresa",
    summary: "Regras de vinculo, slug ativo e usuario privilegiado.",
    updatedAt: "2026-04-29",
    content:
      "Rotas em /empresas/[slug] devem validar o usuario normalizado. Usuarios TC, suporte e administradores globais podem acessar empresas sem vinculo direto quando a regra do perfil permitir.",
  },
  {
    id: "automacao-modulos",
    area: "Automacao",
    title: "Central de automacao",
    summary: "Visao geral dos modulos de automacao ja existentes.",
    updatedAt: "2026-04-29",
    content:
      "A area de automacoes concentra API Lab, Playwright Studio, execucoes, logs e workbench operacional. Novas automacoes devem reaproveitar esses modulos.",
  },
  {
    id: "api-lab",
    area: "API Lab",
    title: "API Lab",
    summary: "Uso do laboratorio de APIs para colecoes e validacoes.",
    updatedAt: "2026-04-29",
    content:
      "O API Lab serve para organizar requisicoes, ambientes e validacoes. Ele deve evoluir sem duplicar logica de integracao ja presente em automacoes.",
  },
  {
    id: "playwright",
    area: "Playwright",
    title: "Playwright Studio",
    summary: "Execucao e organizacao de cenarios automatizados.",
    updatedAt: "2026-04-29",
    content:
      "O Playwright Studio e a rota de Playwright ja existem. Use esses pontos para expandir cenarios, logs e evidencias de automacao.",
  },
  {
    id: "brain",
    area: "Brain",
    title: "Brain operacional",
    summary: "Memoria e apoio operacional para o painel.",
    updatedAt: "2026-04-29",
    content:
      "O Brain deve apoiar analise, historico e retomada tecnica, sempre conectado aos fluxos reais do Quality Control.",
  },
  {
    id: "permissoes",
    area: "Permissoes",
    title: "Permissoes e capacidades",
    summary: "Como roles e capabilities impactam navegacao e acesso.",
    updatedAt: "2026-04-29",
    content:
      "A navegacao e os guards devem consultar roles normalizadas e capabilities. Evite validar acesso diretamente contra campos crus do payload.",
  },
  {
    id: "integracoes",
    area: "Integracoes",
    title: "Integracoes externas",
    summary: "Qase, Jira e demais fontes externas.",
    updatedAt: "2026-04-29",
    content:
      "Integracoes devem ter erro tratado e fallback visivel. Dados externos nao devem bloquear a renderizacao basica do shell da empresa.",
  },
];
